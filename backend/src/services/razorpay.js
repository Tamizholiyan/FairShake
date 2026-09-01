// services/razorpay.js
// Real Razorpay Payment Gateway integration: Orders API, Verification, Refunds

const Razorpay = require('razorpay');
const crypto = require('crypto');
require('dotenv').config();

const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;

const razorpayInstance = new Razorpay({
  key_id,
  key_secret,
});

/**
 * Creates a secure payment order for the full request total amount.
 * Amount is passed in paise (1 INR = 100 paise).
 */
async function createRequestOrder(requestId, totalAmountInINR) {
  const amountInPaise = Math.round(Number(totalAmountInINR) * 100);
  const options = {
    amount: amountInPaise,
    currency: 'INR',
    receipt: `req_${requestId}`,
    payment_capture: 1,
    notes: {
      request_id: String(requestId),
      platform: 'Fairshake Secure Payment',
    },
  };

  const order = await razorpayInstance.orders.create(options);
  return order;
}

/**
 * Verifies the client-side checkout signature using HMAC-SHA256.
 */
function verifyPaymentSignature(orderId, paymentId, signature) {
  if (!orderId || !paymentId || !signature) return false;
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', key_secret)
    .update(body)
    .digest('hex');
  return expectedSignature === signature;
}

/**
 * Issues a 100% full refund on Razorpay when a Client cancels an unaccepted OPEN request.
 */
async function issueFullRefund(paymentId, amountInINR, notes = {}) {
  const amountInPaise = Math.round(Number(amountInINR) * 100);
  const refund = await razorpayInstance.payments.refund(paymentId, {
    amount: amountInPaise,
    notes: {
      reason: 'Fairshake Request Cancellation - Full Refund to Client',
      ...notes,
    },
  });
  return refund;
}

module.exports = {
  razorpayInstance,
  createRequestOrder,
  createDealOrder: createRequestOrder,
  verifyPaymentSignature,
  issueFullRefund,
};
