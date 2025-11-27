import { CONFIG, getGeminiApiUrl } from './config.js';
import { jsonrepair } from 'jsonrepair';
const API_URL = getGeminiApiUrl();
function isRateLimitError(error) {
  return error.message && error.message.includes('status: 429');
}
function createQuotaErrorMessage(errorData) {
  try {
    if (errorData && errorData.error && errorData.error.message) {
      const msg = errorData.error.message;
      if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        const retryDelayMatch = msg.match(/retry in ([\d.]+)s/);
        const retryTime = retryDelayMatch ? Math.ceil(parseFloat(retryDelayMatch[1])) : null;
        if (retryTime && retryTime > 60) {
          return `API quota exceeded. The free tier has limits on requests per minute. Please wait ${Math.ceil(retryTime / 60)} minute(s) and try again, or upgrade your API plan at https://ai.google.dev/pricing`;
        } else if (retryTime) {
          return `API quota exceeded. Please wait ${retryTime} seconds and try again, or upgrade your API plan at https://ai.google.dev/pricing`;
        }
        return 'API quota exceeded. You have reached the free tier limit. Please wait a few minutes and try again, or upgrade your API plan at https://ai.google.dev/pricing';
      }
    }
  } catch (_e) {
    // Ignore parsing errors, fall through to default message
  }
  return 'API rate limit exceeded. Please try again in a few minutes.';
}
export async function retryWithBackoff(operation, retryCount = CONFIG.API.RETRY_COUNT, onRetry = null) {
  let lastError = null;
  for (let attempt = 0; attempt < retryCount; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isRateLimit = isRateLimitError(error);
      if (isRateLimit) {
        if (error.message.includes('quota') || error.message.includes('RESOURCE_EXHAUSTED')) {
          throw error; // Fail immediately for quota exhaustion
        }
      }
      if (attempt >= retryCount - 1) {
        throw error; // Throw the last error
      }
      if (onRetry) {
        onRetry(attempt + 1, error);
      }
      let delayMs;
      if (isRateLimit) {
        delayMs = CONFIG.API.RETRY_BASE_DELAY_MS * Math.pow(2, attempt + 1);
      } else {
        delayMs = CONFIG.API.RETRY_BASE_DELAY_MS * (attempt + 1);
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError || new Error('All retry attempts failed.');
}
export async function callGeminiForJson(payload, retryCount = CONFIG.API.RETRY_COUNT, onRetry = null) {
  return retryWithBackoff(async () => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      let errorText = 'Unknown error';
      let errorData = null;
      try {
        errorText = await response.text();
        try {
          errorData = JSON.parse(errorText);
        } catch (_jsonError) {
          // Response is not JSON, use raw text
        }
      } catch (_e) {
        // Failed to read response body
      }
      if (response.status === 429 && errorData) {
        const friendlyMessage = createQuotaErrorMessage(errorData);
        throw new Error(`API call failed with status: ${response.status} - ${friendlyMessage}`);
      }
      throw new Error(`API call failed with status: ${response.status} - ${errorText}`);
    }
    const result = await response.json();
    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
      throw new Error('Invalid response from AI API');
    }
    const safetyRatings = result.candidates[0].safetyRatings;
    if (safetyRatings) {
      const blockedRating = safetyRatings.find(rating => rating.blocked);
      if (blockedRating) {
        throw new Error(`API call blocked due to safety rating: ${blockedRating.category}`);
      }
    }
    if (!result.candidates[0].content.parts || !Array.isArray(result.candidates[0].content.parts) || result.candidates[0].content.parts.length === 0) {
      throw new Error('No content parts in Gemini response');
    }
    let extractedJsonText = result.candidates[0].content.parts[0].text;
    extractedJsonText = extractedJsonText.trim();
    if (extractedJsonText.startsWith('```json')) {
      extractedJsonText = extractedJsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (extractedJsonText.startsWith('```')) {
      extractedJsonText = extractedJsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    try {
      return JSON.parse(extractedJsonText);
    } catch (parseError) {
      // Attempt to repair malformed JSON
      try {
        const repairedJsonText = jsonrepair(extractedJsonText);
        const repairedData = JSON.parse(repairedJsonText);
        const isChartData = repairedData.title && repairedData.timeColumns && repairedData.data;
        if (isChartData) {
          if (!repairedData.data || !Array.isArray(repairedData.data)) {
            throw new Error('Repaired JSON structure is invalid - missing data array');
          }
          if (!repairedData.timeColumns || !Array.isArray(repairedData.timeColumns)) {
            throw new Error('Repaired JSON structure is invalid - missing timeColumns array');
          }
          for (let i = 0; i < repairedData.data.length; i++) {
            const item = repairedData.data[i];
            if (!item.title || typeof item.isSwimlane !== 'boolean' || !item.entity) {
              throw new Error(`Repaired JSON data item ${i} is invalid - missing required properties`);
            }
          }
        }
        // Task analysis and other formats don't need additional validation
        return repairedData;
      } catch (_repairError) {
        throw parseError; // Throw the original error
      }
    }
  }, retryCount, onRetry);
}
export async function callGeminiForText(payload, retryCount = CONFIG.API.RETRY_COUNT) {
  return retryWithBackoff(async () => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      let errorText = 'Unknown error';
      let errorData = null;
      try {
        errorText = await response.text();
        try {
          errorData = JSON.parse(errorText);
        } catch (_jsonError) {
          // Response is not JSON, use raw text
        }
      } catch (_e) {
        // Failed to read response body
      }
      if (response.status === 429 && errorData) {
        const friendlyMessage = createQuotaErrorMessage(errorData);
        throw new Error(`API call failed with status: ${response.status} - ${friendlyMessage}`);
      }
      throw new Error(`API call failed with status: ${response.status} - ${errorText}`);
    }
    const result = await response.json();
    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
      throw new Error('Invalid response from AI API');
    }
    const safetyRatings = result.candidates[0].safetyRatings;
    if (safetyRatings) {
      const blockedRating = safetyRatings.find(rating => rating.blocked);
      if (blockedRating) {
        throw new Error(`API call blocked due to safety rating: ${blockedRating.category}`);
      }
    }
    if (!result.candidates[0].content.parts || !Array.isArray(result.candidates[0].content.parts) || result.candidates[0].content.parts.length === 0) {
      throw new Error('No content parts in Gemini response');
    }
    return result.candidates[0].content.parts[0].text; // Return raw text
  }, retryCount);
}
