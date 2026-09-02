const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/addresses - List all saved addresses for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
      [req.user.id]
    );
    return res.json({ addresses: result.rows });
  } catch (err) {
    console.error('Error fetching addresses:', err);
    return res.status(500).json({ error: 'Failed to fetch saved addresses' });
  }
});

// POST /api/addresses - Add a new saved address
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { label, address_text, area_text, district_text, latitude, longitude, is_default } = req.body;

    if (!address_text || !address_text.trim()) {
      return res.status(400).json({ error: 'Address text is required' });
    }

    // If setting this as default, unset previous defaults
    if (is_default) {
      await pool.query(
        `UPDATE addresses SET is_default = FALSE WHERE user_id = $1`,
        [req.user.id]
      );
    }

    const result = await pool.query(
      `INSERT INTO addresses (user_id, label, address_text, area_text, district_text, latitude, longitude, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.user.id,
        label || 'Home',
        address_text.trim(),
        area_text || null,
        district_text || null,
        latitude || null,
        longitude || null,
        Boolean(is_default),
      ]
    );

    return res.status(201).json({
      message: 'Address saved successfully',
      address: result.rows[0],
    });
  } catch (err) {
    console.error('Error saving address:', err);
    return res.status(500).json({ error: 'Failed to save address' });
  }
});

// PUT /api/addresses/:id/default - Set an address as default
router.put('/:id/default', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const check = await pool.query(
      `SELECT * FROM addresses WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }

    await pool.query(
      `UPDATE addresses SET is_default = FALSE WHERE user_id = $1`,
      [req.user.id]
    );

    const result = await pool.query(
      `UPDATE addresses SET is_default = TRUE WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, req.user.id]
    );

    return res.json({
      message: 'Default address updated',
      address: result.rows[0],
    });
  } catch (err) {
    console.error('Error updating default address:', err);
    return res.status(500).json({ error: 'Failed to update default address' });
  }
});

// DELETE /api/addresses/:id - Delete a saved address
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }

    return res.json({ message: 'Address deleted successfully' });
  } catch (err) {
    console.error('Error deleting address:', err);
    return res.status(500).json({ error: 'Failed to delete address' });
  }
});

module.exports = router;
