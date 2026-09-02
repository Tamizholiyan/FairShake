const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/messages - Fetch two-way messages for a request, dispute, or conversation
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { request_id, dispute_id } = req.query;

  try {
    let query = `
      SELECT m.*, 
             s.name as sender_name, s.role as sender_role,
             r.name as recipient_name, r.role as recipient_role
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.recipient_id = r.id
      WHERE (m.sender_id = $1 OR m.recipient_id = $1 OR $2 = 'MEDIATOR')
    `;
    const params = [userId, req.user.role];

    if (request_id) {
      params.push(request_id);
      query += ` AND m.request_id = $${params.length}`;
    }

    if (dispute_id) {
      params.push(dispute_id);
      query += ` AND m.dispute_id = $${params.length}`;
    }

    query += ` ORDER BY m.created_at ASC`;

    const { rows } = await db.query(query, params);
    res.json({ messages: rows });
  } catch (error) {
    console.error('Fetch messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

// POST /api/messages - Send a support or dispute message
router.post('/', authenticateToken, async (req, res) => {
  const senderId = req.user.id;
  const { recipient_id, request_id, dispute_id, body } = req.body;

  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'Message body cannot be empty.' });
  }

  try {
    let targetRecipientId = recipient_id;

    // If recipient_id is not explicitly specified, resolve counterparty or mediator
    if (!targetRecipientId && request_id) {
      const { rows: reqRows } = await db.query('SELECT client_id, provider_id FROM requests WHERE id = $1', [request_id]);
      if (reqRows.length > 0) {
        const reqData = reqRows[0];
        if (senderId === reqData.client_id) {
          targetRecipientId = reqData.provider_id;
        } else if (senderId === reqData.provider_id) {
          targetRecipientId = reqData.client_id;
        }
      }
    }

    // If still no recipient, fallback to first available mediator/support agent
    if (!targetRecipientId) {
      const { rows: medRows } = await db.query("SELECT id FROM users WHERE role = 'MEDIATOR' LIMIT 1");
      if (medRows.length > 0) {
        targetRecipientId = medRows[0].id;
      } else {
        targetRecipientId = senderId;
      }
    }

    const { rows } = await db.query(
      `INSERT INTO messages (sender_id, recipient_id, request_id, dispute_id, body)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [senderId, targetRecipientId, request_id || null, dispute_id || null, body.trim()]
    );

    const msgData = {
      ...createdMsg,
      sender_name: req.user.name,
      sender_role: req.user.role,
    };

    res.status(201).json({
      message: 'Message sent successfully',
      data: msgData,
      message_item: msgData,
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message: ' + error.message });
  }
});

module.exports = router;
