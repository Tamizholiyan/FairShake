'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { formatDateTime, formatTime } from '../../lib/formatDate';
import {
  Scale,
  Shield,
  CheckCircle,
  AlertTriangle,
  FileText,
  MessageSquare,
  Send,
  RefreshCw,
  Clock,
  ExternalLink,
  RotateCcw,
  XCircle,
  Image as ImageIcon,
  Check,
  X,
} from 'lucide-react';

export default function MediatorDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState('DISPUTES'); // 'DISPUTES' | 'CANCELLATIONS'

  // Milestone Disputes
  const [disputes, setDisputes] = useState([]);
  const [selectedDisputeId, setSelectedDisputeId] = useState(null);
  const [activeDisputeDetail, setActiveDisputeDetail] = useState(null);
  const [mediatorNotes, setMediatorNotes] = useState('');

  // Support messages
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  // Cancellation Requests
  const [cancellations, setCancellations] = useState([]);
  const [selectedCancelId, setSelectedCancelId] = useState(null);
  const [cancelNotes, setCancelNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchDisputes = async () => {
    try {
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/disputes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load reported issues.');
      setDisputes(data.disputes || []);

      if (data.disputes && data.disputes.length > 0 && !selectedDisputeId) {
        setSelectedDisputeId(data.disputes[0].id);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchCancellations = async () => {
    try {
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/requests/cancellations/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setCancellations(data.cancellations || []);
        if (data.cancellations && data.cancellations.length > 0 && !selectedCancelId) {
          setSelectedCancelId(data.cancellations[0].id);
        }
      }
    } catch (err) {
      console.warn('Fetch cancellations error:', err);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([fetchDisputes(), fetchCancellations()]);
    setLoading(false);
  };

  const fetchDisputeDetail = async (disputeId) => {
    if (!disputeId) return;
    try {
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/disputes/${disputeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setActiveDisputeDetail(data.dispute);
      }

      // Load messages
      const msgRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/messages?dispute_id=${disputeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const msgData = await msgRes.json();
      if (msgRes.ok) {
        setMessages(msgData.messages || []);
      }
    } catch (err) {
      console.warn('Detail fetch error', err);
    }
  };

  useEffect(() => {
    loadAll();
  }, [user]);

  useEffect(() => {
    if (selectedDisputeId) {
      fetchDisputeDetail(selectedDisputeId);
    }
  }, [selectedDisputeId]);

  const handleResolveDispute = async (resolution) => {
    if (!mediatorNotes.trim()) {
      alert('Please enter justification notes explaining the decision for both parties.');
      return;
    }

    setResolving(true);
    setError('');
    setSuccessMsg('');
    try {
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/disputes/${selectedDisputeId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          resolution,
          notes: mediatorNotes.trim(),
          mediator_notes: mediatorNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resolve dispute.');

      setSuccessMsg(data.message || 'Dispute successfully resolved.');
      setMediatorNotes('');
      await fetchDisputes();
      await fetchDisputeDetail(selectedDisputeId);
    } catch (err) {
      setError(err.message);
    } finally {
      setResolving(false);
    }
  };

  const handleResolveCancellation = async (cancellationId, resolution) => {
    if (!confirm(`Are you sure you want to ${resolution === 'APPROVED' ? 'APPROVE refund and cancel project' : 'REJECT cancellation'}?`)) return;

    setResolving(true);
    setError('');
    setSuccessMsg('');
    try {
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/requests/cancellations/${cancellationId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          resolution,
          notes: cancelNotes.trim(),
          mediator_notes: cancelNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resolve cancellation.');

      setSuccessMsg(data.message || 'Cancellation request resolved.');
      setCancelNotes('');
      await fetchCancellations();
    } catch (err) {
      setError(err.message);
    } finally {
      setResolving(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeDisputeDetail) return;

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
          recipient_id: activeDisputeDetail.client_id,
          request_id: activeDisputeDetail.request_id,
          dispute_id: activeDisputeDetail.id,
          body: `[Support Mediation] ${newMessage.trim()}`,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const msgObj = data.data || data.message_item || (typeof data.message === 'object' ? data.message : null);
        if (msgObj && typeof msgObj === 'object') {
          setMessages((prev) => [...prev, msgObj]);
        } else {
          await fetchDisputeDetail(selectedDisputeId);
        }
        setNewMessage('');
      }
    } catch (err) {
      console.error('Send message error:', err);
    } finally {
      setSendingMsg(false);
    }
  };

  const activeCancelDetail = cancellations.find(c => c.id === selectedCancelId) || cancellations[0];

  return (
    <div className="container" style={{ paddingTop: '32px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '28px',
      }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: '6px' }}>
            {t('mediator_dash_title')}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            {t('mediator_dash_subtitle')}
          </p>
        </div>

        <button
          onClick={loadAll}
          className="btn btn-secondary"
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          <RefreshCw size={14} />
          <span>Refresh All Cases</span>
        </button>
      </div>

      {/* Mode Tab Switcher */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '12px',
      }}>
        <button
          onClick={() => setActiveTab('DISPUTES')}
          className="btn"
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '0.9rem',
            background: activeTab === 'DISPUTES' ? 'var(--accent-indigo)' : 'var(--bg-secondary)',
            color: activeTab === 'DISPUTES' ? '#ffffff' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Scale size={16} />
          <span>Milestone Disputes ({disputes.filter(d => d.status === 'OPEN').length})</span>
        </button>

        <button
          onClick={() => setActiveTab('CANCELLATIONS')}
          className="btn"
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '0.9rem',
            background: activeTab === 'CANCELLATIONS' ? 'var(--accent-rose)' : 'var(--bg-secondary)',
            color: activeTab === 'CANCELLATIONS' ? '#ffffff' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <XCircle size={16} />
          <span>Cancellation & Refund Requests ({cancellations.length})</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.3)', color: 'var(--accent-rose)', marginBottom: '20px' }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--accent-emerald)', marginBottom: '20px' }}>
          {successMsg}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          Loading support cases...
        </div>
      ) : activeTab === 'DISPUTES' ? (
        disputes.length === 0 ? (
          <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <CheckCircle size={32} color="var(--accent-emerald)" style={{ margin: '0 auto 12px auto' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>All Clear!</h3>
            <p>{t('no_issues_found')}</p>
          </div>
        ) : (
          <div className="grid-cols-3" style={{ alignItems: 'start', gap: '24px' }}>
            {/* Left Column: List of Reported Issues */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px' }}>
                {t('active_issues')} ({disputes.length})
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {disputes.map((d) => {
                  const isSelected = selectedDisputeId === d.id;
                  return (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDisputeId(d.id)}
                      className="glass-card"
                      style={{
                        padding: '14px',
                        textAlign: 'left',
                        borderColor: isSelected ? 'var(--accent-purple)' : 'var(--border-subtle)',
                        background: isSelected ? 'rgba(168, 85, 247, 0.12)' : 'var(--bg-card)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span className={`badge ${d.status === 'OPEN' ? 'badge-disputed' : 'badge-completed'}`}>
                          {d.status === 'OPEN' ? 'Pending Review' : d.resolution}
                        </span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                          ₹{Number(d.milestone_amount).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '2px' }}>
                        {d.milestone_title}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Request: {d.request_title}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right 2 Cols: Active Dispute Review */}
            {activeDisputeDetail ? (
              <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="glass-panel" style={{ padding: '28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
                    <div>
                      <span className="badge badge-mediation" style={{ marginBottom: '8px' }}>
                        Case #{activeDisputeDetail.id} • {activeDisputeDetail.status === 'OPEN' ? 'Under Review' : `Resolved (${activeDisputeDetail.resolution})`}
                      </span>
                      <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{activeDisputeDetail.milestone_title}</h2>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                        Contract: <strong>{activeDisputeDetail.request_title}</strong>
                      </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>DISPUTED AMOUNT</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-rose)' }}>
                        ₹{Number(activeDisputeDetail.milestone_amount).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* Parties */}
                  <div className="grid-cols-2" style={{ marginBottom: '20px' }}>
                    <div className="glass-card" style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CLIENT (RAISER)</div>
                      <div style={{ fontWeight: 700 }}>{activeDisputeDetail.client_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{activeDisputeDetail.client_email}</div>
                    </div>

                    <div className="glass-card" style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>SERVICE PROVIDER</div>
                      <div style={{ fontWeight: 700 }}>{activeDisputeDetail.provider_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{activeDisputeDetail.provider_email}</div>
                    </div>
                  </div>

                  {/* Issue Claim */}
                  <div style={{ padding: '16px', background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: '10px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-rose)', marginBottom: '4px' }}>
                      {t('client_reported_issue')}:
                    </div>
                    <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      "{activeDisputeDetail.reason}"
                    </p>
                  </div>

                  {/* Multi-Photo Submission Revision History */}
                  <div style={{ marginBottom: '24px' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '10px' }}>
                      {t('deliverable_submissions')} ({activeDisputeDetail.submissions?.length || 0})
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {activeDisputeDetail.submissions?.map((sub, idx) => (
                        <div key={sub.id} className="glass-card" style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                              {t('revision_prefix')} #{sub.revision_round}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {t('submitted_on')} {formatDateTime(sub.submitted_at)}
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {(sub.files && sub.files.length > 0 ? sub.files : [{ file_url: sub.file_url, original_filename: sub.original_filename }]).map((f, fIdx) => (
                              <a
                                key={f.id || fIdx}
                                href={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}${f.file_url}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-secondary"
                                style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '6px' }}
                              >
                                <ImageIcon size={13} />
                                <span>{f.original_filename || `Evidence File #${fIdx + 1}`}</span>
                                <ExternalLink size={12} />
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Resolution Verdict Actions */}
                  {activeDisputeDetail.status === 'OPEN' ? (
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                          Arbitrator Explanation & Written Decision (Visible to both parties): *
                        </label>
                        <textarea
                          rows={3}
                          value={mediatorNotes}
                          onChange={(e) => setMediatorNotes(e.target.value)}
                          placeholder={t('mediator_notes_placeholder')}
                          className="input-field"
                        />
                      </div>

                      <div className="grid-cols-2" style={{ gap: '14px' }}>
                        <button
                          onClick={() => handleResolveDispute('RELEASED')}
                          disabled={resolving}
                          className="btn btn-success"
                          style={{ padding: '14px', flexDirection: 'column', gap: '4px' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 700 }}>
                            <CheckCircle size={16} />
                            <span>{t('rule_approve_btn')}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                            Approve work & send payout to provider
                          </div>
                        </button>

                        <button
                          onClick={() => handleResolveDispute('REVISION_REQUESTED')}
                          disabled={resolving}
                          className="btn btn-secondary"
                          style={{ padding: '14px', flexDirection: 'column', gap: '4px', borderColor: 'var(--accent-amber)', color: 'var(--accent-amber)' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 700 }}>
                            <RotateCcw size={16} />
                            <span>{t('rule_revision_btn')}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                            Instruct provider to fix deliverable & re-upload
                          </div>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '14px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>
                        Resolved: {activeDisputeDetail.resolution}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        Note: "{activeDisputeDetail.mediator_notes}"
                      </div>
                    </div>
                  )}
                </div>

                {/* Two-Way Messaging Panel */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MessageSquare size={18} color="var(--accent-indigo)" />
                    <span>{t('messages_title')}</span>
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto', marginBottom: '14px' }}>
                    {messages.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No messages yet. Send a message to communicate with the client and provider.
                      </div>
                    ) : (
                      messages.map((m, idx) => {
                        if (!m) return null;
                        const isMe = m.sender_id === user?.id;
                        const senderName = m.sender_name || (isMe ? 'You (Mediator)' : 'Participant');
                        const senderRole = m.sender_role || (isMe ? 'MEDIATOR' : '');
                        const bodyText = typeof m === 'string' ? m : (m.body || '');
                        if (!bodyText) return null;

                        return (
                          <div
                            key={m.id || idx}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '10px',
                              background: isMe ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
                              border: '1px solid var(--border-subtle)',
                              maxWidth: '85%',
                              alignSelf: isMe ? 'flex-end' : 'flex-start',
                            }}
                          >
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                              <strong>{senderName}</strong> {senderRole ? `(${senderRole})` : ''} • {formatTime(m.created_at || new Date())}
                            </div>
                            <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{bodyText}</div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={t('message_placeholder')}
                      className="input-field"
                    />
                    <button type="submit" disabled={sendingMsg} className="btn btn-primary" style={{ padding: '10px 16px' }}>
                      <Send size={16} />
                    </button>
                  </form>
                </div>
              </div>
            ) : null}
          </div>
        )
      ) : (
        /* CANCELLATIONS TAB */
        cancellations.length === 0 ? (
          <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <CheckCircle size={32} color="var(--accent-emerald)" style={{ margin: '0 auto 12px auto' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>No Pending Cancellations</h3>
            <p>There are no active cancellation or refund applications to review.</p>
          </div>
        ) : (
          <div className="grid-cols-3" style={{ alignItems: 'start', gap: '24px' }}>
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px' }}>
                Pending Requests ({cancellations.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {cancellations.map((c) => {
                  const isSelected = (selectedCancelId || cancellations[0]?.id) === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCancelId(c.id)}
                      className="glass-card"
                      style={{
                        padding: '14px',
                        textAlign: 'left',
                        borderColor: isSelected ? 'var(--accent-rose)' : 'var(--border-subtle)',
                        background: isSelected ? 'rgba(244, 63, 94, 0.12)' : 'var(--bg-card)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span className="badge badge-disputed">Pending Refund</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-rose)' }}>
                          ₹{Number(c.unreleased_amount).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '2px' }}>
                        {c.request_title}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Client: {c.client_name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {activeCancelDetail ? (
              <div style={{ gridColumn: 'span 2' }}>
                <div className="glass-panel" style={{ padding: '28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
                    <div>
                      <span className="badge badge-revision" style={{ marginBottom: '8px' }}>
                        Cancellation Application #{activeCancelDetail.id}
                      </span>
                      <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{activeCancelDetail.request_title}</h2>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>UNRELEASED REFUND</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-rose)' }}>
                        ₹{Number(activeCancelDetail.unreleased_amount).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div className="grid-cols-2" style={{ marginBottom: '20px' }}>
                    <div className="glass-card" style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CLIENT (APPLICANT)</div>
                      <div style={{ fontWeight: 700 }}>{activeCancelDetail.client_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{activeCancelDetail.client_email}</div>
                    </div>

                    <div className="glass-card" style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ASSIGNED PROVIDER</div>
                      <div style={{ fontWeight: 700 }}>{activeCancelDetail.provider_name || 'None (Open Request)'}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{activeCancelDetail.provider_email || '—'}</div>
                    </div>
                  </div>

                  <div style={{ padding: '16px', background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: '10px', marginBottom: '24px' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-rose)', marginBottom: '4px' }}>
                      Client's Cancellation Reason:
                    </div>
                    <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      "{activeCancelDetail.reason}"
                    </p>
                  </div>

                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                      Mediator Decision Notes (Optional):
                    </label>
                    <textarea
                      rows={2}
                      value={cancelNotes}
                      onChange={(e) => setCancelNotes(e.target.value)}
                      placeholder="Enter resolution notes..."
                      className="input-field"
                    />
                  </div>

                  <div className="grid-cols-2" style={{ gap: '14px' }}>
                    <button
                      onClick={() => handleResolveCancellation(activeCancelDetail.id, 'APPROVED')}
                      disabled={resolving}
                      className="btn btn-danger"
                      style={{ padding: '14px', fontSize: '0.95rem' }}
                    >
                      <CheckCircle size={16} />
                      <span>Approve Refund (₹{Number(activeCancelDetail.unreleased_amount).toLocaleString('en-IN')}) & Cancel</span>
                    </button>

                    <button
                      onClick={() => handleResolveCancellation(activeCancelDetail.id, 'REJECTED')}
                      disabled={resolving}
                      className="btn btn-secondary"
                      style={{ padding: '14px', fontSize: '0.95rem' }}
                    >
                      <XCircle size={16} />
                      <span>Reject Cancellation Application</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )
      )}
    </div>
  );
}
