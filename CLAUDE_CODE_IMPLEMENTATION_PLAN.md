# Claude Code Implementation Plan
## Cross-Validated Semantic Gantt Architecture Enhancement

**Target**: Enhance existing LLM app with dual-validation semantic gantt system  
**Execution Method**: Claude Code autonomous implementation  
**Estimated Timeline**: 4 weeks (20 working days)

---

## 📋 PRE-IMPLEMENTATION CHECKLIST

### Step 0: Environment Setup & Discovery
**Duration**: 1-2 hours

#### 0.1 Repository Analysis
```bash
# Tasks for Claude Code:
1. Scan project structure and identify:
   - Main server entry point
   - Existing services directory
   - Current validation logic
   - API routes
   - Database/storage layer
   - Testing framework
   
2. Document findings in: `/docs/project-structure-analysis.md`
```

#### 0.2 Dependency Audit
```bash
# Check and install required packages
npm list --depth=0  # Current dependencies
npm install zod      # Schema validation
npm install uuid     # ID generation
npm install winston  # Logging (if not present)
npm install jest     # Testing (if not present)
```

#### 0.3 Create Branch Structure
```bash
git checkout -b feature/semantic-gantt-validation
git checkout -b feature/semantic-gantt-validation-dev
```

#### 0.4 Setup Documentation
Create `/docs/implementation-log.md` to track:
- Daily progress
- Decisions made
- Issues encountered
- Test results

---

## 🏗️ PHASE 1: FOUNDATION LAYER (Days 1-5)

### Day 1: Core Data Models & Schema

#### 1.1 Create Zod Schemas
**File**: `server/schemas/BimodalGanttSchema.js`

```javascript
import { z } from 'zod';

// Task Origin Types
const OriginSchema = z.enum(['explicit', 'inference']);

// Confidence Score
const ConfidenceSchema = z.object({
  score: z.number().min(0).max(1),
  factors: z.array(z.string()).optional(),
  calibrationMethod: z.string().optional()
});

// Source Citation
const SourceCitationSchema = z.object({
  documentName: z.string(),
  provider: z.enum(['GEMINI', 'CLAUDE', 'OPENAI', 'INTERNAL']),
  startChar: z.number().int().positive(),
  endChar: z.number().int().positive(),
  exactQuote: z.string(),
  retrievedAt: z.string().datetime()
});

// Inference Rationale
const InferenceRationaleSchema = z.object({
  reasoning: z.string(),
  supportingFacts: z.array(z.string()),
  llmProvider: z.string(),
  temperature: z.number().min(0).max(2).optional()
});

// Duration
const DurationSchema = z.object({
  value: z.number().positive(),
  unit: z.enum(['hours', 'days', 'weeks', 'months']),
  confidence: z.number().min(0).max(1),
  origin: OriginSchema,
  sourceCitations: z.array(SourceCitationSchema).optional(),
  inferenceRationale: InferenceRationaleSchema.optional()
});

// Regulatory Requirement
const RegulatoryRequirementSchema = z.object({
  isRequired: z.boolean(),
  regulation: z.string().optional(),
  confidence: z.number().min(0).max(1),
  origin: OriginSchema,
  sourceCitations: z.array(SourceCitationSchema).optional()
});

// Main BimodalTask Schema
export const BimodalTaskSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  origin: OriginSchema,
  confidence: z.number().min(0).max(1),
  duration: DurationSchema,
  startDate: z.object({
    value: z.string().datetime(),
    confidence: z.number().min(0).max(1),
    origin: OriginSchema,
    sourceCitations: z.array(SourceCitationSchema).optional()
  }).optional(),
  dependencies: z.array(z.string().uuid()).optional(),
  regulatoryRequirement: RegulatoryRequirementSchema.optional(),
  validationMetadata: z.object({
    claims: z.array(z.any()),
    citationCoverage: z.number().min(0).max(1),
    contradictions: z.array(z.any()),
    provenanceScore: z.number().min(0).max(1),
    qualityGatesPassed: z.array(z.string())
  }).optional()
});

// BimodalGanttData
export const BimodalGanttDataSchema = z.object({
  id: z.string().uuid(),
  projectName: z.string(),
  tasks: z.array(BimodalTaskSchema),
  metadata: z.object({
    createdAt: z.string().datetime(),
    validatedAt: z.string().datetime().optional(),
    totalTasks: z.number().int().positive(),
    factRatio: z.number().min(0).max(1),
    avgConfidence: z.number().min(0).max(1)
  })
});

export const BimodalGanttData = {
  parse: (data) => BimodalGanttDataSchema.parse(data),
  safeParse: (data) => BimodalGanttDataSchema.safeParse(data)
};
```

**Testing Task**: Create `server/schemas/__tests__/BimodalGanttSchema.test.js`
- Test valid task creation
- Test invalid data rejection
- Test optional fields
- Test confidence bounds

---

#### 1.2 Create Claim Data Models
**File**: `server/models/ClaimModels.js`

```javascript
import { z } from 'zod';

export const ClaimSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  claim: z.string(),
  claimType: z.enum(['duration', 'dependency', 'resource', 'deadline', 'requirement']),
  source: z.object({
    documentName: z.string(),
    provider: z.string(),
    citation: z.any().optional()
  }),
  confidence: z.number().min(0).max(1),
  contradictions: z.array(z.object({
    contradictingClaimId: z.string().uuid(),
    severity: z.enum(['low', 'medium', 'high']),
    resolution: z.string().optional()
  })),
  validatedAt: z.string().datetime()
});

export const ContradictionSchema = z.object({
  id: z.string().uuid(),
  claim1: z.string().uuid(),
  claim2: z.string().uuid(),
  severity: z.enum(['low', 'medium', 'high']),
  type: z.enum(['temporal', 'logical', 'numerical', 'regulatory']),
  description: z.string(),
  resolutionStrategy: z.string().optional(),
  resolvedAt: z.string().datetime().optional()
});

export class ClaimLedger {
  constructor() {
    this.claims = new Map();
    this.contradictions = new Map();
  }

  addClaim(claim) {
    const validated = ClaimSchema.parse(claim);
    this.claims.set(validated.id, validated);
    return validated;
  }

  getClaim(id) {
    return this.claims.get(id);
  }

  getClaimsByTask(taskId) {
    return Array.from(this.claims.values())
      .filter(claim => claim.taskId === taskId);
  }

  addContradiction(contradiction) {
    const validated = ContradictionSchema.parse(contradiction);
    this.contradictions.set(validated.id, validated);
    return validated;
  }

  export() {
    return {
      claims: Array.from(this.claims.values()),
      contradictions: Array.from(this.contradictions.values())
    };
  }
}
```

**Testing Task**: Create `server/models/__tests__/ClaimModels.test.js`

---

### Day 2: Research Validation Service Foundation

#### 2.1 Create Base Service
**File**: `server/services/ResearchValidationService.js`

```javascript
import { ClaimLedger } from '../models/ClaimModels.js';
import { v4 as uuidv4 } from 'uuid';

export class ResearchValidationService {
  constructor(options = {}) {
    this.claimLedger = new ClaimLedger();
    this.logger = options.logger || console;
    this.config = {
      minConfidenceThreshold: options.minConfidenceThreshold || 0.5,
      citationCoverageThreshold: options.citationCoverageThreshold || 0.75,
      ...options
    };
  }

  /**
   * Main validation entry point
   * @param {Object} task - BimodalTask object
   * @param {Array} sourceDocuments - Array of source documents
   * @returns {Object} Validation result
   */
  async validateTaskClaims(task, sourceDocuments) {
    this.logger.info(`Validating task: ${task.id} - ${task.name}`);

    try {
      // Step 1: Extract atomic claims from task
      const claims = await this.extractTaskClaims(task);
      
      // Step 2: Validate each claim through pipeline
      const validatedClaims = [];
      const allContradictions = [];
      
      for (const claim of claims) {
        // Citation verification
        const citationResult = await this.verifyCitation(claim, sourceDocuments);
        
        // Contradiction check
        const contradictions = await this.checkContradictions(claim);
        
        // Provenance audit
        const provenance = await this.auditProvenance(claim, sourceDocuments);
        
        // Confidence calibration
        const calibratedClaim = await this.calibrateConfidence(
          claim,
          citationResult,
          contradictions,
          provenance
        );
        
        validatedClaims.push(calibratedClaim);
        allContradictions.push(...contradictions);
      }
      
      // Step 3: Aggregate results
      return this.aggregateValidationResults(validatedClaims, allContradictions);
      
    } catch (error) {
      this.logger.error(`Validation failed for task ${task.id}:`, error);
      throw error;
    }
  }

  /**
   * Extract claims from a bimodal task
   */
  async extractTaskClaims(task) {
    const claims = [];

    // Duration claim
    if (task.duration) {
      claims.push({
        id: uuidv4(),
        taskId: task.id,
        claim: `Task "${task.name}" takes ${task.duration.value} ${task.duration.unit}`,
        claimType: 'duration',
        source: this.extractSource(task, 'duration'),
        confidence: task.duration.confidence,
        contradictions: [],
        validatedAt: new Date().toISOString()
      });
    }

    // Start date claim
    if (task.startDate) {
      claims.push({
        id: uuidv4(),
        taskId: task.id,
        claim: `Task "${task.name}" starts on ${task.startDate.value}`,
        claimType: 'deadline',
        source: this.extractSource(task, 'startDate'),
        confidence: task.startDate.confidence,
        contradictions: [],
        validatedAt: new Date().toISOString()
      });
    }

    // Dependency claims
    if (task.dependencies && task.dependencies.length > 0) {
      task.dependencies.forEach(depId => {
        claims.push({
          id: uuidv4(),
          taskId: task.id,
          claim: `Task "${task.name}" depends on task ${depId}`,
          claimType: 'dependency',
          source: this.extractSource(task, 'dependencies'),
          confidence: task.confidence,
          contradictions: [],
          validatedAt: new Date().toISOString()
        });
      });
    }

    // Regulatory requirement claim
    if (task.regulatoryRequirement?.isRequired) {
      claims.push({
        id: uuidv4(),
        taskId: task.id,
        claim: `Task "${task.name}" requires ${task.regulatoryRequirement.regulation} approval`,
        claimType: 'requirement',
        source: this.extractSource(task, 'regulatoryRequirement'),
        confidence: task.regulatoryRequirement.confidence,
        contradictions: [],
        validatedAt: new Date().toISOString()
      });
    }

    return claims;
  }

  extractSource(task, field) {
    const fieldData = task[field];
    
    if (fieldData?.sourceCitations && fieldData.sourceCitations.length > 0) {
      return {
        documentName: fieldData.sourceCitations[0].documentName,
        provider: fieldData.sourceCitations[0].provider || 'INTERNAL',
        citation: fieldData.sourceCitations[0]
      };
    }

    return {
      documentName: 'inferred',
      provider: task.inferenceRationale?.llmProvider || 'UNKNOWN',
      citation: null
    };
  }

  // Placeholder methods - to be implemented in validation pipeline
  async verifyCitation(claim, sourceDocuments) {
    return { valid: true, reason: null };
  }

  async checkContradictions(claim) {
    return [];
  }

  async auditProvenance(claim, sourceDocuments) {
    return { score: 1.0, issues: [] };
  }

  async calibrateConfidence(claim, citationResult, contradictions, provenance) {
    return claim;
  }

  aggregateValidationResults(claims, contradictions) {
    const citedClaims = claims.filter(c => c.source.citation !== null);
    const citationCoverage = claims.length > 0 ? citedClaims.length / claims.length : 0;
    
    const highSeverityContradictions = contradictions.filter(c => c.severity === 'high');
    
    const avgProvenance = claims.reduce((sum, c) => sum + (c.provenanceScore || 1), 0) / claims.length;

    return {
      claims,
      contradictions,
      citationCoverage,
      provenanceScore: avgProvenance,
      qualityGates: {
        citationCoverage: citationCoverage >= this.config.citationCoverageThreshold,
        noHighContradictions: highSeverityContradictions.length === 0,
        confidenceThreshold: claims.every(c => c.confidence >= this.config.minConfidenceThreshold)
      }
    };
  }
}
```

**Testing Task**: Create `server/services/__tests__/ResearchValidationService.test.js`
- Test claim extraction
- Test validation pipeline
- Test aggregation logic

---

### Day 3: Task Claim Extractor Service

#### 3.1 Create Dedicated Extractor
**File**: `server/services/TaskClaimExtractor.js`

```javascript
import { ClaimSchema } from '../models/ClaimModels.js';
import { v4 as uuidv4 } from 'uuid';

export class TaskClaimExtractor {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.claimTypes = ['duration', 'dependency', 'resource', 'deadline', 'requirement'];
  }

  /**
   * Extract all claims from a bimodal task
   * @param {Object} bimodalTask - The task to extract claims from
   * @returns {Array} Array of validated claims
   */
  async extractClaims(bimodalTask) {
    const claims = [];

    try {
      // Duration claim
      if (bimodalTask.duration) {
        const durationClaim = this.createDurationClaim(bimodalTask);
        claims.push(ClaimSchema.parse(durationClaim));
      }

      // Start date claim
      if (bimodalTask.startDate) {
        const startDateClaim = this.createStartDateClaim(bimodalTask);
        claims.push(ClaimSchema.parse(startDateClaim));
      }

      // Dependency claims
      if (bimodalTask.dependencies && bimodalTask.dependencies.length > 0) {
        const dependencyClaims = this.createDependencyClaims(bimodalTask);
        dependencyClaims.forEach(claim => claims.push(ClaimSchema.parse(claim)));
      }

      // Regulatory requirement claim
      if (bimodalTask.regulatoryRequirement?.isRequired) {
        const regulatoryClaim = this.createRegulatoryClaim(bimodalTask);
        claims.push(ClaimSchema.parse(regulatoryClaim));
      }

      // Resource claims (if present)
      if (bimodalTask.resources) {
        const resourceClaims = this.createResourceClaims(bimodalTask);
        resourceClaims.forEach(claim => claims.push(ClaimSchema.parse(claim)));
      }

      this.logger.info(`Extracted ${claims.length} claims from task ${bimodalTask.id}`);
      return claims;

    } catch (error) {
      this.logger.error(`Failed to extract claims from task ${bimodalTask.id}:`, error);
      throw error;
    }
  }

  createDurationClaim(task) {
    return {
      id: this.generateClaimId(task.id, 'duration'),
      taskId: task.id,
      claim: `Duration is ${task.duration.value} ${task.duration.unit}`,
      claimType: 'duration',
      source: this.extractSource(task, task.duration),
      confidence: task.duration.confidence,
      contradictions: [],
      validatedAt: new Date().toISOString()
    };
  }

  createStartDateClaim(task) {
    return {
      id: this.generateClaimId(task.id, 'startDate'),
      taskId: task.id,
      claim: `Starts on ${task.startDate.value}`,
      claimType: 'deadline',
      source: this.extractSource(task, task.startDate),
      confidence: task.startDate.confidence,
      contradictions: [],
      validatedAt: new Date().toISOString()
    };
  }

  createDependencyClaims(task) {
    return task.dependencies.map((depId, index) => ({
      id: this.generateClaimId(task.id, `dependency-${index}`),
      taskId: task.id,
      claim: `Depends on task ${depId}`,
      claimType: 'dependency',
      source: this.extractSource(task, { origin: 'explicit' }),
      confidence: task.confidence,
      contradictions: [],
      validatedAt: new Date().toISOString()
    }));
  }

  createRegulatoryClaim(task) {
    return {
      id: this.generateClaimId(task.id, 'regulatory'),
      taskId: task.id,
      claim: `Requires ${task.regulatoryRequirement.regulation} approval`,
      claimType: 'requirement',
      source: this.extractSource(task, task.regulatoryRequirement),
      confidence: task.regulatoryRequirement.confidence,
      contradictions: [],
      validatedAt: new Date().toISOString()
    };
  }

  createResourceClaims(task) {
    // Placeholder for resource claims
    return [];
  }

  extractSource(task, fieldData) {
    if (fieldData?.sourceCitations && fieldData.sourceCitations.length > 0) {
      return {
        documentName: fieldData.sourceCitations[0].documentName,
        provider: fieldData.sourceCitations[0].provider || 'INTERNAL',
        citation: fieldData.sourceCitations[0]
      };
    }

    if (fieldData?.inferenceRationale) {
      return {
        documentName: 'inferred',
        provider: fieldData.inferenceRationale.llmProvider || 'GEMINI',
        citation: null
      };
    }

    return {
      documentName: 'inferred',
      provider: 'GEMINI',
      citation: null
    };
  }

  generateClaimId(taskId, claimType) {
    return `${taskId}-${claimType}-${uuidv4().split('-')[0]}`;
  }

  /**
   * Batch extract claims from multiple tasks
   */
  async extractBatchClaims(tasks) {
    const results = [];
    
    for (const task of tasks) {
      try {
        const claims = await this.extractClaims(task);
        results.push({
          taskId: task.id,
          claims,
          success: true
        });
      } catch (error) {
        results.push({
          taskId: task.id,
          error: error.message,
          success: false
        });
      }
    }

    return results;
  }
}
```

**Testing Task**: Create comprehensive tests

---

### Day 4-5: Integration Testing & Documentation

#### 4.1 Create Integration Tests
**File**: `server/__tests__/integration/Phase1Integration.test.js`

```javascript
import { ResearchValidationService } from '../../services/ResearchValidationService.js';
import { TaskClaimExtractor } from '../../services/TaskClaimExtractor.js';
import { BimodalGanttData } from '../../schemas/BimodalGanttSchema.js';

describe('Phase 1 Integration Tests', () => {
  let validationService;
  let claimExtractor;

  beforeEach(() => {
    validationService = new ResearchValidationService();
    claimExtractor = new TaskClaimExtractor();
  });

  test('Should create and validate a complete bimodal task', async () => {
    const task = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Complete FDA 510(k) submission',
      origin: 'explicit',
      confidence: 0.85,
      duration: {
        value: 90,
        unit: 'days',
        confidence: 0.9,
        origin: 'explicit',
        sourceCitations: [{
          documentName: 'FDA_Guidelines.pdf',
          provider: 'INTERNAL',
          startChar: 1200,
          endChar: 1350,
          exactQuote: 'Standard review time is 90 days',
          retrievedAt: new Date().toISOString()
        }]
      },
      regulatoryRequirement: {
        isRequired: true,
        regulation: 'FDA 510(k)',
        confidence: 1.0,
        origin: 'explicit'
      }
    };

    // Validate schema
    const parseResult = BimodalGanttData.safeParse({
      id: uuidv4(),
      projectName: 'Test Project',
      tasks: [task],
      metadata: {
        createdAt: new Date().toISOString(),
        totalTasks: 1,
        factRatio: 1.0,
        avgConfidence: 0.85
      }
    });

    expect(parseResult.success).toBe(true);

    // Extract claims
    const claims = await claimExtractor.extractClaims(task);
    expect(claims.length).toBeGreaterThan(0);
    expect(claims.some(c => c.claimType === 'duration')).toBe(true);
    expect(claims.some(c => c.claimType === 'requirement')).toBe(true);
  });

  test('Should handle inference-based tasks', async () => {
    const task = {
      id: '223e4567-e89b-12d3-a456-426614174000',
      name: 'Internal team review',
      origin: 'inference',
      confidence: 0.65,
      duration: {
        value: 5,
        unit: 'days',
        confidence: 0.65,
        origin: 'inference',
        inferenceRationale: {
          reasoning: 'Based on typical team review cycles',
          supportingFacts: ['fact-1', 'fact-2'],
          llmProvider: 'GEMINI',
          temperature: 0.7
        }
      }
    };

    const claims = await claimExtractor.extractClaims(task);
    expect(claims.length).toBeGreaterThan(0);
    expect(claims[0].source.provider).toBe('GEMINI');
  });
});
```

#### 4.2 Create Documentation
**File**: `docs/phase-1-implementation.md`

Document:
- Architecture decisions
- Schema structure
- Service interfaces
- Testing strategy
- Known limitations

---

## 🔍 PHASE 2: VALIDATION PIPELINE (Days 6-10)

### Day 6: Citation Verifier

#### 6.1 Implement Citation Verification
**File**: `server/validation/CitationVerifier.js`

```javascript
export class CitationVerifier {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.strictMode = options.strictMode !== false;
  }

  /**
   * Verify that a claim's citation is valid
   * @param {Object} claim - Claim with citation information
   * @param {Array} sourceDocuments - Available source documents
   * @returns {Object} Verification result
   */
  async verifyCitation(claim, sourceDocuments) {
    // Handle explicit citations
    if (claim.source.citation) {
      return await this.verifyExplicitCitation(claim, sourceDocuments);
    }

    // Handle inference-based claims
    if (claim.source.documentName === 'inferred') {
      return await this.verifyInferenceRationale(claim, sourceDocuments);
    }

    // No citation provided
    return {
      valid: false,
      reason: 'No citation or inference rationale provided',
      suggestedAction: 'ADD_CITATION',
      confidence: 0.0
    };
  }

  async verifyExplicitCitation(claim, sourceDocuments) {
    const { documentName, startChar, endChar, exactQuote } = claim.source.citation;

    // Find source document
    const document = sourceDocuments.find(d => 
      d.name === documentName || d.filename === documentName
    );

    if (!document) {
      this.logger.warn(`Source document not found: ${documentName}`);
      return {
        valid: false,
        reason: 'Source document not found',
        suggestedAction: 'VERIFY_DOCUMENT_NAME',
        confidence: 0.0
      };
    }

    // Verify character range exists
    if (!document.content || document.content.length < endChar) {
      return {
        valid: false,
        reason: 'Character range exceeds document length',
        suggestedAction: 'RECALCULATE_RANGE',
        confidence: 0.0
      };
    }

    // Extract text from document
    const extractedText = document.content.substring(startChar, endChar);

    // Exact match verification
    if (extractedText === exactQuote) {
      return {
        valid: true,
        confidence: 1.0,
        extractedText
      };
    }

    // Fuzzy match (allow minor whitespace differences)
    const normalizedExtracted = this.normalizeText(extractedText);
    const normalizedQuote = this.normalizeText(exactQuote);

    if (normalizedExtracted === normalizedQuote) {
      return {
        valid: true,
        confidence: 0.95,
        reason: 'Minor whitespace differences',
        extractedText
      };
    }

    // Similarity check
    const similarity = this.calculateSimilarity(extractedText, exactQuote);
    
    if (similarity > 0.9) {
      return {
        valid: true,
        confidence: 0.85,
        reason: `High similarity (${(similarity * 100).toFixed(1)}%)`,
        extractedText,
        suggestedAction: 'UPDATE_EXACT_QUOTE'
      };
    }

    // Verification failed
    return {
      valid: false,
      reason: `Text mismatch (similarity: ${(similarity * 100).toFixed(1)}%)`,
      extractedText,
      expectedText: exactQuote,
      suggestedAction: 'RECALCULATE_RANGE',
      confidence: similarity * 0.5
    };
  }

  async verifyInferenceRationale(claim, sourceDocuments) {
    // For inference claims, verify that supporting facts exist
    if (!claim.inferenceRationale) {
      return {
        valid: false,
        reason: 'No inference rationale provided',
        suggestedAction: 'ADD_RATIONALE',
        confidence: 0.0
      };
    }

    const { reasoning, supportingFacts, llmProvider } = claim.inferenceRationale;

    if (!supportingFacts || supportingFacts.length === 0) {
      return {
        valid: false,
        reason: 'No supporting facts provided',
        suggestedAction: 'ADD_SUPPORTING_FACTS',
        confidence: 0.3
      };
    }

    // Verify supporting facts are traceable
    const verificationResults = await Promise.all(
      supportingFacts.map(factId => this.verifySupportingFact(factId, sourceDocuments))
    );

    const validFacts = verificationResults.filter(r => r.valid).length;
    const validityRatio = validFacts / supportingFacts.length;

    if (validityRatio >= 0.8) {
      return {
        valid: true,
        confidence: validityRatio * 0.8, // Inferences max out at 0.8
        supportingFactsVerified: validFacts,
        totalSupportingFacts: supportingFacts.length
      };
    }

    return {
      valid: false,
      reason: `Only ${validFacts}/${supportingFacts.length} supporting facts verified`,
      suggestedAction: 'STRENGTHEN_SUPPORTING_FACTS',
      confidence: validityRatio * 0.5
    };
  }

  async verifySupportingFact(factId, sourceDocuments) {
    // Placeholder - would look up fact in claim ledger
    return {
      valid: true,
      factId
    };
  }

  normalizeText(text) {
    return text
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  calculateSimilarity(text1, text2) {
    // Levenshtein distance ratio
    const longer = text1.length > text2.length ? text1 : text2;
    const shorter = text1.length > text2.length ? text2 : text1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Batch verify citations
   */
  async verifyCitations(claims, sourceDocuments) {
    const results = [];

    for (const claim of claims) {
      try {
        const result = await this.verifyCitation(claim, sourceDocuments);
        results.push({
          claimId: claim.id,
          ...result
        });
      } catch (error) {
        results.push({
          claimId: claim.id,
          valid: false,
          reason: error.message,
          confidence: 0.0
        });
      }
    }

    return {
      results,
      totalVerified: results.filter(r => r.valid).length,
      totalClaims: claims.length,
      verificationRate: results.filter(r => r.valid).length / claims.length
    };
  }
}
```

**Testing Task**: Create comprehensive citation verification tests

---

### Day 7: Contradiction Detector

#### 7.1 Implement Contradiction Detection
**File**: `server/validation/ContradictionDetector.js`

```javascript
import { v4 as uuidv4 } from 'uuid';

export class ContradictionDetector {
  constructor(claimLedger, options = {}) {
    this.claimLedger = claimLedger;
    this.logger = options.logger || console;
    this.contradictionTypes = {
      TEMPORAL: 'temporal',
      LOGICAL: 'logical',
      NUMERICAL: 'numerical',
      REGULATORY: 'regulatory'
    };
  }

  /**
   * Detect contradictions for a new claim
   * @param {Object} newClaim - The claim to check
   * @returns {Array} Array of detected contradictions
   */
  async detectContradictions(newClaim) {
    const contradictions = [];
    const existingClaims = Array.from(this.claimLedger.claims.values());

    for (const existingClaim of existingClaims) {
      // Skip comparing claim with itself
      if (existingClaim.id === newClaim.id) continue;

      // Check different types of contradictions
      const temporalConflict = this.checkTemporalContradiction(newClaim, existingClaim);
      if (temporalConflict) contradictions.push(temporalConflict);

      const logicalConflict = this.checkLogicalContradiction(newClaim, existingClaim);
      if (logicalConflict) contradictions.push(logicalConflict);

      const numericalConflict = this.checkNumericalContradiction(newClaim, existingClaim);
      if (numericalConflict) contradictions.push(numericalConflict);

      const regulatoryConflict = this.checkRegulatoryContradiction(newClaim, existingClaim);
      if (regulatoryConflict) contradictions.push(regulatoryConflict);
    }

    return contradictions;
  }

  checkTemporalContradiction(claim1, claim2) {
    // Check for temporal inconsistencies
    // E.g., "Task A starts before Task B" vs "Task B must finish before Task A starts"
    
    if (claim1.claimType !== 'deadline' && claim1.claimType !== 'dependency') {
      return null;
    }

    if (claim2.claimType !== 'deadline' && claim2.claimType !== 'dependency') {
      return null;
    }

    // Parse temporal information
    const temporal1 = this.parseTemporalClaim(claim1);
    const temporal2 = this.parseTemporalClaim(claim2);

    if (!temporal1 || !temporal2) return null;

    // Check for circular dependencies
    if (this.hasCircularDependency(temporal1, temporal2)) {
      return {
        id: uuidv4(),
        claim1: claim1.id,
        claim2: claim2.id,
        severity: 'high',
        type: this.contradictionTypes.TEMPORAL,
        description: 'Circular dependency detected',
        resolutionStrategy: 'Remove one dependency or adjust timeline'
      };
    }

    // Check for timeline conflicts
    if (this.hasTimelineConflict(temporal1, temporal2)) {
      return {
        id: uuidv4(),
        claim1: claim1.id,
        claim2: claim2.id,
        severity: 'medium',
        type: this.contradictionTypes.TEMPORAL,
        description: 'Timeline conflict detected',
        resolutionStrategy: 'Adjust start/end dates'
      };
    }

    return null;
  }

  checkLogicalContradiction(claim1, claim2) {
    // Check for logical inconsistencies
    // E.g., "Task requires approval" vs "No approval needed"
    
    if (!this.areClaimsRelated(claim1, claim2)) {
      return null;
    }

    // Simple keyword-based contradiction detection
    const contradictionKeywords = [
      ['required', 'not required'],
      ['mandatory', 'optional'],
      ['must', 'must not'],
      ['allowed', 'prohibited']
    ];

    const text1 = claim1.claim.toLowerCase();
    const text2 = claim2.claim.toLowerCase();

    for (const [keyword1, keyword2] of contradictionKeywords) {
      if (text1.includes(keyword1) && text2.includes(keyword2)) {
        return {
          id: uuidv4(),
          claim1: claim1.id,
          claim2: claim2.id,
          severity: 'high',
          type: this.contradictionTypes.LOGICAL,
          description: `Logical contradiction: "${keyword1}" vs "${keyword2}"`,
          resolutionStrategy: 'Review source documents and resolve conflict'
        };
      }
    }

    return null;
  }

  checkNumericalContradiction(claim1, claim2) {
    // Check for numerical inconsistencies
    // E.g., duration claims that don't match
    
    if (claim1.claimType !== 'duration' || claim2.claimType !== 'duration') {
      return null;
    }

    if (claim1.taskId !== claim2.taskId) {
      return null; // Different tasks
    }

    // Extract duration values
    const duration1 = this.extractDuration(claim1.claim);
    const duration2 = this.extractDuration(claim2.claim);

    if (!duration1 || !duration2) return null;

    // Convert to same unit and compare
    const days1 = this.convertToDays(duration1.value, duration1.unit);
    const days2 = this.convertToDays(duration2.value, duration2.unit);

    if (Math.abs(days1 - days2) > 1) { // Allow 1 day tolerance
      return {
        id: uuidv4(),
        claim1: claim1.id,
        claim2: claim2.id,
        severity: 'medium',
        type: this.contradictionTypes.NUMERICAL,
        description: `Duration mismatch: ${days1} days vs ${days2} days`,
        resolutionStrategy: 'Use higher confidence source or average'
      };
    }

    return null;
  }

  checkRegulatoryContradiction(claim1, claim2) {
    // Check for regulatory requirement inconsistencies
    
    if (claim1.claimType !== 'requirement' && claim2.claimType !== 'requirement') {
      return null;
    }

    if (!this.areClaimsRelated(claim1, claim2)) {
      return null;
    }

    // Check if one claim says regulation is required and another says it's not
    const requires1 = claim1.claim.toLowerCase().includes('requires') || 
                      claim1.claim.toLowerCase().includes('required');
    const requires2 = claim2.claim.toLowerCase().includes('requires') || 
                      claim2.claim.toLowerCase().includes('required');

    const notRequired1 = claim1.claim.toLowerCase().includes('not required') ||
                         claim1.claim.toLowerCase().includes('optional');
    const notRequired2 = claim2.claim.toLowerCase().includes('not required') ||
                         claim2.claim.toLowerCase().includes('optional');

    if ((requires1 && notRequired2) || (notRequired1 && requires2)) {
      return {
        id: uuidv4(),
        claim1: claim1.id,
        claim2: claim2.id,
        severity: 'high',
        type: this.contradictionTypes.REGULATORY,
        description: 'Regulatory requirement contradiction',
        resolutionStrategy: 'Consult regulatory expert and use most conservative interpretation'
      };
    }

    return null;
  }

  // Helper methods

  parseTemporalClaim(claim) {
    // Extract temporal information from claim
    // This is a simplified version
    return {
      taskId: claim.taskId,
      claimType: claim.claimType
    };
  }

  hasCircularDependency(temporal1, temporal2) {
    // Simplified circular dependency check
    // In production, would use graph traversal
    return false;
  }

  hasTimelineConflict(temporal1, temporal2) {
    // Simplified timeline conflict check
    return false;
  }

  areClaimsRelated(claim1, claim2) {
    // Check if claims are about the same task or related tasks
    return claim1.taskId === claim2.taskId;
  }

  extractDuration(claimText) {
    // Extract duration from claim text
    const regex = /([\d.]+)\s*(hours?|days?|weeks?|months?)/i;
    const match = claimText.match(regex);
    
    if (match) {
      return {
        value: parseFloat(match[1]),
        unit: match[2].toLowerCase().replace(/s$/, '')
      };
    }
    
    return null;
  }

  convertToDays(value, unit) {
    const conversions = {
      'hour': 1 / 24,
      'day': 1,
      'week': 7,
      'month': 30
    };
    
    return value * (conversions[unit] || 1);
  }

  /**
   * Get resolution strategy for contradiction
   */
  getResolutionStrategy(contradiction) {
    const strategies = {
      [this.contradictionTypes.TEMPORAL]: {
        high: 'RESTRUCTURE_DEPENDENCIES',
        medium: 'ADJUST_TIMELINE',
        low: 'DOCUMENT_ASSUMPTION'
      },
      [this.contradictionTypes.LOGICAL]: {
        high: 'ESCALATE_TO_EXPERT',
        medium: 'PREFER_HIGHER_CONFIDENCE',
        low: 'DOCUMENT_AMBIGUITY'
      },
      [this.contradictionTypes.NUMERICAL]: {
        high: 'USE_EXPLICIT_SOURCE',
        medium: 'AVERAGE_VALUES',
        low: 'USE_CONSERVATIVE_ESTIMATE'
      },
      [this.contradictionTypes.REGULATORY]: {
        high: 'CONSULT_REGULATORY',
        medium: 'USE_CONSERVATIVE',
        low: 'DOCUMENT_RISK'
      }
    };

    return strategies[contradiction.type]?.[contradiction.severity] || 'MANUAL_REVIEW';
  }
}
```

**Testing Task**: Create comprehensive contradiction detection tests

---

### Day 8: Provenance Auditor

#### 8.1 Implement Provenance Auditing
**File**: `server/validation/ProvenanceAuditor.js`

```javascript
export class ProvenanceAuditor {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.trustedProviders = options.trustedProviders || ['INTERNAL', 'GEMINI', 'CLAUDE'];
    this.providerWeights = {
      'INTERNAL': 1.0,
      'CLAUDE': 0.95,
      'GEMINI': 0.9,
      'OPENAI': 0.9,
      'UNKNOWN': 0.5
    };
  }

  /**
   * Audit the provenance of a claim
   * @param {Object} claim - The claim to audit
   * @param {Array} sourceDocuments - Available source documents
   * @returns {Object} Provenance audit result
   */
  async auditProvenance(claim, sourceDocuments) {
    const audit = {
      score: 0,
      issues: [],
      chainOfCustody: [],
      recommendations: []
    };

    try {
      // Step 1: Verify source exists
      const sourceVerification = await this.verifySource(claim, sourceDocuments);
      audit.chainOfCustody.push(sourceVerification);

      if (!sourceVerification.exists) {
        audit.issues.push({
          severity: 'high',
          issue: 'Source document not found',
          recommendation: 'Verify document availability'
        });
        audit.score = 0.2;
        return audit;
      }

      // Step 2: Check provider trust level
      const providerTrust = this.assessProviderTrust(claim);
      audit.chainOfCustody.push(providerTrust);

      // Step 3: Verify timestamp validity
      const timestampCheck = this.verifyTimestamps(claim, sourceVerification);
      audit.chainOfCustody.push(timestampCheck);

      // Step 4: Check for tampering indicators
      const tamperingCheck = await this.checkForTampering(claim, sourceVerification);
      audit.chainOfCustody.push(tamperingCheck);

      // Step 5: Calculate overall provenance score
      audit.score = this.calculateProvenanceScore({
        sourceVerification,
        providerTrust,
        timestampCheck,
        tamperingCheck
      });

      // Step 6: Generate recommendations
      if (audit.score < 0.7) {
        audit.recommendations.push('Consider re-validating with primary source');
      }

      if (providerTrust.trustScore < 0.8) {
        audit.recommendations.push('Cross-reference with trusted provider');
      }

      return audit;

    } catch (error) {
      this.logger.error(`Provenance audit failed for claim ${claim.id}:`, error);
      return {
        score: 0,
        issues: [{ severity: 'critical', issue: error.message }],
        chainOfCustody: audit.chainOfCustody
      };
    }
  }

  async verifySource(claim, sourceDocuments) {
    const sourceName = claim.source.documentName;

    if (sourceName === 'inferred') {
      return {
        step: 'SOURCE_VERIFICATION',
        exists: true,
        sourceType: 'inference',
        verified: true,
        note: 'Inference-based claim, no direct source'
      };
    }

    const document = sourceDocuments.find(d => 
      d.name === sourceName || d.filename === sourceName
    );

    return {
      step: 'SOURCE_VERIFICATION',
      exists: !!document,
      sourceType: 'explicit',
      verified: !!document,
      documentMetadata: document ? {
        name: document.name,
        size: document.size,
        type: document.type
      } : null
    };
  }

  assessProviderTrust(claim) {
    const provider = claim.source.provider || 'UNKNOWN';
    const trustScore = this.providerWeights[provider] || this.providerWeights.UNKNOWN;

    const trusted = this.trustedProviders.includes(provider);

    return {
      step: 'PROVIDER_TRUST',
      provider,
      trustScore,
      trusted,
      note: trusted ? 'Trusted provider' : 'Untrusted or unknown provider'
    };
  }

  verifyTimestamps(claim, sourceVerification) {
    const claimTimestamp = new Date(claim.validatedAt);
    const now = new Date();

    // Check if claim timestamp is in the future
    if (claimTimestamp > now) {
      return {
        step: 'TIMESTAMP_VERIFICATION',
        valid: false,
        issue: 'Claim timestamp is in the future',
        claimTimestamp: claim.validatedAt
      };
    }

    // Check if claim is too old (>1 year)
    const daysSinceValidation = (now - claimTimestamp) / (1000 * 60 * 60 * 24);
    if (daysSinceValidation > 365) {
      return {
        step: 'TIMESTAMP_VERIFICATION',
        valid: true,
        warning: 'Claim is over 1 year old',
        daysSinceValidation: Math.floor(daysSinceValidation)
      };
    }

    // Check if citation timestamp matches
    if (claim.source.citation?.retrievedAt) {
      const citationTimestamp = new Date(claim.source.citation.retrievedAt);
      if (citationTimestamp > claimTimestamp) {
        return {
          step: 'TIMESTAMP_VERIFICATION',
          valid: false,
          issue: 'Citation retrieved after claim validation',
          claimTimestamp: claim.validatedAt,
          citationTimestamp: claim.source.citation.retrievedAt
        };
      }
    }

    return {
      step: 'TIMESTAMP_VERIFICATION',
      valid: true,
      daysSinceValidation: Math.floor(daysSinceValidation)
    };
  }

  async checkForTampering(claim, sourceVerification) {
    // Check for tampering indicators
    const indicators = [];

    // Check 1: Citation character range integrity
    if (claim.source.citation) {
      const { startChar, endChar, exactQuote } = claim.source.citation;
      
      if (startChar < 0 || endChar < startChar) {
        indicators.push('Invalid character range');
      }

      if (exactQuote.length !== (endChar - startChar)) {
        indicators.push('Quote length mismatch');
      }
    }

    // Check 2: Confidence score consistency
    if (claim.confidence < 0 || claim.confidence > 1) {
      indicators.push('Invalid confidence score');
    }

    // Check 3: Required fields presence
    if (!claim.id || !claim.taskId || !claim.claim) {
      indicators.push('Missing required fields');
    }

    return {
      step: 'TAMPERING_CHECK',
      clean: indicators.length === 0,
      indicators,
      note: indicators.length === 0 ? 'No tampering indicators found' : 'Potential integrity issues'
    };
  }

  calculateProvenanceScore(auditSteps) {
    let score = 1.0;

    // Source verification (30% weight)
    if (!auditSteps.sourceVerification.verified) {
      score -= 0.3;
    }

    // Provider trust (25% weight)
    score *= (0.75 + 0.25 * auditSteps.providerTrust.trustScore);

    // Timestamp validity (20% weight)
    if (!auditSteps.timestampCheck.valid) {
      score -= 0.2;
    } else if (auditSteps.timestampCheck.warning) {
      score -= 0.1;
    }

    // Tampering check (25% weight)
    if (!auditSteps.tamperingCheck.clean) {
      score -= 0.25;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Batch audit provenance for multiple claims
   */
  async batchAudit(claims, sourceDocuments) {
    const results = [];

    for (const claim of claims) {
      try {
        const audit = await this.auditProvenance(claim, sourceDocuments);
        results.push({
          claimId: claim.id,
          ...audit
        });
      } catch (error) {
        results.push({
          claimId: claim.id,
          score: 0,
          issues: [{ severity: 'critical', issue: error.message }]
        });
      }
    }

    return {
      results,
      avgProvenanceScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
      issuesCount: results.filter(r => r.issues.length > 0).length
    };
  }
}
```

**Testing Task**: Create provenance auditing tests

---

### Day 9: Confidence Calibrator

#### 9.1 Implement Confidence Calibration
**File**: `server/validation/ConfidenceCalibrator.js`

```javascript
export class ConfidenceCalibrator {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.config = {
      citationWeight: options.citationWeight || 0.3,
      contradictionWeight: options.contradictionWeight || 0.25,
      provenanceWeight: options.provenanceWeight || 0.25,
      originWeight: options.originWeight || 0.2
    };
  }

  /**
   * Calibrate confidence score for a claim
   * @param {Object} claim - The claim to calibrate
   * @param {Object} citationResult - Citation verification result
   * @param {Array} contradictions - Detected contradictions
   * @param {Object} provenance - Provenance audit result
   * @returns {Object} Calibrated claim
   */
  async calibrateConfidence(claim, citationResult, contradictions, provenance) {
    const baseConfidence = claim.confidence || 0.5;

    // Calculate adjustment factors
    const citationFactor = this.calculateCitationFactor(citationResult);
    const contradictionFactor = this.calculateContradictionFactor(contradictions);
    const provenanceFactor = provenance.score || 0.5;
    const originFactor = this.calculateOriginFactor(claim);

    // Weighted average
    const calibratedScore = 
      citationFactor * this.config.citationWeight +
      contradictionFactor * this.config.contradictionWeight +
      provenanceFactor * this.config.provenanceWeight +
      originFactor * this.config.originWeight;

    // Blend with base confidence
    const finalConfidence = (calibratedScore * 0.7) + (baseConfidence * 0.3);

    // Add calibration metadata
    const calibratedClaim = {
      ...claim,
      confidence: Math.max(0, Math.min(1, finalConfidence)),
      calibrationMetadata: {
        baseConfidence,
        calibratedScore: finalConfidence,
        factors: {
          citation: citationFactor,
          contradiction: contradictionFactor,
          provenance: provenanceFactor,
          origin: originFactor
        },
        adjustmentReason: this.generateAdjustmentReason({
          citationFactor,
          contradictionFactor,
          provenanceFactor,
          originFactor
        }),
        calibratedAt: new Date().toISOString()
      }
    };

    return calibratedClaim;
  }

  calculateCitationFactor(citationResult) {
    if (!citationResult || !citationResult.valid) {
      return 0.3; // Low confidence without valid citation
    }

    // Use citation confidence if available
    if (citationResult.confidence !== undefined) {
      return citationResult.confidence;
    }

    return 0.9; // High confidence with valid citation
  }

  calculateContradictionFactor(contradictions) {
    if (!contradictions || contradictions.length === 0) {
      return 1.0; // No contradictions = high confidence
    }

    // Count contradictions by severity
    const high = contradictions.filter(c => c.severity === 'high').length;
    const medium = contradictions.filter(c => c.severity === 'medium').length;
    const low = contradictions.filter(c => c.severity === 'low').length;

    // Penalty based on severity
    let penalty = 0;
    penalty += high * 0.3;   // High severity: -0.3 each
    penalty += medium * 0.15; // Medium severity: -0.15 each
    penalty += low * 0.05;    // Low severity: -0.05 each

    return Math.max(0.1, 1.0 - penalty);
  }

  calculateOriginFactor(claim) {
    // Different confidence based on origin
    if (claim.source.documentName === 'inferred') {
      return 0.6; // Inferences get lower baseline
    }

    if (claim.source.citation) {
      return 0.95; // Explicit citations get high baseline
    }

    return 0.7; // Default
  }

  generateAdjustmentReason(factors) {
    const reasons = [];

    if (factors.citation < 0.5) {
      reasons.push('Weak or missing citation');
    }

    if (factors.contradiction < 0.7) {
      reasons.push('Contradictions detected');
    }

    if (factors.provenance < 0.7) {
      reasons.push('Low provenance score');
    }

    if (factors.origin < 0.7) {
      reasons.push('Inference-based claim');
    }

    if (reasons.length === 0) {
      return 'High confidence across all factors';
    }

    return reasons.join('; ');
  }

  /**
   * Calibrate confidence for an entire task
   */
  async calibrateTaskConfidence(task, validationResult) {
    const claims = validationResult.claims || [];
    
    if (claims.length === 0) {
      return task.confidence || 0.5;
    }

    // Average confidence across all claims
    const avgConfidence = claims.reduce((sum, claim) => 
      sum + claim.confidence, 0) / claims.length;

    // Adjust based on validation results
    let adjustment = 0;

    // Citation coverage adjustment
    if (validationResult.citationCoverage < 0.75) {
      adjustment -= 0.1;
    }

    // Contradiction adjustment
    if (validationResult.contradictions && validationResult.contradictions.length > 0) {
      const highSeverity = validationResult.contradictions.filter(c => c.severity === 'high').length;
      adjustment -= highSeverity * 0.15;
    }

    // Provenance adjustment
    if (validationResult.provenanceScore < 0.7) {
      adjustment -= 0.1;
    }

    const finalConfidence = Math.max(0, Math.min(1, avgConfidence + adjustment));

    this.logger.info(`Task ${task.id} confidence: ${task.confidence} → ${finalConfidence}`);

    return finalConfidence;
  }

  /**
   * Batch calibrate multiple claims
   */
  async batchCalibrate(claims, validationResults) {
    const calibrated = [];

    for (let i = 0; i < claims.length; i++) {
      const claim = claims[i];
      const result = validationResults[i] || {};

      try {
        const calibratedClaim = await this.calibrateConfidence(
          claim,
          result.citation || {},
          result.contradictions || [],
          result.provenance || {}
        );
        calibrated.push(calibratedClaim);
      } catch (error) {
        this.logger.error(`Failed to calibrate claim ${claim.id}:`, error);
        calibrated.push(claim); // Return original if calibration fails
      }
    }

    return calibrated;
  }
}
```

**Testing Task**: Create confidence calibration tests

---

### Day 10: Integration & Testing

#### 10.1 Create Complete Validation Pipeline
**File**: `server/services/ValidationPipeline.js`

```javascript
import { CitationVerifier } from '../validation/CitationVerifier.js';
import { ContradictionDetector } from '../validation/ContradictionDetector.js';
import { ProvenanceAuditor } from '../validation/ProvenanceAuditor.js';
import { ConfidenceCalibrator } from '../validation/ConfidenceCalibrator.js';
import { ClaimLedger } from '../models/ClaimModels.js';

export class ValidationPipeline {
  constructor(options = {}) {
    this.claimLedger = options.claimLedger || new ClaimLedger();
    this.citationVerifier = new CitationVerifier(options.citation);
    this.contradictionDetector = new ContradictionDetector(this.claimLedger, options.contradiction);
    this.provenanceAuditor = new ProvenanceAuditor(options.provenance);
    this.confidenceCalibrator = new ConfidenceCalibrator(options.confidence);
    this.logger = options.logger || console;
  }

  /**
   * Run complete validation pipeline on claims
   * @param {Array} claims - Claims to validate
   * @param {Array} sourceDocuments - Source documents
   * @returns {Object} Complete validation results
   */
  async validate(claims, sourceDocuments) {
    this.logger.info(`Starting validation pipeline for ${claims.length} claims`);

    const results = {
      validatedClaims: [],
      contradictions: [],
      metrics: {
        totalClaims: claims.length,
        validCitations: 0,
        totalContradictions: 0,
        avgProvenance: 0,
        avgConfidence: 0
      }
    };

    for (const claim of claims) {
      try {
        // Step 1: Citation Verification
        const citationResult = await this.citationVerifier.verifyCitation(claim, sourceDocuments);
        if (citationResult.valid) results.metrics.validCitations++;

        // Step 2: Contradiction Detection
        const contradictions = await this.contradictionDetector.detectContradictions(claim);
        results.contradictions.push(...contradictions);
        results.metrics.totalContradictions += contradictions.length;

        // Step 3: Provenance Audit
        const provenanceResult = await this.provenanceAuditor.auditProvenance(claim, sourceDocuments);
        results.metrics.avgProvenance += provenanceResult.score;

        // Step 4: Confidence Calibration
        const calibratedClaim = await this.confidenceCalibrator.calibrateConfidence(
          claim,
          citationResult,
          contradictions,
          provenanceResult
        );

        results.metrics.avgConfidence += calibratedClaim.confidence;

        // Add to claim ledger
        this.claimLedger.addClaim(calibratedClaim);
        
        // Add validation metadata
        calibratedClaim.validationResult = {
          citation: citationResult,
          contradictions,
          provenance: provenanceResult
        };

        results.validatedClaims.push(calibratedClaim);

      } catch (error) {
        this.logger.error(`Validation failed for claim ${claim.id}:`, error);
        results.validatedClaims.push({
          ...claim,
          validationError: error.message
        });
      }
    }

    // Calculate averages
    results.metrics.avgProvenance /= claims.length;
    results.metrics.avgConfidence /= claims.length;
    results.metrics.citationCoverageRate = results.metrics.validCitations / claims.length;

    this.logger.info('Validation pipeline complete', results.metrics);

    return results;
  }

  /**
   * Get validation summary
   */
  getSummary() {
    return {
      totalClaims: this.claimLedger.claims.size,
      totalContradictions: this.claimLedger.contradictions.size,
      ledgerSnapshot: this.claimLedger.export()
    };
  }

  /**
   * Reset pipeline state
   */
  reset() {
    this.claimLedger = new ClaimLedger();
    this.contradictionDetector = new ContradictionDetector(this.claimLedger);
  }
}
```

#### 10.2 Create Integration Tests
**File**: `server/__tests__/integration/Phase2Integration.test.js`

(Test complete pipeline flow)

---

## 🔧 PHASE 3: QUALITY GATES & REPAIR (Days 11-15)

### Day 11: Quality Gate Manager

#### 11.1 Implement Quality Gates
**File**: `server/validation/QualityGateManager.js`

(Implement as per design document - lines 530-616)

```javascript
export class QualityGateManager {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.gates = [
      {
        name: 'CITATION_COVERAGE',
        threshold: options.citationCoverageThreshold || 0.75,
        blocker: true,
        evaluate: (data) => {
          const cited = data.tasks.filter(t => 
            t.duration?.sourceCitations?.length > 0 ||
            t.startDate?.sourceCitations?.length > 0
          ).length;
          return cited / data.tasks.length;
        }
      },
      {
        name: 'CONTRADICTION_SEVERITY',
        threshold: 'medium',
        blocker: true,
        evaluate: (data) => {
          const highSeverity = data.validationMetadata?.contradictions?.filter(
            c => c.severity === 'high'
          ) || [];
          return highSeverity.length === 0;
        }
      },
      {
        name: 'CONFIDENCE_MINIMUM',
        threshold: options.minConfidence || 0.50,
        blocker: true,
        evaluate: (data) => {
          return data.tasks.every(t => t.confidence >= (options.minConfidence || 0.50));
        }
      },
      {
        name: 'SCHEMA_COMPLIANCE',
        threshold: 1.00,
        blocker: true,
        evaluate: (data) => {
          const { BimodalGanttData } = require('../schemas/BimodalGanttSchema.js');
          const result = BimodalGanttData.safeParse(data);
          return result.success;
        }
      },
      {
        name: 'REGULATORY_FLAGS',
        threshold: 1.00,
        blocker: false,
        evaluate: (data) => {
          const regulatoryTasks = data.tasks.filter(t => 
            this.detectRegulation(t.name) !== 'General Compliance'
          );
          return regulatoryTasks.every(t => 
            t.regulatoryRequirement?.isRequired === true
          );
        }
      }
    ];
  }

  async evaluate(ganttData) {
    this.logger.info('Evaluating quality gates...');

    const results = {
      passed: true,
      failures: [],
      warnings: [],
      timestamp: new Date().toISOString()
    };

    for (const gate of this.gates) {
      try {
        const score = await gate.evaluate(ganttData);
        const passed = typeof gate.threshold === 'number'
          ? score >= gate.threshold
          : score === true;

        this.logger.info(`Quality gate ${gate.name}: ${passed ? 'PASS' : 'FAIL'} (score: ${score})`);

        if (!passed) {
          const failure = {
            gate: gate.name,
            score,
            threshold: gate.threshold,
            blocker: gate.blocker,
            timestamp: new Date().toISOString()
          };

          if (gate.blocker) {
            results.passed = false;
            results.failures.push(failure);
          } else {
            results.warnings.push(failure);
          }
        }
      } catch (error) {
        this.logger.error(`Quality gate ${gate.name} evaluation failed:`, error);
        results.passed = false;
        results.failures.push({
          gate: gate.name,
          error: error.message,
          blocker: gate.blocker
        });
      }
    }

    this.logger.info(`Quality gates ${results.passed ? 'PASSED' : 'FAILED'}`);
    return results;
  }

  detectRegulation(taskName) {
    const regulations = {
      'FDA': /FDA|510\(k\)|premarket|clinical trial/i,
      'HIPAA': /HIPAA|protected health|phi|patient privacy/i,
      'SOX': /Sarbanes-Oxley|SOX|financial audit/i,
      'GDPR': /GDPR|data protection|privacy regulation/i,
      'PCI': /PCI DSS|payment card|cardholder data/i
    };

    for (const [regulation, pattern] of Object.entries(regulations)) {
      if (pattern.test(taskName)) {
        return regulation;
      }
    }

    return 'General Compliance';
  }

  addCustomGate(gate) {
    this.gates.push(gate);
  }

  removeGate(gateName) {
    this.gates = this.gates.filter(g => g.name !== gateName);
  }
}
```

### Day 12: Semantic Repair Engine

#### 12.1 Implement Repair System
**File**: `server/validation/SemanticRepairEngine.js`

```javascript
import { v4 as uuidv4 } from 'uuid';

export class SemanticRepairEngine {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.maxRepairAttempts = options.maxRepairAttempts || 3;
    this.repairStrategies = this.initializeRepairStrategies();
  }

  initializeRepairStrategies() {
    return {
      CITATION_COVERAGE: this.repairCitationCoverage.bind(this),
      CONTRADICTION_SEVERITY: this.repairContradictions.bind(this),
      CONFIDENCE_MINIMUM: this.repairConfidence.bind(this),
      SCHEMA_COMPLIANCE: this.repairSchema.bind(this),
      REGULATORY_FLAGS: this.repairRegulatoryFlags.bind(this)
    };
  }

  /**
   * Attempt to repair quality gate failures
   * @param {Object} ganttData - The gantt data to repair
   * @param {Array} failures - Quality gate failures
   * @returns {Object} Repaired gantt data and repair log
   */
  async repair(ganttData, failures) {
    this.logger.info(`Attempting repairs for ${failures.length} failures`);

    const repairLog = {
      attempts: [],
      successfulRepairs: [],
      failedRepairs: [],
      timestamp: new Date().toISOString()
    };

    let repairedData = { ...ganttData };

    for (const failure of failures) {
      const strategy = this.repairStrategies[failure.gate];

      if (!strategy) {
        this.logger.warn(`No repair strategy for gate: ${failure.gate}`);
        repairLog.failedRepairs.push({
          gate: failure.gate,
          reason: 'No repair strategy available'
        });
        continue;
      }

      try {
        const repairResult = await strategy(repairedData, failure);
        
        repairLog.attempts.push({
          gate: failure.gate,
          strategy: strategy.name,
          result: repairResult
        });

        if (repairResult.success) {
          repairedData = repairResult.data;
          repairLog.successfulRepairs.push({
            gate: failure.gate,
            changes: repairResult.changes
          });
          this.logger.info(`Successfully repaired: ${failure.gate}`);
        } else {
          repairLog.failedRepairs.push({
            gate: failure.gate,
            reason: repairResult.reason
          });
          this.logger.warn(`Failed to repair: ${failure.gate}`);
        }
      } catch (error) {
        this.logger.error(`Repair strategy failed for ${failure.gate}:`, error);
        repairLog.failedRepairs.push({
          gate: failure.gate,
          reason: error.message
        });
      }
    }

    return {
      data: repairedData,
      repairLog,
      fullyRepaired: repairLog.failedRepairs.length === 0
    };
  }

  async repairCitationCoverage(ganttData, failure) {
    const changes = [];
    const tasksCopy = [...ganttData.tasks];

    for (const task of tasksCopy) {
      // If task has no citations, mark as inference
      if (!task.duration?.sourceCitations || task.duration.sourceCitations.length === 0) {
        if (!task.duration.inferenceRationale) {
          task.duration.inferenceRationale = {
            reasoning: 'Duration estimated based on typical project timelines',
            supportingFacts: [],
            llmProvider: 'GEMINI',
            temperature: 0.7
          };
          
          // Lower confidence for inferences
          task.duration.confidence = Math.min(task.duration.confidence, 0.7);
          task.duration.origin = 'inference';

          changes.push({
            taskId: task.id,
            field: 'duration',
            action: 'added_inference_rationale'
          });
        }
      }
    }

    // Recalculate citation coverage
    const cited = tasksCopy.filter(t => t.duration?.sourceCitations?.length > 0).length;
    const coverage = cited / tasksCopy.length;

    return {
      success: coverage >= failure.threshold || changes.length > 0,
      data: { ...ganttData, tasks: tasksCopy },
      changes,
      newScore: coverage
    };
  }

  async repairContradictions(ganttData, failure) {
    const changes = [];
    const tasksCopy = [...ganttData.tasks];
    const contradictions = ganttData.validationMetadata?.contradictions || [];

    const highSeverity = contradictions.filter(c => c.severity === 'high');

    for (const contradiction of highSeverity) {
      // Find affected tasks
      const claim1 = this.findClaimById(contradiction.claim1, tasksCopy);
      const claim2 = this.findClaimById(contradiction.claim2, tasksCopy);

      if (!claim1 || !claim2) continue;

      // Resolution: prefer explicit over inference
      if (claim1.origin === 'explicit' && claim2.origin === 'inference') {
        // Keep claim1, mark claim2 with warning
        changes.push({
          taskId: claim2.taskId,
          action: 'contradiction_resolved',
          resolution: 'Explicit source takes precedence'
        });
      } else if (claim1.origin === 'inference' && claim2.origin === 'explicit') {
        // Keep claim2, mark claim1 with warning
        changes.push({
          taskId: claim1.taskId,
          action: 'contradiction_resolved',
          resolution: 'Explicit source takes precedence'
        });
      } else {
        // Both same type - prefer higher confidence
        const keepClaim = claim1.confidence > claim2.confidence ? claim1 : claim2;
        changes.push({
          taskId: keepClaim.taskId,
          action: 'contradiction_resolved',
          resolution: 'Higher confidence source retained'
        });
      }

      // Mark contradiction as resolved
      contradiction.resolvedAt = new Date().toISOString();
      contradiction.resolutionStrategy = contradiction.resolutionStrategy || 'AUTO_RESOLVED';
    }

    return {
      success: changes.length > 0,
      data: { ...ganttData, tasks: tasksCopy },
      changes
    };
  }

  async repairConfidence(ganttData, failure) {
    const changes = [];
    const tasksCopy = [...ganttData.tasks];
    const minConfidence = failure.threshold;

    for (const task of tasksCopy) {
      if (task.confidence < minConfidence) {
        // Boost confidence if task has strong citations
        if (task.duration?.sourceCitations?.length > 0) {
          task.confidence = Math.max(task.confidence, minConfidence);
          changes.push({
            taskId: task.id,
            action: 'confidence_boosted',
            oldConfidence: task.confidence,
            newConfidence: minConfidence,
            reason: 'Strong citation support'
          });
        } else {
          // Flag for review
          if (!task.reviewFlags) task.reviewFlags = [];
          task.reviewFlags.push({
            type: 'LOW_CONFIDENCE',
            confidence: task.confidence,
            threshold: minConfidence,
            flaggedAt: new Date().toISOString()
          });
          changes.push({
            taskId: task.id,
            action: 'flagged_for_review',
            reason: 'Low confidence without citation'
          });
        }
      }
    }

    return {
      success: changes.length > 0,
      data: { ...ganttData, tasks: tasksCopy },
      changes
    };
  }

  async repairSchema(ganttData, failure) {
    const { BimodalGanttData } = require('../schemas/BimodalGanttSchema.js');
    const parseResult = BimodalGanttData.safeParse(ganttData);

    if (parseResult.success) {
      return {
        success: true,
        data: parseResult.data,
        changes: []
      };
    }

    const changes = [];
    const tasksCopy = [...ganttData.tasks];

    // Attempt to fix common schema issues
    for (const task of tasksCopy) {
      // Ensure ID is UUID
      if (!task.id || !this.isValidUUID(task.id)) {
        task.id = uuidv4();
        changes.push({ taskId: task.id, action: 'generated_uuid' });
      }

      // Ensure required fields
      if (!task.origin) {
        task.origin = 'inference';
        changes.push({ taskId: task.id, action: 'set_default_origin' });
      }

      if (task.confidence === undefined || task.confidence === null) {
        task.confidence = 0.5;
        changes.push({ taskId: task.id, action: 'set_default_confidence' });
      }

      // Validate confidence bounds
      if (task.confidence < 0 || task.confidence > 1) {
        task.confidence = Math.max(0, Math.min(1, task.confidence));
        changes.push({ taskId: task.id, action: 'clamped_confidence' });
      }
    }

    const repairedData = { ...ganttData, tasks: tasksCopy };
    const revalidation = BimodalGanttData.safeParse(repairedData);

    return {
      success: revalidation.success,
      data: repairedData,
      changes,
      validationErrors: revalidation.success ? null : revalidation.error.errors
    };
  }

  async repairRegulatoryFlags(ganttData, failure) {
    const changes = [];
    const tasksCopy = [...ganttData.tasks];
    const qualityGateMgr = new (require('./QualityGateManager.js').QualityGateManager)();

    for (const task of tasksCopy) {
      const regulation = qualityGateMgr.detectRegulation(task.name);
      
      if (regulation !== 'General Compliance') {
        // Ensure regulatory requirement is set
        if (!task.regulatoryRequirement || !task.regulatoryRequirement.isRequired) {
          task.regulatoryRequirement = {
            isRequired: true,
            regulation: regulation,
            confidence: 0.9,
            origin: 'explicit'
          };
          
          changes.push({
            taskId: task.id,
            action: 'added_regulatory_requirement',
            regulation: regulation
          });
        }
      }
    }

    return {
      success: changes.length > 0,
      data: { ...ganttData, tasks: tasksCopy },
      changes
    };
  }

  findClaimById(claimId, tasks) {
    for (const task of tasks) {
      if (task.validationMetadata?.claims) {
        const claim = task.validationMetadata.claims.find(c => c.id === claimId);
        if (claim) return claim;
      }
    }
    return null;
  }

  isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}
```

### Days 13-15: Testing, Documentation & Integration

(Create comprehensive tests for quality gates and repair engine)

---

## 🔗 PHASE 4: END-TO-END INTEGRATION (Days 16-18)

### Day 16: Master Orchestrator

#### 16.1 Create Main Orchestration Service
**File**: `server/services/SemanticGanttOrchestrator.js`

```javascript
import { ResearchValidationService } from './ResearchValidationService.js';
import { TaskClaimExtractor } from './TaskClaimExtractor.js';
import { ValidationPipeline } from './ValidationPipeline.js';
import { QualityGateManager } from '../validation/QualityGateManager.js';
import { SemanticRepairEngine } from '../validation/SemanticRepairEngine.js';
import { BimodalGanttData } from '../schemas/BimodalGanttSchema.js';
import { v4 as uuidv4 } from 'uuid';

export class SemanticGanttOrchestrator {
  constructor(options = {}) {
    this.logger = options.logger || console;
    
    // Initialize all services
    this.researchValidator = new ResearchValidationService(options.validation);
    this.taskClaimExtractor = new TaskClaimExtractor(options.extraction);
    this.validationPipeline = new ValidationPipeline(options.pipeline);
    this.qualityGateManager = new QualityGateManager(options.qualityGates);
    this.repairEngine = new SemanticRepairEngine(options.repair);
    
    // Job tracking
    this.jobs = new Map();
  }

  /**
   * Main entry point: Generate and validate semantic gantt chart
   * @param {string} userPrompt - User's project description
   * @param {Array} sourceDocuments - Source documents for validation
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Generated and validated gantt chart
   */
  async generateValidatedGanttChart(userPrompt, sourceDocuments, options = {}) {
    const jobId = options.jobId || uuidv4();
    
    this.jobs.set(jobId, {
      status: 'started',
      progress: 0,
      startedAt: new Date().toISOString()
    });

    try {
      // STEP 1: Generate initial gantt data (from existing LLM)
      this.updateJob(jobId, { progress: 10, status: 'Generating initial gantt...' });
      const initialGanttData = await this.generateInitialGantt(userPrompt, sourceDocuments, options);

      // STEP 2: Extract claims from all tasks
      this.updateJob(jobId, { progress: 25, status: 'Extracting claims...' });
      const allClaims = [];
      for (const task of initialGanttData.tasks) {
        const claims = await this.taskClaimExtractor.extractClaims(task);
        allClaims.push(...claims);
      }

      // STEP 3: Run validation pipeline
      this.updateJob(jobId, { progress: 40, status: 'Validating claims...' });
      const validationResults = await this.validationPipeline.validate(allClaims, sourceDocuments);

      // STEP 4: Attach validation metadata to tasks
      this.updateJob(jobId, { progress: 55, status: 'Attaching validation metadata...' });
      for (const task of initialGanttData.tasks) {
        const taskClaims = validationResults.validatedClaims.filter(c => c.taskId === task.id);
        
        task.validationMetadata = {
          claims: taskClaims,
          citationCoverage: this.calculateCitationCoverage(taskClaims),
          contradictions: taskClaims.flatMap(c => c.validationResult?.contradictions || []),
          provenanceScore: this.calculateAvgProvenance(taskClaims),
          qualityGatesPassed: []
        };

        // Recalibrate task confidence
        task.confidence = await this.researchValidator.calibrateConfidence(
          task,
          { claims: taskClaims }
        );
      }

      initialGanttData.validationMetadata = {
        contradictions: validationResults.contradictions,
        metrics: validationResults.metrics
      };

      // STEP 5: Apply quality gates
      this.updateJob(jobId, { progress: 70, status: 'Applying quality gates...' });
      let ganttData = initialGanttData;
      const qualityGateResults = await this.qualityGateManager.evaluate(ganttData);

      // STEP 6: Attempt repairs if needed
      if (!qualityGateResults.passed) {
        this.updateJob(jobId, { progress: 80, status: 'Attempting repairs...' });
        
        const repairResult = await this.repairEngine.repair(
          ganttData,
          qualityGateResults.failures
        );
        
        ganttData = repairResult.data;
        ganttData.repairLog = repairResult.repairLog;

        // Re-evaluate after repairs
        const revalidation = await this.qualityGateManager.evaluate(ganttData);
        ganttData.finalQualityGates = revalidation;
      } else {
        ganttData.finalQualityGates = qualityGateResults;
      }

      // STEP 7: Final schema validation
      this.updateJob(jobId, { progress: 90, status: 'Final validation...' });
      const finalValidation = BimodalGanttData.safeParse(ganttData);

      if (!finalValidation.success) {
        throw new Error(`Schema validation failed: ${JSON.stringify(finalValidation.error.errors)}`);
      }

      // STEP 8: Store and complete
      this.updateJob(jobId, { progress: 100, status: 'Complete' });
      const chartId = await this.storeChart(finalValidation.data, jobId);

      this.completeJob(jobId, chartId);

      return {
        chartId,
        jobId,
        data: finalValidation.data,
        metadata: {
          qualityGates: ganttData.finalQualityGates,
          repairLog: ganttData.repairLog,
          validationMetrics: validationResults.metrics
        }
      };

    } catch (error) {
      this.logger.error(`Job ${jobId} failed:`, error);
      this.failJob(jobId, error.message);
      throw error;
    }
  }

  async generateInitialGantt(userPrompt, sourceDocuments, options) {
    // This would call your existing LLM-based gantt generation
    // Placeholder implementation:
    
    const tasks = options.existingTasks || [];
    
    return {
      id: uuidv4(),
      projectName: options.projectName || 'Untitled Project',
      tasks: tasks,
      metadata: {
        createdAt: new Date().toISOString(),
        totalTasks: tasks.length,
        factRatio: 0,
        avgConfidence: 0
      }
    };
  }

  calculateCitationCoverage(claims) {
    const cited = claims.filter(c => c.source.citation !== null).length;
    return claims.length > 0 ? cited / claims.length : 0;
  }

  calculateAvgProvenance(claims) {
    if (claims.length === 0) return 0;
    const total = claims.reduce((sum, c) => 
      sum + (c.validationResult?.provenance?.score || 0), 0
    );
    return total / claims.length;
  }

  async storeChart(ganttData, jobId) {
    // Store chart in database or file system
    const chartId = uuidv4();
    // Implementation depends on your storage system
    this.logger.info(`Stored chart ${chartId} for job ${jobId}`);
    return chartId;
  }

  updateJob(jobId, update) {
    const job = this.jobs.get(jobId);
    if (job) {
      Object.assign(job, update, { updatedAt: new Date().toISOString() });
      this.logger.info(`Job ${jobId}: ${update.status} (${update.progress}%)`);
    }
  }

  completeJob(jobId, chartId) {
    this.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      chartId,
      completedAt: new Date().toISOString()
    });
  }

  failJob(jobId, error) {
    this.updateJob(jobId, {
      status: 'failed',
      error,
      failedAt: new Date().toISOString()
    });
  }

  getJobStatus(jobId) {
    return this.jobs.get(jobId);
  }
}
```

### Day 17: API Integration

#### 17.1 Create API Endpoints
**File**: `server/routes/semanticGanttRoutes.js`

```javascript
import express from 'express';
import { SemanticGanttOrchestrator } from '../services/SemanticGanttOrchestrator.js';

const router = express.Router();
const orchestrator = new SemanticGanttOrchestrator();

/**
 * POST /api/semantic-gantt/generate
 * Generate a validated semantic gantt chart
 */
router.post('/generate', async (req, res) => {
  try {
    const { userPrompt, sourceDocuments, options } = req.body;

    // Validate input
    if (!userPrompt || !sourceDocuments) {
      return res.status(400).json({
        error: 'Missing required fields: userPrompt, sourceDocuments'
      });
    }

    // Start generation
    const result = await orchestrator.generateValidatedGanttChart(
      userPrompt,
      sourceDocuments,
      options
    );

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Generation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/semantic-gantt/job/:jobId
 * Get job status
 */
router.get('/job/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const status = orchestrator.getJobStatus(jobId);

  if (!status) {
    return res.status(404).json({
      error: 'Job not found'
    });
  }

  res.json(status);
});

/**
 * POST /api/semantic-gantt/validate
 * Validate existing gantt data
 */
router.post('/validate', async (req, res) => {
  try {
    const { ganttData, sourceDocuments } = req.body;

    // Create validation-only job
    const jobId = uuidv4();
    orchestrator.updateJob(jobId, { status: 'validating', progress: 0 });

    // Run quality gates
    const qualityGateResults = await orchestrator.qualityGateManager.evaluate(ganttData);

    res.json({
      success: true,
      jobId,
      qualityGates: qualityGateResults
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
```

#### 17.2 Integrate with Existing Server
**File**: Update main server file (e.g., `server/index.js`)

```javascript
// Add to existing server
import semanticGanttRoutes from './routes/semanticGanttRoutes.js';

app.use('/api/semantic-gantt', semanticGanttRoutes);
```

### Day 18: End-to-End Testing

Create comprehensive E2E tests covering the full flow.

---

## 📊 PHASE 5: MONITORING & OPTIMIZATION (Days 19-20)

### Day 19: Monitoring System

#### 19.1 Implement Metrics Collection
**File**: `server/monitoring/ValidationMetrics.js`

(Implement as per design document - lines 622-687)

#### 19.2 Create Dashboard Endpoint
**File**: `server/routes/monitoringRoutes.js`

```javascript
import express from 'express';
import { ValidationMetricsCollector } from '../monitoring/ValidationMetrics.js';

const router = express.Router();
const metricsCollector = new ValidationMetricsCollector();

router.get('/health', async (req, res) => {
  const health = metricsCollector.getHealthScore();
  res.json(health);
});

router.get('/metrics', async (req, res) => {
  const metrics = metricsCollector.getCurrentMetrics();
  res.json(metrics);
});

export default router;
```

### Day 20: Documentation & Deployment

#### 20.1 Create Complete Documentation
Create:
- `docs/API.md` - API documentation
- `docs/ARCHITECTURE.md` - System architecture
- `docs/DEPLOYMENT.md` - Deployment guide
- `docs/TESTING.md` - Testing guide
- `docs/TROUBLESHOOTING.md` - Common issues

#### 20.2 Deployment Checklist
- [ ] All tests passing
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Logging configured
- [ ] Error handling verified
- [ ] Security review complete
- [ ] Backup strategy in place

---

## 📝 EXECUTION INSTRUCTIONS FOR CLAUDE CODE

### How to Use This Plan

1. **Sequential Execution**: Execute phases in order. Each phase builds on the previous.

2. **File Creation Pattern**:
   ```bash
   # For each file in the plan:
   1. Create the file with proper path
   2. Implement the code as specified
   3. Run tests
   4. Commit changes
   5. Move to next file
   ```

3. **Testing Pattern**:
   ```bash
   # After each major component:
   npm test -- <test-file-name>
   
   # Before moving to next phase:
   npm test
   ```

4. **Git Workflow**:
   ```bash
   # After each day's work:
   git add .
   git commit -m "Phase X Day Y: <description>"
   
   # After each phase:
   git push origin feature/semantic-gantt-validation-dev
   ```

5. **Checkpoints**:
   - End of Phase 1: All schemas and base services working
   - End of Phase 2: Complete validation pipeline functional
   - End of Phase 3: Quality gates and repair working
   - End of Phase 4: Full E2E flow operational
   - End of Phase 5: System production-ready

### Success Criteria

✅ **Phase 1 Complete When**:
- All Zod schemas pass validation
- ResearchValidationService and TaskClaimExtractor functional
- Integration tests passing

✅ **Phase 2 Complete When**:
- All validation components (Citation, Contradiction, Provenance, Confidence) working
- ValidationPipeline integrates all components
- Claims are correctly validated

✅ **Phase 3 Complete When**:
- All quality gates functional
- Repair engine can fix common issues
- Quality gate pass rate >95%

✅ **Phase 4 Complete When**:
- Orchestrator coordinates all services
- API endpoints functional
- E2E tests passing

✅ **Phase 5 Complete When**:
- Monitoring system operational
- Performance meets targets (<1s per task validation)
- Documentation complete

---

## 🚨 CRITICAL REMINDERS

1. **Always Run Tests**: Test after every component
2. **Follow Schema Strictly**: Use Zod validation everywhere
3. **Log Everything**: Comprehensive logging for debugging
4. **Handle Errors Gracefully**: Try-catch all async operations
5. **Document Decisions**: Update implementation-log.md daily
6. **Keep Commits Atomic**: Small, focused commits
7. **Backward Compatibility**: Don't break existing functionality

---

## 📞 SUPPORT & ESCALATION

If you encounter:
- **Blocking issues**: Document in `/docs/blockers.md`
- **Design questions**: Document in `/docs/decisions.md`
- **Test failures**: Document in `/docs/test-failures.md`

---

**Ready to start? Begin with Phase 0: Environment Setup & Discovery!**
