const API_ORIGIN = String(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const SOCKET_ORIGIN = String(import.meta.env.VITE_API_WS_URL || '').replace(/\/+$/, '');

function normalizePath(path = '/') {
  if (!path) {
    return '/';
  }

  return path.startsWith('/') ? path : `/${path}`;
}

export function buildBackendUrl(path = '/') {
  if (/^(https?|wss?):\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = normalizePath(path);
  return API_ORIGIN ? `${API_ORIGIN}${normalizedPath}` : normalizedPath;
}

export function getApiBaseUrl() {
  return buildBackendUrl('/api');
}

export function getSocketUrl() {
  return SOCKET_ORIGIN || API_ORIGIN || undefined;
}

export function getAccessToken() {
  return localStorage.getItem('accessToken') || '';
}

export function getRefreshToken() {
  return localStorage.getItem('refreshToken') || '';
}

export function clearStoredAuth() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
}

export function getAuthHeaders() {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
