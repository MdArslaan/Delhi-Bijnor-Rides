/**
 * Backend URL — VITE_API_URL must include https:// on Vercel/Render
 * Local dev: frontend/.env.development → http://localhost:5000
 */
function normalizeApiBase(url) {
  if (!url || !String(url).trim()) return 'http://localhost:5000';

  const trimmed = url.trim().replace(/\/$/, '');
  const isLocal = /localhost|127\.0\.0\.1/i.test(trimmed);

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return isLocal ? `http://${trimmed}` : `https://${trimmed}`;
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL);

export const API_URL = `${API_BASE}/api`;
export const AUTH_URL = `${API_BASE}/api/auth`;

/** Ping backend on app load — helps wake Render free tier before user actions */
export const wakeBackend = () =>
  fetch(`${API_BASE}/api/health`, { method: 'GET', mode: 'cors' }).catch(() => {});
