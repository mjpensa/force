import { GoogleGenerativeAI } from '@google/generative-ai';
import { jsonrepair } from 'jsonrepair';
import { generateRoadmapPrompt, roadmapSchema } from './prompts/roadmap.js';
import { generateSlidesPrompt, slidesSchema } from './prompts/slides.js';
import { generateDocumentPrompt, documentSchema } from './prompts/document.js';
import { generateResearchAnalysisPrompt, researchAnalysisSchema, validateResearchAnalysisStructure } from './prompts/research-analysis.js';
const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const GENERATION_TIMEOUT_MS = 300000; // 5 minutes - slides with complex schemas need more time
class APIQueue {
  constructor(maxConcurrent = 2) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }
  async add(task, name = 'unknown') {
    if (this.running >= this.maxConcurrent) {
      await new Promise(resolve => this.queue.push(resolve));
    }
    this.running++;
    try {
      const result = await task();
      return result;
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
  async runAll(tasks) {
    return Promise.all(tasks.map(({ task, name }) => this.add(task, name)));
  }
}
const apiQueue = new APIQueue(2);
const DOCUMENT_CONFIG = {
  temperature: 0.1,
  topP: 0.3,
  topK: 5,
  thinkingBudget: 0   // Zero: fast generation
};
const STRUCTURED_DEFAULT_CONFIG = {
  thinkingBudget: 24576  // Standard deep reasoning
};
const ROADMAP_CONFIG = {
  temperature: 0.1,      // Lowest: maximum determinism for rule-based output
  topP: 0.3,             // Very constrained: follow explicit rules exactly
  topK: 5,               // Minimal exploration: pick most likely tokens
  thinkingBudget: 24576  // Maximum: complex date mapping and swimlane logic
};
const RESEARCH_ANALYSIS_CONFIG = {
  temperature: 0.2,      // Low: reliable analysis without hallucination
  topP: 0.5,             // Moderate: allows varied recommendations
  topK: 10,              // Some exploration for insightful suggestions
  thinkingBudget: 24576  // Maximum: deep analysis of research quality
};
const SLIDES_CONFIG = {
  temperature: 0.1,
  topP: 0.3,
  topK: 5,
  thinkingBudget: 0   // Zero: no thinking needed for simple JSON
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
async function generateWithGemini(prompt, schema, contentType, configOverrides = {}) {
  try {
    const {
      temperature,
      topP,
      topK,
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
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-preview-09-2025',
      generationConfig
    });
    const result = await withTimeout(
      model.generateContent(prompt),
      GENERATION_TIMEOUT_MS,
      `${contentType} generation`
    );
    const response = result.response;
    const text = response.text();
    try {
      const data = JSON.parse(text);
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
        return repairedData;
      } catch (repairError) {
        throw parseError; // Throw the original parse error
      }
    }
  } catch (error) {
    throw new Error(`Failed to generate ${contentType}: ${error.message}`);
  }
}
async function generateRoadmap(userPrompt, researchFiles) {
  try {
    const prompt = generateRoadmapPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, roadmapSchema, 'Roadmap', ROADMAP_CONFIG);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
async function generateSlides(userPrompt, researchFiles) {
  try {
    const prompt = generateSlidesPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, slidesSchema, 'Slides', SLIDES_CONFIG);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
async function generateDocument(userPrompt, researchFiles) {
  try {
    const prompt = generateDocumentPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, documentSchema, 'Document', DOCUMENT_CONFIG);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
async function generateResearchAnalysis(userPrompt, researchFiles) {
  try {
    const prompt = generateResearchAnalysisPrompt(userPrompt, researchFiles);
    let data = await generateWithGemini(prompt, researchAnalysisSchema, 'ResearchAnalysis', RESEARCH_ANALYSIS_CONFIG);
    if (!validateResearchAnalysisStructure(data)) {
      data = await generateWithGemini(prompt, researchAnalysisSchema, 'ResearchAnalysis', RESEARCH_ANALYSIS_CONFIG);
      if (!validateResearchAnalysisStructure(data)) {
        throw new Error('Research analysis generation produced empty or invalid content after retry. The AI may need more detailed source material.');
      }
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
export async function generateAllContent(userPrompt, researchFiles) {
  const results = {
    roadmap: null,
    document: null,
    slides: null,
    researchAnalysis: null
  };
  try {
    results.roadmap = await generateRoadmap(userPrompt, researchFiles);
    results.slides = await generateSlides(userPrompt, researchFiles);
    results.document = await generateDocument(userPrompt, researchFiles);
    results.researchAnalysis = await generateResearchAnalysis(userPrompt, researchFiles);
    return results;
  } catch (error) {
    throw error;
  }
}
export async function regenerateContent(viewType, prompt, researchFiles) {
  try {
    const taskName = `Regenerate-${viewType}`;
    const task = async () => {
      switch (viewType) {
        case 'roadmap':
          return generateRoadmap(prompt, researchFiles);
        case 'slides':
          return generateSlides(prompt, researchFiles);
        case 'document':
          return generateDocument(prompt, researchFiles);
        case 'research-analysis':
          return generateResearchAnalysis(prompt, researchFiles);
        default:
          throw new Error(`Invalid view type: ${viewType}`);
      }
    };
    return await apiQueue.add(task, taskName);
  } catch (error) {
    throw error;
  }
}
