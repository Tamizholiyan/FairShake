// src/lib/formatDate.js
// Standardized Indian Standard Time (IST - Asia/Kolkata) date and time formatting utilities

/**
 * Format a date string/timestamp into IST Date format (e.g. "02 Sep 2026")
 * @param {string|number|Date} dateInput
 * @param {Intl.DateTimeFormatOptions} [customOptions]
 * @returns {string}
 */
export function formatDate(dateInput, customOptions = {}) {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '—';

    const defaultOptions = {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...customOptions,
    };

    return new Intl.DateTimeFormat('en-IN', defaultOptions).format(d);
  } catch (err) {
    console.warn('formatDate error:', err);
    return '—';
  }
}

/**
 * Format a date string/timestamp into IST Time format (e.g. "04:37 AM")
 * @param {string|number|Date} dateInput
 * @returns {string}
 */
export function formatTime(dateInput) {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '—';

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch (err) {
    console.warn('formatTime error:', err);
    return '—';
  }
}

/**
 * Format a date string/timestamp into IST DateTime format (e.g. "02 Sep 2026, 04:37 AM")
 * @param {string|number|Date} dateInput
 * @returns {string}
 */
export function formatDateTime(dateInput) {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '—';

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch (err) {
    console.warn('formatDateTime error:', err);
    return '—';
  }
}

export default formatDate;
