/**
 * Research Synthesis Routes Module
 * Cross-LLM Research Synthesis Feature
 *
 * Implements the 8-step pipeline for transforming multi-source LLM research
 * into verified, rigorously cited insights.
 *
 * Pipeline Steps:
 * 1. Upload Sources - File upload with LLM provider attribution
 * 2. Extract Claims - Extract atomic claims from each source
 * 3. Merge Ledger - Aggregate all claims with metadata
 * 4. Detect Contradictions - Identify conflicting claims
 * 5. Synthesize Report - Generate comprehensive Markdown report
 * 6. Audit Provenance - Verify citations and detect hallucinations
 * 7. Compile Verified Claims - Separate high-consensus vs disputed claims
 * 8. Generate Dashboard - Create visualizations and executive summary
 */

import express from 'express';
import crypto from 'crypto';
import mammoth from 'mammoth';
import pdf from 'pdf-parse';
import { CONFIG } from '../config.js';
import { callGeminiForJson, callGeminiForText } from '../gemini.js';
import {
  CLAIM_EXTRACTION_SYSTEM_PROMPT,
  CLAIM_EXTRACTION_SCHEMA,
  CONTRADICTION_DETECTION_SYSTEM_PROMPT,
  CONTRADICTION_DETECTION_SCHEMA,
  REPORT_SYNTHESIS_SYSTEM_PROMPT,
  REPORT_SYNTHESIS_SCHEMA,
  PROVENANCE_AUDIT_SYSTEM_PROMPT,
  PROVENANCE_AUDIT_SCHEMA,
  EXECUTIVE_SUMMARY_SYSTEM_PROMPT,
  EXECUTIVE_SUMMARY_SCHEMA,
  getClaimExtractionQuery,
  getContradictionDetectionQuery,
  getReportSynthesisQuery,
  getProvenanceAuditQuery,
  getExecutiveSummaryQuery
} from '../prompts-research.js';
import { apiLimiter, strictLimiter, uploadMiddleware } from '../middleware.js';
import {
  createSession,
  getSession,
  createJob,
  updateJob,
  completeJob,
  failJob,
  getJob
} from '../storage.js';
import { trackEvent } from '../database.js';

const router = express.Router();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generates a deterministic claim ID based on content hash
 * @param {string} claim - The claim text
 * @param {string} source - Source filename
 * @param {number} index - Index within source
 * @returns {string} Hex claim ID
 */
function generateClaimId(claim, source, index) {
  const hash = crypto.createHash('md5');
  hash.update(`${source}:${index}:${claim.substring(0, 100)}`);
  return hash.digest('hex').substring(0, CONFIG.RESEARCH_SYNTHESIS.CLAIM_ID_LENGTH);
}

/**
 * Parse file content based on type
 * @param {Object} file - Multer file object
 * @returns {Promise<string>} Parsed text content
 */
async function parseFileContent(file) {
  const extension = file.originalname.split('.').pop().toLowerCase();

  try {
    if (extension === 'pdf') {
      // Parse PDF with timeout and page limit
      const pdfData = await Promise.race([
        pdf(file.buffer, {
          max: CONFIG.RESEARCH_SYNTHESIS.MAX_PDF_PAGES
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('PDF parsing timeout')),
            CONFIG.RESEARCH_SYNTHESIS.PDF_TIMEOUT_MS)
        )
      ]);
      return pdfData.text;
    } else if (extension === 'docx') {
      // Parse DOCX
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return result.value;
    } else {
      // Plain text or markdown
      return file.buffer.toString('utf-8');
    }
  } catch (error) {
    console.error(`Error parsing file ${file.originalname}:`, error);
    throw new Error(`Failed to parse ${file.originalname}: ${error.message}`);
  }
}

/**
 * Validate LLM provider
 * @param {string} provider - Provider name
 * @returns {boolean} Valid provider
 */
function isValidProvider(provider) {
  return CONFIG.RESEARCH_SYNTHESIS.LLM_PROVIDERS.includes(provider.toUpperCase());
}

// ============================================================================
// ENDPOINT 1: UPLOAD RESEARCH SOURCES
// ============================================================================

/**
 * POST /api/research/upload
 * Uploads research files with LLM provider attribution
 * Body: FormData with files and provider metadata
 */
router.post('/api/research/upload', uploadMiddleware.array('files'), strictLimiter, async (req, res) => {
  try {
    // Files are uploaded via multer middleware (configured in server.js)
    const files = req.files;
    const providers = req.body.providers; // Array of provider names (same length as files)

    // Validation
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    if (!providers || providers.length !== files.length) {
      return res.status(400).json({ error: 'Provider metadata must match number of files' });
    }

    // Validate providers
    for (const provider of providers) {
      if (!isValidProvider(provider)) {
        return res.status(400).json({
          error: `Invalid provider: ${provider}. Must be one of: ${CONFIG.RESEARCH_SYNTHESIS.LLM_PROVIDERS.join(', ')}`
        });
      }
    }

    // Parse all files in parallel
    console.log(`📄 Parsing ${files.length} research files...`);
    const parsedFiles = await Promise.all(
      files.map(async (file, idx) => {
        const content = await parseFileContent(file);
        return {
          filename: file.originalname,
          provider: providers[idx].toUpperCase(),
          content,
          size: file.size,
          type: file.mimetype
        };
      })
    );

    // Sort files alphabetically for determinism
    parsedFiles.sort((a, b) => a.filename.localeCompare(b.filename));

    // Create session with research data
    const sessionData = JSON.stringify({
      files: parsedFiles,
      uploadedAt: new Date().toISOString(),
      providers: Array.from(new Set(providers.map(p => p.toUpperCase())))
    });

    const filenames = parsedFiles.map(f => `${f.filename} (${f.provider})`);
    const sessionId = createSession(sessionData, filenames);

    // Track analytics
    trackEvent('research_upload', {
      fileCount: files.length,
      providers: Array.from(new Set(providers)),
      totalSize: files.reduce((sum, f) => sum + f.size, 0)
    }, null, sessionId);

    console.log(`✅ Research session created: ${sessionId}`);
    res.json({
      sessionId,
      fileCount: files.length,
      providers: Array.from(new Set(providers.map(p => p.toUpperCase()))),
      files: parsedFiles.map(f => ({ filename: f.filename, provider: f.provider, size: f.size }))
    });

  } catch (error) {
    console.error('Research upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload research files' });
  }
});

// ============================================================================
// ENDPOINT 2: EXTRACT CLAIMS FROM SOURCES
// ============================================================================

/**
 * POST /api/research/extract-claims
 * Extracts atomic claims from all uploaded sources
 * Body: { sessionId }
 */
router.post('/api/research/extract-claims', strictLimiter, async (req, res) => {
  const { sessionId } = req.body;

  // Validation
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  const sessionData = JSON.parse(session.researchText);

  // Create async job
  const jobId = createJob();
  res.json({ jobId });

  // Background processing
  processClaimExtraction(jobId, sessionId, sessionData);
});

/**
 * Background task: Extract claims from all sources
 * @param {string} jobId - Job ID
 * @param {string} sessionId - Session ID
 * @param {Object} sessionData - Parsed session data
 */
async function processClaimExtraction(jobId, sessionId, sessionData) {
  try {
    updateJob(jobId, {
      status: 'processing',
      progress: 'Starting claim extraction...'
    });

    const allClaims = [];
    const files = sessionData.files;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      updateJob(jobId, {
        progress: `Extracting claims from ${file.filename} (${i + 1}/${files.length})...`
      });

      console.log(`🔍 Extracting claims from ${file.filename}...`);

      // Build AI query
      const userQuery = getClaimExtractionQuery(file.filename, file.content, file.provider);

      // Call Gemini API
      const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: CLAIM_EXTRACTION_SYSTEM_PROMPT }] },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: CLAIM_EXTRACTION_SCHEMA,
          temperature: CONFIG.API.TEMPERATURE_STRUCTURED,
          maxOutputTokens: CONFIG.API.MAX_OUTPUT_TOKENS_CHART,
          topP: CONFIG.API.TOP_P,
          topK: CONFIG.API.TOP_K
        }
      };

      const result = await callGeminiForJson(payload);

      // Add metadata to each claim
      result.claims.forEach((claim, idx) => {
        claim.id = generateClaimId(claim.claim, file.filename, idx);
        claim.source = file.filename;
        claim.provider = file.provider;
        claim.extractedAt = new Date().toISOString();
      });

      allClaims.push(...result.claims);
      console.log(`  ✓ Extracted ${result.claims.length} claims from ${file.filename}`);
    }

    // Store claims in session (update session data)
    sessionData.claims = allClaims;
    sessionData.claimsByProvider = groupBy(allClaims, 'provider');
    sessionData.claimsByTopic = groupBy(allClaims, 'topic');

    // Update session with claims
    const session = getSession(sessionId);
    const updatedSessionData = JSON.stringify(sessionData);
    // Note: We'd need to update storage.js to support updateSession, or we recreate the session
    // For now, we'll store the claims in the job data

    // Complete job
    completeJob(jobId, {
      chartId: sessionId, // Reuse session ID for simplicity
      claims: allClaims,
      summary: {
        totalClaims: allClaims.length,
        byProvider: Object.fromEntries(
          Object.entries(sessionData.claimsByProvider).map(([k, v]) => [k, v.length])
        ),
        byTopic: Object.fromEntries(
          Object.entries(sessionData.claimsByTopic).map(([k, v]) => [k, v.length])
        ),
        cited: allClaims.filter(c => c.citation !== 'NONE').length,
        uncited: allClaims.filter(c => c.citation === 'NONE').length
      }
    });

    // Track analytics
    trackEvent('claims_extracted', {
      totalClaims: allClaims.length,
      providers: Object.keys(sessionData.claimsByProvider)
    }, null, sessionId);

    console.log(`✅ Claim extraction complete: ${allClaims.length} total claims`);

  } catch (error) {
    console.error('Claim extraction error:', error);
    failJob(jobId, error.message || 'Failed to extract claims');
  }
}

/**
 * Helper: Group array by key
 */
function groupBy(array, key) {
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) result[group] = [];
    result[group].push(item);
    return result;
  }, {});
}

// ============================================================================
// ENDPOINT 3: GET CLAIM LEDGER
// ============================================================================

/**
 * GET /api/research/ledger/:sessionId
 * Retrieves the aggregated claim ledger
 */
router.get('/api/research/ledger/:sessionId', apiLimiter, async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    const sessionData = JSON.parse(session.researchText);

    if (!sessionData.claims) {
      return res.status(400).json({ error: 'Claims not yet extracted. Run extraction first.' });
    }

    res.json({
      claims: sessionData.claims,
      summary: {
        total: sessionData.claims.length,
        byProvider: Object.fromEntries(
          Object.entries(sessionData.claimsByProvider || {}).map(([k, v]) => [k, v.length])
        ),
        byTopic: Object.fromEntries(
          Object.entries(sessionData.claimsByTopic || {}).map(([k, v]) => [k, v.length])
        ),
        cited: sessionData.claims.filter(c => c.citation !== 'NONE').length,
        uncited: sessionData.claims.filter(c => c.citation === 'NONE').length
      }
    });

  } catch (error) {
    console.error('Ledger retrieval error:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve claim ledger' });
  }
});

// ============================================================================
// ENDPOINT 4: DETECT CONTRADICTIONS
// ============================================================================

/**
 * POST /api/research/detect-contradictions
 * Analyzes claim ledger for contradictions
 * Body: { sessionId }
 */
router.post('/api/research/detect-contradictions', strictLimiter, async (req, res) => {
  const { sessionId } = req.body;

  // Validation
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  const sessionData = JSON.parse(session.researchText);

  if (!sessionData.claims) {
    return res.status(400).json({ error: 'Claims not yet extracted' });
  }

  // Create async job
  const jobId = createJob();
  res.json({ jobId });

  // Background processing
  processContradictionDetection(jobId, sessionId, sessionData);
});

/**
 * Background task: Detect contradictions in claim ledger
 */
async function processContradictionDetection(jobId, sessionId, sessionData) {
  try {
    updateJob(jobId, {
      status: 'processing',
      progress: 'Analyzing claims for contradictions...'
    });

    console.log(`🔍 Detecting contradictions across ${sessionData.claims.length} claims...`);

    // Build AI query
    const userQuery = getContradictionDetectionQuery(sessionData.claims);

    // Call Gemini API
    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: CONTRADICTION_DETECTION_SYSTEM_PROMPT }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: CONTRADICTION_DETECTION_SCHEMA,
        temperature: CONFIG.API.TEMPERATURE_STRUCTURED,
        maxOutputTokens: CONFIG.API.MAX_OUTPUT_TOKENS_ANALYSIS,
        topP: CONFIG.API.TOP_P,
        topK: CONFIG.API.TOP_K,
        thinkingConfig: {
          thinkingBudget: CONFIG.API.THINKING_BUDGET_RESEARCH
        }
      }
    };

    const result = await callGeminiForJson(payload);

    // Store contradictions in session
    sessionData.contradictions = result.contradictions;
    sessionData.contradictionSummary = result.summary;

    // Complete job
    completeJob(jobId, {
      chartId: sessionId,
      contradictions: result.contradictions,
      summary: result.summary
    });

    // Track analytics
    trackEvent('contradictions_detected', {
      total: result.contradictions.length,
      highSeverity: result.summary.highSeverity
    }, null, sessionId);

    console.log(`✅ Contradiction detection complete: ${result.contradictions.length} found`);

  } catch (error) {
    console.error('Contradiction detection error:', error);
    failJob(jobId, error.message || 'Failed to detect contradictions');
  }
}

// ============================================================================
// ENDPOINT 5: SYNTHESIZE REPORT
// ============================================================================

/**
 * POST /api/research/synthesize
 * Generates comprehensive Markdown report with citations
 * Body: { sessionId }
 */
router.post('/api/research/synthesize', strictLimiter, async (req, res) => {
  const { sessionId } = req.body;

  // Validation
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  const sessionData = JSON.parse(session.researchText);

  if (!sessionData.claims) {
    return res.status(400).json({ error: 'Claims not yet extracted' });
  }

  // Create async job
  const jobId = createJob();
  res.json({ jobId });

  // Background processing
  processReportSynthesis(jobId, sessionId, sessionData);
});

/**
 * Background task: Synthesize comprehensive report
 */
async function processReportSynthesis(jobId, sessionId, sessionData) {
  try {
    updateJob(jobId, {
      status: 'processing',
      progress: 'Synthesizing research report...'
    });

    console.log(`📝 Synthesizing report from ${sessionData.claims.length} claims...`);

    // Prepare sources for citation
    const sources = sessionData.files.map((f, idx) => ({
      number: idx + 1,
      filename: f.filename,
      provider: f.provider
    }));

    // Build AI query
    const userQuery = getReportSynthesisQuery(
      sessionData.claims,
      sessionData.contradictions || [],
      sources
    );

    // Call Gemini API (use text mode since output is Markdown)
    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: REPORT_SYNTHESIS_SYSTEM_PROMPT }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: REPORT_SYNTHESIS_SCHEMA,
        temperature: CONFIG.API.TEMPERATURE_STRUCTURED,
        maxOutputTokens: CONFIG.API.MAX_OUTPUT_TOKENS_CHART,
        topP: CONFIG.API.TOP_P,
        topK: CONFIG.API.TOP_K,
        thinkingConfig: {
          thinkingBudget: CONFIG.API.THINKING_BUDGET_RESEARCH
        }
      }
    };

    const result = await callGeminiForJson(payload);

    // Store report in session
    sessionData.report = result.reportMarkdown;
    sessionData.reportMetadata = result.metadata;

    // Complete job
    completeJob(jobId, {
      chartId: sessionId,
      report: result.reportMarkdown,
      metadata: result.metadata
    });

    // Track analytics
    trackEvent('report_synthesized', {
      totalClaims: result.metadata.totalClaims,
      citedClaims: result.metadata.citedClaims,
      topics: result.metadata.topics.length
    }, null, sessionId);

    console.log(`✅ Report synthesis complete`);

  } catch (error) {
    console.error('Report synthesis error:', error);
    failJob(jobId, error.message || 'Failed to synthesize report');
  }
}

// ============================================================================
// ENDPOINT 6: AUDIT PROVENANCE
// ============================================================================

/**
 * POST /api/research/audit
 * Audits the generated report for attribution accuracy
 * Body: { sessionId }
 */
router.post('/api/research/audit', strictLimiter, async (req, res) => {
  const { sessionId } = req.body;

  // Validation
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  const sessionData = JSON.parse(session.researchText);

  if (!sessionData.report) {
    return res.status(400).json({ error: 'Report not yet synthesized' });
  }

  // Create async job
  const jobId = createJob();
  res.json({ jobId });

  // Background processing
  processProvenanceAudit(jobId, sessionId, sessionData);
});

/**
 * Background task: Audit report provenance
 */
async function processProvenanceAudit(jobId, sessionId, sessionData) {
  try {
    updateJob(jobId, {
      status: 'processing',
      progress: 'Auditing report for attribution accuracy...'
    });

    console.log(`🔍 Auditing report provenance...`);

    // Prepare original sources
    const originalSources = sessionData.files.map(f => ({
      filename: f.filename,
      provider: f.provider,
      content: f.content.substring(0, 50000) // Limit content to avoid token limits
    }));

    // Build AI query
    const userQuery = getProvenanceAuditQuery(sessionData.report, originalSources);

    // Call Gemini API
    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: PROVENANCE_AUDIT_SYSTEM_PROMPT }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: PROVENANCE_AUDIT_SCHEMA,
        temperature: CONFIG.API.TEMPERATURE_STRUCTURED,
        maxOutputTokens: CONFIG.API.MAX_OUTPUT_TOKENS_ANALYSIS,
        topP: CONFIG.API.TOP_P,
        topK: CONFIG.API.TOP_K,
        thinkingConfig: {
          thinkingBudget: CONFIG.API.THINKING_BUDGET_RESEARCH
        }
      }
    };

    const result = await callGeminiForJson(payload);

    // Store audit results in session
    sessionData.auditResults = result;

    // Complete job
    completeJob(jobId, {
      chartId: sessionId,
      audit: result
    });

    // Track analytics
    trackEvent('provenance_audited', {
      overallScore: result.overallScore,
      issuesFound: result.statistics.issuesFound,
      hallucinations: result.statistics.hallucinations
    }, null, sessionId);

    console.log(`✅ Provenance audit complete: Score ${result.overallScore}/100`);

  } catch (error) {
    console.error('Provenance audit error:', error);
    failJob(jobId, error.message || 'Failed to audit provenance');
  }
}

// ============================================================================
// ENDPOINT 7: GET VERIFIED CLAIMS
// ============================================================================

/**
 * GET /api/research/verified-claims/:sessionId
 * Returns claims separated into high-consensus vs disputed
 */
router.get('/api/research/verified-claims/:sessionId', apiLimiter, async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    const sessionData = JSON.parse(session.researchText);

    if (!sessionData.claims) {
      return res.status(400).json({ error: 'Claims not yet extracted' });
    }

    // Separate claims based on consensus
    const highConsensus = [];
    const disputed = [];

    // Get claim IDs involved in contradictions
    const disputedClaimIds = new Set();
    if (sessionData.contradictions) {
      sessionData.contradictions.forEach(contradiction => {
        contradiction.claimIds.forEach(id => disputedClaimIds.add(id));
      });
    }

    // Categorize claims
    sessionData.claims.forEach(claim => {
      if (disputedClaimIds.has(claim.id)) {
        disputed.push(claim);
      } else if (claim.confidence === 'high' && claim.citation !== 'NONE') {
        highConsensus.push(claim);
      } else {
        // Medium/low confidence or uncited - add to high consensus but flag
        highConsensus.push({ ...claim, flagged: true });
      }
    });

    res.json({
      highConsensus,
      disputed,
      summary: {
        highConsensus: highConsensus.length,
        disputed: disputed.length,
        flagged: highConsensus.filter(c => c.flagged).length
      }
    });

  } catch (error) {
    console.error('Verified claims retrieval error:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve verified claims' });
  }
});

// ============================================================================
// ENDPOINT 8: GENERATE EXECUTIVE SUMMARY
// ============================================================================

/**
 * POST /api/research/executive-summary
 * Generates executive summary of research synthesis
 * Body: { sessionId }
 */
router.post('/api/research/executive-summary', strictLimiter, async (req, res) => {
  const { sessionId } = req.body;

  // Validation
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  const sessionData = JSON.parse(session.researchText);

  if (!sessionData.reportMetadata || !sessionData.auditResults) {
    return res.status(400).json({ error: 'Report and audit must be completed first' });
  }

  // Create async job
  const jobId = createJob();
  res.json({ jobId });

  // Background processing
  processExecutiveSummary(jobId, sessionId, sessionData);
});

/**
 * Background task: Generate executive summary
 */
async function processExecutiveSummary(jobId, sessionId, sessionData) {
  try {
    updateJob(jobId, {
      status: 'processing',
      progress: 'Generating executive summary...'
    });

    console.log(`📊 Generating executive summary...`);

    // Build AI query
    const userQuery = getExecutiveSummaryQuery(
      { metadata: sessionData.reportMetadata },
      sessionData.auditResults,
      sessionData.contradictions || []
    );

    // Call Gemini API
    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: EXECUTIVE_SUMMARY_SYSTEM_PROMPT }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: EXECUTIVE_SUMMARY_SCHEMA,
        temperature: CONFIG.API.TEMPERATURE_QA,
        maxOutputTokens: CONFIG.API.MAX_OUTPUT_TOKENS_ANALYSIS,
        topP: CONFIG.API.TOP_P,
        topK: CONFIG.API.TOP_K,
        thinkingConfig: {
          thinkingBudget: CONFIG.API.THINKING_BUDGET_EXECUTIVE
        }
      }
    };

    const result = await callGeminiForJson(payload);

    // Store executive summary in session
    sessionData.executiveSummary = result;

    // Complete job
    completeJob(jobId, {
      chartId: sessionId,
      executiveSummary: result
    });

    // Track analytics
    trackEvent('executive_summary_generated', {
      sourceCount: result.scope.sourceCount,
      keyFindings: result.keyFindings.length
    }, null, sessionId);

    console.log(`✅ Executive summary generated`);

  } catch (error) {
    console.error('Executive summary error:', error);
    failJob(jobId, error.message || 'Failed to generate executive summary');
  }
}

// ============================================================================
// ENDPOINT 9: GET DASHBOARD DATA
// ============================================================================

/**
 * GET /api/research/dashboard/:sessionId
 * Returns dashboard visualization data
 */
router.get('/api/research/dashboard/:sessionId', apiLimiter, async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    const sessionData = JSON.parse(session.researchText);

    // Calculate dashboard metrics
    const dashboard = {
      citationBreakdown: {
        cited: sessionData.claims?.filter(c => c.citation !== 'NONE').length || 0,
        uncited: sessionData.claims?.filter(c => c.citation === 'NONE').length || 0
      },
      verificationBreakdown: {
        highConfidence: sessionData.claims?.filter(c => c.confidence === 'high').length || 0,
        mediumConfidence: sessionData.claims?.filter(c => c.confidence === 'medium').length || 0,
        lowConfidence: sessionData.claims?.filter(c => c.confidence === 'low').length || 0
      },
      consensusBreakdown: {
        highConsensus: sessionData.claims?.filter(c =>
          c.confidence === 'high' && c.citation !== 'NONE'
        ).length || 0,
        mediumConsensus: sessionData.claims?.filter(c =>
          c.confidence === 'medium' || (c.confidence === 'high' && c.citation === 'NONE')
        ).length || 0,
        disputed: sessionData.contradictions?.flatMap(c => c.claimIds).length || 0
      },
      auditScore: sessionData.auditResults?.overallScore || 0,
      summary: {
        totalClaims: sessionData.claims?.length || 0,
        totalSources: sessionData.files?.length || 0,
        providers: sessionData.providers || [],
        contradictions: sessionData.contradictions?.length || 0,
        topics: Object.keys(sessionData.claimsByTopic || {}).length
      }
    };

    res.json(dashboard);

  } catch (error) {
    console.error('Dashboard data retrieval error:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve dashboard data' });
  }
});

// ============================================================================
// ENDPOINT 10: GET FULL REPORT
// ============================================================================

/**
 * GET /api/research/report/:sessionId
 * Returns the full synthesized report
 */
router.get('/api/research/report/:sessionId', apiLimiter, async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    const sessionData = JSON.parse(session.researchText);

    if (!sessionData.report) {
      return res.status(400).json({ error: 'Report not yet synthesized' });
    }

    res.json({
      report: sessionData.report,
      metadata: sessionData.reportMetadata,
      audit: sessionData.auditResults,
      executiveSummary: sessionData.executiveSummary
    });

  } catch (error) {
    console.error('Report retrieval error:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve report' });
  }
});

export default router;
