'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { Shield, Plus, Trash2, CheckCircle, AlertCircle, ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function NewDealPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    providerEmail: 'provider@fairshake.com',
    total_amount: '',
  });

  const [milestones, setMilestones] = useState([
    { title: '1. Demolition & prep', amount: '', dueDate: '2026-09-01' },
    { title: '2. Core construction', amount: '', dueDate: '2026-09-15' },
    { title: '3. Finishing & cleanup', amount: '', dueDate: '2026-09-30' },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalAmountNum = parseFloat(formData.total_amount) || 0;
  const currentMilestonesSum = milestones.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
  const difference = totalAmountNum - currentMilestonesSum;
  const isSumValid = totalAmountNum > 0 && Math.abs(difference) < 0.01;

  const handleMilestoneChange = (index, field, value) => {
    const updated = [...milestones];
    updated[index][field] = value;
    setMilestones(updated);
  };

  const addMilestone = () => {
    setMilestones([
      ...milestones,
      { title: `Milestone #${milestones.length + 1}`, amount: '', dueDate: '' },
    ]);
  };

  const removeMilestone = (index) => {
    if (milestones.length <= 1) return;
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const loadDemoWorkedExample = () => {
    setFormData({
      title: 'Home Renovation Project - Apartment 4B',
      description: 'Complete renovation of 3BHK living area, kitchen counters, and custom electrical fixtures.',
      providerEmail: 'provider@fairshake.com',
      total_amount: '30000',
    });
    setMilestones([
      { title: '1. Demolition & prep', amount: '9000', dueDate: '2026-09-01' },
      { title: '2. Core construction', amount: '15000', dueDate: '2026-09-15' },
      { title: '3. Finishing & cleanup', amount: '6000', dueDate: '2026-09-30' },
    ]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isSumValid) {
      setError(`Milestone amounts (₹${currentMilestonesSum.toLocaleString('en-IN')}) must exactly equal total amount (₹${totalAmountNum.toLocaleString('en-IN')})`);
      return;
    }

    setLoading(true);
    try {
      const res = await api.createDeal({
        ...formData,
        total_amount: totalAmountNum,
        milestones: milestones.map((m, idx) => ({
          sequence: idx + 1,
          title: m.title,
          amount: parseFloat(m.amount),
          dueDate: m.dueDate || null,
        })),
      });

      router.push(`/deals/${res.deal.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create deal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '820px', paddingTop: '32px' }}>
      <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
        <ArrowLeft size={16} />
        <span>Back to Dashboard</span>
      </Link>

      <div className="glass-panel" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '6px' }}>Create Escrow Deal</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Define contract parameters and set up milestone allocations with hard mathematical sum integrity.
            </p>
          </div>

          <button
            type="button"
            onClick={loadDemoWorkedExample}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', padding: '8px 14px', borderColor: '#818cf8', color: '#818cf8' }}
          >
            <Sparkles size={16} />
            <span>Load ₹30,000 Demo Template</span>
          </button>
        </div>

        {error && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#fb7185',
            fontSize: '0.9rem',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* General Information */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Deal Title</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Full Stack Web Application Development"
                className="input-field"
              />
            </div>

            <div className="grid-cols-2">
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Provider's Email Address</label>
                <input
                  type="email"
                  required
                  value={formData.providerEmail}
                  onChange={(e) => setFormData({ ...formData, providerEmail: e.target.value })}
                  placeholder="provider@example.com"
                  className="input-field"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Total Project Escrow Amount (₹ INR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.total_amount}
                  onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                  placeholder="30000"
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Project Scope & Deliverable Description</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe project deliverables, timelines, and acceptance criteria..."
                className="input-field"
              />
            </div>
          </div>

          {/* Dynamic Milestone Split Builder */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Milestone Breakdown</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Each milestone is released or disputed independently.
                </p>
              </div>

              <button
                type="button"
                onClick={addMilestone}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              >
                <Plus size={14} />
                <span>Add Milestone</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {milestones.map((m, idx) => (
                <div key={idx} className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'rgba(99, 102, 241, 0.2)',
                    color: '#818cf8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                  }}>
                    {idx + 1}
                  </div>

                  <div style={{ flex: '1 1 200px' }}>
                    <input
                      type="text"
                      required
                      value={m.title}
                      onChange={(e) => handleMilestoneChange(idx, 'title', e.target.value)}
                      placeholder={`Milestone #${idx + 1} Title`}
                      className="input-field"
                      style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                    />
                  </div>

                  <div style={{ width: '150px' }}>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={m.amount}
                      onChange={(e) => handleMilestoneChange(idx, 'amount', e.target.value)}
                      placeholder="Amount (₹)"
                      className="input-field"
                      style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                    />
                  </div>

                  <div style={{ width: '150px' }}>
                    <input
                      type="date"
                      value={m.dueDate}
                      onChange={(e) => handleMilestoneChange(idx, 'dueDate', e.target.value)}
                      className="input-field"
                      style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                    />
                  </div>

                  {milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMilestone(idx)}
                      style={{ color: '#fb7185', padding: '6px' }}
                      title="Remove milestone"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Sum-Equals-Total Rule Real-Time Gauge */}
            <div style={{
              marginTop: '16px',
              padding: '16px',
              borderRadius: '12px',
              background: isSumValid ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
              border: `1px solid ${isSumValid ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isSumValid ? (
                  <CheckCircle size={20} color="#10b981" />
                ) : (
                  <AlertCircle size={20} color="#f59e0b" />
                )}
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isSumValid ? '#34d399' : '#fbbf24' }}>
                    {isSumValid
                      ? 'Milestone sum perfectly matches deal total amount (100% Allocated)'
                      : `Sum Mismatch: Allocated ₹${currentMilestonesSum.toLocaleString('en-IN')} of ₹${totalAmountNum.toLocaleString('en-IN')}`}
                  </div>
                  {!isSumValid && totalAmountNum > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Difference: {difference > 0 ? `₹${difference.toLocaleString('en-IN')} remaining to allocate` : `₹${Math.abs(difference).toLocaleString('en-IN')} over allocated`}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: isSumValid ? '#10b981' : '#f59e0b' }}>
                ₹{currentMilestonesSum.toLocaleString('en-IN')} / ₹{totalAmountNum.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!isSumValid || loading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
          >
            {loading ? 'Creating Deal...' : 'Create Escrow Agreement (DRAFT)'}
          </button>
        </form>
      </div>
    </div>
  );
}
