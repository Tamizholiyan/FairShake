'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import {
  Shield,
  Lock,
  CheckCircle,
  AlertTriangle,
  Upload,
  FileCheck,
  Scale,
  RefreshCw,
  Copy,
  ExternalLink,
  ArrowLeft,
  DollarSign,
  Clock,
  FileText,
  AlertCircle,
  Check,
} from 'lucide-react';

export default function DealDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [deal, setDeal] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Modals / forms state
  const [activeUploadMilestoneId, setActiveUploadMilestoneId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [activeDisputeMilestoneId, setActiveDisputeMilestoneId] = useState(null);
  const [disputeReason, setDisputeReason] = useState('');

  const [copiedHash, setCopiedHash] = useState('');

  const fetchDealDetails = async () => {
    try {
      const data = await api.getDeal(id);
      setDeal(data.deal);

      const ledgerData = await api.getDealLedger(id).catch(() => null);
      if (ledgerData) setLedger(ledgerData);
    } catch (err) {
      setError(err.message || 'Failed to load deal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDealDetails();
  }, [id, user]);

  // Razorpay Checkout Integration (Section 8.2)
  const handleLockFundsWithRazorpay = async () => {
    setActionLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // 1. Backend creates Order via Razorpay Orders API
      const orderData = await api.lockDeal(id);

      if (typeof window.Razorpay === 'undefined') {
        throw new Error('Razorpay SDK is not loaded yet. Please refresh the page.');
      }

      // 2. Open Razorpay Checkout Modal
      const options = {
        key: orderData.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount, // in paise
        currency: orderData.currency || 'INR',
        name: 'Fairshake Escrow Protocol',
        description: `Escrow Lock for "${deal.title}"`,
        order_id: orderData.orderId,
        handler: async function (response) {
          try {
            setActionLoading(true);
            // 3. Verify signature server-side and lock funds
            await api.verifyLockDeal(id, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            setSuccessMessage(`Payment verified! Escrow of ₹${Number(deal.total_amount).toLocaleString('en-IN')} locked successfully.`);
            await fetchDealDetails();
          } catch (vErr) {
            setError('Payment verification failed: ' + vErr.message);
          } finally {
            setActionLoading(false);
          }
        },
        prefill: {
          name: user?.name || 'Arjun Mehta',
          email: user?.email || 'client@fairshake.com',
          contact: user?.phone || '+919876543210',
        },
        theme: {
          color: '#4f46e5',
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        setError(`Payment failed: ${response.error?.description || 'Transaction declined'}`);
        setActionLoading(false);
      });
      rzp.open();
    } catch (err) {
      setError(err.message || 'Failed to initiate Razorpay payment');
      setActionLoading(false);
    }
  };

  // Provider Submits Deliverable with server-side SHA-256 Hash Binding
  const handleMilestoneSubmit = async (e, milestoneId) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a deliverable file to upload');
      return;
    }

    setActionLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await api.submitMilestone(milestoneId, formData);
      setSuccessMessage(`Deliverable submitted! SHA-256 Hash: ${res.sha256_hash.substring(0, 16)}...`);
      setSelectedFile(null);
      setActiveUploadMilestoneId(null);
      await fetchDealDetails();
    } catch (err) {
      setError(err.message || 'Failed to submit deliverable');
    } finally {
      setActionLoading(false);
    }
  };

  // Client Approves Deliverable (Simulated Payout)
  const handleMilestoneApprove = async (milestoneId, amount) => {
    setActionLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await api.approveMilestone(milestoneId);
      setSuccessMessage(`Milestone approved! ₹${amount.toLocaleString('en-IN')} released to provider (simulated).`);
      await fetchDealDetails();
    } catch (err) {
      setError(err.message || 'Failed to approve milestone');
    } finally {
      setActionLoading(false);
    }
  };

  // Client Disputes Deliverable (Transitions to MEDIATION)
  const handleMilestoneDispute = async (e, milestoneId) => {
    e.preventDefault();
    if (!disputeReason.trim()) {
      setError('Please provide a specific reason for the dispute');
      return;
    }

    setActionLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      await api.disputeMilestone(milestoneId, disputeReason);
      setSuccessMessage('Dispute opened! Milestone moved to neutral MEDIATION.');
      setDisputeReason('');
      setActiveDisputeMilestoneId(null);
      await fetchDealDetails();
    } catch (err) {
      setError(err.message || 'Failed to dispute milestone');
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(''), 2500);
  };

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '80px', color: 'var(--text-muted)' }}>
        Loading deal and escrow state...
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <p style={{ color: '#fb7185', marginBottom: '16px' }}>Deal not found.</p>
        <Link href="/dashboard" className="btn btn-secondary">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const isClient = deal.client_id === user?.id || user?.role === 'CLIENT';
  const isProvider = deal.provider_id === user?.id || user?.role === 'PROVIDER';
  const isMediator = user?.role === 'MEDIATOR';

  return (
    <div className="container" style={{ paddingTop: '28px' }}>
      {/* Top Breadcrumb & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </Link>

        <button onClick={fetchDealDetails} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
          <RefreshCw size={14} />
          <span>Sync State</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '12px',
          background: 'rgba(244, 63, 94, 0.15)',
          border: '1px solid rgba(244, 63, 94, 0.35)',
          color: '#fb7185',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '12px',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          color: '#34d399',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <CheckCircle size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Deal Header Card */}
      <div className="glass-panel" style={{ padding: '30px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{deal.title}</h1>
              {deal.status === 'DRAFT' && <span className="badge badge-draft">Draft</span>}
              {deal.status === 'LOCKED' && <span className="badge badge-locked">🔒 Escrow Locked</span>}
              {deal.status === 'IN_PROGRESS' && <span className="badge badge-progress">⚡ In Progress</span>}
              {deal.status === 'COMPLETED' && <span className="badge badge-completed">✓ Completed</span>}
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '750px', lineHeight: 1.5 }}>
              {deal.description || 'No description provided.'}
            </p>
          </div>

          {/* Escrow Value & Primary Action */}
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL ESCROW VALUE</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#38bdf8' }}>
              ₹{Number(deal.total_amount).toLocaleString('en-IN')}
            </div>

            {deal.status === 'DRAFT' && isClient && (
              <button
                onClick={handleLockFundsWithRazorpay}
                disabled={actionLoading}
                className="btn btn-razorpay"
                style={{ padding: '12px 24px', fontSize: '0.95rem' }}
              >
                <Lock size={18} />
                <span>{actionLoading ? 'Connecting...' : `Lock ₹${Number(deal.total_amount).toLocaleString('en-IN')} via Razorpay`}</span>
              </button>
            )}

            {deal.status === 'DRAFT' && !isClient && (
              <div style={{ fontSize: '0.8rem', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.1)', padding: '6px 12px', borderRadius: '8px' }}>
                Awaiting Client to lock escrow funds
              </div>
            )}
          </div>
        </div>

        {/* Counterparties & Payment Reference Badges */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          paddingTop: '20px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.85rem',
        }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '2px' }}>CLIENT / BUYER</div>
            <div style={{ fontWeight: 600 }}>{deal.client_name || deal.client_email}</div>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '2px' }}>PROVIDER / CONTRACTOR</div>
            <div style={{ fontWeight: 600 }}>{deal.provider_name || deal.provider_email || 'Unassigned'}</div>
          </div>

          {deal.razorpay_order_id && (
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '2px' }}>RAZORPAY ORDER ID</div>
              <span className="mono-tag" style={{ color: '#38bdf8' }}>{deal.razorpay_order_id}</span>
            </div>
          )}

          {deal.razorpay_payment_id && (
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '2px' }}>RAZORPAY PAYMENT ID</div>
              <span className="mono-tag" style={{ color: '#34d399' }}>{deal.razorpay_payment_id}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Layout: Milestones Timeline + Live Fund Ledger */}
      <div className="grid-cols-3" style={{ alignItems: 'start', gap: '28px' }}>
        {/* Left 2 Cols: Milestone State Machine Timeline */}
        <div style={{ gridColumn: 'span 2' }}>
          <div className="glass-panel" style={{ padding: '28px', marginBottom: '28px' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={20} color="#818cf8" />
              <span>Milestone Execution Timeline</span>
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {deal.milestones?.map((m) => {
                const isSubmitting = activeUploadMilestoneId === m.id;
                const isDisputing = activeDisputeMilestoneId === m.id;
                const latestSubmission = m.submissions?.[0];

                return (
                  <div
                    key={m.id}
                    className="glass-card"
                    style={{
                      padding: '24px',
                      borderLeft: m.status === 'RELEASED'
                        ? '4px solid var(--accent-emerald)'
                        : m.status === 'REFUNDED'
                        ? '4px solid var(--accent-rose)'
                        : m.status === 'MEDIATION'
                        ? '4px solid var(--accent-purple)'
                        : m.status === 'SUBMITTED'
                        ? '4px solid var(--accent-blue)'
                        : '4px solid rgba(255,255,255,0.15)',
                    }}
                  >
                    {/* Milestone Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                            {m.title}
                          </span>
                          {/* Milestone status badge */}
                          {m.status === 'PENDING' && <span className="badge badge-pending">Pending</span>}
                          {m.status === 'SUBMITTED' && <span className="badge badge-submitted">Work Submitted</span>}
                          {m.status === 'DISPUTED' && <span className="badge badge-disputed">Disputed</span>}
                          {m.status === 'MEDIATION' && <span className="badge badge-mediation">⚡ In Neutral Mediation</span>}
                          {m.status === 'RELEASED' && <span className="badge badge-released">✓ ₹{Number(m.amount).toLocaleString('en-IN')} Released (Simulated)</span>}
                          {m.status === 'REFUNDED' && <span className="badge badge-refunded">↩ ₹{Number(m.amount).toLocaleString('en-IN')} Refunded (Real Razorpay)</span>}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Target Due: {m.due_date ? new Date(m.due_date).toLocaleDateString() : 'Flexible'}
                        </div>
                      </div>

                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>
                        ₹{Number(m.amount).toLocaleString('en-IN')}
                      </div>
                    </div>

                    {/* Submission / Deliverable Hash Card */}
                    {latestSubmission && (
                      <div style={{
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '10px',
                        padding: '14px',
                        marginBottom: '16px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
                            <FileCheck size={16} color="#10b981" />
                            <span>Submitted Deliverable: {latestSubmission.original_filename || 'Work File'}</span>
                          </div>
                          {latestSubmission.file_url && (
                            <a
                              href={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}${latestSubmission.file_url}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: '0.78rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <span>Download</span>
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>

                        {/* SHA-256 Hash Display */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(15, 23, 42, 0.8)', padding: '8px 12px', borderRadius: '6px' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>SHA-256 HASH:</span>
                          <span className="mono-tag" style={{ fontSize: '0.75rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {latestSubmission.sha256_hash}
                          </span>
                          <button
                            onClick={() => copyToClipboard(latestSubmission.sha256_hash)}
                            title="Copy SHA-256 hash"
                            style={{ color: copiedHash === latestSubmission.sha256_hash ? '#10b981' : 'var(--text-muted)' }}
                          >
                            {copiedHash === latestSubmission.sha256_hash ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Dispute Info if present */}
                    {m.dispute && (
                      <div style={{
                        background: 'rgba(244, 63, 94, 0.1)',
                        border: '1px solid rgba(244, 63, 94, 0.3)',
                        borderRadius: '10px',
                        padding: '14px',
                        marginBottom: '16px',
                      }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fb7185', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertTriangle size={16} />
                          <span>Dispute Raised: "{m.dispute.reason}"</span>
                        </div>
                        {m.dispute.status === 'OPEN' && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              Awaiting neutral review by arbitrator.
                            </span>
                            <Link href={`/mediation/${m.dispute.id}`} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#c084fc', borderColor: '#a855f7' }}>
                              <Scale size={14} />
                              <span>Open Mediation Portal</span>
                            </Link>
                          </div>
                        )}
                        {m.dispute.status === 'RESOLVED' && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                            Arbitrator Ruling: <strong style={{ color: 'var(--text-primary)' }}>{m.dispute.resolution}</strong>
                            {m.dispute.mediator_notes && ` — "${m.dispute.mediator_notes}"`}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Provider Submit Form */}
                    {isSubmitting && (
                      <form onSubmit={(e) => handleMilestoneSubmit(e, m.id)} style={{ padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', marginBottom: '14px' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>
                          Upload Deliverable (Server-Side SHA-256 Signed):
                        </div>
                        <input
                          type="file"
                          required
                          onChange={(e) => setSelectedFile(e.target.files[0])}
                          className="input-field"
                          style={{ marginBottom: '12px' }}
                        />
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button type="submit" disabled={actionLoading} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                            {actionLoading ? 'Uploading & Hashing...' : 'Confirm Submission'}
                          </button>
                          <button type="button" onClick={() => { setActiveUploadMilestoneId(null); setSelectedFile(null); }} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Client Dispute Form */}
                    {isDisputing && (
                      <form onSubmit={(e) => handleMilestoneDispute(e, m.id)} style={{ padding: '16px', background: 'rgba(244, 63, 94, 0.08)', borderRadius: '10px', marginBottom: '14px' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fb7185', marginBottom: '8px' }}>
                          State the reason for disputing this milestone deliverable:
                        </div>
                        <textarea
                          required
                          rows={2}
                          value={disputeReason}
                          onChange={(e) => setDisputeReason(e.target.value)}
                          placeholder="e.g. Concrete finish does not match contracted ASTM specifications; electrical rough-ins failed inspection."
                          className="input-field"
                          style={{ marginBottom: '12px' }}
                        />
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button type="submit" disabled={actionLoading} className="btn btn-danger" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                            {actionLoading ? 'Submitting Dispute...' : 'Escalate to Mediation'}
                          </button>
                          <button type="button" onClick={() => { setActiveDisputeMilestoneId(null); setDisputeReason(''); }} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Role-Based Interactive Action Buttons */}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {/* Provider Submit Button: Section 10 */}
                      {m.status === 'PENDING' && (deal.status === 'LOCKED' || deal.status === 'IN_PROGRESS') && (isProvider || isMediator) && !isSubmitting && (
                        <button
                          onClick={() => setActiveUploadMilestoneId(m.id)}
                          className="btn btn-primary"
                          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                        >
                          <Upload size={16} />
                          <span>Submit Milestone #{m.sequence} Deliverable</span>
                        </button>
                      )}

                      {/* Client Approve and Dispute Buttons: Section 10 */}
                      {m.status === 'SUBMITTED' && (isClient || isMediator) && !isDisputing && (
                        <>
                          <button
                            onClick={() => handleMilestoneApprove(m.id, Number(m.amount))}
                            disabled={actionLoading}
                            className="btn btn-success"
                            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                          >
                            <CheckCircle size={16} />
                            <span>Approve & Release ₹{Number(m.amount).toLocaleString('en-IN')}</span>
                          </button>

                          <button
                            onClick={() => setActiveDisputeMilestoneId(m.id)}
                            disabled={actionLoading}
                            className="btn btn-danger"
                            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                          >
                            <AlertTriangle size={16} />
                            <span>Dispute Milestone</span>
                          </button>
                        </>
                      )}

                      {/* Mediator resolution redirect */}
                      {m.status === 'MEDIATION' && m.dispute && (
                        <Link
                          href={`/mediation/${m.dispute.id}`}
                          className="btn btn-primary"
                          style={{ padding: '8px 16px', fontSize: '0.85rem', background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)' }}
                        >
                          <Scale size={16} />
                          <span>Arbitrate Dispute as Mediator</span>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Audit Log Trail */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="#38bdf8" />
              <span>Immutable Audit Trail</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
              {deal.audit_log?.map((log, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', fontSize: '0.82rem' }}>
                  <div>
                    <span className="mono-tag" style={{ color: '#818cf8', marginRight: '8px' }}>{log.event_type}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {log.event_data?.from && log.event_data?.to ? `${log.event_data.from} → ${log.event_data.to}` : ''}
                      {log.event_data?.reason ? ` (Reason: ${log.event_data.reason})` : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {new Date(log.created_at).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Real-time Fund Ledger & Integrity Card (Section 1, 2, 8) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign size={18} color="#10b981" />
                <span>Escrow Fund Ledger</span>
              </h3>
              <span className="badge badge-locked">Live Ledger</span>
            </div>

            {ledger?.summary && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>REAL ESCROW LOCKED</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#38bdf8' }}>
                    ₹{ledger.summary.totalLockedReal.toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Razorpay Orders API (Real Sandbox Lock)
                  </div>
                </div>

                <div style={{ background: 'rgba(244, 63, 94, 0.08)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>REAL REFUNDS ISSUED</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fb7185' }}>
                    ₹{ledger.summary.totalRefundedReal.toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Razorpay Refunds API (Real Sandbox Refund)
                  </div>
                </div>

                <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SIMULATED PROVIDER RELEASES</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fbbf24' }}>
                    ₹{ledger.summary.totalReleasedSimulated.toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    *Simulated (RazorpayX requires business KYC)
                  </div>
                </div>

                {/* Mathematical Invariant Verification Gauge */}
                {ledger.summary.isComplete && (
                  <div style={{
                    background: ledger.summary.invariantHolds ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                    border: `1px solid ${ledger.summary.invariantHolds ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`,
                    padding: '12px',
                    borderRadius: '10px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.85rem', color: ledger.summary.invariantHolds ? '#34d399' : '#fb7185' }}>
                      <CheckCircle size={16} />
                      <span>Mathematical Invariant Verified</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Released (₹{ledger.summary.totalReleasedSimulated}) + Refunded (₹{ledger.summary.totalRefundedReal}) == Total (₹{deal.total_amount})
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Individual Fund Event Trail */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                MONEY TRAIL EVENTS ({deal.fund_events?.length || 0})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {deal.fund_events?.map((fe, idx) => (
                  <div key={idx} style={{ padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: fe.is_real_money ? '#34d399' : '#fbbf24' }}>
                        ₹{Number(fe.amount).toLocaleString('en-IN')}
                      </span>
                      <span className={`badge ${fe.is_real_money ? 'badge-real-money' : 'badge-simulated'}`}>
                        {fe.is_real_money ? 'Real Money' : 'Simulated'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Type: <strong>{fe.event_type}</strong>
                    </div>
                    {fe.razorpay_reference_id && (
                      <div style={{ fontSize: '0.7rem', color: '#38bdf8', marginTop: '2px' }}>
                        Ref: {fe.razorpay_reference_id}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
