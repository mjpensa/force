# Gap 13: Real-Time Training Streaming API

## Problem Statement

The current training API uses **polling** for progress updates:
```
Client → GET /api/train/status (every 2s) → Server
Client → GET /api/train/status (every 2s) → Server
Client → GET /api/train/status (every 2s) → Server
...
```

This approach has limitations:
1. Delayed updates (up to 2s latency)
2. Wasteful requests when nothing has changed
3. No real-time visibility into generation quality
4. `streamTrainingGraph()` exists but is unused
5. Redis Pub/Sub is set up but not exposed to clients

## Goal

Implement **Server-Sent Events (SSE)** streaming endpoint that pushes training updates in real-time as they occur.

---

## Phase 1: SSE Endpoint Foundation

### Objective
Create the SSE endpoint infrastructure for training event streaming.

### Tasks

#### 1.1 Create SSE Route Handler
```javascript
// server/routes/training-stream.js

import express from 'express';
import { trainingEvents } from '../utils/trainingEvents.js';

const router = express.Router();

/**
 * SSE endpoint for real-time training updates.
 *
 * GET /api/train/stream/:sessionId
 *
 * Event types:
 * - session_started: Training session initialized
 * - generation: Content generation completed
 * - evolution: Evolution cycle ran
 * - checkpoint: State saved
 * - session_completed: Training finished
 * - error: Error occurred
 * - heartbeat: Keep-alive (every 15s)
 */
router.get('/stream/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection event
  sendSSE(res, 'connected', {
    sessionId,
    message: 'Connected to training stream',
    timestamp: new Date().toISOString()
  });

  // Set up heartbeat
  const heartbeatInterval = setInterval(() => {
    sendSSE(res, 'heartbeat', { timestamp: Date.now() });
  }, 15000);

  // Subscribe to training events
  const unsubscribe = await trainingEvents.subscribeToSession(sessionId, (event) => {
    sendSSE(res, event.type, event.data);
  });

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    unsubscribe();
    console.log(`[SSE] Client disconnected from ${sessionId}`);
  });
});

/**
 * Send SSE event to client
 */
function sendSSE(res, eventType, data) {
  res.write(`event: ${eventType}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export default router;
```

#### 1.2 Register SSE Route
```javascript
// server.js

import trainingStreamRoutes from './server/routes/training-stream.js';

// ... existing routes ...
app.use('/api/train', trainingStreamRoutes);
```

#### 1.3 SSE Event Types Definition
```javascript
// server/types/sse-events.js

/**
 * SSE Event Type Definitions
 */
export const SSE_EVENTS = {
  // Connection lifecycle
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  HEARTBEAT: 'heartbeat',

  // Session lifecycle
  SESSION_STARTED: 'session_started',
  SESSION_COMPLETED: 'session_completed',
  SESSION_STOPPED: 'session_stopped',
  SESSION_RESUMED: 'session_resumed',

  // Training progress
  GENERATION: 'generation',
  GENERATION_ERROR: 'generation_error',
  BATCH_COMPLETE: 'batch_complete',

  // Evolution
  EVOLUTION_CYCLE: 'evolution_cycle',
  VARIANT_PROMOTED: 'variant_promoted',
  OPTIMIZATION_STARTED: 'optimization_started',
  OPTIMIZATION_COMPLETED: 'optimization_completed',

  // Checkpointing
  CHECKPOINT_SAVED: 'checkpoint_saved',
  CHECKPOINT_RESUMED: 'checkpoint_resumed',

  // Errors
  ERROR: 'error',
  CRITICAL_ERROR: 'critical_error'
};
```

### Deliverables
- [ ] `/api/train/stream/:sessionId` SSE endpoint
- [ ] SSE event type definitions
- [ ] Heartbeat mechanism
- [ ] Client disconnect cleanup
- [ ] Basic connection testing

### Estimated Complexity: Medium

---

## Phase 2: Event Publisher Integration

### Objective
Connect training workflow events to the SSE stream.

### Tasks

#### 2.1 Enhance Training Events Module
```javascript
// server/utils/trainingEvents.js

import { EventEmitter } from 'events';

// Internal event emitter for SSE
const sseEmitter = new EventEmitter();
sseEmitter.setMaxListeners(100); // Allow many concurrent streams

/**
 * Subscribe to SSE events for a session
 */
export async function subscribeToSession(sessionId, handler) {
  const eventHandler = (event) => {
    if (!sessionId || event.sessionId === sessionId) {
      handler(event);
    }
  };

  sseEmitter.on('training_event', eventHandler);

  // Also subscribe to Redis Pub/Sub if available
  let redisSub = null;
  try {
    redisSub = await pubsub.subscribe('force:training:events', (message) => {
      if (!sessionId || message.data?.sessionId === sessionId) {
        handler({
          type: message.event,
          data: message.data
        });
      }
    });
  } catch (err) {
    console.warn(`[SSE] Redis subscription failed: ${err.message}`);
  }

  // Return unsubscribe function
  return () => {
    sseEmitter.off('training_event', eventHandler);
    if (redisSub) {
      pubsub.unsubscribe('force:training:events', redisSub);
    }
  };
}

/**
 * Emit event to SSE subscribers
 */
function emitSSEEvent(type, sessionId, data) {
  sseEmitter.emit('training_event', {
    type,
    sessionId,
    data,
    timestamp: Date.now()
  });
}

// Update existing event functions to also emit SSE events
async function onGeneration(sessionId, result, metadata = {}) {
  // ... existing code ...

  // Emit to SSE subscribers
  emitSSEEvent('generation', sessionId, {
    iteration: metadata.iteration,
    contentType: metadata.contentType,
    success: result?.success,
    qualityScore: metadata.feedback?.qualityScore,
    rating: metadata.feedback?.rating,
    cacheHit: metadata.cacheHit
  });

  return eventId;
}
```

#### 2.2 Add SSE Emission to All Event Types
```javascript
// Wrap each event function to emit SSE

async function onSessionStart(sessionId, config = {}) {
  const eventId = await logTrainingEvent(eventData);
  await publishTrainingEvent('session_started', { sessionId, config });

  // Emit to local SSE subscribers
  emitSSEEvent('session_started', sessionId, {
    iterations: config.iterations,
    contentTypes: config.contentTypes,
    mode: config.mode
  });

  return eventId;
}

async function onEvolutionCycle(sessionId, iteration, results = {}) {
  const eventId = await logEvolutionEvent(eventData);

  emitSSEEvent('evolution_cycle', sessionId, {
    iteration,
    promotions: results.promotions?.length || 0,
    evolutions: results.evolutions?.length || 0,
    details: results.promotions
  });

  return eventId;
}

// ... similar for all event types
```

#### 2.3 Handle Multi-Instance Coordination
```javascript
// server/utils/sseCoordinator.js

/**
 * Coordinates SSE across multiple server instances using Redis Pub/Sub.
 *
 * When training runs on instance A, SSE clients connected to instance B
 * should still receive updates via Redis broadcast.
 */
export class SSECoordinator {
  constructor() {
    this.localEmitter = new EventEmitter();
    this.redisPubSub = null;
  }

  async initialize() {
    // Subscribe to Redis channel for cross-instance events
    this.redisPubSub = await pubsub.subscribe(
      'force:training:events',
      this._handleRedisEvent.bind(this)
    );
  }

  _handleRedisEvent(message) {
    // Emit to local SSE connections
    this.localEmitter.emit('event', {
      type: message.event,
      sessionId: message.data?.sessionId,
      data: message.data,
      source: 'redis'
    });
  }

  subscribe(handler) {
    this.localEmitter.on('event', handler);
    return () => this.localEmitter.off('event', handler);
  }

  emit(type, sessionId, data) {
    // Emit locally
    this.localEmitter.emit('event', { type, sessionId, data, source: 'local' });

    // Broadcast via Redis for other instances
    publishTrainingEvent(type, { sessionId, ...data });
  }
}

export const sseCoordinator = new SSECoordinator();
```

### Deliverables
- [ ] SSE event emission in all training event functions
- [ ] Local EventEmitter for same-instance clients
- [ ] Redis Pub/Sub integration for multi-instance
- [ ] SSE coordinator for cross-instance events
- [ ] Integration tests

### Estimated Complexity: Medium-High

---

## Phase 3: LangGraph Stream Integration

### Objective
Connect the existing `streamTrainingGraph()` async generator to SSE.

### Tasks

#### 3.1 Expose Graph Streaming via SSE
```javascript
// server/routes/training-stream.js

import { streamTrainingGraph } from '../workflows/training-graph.js';

/**
 * SSE endpoint that streams directly from LangGraph.
 *
 * GET /api/train/stream/:sessionId/graph
 *
 * This provides the most granular updates, directly from the
 * graph execution rather than from event callbacks.
 */
router.get('/stream/:sessionId/graph', async (req, res) => {
  const { sessionId } = req.params;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let isClientConnected = true;
  req.on('close', () => {
    isClientConnected = false;
  });

  try {
    // Stream from LangGraph
    for await (const event of streamTrainingGraph(sessionId)) {
      if (!isClientConnected) break;

      // Map graph events to SSE events
      const sseEvent = mapGraphEventToSSE(event);
      sendSSE(res, sseEvent.type, sseEvent.data);
    }

    // Training completed
    sendSSE(res, 'session_completed', { sessionId });
  } catch (error) {
    sendSSE(res, 'error', {
      sessionId,
      message: error.message
    });
  } finally {
    res.end();
  }
});

/**
 * Map LangGraph events to SSE event format
 */
function mapGraphEventToSSE(graphEvent) {
  const { node, state, event } = graphEvent;

  switch (node) {
    case 'generate':
      return {
        type: 'generation_started',
        data: {
          contentType: state.currentContentType,
          sampleSet: state.currentSampleSet?.name
        }
      };

    case 'evaluate':
      return {
        type: 'generation',
        data: {
          contentType: state.currentContentType,
          success: state.currentResult?.success,
          qualityScore: state.currentResult?.qualityScore,
          cacheHit: state.currentCacheHit
        }
      };

    case 'check_evolution':
      if (state.lastEvolutionResult) {
        return {
          type: 'evolution_cycle',
          data: state.lastEvolutionResult
        };
      }
      return { type: 'evolution_check', data: {} };

    case 'checkpoint':
      return {
        type: 'checkpoint_saved',
        data: { iteration: state.currentIteration }
      };

    default:
      return {
        type: 'state_update',
        data: {
          node,
          phase: state.phase,
          iteration: state.currentIteration
        }
      };
  }
}
```

#### 3.2 Enhance streamTrainingGraph
```javascript
// server/workflows/training-graph.js

/**
 * Stream training graph execution with detailed events.
 *
 * @param {string} sessionId - Session to stream
 * @yields {Object} Graph events with state updates
 */
export async function* streamTrainingGraph(sessionId) {
  const graph = createTrainingGraph().compile({
    checkpointer: langGraphCheckpointer
  });

  const config = {
    configurable: { thread_id: `training:${sessionId}` }
  };

  // Get current state
  const currentState = await langGraphCheckpointer.get(config);
  if (!currentState) {
    throw new Error(`No training session found: ${sessionId}`);
  }

  // Stream execution
  for await (const event of graph.stream(currentState, {
    ...config,
    streamMode: 'updates' // or 'values' for full state
  })) {
    // Add metadata to each event
    yield {
      ...event,
      sessionId,
      timestamp: Date.now()
    };
  }
}
```

### Deliverables
- [ ] `/stream/:sessionId/graph` endpoint
- [ ] Graph event to SSE mapping
- [ ] Enhanced `streamTrainingGraph()` generator
- [ ] Proper cleanup on client disconnect

### Estimated Complexity: Medium

---

## Phase 4: Client SDK

### Objective
Provide a JavaScript client library for consuming the SSE stream.

### Tasks

#### 4.1 Create Browser Client
```javascript
// public/js/training-stream-client.js

/**
 * Training Stream Client
 *
 * Provides easy-to-use interface for receiving real-time training updates.
 *
 * Usage:
 *   const client = new TrainingStreamClient(sessionId);
 *   client.on('generation', (data) => console.log('Generated:', data));
 *   client.on('evolution', (data) => console.log('Evolved:', data));
 *   client.connect();
 */
class TrainingStreamClient {
  constructor(sessionId, options = {}) {
    this.sessionId = sessionId;
    this.baseUrl = options.baseUrl || '';
    this.eventSource = null;
    this.handlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectDelay = options.reconnectDelay || 2000;
  }

  /**
   * Connect to the SSE stream
   */
  connect() {
    const url = `${this.baseUrl}/api/train/stream/${this.sessionId}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      console.log('[TrainingStream] Connected');
      this.reconnectAttempts = 0;
      this._emit('connected', { sessionId: this.sessionId });
    };

    this.eventSource.onerror = (error) => {
      console.error('[TrainingStream] Error:', error);
      this._emit('error', { error });
      this._handleReconnect();
    };

    // Set up event listeners for each event type
    const eventTypes = [
      'connected',
      'heartbeat',
      'session_started',
      'generation',
      'generation_error',
      'evolution_cycle',
      'variant_promoted',
      'checkpoint_saved',
      'session_completed',
      'session_stopped',
      'error'
    ];

    for (const eventType of eventTypes) {
      this.eventSource.addEventListener(eventType, (event) => {
        try {
          const data = JSON.parse(event.data);
          this._emit(eventType, data);
        } catch (e) {
          console.error(`[TrainingStream] Parse error for ${eventType}:`, e);
        }
      });
    }
  }

  /**
   * Disconnect from the stream
   */
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this._emit('disconnected', { sessionId: this.sessionId });
  }

  /**
   * Register event handler
   */
  on(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType).add(handler);
    return () => this.off(eventType, handler);
  }

  /**
   * Remove event handler
   */
  off(eventType, handler) {
    this.handlers.get(eventType)?.delete(handler);
  }

  /**
   * Emit event to handlers
   */
  _emit(eventType, data) {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (e) {
          console.error(`[TrainingStream] Handler error for ${eventType}:`, e);
        }
      }
    }

    // Also emit to wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        handler(eventType, data);
      }
    }
  }

  /**
   * Handle reconnection
   */
  _handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[TrainingStream] Max reconnect attempts reached');
      this._emit('max_reconnects', {});
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[TrainingStream] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.disconnect();
      this.connect();
    }, delay);
  }
}

// Export for browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TrainingStreamClient;
} else if (typeof window !== 'undefined') {
  window.TrainingStreamClient = TrainingStreamClient;
}
```

#### 4.2 Create React Hook
```javascript
// public/js/hooks/useTrainingStream.js

import { useState, useEffect, useCallback } from 'react';

/**
 * React hook for consuming training stream.
 *
 * Usage:
 *   const { progress, events, isConnected, error } = useTrainingStream(sessionId);
 */
export function useTrainingStream(sessionId, options = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [progress, setProgress] = useState({
    iteration: 0,
    total: 0,
    percent: 0,
    status: 'connecting',
    lastGeneration: null
  });

  useEffect(() => {
    if (!sessionId) return;

    const client = new TrainingStreamClient(sessionId, options);

    client.on('connected', () => {
      setIsConnected(true);
      setError(null);
    });

    client.on('error', (data) => {
      setError(data.error);
    });

    client.on('session_started', (data) => {
      setProgress(prev => ({
        ...prev,
        total: data.iterations,
        status: 'running'
      }));
    });

    client.on('generation', (data) => {
      setProgress(prev => ({
        ...prev,
        iteration: data.iteration,
        percent: Math.round((data.iteration / prev.total) * 100),
        lastGeneration: data
      }));

      setEvents(prev => [...prev.slice(-99), {
        type: 'generation',
        ...data,
        timestamp: Date.now()
      }]);
    });

    client.on('session_completed', (data) => {
      setProgress(prev => ({
        ...prev,
        status: 'completed',
        percent: 100
      }));
    });

    client.connect();

    return () => client.disconnect();
  }, [sessionId, options]);

  return { isConnected, error, events, progress };
}
```

### Deliverables
- [ ] `TrainingStreamClient` browser class
- [ ] `useTrainingStream` React hook
- [ ] TypeScript type definitions
- [ ] Client documentation
- [ ] Example usage page

### Estimated Complexity: Medium

---

## Phase 5: Dashboard Integration

### Objective
Build a real-time training dashboard using the SSE stream.

### Tasks

#### 5.1 Training Progress Component
```jsx
// public/components/TrainingProgress.jsx

function TrainingProgress({ sessionId }) {
  const { progress, events, isConnected } = useTrainingStream(sessionId);

  return (
    <div className="training-progress">
      <header>
        <h2>Training Session: {sessionId}</h2>
        <StatusBadge connected={isConnected} status={progress.status} />
      </header>

      <ProgressBar percent={progress.percent} />

      <Stats>
        <Stat label="Iteration" value={`${progress.iteration}/${progress.total}`} />
        <Stat label="Avg Quality" value={calculateAvgQuality(events)} />
        <Stat label="Cache Hit Rate" value={calculateCacheRate(events)} />
      </Stats>

      <LiveFeed events={events} maxEvents={20} />
    </div>
  );
}
```

#### 5.2 Live Event Feed Component
```jsx
// public/components/LiveFeed.jsx

function LiveFeed({ events, maxEvents = 20 }) {
  const recentEvents = events.slice(-maxEvents).reverse();

  return (
    <div className="live-feed">
      <h3>Live Events</h3>
      <div className="events-list">
        {recentEvents.map((event, i) => (
          <EventCard key={event.timestamp + i} event={event} />
        ))}
      </div>
    </div>
  );
}

function EventCard({ event }) {
  const icons = {
    generation: event.success ? '✅' : '❌',
    evolution_cycle: '🧬',
    checkpoint_saved: '💾',
    variant_promoted: '🎉'
  };

  return (
    <div className={`event-card event-${event.type}`}>
      <span className="icon">{icons[event.type] || '📌'}</span>
      <div className="content">
        <span className="type">{event.type}</span>
        <span className="detail">
          {event.contentType && `${event.contentType} - `}
          {event.success !== undefined && (event.success ? 'Success' : 'Failed')}
          {event.rating && ` (${event.rating}⭐)`}
        </span>
      </div>
      <span className="time">{formatTime(event.timestamp)}</span>
    </div>
  );
}
```

### Deliverables
- [ ] `TrainingProgress` component
- [ ] `LiveFeed` component
- [ ] `StatsPanel` component
- [ ] CSS styling
- [ ] Demo page at `/dashboard/training/:sessionId`

### Estimated Complexity: Medium

---

## API Reference

### SSE Endpoint

```
GET /api/train/stream/:sessionId
```

**Headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Event Format:**
```
event: generation
data: {"iteration":5,"contentType":"Roadmap","success":true,"rating":4}

event: heartbeat
data: {"timestamp":1699999999999}
```

**Event Types:**

| Event | Description | Data Fields |
|-------|-------------|-------------|
| `connected` | Initial connection | `sessionId`, `timestamp` |
| `heartbeat` | Keep-alive | `timestamp` |
| `generation` | Content generated | `iteration`, `contentType`, `success`, `rating`, `cacheHit` |
| `evolution_cycle` | Evolution ran | `promotions`, `evolutions`, `iteration` |
| `session_completed` | Training done | `summary` |
| `error` | Error occurred | `message`, `code` |

## Performance Considerations

| Metric | Target |
|--------|--------|
| Event latency | <100ms |
| Heartbeat interval | 15s |
| Max concurrent connections | 1000 |
| Reconnect backoff | Exponential (2s, 4s, 8s, 16s) |
