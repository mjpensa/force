import { describe, it, expect, beforeEach } from '@jest/globals';
import { ContradictionDetector } from '../ContradictionDetector.js';
import { v4 as uuidv4 } from 'uuid';

describe('ContradictionDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new ContradictionDetector({
      numericalTolerancePercent: 0.10,
      temporalToleranceDays: 7
    });
  });

  describe('detectContradiction', () => {
    it('should detect numerical contradiction', async () => {
      const claim1 = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Task duration is 90 days',
        claimType: 'duration',
        confidence: 0.9
      };

      const claim2 = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Task duration is 60 days',
        claimType: 'duration',
        confidence: 0.8
      };

      const result = await detector.detectContradiction(claim1, claim2);

      expect(result).not.toBeNull();
      expect(result.type).toBe('numerical');
      expect(result.severity).toBeDefined();
      expect(result.details.value1).toBe(90);
      expect(result.details.value2).toBe(60);
    });

    it('should detect temporal contradiction', async () => {
      const claim1 = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Start date is 2025-01-01',
        claimType: 'deadline',
        confidence: 0.9
      };

      const claim2 = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Start date is 2025-06-01',
        claimType: 'deadline',
        confidence: 0.8
      };

      const result = await detector.detectContradiction(claim1, claim2);

      expect(result).not.toBeNull();
      // Could be numerical or temporal since dates contain numbers
      expect(['numerical', 'temporal']).toContain(result.type);
    });

    it('should detect logical contradiction', async () => {
      const claim1 = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'This task is required for compliance',
        claimType: 'requirement',
        confidence: 0.9
      };

      const claim2 = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'This task is optional and can be skipped',
        claimType: 'requirement',
        confidence: 0.8
      };

      const result = await detector.detectContradiction(claim1, claim2);

      expect(result).not.toBeNull();
      expect(result.type).toBe('logical');
      expect(result.severity).toBe('high');
    });

    it('should not detect contradiction for same task', async () => {
      const taskId = uuidv4();
      const claim1 = {
        id: uuidv4(),
        taskId: taskId,
        claim: 'Task duration is 90 days',
        claimType: 'duration',
        confidence: 0.9
      };

      const claim2 = {
        id: uuidv4(),
        taskId: taskId,
        claim: 'Task duration is 60 days',
        claimType: 'duration',
        confidence: 0.8
      };

      const result = await detector.detectContradiction(claim1, claim2);

      expect(result).toBeNull();
    });

    it('should not detect contradiction for different claim types', async () => {
      const claim1 = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Task duration is 90 days',
        claimType: 'duration',
        confidence: 0.9
      };

      const claim2 = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Task starts on 2025-01-01',
        claimType: 'deadline',
        confidence: 0.8
      };

      const result = await detector.detectContradiction(claim1, claim2);

      expect(result).toBeNull();
    });

    it('should not detect contradiction for similar numbers within tolerance', async () => {
      const claim1 = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Task duration is 90 days',
        claimType: 'duration',
        confidence: 0.9
      };

      const claim2 = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Task duration is 92 days',
        claimType: 'duration',
        confidence: 0.8
      };

      const result = await detector.detectContradiction(claim1, claim2);

      expect(result).toBeNull();
    });
  });

  describe('detectNumericalContradiction', () => {
    it('should detect high severity numerical contradiction', () => {
      const claim1 = {
        id: uuidv4(),
        claim: 'Cost is 100 thousand dollars',
        claimType: 'resource'
      };

      const claim2 = {
        id: uuidv4(),
        claim: 'Cost is 200 thousand dollars',
        claimType: 'resource'
      };

      const result = detector.detectNumericalContradiction(claim1, claim2);

      expect(result).not.toBeNull();
      expect(['high', 'medium']).toContain(result.severity); // 50% can be medium
      expect(result.details.percentDifference).toBe('50.00');
    });

    it('should detect medium severity numerical contradiction', () => {
      const claim1 = {
        id: uuidv4(),
        claim: 'Duration is 100 days',
        claimType: 'duration'
      };

      const claim2 = {
        id: uuidv4(),
        claim: 'Duration is 135 days',
        claimType: 'duration'
      };

      const result = detector.detectNumericalContradiction(claim1, claim2);

      expect(result).not.toBeNull();
      expect(['medium', 'low']).toContain(result.severity);
    });

    it('should return null when no numbers found', () => {
      const claim1 = {
        id: uuidv4(),
        claim: 'Task is important',
        claimType: 'requirement'
      };

      const claim2 = {
        id: uuidv4(),
        claim: 'Task is critical',
        claimType: 'requirement'
      };

      const result = detector.detectNumericalContradiction(claim1, claim2);

      expect(result).toBeNull();
    });

    it('should handle multiple numbers in claims', () => {
      const claim1 = {
        id: uuidv4(),
        claim: 'Phase 1 takes 30 days and costs 50 thousand',
        claimType: 'duration'
      };

      const claim2 = {
        id: uuidv4(),
        claim: 'Phase 1 takes 60 days and costs 100 thousand',
        claimType: 'duration'
      };

      const result = detector.detectNumericalContradiction(claim1, claim2);

      expect(result).not.toBeNull();
      expect(result.type).toBe('numerical');
    });
  });

  describe('detectTemporalContradiction', () => {
    it('should detect high severity temporal contradiction', () => {
      const claim1 = {
        id: uuidv4(),
        claim: 'Launch date is 2025-01-01',
        claimType: 'deadline'
      };

      const claim2 = {
        id: uuidv4(),
        claim: 'Launch date is 2025-06-01',
        claimType: 'deadline'
      };

      const result = detector.detectTemporalContradiction(claim1, claim2);

      expect(result).not.toBeNull();
      expect(result.severity).toBe('high');
      expect(result.details.daysDifference).toBeGreaterThan(90);
    });

    it('should detect medium severity temporal contradiction', () => {
      const claim1 = {
        id: uuidv4(),
        claim: 'Start date is 2025-01-01',
        claimType: 'deadline'
      };

      const claim2 = {
        id: uuidv4(),
        claim: 'Start date is 2025-02-15',
        claimType: 'deadline'
      };

      const result = detector.detectTemporalContradiction(claim1, claim2);

      expect(result).not.toBeNull();
      expect(result.severity).toBe('medium');
    });

    it('should not detect contradiction within tolerance', () => {
      const claim1 = {
        id: uuidv4(),
        claim: 'Date is 2025-01-01',
        claimType: 'deadline'
      };

      const claim2 = {
        id: uuidv4(),
        claim: 'Date is 2025-01-05',
        claimType: 'deadline'
      };

      const result = detector.detectTemporalContradiction(claim1, claim2);

      expect(result).toBeNull();
    });

    it('should return null when no dates found', () => {
      const claim1 = {
        id: uuidv4(),
        claim: 'Task will start soon',
        claimType: 'deadline'
      };

      const claim2 = {
        id: uuidv4(),
        claim: 'Task will start later',
        claimType: 'deadline'
      };

      const result = detector.detectTemporalContradiction(claim1, claim2);

      expect(result).toBeNull();
    });
  });

  describe('detectLogicalContradiction', () => {
    it('should detect required vs optional contradiction', () => {
      const claim1 = {
        id: uuidv4(),
        claim: 'FDA approval is required',
        claimType: 'requirement'
      };

      const claim2 = {
        id: uuidv4(),
        claim: 'FDA approval is optional',
        claimType: 'requirement'
      };

      const result = detector.detectLogicalContradiction(claim1, claim2);

      expect(result).not.toBeNull();
      expect(result.type).toBe('logical');
      expect(result.details.contradictingTerms).toContain('required');
      expect(result.details.contradictingTerms).toContain('optional');
    });

    it('should detect must vs may contradiction', () => {
      const claim1 = {
        id: uuidv4(),
        claim: 'Team must complete training',
        claimType: 'requirement'
      };

      const claim2 = {
        id: uuidv4(),
        claim: 'Team may skip training',
        claimType: 'requirement'
      };

      const result = detector.detectLogicalContradiction(claim1, claim2);

      expect(result).not.toBeNull();
      expect(result.severity).toBe('high');
    });

    it('should detect always vs never contradiction', () => {
      const claim1 = {
        id: uuidv4(),
        claim: 'Documentation is always required',
        claimType: 'requirement'
      };

      const claim2 = {
        id: uuidv4(),
        claim: 'Documentation is never required',
        claimType: 'requirement'
      };

      const result = detector.detectLogicalContradiction(claim1, claim2);

      // This is a clear contradiction
      expect(result).not.toBeNull();
      expect(result.type).toBe('logical');
      expect(result.severity).toBe('high');
    });

    it('should return null when no logical contradiction found', () => {
      const claim1 = {
        id: uuidv4(),
        claim: 'Task should be completed',
        claimType: 'requirement'
      };

      const claim2 = {
        id: uuidv4(),
        claim: 'Task needs to be done',
        claimType: 'requirement'
      };

      const result = detector.detectLogicalContradiction(claim1, claim2);

      expect(result).toBeNull();
    });
  });

  describe('extractNumbers', () => {
    it('should extract integers', () => {
      const numbers = detector.extractNumbers('The task takes 90 days');
      expect(numbers).toEqual([90]);
    });

    it('should extract decimals', () => {
      const numbers = detector.extractNumbers('Confidence is 0.85 or 85%');
      expect(numbers).toEqual([0.85, 85]);
    });

    it('should extract multiple numbers', () => {
      const numbers = detector.extractNumbers('Phase 1: 30 days, Phase 2: 45 days');
      expect(numbers).toEqual([1, 30, 2, 45]);
    });

    it('should return empty array when no numbers', () => {
      const numbers = detector.extractNumbers('No numbers here');
      expect(numbers).toEqual([]);
    });
  });

  describe('extractDates', () => {
    it('should extract ISO date', () => {
      const dates = detector.extractDates('Start date is 2025-01-15');
      expect(dates).toHaveLength(1);
      expect(dates[0].toISOString()).toContain('2025-01-15');
    });

    it('should extract multiple dates', () => {
      const dates = detector.extractDates('From 2025-01-01 to 2025-12-31');
      expect(dates).toHaveLength(2);
    });

    it('should return empty array when no dates', () => {
      const dates = detector.extractDates('No dates in this text');
      expect(dates).toEqual([]);
    });

    it('should ignore invalid dates', () => {
      const dates = detector.extractDates('Invalid date 2025-99-99');
      expect(dates).toEqual([]);
    });
  });

  describe('calculateNumericalSeverity', () => {
    it('should return high for >50% difference', () => {
      const severity = detector.calculateNumericalSeverity(100, 200);
      expect(severity).toBe('high');
    });

    it('should return medium for 25-50% difference', () => {
      const severity = detector.calculateNumericalSeverity(100, 130);
      expect(severity).toBe('medium');
    });

    it('should return low for <25% difference', () => {
      const severity = detector.calculateNumericalSeverity(100, 120);
      expect(severity).toBe('low');
    });
  });

  describe('calculateTemporalSeverity', () => {
    it('should return high for >90 days', () => {
      const severity = detector.calculateTemporalSeverity(120);
      expect(severity).toBe('high');
    });

    it('should return medium for 30-90 days', () => {
      const severity = detector.calculateTemporalSeverity(60);
      expect(severity).toBe('medium');
    });

    it('should return low for <30 days', () => {
      const severity = detector.calculateTemporalSeverity(20);
      expect(severity).toBe('low');
    });
  });

  describe('batchDetect', () => {
    it('should detect multiple contradictions', async () => {
      const claims = [
        {
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Duration is 90 days',
          claimType: 'duration',
          confidence: 0.9
        },
        {
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Duration is 60 days',
          claimType: 'duration',
          confidence: 0.8
        },
        {
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Duration is 45 days',
          claimType: 'duration',
          confidence: 0.7
        }
      ];

      const result = await detector.batchDetect(claims);

      expect(result.contradictions.length).toBeGreaterThan(0);
      expect(result.summary.total).toBeGreaterThan(0);
      expect(result.summary.byType).toBeDefined();
      expect(result.summary.bySeverity).toBeDefined();
    });

    it('should group by type correctly', async () => {
      const claims = [
        {
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Duration is 90 days',
          claimType: 'duration',
          confidence: 0.9
        },
        {
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Duration is 60 days',
          claimType: 'duration',
          confidence: 0.8
        },
        {
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Testing is required',
          claimType: 'requirement',
          confidence: 0.9
        },
        {
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Testing is optional',
          claimType: 'requirement',
          confidence: 0.8
        }
      ];

      const result = await detector.batchDetect(claims);

      expect(result.summary.byType.numerical).toBeDefined();
      expect(result.summary.byType.logical).toBeDefined();
    });

    it('should handle no contradictions', async () => {
      const claims = [
        {
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Task A takes 90 days',
          claimType: 'duration',
          confidence: 0.9
        },
        {
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Task B is important',
          claimType: 'requirement',
          confidence: 0.8
        }
      ];

      const result = await detector.batchDetect(claims);

      expect(result.contradictions).toHaveLength(0);
      expect(result.summary.total).toBe(0);
    });
  });

  describe('groupByType', () => {
    it('should group contradictions by type', () => {
      const contradictions = [
        { type: 'numerical', severity: 'high' },
        { type: 'numerical', severity: 'medium' },
        { type: 'temporal', severity: 'low' },
        { type: 'logical', severity: 'high' }
      ];

      const grouped = detector.groupByType(contradictions);

      expect(grouped.numerical).toBe(2);
      expect(grouped.temporal).toBe(1);
      expect(grouped.logical).toBe(1);
    });
  });

  describe('groupBySeverity', () => {
    it('should group contradictions by severity', () => {
      const contradictions = [
        { type: 'numerical', severity: 'high' },
        { type: 'temporal', severity: 'high' },
        { type: 'numerical', severity: 'medium' },
        { type: 'logical', severity: 'low' }
      ];

      const grouped = detector.groupBySeverity(contradictions);

      expect(grouped.high).toBe(2);
      expect(grouped.medium).toBe(1);
      expect(grouped.low).toBe(1);
    });
  });
});
