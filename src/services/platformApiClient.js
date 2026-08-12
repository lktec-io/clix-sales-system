import axios from 'axios';
import { getPlatformAccessToken, setPlatformAccessToken, clearPlatformAccessToken } from '../utils/platformTokenStorage';

// /api/v1/platform/* already falls under the existing /api/ dev proxy
// (vite.config.js) and production Nginx location block — no new proxy/
// config entry needed. Hardcoded rather than derived from VITE_API_URL
// (which is tenant-API-specific) since this is a genuinely separate API
// surface; an optional VITE_PLATFORM_API_URL override is still honored if
// ever needed.
const baseURL = import.meta.env.VITE_PLATFORM_API_URL || '/api/v1/platform';

const platformApiClient = axios.create({ baseURL, withCredentials: true });

// Separate instance purely so the refresh call's own 401 never recurses
// into the response interceptor below — mirrors apiClient.js's refreshClient.
const refreshClient = axios.create({ baseURL, withCredentials: true });

let onPlatformSessionExpired = () => {};
export function setOnPlatformSessionExpired(callback) {
  onPlatformSessionExpired = callback;
}

// See apiClient.js's identical setOnTokenRefreshed for the full scenario —
// the platformRefreshToken cookie is shared across every platform-admin
// tab on this browser the same way the tenant refreshToken cookie is, so a
// second admin logging in on another tab can silently swap which admin a
// still-open tab's next token refresh resolves to.
let onTokenRefreshed = () => {};
export function setOnTokenRefreshed(callback) {
  onTokenRefreshed = callback;
}

platformApiClient.interceptors.request.use((config) => {
  const token = getPlatformAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;

platformApiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    const isAuthRoute = config?.url?.startsWith('/auth/login') || config?.url?.startsWith('/auth/refresh');
    if (response?.status !== 401 || isAuthRoute || config._retried) {
      return Promise.reject(error);
    }

    config._retried = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshClient.post('/auth/refresh').finally(() => {
          refreshPromise = null;
        });
      }
      const { data } = await refreshPromise;
      setPlatformAccessToken(data.data.accessToken);
      onTokenRefreshed(data.data.admin);
      config.headers.Authorization = `Bearer ${data.data.accessToken}`;
      return platformApiClient(config);
    } catch (refreshError) {
      clearPlatformAccessToken();
      onPlatformSessionExpired();
      return Promise.reject(refreshError);
    }
  },
);

export default platformApiClient;
