const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { transitionMilestone } = require('../services/stateMachine');
const { simulateMilestoneRelease } = require('../services/payoutSimulation');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// POST /api/milestones/:id/submit - Provider submits deliverable (supports initial & revision resubmissions)
router.post('/:id/submit', authenticateToken, upload.single('file'), async (req, res) => {
  const milestoneId = req.params.id;
  const userId = req.user.id;

  if (!req.file) {
    return res.status(400).json({ error: 'Please select a deliverable file to upload.' });
  }

  const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  const ext = path.extname(req.file.originalname) || '.bin';
  const savedFilename = `${Date.now()}_m${milestoneId}_${hash.substring(0, 12)}${ext}`;
  const filePath = path.join(uploadsDir, savedFilename);
  fs.writeFileSync(filePath, req.file.buffer);

  const fileUrl = `/uploads/${savedFilename}`;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: mRows } = await client.query(
      `SELECT m.*, r.provider_id, r.status as request_status 
       FROM milestones m 
       JOIN requests r ON m.request_id = r.id 
       WHERE m.id = $1 FOR UPDATE`,
      [milestoneId]
    );

    if (mRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Milestone not found.' });
    }

    const milestone = mRows[0];

    if (milestone.provider_id !== userId && req.user.role !== 'MEDIATOR') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only the assigned provider can submit deliverables.' });
    }

    if (milestone.request_status !== 'IN_PROGRESS') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Cannot submit deliverable while request is in '${milestone.request_status}' status.` });
    }

    // Determine revision round
    const { rows: prevSubs } = await client.query(
      'SELECT COUNT(*)::int as count FROM submissions WHERE milestone_id = $1',
      [milestoneId]
    );
    const revisionRound = (prevSubs[0]?.count || 0) + 1;

    // Insert submission record
    const { rows: subRows } = await client.query(
      `INSERT INTO submissions (milestone_id, file_url, original_filename, sha256_hash, revision_round, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, milestone_id, file_url, original_filename, revision_round, submitted_at`,
      [milestoneId, fileUrl, req.file.originalname, hash, revisionRound, userId]
    );

    // Transition milestone status to SUBMITTED
    await transitionMilestone(client, milestoneId, 'SUBMITTED', userId, {
      submissionId: subRows[0].id,
      revisionRound,
    });

    await client.query('COMMIT');

    res.json({
      message: revisionRound > 1 ? 'Revised deliverable submitted successfully.' : 'Deliverable submitted for client review.',
      submission: subRows[0],
      status: 'SUBMITTED',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Milestone submission error:', error);
    res.status(500).json({ error: 'Failed to submit deliverable: ' + error.message });
  } finally {
    client.release();
  }
});

// POST /api/milestones/:id/approve - Client approves milestone (triggers payout release)
router.post('/:id/approve', authenticateToken, async (req, res) => {
  const milestoneId = req.params.id;
  const userId = req.user.id;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: mRows } = await client.query(
      `SELECT m.*, r.client_id, r.status as request_status 
       FROM milestones m 
       JOIN requests r ON m.request_id = r.id 
       WHERE m.id = $1 FOR UPDATE`,
      [milestoneId]
    );

    if (mRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Milestone not found.' });
    }

    const milestone = mRows[0];

    if (milestone.client_id !== userId && req.user.role !== 'MEDIATOR') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only the client can approve this milestone.' });
    }

    await transitionMilestone(client, milestoneId, 'RELEASED', userId, {
      action: 'CLIENT_APPROVAL',
    });

    await simulateMilestoneRelease(client, milestoneId, milestone.amount);

    await client.query(
      `INSERT INTO fund_events (request_id, milestone_id, event_type, amount, is_real_money, razorpay_reference_id)
       VALUES ($1, $2, 'MILESTONE_RELEASE_SIMULATED', $3, false, NULL)`,
      [milestone.request_id, milestoneId, milestone.amount]
    );

    await client.query('COMMIT');

    res.json({
      message: `Milestone approved! Payment of ₹${Number(milestone.amount).toLocaleString('en-IN')} has been released to the provider.`,
      status: 'RELEASED',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Milestone approval error:', error);
    res.status(500).json({ error: 'Failed to approve milestone: ' + error.message });
  } finally {
    client.release();
  }
});

// POST /api/milestones/:id/dispute - Client raises an issue (moves milestone to IN_MEDIATION)
router.post('/:id/dispute', authenticateToken, async (req, res) => {
  const milestoneId = req.params.id;
  const { reason } = req.body;
  const userId = req.user.id;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Please describe the issue with this deliverable.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: mRows } = await client.query(
      `SELECT m.*, r.client_id 
       FROM milestones m 
       JOIN requests r ON m.request_id = r.id 
       WHERE m.id = $1 FOR UPDATE`,
      [milestoneId]
    );

    if (mRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Milestone not found.' });
    }

    const milestone = mRows[0];

    if (milestone.client_id !== userId && req.user.role !== 'MEDIATOR') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only the client can report an issue on this milestone.' });
    }

    // Transition SUBMITTED -> DISPUTED -> IN_MEDIATION
    await transitionMilestone(client, milestoneId, 'DISPUTED', userId, { reason });
    await transitionMilestone(client, milestoneId, 'IN_MEDIATION', userId, { reason });

    const { rows: disputeRows } = await client.query(
      `INSERT INTO disputes (milestone_id, raised_by, reason, status)
       VALUES ($1, $2, $3, 'OPEN')
       RETURNING id, milestone_id, reason, status, created_at`,
      [milestoneId, userId, reason.trim()]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Issue reported. Fairshake Support has been notified and will review the case.',
      dispute: disputeRows[0],
      status: 'IN_MEDIATION',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Report issue error:', error);
    res.status(500).json({ error: 'Failed to report issue: ' + error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
