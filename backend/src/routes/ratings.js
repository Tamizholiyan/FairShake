const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// POST /api/ratings/:requestId - Rate a provider after request completion
router.post('/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { stars, review_text } = req.body;

    const starsNum = parseInt(stars, 10);
    if (isNaN(starsNum) || starsNum < 1 || starsNum > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }

    // Verify request exists, is completed, and user is client
    const reqResult = await pool.query(
      `SELECT * FROM requests WHERE id = $1`,
      [requestId]
    );

    if (reqResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = reqResult.rows[0];
    if (request.client_id !== req.user.id && req.user.role !== 'MEDIATOR') {
      return res.status(403).json({ error: 'Only the client can rate the provider for this request' });
    }

    if (request.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Ratings can only be submitted for COMPLETED requests' });
    }

    if (!request.provider_id) {
      return res.status(400).json({ error: 'No provider assigned to this request' });
    }

    const result = await pool.query(
      `INSERT INTO ratings (request_id, provider_id, client_id, stars, review_text)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (request_id, client_id)
       DO UPDATE SET stars = EXCLUDED.stars, review_text = EXCLUDED.review_text, created_at = NOW()
       RETURNING *`,
      [requestId, request.provider_id, req.user.id, starsNum, review_text || null]
    );

    return res.status(201).json({
      message: 'Rating submitted successfully',
      rating: result.rows[0],
    });
  } catch (err) {
    console.error('Error submitting rating:', err);
    return res.status(500).json({ error: 'Failed to submit rating' });
  }
});

// GET /api/ratings/provider/:providerId - Get rating summary and reviews for a provider
router.get('/provider/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;

    const statsResult = await pool.query(
      `SELECT 
         COALESCE(ROUND(AVG(stars)::numeric, 1), 0) as avg_rating,
         COUNT(*) as rating_count
       FROM ratings
       WHERE provider_id = $1`,
      [providerId]
    );

    const reviewsResult = await pool.query(
      `SELECT 
         r.id, r.stars, r.review_text, r.created_at,
         u.name as client_name,
         req.title as request_title
       FROM ratings r
       JOIN users u ON r.client_id = u.id
       JOIN requests req ON r.request_id = req.id
       WHERE r.provider_id = $1
       ORDER BY r.created_at DESC
       LIMIT 20`,
      [providerId]
    );

    return res.json({
      avg_rating: parseFloat(statsResult.rows[0].avg_rating),
      rating_count: parseInt(statsResult.rows[0].rating_count, 10),
      reviews: reviewsResult.rows,
    });
  } catch (err) {
    console.error('Error fetching provider ratings:', err);
    return res.status(500).json({ error: 'Failed to fetch provider ratings' });
  }
});

// GET /api/ratings/request/:requestId - Get rating for a specific request
router.get('/request/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const result = await pool.query(
      `SELECT r.*, u.name as client_name 
       FROM ratings r
       JOIN users u ON r.client_id = u.id
       WHERE r.request_id = $1`,
      [requestId]
    );

    return res.json({ rating: result.rows[0] || null });
  } catch (err) {
    console.error('Error fetching request rating:', err);
    return res.status(500).json({ error: 'Failed to fetch request rating' });
  }
});

module.exports = router;
