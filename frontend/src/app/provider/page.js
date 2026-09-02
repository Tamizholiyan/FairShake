'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { Shield, Wrench, MapPin, CheckCircle, RefreshCw, ArrowRight, Zap, Send, X, FileText, Phone } from 'lucide-react';
import RatingStars from '../../components/RatingStars';

export default function ProviderDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const [openRequests, setOpenRequests] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [radiusKm, setRadiusKm] = useState(25);
  const [loadingOpen, setLoadingOpen] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [applyingReq, setApplyingReq] = useState(null);
  const [proposedAmount, setProposedAmount] = useState('');
  const [proposalMessage, setProposalMessage] = useState('');
  const [submittingApp, setSubmittingApp] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchOpenRequests = async () => {
    setLoadingOpen(true);
    try {
      const token = localStorage.getItem('fairshake_token');
      const radParam = radiusKm ? `?radius_km=${radiusKm}` : '';
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/requests/open${radParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch open requests.');
      setOpenRequests(data.requests || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingOpen(false);
    }
  };

  const fetchMyJobs = async () => {
    setLoadingJobs(true);
    try {
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/requests/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch your jobs.');
      setMyJobs(data.requests || []);
    } catch (err) {
      console.warn('Jobs error', err);
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    fetchOpenRequests();
    fetchMyJobs();
  }, [radiusKm, user]);

  const handleOpenApplyModal = (req) => {
    setApplyingReq(req);
    setProposedAmount(String(req.total_amount));
    setProposalMessage('');
    setError('');
  };

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!applyingReq) return;

    const amt = Number(proposedAmount);
    if (isNaN(amt) || amt <= 0 || amt % 100 !== 0) {
      setError('Proposed quote must be a valid multiple of ₹100.');
      return;
    }

    setSubmittingApp(true);
    setError('');
    try {
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/requests/${applyingReq.id}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          proposed_amount: amt,
          message: proposalMessage.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit application.');

      setSuccessMsg('Proposal submitted! The client can now review your application and contact you.');
      setApplyingReq(null);
      await fetchOpenRequests();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingApp(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: '32px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '32px',
      }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: '6px' }}>
            {t('provider_dash_title')}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            {t('provider_dash_subtitle')}
            {user?.category_name && <span> — <strong style={{ color: 'var(--text-primary)' }}>{user.category_name}</strong></span>}
          </p>
        </div>

        <button
          onClick={() => { fetchOpenRequests(); fetchMyJobs(); }}
          className="btn btn-secondary"
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          <RefreshCw size={14} />
          <span>{t('refresh_feed')}</span>
        </button>
      </div>

      {successMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: 'var(--accent-emerald)',
          fontSize: '0.9rem',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 1. Open Job Feed Panel */}
      <div className="glass-panel" style={{ padding: '28px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={20} color="var(--accent-emerald)" />
              <span>{t('open_requests_feed')}</span>
              <span className="badge badge-open" style={{ fontSize: '0.72rem' }}>
                {openRequests.length} available
              </span>
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '2px' }}>
              Browse guaranteed client escrow requests. Submit quotes and connect directly.
            </p>
          </div>

          {/* Distance Radius Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={15} color="var(--text-muted)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('radius_filter')}:</span>
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.82rem',
                fontWeight: 600,
                outline: 'none',
              }}
            >
              <option value="5" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>Within 5 km</option>
              <option value="15" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>Within 15 km</option>
              <option value="25" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>Within 25 km</option>
              <option value="50" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>Within 50 km</option>
              <option value="100" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>All (100 km)</option>
            </select>
          </div>
        </div>

        {loadingOpen ? (
          <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
            {t('loading_jobs')}
          </div>
        ) : openRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <p style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{t('no_open_jobs')}</p>
            <p style={{ fontSize: '0.82rem', maxWidth: '480px', margin: '0 auto', color: 'var(--text-muted)' }}>
              Showing only open requests matching your trade ({user?.category_name || 'your category'}). Requests appear once the client funds the escrow.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {openRequests.map((req) => (
              <div
                key={req.id}
                className="glass-card"
                style={{
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px',
                  borderLeft: '4px solid var(--accent-emerald)',
                }}
              >
                <div style={{ flex: '1 1 320px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{req.title}</span>
                    <span className="badge badge-completed" style={{ fontSize: '0.7rem' }}>
                      ✓ {t('secured_payment')}
                    </span>
                    {req.category_name && (
                      <span className="badge" style={{ background: 'var(--bg-secondary)' }}>
                        {req.category_name}
                      </span>
                    )}
                    {req.application_count > 0 && (
                      <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--accent-indigo)' }}>
                        {req.application_count} applicant{req.application_count > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>
                    {req.description}
                  </p>

                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.82rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span>{t('client_label')}: <strong style={{ color: 'var(--text-secondary)' }}>{req.client_name}</strong></span>
                    <span>{t('milestones_breakdown')}: <strong style={{ color: 'var(--text-secondary)' }}>{req.milestone_count} {t('stages_label')}</strong></span>
                    {req.distance_km !== null && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-blue)', fontWeight: 600 }}>
                        <MapPin size={13} />
                        <span>{req.distance_km} km ({req.address_text || 'Job Site'})</span>
                      </span>
                    )}
                  </div>

                  {/* Milestone Breakdown */}
                  {req.milestones && req.milestones.length > 0 && (
                    <div style={{ marginTop: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '10px 14px' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {t('milestone_breakdown_heading')} ({req.milestones.length} {t('stages_label')}):
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {req.milestones.map((m, mIdx) => (
                          <div key={m.id || mIdx} style={{ fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <div>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                #{m.sequence}: {m.title}
                              </span>
                              {m.description && (
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                                  {m.description}
                                </p>
                              )}
                            </div>
                            <span style={{ fontWeight: 700, color: 'var(--accent-blue)', whiteSpace: 'nowrap' }}>
                              ₹{Number(m.amount).toLocaleString('en-IN')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
                      ₹{Number(req.total_amount).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {t('contract_value')}
                    </div>
                  </div>

                  {req.my_application_status ? (
                    <span className="badge badge-progress" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                      ✓ Applied ({req.my_application_status})
                    </span>
                  ) : (
                    <button
                      onClick={() => handleOpenApplyModal(req)}
                      className="btn btn-primary"
                      style={{ padding: '10px 18px', fontSize: '0.9rem' }}
                    >
                      <Send size={16} />
                      <span>Apply & Propose Quote</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. My Active & Completed Jobs List */}
      <div className="glass-panel" style={{ padding: '28px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px' }}>
          {t('my_active_jobs')} ({myJobs.length})
        </h2>

        {loadingJobs ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
            {t('loading_requests')}
          </div>
        ) : myJobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
            {t('no_open_jobs')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {myJobs.map((job) => (
              <Link
                key={job.id}
                href={`/requests/${job.id}`}
                className="glass-card"
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '14px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{job.title}</span>
                    {job.provider_id === user?.id ? (
                      <span className={`badge ${job.status === 'COMPLETED' ? 'badge-completed' : 'badge-progress'}`}>
                        {job.status === 'COMPLETED' ? t('status_completed') : 'Assigned to You'}
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-indigo)' }}>
                        Proposal Submitted (Pending Client Acceptance)
                      </span>
                    )}
                    {job.open_issues > 0 && (
                      <span className="badge badge-disputed">
                        {job.open_issues} {t('milestone_disputed')}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {t('client_label')}: {job.client_name} • {t('milestones_breakdown')}: {job.completed_milestones || 0}/{job.total_milestones || 0}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
                      ₹{Number(job.total_amount).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <ArrowRight size={16} color="var(--text-muted)" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Apply / Proposal Quote Modal */}
      {applyingReq && (
        <div className="modal-overlay" onClick={() => setApplyingReq(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Send size={20} color="var(--accent-indigo)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Submit Proposal & Quote</h3>
              </div>
              <button onClick={() => setApplyingReq(null)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: '10px', marginBottom: '20px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '2px' }}>{applyingReq.title}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Client Budget: <strong style={{ color: 'var(--accent-blue)' }}>₹{Number(applyingReq.total_amount).toLocaleString('en-IN')}</strong> ({applyingReq.milestone_count} milestones)
              </div>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(244, 63, 94, 0.12)', color: 'var(--accent-rose)', fontSize: '0.82rem', marginBottom: '16px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleApplySubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Your Proposed Quote (₹ INR in 100s) *
                  </label>
                  <input
                    type="number"
                    step="100"
                    min="100"
                    required
                    value={proposedAmount}
                    onChange={(e) => setProposedAmount(e.target.value)}
                    placeholder="e.g. 30000"
                    className="input-field"
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    You can match the client's budget or propose a negotiated quote.
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Proposal Pitch & Availability Note (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={proposalMessage}
                    onChange={(e) => setProposalMessage(e.target.value)}
                    placeholder="e.g. I have 8 years experience in plumbing and can start on Thursday. All materials provided."
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  disabled={submittingApp}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '12px', fontSize: '0.95rem' }}
                >
                  {submittingApp ? 'Submitting Proposal...' : 'Submit Proposal to Client'}
                </button>
                <button
                  type="button"
                  onClick={() => setApplyingReq(null)}
                  className="btn btn-secondary"
                  style={{ padding: '12px 18px', fontSize: '0.95rem' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
