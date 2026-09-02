'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Plus, Trash2, Check, X, Home, Briefcase, Building } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function LocationModal({ isOpen, onClose, onSelectAddress }) {
  const { user, token } = useAuth();
  const { t } = useLanguage();

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const [newAddr, setNewAddr] = useState({
    label: 'Home',
    address_text: '',
    area_text: '',
    district_text: '',
    latitude: null,
    longitude: null,
    is_default: false,
  });

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

  const getEffectiveToken = () => {
    return token || (typeof window !== 'undefined' ? localStorage.getItem('fairshake_token') : null);
  };

  useEffect(() => {
    const activeToken = getEffectiveToken();
    if (isOpen && activeToken) {
      fetchAddresses();
    }
  }, [isOpen, token]);

  const fetchAddresses = async () => {
    const activeToken = getEffectiveToken();
    if (!activeToken) return;

    try {
      setLoading(true);
      const res = await fetch(`${backendUrl}/api/addresses`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setAddresses(data.addresses || []);
      }
    } catch (err) {
      console.error('Fetch addresses error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Blinkit-style GPS Reverse Geocode
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setGpsLoading(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();

          const addrObj = data?.address || {};
          const area = addrObj.suburb || addrObj.neighbourhood || addrObj.residential || addrObj.road || addrObj.city_district || 'Local Area';
          const district = addrObj.city || addrObj.state_district || addrObj.county || addrObj.state || 'District';
          const fullAddress = data?.display_name || `${area}, ${district}`;

          const detected = {
            label: 'Site',
            address_text: fullAddress,
            area_text: area,
            district_text: district,
            latitude,
            longitude,
            is_default: false,
          };

          setNewAddr(detected);
          setShowAddForm(true);
        } catch (err) {
          console.error('Reverse geocode error:', err);
          setNewAddr({
            label: 'Site',
            address_text: `Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}`,
            area_text: 'Current Location',
            district_text: '',
            latitude,
            longitude,
            is_default: false,
          });
          setShowAddForm(true);
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        setGpsLoading(false);
        setError('Location permission denied or GPS unavailable.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    if (!newAddr.address_text.trim()) return;

    const activeToken = getEffectiveToken();

    // If user is not logged in (e.g. guest setting location), select locally
    if (!activeToken) {
      if (onSelectAddress) {
        onSelectAddress(newAddr);
      }
      setShowAddForm(false);
      onClose();
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${backendUrl}/api/addresses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify(newAddr),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save address');

      await fetchAddresses();
      setShowAddForm(false);
      setNewAddr({
        label: 'Home',
        address_text: '',
        area_text: '',
        district_text: '',
        latitude: null,
        longitude: null,
        is_default: false,
      });

      if (onSelectAddress) {
        onSelectAddress(data.address || newAddr);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAddress = async (id, e) => {
    e.stopPropagation();
    const activeToken = getEffectiveToken();
    if (!activeToken) return;

    try {
      await fetch(`${backendUrl}/api/addresses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      setAddresses(addresses.filter(a => a.id !== id));
    } catch (err) {
      console.error('Delete address error:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={20} color="var(--accent-indigo)" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Choose Service Location</h3>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(244, 63, 94, 0.12)', color: 'var(--accent-rose)', fontSize: '0.82rem', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        {/* 1. Detect Live GPS Button */}
        <button
          type="button"
          onClick={handleDetectLocation}
          disabled={gpsLoading}
          className="glass-card"
          style={{
            width: '100%',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            borderColor: 'var(--accent-indigo)',
            background: 'rgba(99, 102, 241, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #38bdf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}>
              <Navigation size={18} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                {gpsLoading ? 'Detecting Area & District...' : 'Use Current GPS Location'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Blinkit-style auto-district geocoding
              </div>
            </div>
          </div>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-indigo)' }}>
            Detect
          </span>
        </button>

        {/* 2. Add Address Form */}
        {showAddForm ? (
          <form onSubmit={handleSaveAddress} style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Save Detected Address</span>
              <button type="button" onClick={() => setShowAddForm(false)} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cancel</button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {['Home', 'Work', 'Site', 'Other'].map((lbl) => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => setNewAddr({ ...newAddr, label: lbl })}
                  className="btn"
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    borderRadius: '8px',
                    background: newAddr.label === lbl ? 'var(--accent-indigo)' : 'var(--bg-card)',
                    color: newAddr.label === lbl ? '#ffffff' : 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Area & District
                </label>
                <input
                  type="text"
                  value={newAddr.area_text ? `${newAddr.area_text}, ${newAddr.district_text}` : ''}
                  onChange={(e) => setNewAddr({ ...newAddr, area_text: e.target.value })}
                  placeholder="e.g. Indiranagar, Bangalore Urban"
                  className="input-field"
                  style={{ fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Complete Address / Landmark / Flat
                </label>
                <textarea
                  rows={2}
                  required
                  value={newAddr.address_text}
                  onChange={(e) => setNewAddr({ ...newAddr, address_text: e.target.value })}
                  placeholder="Flat/House No, Building name, Street..."
                  className="input-field"
                  style={{ fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '10px', fontSize: '0.88rem' }}>
              {loading ? 'Saving...' : 'Save & Select Address'}
            </button>
          </form>
        ) : null}

        {/* 3. Saved Addresses List */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Saved Addresses ({addresses.length})
            </span>
            {!showAddForm && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                style={{ fontSize: '0.78rem', color: 'var(--accent-indigo)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
              >
                <Plus size={14} />
                <span>Add New</span>
              </button>
            )}
          </div>

          {addresses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No saved addresses yet. Detect your GPS location above or add an address.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto' }}>
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  onClick={() => {
                    if (onSelectAddress) onSelectAddress(addr);
                    onClose();
                  }}
                  className="glass-card"
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'var(--bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-indigo)',
                    }}>
                      {addr.label === 'Home' ? <Home size={16} /> : addr.label === 'Work' ? <Briefcase size={16} /> : <Building size={16} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                        {addr.label} {addr.area_text ? `• ${addr.area_text}` : ''}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {addr.address_text}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteAddress(addr.id, e)}
                    style={{ color: 'var(--text-muted)', padding: '4px' }}
                    title="Delete address"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
