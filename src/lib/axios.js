import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getStore } from './store-ref';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const TOKEN_KEY = 'watney';
export const REFRESH_TOKEN_KEY = 'watney_refresh';

/** Tells the API this is the mobile app, so login responses include the refresh token in the body. */
const CLIENT_HEADER = { 'x-client': 'mobile' };

/** Saves the tokens from a login / verify / refresh response (refresh token only when present). */
export async function saveAuthTokens({ accessToken, refreshToken } = {}) {
  if (accessToken) await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify(accessToken));
  if (refreshToken) await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearAuthTokens() {
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY]);
}

/** Auth endpoints answer 401 for bad credentials; those must never trigger a refresh/logout. */
const AUTH_ENDPOINT = /\/auth\/(login|signup|google|refreshToken|forget|validate|reset|verifyemail|resend-otp)/i;

const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    ...CLIENT_HEADER,
  },
  withCredentials: true,
});

/** Token from storage, falling back to the persisted Redux token (e.g. if storage was cleared). */
async function getAccessToken() {
  try {
    const stored = await AsyncStorage.getItem(TOKEN_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore and fall back to Redux
  }
  try {
    return getStore().getState()?.auth?.token ?? null;
  } catch {
    return null;
  }
}

// Request interceptor
axiosInstance.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

/** Clears the session; the private layout then redirects to login. */
async function forceLogout() {
  try {
    await clearAuthTokens();
    const { logout } = await import('../redux/features/authSlice');
    getStore().dispatch(logout());
  } catch {
    // nothing else to do
  }
}

// Single in-flight refresh shared by every request that gets a 401 at the same time
// (the dashboard fires several requests at once).
let refreshPromise = null;

function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = AsyncStorage.getItem(REFRESH_TOKEN_KEY)
      .catch(() => null)
      // Body token for the mobile app; the cookie (if the platform kept it) still goes along as a fallback.
      .then((refreshToken) =>
        axios.post(
          `${API_URL}/auth/refreshToken`,
          refreshToken ? { refreshToken } : {},
          { withCredentials: true, headers: { 'Content-Type': 'application/json', ...CLIENT_HEADER } }
        )
      )
      .then(async (response) => {
        const accessToken = response?.data?.data?.accessToken;
        if (!accessToken) return null;
        await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify(accessToken));
        return accessToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// Response interceptor
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    // An expired/invalid session: refresh once and retry, otherwise log out.
    // Handled quietly — no console.error, so LogBox doesn't pop a red error for an expected 401.
    if (status === 401 && originalRequest && !AUTH_ENDPOINT.test(originalRequest.url ?? '')) {
      if (!originalRequest._retry) {
        originalRequest._retry = true;
        const newToken = await refreshAccessToken();
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return axiosInstance(originalRequest);
        }
      }
      await forceLogout();
      return Promise.reject(error);
    }

    if (__DEV__ && status !== 401) {
      console.warn(`Request failed: ${originalRequest?.method?.toUpperCase()} ${originalRequest?.url}`, error.response?.data || error.message);
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
