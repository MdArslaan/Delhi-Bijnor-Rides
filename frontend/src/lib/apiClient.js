import axios from 'axios';
import { API_BASE } from '../config/api';

/** Render free tier can take ~30–60s to wake up on first request */
const REQUEST_TIMEOUT_MS = 90000;

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

export const getApiErrorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
  if (err.code === 'ECONNABORTED') {
    return 'Server is taking too long to respond. On free hosting the first request can take up to 60 seconds — please wait and try again.';
  }
  if (err.message === 'Network Error' || !err.response) {
    return `Cannot reach the server (${API_BASE}). Check your internet or try again in a minute.`;
  }
  return err.response?.data?.message || fallback;
};
