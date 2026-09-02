'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  Shield,
  CheckCircle,
  Lock,
  ArrowRight,
  Sparkles,
  DollarSign,
  FileCheck,
  Scale,
  Users,
  Camera,
  Star,
  MapPin,
  ChevronRight,
  Zap,
  PhoneCall,
} from 'lucide-react';
import FairshakeLogo from '../components/FairshakeLogo';

export default function LandingPage() {
  const { user, getDashboardPath } = useAuth();
  const { t } = useLanguage();

  // Interactive Escrow Simulator State
  const [activeStep, setActiveStep] = useState(2);

  const categories = [
    { name: 'Plumbing', icon: '🔧', desc: 'Pipe repairs, bathroom fitting & leak fix' },
    { name: 'Electrician', icon: '⚡', desc: 'Wiring, MCB setup & appliance install' },
    { name: 'Carpentry', icon: '🪚', desc: 'Custom furniture, woodwork & door repairs' },
    { name: 'Painting', icon: '🎨', desc: 'Interior/exterior wall painting & waterproofing' },
    { name: 'Interior Design', icon: '🛋️', desc: 'Modular kitchens, false ceilings & 3D plans' },
    { name: 'Construction', icon: '🏗️', desc: 'Masonry, civil repairs & renovation' },
    { name: 'Appliance Repair', icon: '❄️', desc: 'AC service, refrigerator & washing machine' },
    { name: 'Deep Cleaning', icon: '✨', desc: 'Post-renovation, sofa & water tank wash' },
  ];

  const steps = [
    {
      num: 1,
      title: '1. Create & Lock Escrow',
      desc: 'Client defines clear milestone stages. Full payment is secured safely in Fairshake escrow.',
      amount: '₹30,000 Locked in Escrow',
      badge: 'Escrow Secured',
      color: 'var(--accent-indigo)',
    },
    {
      num: 2,
      title: '2. Provider Delivers & Submits',
      desc: 'Provider completes the stage and uploads photo proof with cryptographic SHA-256 verification.',
      amount: 'Stage 1 Deliverable Uploaded',
      badge: 'Under Inspection',
      color: 'var(--accent-amber)',
    },
    {
      num: 3,
      title: '3. Inspect, Approve & Release',
      desc: 'Client verifies the physical work. Upon approval, payment is instantly released to the provider.',
      amount: '₹10,000 Payout Released',
      badge: 'Payment Complete',
      color: 'var(--accent-emerald)',
    },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 1. HERO SECTION */}
      <section style={{
        padding: '72px 0 60px',
        position: 'relative',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.25), transparent 70%)',
      }}>
        <div className="container" style={{ textAlign: 'center', maxWidth: '960px' }}>
          {/* Trust Banner Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            borderRadius: '9999px',
            background: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            marginBottom: '24px',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: 'var(--accent-indigo)',
          }}>
            <Sparkles size={16} />
            <span>India's Trust Protocol for Milestone-Escrow Services</span>
          </div>

          <h1 style={{
            fontSize: 'clamp(2.2rem, 5vw, 3.8rem)',
            fontWeight: 800,
            lineHeight: 1.15,
            marginBottom: '20px',
            letterSpacing: '-0.03em',
          }}>
            Never Lose Money to <span className="gradient-text">Unfinished Work</span>
          </h1>

          <p style={{
            fontSize: 'clamp(1.05rem, 2vw, 1.25rem)',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            maxWidth: '740px',
            margin: '0 auto 36px',
          }}>
            Fairshake protects homeowners, businesses, and skilled service professionals. Funds are secured upfront in milestone escrow and released only when deliverables are inspected and approved.
          </p>

          {/* CTA Group */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            marginBottom: '40px',
          }}>
            {user ? (
              <Link
                href={getDashboardPath(user.role)}
                className="btn btn-primary glow-effect"
                style={{ padding: '16px 32px', fontSize: '1.05rem', fontWeight: 700 }}
              >
                <span>Go to My Dashboard ({user.role})</span>
                <ArrowRight size={18} />
              </Link>
            ) : (
              <>
                <Link
                  href="/register?role=CLIENT"
                  className="btn btn-primary glow-effect"
                  style={{ padding: '16px 30px', fontSize: '1.02rem', fontWeight: 700 }}
                >
                  <Lock size={18} />
                  <span>Hire with Milestone Escrow</span>
                </Link>

                <Link
                  href="/register?role=PROVIDER"
                  className="btn btn-secondary"
                  style={{ padding: '16px 28px', fontSize: '1.02rem', fontWeight: 700 }}
                >
                  <Users size={18} />
                  <span>Join as Service Provider</span>
                </Link>
              </>
            )}
          </div>

          {/* Trust Guarantees Strip */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '24px',
            flexWrap: 'wrap',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            fontWeight: 600,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle size={15} color="var(--accent-emerald)" />
              100% Upfront Escrow Security
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Scale size={15} color="var(--accent-purple)" />
              Impartial Support Arbitration
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={15} color="var(--accent-amber)" />
              Razorpay Secured Payouts
            </span>
          </div>
        </div>
      </section>

      {/* 2. INTERACTIVE ESCROW FLOW SIMULATOR */}
      <section style={{ padding: '60px 0', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 40px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-indigo)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              HOW MILESTONE ESCROW WORKS
            </span>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>
              Interactive 3-Step Protection Protocol
            </h2>
          </div>

          {/* Stepper Tabs */}
          <div className="grid-cols-3" style={{ marginBottom: '32px' }}>
            {steps.map((step) => {
              const isActive = activeStep === step.num;
              return (
                <div
                  key={step.num}
                  onClick={() => setActiveStep(step.num)}
                  className="glass-card"
                  style={{
                    padding: '24px',
                    cursor: 'pointer',
                    borderColor: isActive ? step.color : 'var(--border-subtle)',
                    background: isActive ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                    borderTop: `4px solid ${isActive ? step.color : 'transparent'}`,
                    boxShadow: isActive ? `0 8px 24px rgba(0, 0, 0, 0.2)` : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: isActive ? step.color : 'var(--bg-secondary)',
                      color: isActive ? '#ffffff' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                    }}>
                      {step.num}
                    </span>
                    <span className="badge" style={{ background: 'var(--bg-secondary)', fontSize: '0.72rem', borderColor: isActive ? step.color : 'var(--border-subtle)' }}>
                      {step.badge}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>{step.title}</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '14px' }}>
                    {step.desc}
                  </p>

                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: step.color }}>
                    {step.amount}
                  </div>
                </div>
              );
            })}
          </div>

            {/* Live Contract Preview Card */}
            <div className="glass-panel glow-effect" style={{ padding: '32px', maxWidth: '820px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
                <div>
                  <span className="badge badge-progress" style={{ marginBottom: '6px' }}>Verified Contract Example</span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Master Bathroom Tile Replacement & Waterproofing</h3>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL VALUE</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-blue)' }}>₹30,000</div>
                </div>
              </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '14px', borderRadius: '10px', background: activeStep >= 1 ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Milestone #1: Surface Demolition & Base Preparation</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Target: Complete old tile removal</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge badge-completed">✓ Released (₹10,000)</span>
                </div>
              </div>

              <div style={{ padding: '14px', borderRadius: '10px', background: activeStep === 2 ? 'rgba(245, 158, 11, 0.08)' : activeStep > 2 ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-secondary)', border: `1px solid ${activeStep === 2 ? 'var(--accent-amber)' : 'var(--border-subtle)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Milestone #2: Waterproof Membrane & Tile Laying</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Deliverable: 3 inspection photos attached</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`badge ${activeStep >= 3 ? 'badge-completed' : 'badge-progress'}`}>
                    {activeStep >= 3 ? '✓ Released (₹10,000)' : '⏳ Submitted for Review (₹10,000)'}
                  </span>
                </div>
              </div>

              <div style={{ padding: '14px', borderRadius: '10px', background: activeStep >= 3 ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Milestone #3: Epoxy Grouting & Final Fitting</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Final deliverable</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge badge-open">🔒 Escrow Locked (₹10,000)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. POPULAR SERVICE CATEGORIES */}
      <section style={{ padding: '72px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 48px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-indigo)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              EXPLORE TRADES
            </span>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>
              Hire Verified Skilled Professionals
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '6px' }}>
              Connect with experienced local pros across every home renovation and technical trade.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '20px',
          }}>
            {categories.map((cat, idx) => (
              <div
                key={idx}
                className="glass-card"
                style={{
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '4px' }}>{cat.icon}</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{cat.name}</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {cat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. PLATFORM ADVANTAGES */}
      <section style={{ padding: '64px 0', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 48px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800 }}>Built for Absolute Fairplay</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '6px' }}>
              Engineered to eliminate contractor abandonment, client non-payment, and quality disputes.
            </p>
          </div>

          <div className="grid-cols-3" style={{ gap: '24px' }}>
            <div className="glass-card" style={{ padding: '28px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <PhoneCall size={20} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>Direct Phone Negotiation</h3>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Clients can view applicant phone numbers, discuss project specs over the phone, negotiate quotes, and adjust milestones before locking payment.
              </p>
            </div>

            <div className="glass-card" style={{ padding: '28px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <Camera size={20} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>Multi-Photo Deliverables</h3>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Providers can upload up to 5 photos per milestone. SHA-256 cryptographic hashes guarantee unforgeable proof of deliverable state.
              </p>
            </div>

            <div className="glass-card" style={{ padding: '28px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <Star size={20} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>Flipkart-Style Verified Ratings</h3>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Only clients with verified completed contracts can submit star reviews. New providers are highlighted with a special "New Provider" badge.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FOOTER & CTA */}
      <footer style={{
        marginTop: 'auto',
        padding: '50px 0 30px',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-primary)',
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FairshakeLogo size={32} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{t('brand_name')}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {t('tagline')}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            © 2026 Fairshake. All rights reserved. Secured by Milestone Escrow Protection.
          </div>

          <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem' }}>
            <Link href="/login" style={{ color: 'var(--text-secondary)' }}>{t('sign_in_link')}</Link>
            <Link href="/register" style={{ color: 'var(--accent-indigo)', fontWeight: 600 }}>{t('sign_up_link')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
