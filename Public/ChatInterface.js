/**
 * ChatInterface Module
 * Phase 3 Enhancement: Extracted from chart-renderer.js
 * Handles chat functionality within the analysis modal
 */

import { safeGetElement, safeQuerySelector } from './Utils.js';

/**
 * ChatInterface Class
 * Manages the chat UI and interaction with the /ask-question endpoint
 */
export class ChatInterface {
  /**
   * Creates a new ChatInterface instance
   * @param {HTMLElement} container - The DOM element to render the chat into
   * @param {Object} taskIdentifier - Task identification object
   * @param {string} taskIdentifier.taskName - Name of the task
   * @param {string} taskIdentifier.entity - Entity associated with the task
   * @param {string} taskIdentifier.sessionId - Session ID for backend requests
   */
  constructor(container, taskIdentifier) {
    this.container = container;
    this.taskIdentifier = taskIdentifier;
    this.history = [];
  }

  /**
   * Renders the chat interface HTML
   * @returns {void}
   */
  render() {
    if (!this.container) {
      console.error('Chat container not found');
      return;
    }

    const chatContainer = document.createElement('div');
    chatContainer.className = 'chat-container';
    chatContainer.innerHTML = `
      <h4 class="chat-title">Ask a follow-up</h4>
      <div class="chat-history" id="chat-history"></div>
      <form class="chat-form" id="chat-form">
        <input type="text" id="chat-input" class="chat-input" placeholder="Ask about this task..." autocomplete="off">
        <button type="submit" class="chat-send-btn">Send</button>
      </form>
    `;
    this.container.appendChild(chatContainer);

    // Add form listener
    this._attachEventListeners();
  }

  /**
   * Attaches event listeners to the chat form
   * @private
   */
  _attachEventListeners() {
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.sendMessage();
      });
    }
  }

  /**
   * Sends a message to the backend and displays the response
   * @async
   * @returns {Promise<void>}
   */
  async sendMessage() {
    const input = safeGetElement('chat-input', 'ChatInterface.sendMessage');
    const sendBtn = safeQuerySelector('.chat-send-btn', 'ChatInterface.sendMessage');

    if (!input || !sendBtn) return;

    const question = input.value.trim();
    if (!question) return;

    // Disable UI (but don't clear input yet - only clear on success)
    input.disabled = true;
    sendBtn.disabled = true;

    // Add user question to history
    this.addMessageToHistory(question, 'user');

    // Add spinner for LLM response
    const spinnerId = `spinner-${Date.now()}`;
    this.addMessageToHistory('<div class="chat-spinner"></div>', 'llm', spinnerId);

    try {
      // Call the /ask-question endpoint
      const response = await fetch('/ask-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...this.taskIdentifier,
          question: question
        })
      });

      if (!response.ok) {
        // Handle non-JSON error responses gracefully
        let errorMessage = `Server error: ${response.status}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const err = await response.json();
            errorMessage = err.error || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = text.substring(0, 200) || errorMessage;
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Replace spinner with answer (sanitized to prevent XSS)
      const spinnerEl = document.getElementById(spinnerId);
      if (spinnerEl) {
        spinnerEl.innerHTML = DOMPurify.sanitize(data.answer);
      } else {
        this.addMessageToHistory(data.answer, 'llm');
      }

      // Clear input only on success
      if (input) {
        input.value = '';
      }

    } catch (error) {
      console.error('Error asking question:', error);
      // Replace spinner with error (using DOM methods to prevent XSS)
      const spinnerEl = document.getElementById(spinnerId);
      const errorSpan = document.createElement('span');
      errorSpan.style.color = '#BA3930';
      errorSpan.textContent = `Error: ${error.message}`;
      if (spinnerEl) {
        spinnerEl.innerHTML = '';
        spinnerEl.appendChild(errorSpan);
      } else {
        // Fallback - add error as new message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'chat-message chat-message-llm';
        errorDiv.appendChild(errorSpan);
        const history = document.getElementById('chat-history');
        if (history) history.appendChild(errorDiv);
      }
    } finally {
      // Re-enable UI
      if (input) {
        input.disabled = false;
        input.focus();
      }
      if (sendBtn) {
        sendBtn.disabled = false;
      }
    }
  }

  /**
   * Adds a message to the chat history UI
   * Sanitizes content based on message type to prevent XSS
   * @param {string} content - The message content
   * @param {string} type - The message type ('user', 'llm', or 'spinner')
   * @param {string|null} id - Optional ID for the message element
   * @returns {void}
   */
  addMessageToHistory(content, type, id = null) {
    const history = document.getElementById('chat-history');
    if (!history) return;

    const msg = document.createElement('div');
    msg.className = `chat-message chat-message-${type}`;
    if (id) {
      msg.id = id;
    }

    // Sanitize content based on sender type
    if (type === 'llm' || type === 'spinner') {
      // LLM responses and spinner HTML may have formatting, use DOMPurify for safety
      msg.innerHTML = DOMPurify.sanitize(content);
    } else if (type === 'user') {
      // User messages should never have HTML
      msg.textContent = content;
    } else {
      // Unknown message type - use textContent for safety
      console.warn(`Unknown message type: ${type}. Using textContent for safety.`);
      msg.textContent = content;
    }

    history.appendChild(msg);
    // Scroll to bottom
    history.scrollTop = history.scrollHeight;
  }
}
