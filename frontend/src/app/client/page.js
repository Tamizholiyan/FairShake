'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { Shield, Plus, ArrowRight, CheckCircle, Clock, AlertTriangle, RefreshCw, XCircle } from 'lucide-react';

export default function ClientDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);

  const fetchRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/requests/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch requests.');
      setRequests(data.requests || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [user]);

  const handleCancelRequest = async (requestId) => {
    if (!confirm('Are you sure you want to cancel this request? 100% of your secured payment will be refunded immediately.')) {
      return;
    }

    setCancellingId(requestId);
    try {
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/requests/${requestId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel request.');
      await fetchRequests();
    } catch (err) {
      alert(err.message);
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING_PAYMENT':
        return <span className="badge badge-draft">{t('status_pending_payment')}</span>;
      case 'OPEN':
        return <span className="badge badge-open">🟢 {t('status_open')}</span>;
      case 'IN_PROGRESS':
        return <span className="badge badge-progress">⚡ {t('status_in_progress')}</span>;
      case 'COMPLETED':
        return <span className="badge badge-completed">✓ {t('status_completed')}</span>;
      case 'CANCELLED':
        return <span className="badge badge-draft">✕ {t('status_cancelled')}</span>;
      default:
        return <span className="badge">{status}</span>;
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
            {t('client_dash_title')}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            {t('client_dash_subtitle')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={fetchRequests} className="btn btn-secondary" title="Refresh">
            <RefreshCw size={16} />
          </button>
          <Link href="/requests/new" className="btn btn-primary">
            <Plus size={18} />
            <span>{t('post_new_request_btn')}</span>
          </Link>
        </div>
      </div>

      {/* Requests List */}
      <div className="glass-panel" style={{ padding: '28px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px' }}>
          {t('your_requests')}
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Loading your service requests...
          </div>
        ) : error ? (
          <div style={{ padding: '16px', background: 'rgba(244, 63, 94, 0.12)', borderRadius: '10px', color: 'var(--accent-rose)' }}>
            {error}
          </div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: '16px', fontSize: '1rem' }}>{t('no_requests_found')}</p>
            <Link href="/requests/new" className="btn btn-primary">
              {t('post_new_request_btn')}
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {requests.map((req) => {
              const totalM = req.total_milestones || 0;
              const completedM = req.completed_milestones || 0;
              const progressPct = totalM > 0 ? Math.round((completedM / totalM) * 100) : 0;
              const canCancel = req.status === 'OPEN';

              return (
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
                  }}
                >
                  <div style={{ flex: '1 1 320px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <Link href={`/requests/${req.id}`} style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                        {req.title}
                      </Link>
                      {getStatusBadge(req.status)}
                      {req.category_name && (
                        <span className="badge" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                          {req.category_name}
                        </span>
                      )}
                      {req.open_issues > 0 && (
                        <span className="badge badge-disputed">
                          {req.open_issues} {t('milestone_disputed')}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '18px', fontSize: '0.82rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      <span>Provider: <strong style={{ color: 'var(--text-secondary)' }}>{req.provider_name || 'Awaiting acceptance'}</strong></span>
                      <span>Progress: <strong style={{ color: 'var(--text-secondary)' }}>{completedM}/{totalM} milestones</strong></span>
                      {req.address_text && <span>Location: <strong style={{ color: 'var(--text-secondary)' }}>{req.address_text}</strong></span>}
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginTop: '12px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '9999px', height: '6px', width: '100%', maxWidth: '300px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${progressPct}%`,
                        background: req.status === 'COMPLETED' ? 'var(--accent-emerald)' : 'linear-gradient(90deg, #6366f1, #38bdf8)',
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
                        ₹{Number(req.total_amount).toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {t('secured_payment')}
                      </div>
                    </div>

                    {/* Pre-acceptance cancellation button (Section 9.7) */}
                    {canCancel && (
                      <button
                        onClick={() => handleCancelRequest(req.id)}
                        disabled={cancellingId === req.id}
                        className="btn btn-secondary"
                        style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--accent-rose)', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                        title="Cancel this open request and get 100% full refund"
                      >
                        <XCircle size={14} />
                        <span>{cancellingId === req.id ? t('cancelling') : t('cancel_request')}</span>
                      </button>
                    )}

                    <Link
                      href={`/requests/${req.id}`}
                      className="btn btn-primary"
                      style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                    >
                      <span>View</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
