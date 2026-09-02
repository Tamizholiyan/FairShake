'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { formatDate, formatTime } from '../../../lib/formatDate';
import {
  Shield,
  Clock,
  CheckCircle,
  AlertTriangle,
  Upload,
  RotateCcw,
  FileCheck,
  ExternalLink,
  MessageSquare,
  Send,
  ArrowLeft,
  RefreshCw,
  User,
  MapPin,
  Phone,
  Star,
  XCircle,
  Plus,
  Trash2,
  Image as ImageIcon,
  Edit3,
  Check,
  X,
} from 'lucide-react';
import RatingStars from '../../../components/RatingStars';

export default function RequestDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, getDashboardPath } = useAuth();
  const { t } = useLanguage();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Multi-file upload states
  const [activeUploadMilestoneId, setActiveUploadMilestoneId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);

  // Dispute issue states
  const [activeIssueMilestoneId, setActiveIssueMilestoneId] = useState(null);
  const [issueReason, setIssueReason] = useState('');

  // Support messages
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Applicant providers state
  const [applications, setApplications] = useState([]);
  const [loadingApps, setLoadingApps] = useState(false);

  // Edit Milestones Modal (Client negotiation)
  const [editMilestonesOpen, setEditMilestonesOpen] = useState(false);
  const [editTotalAmount, setEditTotalAmount] = useState('');
  const [editMilestones, setEditMilestones] = useState([]);
  const [savingMilestones, setSavingMilestones] = useState(false);

  // Cancellation & Refund Modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Provider Rating Modal
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingReview, setRatingReview] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  const fetchRequestDetails = async () => {
    try {
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/requests/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load request.');
      setRequest(data.request);

      // Fetch messages
      const msgRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/messages?request_id=${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const msgData = await msgRes.json();
      if (msgRes.ok) setMessages(msgData.messages || []);

      // If open request and user is client or mediator, fetch applicant proposals
      if (data.request.status === 'OPEN' && (data.request.client_id === user?.id || user?.role === 'MEDIATOR')) {
        fetchApplications();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchApplications = async () => {
    try {
      setLoadingApps(true);
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/requests/${id}/applications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setApplications(data.applications || []);
      }
    } catch (err) {
      console.warn('Fetch applications error:', err);
    } finally {
      setLoadingApps(false);
    }
  };

  useEffect(() => {
    fetchRequestDetails();
  }, [id, user]);

  // Provider Submits Multi-photo Deliverable
  const handleMilestoneSubmit = async (e, milestoneId) => {
    e.preventDefault();
    if (!selectedFiles || selectedFiles.length === 0) return;

    setActionLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('fairshake_token');
      const formData = new FormData();
      for (let i = 0; i < selectedFiles.length; i++) {
        formData.append('files', selectedFiles[i]);
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/milestones/${milestoneId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit work.');

      setSuccessMessage(data.message);
      setActiveUploadMilestoneId(null);
      setSelectedFiles([]);
      await fetchRequestDetails();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Client Approves Milestone
  const handleMilestoneApprove = async (milestoneId) => {
    if (!confirm('Are you sure you want to approve this deliverable? This will immediately release milestone payout.')) return;

    setActionLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/milestones/${milestoneId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve milestone.');

      setSuccessMessage(data.message);
      await fetchRequestDetails();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Client Reports an Issue
  const handleMilestoneIssue = async (e, milestoneId) => {
    e.preventDefault();
    if (!issueReason.trim()) return;

    setActionLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/milestones/${milestoneId}/dispute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: issueReason }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to report issue.');

      setSuccessMessage(data.message);
      setActiveIssueMilestoneId(null);
      setIssueReason('');
      await fetchRequestDetails();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Client Selects an Applicant Provider
  const handleSelectProvider = async (providerId) => {
    if (!confirm('Assign this provider to start the project?')) return;

    setActionLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/requests/${id}/select-provider`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ provider_id: providerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign provider.');

      setSuccessMessage(data.message);
      await fetchRequestDetails();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Open Edit Milestones Modal
  const handleOpenEditMilestones = () => {
    setEditTotalAmount(String(request.total_amount));
    setEditMilestones(request.milestones.map(m => ({
      title: m.title,
      description: m.description || '',
      amount: String(m.amount),
      dueDate: m.due_date || '',
    })));
    setEditMilestonesOpen(true);
    setError('');
  };

  const handleSaveMilestones = async (e) => {
    e.preventDefault();
    const totalNum = Number(editTotalAmount);
    if (totalNum <= 0 || totalNum % 100 !== 0) {
      setError('Total budget must be a multiple of ₹100.');
      return;
    }

    let sum = 0;
    for (let i = 0; i < editMilestones.length; i++) {
      const amt = Number(editMilestones[i].amount);
      if (isNaN(amt) || amt <= 0 || amt % 100 !== 0) {
        setError(`Milestone #${i + 1} must be a valid amount in multiples of ₹100.`);
        return;
      }
      sum += amt;
    }

    if (Math.abs(sum - totalNum) > 0.01) {
      setError(`Milestones sum (₹${sum}) must equal total budget (₹${totalNum}).`);
      return;
    }

    setSavingMilestones(true);
    setError('');
    try {
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/requests/${id}/milestones`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          total_amount: totalNum,
          milestones: editMilestones,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update milestones.');

      setSuccessMessage('Milestones and budget updated successfully.');
      setEditMilestonesOpen(false);
      await fetchRequestDetails();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingMilestones(false);
    }
  };

  // Client Cancellation Request
  const handleCancellationSubmit = async (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) return;

    setSubmittingCancel(true);
    setError('');
    try {
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/requests/${id}/request-cancellation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit cancellation request.');

      setSuccessMessage('Cancellation request submitted to Fairshake Support for review.');
      setCancelModalOpen(false);
      setCancelReason('');
      await fetchRequestDetails();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingCancel(false);
    }
  };

  // Rating Submit
  const handleRatingSubmit = async (e) => {
    e.preventDefault();
    setSubmittingRating(true);
    setError('');
    try {
      const token = localStorage.getItem('fairshake_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/ratings/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stars: ratingStars,
          review_text: ratingReview.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit rating.');

      setSuccessMessage('Rating and review submitted! Thank you.');
      setRatingModalOpen(false);
      await fetchRequestDetails();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingRating(false);
    }
  };

  // Send Chat Message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSendingMsg(true);
    try {
      const token = localStorage.getItem('fairshake_token');
      const recipientId = isClient ? request.provider_id : request.client_id;

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipient_id: recipientId || request.client_id,
          request_id: request.id,
          body: newMessage.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const msgObj = data.data || data.message_item || (typeof data.message === 'object' ? data.message : null);
        if (msgObj && typeof msgObj === 'object') {
          setMessages((prev) => [...prev, msgObj]);
        }
        setNewMessage('');
      }
    } catch (err) {
      console.error('Send message error:', err);
    } finally {
      setSendingMsg(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '80px', color: 'var(--text-muted)' }}>
        Loading request details...
      </div>
    );
  }

  if (!request) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <p style={{ color: 'var(--accent-rose)', marginBottom: '16px', fontSize: '1rem', fontWeight: 600 }}>
          {error || 'Request not found.'}
        </p>
        <Link href={getDashboardPath(user?.role)} className="btn btn-secondary">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const isClient = request.client_id === user?.id;
  const isProvider = request.provider_id === user?.id;
  const isMediator = user?.role === 'MEDIATOR';

  const unreleasedSum = request.milestones
    ?.filter(m => m.status !== 'RELEASED')
    ?.reduce((sum, m) => sum + Number(m.amount), 0) || 0;

  const getMilestoneStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="badge badge-draft">{t('milestone_pending')}</span>;
      case 'SUBMITTED':
        return <span className="badge badge-open">{t('milestone_submitted')}</span>;
      case 'DISPUTED':
      case 'IN_MEDIATION':
        return <span className="badge badge-mediation">{t('milestone_in_mediation')}</span>;
      case 'REVISION_REQUESTED':
        return <span className="badge badge-revision">{t('milestone_revision_requested')}</span>;
      case 'RELEASED':
        return <span className="badge badge-completed">✓ {t('milestone_released')}</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="container" style={{ paddingTop: '28px' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <Link href={getDashboardPath(user?.role)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </Link>

        <div style={{ display: 'flex', gap: '10px' }}>
          {isClient && request.status !== 'COMPLETED' && request.status !== 'CANCELLED' && (
            <button
              onClick={() => setCancelModalOpen(true)}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--accent-rose)', borderColor: 'rgba(244, 63, 94, 0.3)' }}
            >
              <XCircle size={14} />
              <span>Request Cancellation & Refund</span>
            </button>
          )}

          {isClient && request.status === 'COMPLETED' && !request.rating && (
            <button
              onClick={() => setRatingModalOpen(true)}
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.82rem' }}
            >
              <Star size={14} />
              <span>Rate Service Provider</span>
            </button>
          )}

          <button onClick={fetchRequestDetails} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
            <RefreshCw size={14} />
            <span>Refresh Status</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.3)', color: 'var(--accent-rose)', marginBottom: '20px' }}>
          {error}
        </div>
      )}
      {successMessage && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--accent-emerald)', marginBottom: '20px' }}>
          {successMessage}
        </div>
      )}

      {/* Active Cancellation Alert Banner */}
      {request.cancellation_request && request.cancellation_request.status === 'PENDING' && (
        <div style={{
          padding: '16px 20px',
          borderRadius: '12px',
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--accent-amber)', fontSize: '0.95rem', marginBottom: '2px' }}>
              ⚠️ Project Cancellation & Refund Request Under Support Review
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Reason: "{request.cancellation_request.reason}" • Unreleased Refund Amount: <strong>₹{Number(request.cancellation_request.unreleased_amount).toLocaleString('en-IN')}</strong>
            </div>
          </div>
          <span className="badge badge-revision">Pending Mediator Verdict</span>
        </div>
      )}

      {/* Request Header Card */}
      <div className="glass-panel" style={{ padding: '30px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{request.title}</h1>
              {request.category_name && (
                <span className="badge" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                  {request.category_name}
                </span>
              )}
              {isClient && request.status === 'OPEN' && (
                <button
                  onClick={handleOpenEditMilestones}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.75rem', gap: '4px' }}
                >
                  <Edit3 size={12} />
                  <span>Edit Milestones / Budget</span>
                </button>
              )}
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '750px', lineHeight: 1.5 }}>
              {request.description}
            </p>

            {request.address_text && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                <MapPin size={14} color="var(--accent-blue)" />
                <span>Job Site: {request.address_text}</span>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('secured_payment')}</div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
              ₹{Number(request.total_amount).toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', fontWeight: 600, marginTop: '2px' }}>
              ✓ 100% Secured in Escrow
            </div>
          </div>
        </div>

        {/* Counterparties & Verified Phone Numbers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.85rem',
        }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '2px' }}>CLIENT / BUYER</div>
            <div style={{ fontWeight: 600 }}>{request.client_name} ({request.client_email})</div>
            {request.client_phone && (
              <a href={`tel:${request.client_phone}`} style={{ fontSize: '0.78rem', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <Phone size={12} />
                <span>{request.client_phone}</span>
              </a>
            )}
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '2px' }}>SERVICE PROVIDER</div>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{request.provider_name ? request.provider_name : 'Awaiting Provider Selection'}</span>
              {request.provider_name && (
                <RatingStars rating={request.provider_avg_rating} count={request.provider_rating_count} />
              )}
            </div>
            {request.provider_phone && (
              <a href={`tel:${request.provider_phone}`} style={{ fontSize: '0.78rem', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <Phone size={12} />
                <span>{request.provider_phone} (Call Provider)</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* APPLICANT PROVIDERS LIST (Visible to Client / Mediator when OPEN) */}
      {isClient && request.status === 'OPEN' && (
        <div className="glass-panel" style={{ padding: '28px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Applicant Providers ({applications.length})</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Review proposals, call providers directly, and choose your preferred pro.
              </p>
            </div>
          </div>

          {loadingApps ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Loading applicants...</div>
          ) : applications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No providers have submitted quotes yet. Matching nearby providers will appear here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="glass-card"
                  style={{
                    padding: '18px 22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px',
                  }}
                >
                  <div style={{ flex: '1 1 320px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{app.provider_name}</span>
                      <RatingStars rating={app.avg_rating} count={app.rating_count} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      {app.provider_phone && (
                        <a href={`tel:${app.provider_phone}`} style={{ color: 'var(--accent-emerald)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Phone size={13} />
                          <span>{app.provider_phone} (Click to Call)</span>
                        </a>
                      )}
                      <span>Applied on {formatDate(app.created_at)}</span>
                    </div>

                    {app.message && (
                      <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                        "{app.message}"
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
                        ₹{Number(app.proposed_amount || request.total_amount).toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Proposed Quote</div>
                    </div>

                    <button
                      onClick={() => handleSelectProvider(app.provider_id)}
                      disabled={actionLoading}
                      className="btn btn-success"
                      style={{ padding: '10px 18px', fontSize: '0.88rem' }}
                    >
                      <Check size={16} />
                      <span>Select Provider</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Content Layout: Milestone Timeline + Two-Way Conversation */}
      <div className="grid-cols-3" style={{ alignItems: 'start', gap: '28px' }}>
        {/* Milestones Timeline */}
        <div style={{ gridColumn: 'span 2' }}>
          <div className="glass-panel" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={20} color="var(--accent-indigo)" />
              <span>{t('milestones_breakdown')}</span>
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {request.milestones?.map((m) => {
                const isSubmitting = activeUploadMilestoneId === m.id;
                const isDisputing = activeIssueMilestoneId === m.id;

                return (
                  <div
                    key={m.id}
                    className="glass-card"
                    style={{
                      padding: '22px',
                      borderLeft: m.status === 'RELEASED'
                        ? '4px solid var(--accent-emerald)'
                        : m.status === 'REVISION_REQUESTED'
                          ? '4px solid var(--accent-amber)'
                          : m.status === 'DISPUTED' || m.status === 'IN_MEDIATION'
                            ? '4px solid var(--accent-purple)'
                            : m.status === 'SUBMITTED'
                              ? '4px solid var(--accent-blue)'
                              : '4px solid var(--border-subtle)',
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{m.title}</span>
                          {getMilestoneStatusBadge(m.status)}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {t('target_date')}: {m.due_date ? formatDate(m.due_date) : t('flexible')}
                        </div>
                      </div>

                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
                        ₹{Number(m.amount).toLocaleString('en-IN')}
                      </div>
                    </div>

                    {/* Milestone Description / Scope */}
                    {m.description && (
                      <div style={{
                        fontSize: '0.86rem',
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        marginBottom: '14px',
                        lineHeight: 1.5,
                      }}>
                        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {t('milestone_scope_heading')}
                        </div>
                        {m.description}
                      </div>
                    )}

                    {/* Multi-photo Submissions Revision History */}
                    {m.submissions?.length > 0 && (
                      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '14px 16px', marginBottom: '14px' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px' }}>
                          {t('deliverable_history')} ({m.submissions.length} {t('stages_label')}):
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {m.submissions.map((s) => (
                            <div key={s.id} style={{ padding: '8px 12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.82rem' }}>
                                <span>{t('revision_prefix')} #{s.revision_round} ({formatDate(s.submitted_at)})</span>
                              </div>

                              {/* Multi-file Gallery Display */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {(s.files && s.files.length > 0 ? s.files : [{ file_url: s.file_url, original_filename: s.original_filename }]).map((f, fIdx) => (
                                  <a
                                    key={f.id || fIdx}
                                    href={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}${f.file_url}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="glass-card"
                                    style={{
                                      padding: '6px 10px',
                                      fontSize: '0.78rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      color: 'var(--accent-blue)',
                                    }}
                                  >
                                    <ImageIcon size={13} />
                                    <span>{f.original_filename || `Photo #${fIdx + 1}`}</span>
                                    <ExternalLink size={11} />
                                  </a>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Support Review Notes */}
                    {m.dispute && m.dispute.status === 'RESOLVED' && m.dispute.resolution === 'REVISION_REQUESTED' && (
                      <div style={{ padding: '14px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '10px', marginBottom: '14px' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-amber)', marginBottom: '4px' }}>
                          {t('support_decision_notes')}:
                        </div>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                          "{m.dispute.mediator_notes}"
                        </p>
                      </div>
                    )}

                    {/* Multi-Photo Deliverable Upload Form */}
                    {isSubmitting && (
                      <form onSubmit={(e) => handleMilestoneSubmit(e, m.id)} style={{ padding: '14px', background: 'var(--bg-secondary)', borderRadius: '10px', marginBottom: '14px' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                          {t('upload_deliverable_label')} (Up to 5 photos/files):
                        </div>
                        <input
                          type="file"
                          multiple
                          required
                          onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
                          className="input-field"
                          style={{ marginBottom: '10px' }}
                        />
                        {selectedFiles.length > 0 && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                            Selected {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}: {selectedFiles.map(f => f.name).join(', ')}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button type="submit" disabled={actionLoading} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                            {actionLoading ? t('submitting_deliverable') : t('upload_and_submit_btn')}
                          </button>
                          <button type="button" onClick={() => { setActiveUploadMilestoneId(null); setSelectedFiles([]); }} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                            {t('cancel_btn')}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Issue Report Form */}
                    {isDisputing && (
                      <form onSubmit={(e) => handleMilestoneIssue(e, m.id)} style={{ padding: '14px', background: 'rgba(244, 63, 94, 0.08)', borderRadius: '10px', marginBottom: '14px' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-rose)', marginBottom: '6px' }}>
                          {t('raise_issue_title')}
                        </div>
                        <textarea
                          required
                          rows={2}
                          value={issueReason}
                          onChange={(e) => setIssueReason(e.target.value)}
                          placeholder={t('issue_reason_placeholder')}
                          className="input-field"
                          style={{ marginBottom: '10px' }}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button type="submit" disabled={actionLoading} className="btn btn-danger" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                            {actionLoading ? t('submitting_issue') : t('submit_issue_btn')}
                          </button>
                          <button type="button" onClick={() => { setActiveIssueMilestoneId(null); setIssueReason(''); }} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                            {t('cancel_btn')}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Action Controls */}
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {/* Provider Submit/Resubmit button */}
                      {(m.status === 'PENDING' || m.status === 'REVISION_REQUESTED') && request.status === 'IN_PROGRESS' && (isProvider || isMediator) && !isSubmitting && (
                        <button
                          onClick={() => setActiveUploadMilestoneId(m.id)}
                          className="btn btn-primary"
                          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                        >
                          <Upload size={14} />
                          <span>{m.status === 'REVISION_REQUESTED' ? t('reupload_revision') : t('submit_deliverable')}</span>
                        </button>
                      )}

                      {/* Client Approve or Issue buttons */}
                      {m.status === 'SUBMITTED' && (isClient || isMediator) && !isDisputing && (
                        <>
                          <button
                            onClick={() => handleMilestoneApprove(m.id)}
                            disabled={actionLoading}
                            className="btn btn-success"
                            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                          >
                            <CheckCircle size={14} />
                            <span>{t('approve_milestone')}</span>
                          </button>

                          <button
                            onClick={() => setActiveIssueMilestoneId(m.id)}
                            disabled={actionLoading}
                            className="btn btn-danger"
                            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                          >
                            <AlertTriangle size={14} />
                            <span>{t('raise_issue_btn')}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Two-Way Support Conversation */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={18} color="var(--accent-indigo)" />
            <span>{t('messages_title')}</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto', marginBottom: '14px' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No messages yet. Send a message to communicate with the other party or Fairshake Support.
              </div>
            ) : (
              messages.map((msg, idx) => {
                if (!msg) return null;
                const isMe = msg.sender_id === user?.id;
                const senderName = msg.sender_name || (isMe ? 'You' : 'Participant');
                const senderRole = msg.sender_role || (isMe ? user?.role : '');
                const bodyText = typeof msg === 'string' ? msg : (msg.body || '');
                if (!bodyText) return null;

                return (
                  <div
                    key={msg.id || idx}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: isMe ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      maxWidth: '90%',
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                      <strong>{senderName}</strong> {senderRole ? `(${senderRole})` : ''} • {formatTime(msg.created_at || new Date())}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{bodyText}</div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={t('message_placeholder')}
              className="input-field"
              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
            />
            <button type="submit" disabled={sendingMsg} className="btn btn-primary" style={{ padding: '8px 14px' }}>
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>

      {/* Edit Milestones & Budget Modal */}
      {editMilestonesOpen && (
        <div className="modal-overlay" onClick={() => setEditMilestonesOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ padding: '28px', maxWidth: '640px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={20} color="var(--accent-indigo)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Edit Milestones & Budget</h3>
              </div>
              <button onClick={() => setEditMilestonesOpen(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMilestones}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Total Budget (₹ in Multiples of 100) *
                </label>
                <input
                  type="number"
                  step="100"
                  min="100"
                  required
                  value={editTotalAmount}
                  onChange={(e) => setEditTotalAmount(e.target.value)}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {editMilestones.map((m, idx) => (
                  <div key={idx} className="glass-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        type="text"
                        required
                        value={m.title}
                        onChange={(e) => {
                          const updated = [...editMilestones];
                          updated[idx].title = e.target.value;
                          setEditMilestones(updated);
                        }}
                        placeholder={`Stage #${idx + 1} Title`}
                        className="input-field"
                        style={{ flex: 1 }}
                      />
                      <input
                        type="number"
                        step="100"
                        min="100"
                        required
                        value={m.amount}
                        onChange={(e) => {
                          const updated = [...editMilestones];
                          updated[idx].amount = e.target.value;
                          setEditMilestones(updated);
                        }}
                        placeholder="₹ Amount"
                        className="input-field"
                        style={{ width: '130px' }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" disabled={savingMilestones} className="btn btn-primary" style={{ flex: 1, padding: '12px' }}>
                  {savingMilestones ? 'Saving Changes...' : 'Save & Update Milestones'}
                </button>
                <button type="button" onClick={() => setEditMilestonesOpen(false)} className="btn btn-secondary" style={{ padding: '12px 18px' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancellation & Refund Request Modal */}
      {cancelModalOpen && (
        <div className="modal-overlay" onClick={() => setCancelModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <XCircle size={20} color="var(--accent-rose)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Request Project Cancellation</h3>
              </div>
              <button onClick={() => setCancelModalOpen(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '14px', background: 'rgba(244, 63, 94, 0.08)', borderRadius: '10px', border: '1px solid rgba(244, 63, 94, 0.25)', marginBottom: '18px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Unreleased Escrow Refund Amount:
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-rose)' }}>
                ₹{unreleasedSum.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Fairshake Support will review the project status. Upon approval, unreleased funds will be refunded directly to your original payment method.
              </div>
            </div>

            <form onSubmit={handleCancellationSubmit}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Reason for Cancellation *
                </label>
                <textarea
                  rows={3}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Describe why you need to cancel this project..."
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" disabled={submittingCancel} className="btn btn-danger" style={{ flex: 1, padding: '12px' }}>
                  {submittingCancel ? 'Submitting...' : 'Submit Cancellation Application'}
                </button>
                <button type="button" onClick={() => setCancelModalOpen(false)} className="btn btn-secondary" style={{ padding: '12px 18px' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Provider Rating Modal */}
      {ratingModalOpen && (
        <div className="modal-overlay" onClick={() => setRatingModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ padding: '28px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Star size={20} color="#f59e0b" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Rate Service Provider</h3>
              </div>
              <button onClick={() => setRatingModalOpen(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              How satisfied are you with <strong>{request.provider_name}</strong>'s work on this project?
            </p>

            <form onSubmit={handleRatingSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <RatingStars
                  interactive={true}
                  rating={ratingStars}
                  onChange={(s) => setRatingStars(s)}
                  size={28}
                />
              </div>

              <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Written Review / Feedback (Optional)
                </label>
                <textarea
                  rows={3}
                  value={ratingReview}
                  onChange={(e) => setRatingReview(e.target.value)}
                  placeholder="Share details of your experience to help other clients..."
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" disabled={submittingRating} className="btn btn-primary" style={{ flex: 1, padding: '12px' }}>
                  {submittingRating ? 'Submitting...' : 'Submit Verified Review'}
                </button>
                <button type="button" onClick={() => setRatingModalOpen(false)} className="btn btn-secondary" style={{ padding: '12px 18px' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
