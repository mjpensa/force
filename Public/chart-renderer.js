/**
 * Chart Renderer - Main Orchestrator
 * Phase 3 Enhancement: Refactored into modular architecture
 * This file now serves as a lightweight orchestrator, coordinating between modules
 *
 * Note: No persistence - charts must be loaded from URL parameter
 */

import { CONFIG } from './config.js';
import { safeGetElement, loadFooterSVG } from './Utils.js';
import { GanttChart } from './GanttChart.js';
import { TaskAnalyzer } from './TaskAnalyzer.js';

// Global variable to store ganttData (including sessionId)
let ganttData = null;
let footerSVG = '';
let errorDisplayed = false; // Track if an error message has already been shown

// Create TaskAnalyzer instance (shared across all task clicks)
const taskAnalyzer = new TaskAnalyzer();

/**
 * Main initialization function
 * Loads chart data from URL parameter and renders the chart
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Try loading from URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const chartId = urlParams.get('id');

  if (chartId) {
    // Load chart data from server using chart ID
    await loadChartFromServer(chartId);
  }

  // If we have chart data, render it
  if (ganttData) {
    // Load SVG graphics before rendering
    footerSVG = await loadFooterSVG();
    renderChart();
  } else if (!errorDisplayed) {
    // Only show generic error if a specific error hasn't already been displayed
    displayNoChartDataMessage();
  }
});

/**
 * Loads chart data from the server using a chart ID
 * @async
 * @param {string} chartId - The chart ID from the URL
 * @returns {Promise<void>}
 */
async function loadChartFromServer(chartId) {
  console.log('Attempting to load chart from server with ID:', chartId);

  const maxRetries = 3;
  let lastError = null;

  // Retry logic for transient network errors
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`Retry attempt ${attempt}/${maxRetries} for chart ${chartId}`);
        // Wait briefly before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt - 2), 5000)));
      }

      const response = await fetch(`/chart/${chartId}`);
      console.log(`Fetch response status (attempt ${attempt}):`, response.status, response.statusText);

      if (!response.ok) {
        // For 404, don't retry - chart definitely doesn't exist
        if (response.status === 404) {
          throw new Error(`Chart not found (404). It may have expired or the link is invalid.`);
        }
        // For other errors (500, 502, etc.), we'll retry
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      ganttData = await response.json();
      console.log('Chart data received from server');
      console.log('Data keys:', Object.keys(ganttData || {}));

      // Validate the loaded data structure
      if (!ganttData || typeof ganttData !== 'object') {
        console.error('Invalid chart data structure. Type:', typeof ganttData);
        throw new Error('Invalid chart data structure');
      }

      if (!ganttData.timeColumns || !Array.isArray(ganttData.timeColumns)) {
        console.error('Invalid timeColumns. Type:', typeof ganttData.timeColumns, 'Keys:', Object.keys(ganttData));
        throw new Error('Invalid timeColumns in chart data');
      }

      if (!ganttData.data || !Array.isArray(ganttData.data)) {
        console.error('Invalid data array. Type:', typeof ganttData.data, 'Keys:', Object.keys(ganttData));
        throw new Error('Invalid data array in chart data');
      }

      console.log('Chart data validation passed - timeColumns:', ganttData.timeColumns.length, 'data:', ganttData.data.length);

      // Success! Exit the retry loop
      return;

    } catch (error) {
      lastError = error;

      // If it's a 404, don't retry
      if (error.message.includes('404')) {
        console.error('Chart not found (404) - will not retry');
        break;
      }

      // If this was the last attempt, break
      if (attempt === maxRetries) {
        console.error(`All ${maxRetries} attempts failed`);
        break;
      }

      // Otherwise, log and continue to next retry
      console.warn(`Attempt ${attempt} failed:`, error.message);
    }
  }

  // If we get here, all retries failed
  console.error('Failed to load chart from URL after retries:', lastError);
  console.error('Error details:', {
    name: lastError?.name,
    message: lastError?.message,
    chartId: chartId,
    timestamp: new Date().toISOString()
  });

  ganttData = null; // Ensure ganttData is null after error
  errorDisplayed = true; // Mark that we're displaying a specific error
  displayChartNotFoundMessage();
}

/**
 * Renders the Gantt chart using the GanttChart module
 * @returns {void}
 */
function renderChart() {
  const container = document.getElementById('chart-root');
  if (!container) {
    console.error('Could not find chart container!');
    return;
  }

  // Create and render the chart
  const chart = new GanttChart(
    container,
    ganttData,
    footerSVG,
    handleTaskClick
  );
  chart.render();
}

/**
 * Handles task click events by showing the analysis modal
 * @param {Object} taskIdentifier - Task identification object
 * @returns {void}
 */
function handleTaskClick(taskIdentifier) {
  taskAnalyzer.showAnalysis(taskIdentifier);
}

/**
 * Displays a "chart not found" error message
 * @returns {void}
 */
function displayChartNotFoundMessage() {
  const container = safeGetElement('chart-root', 'displayChartNotFoundMessage');
  if (container) {
    container.innerHTML = `
      <div style="font-family: sans-serif; text-align: center; margin-top: 40px;">
        <h1>${CONFIG.UI.ERROR_MESSAGES.CHART_NOT_FOUND}</h1>
        <p style="color: #666;">${CONFIG.UI.ERROR_MESSAGES.CHART_EXPIRED}</p>
        <p style="color: #666;">${CONFIG.UI.ERROR_MESSAGES.CHART_AVAILABILITY}</p>
      </div>
    `;
  }
}

/**
 * Displays a "no chart data" error message
 * @returns {void}
 */
function displayNoChartDataMessage() {
  const container = safeGetElement('chart-root', 'displayNoChartDataMessage');
  if (container) {
    container.innerHTML = `
      <h1 style="font-family: sans-serif; text-align: center; margin-top: 40px;">${CONFIG.UI.ERROR_MESSAGES.NO_CHART_DATA}</h1>
    `;
  }
}
