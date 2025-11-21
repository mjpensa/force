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

  getContradiction(id) {
    return this.contradictions.get(id);
  }

  getAllClaims() {
    return Array.from(this.claims.values());
  }

  getAllContradictions() {
    return Array.from(this.contradictions.values());
  }

  export() {
    return {
      claims: Array.from(this.claims.values()),
      contradictions: Array.from(this.contradictions.values())
    };
  }

  clear() {
    this.claims.clear();
    this.contradictions.clear();
  }

  size() {
    return {
      claims: this.claims.size,
      contradictions: this.contradictions.size
    };
  }
}
