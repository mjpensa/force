/**
 * Analytics Routes Module
 * Feature #9: Analytics & Usage Tracking
 * Handles analytics event tracking and dashboard endpoints
 */

import express from 'express';
import { trackEvent, getOverallAnalytics, getAnalyticsSummary, getAnalyticsEvents } from '../database.js';
import { apiLimiter } from '../middleware.js';

const router = express.Router();

/**
 * POST /track-event
 * Allows frontend to track events (exports, feature usage, URL shares)
 */
router.post('/track-event', apiLimiter, (req, res) => {
  try {
    const { eventType, eventData, chartId, sessionId } = req.body;

    // Validate required fields
    if (!eventType || typeof eventType !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid eventType'
      });
    }

    // Validate eventType is in allowed list
    const allowedEventTypes = [
      'export_png',
      'export_pptx',
      'feature_executive_view',
      'feature_critical_path',
      'feature_edit_mode',
      'feature_theme_toggle',
      'feature_keyboard_shortcut',
      'url_share'
    ];

    if (!allowedEventTypes.includes(eventType)) {
      return res.status(400).json({
        error: `Invalid eventType. Allowed types: ${allowedEventTypes.join(', ')}`
      });
    }

    // Track the event
    trackEvent(eventType, eventData || {}, chartId || null, sessionId || null);

    res.json({
      success: true,
      message: 'Event tracked successfully'
    });
  } catch (error) {
    console.error('Error tracking event:', error);
    res.status(500).json({
      error: 'Failed to track event',
      details: error.message
    });
  }
});

/**
 * GET /analytics/dashboard
 * Returns comprehensive analytics for the dashboard
 */
router.get('/analytics/dashboard', (req, res) => {
  try {
    const analytics = getOverallAnalytics();

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error retrieving analytics:', error);
    res.status(500).json({
      error: 'Failed to retrieve analytics',
      details: error.message
    });
  }
});

/**
 * GET /analytics/summary
 * Returns daily summary analytics for a date range
 * Query params: startDate, endDate (YYYY-MM-DD format)
 */
router.get('/analytics/summary', (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate && !dateRegex.test(startDate)) {
      return res.status(400).json({
        error: 'Invalid startDate format. Use YYYY-MM-DD'
      });
    }
    if (endDate && !dateRegex.test(endDate)) {
      return res.status(400).json({
        error: 'Invalid endDate format. Use YYYY-MM-DD'
      });
    }

    const summary = getAnalyticsSummary(startDate, endDate);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error retrieving analytics summary:', error);
    res.status(500).json({
      error: 'Failed to retrieve analytics summary',
      details: error.message
    });
  }
});

/**
 * GET /analytics/events
 * Returns individual analytics events for a date range
 * Query params: startDate, endDate (YYYY-MM-DD format), eventType (optional)
 */
router.get('/analytics/events', (req, res) => {
  try {
    const { startDate, endDate, eventType } = req.query;

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate && !dateRegex.test(startDate)) {
      return res.status(400).json({
        error: 'Invalid startDate format. Use YYYY-MM-DD'
      });
    }
    if (endDate && !dateRegex.test(endDate)) {
      return res.status(400).json({
        error: 'Invalid endDate format. Use YYYY-MM-DD'
      });
    }

    const events = getAnalyticsEvents(startDate, endDate, eventType);

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('Error retrieving analytics events:', error);
    res.status(500).json({
      error: 'Failed to retrieve analytics events',
      details: error.message
    });
  }
});

export default router;
