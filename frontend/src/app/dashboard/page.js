'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Shield, Plus, ArrowRight, Lock, CheckCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDeals = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getDeals();
      setDeals(data.deals || []);
    } catch (err) {
      setError(err.message || 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, [user]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return <span className="badge badge-draft">Draft</span>;
      case 'LOCKED':
        return <span className="badge badge-locked">🔒 Escrow Locked</span>;
      case 'IN_PROGRESS':
        return <span className="badge badge-progress">⚡ In Progress</span>;
      case 'COMPLETED':
        return <span className="badge badge-completed">✓ Completed</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const totalLockedValue = deals
    .filter(d => ['LOCKED', 'IN_PROGRESS', 'COMPLETED'].includes(d.status))
    .reduce((acc, d) => acc + Number(d.total_amount || 0), 0);

  const activeDisputesCount = deals.reduce((acc, d) => acc + (d.open_disputes || 0), 0);

  return (
    <div className="container" style={{ paddingTop: '32px' }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '32px',
      }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
            Escrow Dashboard
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Logged in as <strong style={{ color: 'var(--text-primary)' }}>{user?.name || 'User'}</strong> ({user?.role || 'CLIENT'})
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={fetchDeals} className="btn btn-secondary" title="Refresh Deals">
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
          <Link href="/deals/new" className="btn btn-primary">
            <Plus size={18} />
            <span>Create New Deal</span>
          </Link>
        </div>
      </div>

      {/* Overview Metrics Cards */}
      <div className="grid-cols-3" style={{ marginBottom: '32px' }}>
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL DEALS</span>
            <Shield size={18} color="#818cf8" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{deals.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Active contracts & agreements</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>LOCKED ESCROW VOLUME</span>
            <Lock size={18} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8' }}>
            ₹{totalLockedValue.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Secured in Razorpay sandbox</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>ACTIVE DISPUTES</span>
            <AlertTriangle size={18} color={activeDisputesCount > 0 ? '#fb7185' : '#10b981'} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: activeDisputesCount > 0 ? '#fb7185' : 'var(--text-primary)' }}>
            {activeDisputesCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Awaiting neutral arbitrator review</div>
        </div>
      </div>

      {/* Deals List */}
      <div className="glass-panel" style={{ padding: '28px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Your Agreements & Deals</span>
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Loading escrow deals...
          </div>
        ) : error ? (
          <div style={{
            padding: '16px',
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '10px',
            color: '#fb7185',
          }}>
            {error}
          </div>
        ) : deals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: '16px', fontSize: '1rem' }}>No deals found for this account.</p>
            <Link href="/deals/new" className="btn btn-primary">
              Create Your First Deal
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {deals.map((deal) => {
              const totalM = deal.total_milestones || 0;
              const completedM = deal.completed_milestones || 0;
              const progressPct = totalM > 0 ? Math.round((completedM / totalM) * 100) : 0;

              return (
                <Link
                  key={deal.id}
                  href={`/deals/${deal.id}`}
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
                  <div style={{ flex: '1 1 300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                        {deal.title}
                      </span>
                      {getStatusBadge(deal.status)}
                      {deal.open_disputes > 0 && (
                        <span className="badge badge-mediation">
                          {deal.open_disputes} In Dispute
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '18px', fontSize: '0.82rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      <span>Client: <strong style={{ color: 'var(--text-secondary)' }}>{deal.client_name || deal.client_email}</strong></span>
                      <span>Provider: <strong style={{ color: 'var(--text-secondary)' }}>{deal.provider_name || deal.provider_email || 'Unassigned'}</strong></span>
                      <span>Milestones: <strong style={{ color: 'var(--text-secondary)' }}>{completedM}/{totalM} resolved</strong></span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginTop: '12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '9999px', height: '6px', width: '100%', maxWidth: '320px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${progressPct}%`,
                        background: deal.status === 'COMPLETED' ? 'var(--accent-emerald)' : 'linear-gradient(90deg, #6366f1, #38bdf8)',
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>
                        ₹{Number(deal.total_amount).toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {deal.status === 'DRAFT' ? 'Pending Upfront Lock' : 'Escrow Protected'}
                      </div>
                    </div>

                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#818cf8',
                    }}>
                      <ArrowRight size={18} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
