'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { Shield, Plus, Trash2, CheckCircle, AlertCircle, ArrowLeft, MapPin, Lock } from 'lucide-react';

export default function NewRequestPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    total_amount: '',
    address_text: '',
    latitude: null,
    longitude: null,
  });

  const [milestones, setMilestones] = useState([
    { title: 'Phase 1: Initial Setup & Materials', amount: '', dueDate: '' },
    { title: 'Phase 2: Core Execution', amount: '', dueDate: '' },
    { title: 'Phase 3: Final Finishing & Handover', amount: '', dueDate: '' },
  ]);

  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/auth/categories`);
        const data = await res.json();
        if (data.categories) setCategories(data.categories);
      } catch (e) {
        console.warn('Failed to load categories', e);
      }
    }
    loadCategories();
  }, []);

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
      { title: `Phase #${milestones.length + 1}`, amount: '', dueDate: '' },
    ]);
  };

  const removeMilestone = (index) => {
    if (milestones.length <= 1) return;
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          address_text: prev.address_text || `GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
        }));
        setGpsLoading(false);
      },
      (err) => {
        setError('GPS error: ' + err.message);
        setGpsLoading(false);
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isSumValid) {
      setError(`Milestone amounts (₹${currentMilestonesSum.toLocaleString('en-IN')}) must exactly equal the total amount (₹${totalAmountNum.toLocaleString('en-IN')}).`);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('fairshake_token');
      // 1. Create request in PENDING_PAYMENT state
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          total_amount: totalAmountNum,
          milestones: milestones.map((m, idx) => ({
            sequence: idx + 1,
            title: m.title,
            amount: parseFloat(m.amount),
            dueDate: m.dueDate || null,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create request.');

      const newRequestId = data.request.id;

      // 2. Immediate Upfront Razorpay Lock Flow (Section 9.2)
      const lockRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/requests/${newRequestId}/lock`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const orderData = await lockRes.json();
      if (!lockRes.ok) throw new Error(orderData.error || 'Failed to create payment order.');

      if (typeof window.Razorpay === 'undefined') {
        throw new Error('Payment gateway SDK not loaded. Please refresh the page.');
      }

      const options = {
        key: orderData.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Fairshake Secure Payment',
        description: `Upfront Payment Security for "${formData.title}"`,
        order_id: orderData.orderId,
        handler: async function (paymentResponse) {
          try {
            const verifyRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/requests/${newRequestId}/verify-lock`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(paymentResponse),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Payment verification failed.');

            router.push(`/client`);
          } catch (vErr) {
            setError(vErr.message);
          }
        },
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: user?.phone || '+919876543210',
        },
        theme: { color: '#4f46e5' },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        setError(`Payment failed: ${resp.error?.description || 'Declined'}`);
        setLoading(false);
      });
      rzp.open();
    } catch (err) {
      setError(err.message || 'Failed to post request.');
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '820px', paddingTop: '32px' }}>
      <Link href="/client" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
        <ArrowLeft size={16} />
        <span>Back to Client Dashboard</span>
      </Link>

      <div className="glass-panel" style={{ padding: '32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '6px' }}>{t('post_new_request_btn')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Define the work requirements, job site location, and milestone payment stages. Payment is secured upfront to guarantee the request for matching providers.
          </p>
        </div>

        {error && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: 'var(--accent-rose)',
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Request Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Master Bathroom Tile Replacement & Waterproofing"
                className="input-field"
              />
            </div>

            <div className="grid-cols-2">
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Service Category *
                </label>
                <select
                  required
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="input-field"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                >
                  <option value="">{t('select_category')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Total Payment Amount (₹ INR) *
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

            {/* Job Site Location (Section 8) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Job Site Location / Address (Used for Provider Radius Matching) *
                </label>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={gpsLoading}
                  style={{ fontSize: '0.78rem', color: 'var(--accent-indigo)', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <MapPin size={12} />
                  <span>{gpsLoading ? 'Detecting...' : t('use_current_location')}</span>
                </button>
              </div>
              <input
                type="text"
                required
                value={formData.address_text}
                onChange={(e) => setFormData({ ...formData, address_text: e.target.value })}
                placeholder="e.g. 104 Richmond Road, Bangalore"
                className="input-field"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Detailed Project Description & Scope
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe specific work items, materials, timelines, and deliverables..."
                className="input-field"
              />
            </div>
          </div>

          {/* Milestone Split Builder */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Milestone Payment Breakdown</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Funds are released per milestone upon your inspection and approval.
                </p>
              </div>

              <button
                type="button"
                onClick={addMilestone}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.82rem' }}
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
                    color: 'var(--accent-indigo)',
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
                      placeholder={`Stage #${idx + 1} Title`}
                      className="input-field"
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
                    />
                  </div>

                  <div style={{ width: '150px' }}>
                    <input
                      type="date"
                      value={m.dueDate}
                      onChange={(e) => handleMilestoneChange(idx, 'dueDate', e.target.value)}
                      className="input-field"
                    />
                  </div>

                  {milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMilestone(idx)}
                      style={{ color: 'var(--accent-rose)', padding: '6px' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Sum Indicator */}
            <div style={{
              marginTop: '16px',
              padding: '14px',
              borderRadius: '10px',
              background: isSumValid ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
              border: `1px solid ${isSumValid ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isSumValid ? <CheckCircle size={18} color="var(--accent-emerald)" /> : <AlertCircle size={18} color="var(--accent-amber)" />}
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  {isSumValid
                    ? 'Milestones sum exactly matches total request amount.'
                    : `Milestone sum (₹${currentMilestonesSum.toLocaleString('en-IN')}) does not equal total (₹${totalAmountNum.toLocaleString('en-IN')}).`}
                </span>
              </div>

              <div style={{ fontWeight: 800, fontSize: '1rem', color: isSumValid ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
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
            <Lock size={18} />
            <span>{loading ? 'Securing Payment...' : `Secure Payment (₹${totalAmountNum.toLocaleString('en-IN')}) & Post Request`}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
