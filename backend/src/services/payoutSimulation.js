// services/payoutSimulation.js
//
// NOTE: This function intentionally does NOT call a real money-movement
// API. Real disbursal to a third party requires RazorpayX Payouts or
// Route, both of which require business KYC we do not have as a student
// team. This function exists so the *rest* of the codebase (the state
// machine, the audit log, the UI) behaves exactly as it would in
// production — only this one function would need to be replaced with a
// real API call once the business is verified.

/**
 * Simulates milestone fund release to the provider.
 * Logs event parameters and returns simulated confirmation.
 */
async function simulateMilestoneRelease(client, milestoneId, amount) {
  // In production, this is where you would call:
  // instance.payouts.create({ account_number, fund_account_id, amount, mode: 'IMPS', purpose: 'payout' })
  // via RazorpayX, once business KYC is complete.
  
  console.log(`[SIMULATED PAYOUT] Released ₹${amount} for Milestone #${milestoneId} to Provider account.`);
  return {
    simulated: true,
    milestone_id: milestoneId,
    amount: Number(amount),
    timestamp: new Date().toISOString(),
    channel: 'Simulated RazorpayX IMPS',
    note: 'Simulated payout leg - requires verified RazorpayX business KYC in production',
  };
}

module.exports = {
  simulateMilestoneRelease,
};
