const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { createDealOrder, verifyPaymentSignature } = require('../services/razorpay');
const { recomputeDealStatus } = require('../services/stateMachine');

const router = express.Router();

// POST /api/deals - Create a new deal with milestone validation
router.post('/', authenticateToken, async (req, res) => {
  const { providerEmail, providerId, title, description, total_amount, totalAmount, milestones } = req.body;
  const clientId = req.user.id;
  const targetTotal = Number(total_amount || totalAmount);

  if (!title || !targetTotal || isNaN(targetTotal) || targetTotal <= 0) {
    return res.status(400).json({ error: 'Valid title and total_amount (> 0) are required' });
  }

  if (!milestones || !Array.isArray(milestones) || milestones.length === 0) {
    return res.status(400).json({ error: 'A deal must have at least one milestone' });
  }

  // Hard validation rule (Section 2, Rule 3):
  // Sum of every milestone's amount must EXACTLY equal deal.total_amount
  let milestoneSum = 0;
  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    const amt = Number(m.amount);
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: `Milestone #${i + 1} (${m.title || 'Untitled'}) has invalid amount` });
    }
    milestoneSum += amt;
  }

  // Check sum equals total with cents/paise precision
  if (Math.abs(milestoneSum - targetTotal) > 0.01) {
    return res.status(400).json({
      error: `Sum of milestones (₹${milestoneSum.toFixed(2)}) must exactly equal deal total amount (₹${targetTotal.toFixed(2)})`,
      expectedTotal: targetTotal,
      currentSum: milestoneSum,
    });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Resolve provider ID
    let finalProviderId = providerId;
    if (!finalProviderId && providerEmail) {
      const pRes = await client.query('SELECT id FROM users WHERE email = $1', [providerEmail.toLowerCase().trim()]);
      if (pRes.rows.length > 0) {
        finalProviderId = pRes.rows[0].id;
      }
    }

    const { rows: dealRows } = await client.query(
      `INSERT INTO deals (client_id, provider_id, title, description, total_amount, status)
       VALUES ($1, $2, $3, $4, $5, 'DRAFT')
       RETURNING *`,
      [clientId, finalProviderId || null, title.trim(), description || '', targetTotal]
    );

    const deal = dealRows[0];

    // Insert milestones with sequential ordering
    const createdMilestones = [];
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      const seq = m.sequence || (i + 1);
      const { rows: mRows } = await client.query(
        `INSERT INTO milestones (deal_id, title, amount, sequence, status, due_date)
         VALUES ($1, $2, $3, $4, 'PENDING', $5)
         RETURNING *`,
        [deal.id, m.title.trim(), Number(m.amount), seq, m.dueDate || m.due_date || null]
      );
      createdMilestones.push(mRows[0]);
    }

    // Audit log
    await client.query(
      `INSERT INTO audit_log (deal_id, event_type, event_data, actor_id)
       VALUES ($1, 'DEAL_CREATED', $2, $3)`,
      [deal.id, JSON.stringify({ title, total_amount: targetTotal, milestoneCount: milestones.length }), clientId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Deal created in DRAFT state',
      deal: {
        ...deal,
        milestones: createdMilestones,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Deal creation error:', error);
    res.status(500).json({ error: 'Failed to create deal: ' + error.message });
  } finally {
    client.release();
  }
});

// GET /api/deals - List all deals relevant to the current user
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    let queryText = `
      SELECT d.*, 
        c.name as client_name, c.email as client_email,
        p.name as provider_name, p.email as provider_email,
        (SELECT COUNT(*) FROM milestones m WHERE m.deal_id = d.id)::int as total_milestones,
        (SELECT COUNT(*) FROM milestones m WHERE m.deal_id = d.id AND m.status IN ('RELEASED', 'REFUNDED'))::int as completed_milestones,
        (SELECT COUNT(*) FROM milestones m JOIN disputes ds ON ds.milestone_id = m.id WHERE m.deal_id = d.id AND ds.status = 'OPEN')::int as open_disputes
      FROM deals d
      LEFT JOIN users c ON d.client_id = c.id
      LEFT JOIN users p ON d.provider_id = p.id
    `;
    const params = [];

    if (userRole !== 'MEDIATOR') {
      queryText += ` WHERE d.client_id = $1 OR d.provider_id = $1`;
      params.push(userId);
    }

    queryText += ` ORDER BY d.created_at DESC`;

    const { rows } = await db.query(queryText, params);
    res.json({ deals: rows });
  } catch (error) {
    console.error('Fetch deals error:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

// GET /api/deals/:id - Fetch full deal detail, milestones, submissions, disputes, fund events, audit trail
router.get('/:id', authenticateToken, async (req, res) => {
  const dealId = req.params.id;

  try {
    const { rows: dealRows } = await db.query(
      `SELECT d.*, 
        c.name as client_name, c.email as client_email, c.phone as client_phone,
        p.name as provider_name, p.email as provider_email, p.phone as provider_phone
       FROM deals d
       LEFT JOIN users c ON d.client_id = c.id
       LEFT JOIN users p ON d.provider_id = p.id
       WHERE d.id = $1`,
      [dealId]
    );

    if (dealRows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const deal = dealRows[0];

    // Fetch milestones
    const { rows: milestoneRows } = await db.query(
      `SELECT m.* FROM milestones m WHERE m.deal_id = $1 ORDER BY m.sequence ASC, m.id ASC`,
      [dealId]
    );

    // Fetch submissions for all milestones in this deal
    const { rows: submissionRows } = await db.query(
      `SELECT s.*, u.name as submitter_name 
       FROM submissions s
       JOIN milestones m ON s.milestone_id = m.id
       LEFT JOIN users u ON s.submitted_by = u.id
       WHERE m.deal_id = $1
       ORDER BY s.submitted_at DESC`,
      [dealId]
    );

    // Fetch disputes for all milestones in this deal
    const { rows: disputeRows } = await db.query(
      `SELECT ds.*, u.name as raiser_name
       FROM disputes ds
       JOIN milestones m ON ds.milestone_id = m.id
       LEFT JOIN users u ON ds.raised_by = u.id
       WHERE m.deal_id = $1
       ORDER BY ds.created_at DESC`,
      [dealId]
    );

    // Fetch fund events (ledger)
    const { rows: fundEventRows } = await db.query(
      `SELECT fe.*, m.title as milestone_title, m.sequence as milestone_sequence
       FROM fund_events fe
       LEFT JOIN milestones m ON fe.milestone_id = m.id
       WHERE fe.deal_id = $1
       ORDER BY fe.created_at ASC`,
      [dealId]
    );

    // Fetch audit log
    const { rows: auditRows } = await db.query(
      `SELECT a.*, u.name as actor_name, u.email as actor_email
       FROM audit_log a
       LEFT JOIN users u ON a.actor_id = u.id
       WHERE a.deal_id = $1
       ORDER BY a.created_at DESC`,
      [dealId]
    );

    // Attach submissions and disputes to their respective milestones
    const enrichedMilestones = milestoneRows.map(m => ({
      ...m,
      submissions: submissionRows.filter(s => s.milestone_id === m.id),
      dispute: disputeRows.find(d => d.milestone_id === m.id) || null,
    }));

    res.json({
      deal: {
        ...deal,
        milestones: enrichedMilestones,
        fund_events: fundEventRows,
        audit_log: auditRows,
      },
    });
  } catch (error) {
    console.error('Fetch deal detail error:', error);
    res.status(500).json({ error: 'Failed to fetch deal detail' });
  }
});

// POST /api/deals/:id/lock - Creates a real Razorpay Order for the full total_amount
router.post('/:id/lock', authenticateToken, async (req, res) => {
  const dealId = req.params.id;
  const userId = req.user.id;

  try {
    const { rows } = await db.query('SELECT * FROM deals WHERE id = $1', [dealId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Deal not found' });

    const deal = rows[0];

    if (deal.client_id !== userId && req.user.role !== 'MEDIATOR') {
      return res.status(403).json({ error: 'Only the deal client can lock funds' });
    }

    if (deal.status !== 'DRAFT') {
      return res.status(400).json({ error: `Deal cannot be locked in '${deal.status}' status` });
    }

    // Call real Razorpay Orders API
    const order = await createDealOrder(deal.id, deal.total_amount);

    // Store returned order.id
    await db.query(
      'UPDATE deals SET razorpay_order_id = $1, updated_at = NOW() WHERE id = $2',
      [order.id, dealId]
    );

    await db.query(
      `INSERT INTO audit_log (deal_id, event_type, event_data, actor_id)
       VALUES ($1, 'RAZORPAY_ORDER_CREATED', $2, $3)`,
      [dealId, JSON.stringify({ orderId: order.id, amountInPaise: order.amount }), userId]
    );

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      dealTitle: deal.title,
    });
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    res.status(500).json({ error: 'Failed to create Razorpay Order: ' + error.message });
  }
});

// POST /api/deals/:id/verify-lock - Verifies client-side signature and transitions deal to LOCKED
router.post('/:id/verify-lock', authenticateToken, async (req, res) => {
  const dealId = req.params.id;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const userId = req.user.id;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment signature verification parameters' });
  }

  // Verify signature HMAC-SHA256
  const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid Razorpay payment signature' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: dealRows } = await client.query(
      'SELECT * FROM deals WHERE id = $1 FOR UPDATE',
      [dealId]
    );
    if (dealRows.length === 0) throw new Error('Deal not found');

    const deal = dealRows[0];
    if (deal.status !== 'DRAFT') {
      await client.query('COMMIT');
      return res.json({ message: 'Deal already locked or in progress', status: deal.status });
    }

    // Transition deal to LOCKED
    await client.query(
      `UPDATE deals 
       SET status = 'LOCKED', razorpay_order_id = $1, razorpay_payment_id = $2, updated_at = NOW() 
       WHERE id = $3`,
      [razorpay_order_id, razorpay_payment_id, dealId]
    );

    // Insert real money collection event
    await client.query(
      `INSERT INTO fund_events (deal_id, milestone_id, event_type, amount, is_real_money, razorpay_reference_id)
       VALUES ($1, NULL, 'LOCK_COLLECTED', $2, true, $3)`,
      [dealId, deal.total_amount, razorpay_payment_id]
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_log (deal_id, event_type, event_data, actor_id)
       VALUES ($1, 'DEAL_LOCKED', $2, $3)`,
      [dealId, JSON.stringify({ order_id: razorpay_order_id, payment_id: razorpay_payment_id }), userId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Escrow payment locked successfully',
      dealStatus: 'LOCKED',
      paymentId: razorpay_payment_id,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Verify lock error:', error);
    res.status(500).json({ error: 'Failed to verify and lock deal: ' + error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
