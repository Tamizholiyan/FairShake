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

// POST /api/milestones/:id/submit - Provider submits deliverable (supports multiple photos/files and revision rounds)
router.post('/:id/submit', authenticateToken, upload.array('files', 5), async (req, res) => {
  const milestoneId = req.params.id;
  const userId = req.user.id;

  const uploadedFiles = req.files || (req.file ? [req.file] : []);
  if (!uploadedFiles || uploadedFiles.length === 0) {
    return res.status(400).json({ error: 'Please select at least one deliverable file to upload.' });
  }

  // Process and save all files
  const processedFiles = [];
  for (let i = 0; i < uploadedFiles.length; i++) {
    const file = uploadedFiles[i];
    const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const ext = path.extname(file.originalname) || '.bin';
    const savedFilename = `${Date.now()}_m${milestoneId}_${i}_${hash.substring(0, 10)}${ext}`;
    const filePath = path.join(uploadsDir, savedFilename);
    fs.writeFileSync(filePath, file.buffer);

    processedFiles.push({
      fileUrl: `/uploads/${savedFilename}`,
      originalFilename: file.originalname,
      hash,
    });
  }

  const primaryFile = processedFiles[0];

  let client;
  try {
    client = await db.getClient();
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
      [milestoneId, primaryFile.fileUrl, primaryFile.originalFilename, primaryFile.hash, revisionRound, userId]
    );

    const submissionId = subRows[0].id;

    // Insert all files into submission_files table
    for (const pf of processedFiles) {
      await client.query(
        `INSERT INTO submission_files (submission_id, file_url, original_filename, sha256_hash)
         VALUES ($1, $2, $3, $4)`,
        [submissionId, pf.fileUrl, pf.originalFilename, pf.hash]
      );
    }

    // Transition milestone status to SUBMITTED
    await transitionMilestone(client, milestoneId, 'SUBMITTED', userId, {
      submissionId,
      revisionRound,
      fileCount: processedFiles.length,
    });

    await client.query('COMMIT');

    res.json({
      message: revisionRound > 1 ? 'Revised deliverable submitted successfully.' : 'Deliverable submitted for client review.',
      submission: {
        ...subRows[0],
        files: processedFiles,
      },
      status: 'SUBMITTED',
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Milestone submission error:', error);
    res.status(500).json({ error: 'Failed to submit milestone deliverable: ' + error.message });
  } finally {
    if (client) client.release();
  }
});

// POST /api/milestones/:id/approve - Client approves milestone (triggers payout release)
router.post('/:id/approve', authenticateToken, async (req, res) => {
  const milestoneId = req.params.id;
  const userId = req.user.id;

  let client;
  try {
    client = await db.getClient();
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
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Milestone approval error:', error);
    res.status(500).json({ error: 'Failed to approve milestone: ' + error.message });
  } finally {
    if (client) client.release();
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

  let client;
  try {
    client = await db.getClient();
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
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Dispute creation error:', error);
    res.status(500).json({ error: 'Failed to create dispute: ' + error.message });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
