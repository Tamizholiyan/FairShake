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

  // Multiples of 100 validation
  if (targetTotal % 100 !== 0) {
    return res.status(400).json({ error: 'Total amount must be in multiples of ₹100 (e.g., ₹500, ₹1,200).' });
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
    if (amt % 100 !== 0) {
      return res.status(400).json({ error: `Milestone #${i + 1} amount must be in multiples of ₹100.` });
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
        `INSERT INTO milestones (request_id, title, description, amount, sequence, status, due_date)
         VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
         RETURNING id, request_id, title, description, amount, sequence, status, due_date`,
        [requestObj.id, m.title.trim(), (m.description || '').trim(), Number(m.amount), seq, m.dueDate || m.due_date || null]
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

    if (requestObj.status !== 'PENDING_PAYMENT' && requestObj.status !== 'DRAFT' && requestObj.status !== 'OPEN') {
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

// GET /api/requests/open - Provider Open Feed with Category & Distance Filtering and Provider Rating Stats
router.get('/open', authenticateToken, async (req, res) => {
  const providerId = req.user.id;
  const radiusKm = parseFloat(req.query.radius_km) || 25;

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
             (SELECT COUNT(*) FROM milestones m WHERE m.request_id = r.id)::int as milestone_count,
             (SELECT COUNT(*) FROM applications a WHERE a.request_id = r.id)::int as application_count,
             (SELECT status FROM applications a WHERE a.request_id = r.id AND a.provider_id = $1) as my_application_status,
             COALESCE(
               (SELECT json_agg(
                 json_build_object(
                   'id', m.id,
                   'title', m.title,
                   'description', m.description,
                   'amount', m.amount,
                   'sequence', m.sequence,
                   'due_date', m.due_date
                 ) ORDER BY m.sequence ASC
               ) FROM milestones m WHERE m.request_id = r.id),
               '[]'::json
             ) as milestones
      FROM requests r
      JOIN users c ON r.client_id = c.id
      LEFT JOIN service_categories sc ON r.category_id = sc.id
      WHERE r.status = 'OPEN' AND r.provider_id IS NULL
    `;
    const params = [providerId];

    if (providerCatId) {
      params.push(providerCatId);
      query += ` AND r.category_id = $${params.length}`;
    }

    query += ` ORDER BY r.created_at DESC`;

    const { rows: openRequests } = await db.query(query, params);

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
        return true;
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

// POST /api/requests/:id/apply - Provider submits application / proposed quote for open request
router.post('/:id/apply', authenticateToken, async (req, res) => {
  const requestId = req.params.id;
  const providerId = req.user.id;
  const { proposed_amount, message } = req.body;

  if (req.user.role !== 'PROVIDER' && req.user.role !== 'MEDIATOR') {
    return res.status(403).json({ error: 'Only service providers can apply for requests.' });
  }

  try {
    const { rows: reqRows } = await db.query('SELECT * FROM requests WHERE id = $1', [requestId]);
    if (reqRows.length === 0) return res.status(404).json({ error: 'Request not found' });

    const requestObj = reqRows[0];
    if (requestObj.status !== 'OPEN' || requestObj.provider_id !== null) {
      return res.status(400).json({ error: 'This request is no longer accepting applications.' });
    }

    if (requestObj.client_id === providerId) {
      return res.status(400).json({ error: 'You cannot apply to your own request.' });
    }

    const result = await db.query(
      `INSERT INTO applications (request_id, provider_id, proposed_amount, message, status)
       VALUES ($1, $2, $3, $4, 'PENDING')
       ON CONFLICT (request_id, provider_id)
       DO UPDATE SET proposed_amount = EXCLUDED.proposed_amount, message = EXCLUDED.message, status = 'PENDING', created_at = NOW()
       RETURNING *`,
      [requestId, providerId, proposed_amount ? Number(proposed_amount) : requestObj.total_amount, message || null]
    );

    await db.query(
      `INSERT INTO audit_log (request_id, event_type, event_data, actor_id)
       VALUES ($1, 'PROVIDER_APPLIED', $2, $3)`,
      [requestId, JSON.stringify({ proposed_amount }), providerId]
    );

    res.status(201).json({
      message: 'Application submitted successfully! The client can now review your proposal and contact you.',
      application: result.rows[0],
    });
  } catch (error) {
    console.error('Application error:', error);
    res.status(500).json({ error: 'Failed to submit application: ' + error.message });
  }
});

// GET /api/requests/:id/applications - Client or Mediator views all applicants for a request
router.get('/:id/applications', authenticateToken, async (req, res) => {
  const requestId = req.params.id;
  const userId = req.user.id;

  try {
    const { rows: reqRows } = await db.query('SELECT * FROM requests WHERE id = $1', [requestId]);
    if (reqRows.length === 0) return res.status(404).json({ error: 'Request not found' });

    const requestObj = reqRows[0];
    if (requestObj.client_id !== userId && req.user.role !== 'MEDIATOR') {
      return res.status(403).json({ error: 'Only the client who posted the request can view applicants.' });
    }

    const { rows: applications } = await db.query(
      `SELECT a.id, a.request_id, a.provider_id, a.proposed_amount, a.message, a.status, a.created_at,
              u.name as provider_name, u.email as provider_email, u.phone as provider_phone,
              COALESCE(ROUND(AVG(rt.stars)::numeric, 1), 0) as avg_rating,
              COUNT(rt.id)::int as rating_count
       FROM applications a
       JOIN users u ON a.provider_id = u.id
       LEFT JOIN ratings rt ON rt.provider_id = u.id
       WHERE a.request_id = $1
       GROUP BY a.id, u.id
       ORDER BY a.created_at DESC`,
      [requestId]
    );

    res.json({ applications });
  } catch (error) {
    console.error('Fetch applications error:', error);
    res.status(500).json({ error: 'Failed to fetch applications.' });
  }
});

// PUT /api/requests/:id/milestones - Client updates milestones & budget before provider selection
router.put('/:id/milestones', authenticateToken, async (req, res) => {
  const requestId = req.params.id;
  const userId = req.user.id;
  const { total_amount, milestones } = req.body;

  const targetTotal = Number(total_amount);
  if (!targetTotal || targetTotal <= 0 || targetTotal % 100 !== 0) {
    return res.status(400).json({ error: 'Total amount must be a valid multiple of ₹100.' });
  }

  if (!milestones || !Array.isArray(milestones) || milestones.length === 0) {
    return res.status(400).json({ error: 'Must provide at least 1 milestone.' });
  }

  let milestoneSum = 0;
  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    const amt = Number(m.amount);
    if (isNaN(amt) || amt <= 0 || amt % 100 !== 0) {
      return res.status(400).json({ error: `Milestone #${i + 1} must have a valid amount in multiples of ₹100.` });
    }
    milestoneSum += amt;
  }

  if (Math.abs(milestoneSum - targetTotal) > 0.01) {
    return res.status(400).json({ error: `Sum of milestones (₹${milestoneSum}) must equal total amount (₹${targetTotal}).` });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: reqRows } = await client.query('SELECT * FROM requests WHERE id = $1 FOR UPDATE', [requestId]);
    if (reqRows.length === 0) throw new Error('Request not found');

    const requestObj = reqRows[0];
    if (requestObj.client_id !== userId && req.user.role !== 'MEDIATOR') {
      throw new Error('Only the client can modify milestones.');
    }

    if (requestObj.status !== 'OPEN' && requestObj.status !== 'PENDING_PAYMENT') {
      throw new Error('Milestones cannot be modified once work is in progress.');
    }

    // Update request total_amount
    await client.query('UPDATE requests SET total_amount = $1, updated_at = NOW() WHERE id = $2', [targetTotal, requestId]);

    // Delete existing milestones and replace
    await client.query('DELETE FROM milestones WHERE request_id = $1', [requestId]);

    const createdMilestones = [];
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      const seq = i + 1;
      const { rows: mRows } = await client.query(
        `INSERT INTO milestones (request_id, title, description, amount, sequence, status, due_date)
         VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
         RETURNING id, request_id, title, description, amount, sequence, status, due_date`,
        [requestId, m.title.trim(), (m.description || '').trim(), Number(m.amount), seq, m.dueDate || m.due_date || null]
      );
      createdMilestones.push(mRows[0]);
    }

    await client.query('COMMIT');

    res.json({
      message: 'Milestones and budget updated successfully.',
      milestones: createdMilestones,
      total_amount: targetTotal,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update milestones error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// POST /api/requests/:id/select-provider - Client selects an applicant provider and assigns to request
router.post('/:id/select-provider', authenticateToken, async (req, res) => {
  const requestId = req.params.id;
  const clientId = req.user.id;
  const { provider_id } = req.body;

  if (!provider_id) {
    return res.status(400).json({ error: 'Please specify the provider to select.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: reqRows } = await client.query('SELECT * FROM requests WHERE id = $1 FOR UPDATE', [requestId]);
    if (reqRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found' });
    }

    const requestObj = reqRows[0];
    if (requestObj.client_id !== clientId && req.user.role !== 'MEDIATOR') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only the client can select a provider for this request.' });
    }

    if (requestObj.status !== 'OPEN' || requestObj.provider_id !== null) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This request is already assigned or closed.' });
    }

    // Verify application
    const { rows: appRows } = await client.query(
      'SELECT * FROM applications WHERE request_id = $1 AND provider_id = $2',
      [requestId, provider_id]
    );

    if (appRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Selected provider has not applied to this request.' });
    }

    // Accept this application and reject others
    await client.query(
      `UPDATE applications SET status = 'ACCEPTED' WHERE request_id = $1 AND provider_id = $2`,
      [requestId, provider_id]
    );

    await client.query(
      `UPDATE applications SET status = 'REJECTED' WHERE request_id = $1 AND provider_id != $2`,
      [requestId, provider_id]
    );

    // Assign provider and move request to IN_PROGRESS
    await client.query(
      `UPDATE requests SET provider_id = $1, status = 'IN_PROGRESS', updated_at = NOW() WHERE id = $2`,
      [provider_id, requestId]
    );

    await client.query(
      `INSERT INTO audit_log (request_id, event_type, event_data, actor_id)
       VALUES ($1, 'PROVIDER_SELECTED', $2, $3)`,
      [requestId, JSON.stringify({ provider_id }), clientId]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Provider selected! Work is now officially in progress.',
      status: 'IN_PROGRESS',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Select provider error:', error);
    res.status(500).json({ error: 'Failed to select provider: ' + error.message });
  } finally {
    client.release();
  }
});

// POST /api/requests/:id/accept - Provider accepts open request directly (fallback direct accept)
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

    // Auto-create application and accept
    await client.query(
      `INSERT INTO applications (request_id, provider_id, proposed_amount, status)
       VALUES ($1, $2, $3, 'ACCEPTED')
       ON CONFLICT (request_id, provider_id) DO UPDATE SET status = 'ACCEPTED'`,
      [requestId, providerId, requestObj.total_amount]
    );

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

// POST /api/requests/:id/request-cancellation - Client requests project cancellation & unreleased refund
router.post('/:id/request-cancellation', authenticateToken, async (req, res) => {
  const requestId = req.params.id;
  const clientId = req.user.id;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Please provide a clear reason for requesting project cancellation.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: reqRows } = await client.query('SELECT * FROM requests WHERE id = $1 FOR UPDATE', [requestId]);
    if (reqRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found' });
    }

    const requestObj = reqRows[0];
    if (requestObj.client_id !== clientId && req.user.role !== 'MEDIATOR') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only the client who posted the request can apply for cancellation.' });
    }

    if (requestObj.status === 'COMPLETED' || requestObj.status === 'CANCELLED') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Cannot cancel a request that is already ${requestObj.status}.` });
    }

    // Calculate unreleased funds
    const { rows: unreleasedRows } = await client.query(
      `SELECT COALESCE(SUM(amount), 0) as unreleased_total
       FROM milestones 
       WHERE request_id = $1 AND status != 'RELEASED'`,
      [requestId]
    );

    const unreleasedAmount = Number(unreleasedRows[0].unreleased_total);

    const { rows: cancelRows } = await client.query(
      `INSERT INTO cancellation_requests (request_id, client_id, reason, unreleased_amount, status)
       VALUES ($1, $2, $3, $4, 'PENDING')
       RETURNING *`,
      [requestId, clientId, reason.trim(), unreleasedAmount]
    );

    // Notify provider via message if provider is assigned
    if (requestObj.provider_id) {
      await client.query(
        `INSERT INTO messages (sender_id, recipient_id, request_id, body)
         VALUES ($1, $2, $3, $4)`,
        [
          clientId,
          requestObj.provider_id,
          requestId,
          `⚠️ Client has requested project cancellation for reason: "${reason.trim()}". Fairshake Support will review the case.`
        ]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Cancellation application submitted. Fairshake Support will review and process the refund for unreleased funds.',
      cancellation: cancelRows[0],
      unreleasedAmount,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Cancellation request error:', error);
    res.status(500).json({ error: 'Failed to submit cancellation request: ' + error.message });
  } finally {
    client.release();
  }
});

// GET /api/requests/cancellations/pending - Mediator views all pending cancellation/refund requests
router.get('/cancellations/pending', authenticateToken, async (req, res) => {
  if (req.user.role !== 'MEDIATOR') {
    return res.status(403).json({ error: 'Only Support Mediators can access cancellation applications.' });
  }

  try {
    const { rows } = await db.query(
      `SELECT cr.*, r.title as request_title, r.total_amount, r.razorpay_payment_id,
              c.name as client_name, c.email as client_email,
              p.name as provider_name, p.email as provider_email
       FROM cancellation_requests cr
       JOIN requests r ON cr.request_id = r.id
       JOIN users c ON cr.client_id = c.id
       LEFT JOIN users p ON r.provider_id = p.id
       WHERE cr.status = 'PENDING'
       ORDER BY cr.created_at DESC`
    );

    res.json({ cancellations: rows });
  } catch (error) {
    console.error('Fetch pending cancellations error:', error);
    res.status(500).json({ error: 'Failed to fetch pending cancellations.' });
  }
});

// POST /api/requests/cancellations/:id/resolve - Mediator resolves cancellation application
router.post('/cancellations/:id/resolve', authenticateToken, async (req, res) => {
  if (req.user.role !== 'MEDIATOR') {
    return res.status(403).json({ error: 'Only Support Mediators can resolve cancellations.' });
  }

  const cancellationId = req.params.id;
  const { resolution, mediator_notes } = req.body; // 'APPROVED' | 'REJECTED'

  if (resolution !== 'APPROVED' && resolution !== 'REJECTED') {
    return res.status(400).json({ error: "Resolution must be either 'APPROVED' or 'REJECTED'." });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: cancelRows } = await client.query(
      'SELECT * FROM cancellation_requests WHERE id = $1 FOR UPDATE',
      [cancellationId]
    );

    if (cancelRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cancellation request not found.' });
    }

    const cancelReq = cancelRows[0];
    if (cancelReq.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This cancellation request is already resolved.' });
    }

    const { rows: reqRows } = await client.query(
      'SELECT * FROM requests WHERE id = $1 FOR UPDATE',
      [cancelReq.request_id]
    );
    const requestObj = reqRows[0];

    let refundResult = null;
    if (resolution === 'APPROVED') {
      // Issue real refund for unreleased money
      if (requestObj.razorpay_payment_id && cancelReq.unreleased_amount > 0) {
        refundResult = await issueFullRefund(requestObj.razorpay_payment_id, cancelReq.unreleased_amount, {
          request_id: cancelReq.request_id,
          cancellation_id: cancellationId,
        });
      }

      await client.query(
        `UPDATE requests SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
        [cancelReq.request_id]
      );

      await client.query(
        `INSERT INTO fund_events (request_id, milestone_id, event_type, amount, is_real_money, razorpay_reference_id)
         VALUES ($1, NULL, 'CANCELLATION_REFUND_APPROVED', $2, true, $3)`,
        [cancelReq.request_id, cancelReq.unreleased_amount, refundResult?.id]
      );
    }

    await client.query(
      `UPDATE cancellation_requests 
       SET status = $1, mediator_notes = $2, resolved_by = $3, resolved_at = NOW() 
       WHERE id = $4`,
      [resolution, mediator_notes || null, req.user.id, cancellationId]
    );

    await client.query('COMMIT');

    res.json({
      message: resolution === 'APPROVED'
        ? `Cancellation approved. Refund of ₹${Number(cancelReq.unreleased_amount).toLocaleString('en-IN')} has been initiated.`
        : 'Cancellation request has been rejected. Project remains active.',
      status: resolution,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Resolve cancellation error:', error);
    res.status(500).json({ error: 'Failed to resolve cancellation: ' + error.message });
  } finally {
    client.release();
  }
});

// POST /api/requests/:id/cancel - Client cancels an unaccepted OPEN request for 100% full refund
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
             p.name as provider_name, p.email as provider_email, p.phone as provider_phone,
             sc.name as category_name,
             (SELECT COUNT(*) FROM milestones m WHERE m.request_id = r.id)::int as total_milestones,
             (SELECT COUNT(*) FROM milestones m WHERE m.request_id = r.id AND m.status = 'RELEASED')::int as completed_milestones,
             (SELECT COUNT(*) FROM milestones m JOIN disputes ds ON ds.milestone_id = m.id WHERE m.request_id = r.id AND ds.status = 'OPEN')::int as open_issues,
             (SELECT COUNT(*) FROM applications a WHERE a.request_id = r.id)::int as application_count,
             (SELECT COALESCE(ROUND(AVG(stars)::numeric, 1), 0) FROM ratings rt WHERE rt.provider_id = r.provider_id) as provider_avg_rating,
             (SELECT COUNT(*) FROM ratings rt WHERE rt.provider_id = r.provider_id)::int as provider_rating_count
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

// GET /api/requests/:id - Single request detail with milestones, submissions & files, dispute, and ratings
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

    // Safe ratings query
    let providerAvgRating = 0;
    let providerRatingCount = 0;
    let ratingData = null;
    try {
      if (requestObj.provider_id) {
        const { rows: rtRows } = await db.query(
          `SELECT ROUND(AVG(stars)::numeric, 1) as avg_rating, COUNT(*)::int as count 
           FROM ratings WHERE provider_id = $1`,
          [requestObj.provider_id]
        );
        if (rtRows.length > 0) {
          providerAvgRating = Number(rtRows[0].avg_rating) || 0;
          providerRatingCount = Number(rtRows[0].count) || 0;
        }
      }
      const { rows: rRows } = await db.query(
        `SELECT r.*, u.name as client_name 
         FROM ratings r
         JOIN users u ON r.client_id = u.id
         WHERE r.request_id = $1`,
        [requestId]
      );
      ratingData = rRows[0] || null;
    } catch (e) {
      // Ignore if ratings table does not exist
    }

    // Safe cancellation request query
    let cancellationRequestData = null;
    try {
      const { rows: crRows } = await db.query(
        `SELECT id, reason, status, unreleased_amount, mediator_notes, created_at
         FROM cancellation_requests 
         WHERE request_id = $1 
         ORDER BY created_at DESC LIMIT 1`,
        [requestId]
      );
      cancellationRequestData = crRows[0] || null;
    } catch (e) {
      // Ignore if cancellation_requests table does not exist
    }

    // Fetch milestones
    const { rows: milestoneRows } = await db.query(
      `SELECT m.id, m.request_id, m.title, m.amount, m.sequence, m.status, m.due_date,
              COALESCE(m.description, '') as description
       FROM milestones m 
       WHERE m.request_id = $1 
       ORDER BY m.sequence ASC`,
      [requestId]
    );

    // Fetch submissions with multi-files
    let submissionRows = [];
    try {
      const { rows: sRows } = await db.query(
        `SELECT s.id, s.milestone_id, s.file_url, s.original_filename, s.revision_round, s.submitted_at,
                u.name as submitter_name
         FROM submissions s
         JOIN milestones m ON s.milestone_id = m.id
         JOIN users u ON s.submitted_by = u.id
         WHERE m.request_id = $1
         ORDER BY s.submitted_at DESC`,
        [requestId]
      );

      // Try fetching submission_files
      let submissionFiles = [];
      try {
        const { rows: sfRows } = await db.query(
          `SELECT sf.id, sf.submission_id, sf.file_url, sf.original_filename 
           FROM submission_files sf
           JOIN submissions s ON sf.submission_id = s.id
           JOIN milestones m ON s.milestone_id = m.id
           WHERE m.request_id = $1`,
          [requestId]
        );
        submissionFiles = sfRows;
      } catch (sfErr) {
        // Fallback to legacy single-file submission
      }

      submissionRows = sRows.map(s => ({
        ...s,
        files: submissionFiles.filter(sf => sf.submission_id === s.id).length > 0
          ? submissionFiles.filter(sf => sf.submission_id === s.id)
          : (s.file_url ? [{ id: s.id, file_url: s.file_url, original_filename: s.original_filename }] : [])
      }));
    } catch (sErr) {
      console.warn('Submissions query warning:', sErr);
    }

    // Fetch dispute details if any
    let disputeRows = [];
    try {
      const { rows: dRows } = await db.query(
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
      disputeRows = dRows;
    } catch (dErr) {
      console.warn('Disputes query warning:', dErr);
    }

    const enrichedMilestones = milestoneRows.map(m => ({
      ...m,
      submissions: submissionRows.filter(s => s.milestone_id === m.id),
      dispute: disputeRows.find(d => d.milestone_id === m.id) || null,
    }));

    res.json({
      request: {
        ...requestObj,
        provider_avg_rating: providerAvgRating,
        provider_rating_count: providerRatingCount,
        cancellation_request: cancellationRequestData,
        milestones: enrichedMilestones,
        rating: ratingData,
      },
    });
  } catch (error) {
    console.error('Fetch request detail error:', error);
    res.status(500).json({ error: 'Failed to fetch request detail: ' + error.message });
  }
});

module.exports = router;
