# Implementation Plan: Correlated Feedback Simulation

## Problem Statement

The current `calculateRealisticFeedback()` function generates random feedback that doesn't correlate with actual content quality scores. This means a perfectly scored response (5.0) might receive poor simulated user feedback (rating: 2), while a low-quality response (1.5) might receive excellent feedback (rating: 5). This noise undermines the training signal.

## Current State

```javascript
// Current implementation - pure randomness
const feedback = {
  rating: Math.floor(Math.random() * 5) + 1,  // 1-5, no quality correlation
  wasExported: Math.random() > 0.7,           // 30% chance, no correlation
  wasEdited: Math.random() > 0.6,             // 40% chance, no correlation
  wasRegenerated: Math.random() > 0.85,       // 15% chance, no correlation
  thumbsUp: Math.random() > 0.5 ? (Math.random() > 0.3) : null
};
```

## Goal

Create a feedback simulation that realistically models how users would respond to content of varying quality, where high-quality content receives better feedback on average.

---

## Phase 1: Quality-Correlated Rating

### Objective
Make the `rating` field correlate with the quality score while maintaining realistic variance.

### Implementation

```javascript
function calculateCorrelatedRating(qualityScore) {
  // Base rating maps quality score (1-5) to expected rating
  const baseRating = qualityScore;

  // Add realistic variance: users don't perfectly assess quality
  // Standard deviation of ~0.8 feels realistic
  const variance = gaussianRandom(0, 0.8);

  // Clamp to valid range
  const rating = Math.round(Math.min(5, Math.max(1, baseRating + variance)));

  return rating;
}

function gaussianRandom(mean, stdDev) {
  // Box-Muller transform for normal distribution
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}
```

### Validation
- Generate 1000 samples at each quality level (1-5)
- Verify mean rating is within 0.3 of quality score
- Verify standard deviation is 0.7-0.9

---

## Phase 2: Behavioral Signal Correlation

### Objective
Make export, edit, and regenerate behaviors correlate with quality.

### Implementation

```javascript
function calculateBehavioralSignals(qualityScore) {
  // Export probability increases with quality
  // Low quality (1): ~5% export, High quality (5): ~50% export
  const exportProb = 0.05 + (qualityScore - 1) * 0.1125;
  const wasExported = Math.random() < exportProb;

  // Edit probability decreases with quality (inverse correlation)
  // Low quality (1): ~70% edit, High quality (5): ~10% edit
  const editProb = 0.7 - (qualityScore - 1) * 0.15;
  const wasEdited = Math.random() < editProb;

  // Regenerate probability strongly decreases with quality
  // Low quality (1): ~60% regenerate, High quality (5): ~5% regenerate
  const regenProb = 0.6 - (qualityScore - 1) * 0.1375;
  const wasRegenerated = Math.random() < regenProb;

  return { wasExported, wasEdited, wasRegenerated };
}
```

### Probability Curves

| Quality Score | Export % | Edit % | Regenerate % |
|---------------|----------|--------|--------------|
| 1.0           | 5%       | 70%    | 60%          |
| 2.0           | 16%      | 55%    | 46%          |
| 3.0           | 28%      | 40%    | 32%          |
| 4.0           | 39%      | 25%    | 19%          |
| 5.0           | 50%      | 10%    | 5%           |

---

## Phase 3: Thumbs Up/Down Correlation

### Objective
Make thumbs feedback correlate with quality, including realistic "no feedback" scenarios.

### Implementation

```javascript
function calculateThumbsFeedback(qualityScore) {
  // Probability of giving any thumbs feedback
  // Users more likely to give feedback on extreme quality
  const extremity = Math.abs(qualityScore - 3) / 2;  // 0-1 scale
  const feedbackProb = 0.3 + extremity * 0.4;  // 30-70% chance

  if (Math.random() > feedbackProb) {
    return null;  // No feedback given
  }

  // If giving feedback, thumbs up probability scales with quality
  // Quality 1: ~10% thumbs up, Quality 5: ~95% thumbs up
  const thumbsUpProb = 0.1 + (qualityScore - 1) * 0.2125;
  return Math.random() < thumbsUpProb;
}
```

---

## Phase 4: Content-Type Behavioral Modifiers

### Objective
Different content types have different user behavior patterns.

### Implementation

```javascript
const CONTENT_TYPE_MODIFIERS = {
  Roadmap: {
    exportMultiplier: 1.3,    // Roadmaps are often exported
    editMultiplier: 0.8,      // Less text editing needed
    regenMultiplier: 1.2      // Visual issues trigger regeneration
  },
  Slides: {
    exportMultiplier: 1.5,    // Slides almost always exported
    editMultiplier: 1.2,      // Often need text tweaks
    regenMultiplier: 0.9      // Users tolerate minor issues
  },
  Document: {
    exportMultiplier: 1.0,    // Baseline
    editMultiplier: 1.4,      // Documents heavily edited
    regenMultiplier: 0.7      // Easier to edit than regenerate
  },
  ResearchAnalysis: {
    exportMultiplier: 0.8,    // Often consumed in-app
    editMultiplier: 0.6,      // Less editable
    regenMultiplier: 1.3      // Wrong insights = regenerate
  }
};

function applyContentTypeModifiers(signals, contentType) {
  const mods = CONTENT_TYPE_MODIFIERS[contentType] || {};
  // Apply modifiers (recalculate with modified probabilities)
  return signals;
}
```

---

## Phase 5: Composite Feedback Function

### Objective
Combine all correlation logic into a unified function.

### Implementation

```javascript
export function calculateRealisticFeedback(qualityScore, contentType) {
  // Ensure valid quality score
  const score = Math.max(1, Math.min(5, qualityScore || 3));

  // Calculate correlated values
  const rating = calculateCorrelatedRating(score);
  const behaviors = calculateBehavioralSignals(score);
  const modifiedBehaviors = applyContentTypeModifiers(behaviors, contentType);
  const thumbsUp = calculateThumbsFeedback(score);

  return {
    rating,
    qualityScore: score,
    ...modifiedBehaviors,
    thumbsUp
  };
}
```

---

## Phase 6: Validation & Calibration

### Objective
Verify the correlation system produces realistic distributions.

### Implementation

```javascript
function validateFeedbackCorrelation() {
  const samples = 10000;
  const results = {};

  for (let quality = 1; quality <= 5; quality++) {
    results[quality] = {
      ratings: [],
      exports: 0,
      edits: 0,
      regenerations: 0,
      thumbsUp: 0,
      thumbsDown: 0,
      noThumbs: 0
    };

    for (let i = 0; i < samples; i++) {
      const feedback = calculateRealisticFeedback(quality, 'Document');
      results[quality].ratings.push(feedback.rating);
      if (feedback.wasExported) results[quality].exports++;
      if (feedback.wasEdited) results[quality].edits++;
      if (feedback.wasRegenerated) results[quality].regenerations++;
      if (feedback.thumbsUp === true) results[quality].thumbsUp++;
      if (feedback.thumbsUp === false) results[quality].thumbsDown++;
      if (feedback.thumbsUp === null) results[quality].noThumbs++;
    }

    // Calculate statistics
    const ratings = results[quality].ratings;
    results[quality].meanRating = ratings.reduce((a, b) => a + b) / ratings.length;
    results[quality].stdDev = Math.sqrt(
      ratings.reduce((sum, r) => sum + Math.pow(r - results[quality].meanRating, 2), 0) / ratings.length
    );
  }

  // Assert correlations
  console.log('Feedback Correlation Validation:');
  for (let q = 1; q <= 5; q++) {
    const r = results[q];
    console.log(`Quality ${q}: Mean Rating=${r.meanRating.toFixed(2)}, StdDev=${r.stdDev.toFixed(2)}`);
    console.log(`  Export=${(r.exports/samples*100).toFixed(1)}%, Edit=${(r.edits/samples*100).toFixed(1)}%, Regen=${(r.regenerations/samples*100).toFixed(1)}%`);
  }

  return results;
}
```

---

## Success Criteria

1. **Rating Correlation**: Pearson correlation coefficient > 0.85 between quality score and mean rating
2. **Behavioral Correlation**:
   - Export rate increases monotonically with quality
   - Edit/regenerate rates decrease monotonically with quality
3. **Realistic Variance**: Standard deviation of ratings = 0.7-0.9 at each quality level
4. **Training Signal Improvement**: Successful prompts should consistently outperform unsuccessful ones in feedback metrics

---

## Files to Modify

- `/server/routes/training.js` - Replace `calculateRealisticFeedback()` function
- `/server/utils/feedbackSimulation.js` - New file for feedback correlation logic

---

## Estimated Complexity

- Phase 1: Low (simple math)
- Phase 2: Low (probability curves)
- Phase 3: Low (conditional logic)
- Phase 4: Medium (requires domain knowledge calibration)
- Phase 5: Low (integration)
- Phase 6: Medium (statistical validation)
