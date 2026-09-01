'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { Shield, Wrench, MapPin, CheckCircle, RefreshCw, ArrowRight, Zap } from 'lucide-react';

export default function ProviderDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const [openRequests, setOpenRequests] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [radiusKm, setRadiusKm] = useState(25);
  const [loadingOpen, setLoadingOpen] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [acceptingId, setAcceptingId] = useState(null);
  const [error, setError] = useState('');

  const fetchOpenRequests = async () => {
    setLoadingOpen(true);
    try {
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/requests/open?radius_km=${radiusKm}`, {
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

  const handleAcceptRequest = async (requestId) => {
    setAcceptingId(requestId);
    setError('');
    try {
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/requests/${requestId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to accept request.');
      router.push(`/requests/${requestId}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setAcceptingId(null);
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

        {/* Radius Filter Selector (Section 7.2) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-card)', padding: '6px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('radius_filter')}</span>
          <select
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-blue)',
              fontWeight: 700,
              fontSize: '0.9rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value={5} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>5 km</option>
            <option value={10} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>10 km</option>
            <option value={25} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>25 km</option>
            <option value={50} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>50 km</option>
            <option value={100} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>100 km</option>
          </select>
          <button onClick={() => { fetchOpenRequests(); fetchMyJobs(); }} className="btn btn-secondary" style={{ padding: '4px 8px' }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* 1. Open Requests Feed (Backed by Upfront Secured Escrow) */}
      <div className="glass-panel" style={{ padding: '28px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={20} color="#fbbf24" />
              <span>{t('nav_open_feed')} ({openRequests.length})</span>
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              All requests in this feed have 100% upfront secured funds ready for payout.
            </p>
          </div>
        </div>

        {loadingOpen ? (
          <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
            Searching nearby open requests...
          </div>
        ) : openRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            {t('no_open_jobs')} Try widening your distance radius filter above.
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{req.title}</span>
                    <span className="badge badge-completed" style={{ fontSize: '0.7rem' }}>
                      ✓ {t('secured_payment')}
                    </span>
                    {req.category_name && (
                      <span className="badge" style={{ background: 'var(--bg-secondary)' }}>
                        {req.category_name}
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>
                    {req.description}
                  </p>

                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.82rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span>Client: <strong style={{ color: 'var(--text-secondary)' }}>{req.client_name}</strong></span>
                    <span>Milestones: <strong style={{ color: 'var(--text-secondary)' }}>{req.milestone_count} stages</strong></span>
                    {req.distance_km !== null && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-blue)', fontWeight: 600 }}>
                        <MapPin size={13} />
                        <span>{req.distance_km} km away ({req.address_text || 'Job Site'})</span>
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
                      ₹{Number(req.total_amount).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Total Contract Value
                    </div>
                  </div>

                  <button
                    onClick={() => handleAcceptRequest(req.id)}
                    disabled={acceptingId === req.id}
                    className="btn btn-success"
                    style={{ padding: '10px 18px', fontSize: '0.9rem' }}
                  >
                    <CheckCircle size={16} />
                    <span>{acceptingId === req.id ? t('accepting') : t('accept_job_btn')}</span>
                  </button>
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
            Loading your jobs...
          </div>
        ) : myJobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
            You have not accepted any jobs yet. Accept an open request from the feed above to start working!
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{job.title}</span>
                    <span className={`badge ${job.status === 'COMPLETED' ? 'badge-completed' : 'badge-progress'}`}>
                      {job.status === 'COMPLETED' ? t('status_completed') : t('status_in_progress')}
                    </span>
                    {job.open_issues > 0 && (
                      <span className="badge badge-disputed">
                        {job.open_issues} {t('milestone_disputed')}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Client: {job.client_name} • Resolved Milestones: {job.completed_milestones || 0}/{job.total_milestones || 0}
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
    </div>
  );
}
