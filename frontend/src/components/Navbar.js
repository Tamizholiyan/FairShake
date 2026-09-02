'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, LogOut, User, MapPin } from 'lucide-react';
import FairshakeLogo from './FairshakeLogo';
import LocationModal from './LocationModal';

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout, getDashboardPath } = useAuth();
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  return (
    <>
      <header style={{
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div className="container" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '68px',
          gap: '12px',
        }}>
          {/* Brand Logo & Tagline */}
          <Link href={user ? getDashboardPath(user.role) : '/'} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FairshakeLogo size={38} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center' }}>
                <span>Fairshake</span>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.02em' }}>
                Milestone Escrow Protection
              </div>
            </div>
          </Link>

          {/* Center/Right Controls: Location, Theme, User Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Blinkit-Style Location Button for logged-in clients or providers (hidden for mediators) */}
            {user && user.role !== 'MEDIATOR' && (
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="glass-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <MapPin size={14} color="var(--accent-indigo)" />
                <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedLocation?.area_text || selectedLocation?.address_text || 'Set Location'}
                </span>
              </button>
            )}

            {/* Theme Switcher Toggle */}
            <button
              onClick={toggleTheme}
              title="Toggle Light / Dark Theme"
              style={{
                padding: '8px',
                borderRadius: '8px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {theme === 'dark' ? <Sun size={16} color="#fbbf24" /> : <Moon size={16} color="#6366f1" />}
            </button>

            {/* User Profile & Logout (when logged in) */}
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Link
                  href={getDashboardPath(user.role)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '5px 10px',
                    borderRadius: '8px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <User size={14} color="var(--text-muted)" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{user.name}</span>
                  <span className={`badge ${user.role === 'CLIENT' ? 'badge-open' : user.role === 'PROVIDER' ? 'badge-progress' : 'badge-mediation'}`} style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                    {user.role}
                  </span>
                </Link>

                <button
                  onClick={logout}
                  title="Log out"
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--accent-rose)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Link
                  href="/login"
                  className="btn btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="btn btn-primary"
                  style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Location Selector Modal */}
      <LocationModal
        isOpen={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        onSelectAddress={(addr) => setSelectedLocation(addr)}
      />
    </>
  );
}
