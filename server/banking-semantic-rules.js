/**
 * Banking-Specific Semantic Rules Engine
 *
 * Domain-specific inference rules for banking projects:
 * - Regulatory deadline patterns (OCC, FDIC, Federal Reserve)
 * - Standard phase durations (vendor assessment, UAT, integration)
 * - Risk keyword detection (legacy, mainframe, compliance)
 * - Auto-flagging regulatory tasks
 */

// ═══════════════════════════════════════════════════════════
// REGULATORY TIMELINE RULES
// ═══════════════════════════════════════════════════════════

/**
 * Standard regulatory review periods
 * Based on documented banking industry practices
 */
export const BANKING_RULES = {
  // Regulatory approval timelines (in days)
  regulatory_deadlines: {
    'OCC': { reviewDays: 45, confidence: 0.90, description: 'Office of the Comptroller of the Currency' },
    'FDIC': { reviewDays: 60, confidence: 0.85, description: 'Federal Deposit Insurance Corporation' },
    'Federal Reserve': { reviewDays: 90, confidence: 0.80, description: 'Federal Reserve Board' },
    'State Banking': { reviewDays: 30, confidence: 0.75, description: 'State Banking Commission' },
    'CFPB': { reviewDays: 60, confidence: 0.80, description: 'Consumer Financial Protection Bureau' },
    'FinCEN': { reviewDays: 45, confidence: 0.85, description: 'Financial Crimes Enforcement Network' }
  },

  // Standard banking project phases (duration + confidence)
  standard_phases: {
    'vendor assessment': { duration: 45, unit: 'days', confidence: 0.80 },
    'vendor onboarding': { duration: 3, unit: 'months', confidence: 0.75 },
    'compliance review': { duration: 6, unit: 'weeks', confidence: 0.85 },
    'regulatory submission': { duration: 4, unit: 'weeks', confidence: 0.80 },
    'UAT': { duration: 2, unit: 'months', confidence: 0.90 },
    'user acceptance testing': { duration: 2, unit: 'months', confidence: 0.90 },
    'core integration': { duration: 4, unit: 'months', confidence: 0.75 },
    'core banking integration': { duration: 4, unit: 'months', confidence: 0.75 },
    'system integration': { duration: 3, unit: 'months', confidence: 0.80 },
    'data migration': { duration: 3, unit: 'months', confidence: 0.70 },
    'security assessment': { duration: 6, unit: 'weeks', confidence: 0.85 },
    'penetration testing': { duration: 2, unit: 'weeks', confidence: 0.90 },
    'go-live preparation': { duration: 4, unit: 'weeks', confidence: 0.85 },
    'cutover': { duration: 1, unit: 'weeks', confidence: 0.80 },
    'post-production support': { duration: 3, unit: 'months', confidence: 0.85 }
  },

  // Risk indicators that warrant additional scrutiny
  risk_keywords: [
    'legacy system',
    'mainframe',
    'COBOL',
    'AS400',
    'data migration',
    'customer impact',
    'downtime',
    'first time',
    'untested',
    'new technology',
    'third party',
    'vendor dependency',
    'manual process',
    'workaround'
  ],

  // Compliance/regulatory keywords for auto-flagging
  compliance_keywords: [
    'OCC',
    'FDIC',
    'Federal Reserve',
    'CFPB',
    'FinCEN',
    'SOX',
    'Sarbanes-Oxley',
    'Basel',
    'Dodd-Frank',
    'GLBA',
    'Gramm-Leach-Bliley',
    'BSA',
    'Bank Secrecy Act',
    'AML',
    'Anti-Money Laundering',
    'KYC',
    'Know Your Customer',
    'CIP',
    'Customer Identification',
    'OFAC',
    'sanctions',
    'compliance',
    'regulatory',
    'audit',
    'examination'
  ]
};

// ═══════════════════════════════════════════════════════════
// RULE APPLICATION FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Applies banking-specific rules to enhance task metadata
 * @param {Object} task - Task to enhance
 * @returns {Object} Enhanced task with banking metadata
 */
export function applyBankingRules(task) {
  const enhancements = {
    regulatoryBuffer: null,
    suggestedDuration: null,
    riskFlag: null,
    complianceFlag: null
  };

  const taskNameLower = task.name.toLowerCase();

  // 1. Check for regulatory deadlines
  for (const [regulator, rules] of Object.entries(BANKING_RULES.regulatory_deadlines)) {
    if (taskNameLower.includes(regulator.toLowerCase())) {
      enhancements.regulatoryBuffer = {
        regulator,
        days: rules.reviewDays,
        confidence: rules.confidence,
        note: `Standard ${regulator} review period: ${rules.reviewDays} days`
      };

      // Auto-flag as regulatory requirement if not already set
      if (!task.regulatoryRequirement) {
        task.regulatoryRequirement = {
          isRequired: true,
          regulation: regulator,
          deadline: task.endDate?.value || null,
          origin: 'inferred',
          confidence: rules.confidence
        };
      }
    }
  }

  // 2. Suggest standard phase durations (if not explicit)
  if (task.origin === 'inferred' || !task.duration?.origin || task.duration.origin === 'inferred') {
    for (const [phase, timing] of Object.entries(BANKING_RULES.standard_phases)) {
      if (taskNameLower.includes(phase)) {
        enhancements.suggestedDuration = {
          value: timing.duration,
          unit: timing.unit,
          confidence: timing.confidence,
          source: 'Banking industry standard',
          note: `Typical ${phase} duration: ${timing.duration} ${timing.unit}`
        };

        // Update task duration if confidence is higher
        if (task.duration && task.duration.confidence < timing.confidence) {
          task.duration.value = timing.duration;
          task.duration.unit = timing.unit;
          task.duration.confidence = timing.confidence;
        }
      }
    }
  }

  // 3. Flag high-risk items
  const hasRiskIndicator = BANKING_RULES.risk_keywords.some(keyword =>
    taskNameLower.includes(keyword)
  );

  if (hasRiskIndicator) {
    enhancements.riskFlag = {
      level: 'high',
      keywords: BANKING_RULES.risk_keywords.filter(k => taskNameLower.includes(k)),
      suggestion: 'Add 20-30% contingency buffer for risk mitigation',
      confidence: 0.70
    };
  }

  // 4. Flag compliance/regulatory tasks
  const hasComplianceKeyword = BANKING_RULES.compliance_keywords.some(keyword =>
    taskNameLower.includes(keyword.toLowerCase())
  );

  if (hasComplianceKeyword) {
    enhancements.complianceFlag = {
      detected: true,
      keywords: BANKING_RULES.compliance_keywords.filter(k =>
        taskNameLower.includes(k.toLowerCase())
      ),
      note: 'Task has regulatory/compliance implications',
      confidence: 0.85
    };
  }

  // Attach enhancements to task
  if (Object.values(enhancements).some(v => v !== null)) {
    task.bankingEnhancements = enhancements;
  }

  return task;
}

/**
 * Detects specific regulation from task name
 * @param {string} taskName - Task name to analyze
 * @returns {string} Detected regulation name or 'General Compliance'
 */
export function detectRegulation(taskName) {
  const regulations = {
    'occ': 'OCC',
    'office of the comptroller': 'OCC',
    'fdic': 'FDIC',
    'federal deposit insurance': 'FDIC',
    'basel': 'Basel III',
    'sox': 'SOX',
    'sarbanes': 'SOX',
    'sarbanes-oxley': 'SOX',
    'dodd-frank': 'Dodd-Frank',
    'dodd frank': 'Dodd-Frank',
    'glba': 'GLBA',
    'gramm-leach-bliley': 'GLBA',
    'bsa': 'BSA',
    'bank secrecy act': 'BSA',
    'aml': 'AML',
    'anti-money laundering': 'AML',
    'kyc': 'KYC',
    'know your customer': 'KYC',
    'cfpb': 'CFPB',
    'consumer financial protection': 'CFPB',
    'fincen': 'FinCEN',
    'federal reserve': 'Federal Reserve',
    'ofac': 'OFAC'
  };

  const lower = taskName.toLowerCase();
  for (const [key, value] of Object.entries(regulations)) {
    if (lower.includes(key)) {
      return value;
    }
  }

  return 'General Compliance';
}

/**
 * Calculates suggested buffer time based on risk level
 * @param {Object} task - Task to analyze
 * @returns {Object|null} Buffer recommendation
 */
export function calculateRiskBuffer(task) {
  if (!task.bankingEnhancements?.riskFlag) {
    return null;
  }

  const riskLevel = task.bankingEnhancements.riskFlag.level;
  const baseDuration = task.duration?.value || 0;
  const unit = task.duration?.unit || 'days';

  let bufferPercentage = 0;
  let confidence = 0;

  switch (riskLevel) {
    case 'critical':
      bufferPercentage = 0.50; // 50% buffer
      confidence = 0.85;
      break;
    case 'high':
      bufferPercentage = 0.30; // 30% buffer
      confidence = 0.80;
      break;
    case 'medium':
      bufferPercentage = 0.20; // 20% buffer
      confidence = 0.75;
      break;
    case 'low':
      bufferPercentage = 0.10; // 10% buffer
      confidence = 0.70;
      break;
    default:
      return null;
  }

  const bufferValue = Math.ceil(baseDuration * bufferPercentage);
  const newDuration = baseDuration + bufferValue;

  return {
    originalDuration: baseDuration,
    bufferValue,
    newDuration,
    unit,
    bufferPercentage: Math.round(bufferPercentage * 100),
    confidence,
    rationale: `${riskLevel.toUpperCase()} risk detected - added ${Math.round(bufferPercentage * 100)}% contingency`
  };
}

/**
 * Generates regulatory checkpoint from task
 * @param {Object} task - Task with regulatory requirement
 * @returns {Object|null} Regulatory checkpoint object
 */
export function generateRegulatoryCheckpoint(task) {
  if (!task.regulatoryRequirement || !task.regulatoryRequirement.isRequired) {
    return null;
  }

  return {
    id: `REG-${task.id}`,
    regulation: task.regulatoryRequirement.regulation || detectRegulation(task.name),
    deadline: task.regulatoryRequirement.deadline || task.endDate?.value || null,
    taskIds: [task.id],
    origin: task.regulatoryRequirement.origin || 'inferred',
    confidence: task.regulatoryRequirement.confidence || 0.75,
    citation: task.sourceCitations?.[0] || null
  };
}

/**
 * Analyzes entire project for banking-specific insights
 * @param {Array} tasks - All project tasks
 * @returns {Object} Banking insights summary
 */
export function analyzeBankingProject(tasks) {
  const insights = {
    regulatoryTasks: [],
    highRiskTasks: [],
    complianceTasks: [],
    totalRegulatoryDays: 0,
    criticalPath: [],
    recommendations: []
  };

  tasks.forEach(task => {
    // Collect regulatory tasks
    if (task.regulatoryRequirement?.isRequired) {
      insights.regulatoryTasks.push({
        id: task.id,
        name: task.name,
        regulation: task.regulatoryRequirement.regulation,
        deadline: task.regulatoryRequirement.deadline
      });

      // Add to total regulatory timeline
      if (task.bankingEnhancements?.regulatoryBuffer) {
        insights.totalRegulatoryDays += task.bankingEnhancements.regulatoryBuffer.days;
      }
    }

    // Collect high-risk tasks
    if (task.bankingEnhancements?.riskFlag?.level === 'high') {
      insights.highRiskTasks.push({
        id: task.id,
        name: task.name,
        keywords: task.bankingEnhancements.riskFlag.keywords
      });
    }

    // Collect compliance tasks
    if (task.bankingEnhancements?.complianceFlag?.detected) {
      insights.complianceTasks.push({
        id: task.id,
        name: task.name,
        keywords: task.bankingEnhancements.complianceFlag.keywords
      });
    }
  });

  // Generate recommendations
  if (insights.regulatoryTasks.length > 0) {
    insights.recommendations.push({
      type: 'regulatory',
      message: `${insights.regulatoryTasks.length} tasks require regulatory approval. Total estimated review time: ${insights.totalRegulatoryDays} days. Plan accordingly.`,
      priority: 'high'
    });
  }

  if (insights.highRiskTasks.length > 0) {
    insights.recommendations.push({
      type: 'risk',
      message: `${insights.highRiskTasks.length} high-risk tasks detected. Consider adding 20-30% contingency buffer.`,
      priority: 'high'
    });
  }

  if (insights.complianceTasks.length > 3) {
    insights.recommendations.push({
      type: 'compliance',
      message: `Significant compliance requirements detected (${insights.complianceTasks.length} tasks). Ensure compliance team involvement.`,
      priority: 'medium'
    });
  }

  return insights;
}

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Checks if task is banking/financial industry related
 * @param {Object} task - Task to check
 * @returns {boolean} True if banking-related
 */
export function isBankingTask(task) {
  const bankingKeywords = [
    'bank', 'financial', 'regulatory', 'compliance', 'occ', 'fdic',
    'federal reserve', 'audit', 'sox', 'basel', 'aml', 'kyc',
    'core banking', 'payment', 'transaction', 'account', 'lending'
  ];

  const taskText = `${task.name} ${task.description || ''}`.toLowerCase();
  return bankingKeywords.some(keyword => taskText.includes(keyword));
}

/**
 * Converts duration to days for timeline calculations
 * @param {number} value - Duration value
 * @param {string} unit - Time unit (days, weeks, months, years)
 * @returns {number} Duration in days
 */
export function convertToDays(value, unit) {
  const conversions = {
    'days': 1,
    'weeks': 7,
    'months': 30,
    'years': 365
  };

  return value * (conversions[unit] || 1);
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

export default {
  BANKING_RULES,
  applyBankingRules,
  detectRegulation,
  calculateRiskBuffer,
  generateRegulatoryCheckpoint,
  analyzeBankingProject,
  isBankingTask,
  convertToDays
};
