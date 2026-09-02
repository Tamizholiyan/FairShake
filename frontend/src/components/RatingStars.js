'use client';

import React, { useState } from 'react';
import { Star, Sparkles } from 'lucide-react';

export default function RatingStars({
  rating = 0,
  count = 0,
  interactive = false,
  onChange,
  size = 14,
  showCount = true,
  isNew = false,
}) {
  const [hoverRating, setHoverRating] = useState(0);

  // If new provider or 0 ratings in display mode
  if (!interactive && (isNew || (count === 0 && (!rating || rating === 0)))) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '9999px',
          background: 'rgba(56, 189, 248, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          color: 'var(--accent-blue)',
          fontSize: '0.72rem',
          fontWeight: 700,
        }}
      >
        <Sparkles size={11} />
        <span>New Provider</span>
      </span>
    );
  }

  // Interactive mode for rating submission
  if (interactive) {
    const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
    const currentActive = hoverRating || rating;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '8px', cursor: 'pointer' }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange && onChange(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              style={{
                padding: '4px',
                color: star <= currentActive ? '#f59e0b' : 'var(--text-muted)',
                transform: star <= currentActive ? 'scale(1.15)' : 'scale(1)',
                transition: 'transform 0.15s ease, color 0.15s ease',
              }}
            >
              <Star
                size={size || 24}
                fill={star <= currentActive ? '#f59e0b' : 'transparent'}
              />
            </button>
          ))}
        </div>
        {currentActive > 0 && (
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f59e0b' }}>
            {labels[currentActive]} ({currentActive}/5)
          </span>
        )}
      </div>
    );
  }

  // Display mode (e.g. Flipkart style: ★ 4.8 (24))
  const numRating = Number(rating) || 0;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '6px',
        background: numRating >= 4.0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
        border: `1px solid ${numRating >= 4.0 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
        color: numRating >= 4.0 ? 'var(--accent-emerald)' : 'var(--accent-amber)',
        fontSize: '0.78rem',
        fontWeight: 700,
      }}
    >
      <Star size={size} fill="currentColor" />
      <span>{numRating.toFixed(1)}</span>
      {showCount && count > 0 && (
        <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.72rem' }}>
          ({count})
        </span>
      )}
    </span>
  );
}
