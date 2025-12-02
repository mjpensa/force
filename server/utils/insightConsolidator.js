/**
 * Insight Consolidator
 * 
 * Merges insights from multiple chunks, deduplicates,
 * and creates a coherent consolidated context for generation.
 */

/**
 * Calculate similarity between two strings (simple word overlap)
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number} Similarity score 0-1
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const words1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) overlap++;
  }
  
  return overlap / Math.max(words1.size, words2.size);
}

/**
 * Deduplicate items based on a text field
 * @param {Array} items - Array of objects
 * @param {string} textField - Field to compare for similarity
 * @param {number} threshold - Similarity threshold (default 0.7)
 * @returns {Array} Deduplicated array
 */
function deduplicateByText(items, textField, threshold = 0.7) {
  if (!items || items.length === 0) return [];
  
  const unique = [];
  
  for (const item of items) {
    const text = item[textField];
    if (!text) continue;
    
    // Check if similar item already exists
    const isDuplicate = unique.some(existing => 
      calculateSimilarity(existing[textField], text) >= threshold
    );
    
    if (!isDuplicate) {
      unique.push(item);
    }
  }
  
  return unique;
}

/**
 * Merge and deduplicate key facts from all chunks
 * @param {Array<object>} allInsights - Array of extraction results
 * @returns {Array} Consolidated key facts
 */
function consolidateKeyFacts(allInsights) {
  const allFacts = [];
  
  for (const result of allInsights) {
    if (result.insights?.keyFacts) {
      allFacts.push(...result.insights.keyFacts);
    }
  }
  
  // Deduplicate - use VERY HIGH threshold (0.95) to preserve distinct items
  // Only merge near-identical facts to avoid losing task details
  const unique = deduplicateByText(allFacts, 'fact', 0.95);
  
  // Sort by importance
  const importanceOrder = { high: 0, medium: 1, low: 2 };
  unique.sort((a, b) => 
    (importanceOrder[a.importance] || 2) - (importanceOrder[b.importance] || 2)
  );
  
  return unique;
}

/**
 * Merge and deduplicate dates from all chunks
 * @param {Array<object>} allInsights 
 * @returns {Array} Consolidated dates
 */
function consolidateDates(allInsights) {
  const allDates = [];
  
  for (const result of allInsights) {
    if (result.insights?.dates) {
      allDates.push(...result.insights.dates);
    }
  }
  
  // Deduplicate by date + event combo - use VERY HIGH threshold (0.95)
  // to preserve distinct timeline events/tasks - only merge near-duplicates
  const unique = deduplicateByText(
    allDates.map(d => ({ ...d, _key: `${d.date} ${d.event}` })),
    '_key',
    0.95
  ).map(({ _key, ...rest }) => rest);
  
  return unique;
}

/**
 * Merge and deduplicate entities from all chunks
 * @param {Array<object>} allInsights 
 * @returns {Array} Consolidated entities
 */
function consolidateEntities(allInsights) {
  const entityMap = new Map();
  
  for (const result of allInsights) {
    if (result.insights?.entities) {
      for (const entity of result.insights.entities) {
        const key = entity.name?.toLowerCase();
        if (!key) continue;
        
        if (!entityMap.has(key)) {
          entityMap.set(key, { ...entity, mentions: 1 });
        } else {
          // Merge context, increment mentions
          const existing = entityMap.get(key);
          existing.mentions++;
          if (entity.context && (!existing.context || entity.context.length > existing.context.length)) {
            existing.context = entity.context;
          }
        }
      }
    }
  }
  
  // Sort by mentions (frequency)
  return [...entityMap.values()].sort((a, b) => b.mentions - a.mentions);
}

/**
 * Merge and deduplicate themes from all chunks
 * @param {Array<object>} allInsights 
 * @returns {Array} Consolidated themes
 */
function consolidateThemes(allInsights) {
  const themeMap = new Map();
  
  for (const result of allInsights) {
    if (result.insights?.themes) {
      for (const theme of result.insights.themes) {
        const key = theme.theme?.toLowerCase();
        if (!key) continue;
        
        if (!themeMap.has(key)) {
          themeMap.set(key, { ...theme, occurrences: 1 });
        } else {
          const existing = themeMap.get(key);
          existing.occurrences++;
          // Upgrade frequency if mentioned as primary in any chunk
          if (theme.frequency === 'primary') {
            existing.frequency = 'primary';
          }
        }
      }
    }
  }
  
  // Sort by frequency and occurrences
  const frequencyOrder = { primary: 0, secondary: 1, mentioned: 2 };
  return [...themeMap.values()].sort((a, b) => {
    const freqDiff = (frequencyOrder[a.frequency] || 2) - (frequencyOrder[b.frequency] || 2);
    if (freqDiff !== 0) return freqDiff;
    return b.occurrences - a.occurrences;
  });
}

/**
 * Merge and deduplicate metrics from all chunks
 * @param {Array<object>} allInsights 
 * @returns {Array} Consolidated metrics
 */
function consolidateMetrics(allInsights) {
  const allMetrics = [];
  
  for (const result of allInsights) {
    if (result.insights?.metrics) {
      allMetrics.push(...result.insights.metrics);
    }
  }
  
  // Deduplicate by value + context - use VERY HIGH threshold to preserve distinct metrics
  return deduplicateByText(
    allMetrics.map(m => ({ ...m, _key: `${m.value} ${m.context}` })),
    '_key',
    0.95
  ).map(({ _key, ...rest }) => rest);
}

/**
 * Merge and deduplicate recommendations from all chunks
 * @param {Array<object>} allInsights 
 * @returns {Array} Consolidated recommendations
 */
function consolidateRecommendations(allInsights) {
  const allRecs = [];
  
  for (const result of allInsights) {
    if (result.insights?.recommendations) {
      allRecs.push(...result.insights.recommendations);
    }
  }
  
  // Deduplicate - use VERY HIGH threshold (0.95) to preserve distinct recommendations
  const unique = deduplicateByText(allRecs, 'recommendation', 0.95);
  
  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  unique.sort((a, b) => 
    (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3)
  );
  
  return unique;
}

/**
 * Merge and deduplicate quotes from all chunks
 * @param {Array<object>} allInsights 
 * @returns {Array} Consolidated quotes
 */
function consolidateQuotes(allInsights) {
  const allQuotes = [];

  for (const result of allInsights) {
    if (result.insights?.quotes) {
      allQuotes.push(...result.insights.quotes);
    }
  }

  return deduplicateByText(allQuotes, 'quote', 0.8);
}

/**
 * Merge and deduplicate tasks from all chunks
 * @param {Array<object>} allInsights
 * @returns {Array} Consolidated tasks
 */
function consolidateTasks(allInsights) {
  const allTasks = [];

  for (const result of allInsights) {
    if (result.insights?.tasks) {
      allTasks.push(...result.insights.tasks);
    }
  }

  // Deduplicate by task name + entity combo - tasks with same name but different
  // entities/swimlanes should be preserved as distinct items
  const unique = deduplicateByText(
    allTasks.map(t => ({ ...t, _key: `${t.task} | ${t.entity || 'unknown'}` })),
    '_key',
    0.95
  ).map(({ _key, ...rest }) => rest);

  // Sort by type priority (milestones first, then decisions, then others)
  const typeOrder = { milestone: 0, decision: 1, phase: 2, project: 3, initiative: 4, activity: 5, task: 6 };
  unique.sort((a, b) =>
    (typeOrder[a.type] || 6) - (typeOrder[b.type] || 6)
  );

  return unique;
}

/**
 * Consolidate all insights from multiple extraction results
 * @param {Array<object>} allInsights - Array of extraction results from processChunksParallel
 * @returns {object} Consolidated insights
 */
export function consolidateInsights(allInsights) {
  if (!allInsights || allInsights.length === 0) {
    return {
      keyFacts: [],
      dates: [],
      entities: [],
      themes: [],
      metrics: [],
      recommendations: [],
      quotes: [],
      tasks: [],
      metadata: { chunksProcessed: 0, sourceFiles: [] }
    };
  }

  console.log(`[Consolidator] Consolidating insights from ${allInsights.length} chunks`);
  const startTime = Date.now();

  // Collect all source files
  const sourceFiles = new Set();
  for (const result of allInsights) {
    if (result.sourceFiles) {
      result.sourceFiles.forEach(f => sourceFiles.add(f));
    }
  }

  const consolidated = {
    keyFacts: consolidateKeyFacts(allInsights),
    dates: consolidateDates(allInsights),
    entities: consolidateEntities(allInsights),
    themes: consolidateThemes(allInsights),
    metrics: consolidateMetrics(allInsights),
    recommendations: consolidateRecommendations(allInsights),
    quotes: consolidateQuotes(allInsights),
    tasks: consolidateTasks(allInsights),
    metadata: {
      chunksProcessed: allInsights.length,
      sourceFiles: [...sourceFiles],
      consolidationTime: Date.now() - startTime
    }
  };

  console.log(`[Consolidator] Consolidated: ${consolidated.keyFacts.length} facts, ${consolidated.dates.length} dates, ${consolidated.entities.length} entities, ${consolidated.themes.length} themes, ${consolidated.tasks.length} tasks`);

  return consolidated;
}

/**
 * Format consolidated insights for roadmap generation
 * Emphasizes dates, milestones, and phases
 * @param {object} insights - Consolidated insights
 * @returns {string} Formatted context for prompt
 */
export function formatForRoadmap(insights) {
  const sections = [];

  sections.push('=== EXTRACTED RESEARCH INSIGHTS ===\n');

  // Tasks are CRITICAL for roadmaps - include ALL tasks first
  if (insights.tasks?.length > 0) {
    sections.push('## TASKS & ACTIVITIES (for Gantt chart rows)');
    for (const t of insights.tasks) {
      const timing = t.timing ? ` | Timing: ${t.timing}` : '';
      const entity = t.entity ? ` | Entity: ${t.entity}` : '';
      const desc = t.description ? ` - ${t.description}` : '';
      sections.push(`- [${t.type?.toUpperCase() || 'TASK'}] ${t.task}${desc}${entity}${timing}`);
    }
    sections.push('');
  }

  // Dates are critical for roadmaps
  if (insights.dates?.length > 0) {
    sections.push('## TIMELINE & MILESTONES');
    for (const d of insights.dates) {
      sections.push(`- ${d.date}: ${d.event} [${d.type || 'milestone'}]`);
    }
    sections.push('');
  }

  // Key facts provide context - include ALL facts to preserve task details
  if (insights.keyFacts?.length > 0) {
    sections.push('## KEY FACTS & FINDINGS');
    for (const f of insights.keyFacts) {
      sections.push(`- [${f.importance?.toUpperCase() || 'INFO'}] ${f.fact}`);
    }
    sections.push('');
  }

  // Themes inform phases
  if (insights.themes?.length > 0) {
    sections.push('## MAJOR THEMES');
    for (const t of insights.themes) {
      sections.push(`- ${t.theme}: ${t.description || ''} [${t.frequency}]`);
    }
    sections.push('');
  }

  // Recommendations inform actions
  if (insights.recommendations?.length > 0) {
    sections.push('## RECOMMENDATIONS');
    for (const r of insights.recommendations) {
      const timeframe = r.timeframe ? ` (${r.timeframe})` : '';
      sections.push(`- [${r.priority?.toUpperCase()}] ${r.recommendation}${timeframe}`);
    }
    sections.push('');
  }
  
  // Entities provide context - include ALL entities for complete swimlane data
  if (insights.entities?.length > 0) {
    sections.push('## KEY ENTITIES');
    for (const e of insights.entities) {
      sections.push(`- ${e.name} (${e.type}): ${e.context || ''}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Format consolidated insights for slides generation
 * Emphasizes key messages and high-impact facts
 * @param {object} insights - Consolidated insights
 * @returns {string} Formatted context for prompt
 */
export function formatForSlides(insights) {
  const sections = [];
  
  sections.push('=== EXTRACTED RESEARCH INSIGHTS ===\n');
  
  // High-importance facts first
  if (insights.keyFacts?.length > 0) {
    const highFacts = insights.keyFacts.filter(f => f.importance === 'high');
    const otherFacts = insights.keyFacts.filter(f => f.importance !== 'high');
    
    sections.push('## HIGH-IMPACT FINDINGS');
    for (const f of highFacts.slice(0, 10)) {
      sections.push(`- ${f.fact}`);
    }
    sections.push('');
    
    if (otherFacts.length > 0) {
      sections.push('## SUPPORTING FACTS');
      for (const f of otherFacts.slice(0, 10)) {
        sections.push(`- ${f.fact}`);
      }
      sections.push('');
    }
  }
  
  // Themes for slide topics
  if (insights.themes?.length > 0) {
    sections.push('## MAJOR THEMES (potential slide topics)');
    for (const t of insights.themes) {
      sections.push(`- ${t.theme}: ${t.description || ''}`);
    }
    sections.push('');
  }
  
  // Metrics for impactful stats
  if (insights.metrics?.length > 0) {
    sections.push('## KEY METRICS');
    for (const m of insights.metrics.slice(0, 10)) {
      sections.push(`- ${m.value}: ${m.context}`);
    }
    sections.push('');
  }
  
  // Quotes for emphasis
  if (insights.quotes?.length > 0) {
    sections.push('## NOTABLE QUOTES');
    for (const q of insights.quotes.slice(0, 5)) {
      const speaker = q.speaker ? ` — ${q.speaker}` : '';
      sections.push(`- "${q.quote}"${speaker}`);
    }
    sections.push('');
  }
  
  return sections.join('\n');
}

/**
 * Format consolidated insights for document generation
 * Comprehensive, structured by theme
 * @param {object} insights - Consolidated insights
 * @returns {string} Formatted context for prompt
 */
export function formatForDocument(insights) {
  const sections = [];
  
  sections.push('=== EXTRACTED RESEARCH INSIGHTS ===\n');
  
  // Themes provide structure
  if (insights.themes?.length > 0) {
    sections.push('## MAJOR THEMES');
    for (const t of insights.themes) {
      sections.push(`### ${t.theme}`);
      if (t.description) sections.push(t.description);
      sections.push('');
    }
  }
  
  // All key facts
  if (insights.keyFacts?.length > 0) {
    sections.push('## KEY FINDINGS');
    
    // Group by category if available
    const byCategory = {};
    for (const f of insights.keyFacts) {
      const cat = f.category || 'General';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(f);
    }
    
    for (const [category, facts] of Object.entries(byCategory)) {
      sections.push(`### ${category}`);
      for (const f of facts) {
        sections.push(`- ${f.fact}`);
      }
      sections.push('');
    }
  }
  
  // Timeline
  if (insights.dates?.length > 0) {
    sections.push('## TIMELINE');
    for (const d of insights.dates) {
      sections.push(`- ${d.date}: ${d.event}`);
    }
    sections.push('');
  }
  
  // Metrics
  if (insights.metrics?.length > 0) {
    sections.push('## METRICS & DATA');
    for (const m of insights.metrics) {
      sections.push(`- ${m.value}: ${m.context}`);
    }
    sections.push('');
  }
  
  // Recommendations
  if (insights.recommendations?.length > 0) {
    sections.push('## RECOMMENDATIONS');
    for (const r of insights.recommendations) {
      sections.push(`- [${r.priority?.toUpperCase()}] ${r.recommendation}`);
    }
    sections.push('');
  }
  
  // Entities
  if (insights.entities?.length > 0) {
    sections.push('## KEY ENTITIES');
    for (const e of insights.entities) {
      sections.push(`- ${e.name} (${e.type})`);
    }
    sections.push('');
  }
  
  return sections.join('\n');
}

/**
 * Format consolidated insights for research analysis
 * All details, maximum comprehensiveness
 * @param {object} insights - Consolidated insights
 * @returns {string} Formatted context for prompt
 */
export function formatForResearchAnalysis(insights) {
  // Research analysis gets everything
  return formatForDocument(insights);
}

/**
 * Format consolidated insights for a specific content type
 * @param {object} insights - Consolidated insights
 * @param {string} contentType - 'roadmap' | 'slides' | 'document' | 'researchAnalysis'
 * @returns {string} Formatted context for prompt
 */
export function formatForPrompt(insights, contentType) {
  switch (contentType) {
    case 'roadmap':
      return formatForRoadmap(insights);
    case 'slides':
      return formatForSlides(insights);
    case 'document':
      return formatForDocument(insights);
    case 'researchAnalysis':
    case 'research-analysis':
      return formatForResearchAnalysis(insights);
    default:
      console.warn(`[Consolidator] Unknown content type: ${contentType}, using document format`);
      return formatForDocument(insights);
  }
}

/**
 * Get consolidation statistics
 * @param {object} consolidated - Consolidated insights
 * @returns {object} Statistics
 */
export function getConsolidationStats(consolidated) {
  return {
    keyFacts: consolidated.keyFacts?.length || 0,
    dates: consolidated.dates?.length || 0,
    entities: consolidated.entities?.length || 0,
    themes: consolidated.themes?.length || 0,
    metrics: consolidated.metrics?.length || 0,
    recommendations: consolidated.recommendations?.length || 0,
    quotes: consolidated.quotes?.length || 0,
    tasks: consolidated.tasks?.length || 0,
    sourceFiles: consolidated.metadata?.sourceFiles?.length || 0,
    chunksProcessed: consolidated.metadata?.chunksProcessed || 0
  };
}
