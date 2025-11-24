/**
 * This is the main frontend script.
 * It handles form submission, API calls, and chart rendering.
 */

// Phase 2 Enhancement: Import centralized configuration
import { CONFIG } from './config.js';

// Define supported file types for frontend validation using centralized config
const SUPPORTED_FILE_MIMES = CONFIG.FILES.SUPPORTED_MIMES;
const SUPPORTED_FILE_EXTENSIONS = CONFIG.FILES.SUPPORTED_EXTENSIONS;
const SUPPORTED_FILES_STRING = SUPPORTED_FILE_EXTENSIONS.join(', ');

// --- Helper function to display errors ---
function displayError(message) {
    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

// Store files from drag-and-drop (since we can't set input.files programmatically)
let storedFiles = null;

// --- Helper to format file size ---
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// --- Helper to update folder statistics ---
function updateFolderStats(files, validFiles) {
    const folderStats = document.getElementById('folder-stats');
    const totalFiles = document.getElementById('total-files');
    const validFilesEl = document.getElementById('valid-files');
    const totalSize = document.getElementById('total-size');
    const fileTypes = document.getElementById('file-types');

    // Calculate total size
    let size = 0;
    for (const file of validFiles) {
        size += file.size;
    }

    // Get unique file types
    const types = new Set();
    for (const file of validFiles) {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        types.add(ext);
    }

    totalFiles.textContent = files.length;
    validFilesEl.textContent = validFiles.length;
    totalSize.textContent = formatFileSize(size);
    fileTypes.textContent = Array.from(types).join(', ') || 'None';

    // Always hide folder stats (only file mode is supported)
    folderStats.classList.add('hidden');
}

// --- Helper to trigger file processing logic using a FileList object ---
async function processFiles(files) {
    const fileInput = document.getElementById('upload-input');
    const dropzonePrompt = document.getElementById('dropzone-prompt');
    const fileListContainer = document.getElementById('file-list-container');
    const fileList = document.getElementById('file-list');

    // Clear previous errors
    document.getElementById('error-message').style.display = 'none';

    if (files.length === 0) {
        // No files selected
        dropzonePrompt.classList.remove('hidden');
        fileListContainer.classList.add('hidden');
        return;
    }

    // Show loading indicator for large file sets
    if (files.length > 100) {
        // Clear existing content safely
        dropzonePrompt.textContent = '';

        // Create loading UI using DOM methods (XSS-safe)
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'flex flex-col items-center justify-center';

        const spinner = document.createElement('div');
        spinner.className = 'spinner w-12 h-12 border-3 border-gray-200 border-t-custom-button rounded-full animate-spin mb-4';

        const text = document.createElement('p');
        text.className = 'text-xl';
        text.textContent = `Processing ${files.length} files...`;

        loadingDiv.appendChild(spinner);
        loadingDiv.appendChild(text);
        dropzonePrompt.appendChild(loadingDiv);
    }

    // Use setTimeout to allow UI to update before processing
    await new Promise(resolve => setTimeout(resolve, 10));

    const filesArray = Array.from(files);
    let validFiles = [];
    let invalidFiles = [];

    // 1. Validate files
    for (const file of filesArray) {
        // Check mime type (preferred) or rely on extension fallback
        const isValidMime = SUPPORTED_FILE_MIMES.includes(file.type);
        const isValidExtension = SUPPORTED_FILE_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(`.${ext}`));

        if (isValidMime || isValidExtension) {
            validFiles.push(file);
        } else {
            invalidFiles.push(file.name);
        }
    }

    // 2. Show warning for invalid files but continue with valid ones
    if (invalidFiles.length > 0) {
        const warningMsg = `Skipping ${invalidFiles.length} unsupported file(s). Only ${SUPPORTED_FILES_STRING} files will be processed.`;
        displayError(warningMsg);
    }

    // 3. Check if we have any valid files
    if (validFiles.length === 0) {
        const errorMsg = `No valid files found. Please upload ${SUPPORTED_FILES_STRING} files.`;
        displayError(errorMsg);

        // Reset the input field
        fileInput.value = '';

        // Restore dropzone prompt using safe DOM methods
        dropzonePrompt.textContent = ''; // Clear existing content

        // Create SVG element
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'w-20 h-20 opacity-80');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('stroke-width', '1.5');
        svg.setAttribute('stroke', 'currentColor');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('d', 'M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z');

        svg.appendChild(path);

        // Create title paragraph
        const title = document.createElement('p');
        title.id = 'dropzone-title';
        title.className = 'text-2xl md:text-3xl font-medium mt-6';
        title.textContent = 'Drop files here or click to browse';

        // Create subtitle paragraph
        const subtitle = document.createElement('p');
        subtitle.className = 'text-lg md:text-xl opacity-60 mt-3';
        subtitle.textContent = 'Supports .doc, .docx, .md, and .txt files';

        // Append all elements
        dropzonePrompt.appendChild(svg);
        dropzonePrompt.appendChild(title);
        dropzonePrompt.appendChild(subtitle);

        dropzonePrompt.classList.remove('hidden');
        fileListContainer.classList.add('hidden');
        return;
    }

    // 4. Update folder statistics
    updateFolderStats(filesArray, validFiles);

    // 5. Update the file list display
    fileList.innerHTML = ''; // Clear previous list

    // Show first 50 files in the list, indicate if there are more
    const displayLimit = 50;
    const displayFiles = validFiles.slice(0, displayLimit);

    const fragment = document.createDocumentFragment();
    for (const file of displayFiles) {
        const li = document.createElement('li');
        li.className = 'break-words py-1.5 px-2 rounded hover:bg-gray-700 transition-colors';

        // Create filename span with icon
        const filenameSpan = document.createElement('span');
        filenameSpan.className = 'font-medium text-white';

        // Show relative path if available (folder upload)
        const displayName = file.webkitRelativePath || file.name;

        // Add file icon based on extension
        const ext = displayName.split('.').pop().toLowerCase();
        let icon = '📄';
        if (ext === 'md') icon = '📝';
        else if (ext === 'txt') icon = '📃';
        else if (ext === 'docx' || ext === 'doc') icon = '📘';

        filenameSpan.textContent = `${icon} ${displayName}`;
        li.appendChild(filenameSpan);

        // Add file size if available
        if (file.size) {
            const sizeSpan = document.createElement('span');
            sizeSpan.className = 'ml-2 text-sm text-gray-400';
            sizeSpan.textContent = `(${formatFileSize(file.size)})`;
            li.appendChild(sizeSpan);
        }

        li.title = displayName; // Show full name on hover
        fragment.appendChild(li);
    }

    // Show indicator if there are more files
    if (validFiles.length > displayLimit) {
        const li = document.createElement('li');
        li.className = 'font-semibold text-custom-button';
        li.textContent = `... and ${validFiles.length - displayLimit} more file(s)`;
        fragment.appendChild(li);
    }

    fileList.appendChild(fragment);

    // Store the valid files for later use (can't set input.files due to security restrictions)
    // Create a new DataTransfer object to store files
    const dataTransfer = new DataTransfer();
    for (const file of validFiles) {
        dataTransfer.items.add(file);
    }
    storedFiles = dataTransfer.files;

    dropzonePrompt.classList.add('hidden');
    fileListContainer.classList.remove('hidden');
}

// --- Event Listeners ---
document.addEventListener("DOMContentLoaded", () => {
  const ganttForm = document.getElementById('gantt-form');
  const uploadInput = document.getElementById('upload-input');
  const dropzoneLabel = document.querySelector('.dropzone-container');

  // Check if all required elements exist
  if (!ganttForm || !uploadInput || !dropzoneLabel) {
    console.error('Required DOM elements not found. Please clear your browser cache and reload.');
    console.error('Missing elements:', {
      ganttForm: !!ganttForm,
      uploadInput: !!uploadInput,
      dropzoneLabel: !!dropzoneLabel
    });
    alert('Error: Page elements not loaded correctly. Please clear your browser cache (Ctrl+Shift+Delete or Cmd+Shift+Delete) and reload the page.');
    return;
  }

  ganttForm.addEventListener('submit', handleChartGenerate);

  // File selection handler
  uploadInput.addEventListener('change', (e) => {
    processFiles(e.target.files);
  });

  // -------------------------------------------------------------------
  // --- PREVENT DEFAULT FILE OPENING BEHAVIOR ---
  // --- This prevents the browser from opening dropped files in a new window/tab
  // -------------------------------------------------------------------

  // Prevent default drag and drop behavior on the entire document
  ['dragenter', 'dragover', 'drop'].forEach(eventName => {
    document.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });

  // -------------------------------------------------------------------
  // --- DRAG AND DROP EVENT LISTENERS ---
  // -------------------------------------------------------------------

  // 1. Handle file/folder drop on dropzone
  dropzoneLabel.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      processFiles(droppedFiles);
    }

    // Reset visual state
    dropzoneLabel.classList.remove('border-white');
    dropzoneLabel.classList.add('border-custom-outline');
  }, false);

  // 2. Visual feedback for drag
  dropzoneLabel.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzoneLabel.classList.add('border-white');
    dropzoneLabel.classList.remove('border-custom-outline');
  });

  dropzoneLabel.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  dropzoneLabel.addEventListener('dragleave', (event) => {
    // Check if the cursor is actually leaving the element
    if (!dropzoneLabel.contains(document.elementFromPoint(event.clientX, event.clientY))) {
        dropzoneLabel.classList.remove('border-white');
        dropzoneLabel.classList.add('border-custom-outline');
    }
  });

});

/**
 * Phase 6 Enhancement: Polls the Phase 2 /api/content/:sessionId/:viewType endpoint
 * Polls for content generation completion for a specific view type
 * @param {string} sessionId - The session ID returned from /api/content/generate
 * @param {string} viewType - View type: 'roadmap', 'slides', or 'document'
 * @param {HTMLElement} generateBtn - The generate button element to update with progress
 * @returns {Promise<Object>} The content data when generation is complete
 * @throws {Error} If generation fails or times out
 */
async function pollForPhase2Content(sessionId, viewType, generateBtn) {
  const POLL_INTERVAL = 1000; // Poll every 1 second
  const MAX_ATTEMPTS = 300; // 5 minutes maximum (300 seconds)
  let attempts = 0;
  let isPolling = false; // Prevent concurrent polls

  // Recursive polling function with race condition protection
  const poll = async () => {
    // Prevent concurrent poll requests
    if (isPolling) {
      console.warn('Poll already in progress, skipping...');
      return;
    }

    // Check timeout before attempting
    if (attempts >= MAX_ATTEMPTS) {
      throw new Error('Content generation timed out after 5 minutes. Please try again.');
    }

    isPolling = true;
    attempts++;

    try {
      const response = await fetch(`/api/content/${sessionId}/${viewType}`);

      if (!response.ok) {
        // Handle non-JSON error responses gracefully
        let errorText = `Server error: ${response.status}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const err = await response.json();
            // Use detailed message if available, otherwise fall back to error field
            errorText = err.message || err.error || errorText;
            // Log hint for debugging if present
            if (err.hint) {
              console.warn('Server hint:', err.hint);
            }
          } else {
            const text = await response.text();
            errorText = text.substring(0, 200) || errorText;
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
        }
        throw new Error(errorText);
      }

      const content = await response.json();

      // Debug: Log content response
      console.log(`Poll attempt ${attempts}, ${viewType} status:`, content.status);

      // Update button text with progress
      if (generateBtn) {
        generateBtn.textContent = `Generating ${viewType}... (${attempts}s)`;
      }

      // Check content status
      if (content.status === 'completed') {
        console.log(`${viewType} content generated successfully`);
        return content.data; // Return the content data
      } else if (content.status === 'error' || content.status === 'failed') {
        throw new Error(content.error || `${viewType} generation failed with unknown error`);
      } else if (content.status === 'processing' || content.status === 'pending') {
        // Content still generating, schedule next poll
        isPolling = false;
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        return await poll(); // Recursive call
      } else {
        // Unknown status - treat as error
        console.error('Unknown content status:', content.status);
        throw new Error(`Unknown content status: ${content.status}`);
      }

    } catch (error) {
      isPolling = false;

      // If it's a network error, retry after a short delay
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.warn(`Network error on attempt ${attempts}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        return await poll(); // Retry
      }

      // Other errors are fatal
      throw error;
    }
  };

  return await poll();
}

/**
 * LEGACY: Phase 3 Enhancement: Polls the /job/:id endpoint until job is complete
 * This function is kept for backward compatibility with legacy /generate-chart endpoint
 * @deprecated Use pollForPhase2Content for new Phase 2 API
 * @param {string} jobId - The job ID returned from /generate-chart
 * @param {HTMLElement} generateBtn - The generate button element to update with progress
 * @returns {Promise<Object>} The chart data when job is complete
 * @throws {Error} If job fails or times out
 */
async function pollForJobCompletion(jobId, generateBtn) {
  const POLL_INTERVAL = 1000; // Poll every 1 second
  const MAX_ATTEMPTS = 300; // 5 minutes maximum (300 seconds)
  let attempts = 0;
  let isPolling = false; // Prevent concurrent polls

  // Recursive polling function with race condition protection
  const poll = async () => {
    // Prevent concurrent poll requests
    if (isPolling) {
      console.warn('Poll already in progress, skipping...');
      return;
    }

    // Check timeout before attempting
    if (attempts >= MAX_ATTEMPTS) {
      throw new Error('Job timed out after 5 minutes. Please try again.');
    }

    isPolling = true;
    attempts++;

    try {
      const response = await fetch(`/job/${jobId}`);

      if (!response.ok) {
        // Handle non-JSON error responses gracefully
        let errorText = `Server error: ${response.status}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const err = await response.json();
            errorText = err.error || errorText;
          } else {
            const text = await response.text();
            errorText = text.substring(0, 200) || errorText;
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
        }
        throw new Error(errorText);
      }

      const job = await response.json();

      // Debug: Log job response
      console.log(`Poll attempt ${attempts}, job status:`, job.status, 'progress:', job.progress);

      // Update button text with progress
      if (job.progress && generateBtn) {
        generateBtn.textContent = job.progress;
      }

      // Check job status
      if (job.status === 'complete') {
        console.log('Job completed successfully');
        console.log('Job data structure:', Object.keys(job.data || {}));

        // *** ENHANCED DEBUG: Log exact structure received from server ***
        console.log('=== DETAILED DATA STRUCTURE RECEIVED ===');
        console.log('job.data exists:', !!job.data);
        console.log('job.data type:', typeof job.data);
        console.log('job.data keys:', job.data ? Object.keys(job.data) : 'N/A');
        console.log('job.data.timeColumns exists:', job.data ? !!job.data.timeColumns : false);
        console.log('job.data.timeColumns type:', job.data?.timeColumns ? typeof job.data.timeColumns : 'N/A');
        console.log('job.data.timeColumns is array:', job.data?.timeColumns ? Array.isArray(job.data.timeColumns) : false);
        console.log('job.data.timeColumns value:', job.data?.timeColumns);
        console.log('job.data.data exists:', job.data ? !!job.data.data : false);
        console.log('job.data.data type:', job.data?.data ? typeof job.data.data : 'N/A');
        console.log('job.data.data is array:', job.data?.data ? Array.isArray(job.data.data) : false);
        console.log('job.data.data value:', job.data?.data);
        console.log('========================================');

        return job.data; // Return the chart data
      } else if (job.status === 'error' || job.status === 'failed') {
        // Handle both 'error' and 'failed' statuses
        throw new Error(job.error || 'Job failed with unknown error');
      } else if (job.status === 'processing' || job.status === 'pending') {
        // Job still processing, schedule next poll
        isPolling = false;
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        return await poll(); // Recursive call
      } else {
        // Unknown status - treat as error
        console.error('Unknown job status:', job.status);
        throw new Error(`Unknown job status: ${job.status}`);
      }

    } catch (error) {
      isPolling = false;

      // If it's a network error, retry after a short delay
      if (error.message.includes('fetch') || error.message.includes('NetworkError')) {
        console.warn(`Poll attempt ${attempts} failed (network error), retrying...`, error);

        // Only retry if we haven't exceeded max attempts
        if (attempts < MAX_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
          return await poll(); // Recursive call to retry
        }
      }

      // For other errors (job errors), throw immediately
      throw error;
    } finally {
      isPolling = false;
    }
  };

  // Start polling immediately
  return await poll();
}

/**
 * Handles the "Generate Chart" button click
 */
async function handleChartGenerate(event) {
  event.preventDefault(); // Stop form from reloading page

  const generateBtn = document.getElementById('generate-btn');
  const loadingIndicator = document.getElementById('loading-indicator');
  const errorMessage = document.getElementById('error-message');
  const chartOutput = document.getElementById('chart-output');

  // Disable button IMMEDIATELY to prevent double-clicks (race condition fix)
  if (generateBtn.disabled) return; // Already processing
  generateBtn.disabled = true;

  const originalBtnText = generateBtn.textContent;
  generateBtn.textContent = 'Generating...';

  try {
    // 1. Get form data
    const promptInput = document.getElementById('prompt-input');
    const uploadInput = document.getElementById('upload-input');

    // Check if elements exist
    if (!uploadInput || !promptInput) {
      displayError('Error: Page not loaded correctly. Please clear your browser cache and reload.');
      console.error('Missing elements in handleChartGenerate:', { uploadInput: !!uploadInput, promptInput: !!promptInput });
      return;
    }

    // 2. Validate inputs
    // Check both uploadInput.files (for click-to-browse) and storedFiles (for drag-and-drop)
    const filesToProcess = storedFiles || uploadInput.files;

    if (filesToProcess.length === 0) {
      displayError('Error: Please upload at least one research document.');
      return; // Will re-enable button in finally block
    }

    if (!promptInput.value.trim()) {
      displayError('Error: Please provide project instructions in the prompt.');
      return; // Will re-enable button in finally block
    }

    // 3. Filter and validate files before submission
    const validFiles = [];
    for (const file of filesToProcess) {
      const isValidMime = SUPPORTED_FILE_MIMES.includes(file.type);
      const isValidExtension = SUPPORTED_FILE_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(`.${ext}`));

      if (isValidMime || isValidExtension) {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      displayError(`Error: No valid files to process. Please upload ${SUPPORTED_FILES_STRING} files.`);
      return; // Will re-enable button in finally block
    }

    const formData = new FormData();
    formData.append('prompt', promptInput.value);

    // Append all files with the correct field name
    for (const file of validFiles) {
      formData.append('researchFiles', file);
    }

    // 5. Update UI to show loading
    loadingIndicator.style.display = 'flex';
    errorMessage.style.display = 'none';
    chartOutput.innerHTML = ''; // Clear old chart

    // 6. Call Phase 2 unified content generation endpoint
    // This generates all three views (roadmap, slides, document) in parallel
    const response = await fetch('/api/content/generate', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      // Handle non-JSON error responses gracefully
      let errorText = `Server error: ${response.status}`;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const err = await response.json();
          errorText = err.error || errorText;
        } else {
          const text = await response.text();
          errorText = text.substring(0, 200) || errorText; // Limit error length
        }
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError);
      }
      throw new Error(errorText);
    }

    // 7. Get session ID and job IDs from response
    const generationResponse = await response.json();
    const sessionId = generationResponse.sessionId;

    if (!sessionId) {
      throw new Error('Server did not return a session ID');
    }

    console.log('Content generation started for session:', sessionId);
    console.log('Generating all three views:', generationResponse.jobIds);

    // 8. Poll for roadmap completion (other views continue in background)
    // We'll poll the /api/content/:sessionId/roadmap endpoint
    const ganttData = await pollForPhase2Content(sessionId, 'roadmap', generateBtn);

    // Debug: Log the received data structure
    console.log('Received ganttData:', ganttData);
    console.log('Has timeColumns:', !!ganttData?.timeColumns);
    console.log('Has data:', !!ganttData?.data);

    // 8. Validate the data structure with detailed error reporting
    if (!ganttData || typeof ganttData !== 'object') {
      console.error('Invalid data structure - ganttData is not an object. Type:', typeof ganttData, 'Value:', ganttData);
      throw new Error('Invalid chart data structure: Expected object, received ' + typeof ganttData);
    }

    // Validate standard Gantt chart structure
    console.log('📊 Validating chart data structure');

    if (!ganttData.timeColumns) {
      console.error('Invalid data structure - missing timeColumns. Keys:', Object.keys(ganttData), 'timeColumns value:', ganttData.timeColumns);
      throw new Error('Invalid chart data structure: Missing timeColumns field');
    }

    if (!Array.isArray(ganttData.timeColumns)) {
      console.error('Invalid data structure - timeColumns is not an array. Type:', typeof ganttData.timeColumns, 'Value:', ganttData.timeColumns);
      throw new Error('Invalid chart data structure: timeColumns is not an array (type: ' + typeof ganttData.timeColumns + ')');
    }

    if (!ganttData.data) {
      console.error('Invalid data structure - missing data. Keys:', Object.keys(ganttData), 'data value:', ganttData.data);
      throw new Error('Invalid chart data structure: Missing data field');
    }

    if (!Array.isArray(ganttData.data)) {
      console.error('Invalid data structure - data is not an array. Type:', typeof ganttData.data, 'Value:', ganttData.data);
      throw new Error('Invalid chart data structure: data is not an array (type: ' + typeof ganttData.data + ')');
    }

    console.log('✓ Data structure validation passed - timeColumns:', ganttData.timeColumns.length, 'data:', ganttData.data.length);

    // Check for empty data
    if (ganttData.timeColumns.length === 0 || ganttData.data.length === 0) {
      console.warn("AI returned valid but empty data.", ganttData);
      throw new Error('The AI was unable to find any tasks or time columns in the provided documents. Please check your files or try a different prompt.');
    }

    // 9. Open in new tab - Phase 6 three-view viewer
    // Use sessionId to open the unified viewer with all three views
    window.open(`/viewer.html?sessionId=${sessionId}#roadmap`, '_blank');
    console.log('Opening three-view viewer with sessionId:', sessionId);
    console.log('All three views (roadmap, slides, document) will be available when generation completes');
    

  } catch (error) {
    console.error("Error generating chart:", error);
    errorMessage.textContent = `Error: ${error.message}`;
    errorMessage.style.display = 'block';
  } finally {
    // 10. Restore UI (always re-enable button)
    generateBtn.disabled = false;
    generateBtn.textContent = originalBtnText;
    loadingIndicator.style.display = 'none';
  }
}