'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import {
  Shield,
  Clock,
  CheckCircle,
  AlertTriangle,
  Upload,
  RotateCcw,
  FileCheck,
  ExternalLink,
  MessageSquare,
  Send,
  ArrowLeft,
  RefreshCw,
  User,
  MapPin,
} from 'lucide-react';

export default function RequestDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, getDashboardPath } = useAuth();
  const { t } = useLanguage();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form states
  const [activeUploadMilestoneId, setActiveUploadMilestoneId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [activeIssueMilestoneId, setActiveIssueMilestoneId] = useState(null);
  const [issueReason, setIssueReason] = useState('');

  // Support messages
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  const fetchRequestDetails = async () => {
    try {
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/requests/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load request.');
      setRequest(data.request);

      // Fetch messages
      const msgRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/messages?request_id=${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const msgData = await msgRes.json();
      if (msgRes.ok) setMessages(msgData.messages || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequestDetails();
  }, [id, user]);

  // Provider Submits / Resubmits Deliverable
  const handleMilestoneSubmit = async (e, milestoneId) => {
    e.preventDefault();
    if (!selectedFile) return;

    setActionLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('fairshake_token');
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/milestones/${milestoneId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit work.');

      setSuccessMessage(data.message);
      setSelectedFile(null);
      setActiveUploadMilestoneId(null);
      await fetchRequestDetails();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Client Approves Deliverable (Section 9.5 & 10.1)
  const handleMilestoneApprove = async (milestoneId) => {
    setActionLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/milestones/${milestoneId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve milestone.');

      setSuccessMessage(data.message);
      await fetchRequestDetails();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Client Raises an Issue (Section 10.1)
  const handleMilestoneIssue = async (e, milestoneId) => {
    e.preventDefault();
    if (!issueReason.trim()) return;

    setActionLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/milestones/${milestoneId}/dispute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: issueReason.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to raise issue.');

      setSuccessMessage(data.message);
      setIssueReason('');
      setActiveIssueMilestoneId(null);
      await fetchRequestDetails();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Send Message in Two-Way Conversation (Section 11)
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSendingMsg(true);
    try {
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          request_id: id,
          body: newMessage.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message.');

      setNewMessage('');
      await fetchRequestDetails();
    } catch (err) {
      alert(err.message);
    } finally {
      setSendingMsg(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '80px', color: 'var(--text-muted)' }}>
        Loading request details...
      </div>
    );
  }

  if (!request) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <p style={{ color: 'var(--accent-rose)', marginBottom: '16px' }}>Request not found.</p>
        <Link href={getDashboardPath(user?.role)} className="btn btn-secondary">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const isClient = request.client_id === user?.id;
  const isProvider = request.provider_id === user?.id;
  const isMediator = user?.role === 'MEDIATOR';

  const getMilestoneStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="badge badge-draft">{t('milestone_pending')}</span>;
      case 'SUBMITTED':
        return <span className="badge badge-open">{t('milestone_submitted')}</span>;
      case 'DISPUTED':
      case 'IN_MEDIATION':
        return <span className="badge badge-mediation">{t('milestone_in_mediation')}</span>;
      case 'REVISION_REQUESTED':
        return <span className="badge badge-revision">{t('milestone_revision_requested')}</span>;
      case 'RELEASED':
        return <span className="badge badge-completed">✓ {t('milestone_released')}</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="container" style={{ paddingTop: '28px' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <Link href={getDashboardPath(user?.role)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </Link>

        <button onClick={fetchRequestDetails} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
          <RefreshCw size={14} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.3)', color: 'var(--accent-rose)', marginBottom: '20px' }}>
          {error}
        </div>
      )}
      {successMessage && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--accent-emerald)', marginBottom: '20px' }}>
          {successMessage}
        </div>
      )}

      {/* Request Header Card */}
      <div className="glass-panel" style={{ padding: '30px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{request.title}</h1>
              {request.category_name && (
                <span className="badge" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                  {request.category_name}
                </span>
              )}
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '750px', lineHeight: 1.5 }}>
              {request.description}
            </p>

            {request.address_text && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                <MapPin size={14} color="var(--accent-blue)" />
                <span>Job Site: {request.address_text}</span>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('secured_payment')}</div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
              ₹{Number(request.total_amount).toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', fontWeight: 600, marginTop: '2px' }}>
              ✓ 100% Secured in Escrow
            </div>
          </div>
        </div>

        {/* Counterparties */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.85rem',
        }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '2px' }}>CLIENT / BUYER</div>
            <div style={{ fontWeight: 600 }}>{request.client_name} ({request.client_email})</div>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '2px' }}>SERVICE PROVIDER</div>
            <div style={{ fontWeight: 600 }}>
              {request.provider_name ? `${request.provider_name} (${request.provider_email})` : 'Awaiting Provider'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout: Milestone Timeline + Two-Way Conversation */}
      <div className="grid-cols-3" style={{ alignItems: 'start', gap: '28px' }}>
        {/* Milestones Timeline */}
        <div style={{ gridColumn: 'span 2' }}>
          <div className="glass-panel" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={20} color="var(--accent-indigo)" />
              <span>{t('milestones_breakdown')}</span>
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {request.milestones?.map((m) => {
                const isSubmitting = activeUploadMilestoneId === m.id;
                const isDisputing = activeIssueMilestoneId === m.id;
                const latestSubmission = m.submissions?.[m.submissions.length - 1];

                return (
                  <div
                    key={m.id}
                    className="glass-card"
                    style={{
                      padding: '22px',
                      borderLeft: m.status === 'RELEASED'
                        ? '4px solid var(--accent-emerald)'
                        : m.status === 'REVISION_REQUESTED'
                        ? '4px solid var(--accent-amber)'
                        : m.status === 'DISPUTED' || m.status === 'IN_MEDIATION'
                        ? '4px solid var(--accent-purple)'
                        : m.status === 'SUBMITTED'
                        ? '4px solid var(--accent-blue)'
                        : '4px solid var(--border-subtle)',
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{m.title}</span>
                          {getMilestoneStatusBadge(m.status)}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Target Date: {m.due_date ? new Date(m.due_date).toLocaleDateString() : 'Flexible'}
                        </div>
                      </div>

                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
                        ₹{Number(m.amount).toLocaleString('en-IN')}
                      </div>
                    </div>

                    {/* Submissions Revision History (Section 10.3) */}
                    {m.submissions?.length > 0 && (
                      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '12px 16px', marginBottom: '14px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          Deliverable History ({m.submissions.length} version{m.submissions.length > 1 ? 's' : ''}):
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {m.submissions.map((s) => (
                            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                              <span>Revision #{s.revision_round}: <strong>{s.original_filename}</strong> ({new Date(s.submitted_at).toLocaleDateString()})</span>
                              {s.file_url && (
                                <a
                                  href={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}${s.file_url}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '3px' }}
                                >
                                  <span>Download</span>
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Mediator Note if Revision was Requested (Section 10.2 & 10.3) */}
                    {m.dispute && m.dispute.status === 'RESOLVED' && m.dispute.resolution === 'REVISION_REQUESTED' && (
                      <div style={{ padding: '14px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '10px', marginBottom: '14px' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-amber)', marginBottom: '4px' }}>
                          Support Review Revision Instructions:
                        </div>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                          "{m.dispute.mediator_notes}"
                        </p>
                      </div>
                    )}

                    {/* Issue Claim if under dispute */}
                    {m.dispute && m.dispute.status === 'OPEN' && (
                      <div style={{ padding: '12px 14px', background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: '10px', marginBottom: '14px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-purple)', marginBottom: '2px' }}>
                          Reported Issue Under Review:
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                          "{m.dispute.reason}"
                        </p>
                      </div>
                    )}

                    {/* Deliverable Upload Form */}
                    {isSubmitting && (
                      <form onSubmit={(e) => handleMilestoneSubmit(e, m.id)} style={{ padding: '14px', background: 'var(--bg-secondary)', borderRadius: '10px', marginBottom: '14px' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                          Select Completed Deliverable File:
                        </div>
                        <input
                          type="file"
                          required
                          onChange={(e) => setSelectedFile(e.target.files[0])}
                          className="input-field"
                          style={{ marginBottom: '10px' }}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button type="submit" disabled={actionLoading} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                            {actionLoading ? 'Uploading...' : 'Confirm Upload'}
                          </button>
                          <button type="button" onClick={() => { setActiveUploadMilestoneId(null); setSelectedFile(null); }} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Issue Report Form */}
                    {isDisputing && (
                      <form onSubmit={(e) => handleMilestoneIssue(e, m.id)} style={{ padding: '14px', background: 'rgba(244, 63, 94, 0.08)', borderRadius: '10px', marginBottom: '14px' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-rose)', marginBottom: '6px' }}>
                          {t('raise_issue_title')}
                        </div>
                        <textarea
                          required
                          rows={2}
                          value={issueReason}
                          onChange={(e) => setIssueReason(e.target.value)}
                          placeholder={t('issue_reason_placeholder')}
                          className="input-field"
                          style={{ marginBottom: '10px' }}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button type="submit" disabled={actionLoading} className="btn btn-danger" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                            {actionLoading ? 'Submitting...' : 'Submit to Fairshake Support'}
                          </button>
                          <button type="button" onClick={() => { setActiveIssueMilestoneId(null); setIssueReason(''); }} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Action Controls */}
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {/* Provider Submit/Resubmit button */}
                      {(m.status === 'PENDING' || m.status === 'REVISION_REQUESTED') && request.status === 'IN_PROGRESS' && (isProvider || isMediator) && !isSubmitting && (
                        <button
                          onClick={() => setActiveUploadMilestoneId(m.id)}
                          className="btn btn-primary"
                          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                        >
                          <Upload size={14} />
                          <span>{m.status === 'REVISION_REQUESTED' ? t('reupload_revision') : t('submit_deliverable')}</span>
                        </button>
                      )}

                      {/* Client Approve or Issue buttons */}
                      {m.status === 'SUBMITTED' && (isClient || isMediator) && !isDisputing && (
                        <>
                          <button
                            onClick={() => handleMilestoneApprove(m.id)}
                            disabled={actionLoading}
                            className="btn btn-success"
                            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                          >
                            <CheckCircle size={14} />
                            <span>{t('approve_milestone')}</span>
                          </button>

                          <button
                            onClick={() => setActiveIssueMilestoneId(m.id)}
                            disabled={actionLoading}
                            className="btn btn-danger"
                            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                          >
                            <AlertTriangle size={14} />
                            <span>{t('raise_issue_btn')}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Two-Way Support Conversation (Section 11) */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={18} color="var(--accent-indigo)" />
            <span>{t('messages_title')}</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto', marginBottom: '14px' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No messages yet. Send a message to communicate with the other party or Fairshake Support.
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: msg.sender_id === user?.id ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    maxWidth: '90%',
                    alignSelf: msg.sender_id === user?.id ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                    <strong>{msg.sender_name}</strong> ({msg.sender_role}) • {new Date(msg.created_at).toLocaleTimeString()}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{msg.body}</div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={t('message_placeholder')}
              className="input-field"
              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
            />
            <button type="submit" disabled={sendingMsg} className="btn btn-primary" style={{ padding: '8px 14px' }}>
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
