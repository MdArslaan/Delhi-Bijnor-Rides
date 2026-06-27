/**
 * Backend URL — set VITE_API_URL in Vercel/Render env or frontend/.env.production
 * Local dev uses frontend/.env.development (http://localhost:5000)
 */
export const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:5000';

export const API_URL = `${API_BASE}/api`;
export const AUTH_URL = `${API_BASE}/api/auth`;
