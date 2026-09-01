const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { createRequestOrder, verifyPaymentSignature, issueFullRefund } = require('../services/razorpay');

const router = express.Router();

// Helper: Haversine distance in KM
function haversineDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// POST /api/requests - Client creates a request with milestone breakdown (Status: PENDING_PAYMENT)
router.post('/', authenticateToken, async (req, res) => {
  const { title, description, category_id, total_amount, milestones, latitude, longitude, address_text } = req.body;
  const clientId = req.user.id;
  const targetTotal = Number(total_amount);

  if (!title || !targetTotal || isNaN(targetTotal) || targetTotal <= 0) {
    return res.status(400).json({ error: 'A valid title and total payment amount (> 0) are required.' });
  }

  if (!milestones || !Array.isArray(milestones) || milestones.length === 0) {
    return res.status(400).json({ error: 'A request must have at least one milestone.' });
  }

  // Hard validation: sum of milestones must exactly equal total amount
  let milestoneSum = 0;
  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    const amt = Number(m.amount);
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: `Milestone #${i + 1} (${m.title || 'Untitled'}) has an invalid amount.` });
    }
    milestoneSum += amt;
  }

  if (Math.abs(milestoneSum - targetTotal) > 0.01) {
    return res.status(400).json({
      error: `Sum of milestones (₹${milestoneSum.toFixed(2)}) must exactly equal the total amount (₹${targetTotal.toFixed(2)}).`,
    });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: reqRows } = await client.query(
      `INSERT INTO requests (client_id, category_id, title, description, total_amount, status, latitude, longitude, address_text)
       VALUES ($1, $2, $3, $4, $5, 'PENDING_PAYMENT', $6, $7, $8)
       RETURNING id, client_id, category_id, title, description, total_amount, status, latitude, longitude, address_text, created_at`,
      [
        clientId,
        category_id || null,
        title.trim(),
        description || '',
        targetTotal,
        latitude || null,
        longitude || null,
        address_text || null,
      ]
    );

    const requestObj = reqRows[0];

    const createdMilestones = [];
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      const seq = i + 1;
      const { rows: mRows } = await client.query(
        `INSERT INTO milestones (request_id, title, amount, sequence, status, due_date)
         VALUES ($1, $2, $3, $4, 'PENDING', $5)
         RETURNING id, request_id, title, amount, sequence, status, due_date`,
        [requestObj.id, m.title.trim(), Number(m.amount), seq, m.dueDate || m.due_date || null]
      );
      createdMilestones.push(mRows[0]);
    }

    await client.query(
      `INSERT INTO audit_log (request_id, event_type, event_data, actor_id)
       VALUES ($1, 'REQUEST_CREATED', $2, $3)`,
      [requestObj.id, JSON.stringify({ title, total_amount: targetTotal, milestoneCount: milestones.length }), clientId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Request created. Please secure payment to make it available to providers.',
      request: {
        ...requestObj,
        milestones: createdMilestones,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Request creation error:', error);
    res.status(500).json({ error: 'Failed to create request: ' + error.message });
  } finally {
    client.release();
  }
});

// POST /api/requests/:id/lock - Creates Razorpay order for upfront payment locking
router.post('/:id/lock', authenticateToken, async (req, res) => {
  const requestId = req.params.id;
  const userId = req.user.id;

  try {
    const { rows } = await db.query('SELECT * FROM requests WHERE id = $1', [requestId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Request not found' });

    const requestObj = rows[0];

    if (requestObj.client_id !== userId && req.user.role !== 'MEDIATOR') {
      return res.status(403).json({ error: 'Only the client who posted the request can secure payment.' });
    }

    if (requestObj.status !== 'PENDING_PAYMENT' && requestObj.status !== 'DRAFT') {
      return res.status(400).json({ error: `Payment already secured or request is in '${requestObj.status}' state.` });
    }

    const order = await createRequestOrder(requestObj.id, requestObj.total_amount);

    await db.query(
      'UPDATE requests SET razorpay_order_id = $1, updated_at = NOW() WHERE id = $2',
      [order.id, requestId]
    );

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      requestTitle: requestObj.title,
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Failed to initialize payment gateway: ' + error.message });
  }
});

// POST /api/requests/:id/verify-lock - Verifies payment and moves request to OPEN pool
router.post('/:id/verify-lock', authenticateToken, async (req, res) => {
  const requestId = req.params.id;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const userId = req.user.id;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment confirmation parameters.' });
  }

  const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid payment signature received.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: reqRows } = await client.query(
      'SELECT * FROM requests WHERE id = $1 FOR UPDATE',
      [requestId]
    );
    if (reqRows.length === 0) throw new Error('Request not found');

    const requestObj = reqRows[0];

    // Transition to OPEN pool
    await client.query(
      `UPDATE requests 
       SET status = 'OPEN', razorpay_order_id = $1, razorpay_payment_id = $2, updated_at = NOW() 
       WHERE id = $3`,
      [razorpay_order_id, razorpay_payment_id, requestId]
    );

    // Record internal fund event
    await client.query(
      `INSERT INTO fund_events (request_id, milestone_id, event_type, amount, is_real_money, razorpay_reference_id)
       VALUES ($1, NULL, 'LOCK_COLLECTED', $2, true, $3)`,
      [requestId, requestObj.total_amount, razorpay_payment_id]
    );

    await client.query(
      `INSERT INTO audit_log (request_id, event_type, event_data, actor_id)
       VALUES ($1, 'PAYMENT_SECURED_OPENED', $2, $3)`,
      [requestId, JSON.stringify({ paymentId: razorpay_payment_id }), userId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Payment secured successfully! Request is now open for service providers.',
      status: 'OPEN',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Verify lock error:', error);
    res.status(500).json({ error: 'Failed to verify payment: ' + error.message });
  } finally {
    client.release();
  }
});

// GET /api/requests/open - Provider Open Feed with Category & Distance Filtering (Section 7.2 & 8)
router.get('/open', authenticateToken, async (req, res) => {
  const providerId = req.user.id;
  const radiusKm = parseFloat(req.query.radius_km) || 25; // Default 25km radius

  try {
    // Get provider profile
    const { rows: providerRows } = await db.query(
      'SELECT id, service_category_id, latitude, longitude FROM users WHERE id = $1',
      [providerId]
    );
    const provider = providerRows[0];

    const providerCatId = provider?.service_category_id || req.query.category_id;
    const providerLat = parseFloat(req.query.lat || provider?.latitude);
    const providerLng = parseFloat(req.query.lng || provider?.longitude);

    let query = `
      SELECT r.id, r.title, r.description, r.total_amount, r.status, r.address_text, r.latitude, r.longitude, r.created_at,
             c.name as client_name, c.email as client_email,
             sc.name as category_name,
             (SELECT COUNT(*) FROM milestones m WHERE m.request_id = r.id)::int as milestone_count
      FROM requests r
      JOIN users c ON r.client_id = c.id
      LEFT JOIN service_categories sc ON r.category_id = sc.id
      WHERE r.status = 'OPEN' AND r.provider_id IS NULL
    `;
    const params = [];

    // Filter by provider's category
    if (providerCatId) {
      params.push(providerCatId);
      query += ` AND r.category_id = $${params.length}`;
    }

    query += ` ORDER BY r.created_at DESC`;

    const { rows: openRequests } = await db.query(query, params);

    // Calculate distances & filter by radius
    const enriched = openRequests
      .map(r => {
        let distanceKm = null;
        if (providerLat && providerLng && r.latitude && r.longitude) {
          distanceKm = haversineDistance(providerLat, providerLng, parseFloat(r.latitude), parseFloat(r.longitude));
        }
        return {
          ...r,
          distance_km: distanceKm,
        };
      })
      .filter(r => {
        if (req.query.ignore_radius === 'true') return true;
        if (r.distance_km !== null) return r.distance_km <= radiusKm;
        return true; // Include if location not specified
      });

    res.json({
      requests: enriched,
      filter: {
        radius_km: radiusKm,
        category_id: providerCatId,
        provider_location: providerLat && providerLng ? { lat: providerLat, lng: providerLng } : null,
      },
    });
  } catch (error) {
    console.error('Fetch open requests error:', error);
    res.status(500).json({ error: 'Failed to fetch open requests feed.' });
  }
});

// POST /api/requests/:id/accept - Provider accepts open request (Section 9.4)
router.post('/:id/accept', authenticateToken, async (req, res) => {
  const requestId = req.params.id;
  const providerId = req.user.id;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      'SELECT * FROM requests WHERE id = $1 FOR UPDATE',
      [requestId]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found' });
    }

    const requestObj = rows[0];

    if (requestObj.status !== 'OPEN' || requestObj.provider_id !== null) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This request is no longer open for acceptance.' });
    }

    if (requestObj.client_id === providerId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You cannot accept your own request.' });
    }

    // Assign provider and move to IN_PROGRESS
    await client.query(
      `UPDATE requests 
       SET provider_id = $1, status = 'IN_PROGRESS', updated_at = NOW() 
       WHERE id = $2`,
      [providerId, requestId]
    );

    await client.query(
      `INSERT INTO audit_log (request_id, event_type, event_data, actor_id)
       VALUES ($1, 'REQUEST_ACCEPTED', $2, $3)`,
      [requestId, JSON.stringify({ providerId }), providerId]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Request accepted! You are now assigned to this project.',
      status: 'IN_PROGRESS',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Accept request error:', error);
    res.status(500).json({ error: 'Failed to accept request: ' + error.message });
  } finally {
    client.release();
  }
});

// POST /api/requests/:id/cancel - Client cancels an unaccepted OPEN request for 100% full refund (Section 9.7)
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  const requestId = req.params.id;
  const userId = req.user.id;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      'SELECT * FROM requests WHERE id = $1 FOR UPDATE',
      [requestId]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found' });
    }

    const requestObj = rows[0];

    if (requestObj.client_id !== userId && req.user.role !== 'MEDIATOR') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only the client can cancel this request.' });
    }

    if (requestObj.status !== 'OPEN' || requestObj.provider_id !== null) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only open requests without an assigned provider can be cancelled.' });
    }

    // Call real Razorpay 100% full refund
    let refundResult = null;
    if (requestObj.razorpay_payment_id) {
      refundResult = await issueFullRefund(requestObj.razorpay_payment_id, requestObj.total_amount, {
        request_id: requestId,
        client_id: userId,
      });
    }

    // Update status to CANCELLED
    await client.query(
      `UPDATE requests SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
      [requestId]
    );

    // Record internal fund event
    await client.query(
      `INSERT INTO fund_events (request_id, milestone_id, event_type, amount, is_real_money, razorpay_reference_id)
       VALUES ($1, NULL, 'REQUEST_CANCEL_REFUND_REAL', $2, true, $3)`,
      [requestId, requestObj.total_amount, refundResult?.id]
    );

    await client.query(
      `INSERT INTO audit_log (request_id, event_type, event_data, actor_id)
       VALUES ($1, 'REQUEST_CANCELLED_REFUNDED', $2, $3)`,
      [requestId, JSON.stringify({ refundId: refundResult?.id }), userId]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Request cancelled successfully. 100% full payment has been refunded to your original payment method.',
      status: 'CANCELLED',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Cancel request error:', error);
    res.status(500).json({ error: 'Failed to cancel request: ' + error.message });
  } finally {
    client.release();
  }
});

// GET /api/requests/my - List requests for current user (Client or Provider)
router.get('/my', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    let query = `
      SELECT r.id, r.title, r.description, r.total_amount, r.status, r.address_text, r.created_at,
             c.name as client_name, c.email as client_email,
             p.name as provider_name, p.email as provider_email,
             sc.name as category_name,
             (SELECT COUNT(*) FROM milestones m WHERE m.request_id = r.id)::int as total_milestones,
             (SELECT COUNT(*) FROM milestones m WHERE m.request_id = r.id AND m.status = 'RELEASED')::int as completed_milestones,
             (SELECT COUNT(*) FROM milestones m JOIN disputes ds ON ds.milestone_id = m.id WHERE m.request_id = r.id AND ds.status = 'OPEN')::int as open_issues
      FROM requests r
      JOIN users c ON r.client_id = c.id
      LEFT JOIN users p ON r.provider_id = p.id
      LEFT JOIN service_categories sc ON r.category_id = sc.id
    `;
    const params = [];

    if (userRole === 'CLIENT') {
      params.push(userId);
      query += ` WHERE r.client_id = $1`;
    } else if (userRole === 'PROVIDER') {
      params.push(userId);
      query += ` WHERE r.provider_id = $1`;
    }

    query += ` ORDER BY r.created_at DESC`;

    const { rows } = await db.query(query, params);
    res.json({ requests: rows });
  } catch (error) {
    console.error('Fetch my requests error:', error);
    res.status(500).json({ error: 'Failed to fetch your requests.' });
  }
});

// GET /api/requests/:id - Single request detail (Sanitized for user privacy)
router.get('/:id', authenticateToken, async (req, res) => {
  const requestId = req.params.id;

  try {
    const { rows: reqRows } = await db.query(
      `SELECT r.id, r.client_id, r.provider_id, r.category_id, r.title, r.description,
              r.total_amount, r.status, r.address_text, r.latitude, r.longitude, r.created_at,
              c.name as client_name, c.email as client_email, c.phone as client_phone,
              p.name as provider_name, p.email as provider_email, p.phone as provider_phone,
              sc.name as category_name
       FROM requests r
       JOIN users c ON r.client_id = c.id
       LEFT JOIN users p ON r.provider_id = p.id
       LEFT JOIN service_categories sc ON r.category_id = sc.id
       WHERE r.id = $1`,
      [requestId]
    );

    if (reqRows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const requestObj = reqRows[0];

    // Fetch milestones
    const { rows: milestoneRows } = await db.query(
      `SELECT m.id, m.request_id, m.title, m.amount, m.sequence, m.status, m.due_date
       FROM milestones m 
       WHERE m.request_id = $1 
       ORDER BY m.sequence ASC`,
      [requestId]
    );

    // Fetch submissions (sanitized: original_filename, file_url, revision_round, submitted_at)
    const { rows: submissionRows } = await db.query(
      `SELECT s.id, s.milestone_id, s.file_url, s.original_filename, s.revision_round, s.submitted_at,
              u.name as submitter_name
       FROM submissions s
       JOIN milestones m ON s.milestone_id = m.id
       JOIN users u ON s.submitted_by = u.id
       WHERE m.request_id = $1
       ORDER BY s.submitted_at DESC`,
      [requestId]
    );

    // Fetch dispute details if any
    const { rows: disputeRows } = await db.query(
      `SELECT ds.id, ds.milestone_id, ds.reason, ds.status, ds.resolution, ds.mediator_notes, ds.created_at, ds.resolved_at,
              u.name as raiser_name, m_user.name as resolver_name
       FROM disputes ds
       JOIN milestones m ON ds.milestone_id = m.id
       JOIN users u ON ds.raised_by = u.id
       LEFT JOIN users m_user ON ds.resolved_by = m_user.id
       WHERE m.request_id = $1
       ORDER BY ds.created_at DESC`,
      [requestId]
    );

    const enrichedMilestones = milestoneRows.map(m => ({
      ...m,
      submissions: submissionRows.filter(s => s.milestone_id === m.id),
      dispute: disputeRows.find(d => d.milestone_id === m.id) || null,
    }));

    res.json({
      request: {
        ...requestObj,
        milestones: enrichedMilestones,
      },
    });
  } catch (error) {
    console.error('Fetch request detail error:', error);
    res.status(500).json({ error: 'Failed to fetch request detail.' });
  }
});

module.exports = router;
