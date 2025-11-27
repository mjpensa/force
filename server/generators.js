import { GoogleGenerativeAI } from '@google/generative-ai';
import { jsonrepair } from 'jsonrepair';
import { generateRoadmapPrompt, roadmapSchema } from './prompts/roadmap.js';
import { generateSlidesPrompt, slidesSchema } from './prompts/slides.js';
import { generateDocumentPrompt, documentSchema } from './prompts/document.js';
import { generateResearchAnalysisPrompt, researchAnalysisSchema } from './prompts/research-analysis.js';
import { PerformanceLogger, createTimer, globalMetrics } from './utils/performanceLogger.js';

// Initialize Gemini API (using API_KEY from environment to match server/config.js)
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

// Timeout configuration for AI generation
const GENERATION_TIMEOUT_MS = 360000; // 6 minutes - increased for complex content and API variability

// ============================================================================
// REQUEST QUEUE - Controls concurrent API calls to prevent overload
// ============================================================================

/**
 * API Request Queue with controlled concurrency and priority support
 *
 * Features:
 * - Concurrency limit prevents rate limiting from Gemini API
 * - Priority queue ensures faster content types complete first
 * - Metrics tracking for performance analysis
 *
 * Priority levels (lower = higher priority):
 * - 1: Document, Slides (fast, simple)
 * - 2: Roadmap (complex but important)
 * - 3: ResearchAnalysis (detailed, can wait)
 */
class APIQueue {
  constructor(maxConcurrent = 4) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];  // Priority queue: { resolve, priority, name }
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      queuedTasks: 0,
      peakConcurrency: 0
    };
  }

  // Priority mapping for content types
  static getPriority(name) {
    const priorities = {
      'Document': 1,
      'Slides': 1,
      'Roadmap': 2,
      'ResearchAnalysis': 3
    };
    return priorities[name] || 2;
  }

  async add(task, name = 'unknown') {
    this.metrics.totalTasks++;

    if (this.running >= this.maxConcurrent) {
      this.metrics.queuedTasks++;
      const priority = APIQueue.getPriority(name);
      await new Promise(resolve => {
        // Insert in priority order
        const entry = { resolve, priority, name };
        const insertIndex = this.queue.findIndex(e => e.priority > priority);
        if (insertIndex === -1) {
          this.queue.push(entry);
        } else {
          this.queue.splice(insertIndex, 0, entry);
        }
      });
    }

    this.running++;
    this.metrics.peakConcurrency = Math.max(this.metrics.peakConcurrency, this.running);

    try {
      const result = await task();
      return result;
    } finally {
      this.running--;
      this.metrics.completedTasks++;
      const next = this.queue.shift();
      if (next) next.resolve();
    }
  }

  async runAll(tasks) {
    return Promise.all(tasks.map(({ task, name }) => this.add(task, name)));
  }

  getMetrics() {
    return {
      ...this.metrics,
      currentlyRunning: this.running,
      currentlyQueued: this.queue.length
    };
  }

  resetMetrics() {
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      queuedTasks: 0,
      peakConcurrency: 0
    };
  }
}

// Global API queue instance
// 4 concurrent calls optimal for Gemini API without triggering rate limits
const apiQueue = new APIQueue(4);

/**
 * Generation config presets optimized for speed and determinism
 *
 * Performance tuning rationale:
 * - temperature: Low (0.1) for deterministic, consistent JSON output
 * - topP/topK: Constrained to reduce token exploration overhead
 * - thinkingBudget: 0 for all types (reasoning disabled = faster response)
 * - maxOutputTokens: Set per content type to prevent runaway generation
 */

// Base config for all structured JSON output
const STRUCTURED_DEFAULT_CONFIG = {
  thinkingBudget: 0  // Disabled for maximum speed
};

// Document: Simplest output, fastest generation
const DOCUMENT_CONFIG = {
  temperature: 0.1,
  topP: 0.3,
  topK: 5,
  thinkingBudget: 0,
  maxOutputTokens: 4096  // Executive summaries are concise
};

// Slides: Simple 6-slide structure
const SLIDES_CONFIG = {
  temperature: 0.1,
  topP: 0.3,
  topK: 5,
  thinkingBudget: 0,
  maxOutputTokens: 4096  // 6 slides with limited content
};

// Roadmap: Complex Gantt chart with many tasks
const ROADMAP_CONFIG = {
  temperature: 0.1,      // Maximum determinism for rule-based output
  topP: 0.3,             // Constrained: follow explicit rules exactly
  topK: 5,               // Minimal exploration
  thinkingBudget: 0,
  maxOutputTokens: 16384 // Large charts need more tokens
};

// Research Analysis: Detailed quality assessment
const RESEARCH_ANALYSIS_CONFIG = {
  temperature: 0.15,     // Slightly higher for nuanced analysis
  topP: 0.4,             // Moderate: allows varied recommendations
  topK: 8,               // Some exploration for insights
  thinkingBudget: 0,
  maxOutputTokens: 8192  // Detailed reports
};
function withTimeout(promise, timeoutMs, operationName) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}
async function generateWithGemini(prompt, schema, contentType, configOverrides = {}, perfLogger = null) {
  const timer = perfLogger ? createTimer(perfLogger, `api-${contentType.toLowerCase()}`) : null;

  try {
    const {
      temperature,
      topP,
      topK,
      maxOutputTokens,
      thinkingBudget = STRUCTURED_DEFAULT_CONFIG.thinkingBudget
    } = configOverrides;
    const generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: schema
    };
    if (thinkingBudget > 0) {
      generationConfig.thinkingConfig = { thinkingBudget };
    }
    if (temperature !== undefined) generationConfig.temperature = temperature;
    if (topP !== undefined) generationConfig.topP = topP;
    if (topK !== undefined) generationConfig.topK = topK;
    if (maxOutputTokens !== undefined) generationConfig.maxOutputTokens = maxOutputTokens;
    const model = genAI.getGenerativeModel({
      model: 'models/gemini-flash-latest',
      generationConfig
    });

    // Track prompt size
    if (perfLogger) {
      perfLogger.setMetadata(`prompt-size-${contentType.toLowerCase()}`, prompt.length);
    }

    const result = await withTimeout(
      model.generateContent(prompt),
      GENERATION_TIMEOUT_MS,
      `${contentType} generation`
    );
    const response = result.response;

    // Track token usage if available
    if (perfLogger && response.usageMetadata) {
      perfLogger.trackTokenUsage(contentType.toLowerCase(), response.usageMetadata);
    }

    const text = response.text();

    // Track response size
    if (perfLogger) {
      perfLogger.setMetadata(`response-size-${contentType.toLowerCase()}`, text.length);
    }

    // Parse timing
    const parseStart = Date.now();
    try {
      const data = JSON.parse(text);
      if (perfLogger) {
        perfLogger.setMetadata(`parse-time-${contentType.toLowerCase()}`, Date.now() - parseStart);
      }
      if (timer) timer.stop();
      return data;
    } catch (parseError) {
      const positionMatch = parseError.message.match(/position (\d+)/);
      const errorPosition = positionMatch ? parseInt(positionMatch[1]) : 0;
      if (errorPosition > 0) {
        const contextStart = Math.max(0, errorPosition - 200);
        const contextEnd = Math.min(text.length, errorPosition + 200);
      }
      try {
        const repairedJsonText = jsonrepair(text);
        const repairedData = JSON.parse(repairedJsonText);
        if (perfLogger) {
          perfLogger.setMetadata(`parse-time-${contentType.toLowerCase()}`, Date.now() - parseStart);
          perfLogger.setMetadata(`json-repair-${contentType.toLowerCase()}`, true);
        }
        if (timer) timer.stop();
        return repairedData;
      } catch (repairError) {
        if (timer) timer.stop();
        throw parseError; // Throw the original parse error
      }
    }
  } catch (error) {
    if (timer) timer.stop();
    if (perfLogger) {
      perfLogger.setMetadata(`error-${contentType.toLowerCase()}`, error.message);
    }
    throw new Error(`Failed to generate ${contentType}: ${error.message}`);
  }
}
async function generateRoadmap(userPrompt, researchFiles, perfLogger = null) {
  try {
    const prompt = generateRoadmapPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, roadmapSchema, 'Roadmap', ROADMAP_CONFIG, perfLogger);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
async function generateSlides(userPrompt, researchFiles, perfLogger = null) {
  try {
    const prompt = generateSlidesPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, slidesSchema, 'Slides', SLIDES_CONFIG, perfLogger);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
async function generateDocument(userPrompt, researchFiles, perfLogger = null) {
  try {
    const prompt = generateDocumentPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, documentSchema, 'Document', DOCUMENT_CONFIG, perfLogger);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
async function generateResearchAnalysis(userPrompt, researchFiles, perfLogger = null) {
  try {
    const prompt = generateResearchAnalysisPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, researchAnalysisSchema, 'ResearchAnalysis', RESEARCH_ANALYSIS_CONFIG, perfLogger);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate all content types with controlled concurrency via API queue
 * This prevents overwhelming the Gemini API with too many simultaneous requests
 *
 * @param {string} userPrompt - User's prompt
 * @param {Array} researchFiles - Array of research file objects
 * @param {object} options - Options including sessionId for logging
 * @returns {object} Results with performance metrics
 */
export async function generateAllContent(userPrompt, researchFiles, options = {}) {
  // Initialize performance logger
  const perfLogger = new PerformanceLogger('generate-all-content', {
    sessionId: options.sessionId,
    enabled: true
  });

  // Track input metadata
  perfLogger.setMetadata('fileCount', researchFiles.length);
  perfLogger.setMetadata('totalInputSize', researchFiles.reduce((sum, f) => sum + (f.content?.length || 0), 0));
  perfLogger.setMetadata('promptLength', userPrompt.length);

  try {
    // Use apiQueue.runAll to control concurrency and prevent rate limiting
    const tasks = [
      { task: () => generateRoadmap(userPrompt, researchFiles, perfLogger), name: 'Roadmap' },
      { task: () => generateSlides(userPrompt, researchFiles, perfLogger), name: 'Slides' },
      { task: () => generateDocument(userPrompt, researchFiles, perfLogger), name: 'Document' },
      { task: () => generateResearchAnalysis(userPrompt, researchFiles, perfLogger), name: 'ResearchAnalysis' }
    ];

    const [roadmap, slides, document, researchAnalysis] = await apiQueue.runAll(tasks);

    // Complete performance logging
    const perfReport = perfLogger.complete();

    // Store in global metrics for aggregation
    globalMetrics.addRequest(perfReport);

    // Log performance report
    perfLogger.logReport();

    return {
      roadmap,
      slides,
      document,
      researchAnalysis,
      _performanceMetrics: perfReport
    };
  } catch (error) {
    perfLogger.setMetadata('fatalError', error.message);
    perfLogger.complete();
    perfLogger.logReport();
    throw error;
  }
}
export async function regenerateContent(viewType, prompt, researchFiles, options = {}) {
  const perfLogger = new PerformanceLogger(`regenerate-${viewType}`, {
    sessionId: options.sessionId,
    enabled: true
  });

  try {
    const taskName = `Regenerate-${viewType}`;
    const task = async () => {
      switch (viewType) {
        case 'roadmap':
          return generateRoadmap(prompt, researchFiles, perfLogger);
        case 'slides':
          return generateSlides(prompt, researchFiles, perfLogger);
        case 'document':
          return generateDocument(prompt, researchFiles, perfLogger);
        case 'research-analysis':
          return generateResearchAnalysis(prompt, researchFiles, perfLogger);
        default:
          throw new Error(`Invalid view type: ${viewType}`);
      }
    };
    const result = await apiQueue.add(task, taskName);

    // Complete performance logging
    const perfReport = perfLogger.complete();
    globalMetrics.addRequest(perfReport);
    perfLogger.logReport();

    return { ...result, _performanceMetrics: perfReport };
  } catch (error) {
    perfLogger.setMetadata('error', error.message);
    perfLogger.complete();
    perfLogger.logReport();
    throw error;
  }
}

// Export metrics for monitoring endpoints
export { globalMetrics, apiQueue };
