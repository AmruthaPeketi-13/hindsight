// Base URL of the API server.
// In production (Vercel) set VITE_API_URL to your Render backend, e.g.
//   VITE_API_URL=https://hindsight-api.onrender.com
// In local dev leave it unset so Vite's dev proxy forwards /api to localhost.
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export const api = (path) => `${API_BASE}${path}`;
