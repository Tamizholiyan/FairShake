'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
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
} from 'lucide-react';

export default function MediatorDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [disputes, setDisputes] = useState([]);
  const [selectedDisputeId, setSelectedDisputeId] = useState(null);
  const [activeDisputeDetail, setActiveDisputeDetail] = useState(null);

  const [mediatorNotes, setMediatorNotes] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [error, setError] = useState('');

  const fetchDisputes = async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
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
    fetchDisputes();
  }, [user]);

  useEffect(() => {
    if (selectedDisputeId) {
      fetchDisputeDetail(selectedDisputeId);
    }
  }, [selectedDisputeId]);

  const handleResolve = async (resolution) => {
    if (!mediatorNotes.trim()) {
      alert('Please enter justification notes explaining the decision for both parties.');
      return;
    }

    setResolving(true);
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resolve dispute.');

      setMediatorNotes('');
      await fetchDisputes();
      await fetchDisputeDetail(selectedDisputeId);
    } catch (err) {
      alert(err.message);
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
          dispute_id: selectedDisputeId,
          request_id: activeDisputeDetail.request_id,
          body: newMessage.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message.');

      setNewMessage('');
      await fetchDisputeDetail(selectedDisputeId);
    } catch (err) {
      alert(err.message);
    } finally {
      setSendingMsg(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: '32px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '28px',
      }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Scale size={24} color="var(--accent-purple)" />
            <span>{t('support_dash_title')}</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            {t('support_dash_subtitle')}
          </p>
        </div>

        <button onClick={fetchDisputes} className="btn btn-secondary">
          <RefreshCw size={16} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {error && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '12px',
          background: 'rgba(244, 63, 94, 0.12)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          color: 'var(--accent-rose)',
          fontSize: '0.9rem',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <button onClick={fetchDisputes} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          Loading support cases...
        </div>
      ) : disputes.length === 0 ? (
        <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <CheckCircle size={32} color="var(--accent-emerald)" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>All Clear!</h3>
          <p>{t('no_issues_found')}</p>
        </div>
      ) : (
        <div className="grid-cols-3" style={{ alignItems: 'start', gap: '24px' }}>
          {/* Left Column: List of Reported Issues ONLY (Section 7.3) */}
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

          {/* Right 2 Cols: Active Dispute Review & Two-Way Resolution Panel */}
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
                    Client's Reported Issue:
                  </div>
                  <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    "{activeDisputeDetail.reason}"
                  </p>
                </div>

                {/* Full Submission Revision History (Section 10.3) */}
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '10px' }}>
                    Deliverable Submissions ({activeDisputeDetail.submissions?.length || 0})
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {activeDisputeDetail.submissions?.map((sub, idx) => (
                      <div key={sub.id} className="glass-card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                            Revision #{sub.revision_round}: {sub.original_filename}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Submitted on {new Date(sub.submitted_at).toLocaleString()}
                          </div>
                        </div>

                        {sub.file_url && (
                          <a
                            href={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}${sub.file_url}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          >
                            <span>Download Deliverable</span>
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resolution Verdict Actions (Section 10.2) */}
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
                      {/* Action 1: Approve Submission -> RELEASED */}
                      <button
                        onClick={() => handleResolve('RELEASED')}
                        disabled={resolving}
                        className="btn btn-success"
                        style={{ padding: '14px', flexDirection: 'column', gap: '4px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 700 }}>
                          <CheckCircle size={16} />
                          <span>{t('rule_approve_btn')}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                          Approve work & send payment to provider
                        </div>
                      </button>

                      {/* Action 2: Request Revision -> REVISION_REQUESTED */}
                      <button
                        onClick={() => handleResolve('REVISION_REQUESTED')}
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

              {/* Two-Way Messaging Panel (Section 11) */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={18} color="var(--accent-indigo)" />
                  <span>{t('messages_title')}</span>
                </h3>

                {/* Message stream */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto', marginBottom: '14px' }}>
                  {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No messages yet. Send a message to communicate with the client and provider.
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '10px',
                          background: m.sender_id === user?.id ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          maxWidth: '85%',
                          alignSelf: m.sender_id === user?.id ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                          <strong>{m.sender_name}</strong> ({m.sender_role}) • {new Date(m.created_at).toLocaleTimeString()}
                        </div>
                        <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{m.body}</div>
                      </div>
                    ))
                  )}
                </div>

                {/* Message input */}
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
      )}
    </div>
  );
}
