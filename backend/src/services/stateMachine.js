// services/stateMachine.js
// Two-Level State Machine with row-level transaction locks for Fairshake v2

const MILESTONE_TRANSITIONS = {
  PENDING: ['SUBMITTED'],
  SUBMITTED: ['RELEASED', 'DISPUTED'],
  DISPUTED: ['IN_MEDIATION'],
  IN_MEDIATION: ['RELEASED', 'REVISION_REQUESTED'],
  REVISION_REQUESTED: ['SUBMITTED'], // Resubmission loop
  RELEASED: [], // Terminal state
};

/**
 * Recomputes and updates the request's derived status based on its milestone states.
 */
async function recomputeRequestStatus(client, requestId) {
  const { rows: reqRows } = await client.query(
    'SELECT status, total_amount FROM requests WHERE id = $1 FOR UPDATE',
    [requestId]
  );
  if (reqRows.length === 0) return null;
  const currentReq = reqRows[0];

  // If already cancelled or in draft/pending payment, do not auto-transition
  if (['DRAFT', 'PENDING_PAYMENT', 'CANCELLED'].includes(currentReq.status)) {
    return currentReq.status;
  }

  const { rows: milestoneRows } = await client.query(
    'SELECT status, amount FROM milestones WHERE request_id = $1',
    [requestId]
  );

  if (milestoneRows.length === 0) return currentReq.status;

  const allReleased = milestoneRows.every(m => m.status === 'RELEASED');
  const anyStarted = milestoneRows.some(m => m.status !== 'PENDING');

  let newStatus = currentReq.status;
  if (allReleased) {
    newStatus = 'COMPLETED';
  } else if (anyStarted && currentReq.status === 'OPEN') {
    newStatus = 'IN_PROGRESS';
  }

  if (newStatus !== currentReq.status) {
    await client.query(
      'UPDATE requests SET status = $1, updated_at = NOW() WHERE id = $2',
      [newStatus, requestId]
    );

    await client.query(
      `INSERT INTO audit_log (request_id, event_type, event_data)
       VALUES ($1, 'REQUEST_STATUS_CHANGE', $2)`,
      [requestId, JSON.stringify({ from: currentReq.status, to: newStatus })]
    );
  }

  return newStatus;
}

/**
 * Transitions a milestone guarded by a database transaction and row-level FOR UPDATE lock.
 */
async function transitionMilestone(client, milestoneId, newStatus, actorId, meta = {}) {
  const { rows } = await client.query(
    'SELECT id, status, request_id, amount, sequence, title FROM milestones WHERE id = $1 FOR UPDATE',
    [milestoneId]
  );

  if (rows.length === 0) {
    throw new Error(`Milestone with id ${milestoneId} not found`);
  }

  const milestone = rows[0];
  const current = milestone.status;

  if (!MILESTONE_TRANSITIONS[current]?.includes(newStatus)) {
    throw new Error(`Illegal milestone transition: ${current} -> ${newStatus}`);
  }

  await client.query(
    'UPDATE milestones SET status = $1 WHERE id = $2',
    [newStatus, milestoneId]
  );

  await client.query(
    `INSERT INTO audit_log (request_id, milestone_id, event_type, event_data, actor_id)
     VALUES ($1, $2, 'MILESTONE_STATUS_CHANGE', $3, $4)`,
    [
      milestone.request_id,
      milestoneId,
      JSON.stringify({ from: current, to: newStatus, ...meta }),
      actorId,
    ]
  );

  await recomputeRequestStatus(client, milestone.request_id);

  return {
    ...milestone,
    status: newStatus,
  };
}

module.exports = {
  MILESTONE_TRANSITIONS,
  transitionMilestone,
  recomputeRequestStatus,
};
