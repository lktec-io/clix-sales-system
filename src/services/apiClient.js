import axios from 'axios';
import { getAccessToken, setAccessToken, clearAccessToken } from '../utils/tokenStorage';

const baseURL = import.meta.env.VITE_API_URL || '/api/v1';

const apiClient = axios.create({ baseURL, withCredentials: true });

// Separate instance for the refresh call itself so it never recurses through
// the response interceptor below.
const refreshClient = axios.create({ baseURL, withCredentials: true });

let onSessionExpired = () => {};
export function setOnSessionExpired(callback) {
  onSessionExpired = callback;
}

// The refresh-token cookie (httpOnly, path /api/v1/auth) is shared by every
// tab open on this browser — it has no per-tab/per-session binding. If a
// second tab logs in as a different tenant/user, that login overwrites the
// SAME cookie for every other open tab. A tab that was already showing
// tenant A keeps rendering tenant A's stale UI, but the moment its access
// token expires and this interceptor silently refreshes below, the cookie
// it sends now belongs to tenant B — so it silently receives tenant B's
// access token and starts fetching tenant B's data (notifications,
// dashboard, everything) underneath tenant A's cached page chrome. This
// callback lets AuthContext compare the refreshed user's identity against
// whichever user it's currently rendering, and force a clean
// re-authentication instead of silently mixing two tenants' data in one tab.
let onTokenRefreshed = () => {};
export function setOnTokenRefreshed(callback) {
  onTokenRefreshed = callback;
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;

apiClient.interceptors.response.use(
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
      setAccessToken(data.data.accessToken);
      onTokenRefreshed(data.data.user);
      config.headers.Authorization = `Bearer ${data.data.accessToken}`;
      return apiClient(config);
    } catch (refreshError) {
      clearAccessToken();
      onSessionExpired();
      return Promise.reject(refreshError);
    }
  },
);

export default apiClient;
