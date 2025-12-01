/**
 * Progress Streamer Tests
 * 
 * Tests for Phase 4 SSE progress streaming during map-reduce processing.
 */

import { jest } from '@jest/globals';

const {
  createProgressSession,
  closeProgressSession,
  hasProgressSession,
  sendProgress,
  sendComplete,
  sendError,
  createProgressCallback,
  getProgressStreamStats
} = await import('../../../server/utils/progressStreamer.js');

// Use fake timers to avoid open handles
jest.useFakeTimers();

// Mock Express response object
function createMockResponse() {
  const chunks = [];
  return {
    setHeader: jest.fn(),
    write: jest.fn((data) => chunks.push(data)),
    end: jest.fn(),
    writableEnded: false,
    on: jest.fn(),
    chunks
  };
}

describe('Progress Streamer', () => {
  beforeEach(() => {
    // Clean up any lingering sessions from previous tests
    const stats = getProgressStreamStats();
    for (const session of stats.sessions) {
      closeProgressSession(session.sessionId);
    }
  });

  describe('Session Management', () => {
    test('creates a new progress session', () => {
      const res = createMockResponse();
      const sessionId = 'test-session-1';
      
      const success = createProgressSession(sessionId, res);
      
      expect(success).toBe(true);
      expect(hasProgressSession(sessionId)).toBe(true);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      
      closeProgressSession(sessionId);
    });

    test('closes a progress session', () => {
      const res = createMockResponse();
      const sessionId = 'test-session-close';
      
      createProgressSession(sessionId, res);
      expect(hasProgressSession(sessionId)).toBe(true);
      
      closeProgressSession(sessionId);
      expect(hasProgressSession(sessionId)).toBe(false);
    });

    test('sends connected event on session creation', () => {
      const res = createMockResponse();
      const sessionId = 'test-session-connected';
      
      createProgressSession(sessionId, res);
      
      // Check for connected event
      const connectedEvent = res.chunks.find(c => c.includes('event: connected'));
      expect(connectedEvent).toBeDefined();
      
      closeProgressSession(sessionId);
    });

    test('hasProgressSession returns false for non-existent session', () => {
      expect(hasProgressSession('non-existent-session')).toBe(false);
    });
  });

  describe('Progress Updates', () => {
    test('sends progress update to session', () => {
      const res = createMockResponse();
      const sessionId = 'test-progress-update';
      
      createProgressSession(sessionId, res);
      
      const progress = {
        phase: 'extraction',
        message: 'Extracting insights...',
        current: 3,
        total: 10,
        percentage: 30
      };
      
      const sent = sendProgress(sessionId, progress);
      
      expect(sent).toBe(true);
      const progressEvent = res.chunks.find(c => c.includes('event: progress'));
      expect(progressEvent).toBeDefined();
      
      closeProgressSession(sessionId);
    });

    test('returns false for non-existent session', () => {
      const sent = sendProgress('non-existent', { phase: 'test' });
      expect(sent).toBe(false);
    });

    test('createProgressCallback returns working callback', () => {
      const res = createMockResponse();
      const sessionId = 'test-callback';
      
      createProgressSession(sessionId, res);
      
      const callback = createProgressCallback(sessionId);
      
      callback({
        phase: 'chunking',
        message: 'Splitting content...',
        percentage: 10
      });
      
      const chunkCount = res.chunks.filter(c => c.includes('event: progress')).length;
      expect(chunkCount).toBe(1);
      
      closeProgressSession(sessionId);
    });
  });

  describe('Completion and Error Events', () => {
    test('sends complete event', async () => {
      const res = createMockResponse();
      const sessionId = 'test-complete';
      
      createProgressSession(sessionId, res);
      
      const result = { totalChunks: 5, totalInsights: 42 };
      sendComplete(sessionId, result);
      
      const completeEvent = res.chunks.find(c => c.includes('event: complete'));
      expect(completeEvent).toBeDefined();
      
      // Advance timers for auto-close
      jest.advanceTimersByTime(1500);
      expect(hasProgressSession(sessionId)).toBe(false);
    });

    test('sends error event', async () => {
      const res = createMockResponse();
      const sessionId = 'test-error';
      
      createProgressSession(sessionId, res);
      
      sendError(sessionId, 'Processing failed: Out of memory');
      
      const errorEvent = res.chunks.find(c => c.includes('event: error'));
      expect(errorEvent).toBeDefined();
      
      // Advance timers for auto-close
      jest.advanceTimersByTime(1500);
      expect(hasProgressSession(sessionId)).toBe(false);
    });
  });

  describe('Statistics', () => {
    test('tracks active sessions', () => {
      const res1 = createMockResponse();
      const res2 = createMockResponse();
      
      createProgressSession('stats-test-1', res1);
      createProgressSession('stats-test-2', res2);
      
      const stats = getProgressStreamStats();
      
      expect(stats.activeSessions).toBeGreaterThanOrEqual(2);
      expect(stats.sessions.length).toBeGreaterThanOrEqual(2);
      
      closeProgressSession('stats-test-1');
      closeProgressSession('stats-test-2');
    });

    test('session info includes phase and age', () => {
      const res = createMockResponse();
      const sessionId = 'stats-detail-test';
      
      createProgressSession(sessionId, res);
      sendProgress(sessionId, { phase: 'extraction' });
      
      const stats = getProgressStreamStats();
      const session = stats.sessions.find(s => s.sessionId === sessionId);
      
      expect(session).toBeDefined();
      expect(session.phase).toBe('extraction');
      expect(session.age).toBeDefined();
      
      closeProgressSession(sessionId);
    });
  });

  describe('Edge Cases', () => {
    test('handles multiple updates in sequence', () => {
      const res = createMockResponse();
      const sessionId = 'multi-update-test';
      
      createProgressSession(sessionId, res);
      
      for (let i = 1; i <= 10; i++) {
        sendProgress(sessionId, {
          phase: 'extraction',
          current: i,
          total: 10,
          percentage: i * 10
        });
      }
      
      const progressEvents = res.chunks.filter(c => c.includes('event: progress'));
      expect(progressEvents.length).toBe(10);
      
      closeProgressSession(sessionId);
    });

    test('closing non-existent session is safe', () => {
      expect(() => closeProgressSession('never-existed')).not.toThrow();
    });

    test('sending to closed session returns false', () => {
      const res = createMockResponse();
      const sessionId = 'closed-session-test';
      
      createProgressSession(sessionId, res);
      closeProgressSession(sessionId);
      
      const sent = sendProgress(sessionId, { phase: 'test' });
      expect(sent).toBe(false);
    });
  });
});
