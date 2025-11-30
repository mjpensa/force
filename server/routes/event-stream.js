/**
 * Event Stream API Routes
 *
 * Gap 05: Exposes training event audit logs via REST API.
 *
 * Endpoints:
 * - GET /training      - Get training events
 * - GET /generation    - Get generation events
 * - GET /evolution     - Get evolution events
 * - GET /errors        - Get error events
 * - GET /stats         - Get stream statistics
 * - GET /recent        - Get recent events across all streams
 */

import express from 'express';
import { eventStream, STREAM_KEYS } from '../redis/event-stream.js';

const router = express.Router();

/**
 * GET /api/events/training
 * Get training events
 *
 * Query params:
 * - count: Max events (default: 50, max: 500)
 * - since: Timestamp to start from (ms)
 * - reverse: Newest first (default: true)
 */
router.get('/training', async (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.count) || 50, 500);
    const since = req.query.since ? parseInt(req.query.since) : null;
    const reverse = req.query.reverse !== 'false';

    let events;
    if (since) {
      events = await eventStream.readEventsSince('training', since, count);
    } else {
      events = await eventStream.readEvents('training', { count, reverse });
    }

    res.json({
      success: true,
      events,
      count: events.length,
      query: { count, since, reverse }
    });

  } catch (error) {
    console.error('[EventStream] Error reading training events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read training events'
    });
  }
});

/**
 * GET /api/events/generation
 * Get generation events
 *
 * Query params: Same as /training
 */
router.get('/generation', async (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.count) || 50, 500);
    const since = req.query.since ? parseInt(req.query.since) : null;
    const reverse = req.query.reverse !== 'false';

    let events;
    if (since) {
      events = await eventStream.readEventsSince('generation', since, count);
    } else {
      events = await eventStream.readEvents('generation', { count, reverse });
    }

    res.json({
      success: true,
      events,
      count: events.length,
      query: { count, since, reverse }
    });

  } catch (error) {
    console.error('[EventStream] Error reading generation events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read generation events'
    });
  }
});

/**
 * GET /api/events/evolution
 * Get evolution events (prompt promotions, retirements)
 *
 * Query params: Same as /training
 */
router.get('/evolution', async (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.count) || 50, 500);
    const since = req.query.since ? parseInt(req.query.since) : null;
    const reverse = req.query.reverse !== 'false';

    let events;
    if (since) {
      events = await eventStream.readEventsSince('evolution', since, count);
    } else {
      events = await eventStream.readEvents('evolution', { count, reverse });
    }

    res.json({
      success: true,
      events,
      count: events.length,
      query: { count, since, reverse }
    });

  } catch (error) {
    console.error('[EventStream] Error reading evolution events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read evolution events'
    });
  }
});

/**
 * GET /api/events/errors
 * Get error events
 *
 * Query params: Same as /training
 */
router.get('/errors', async (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.count) || 50, 500);
    const since = req.query.since ? parseInt(req.query.since) : null;
    const reverse = req.query.reverse !== 'false';

    let events;
    if (since) {
      events = await eventStream.readEventsSince('errors', since, count);
    } else {
      events = await eventStream.readEvents('errors', { count, reverse });
    }

    res.json({
      success: true,
      events,
      count: events.length,
      query: { count, since, reverse }
    });

  } catch (error) {
    console.error('[EventStream] Error reading error events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read error events'
    });
  }
});

/**
 * GET /api/events/stats
 * Get statistics for all event streams
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await eventStream.getAllStreamInfo();

    // Calculate totals
    let totalEvents = 0;
    for (const streamInfo of Object.values(stats)) {
      if (streamInfo && streamInfo.length) {
        totalEvents += streamInfo.length;
      }
    }

    res.json({
      success: true,
      streams: stats,
      totalEvents,
      availableStreams: Object.keys(STREAM_KEYS)
    });

  } catch (error) {
    console.error('[EventStream] Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stream stats'
    });
  }
});

/**
 * GET /api/events/recent
 * Get recent events from all streams combined
 *
 * Query params:
 * - count: Max events per stream (default: 10)
 */
router.get('/recent', async (req, res) => {
  try {
    const countPerStream = Math.min(parseInt(req.query.count) || 10, 50);

    // Get latest from each stream
    const [training, generation, evolution, errors] = await Promise.all([
      eventStream.getLatestEvents('training', countPerStream),
      eventStream.getLatestEvents('generation', countPerStream),
      eventStream.getLatestEvents('evolution', countPerStream),
      eventStream.getLatestEvents('errors', countPerStream)
    ]);

    // Combine and sort by timestamp
    const allEvents = [
      ...training.map(e => ({ ...e, stream: 'training' })),
      ...generation.map(e => ({ ...e, stream: 'generation' })),
      ...evolution.map(e => ({ ...e, stream: 'evolution' })),
      ...errors.map(e => ({ ...e, stream: 'errors' }))
    ].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    res.json({
      success: true,
      events: allEvents,
      count: allEvents.length,
      byStream: {
        training: training.length,
        generation: generation.length,
        evolution: evolution.length,
        errors: errors.length
      }
    });

  } catch (error) {
    console.error('[EventStream] Error getting recent events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recent events'
    });
  }
});

/**
 * GET /api/events/range
 * Get events in a time range
 *
 * Query params:
 * - stream: Stream type (required)
 * - start: Start timestamp (ms, required)
 * - end: End timestamp (ms, default: now)
 * - count: Max events (default: 100)
 */
router.get('/range', async (req, res) => {
  try {
    const { stream } = req.query;
    const start = parseInt(req.query.start);
    const end = parseInt(req.query.end) || Date.now();
    const count = Math.min(parseInt(req.query.count) || 100, 500);

    if (!stream || !STREAM_KEYS[stream]) {
      return res.status(400).json({
        success: false,
        error: `Invalid stream. Available: ${Object.keys(STREAM_KEYS).join(', ')}`
      });
    }

    if (!start || isNaN(start)) {
      return res.status(400).json({
        success: false,
        error: 'start timestamp is required'
      });
    }

    const events = await eventStream.readEventsInRange(stream, start, end, count);

    res.json({
      success: true,
      events,
      count: events.length,
      query: { stream, start, end, count }
    });

  } catch (error) {
    console.error('[EventStream] Error reading range:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read events in range'
    });
  }
});

/**
 * DELETE /api/events/trim
 * Trim old events from streams
 *
 * Query params:
 * - stream: Stream type (required)
 * - olderThanHours: Delete events older than N hours (required)
 * - confirm: Must be 'true' to proceed
 */
router.delete('/trim', async (req, res) => {
  try {
    const { stream } = req.query;
    const olderThanHours = parseInt(req.query.olderThanHours);
    const confirm = req.query.confirm === 'true';

    if (!stream || !STREAM_KEYS[stream]) {
      return res.status(400).json({
        success: false,
        error: `Invalid stream. Available: ${Object.keys(STREAM_KEYS).join(', ')}`
      });
    }

    if (!olderThanHours || olderThanHours < 1) {
      return res.status(400).json({
        success: false,
        error: 'olderThanHours must be at least 1'
      });
    }

    if (!confirm) {
      return res.status(400).json({
        success: false,
        error: 'Add ?confirm=true to proceed with deletion'
      });
    }

    const olderThanMs = olderThanHours * 3600000;
    const deleted = await eventStream.trimOldEvents(stream, olderThanMs);

    res.json({
      success: true,
      deleted,
      stream,
      olderThanHours
    });

  } catch (error) {
    console.error('[EventStream] Error trimming events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trim events'
    });
  }
});

export default router;
