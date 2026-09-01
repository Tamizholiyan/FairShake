// src/lib/api.js
// Centralized API client for Fairshake backend

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export function getAuthToken() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('fairshake_token');
  }
  return null;
}

export function setAuthToken(token) {
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('fairshake_token', token);
    } else {
      localStorage.removeItem('fairshake_token');
    }
  }
}

export async function apiRequest(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Handle FormData vs JSON
  if (!(options.body instanceof FormData) && options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const url = `${BACKEND_URL}${endpoint}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = data.error || data.message || `Request failed with status ${res.status}`;
      throw new Error(errorMsg);
    }

    return data;
  } catch (err) {
    console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, err);
    throw err;
  }
}

export const api = {
  // Auth
  login: (credentials) => apiRequest('/api/auth/login', { method: 'POST', body: credentials }),
  register: (userData) => apiRequest('/api/auth/register', { method: 'POST', body: userData }),
  getMe: () => apiRequest('/api/auth/me'),
  getUsers: () => apiRequest('/api/auth/users'),

  // Deals
  getDeals: () => apiRequest('/api/deals'),
  getDeal: (id) => apiRequest(`/api/deals/${id}`),
  createDeal: (dealData) => apiRequest('/api/deals', { method: 'POST', body: dealData }),
  lockDeal: (id) => apiRequest(`/api/deals/${id}/lock`, { method: 'POST' }),
  verifyLockDeal: (id, paymentData) => apiRequest(`/api/deals/${id}/verify-lock`, { method: 'POST', body: paymentData }),
  getDealLedger: (id) => apiRequest(`/api/deals/${id}/ledger`),

  // Milestones
  submitMilestone: (id, formData) => apiRequest(`/api/milestones/${id}/submit`, { method: 'POST', body: formData }),
  approveMilestone: (id) => apiRequest(`/api/milestones/${id}/approve`, { method: 'POST' }),
  disputeMilestone: (id, reason) => apiRequest(`/api/milestones/${id}/dispute`, { method: 'POST', body: { reason } }),

  // Disputes & Mediation
  getDisputes: () => apiRequest('/api/disputes'),
  getDispute: (id) => apiRequest(`/api/disputes/${id}`),
  resolveDispute: (id, data) => apiRequest(`/api/disputes/${id}/resolve`, { method: 'POST', body: data }),
};
