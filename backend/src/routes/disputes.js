const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { transitionMilestone } = require('../services/stateMachine');
const { simulateMilestoneRelease } = require('../services/payoutSimulation');

const router = express.Router();

// GET /api/disputes - Support Review Dashboard: list ONLY reported issues (Section 7.3)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT ds.id, ds.milestone_id, ds.reason, ds.status, ds.resolution, ds.mediator_notes, ds.created_at, ds.resolved_at,
              m.title as milestone_title, m.amount as milestone_amount, m.sequence as milestone_sequence, m.status as milestone_status,
              r.id as request_id, r.title as request_title, r.status as request_status,
              c.name as client_name, c.email as client_email,
              p.name as provider_name, p.email as provider_email,
              u.name as raiser_name, m_user.name as resolver_name
       FROM disputes ds
       JOIN milestones m ON ds.milestone_id = m.id
       JOIN requests r ON m.request_id = r.id
       JOIN users c ON r.client_id = c.id
       LEFT JOIN users p ON r.provider_id = p.id
       LEFT JOIN users u ON ds.raised_by = u.id
       LEFT JOIN users m_user ON ds.resolved_by = m_user.id
       ORDER BY ds.created_at DESC`
    );
    res.json({ disputes: rows });
  } catch (error) {
    console.error('Fetch issues error:', error);
    res.status(500).json({ error: 'Failed to fetch reported issues.' });
  }
});

// GET /api/disputes/:id - Single dispute detail with full submission history
router.get('/:id', authenticateToken, async (req, res) => {
  const disputeId = req.params.id;

  try {
    const { rows: disputeRows } = await db.query(
      `SELECT ds.id, ds.milestone_id, ds.reason, ds.status, ds.resolution, ds.mediator_notes, ds.created_at, ds.resolved_at,
              m.id as milestone_id, m.title as milestone_title, m.amount as milestone_amount, m.sequence as milestone_sequence, m.status as milestone_status,
              r.id as request_id, r.title as request_title, r.status as request_status,
              c.name as client_name, c.email as client_email, c.phone as client_phone,
              p.name as provider_name, p.email as provider_email, p.phone as provider_phone,
              u.name as raiser_name, m_user.name as resolver_name
       FROM disputes ds
       JOIN milestones m ON ds.milestone_id = m.id
       JOIN requests r ON m.request_id = r.id
       JOIN users c ON r.client_id = c.id
       LEFT JOIN users p ON r.provider_id = p.id
       LEFT JOIN users u ON ds.raised_by = u.id
       LEFT JOIN users m_user ON ds.resolved_by = m_user.id
       WHERE ds.id = $1`,
      [disputeId]
    );

    if (disputeRows.length === 0) {
      return res.status(404).json({ error: 'Issue record not found.' });
    }

    const dispute = disputeRows[0];

    // Fetch full submission history (ordered by revision round ASC)
    const { rows: submissions } = await db.query(
      `SELECT s.id, s.file_url, s.original_filename, s.revision_round, s.submitted_at,
              u.name as submitter_name
       FROM submissions s
       JOIN users u ON s.submitted_by = u.id
       WHERE s.milestone_id = $1
       ORDER BY s.revision_round ASC`,
      [dispute.milestone_id]
    );

    res.json({
      dispute: {
        ...dispute,
        submissions,
      },
    });
  } catch (error) {
    console.error('Fetch issue detail error:', error);
    res.status(500).json({ error: 'Failed to fetch issue details.' });
  }
});

// POST /api/disputes/:id/resolve - Mediator resolution: Approve Submission OR Request Revision (Section 10.2)
router.post('/:id/resolve', authenticateToken, async (req, res) => {
  const disputeId = req.params.id;
  const { resolution, notes } = req.body;
  const mediatorId = req.user.id;

  if (req.user.role !== 'MEDIATOR') {
    return res.status(403).json({ error: 'Only authorized Fairshake Support agents can resolve reported issues.' });
  }

  if (!resolution || !['RELEASED', 'REVISION_REQUESTED'].includes(resolution)) {
    return res.status(400).json({ error: 'Resolution must be either RELEASED (Approve) or REVISION_REQUESTED (Request Revision).' });
  }

  if (!notes || !notes.trim()) {
    return res.status(400).json({ error: 'Mediator explanation note is required for both parties to see.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: disputeRows } = await client.query(
      `SELECT ds.*, m.id as milestone_id, m.amount as milestone_amount, m.request_id,
              r.title as request_title
       FROM disputes ds
       JOIN milestones m ON ds.milestone_id = m.id
       JOIN requests r ON m.request_id = r.id
       WHERE ds.id = $1 FOR UPDATE`,
      [disputeId]
    );

    if (disputeRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Issue record not found.' });
    }

    const dispute = disputeRows[0];
    if (dispute.status === 'RESOLVED') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This issue has already been resolved.' });
    }

    if (resolution === 'RELEASED') {
      // 1. Approve the submission
      await transitionMilestone(client, dispute.milestone_id, 'RELEASED', mediatorId, {
        resolution: 'RELEASED',
        mediator_notes: notes.trim(),
      });

      await simulateMilestoneRelease(client, dispute.milestone_id, dispute.milestone_amount);

      await client.query(
        `INSERT INTO fund_events (request_id, milestone_id, event_type, amount, is_real_money, razorpay_reference_id)
         VALUES ($1, $2, 'MILESTONE_RELEASE_SIMULATED', $3, false, NULL)`,
        [dispute.request_id, dispute.milestone_id, dispute.milestone_amount]
      );
    } else if (resolution === 'REVISION_REQUESTED') {
      // 2. Request revision
      await transitionMilestone(client, dispute.milestone_id, 'REVISION_REQUESTED', mediatorId, {
        resolution: 'REVISION_REQUESTED',
        mediator_notes: notes.trim(),
      });
    }

    // Update dispute record
    const { rows: updatedDispute } = await client.query(
      `UPDATE disputes
       SET status = 'RESOLVED', resolution = $1, mediator_notes = $2, resolved_by = $3, resolved_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [resolution, notes.trim(), mediatorId, disputeId]
    );

    // Create system support message recording the verdict
    const { rows: reqUserRows } = await client.query(
      'SELECT client_id, provider_id FROM requests WHERE id = $1',
      [dispute.request_id]
    );
    const reqUsers = reqUserRows[0];

    const verdictText = resolution === 'RELEASED'
      ? `Support Review Decision: Approved by Fairshake Support — "${notes.trim()}"`
      : `Support Review Decision: Revision Requested — "${notes.trim()}". Provider may now upload revised work.`;

    if (reqUsers?.client_id) {
      await client.query(
        `INSERT INTO messages (sender_id, recipient_id, request_id, dispute_id, body)
         VALUES ($1, $2, $3, $4, $5)`,
        [mediatorId, reqUsers.client_id, dispute.request_id, disputeId, verdictText]
      );
    }
    if (reqUsers?.provider_id) {
      await client.query(
        `INSERT INTO messages (sender_id, recipient_id, request_id, dispute_id, body)
         VALUES ($1, $2, $3, $4, $5)`,
        [mediatorId, reqUsers.provider_id, dispute.request_id, disputeId, verdictText]
      );
    }

    await client.query('COMMIT');

    res.json({
      message: resolution === 'RELEASED'
        ? 'Submission approved and payment released to provider.'
        : 'Revision requested. Provider can now submit an updated version.',
      dispute: updatedDispute[0],
      resolution,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Dispute resolution error:', error);
    res.status(500).json({ error: 'Failed to resolve issue: ' + error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
