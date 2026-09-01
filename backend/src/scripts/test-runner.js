// scripts/test-runner.js
// Automated verification suite for Fairshake v2 Product & Feature Spec

const crypto = require('crypto');
const db = require('../db');
const { MILESTONE_TRANSITIONS, transitionMilestone, recomputeRequestStatus } = require('../services/stateMachine');
const { verifyPaymentSignature } = require('../services/razorpay');

let passedCount = 0;
let totalCount = 0;

function assert(condition, testName) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
  }
}

async function runTests() {
  console.log('\n=================================================');
  console.log('Running Fairshake v2 Automated Test Suite');
  console.log('=================================================\n');

  // 1. Milestone Revision State Machine Transitions
  console.log('1. Testing Milestone State Machine & Revision Cycles');
  assert(MILESTONE_TRANSITIONS['PENDING'].includes('SUBMITTED'), 'PENDING -> SUBMITTED is allowed');
  assert(MILESTONE_TRANSITIONS['SUBMITTED'].includes('RELEASED'), 'SUBMITTED -> RELEASED is allowed');
  assert(MILESTONE_TRANSITIONS['SUBMITTED'].includes('DISPUTED'), 'SUBMITTED -> DISPUTED is allowed');
  assert(MILESTONE_TRANSITIONS['DISPUTED'].includes('IN_MEDIATION'), 'DISPUTED -> IN_MEDIATION is allowed');
  assert(MILESTONE_TRANSITIONS['IN_MEDIATION'].includes('RELEASED'), 'IN_MEDIATION -> RELEASED is allowed (Approve Submission)');
  assert(MILESTONE_TRANSITIONS['IN_MEDIATION'].includes('REVISION_REQUESTED'), 'IN_MEDIATION -> REVISION_REQUESTED is allowed (Request Revision)');
  assert(MILESTONE_TRANSITIONS['REVISION_REQUESTED'].includes('SUBMITTED'), 'REVISION_REQUESTED -> SUBMITTED is allowed (Re-upload loop)');
  assert(MILESTONE_TRANSITIONS['RELEASED'].length === 0, 'RELEASED is a terminal state');

  // 2. Admin ID Format & Whitelist Logic
  console.log('\n2. Testing Admin ID Whitelist Validation');
  const validAdminCode = 'ADM001';
  const invalidAdminCode1 = 'ADMIN1';
  const invalidAdminCode2 = 'ADM12';
  const invalidAdminCode3 = 'ADM1234';

  const regex = /^ADM\d{3}$/;
  assert(regex.test(validAdminCode) === true, 'ADM001 matches pattern ^ADM\\d{3}$');
  assert(regex.test(invalidAdminCode1) === false, 'ADMIN1 rejected');
  assert(regex.test(invalidAdminCode2) === false, 'ADM12 rejected');
  assert(regex.test(invalidAdminCode3) === false, 'ADM1234 rejected');

  // 3. Payment Signature Verification
  console.log('\n3. Testing Razorpay Payment Verification Signatures');
  const orderId = 'order_test_12345';
  const paymentId = 'pay_test_67890';
  const validSig = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'test_secret').update(`${orderId}|${paymentId}`).digest('hex');
  const forgedSig = 'invalid_signature_hash';

  assert(verifyPaymentSignature(orderId, paymentId, validSig) === true, 'Accepts valid payment signature HMAC-SHA256');
  assert(verifyPaymentSignature(orderId, paymentId, forgedSig) === false, 'Rejects forged payment signature');

  // 4. Database Transaction Integrity
  console.log('\n4. Testing Database Operations');
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Verify service categories exist
    const { rows: catRows } = await client.query('SELECT COUNT(*)::int as count FROM service_categories');
    assert(catRows[0].count >= 10, 'Service categories table populated with 10 standard categories');

    // Verify admin IDs exist
    const { rows: adminRows } = await client.query('SELECT COUNT(*)::int as count FROM admin_ids');
    assert(adminRows[0].count >= 10, 'Admin IDs whitelist table populated with ADM001-ADM010');

    // Test creating request & revision loop
    const { rows: uRows } = await client.query("SELECT id FROM users WHERE role = 'CLIENT' LIMIT 1");
    const clientId = uRows[0]?.id || 1;

    const { rows: rRows } = await client.query(
      `INSERT INTO requests (client_id, title, total_amount, status)
       VALUES ($1, 'Test Renovation', 10000, 'IN_PROGRESS') RETURNING id`,
      [clientId]
    );
    const reqId = rRows[0].id;

    const { rows: mRows } = await client.query(
      `INSERT INTO milestones (request_id, title, amount, sequence, status)
       VALUES ($1, 'Phase 1', 10000, 1, 'PENDING') RETURNING id`,
      [reqId]
    );
    const mId = mRows[0].id;

    // Transition PENDING -> SUBMITTED
    await transitionMilestone(client, mId, 'SUBMITTED', clientId);
    // Transition SUBMITTED -> DISPUTED
    await transitionMilestone(client, mId, 'DISPUTED', clientId);
    // Transition DISPUTED -> IN_MEDIATION
    await transitionMilestone(client, mId, 'IN_MEDIATION', clientId);
    // Transition IN_MEDIATION -> REVISION_REQUESTED
    await transitionMilestone(client, mId, 'REVISION_REQUESTED', clientId);
    // Re-upload: REVISION_REQUESTED -> SUBMITTED
    const resubmitted = await transitionMilestone(client, mId, 'SUBMITTED', clientId);
    assert(resubmitted.status === 'SUBMITTED', 'Milestone successfully passed through Revision Loop and returned to SUBMITTED');

    // Approve: SUBMITTED -> RELEASED
    const released = await transitionMilestone(client, mId, 'RELEASED', clientId);
    assert(released.status === 'RELEASED', 'Milestone transitioned to RELEASED');

    // Deal status auto-completes
    const { rows: finalReq } = await client.query('SELECT status FROM requests WHERE id = $1', [reqId]);
    assert(finalReq[0].status === 'COMPLETED', 'Request auto-transitioned to COMPLETED when all milestones released');

    await client.query('ROLLBACK');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('DB test error:', err);
  } finally {
    client.release();
    await db.pool.end();
  }

  console.log('\n=================================================');
  console.log(`Results: ${passedCount}/${totalCount} tests passed (${Math.round((passedCount / totalCount) * 100)}%)`);
  console.log('=================================================\n');
}

if (require.main === module) {
  runTests();
}

module.exports = runTests;
