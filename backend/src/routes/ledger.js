const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/deals/:id/ledger - Detailed fund events & financial invariant analysis
router.get('/:id/ledger', authenticateToken, async (req, res) => {
  const dealId = req.params.id;

  try {
    const { rows: dealRows } = await db.query('SELECT * FROM deals WHERE id = $1', [dealId]);
    if (dealRows.length === 0) return res.status(404).json({ error: 'Deal not found' });
    const deal = dealRows[0];

    const { rows: events } = await db.query(
      `SELECT fe.*, m.title as milestone_title, m.sequence as milestone_sequence 
       FROM fund_events fe
       LEFT JOIN milestones m ON fe.milestone_id = m.id
       WHERE fe.deal_id = $1
       ORDER BY fe.created_at ASC`,
      [dealId]
    );

    const { rows: milestones } = await db.query(
      'SELECT * FROM milestones WHERE deal_id = $1 ORDER BY sequence ASC',
      [dealId]
    );

    let totalLocked = 0;
    let totalRealRefunded = 0;
    let totalSimulatedReleased = 0;

    events.forEach(e => {
      const amt = Number(e.amount);
      if (e.event_type === 'LOCK_COLLECTED') totalLocked += amt;
      if (e.event_type === 'MILESTONE_REFUND_REAL') totalRealRefunded += amt;
      if (e.event_type === 'MILESTONE_RELEASE_SIMULATED') totalSimulatedReleased += amt;
    });

    const totalResolved = totalRealRefunded + totalSimulatedReleased;
    const remainingLocked = Math.max(0, totalLocked - totalResolved);

    const isComplete = deal.status === 'COMPLETED' || (milestones.length > 0 && milestones.every(m => ['RELEASED', 'REFUNDED'].includes(m.status)));
    const invariantHolds = isComplete ? Math.abs(totalResolved - Number(deal.total_amount)) < 0.01 : null;

    res.json({
      dealId: deal.id,
      dealTitle: deal.title,
      dealStatus: deal.status,
      totalAmount: Number(deal.total_amount),
      summary: {
        totalLockedReal: totalLocked,
        totalRefundedReal: totalRealRefunded,
        totalReleasedSimulated: totalSimulatedReleased,
        remainingLockedBalance: remainingLocked,
        isComplete,
        invariantHolds,
        invariantFormula: 'sum(released milestone amounts) + sum(refunded milestone amounts) == total_amount',
      },
      events,
    });
  } catch (error) {
    console.error('Ledger fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch ledger: ' + error.message });
  }
});

module.exports = router;
