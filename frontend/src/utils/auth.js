const decodeJwtPayload = (token) => {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const segments = token.split('.');
  if (segments.length !== 3) {
    return null;
  }

  try {
    const base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch (error) {
    return null;
  }
};

const getStoredAuthToken = () => {
  const raw = localStorage.getItem('authToken');
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (error) {
    const payload = decodeJwtPayload(raw);
    if (payload) {
      return { access: raw };
    }
  }

  return null;
};

const isTokenValid = (token, expectedType) => {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return false;
  }
  if (expectedType && payload.token_type !== expectedType) {
    return false;
  }
  return !payload.exp || payload.exp * 1000 > Date.now();
};

const setStoredAuthToken = (tokens) => {
  if (!tokens || typeof tokens !== 'object') {
    localStorage.removeItem('authToken');
    return;
  }

  localStorage.setItem('authToken', JSON.stringify(tokens));
};

let refreshInFlight = null;

const refreshAccessToken = async (tokens) => {
  const response = await fetch('/api/token/refresh/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh: tokens.refresh }),
  });

  if (!response.ok) {
    throw new Error(`refresh failed: HTTP ${response.status}`);
  }

  const refreshed = await response.json();
  const nextTokens = {
    ...tokens,
    ...refreshed,
  };
  setStoredAuthToken(nextTokens);
  return nextTokens.access || null;
};

export const getValidAccessToken = async () => {
  let tokens = getStoredAuthToken();
  if (!tokens) {
    return null;
  }

  if (tokens.access && isTokenValid(tokens.access, 'access')) {
    return tokens.access;
  }

  if (!tokens.refresh || !isTokenValid(tokens.refresh, 'refresh')) {
    return null;
  }

  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken(tokens)
      .catch(() => {
        const latestTokens = getStoredAuthToken();
        if (latestTokens && latestTokens.access && isTokenValid(latestTokens.access, 'access')) {
          return latestTokens.access;
        }
        localStorage.removeItem('authToken');
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  const refreshedAccess = await refreshInFlight;
  if (refreshedAccess && isTokenValid(refreshedAccess, 'access')) {
    return refreshedAccess;
  }

  tokens = getStoredAuthToken();
  if (tokens && tokens.access && isTokenValid(tokens.access, 'access')) {
    return tokens.access;
  }

  return null;
};

export const getAuthHeaders = async () => {
  const token = await getValidAccessToken();
  if (!token) {
    return {
      'Content-Type': 'application/json',
    };
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

export const handleUnauthorized = () => {
  localStorage.removeItem('authToken');
  window.location.href = '/';
};