'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import {
  Scale,
  Shield,
  ArrowLeft,
  AlertTriangle,
  FileCheck,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';

export default function MediationPage() {
  const { disputeId } = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [resolutionResult, setResolutionResult] = useState(null);
  const [copiedHash, setCopiedHash] = useState('');

  const fetchDispute = async () => {
    try {
      const data = await api.getDispute(disputeId);
      setDispute(data.dispute);
    } catch (err) {
      setError(err.message || 'Failed to load dispute details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDispute();
  }, [disputeId, user]);

  const handleResolve = async (resolution) => {
    setActionLoading(true);
    setError('');
    try {
      const res = await api.resolveDispute(disputeId, {
        resolution,
        notes: notes.trim() || `Mediator arbitrated in favor of ${resolution === 'REFUNDED' ? 'Client' : 'Provider'} based on deliverable review.`,
      });
      setResolutionResult(res);
      await fetchDispute();
    } catch (err) {
      setError(err.message || 'Failed to resolve dispute');
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
        Loading arbitration case files...
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <p style={{ color: '#fb7185', marginBottom: '16px' }}>Dispute case not found.</p>
        <Link href="/dashboard" className="btn btn-secondary">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const latestSubmission = dispute.submissions?.[0];

  return (
    <div className="container" style={{ maxWidth: '850px', paddingTop: '32px' }}>
      <Link href={`/deals/${dispute.deal_id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
        <ArrowLeft size={16} />
        <span>Back to Deal #{dispute.deal_id} ({dispute.deal_title})</span>
      </Link>

      <div className="glass-panel" style={{ padding: '32px', marginBottom: '28px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(168, 85, 247, 0.4)', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700 }}>
                <Scale size={16} />
                <span>ARBITRATION CASE #{dispute.id}</span>
              </div>
              {dispute.status === 'OPEN' ? (
                <span className="badge badge-mediation">Pending Arbitration</span>
              ) : (
                <span className="badge badge-completed">Resolved: {dispute.resolution}</span>
              )}
            </div>

            <h1 style={{ fontSize: '1.65rem', fontWeight: 800 }}>
              Dispute on {dispute.milestone_title}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
              Agreement: <strong style={{ color: 'var(--text-primary)' }}>{dispute.deal_title}</strong>
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>DISPUTED ESCROW VALUE</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fb7185' }}>
              ₹{Number(dispute.milestone_amount).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Parties Summary */}
        <div className="grid-cols-2" style={{ marginBottom: '24px' }}>
          <div className="glass-card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>CLIENT (DISPUTE RAISER)</div>
            <div style={{ fontWeight: 700 }}>{dispute.client_name || dispute.client_email}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{dispute.client_email}</div>
          </div>

          <div className="glass-card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>PROVIDER (DEFENDANT)</div>
            <div style={{ fontWeight: 700 }}>{dispute.provider_name || dispute.provider_email}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{dispute.provider_email}</div>
          </div>
        </div>

        {/* Dispute Claim & Reason */}
        <div style={{
          padding: '20px',
          borderRadius: '12px',
          background: 'rgba(244, 63, 94, 0.1)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          marginBottom: '24px',
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fb7185', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} />
            <span>Formal Dispute Ground / Claim:</span>
          </div>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            "{dispute.reason}"
          </p>
        </div>

        {/* Deliverable Evidence with SHA-256 Hash Verification */}
        <div className="glass-card" style={{ padding: '20px', marginBottom: '28px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileCheck size={18} color="#10b981" />
            <span>Submitted Deliverable & Cryptographic Evidence</span>
          </h3>

          {latestSubmission ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                  File: {latestSubmission.original_filename}
                </span>
                {latestSubmission.file_url && (
                  <a
                    href={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}${latestSubmission.file_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  >
                    <span>Download Evidence File</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>

              {/* SHA-256 Hash verification callout */}
              <div style={{ background: 'rgba(0,0,0,0.4)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                  SERVER-SIDE COMPUTED SHA-256 HASH:
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="mono-tag" style={{ flex: 1, fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {latestSubmission.sha256_hash}
                  </span>
                  <button onClick={() => copyToClipboard(latestSubmission.sha256_hash)} title="Copy hash">
                    {copiedHash === latestSubmission.sha256_hash ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No deliverable file record found on file.
            </div>
          )}
        </div>

        {/* Notifications */}
        {error && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#fb7185',
            fontSize: '0.85rem',
            marginBottom: '20px',
          }}>
            <AlertCircle size={16} style={{ display: 'inline', marginRight: '6px' }} />
            {error}
          </div>
        )}

        {resolutionResult && (
          <div style={{
            padding: '16px',
            borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            marginBottom: '20px',
          }}>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>{resolutionResult.message}</div>
            {resolutionResult.refundDetails && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Real Razorpay Refund ID: <span className="mono-tag" style={{ color: '#38bdf8' }}>{resolutionResult.refundDetails.id}</span>
              </div>
            )}
          </div>
        )}

        {/* Mediator Verdict Form (Section 10 & 14) */}
        {dispute.status === 'OPEN' ? (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Arbitrator Findings & Judgment Notes:
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter justification for the arbitration ruling (e.g. deliverable failed inspection against contract specifications)..."
                className="input-field"
              />
            </div>

            <div className="grid-cols-2" style={{ gap: '16px' }}>
              {/* Rule for Client => Real Razorpay Refund */}
              <button
                onClick={() => handleResolve('REFUNDED')}
                disabled={actionLoading}
                className="btn btn-danger"
                style={{ padding: '16px', flexDirection: 'column', gap: '4px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1rem', fontWeight: 700 }}>
                  <XCircle size={18} />
                  <span>Rule for Client</span>
                </div>
                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                  Refund ₹{Number(dispute.milestone_amount).toLocaleString('en-IN')} (Real Razorpay Refund)
                </div>
              </button>

              {/* Rule for Provider => Simulated Release */}
              <button
                onClick={() => handleResolve('RELEASED')}
                disabled={actionLoading}
                className="btn btn-success"
                style={{ padding: '16px', flexDirection: 'column', gap: '4px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1rem', fontWeight: 700 }}>
                  <CheckCircle2 size={18} />
                  <span>Rule for Provider</span>
                </div>
                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                  Release ₹{Number(dispute.milestone_amount).toLocaleString('en-IN')} (Simulated Release)
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              This dispute has concluded with verdict: <strong style={{ color: 'var(--text-primary)' }}>{dispute.resolution}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
