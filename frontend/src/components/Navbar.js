'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useLanguage, SUPPORTED_LANGUAGES } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { Shield, Sun, Moon, Globe, LogOut, User } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout, getDashboardPath } = useAuth();
  const { locale, setLocale, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const isAuthPage = pathname === '/login' || pathname === '/register';

  return (
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
      }}>
        {/* Brand Logo */}
        <Link href={user ? getDashboardPath(user.role) : '/login'} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '9px',
            background: 'linear-gradient(135deg, #6366f1 0%, #38bdf8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(99, 102, 241, 0.35)',
          }}>
            <Shield size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em' }}>
              {t('brand_name')}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em' }}>
              {t('tagline')}
            </div>
          </div>
        </Link>

        {/* Right Controls: Language Switcher, Theme Switcher, User Role, Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Language Switcher Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-card)', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <Globe size={14} color="var(--text-muted)" />
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                  {lang.flag} {lang.label}
                </option>
              ))}
            </select>
          </div>

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
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 10px',
                borderRadius: '8px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
              }}>
                <User size={14} color="var(--text-muted)" />
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{user.name}</span>
                <span className={`badge ${user.role === 'CLIENT' ? 'badge-open' : user.role === 'PROVIDER' ? 'badge-progress' : 'badge-mediation'}`} style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                  {user.role}
                </span>
              </div>

              <button
                onClick={logout}
                title={t('nav_logout')}
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
          )}
        </div>
      </div>
    </header>
  );
}
