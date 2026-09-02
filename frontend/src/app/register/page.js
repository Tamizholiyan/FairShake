'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../lib/api';
import { Shield, ArrowRight, ArrowLeft, User, Wrench, Scale, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const { t } = useLanguage();

  const [step, setStep] = useState(1);
  const [role, setRole] = useState('CLIENT');
  const [categories, setCategories] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    service_category_id: '',
    admin_id: '',
    address_text: '',
    latitude: null,
    longitude: null,
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/auth/categories`);
        const data = await res.json();
        if (data.categories) {
          setCategories(data.categories);
        }
      } catch (err) {
        console.warn('Failed to load categories', err);
      }
    }
    loadCategories();
  }, []);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          address_text: prev.address_text || `GPS: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`,
        }));
        setGpsLoading(false);
      },
      (err) => {
        setError('Unable to retrieve GPS coordinates: ' + err.message);
        setGpsLoading(false);
      }
    );
  };

  const handleNextStep = (selectedRole) => {
    setRole(selectedRole);
    setStep(2);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register({
        ...formData,
        role,
        service_category_id: role === 'PROVIDER' ? parseInt(formData.service_category_id, 10) : null,
        admin_id: role === 'MEDIATOR' ? formData.admin_id.trim().toUpperCase() : null,
      });
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '580px', paddingTop: '40px' }}>
      <div className="glass-panel" style={{ padding: '36px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '6px' }}>{t('signup_title')}</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {step === 1 ? t('signup_step1') : t('signup_step2')}
          </p>
        </div>

        {error && (
          <div style={{
            padding: '12px 14px',
            borderRadius: '10px',
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: 'var(--accent-rose)',
            fontSize: '0.85rem',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Select Account Type */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <button
              onClick={() => handleNextStep('CLIENT')}
              className="glass-card"
              style={{
                padding: '20px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={22} color="var(--accent-blue)" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '2px' }}>{t('role_client')}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('role_client_desc')}</div>
                </div>
              </div>
              <ArrowRight size={18} color="var(--text-muted)" />
            </button>

            <button
              onClick={() => handleNextStep('PROVIDER')}
              className="glass-card"
              style={{
                padding: '20px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wrench size={22} color="var(--accent-amber)" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '2px' }}>{t('role_provider')}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('role_provider_desc')}</div>
                </div>
              </div>
              <ArrowRight size={18} color="var(--text-muted)" />
            </button>

            <button
              onClick={() => handleNextStep('MEDIATOR')}
              className="glass-card"
              style={{
                padding: '20px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Scale size={22} color="var(--accent-purple)" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '2px' }}>{t('role_mediator')}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('role_mediator_desc')}</div>
                </div>
              </div>
              <ArrowRight size={18} color="var(--text-muted)" />
            </button>
          </div>
        )}

        {/* STEP 2: Tailored Form Fields */}
        {step === 2 && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ArrowLeft size={14} />
                <span>Change Account Type</span>
              </button>

              <span className="badge badge-open" style={{ fontSize: '0.75rem' }}>
                {role}
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                {t('full_name')} *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Ramesh Kumar"
                className="input-field"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                {t('email_label')} *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                {t('password_label')} *
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className="input-field"
              />
            </div>

            {/* Phone Number (Client & Provider only) */}
            {role !== 'MEDIATOR' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  {t('phone_number')}
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="input-field"
                />
              </div>
            )}

            {/* Service Category Dropdown (Provider only) */}
            {role === 'PROVIDER' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  {t('service_category')} *
                </label>
                <select
                  required
                  value={formData.service_category_id}
                  onChange={(e) => setFormData({ ...formData, service_category_id: e.target.value })}
                  className="input-field"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                >
                  <option value="" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>{t('select_category')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Admin ID Whitelist (Mediator only) */}
            {role === 'MEDIATOR' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  {t('admin_id')} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.admin_id}
                  onChange={(e) => setFormData({ ...formData, admin_id: e.target.value.toUpperCase() })}
                  placeholder="ADM002"
                  className="input-field"
                  style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {t('admin_id_hint')}
                </p>
              </div>
            )}

            {/* Location (Client & Provider) */}
            {role !== 'MEDIATOR' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {t('address_location')}
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
                  value={formData.address_text}
                  onChange={(e) => setFormData({ ...formData, address_text: e.target.value })}
                  placeholder="e.g. Indiranagar, Bangalore"
                  className="input-field"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', marginTop: '10px' }}
            >
              {loading ? t('creating_account') : t('create_account_btn')}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {t('already_have_account')}{' '}
          <Link href="/login" style={{ color: 'var(--accent-indigo)', fontWeight: 600 }}>
            {t('sign_in_link')}
          </Link>
        </div>
      </div>
    </div>
  );
}
