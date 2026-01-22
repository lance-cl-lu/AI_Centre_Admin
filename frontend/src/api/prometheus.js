const DEFAULT_PROMETHEUS_BASE =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:32049`
    : 'http://localhost:32049';

const ensureBaseUrl = (value) => {
  if (!value) {
    return DEFAULT_PROMETHEUS_BASE;
  }
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

export const PROMETHEUS_BASE_URL = ensureBaseUrl(
  process.env.REACT_APP_PROMETHEUS_BASE_URL
);

export const escapePrometheusRegex = (value) => {
  if (!value) {
    return '.*';
  }
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const buildNamespacePattern = (value) => {
  const trimmed = (value || '').trim();
  if (!trimmed || trimmed === '.*') {
    return '.*';
  }
  if (/[\^$.|?*+()[\]{}]/.test(trimmed)) {
    return trimmed;
  }
  return `^${escapePrometheusRegex(trimmed)}$`;
};

const normaliseTimeInput = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'string') {
    if (value.trim().toLowerCase() === 'now') {
      return undefined;
    }
    return value;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return undefined;
    }
    return value.toISOString();
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return undefined;
    }
    if (value > 1e11) {
      return new Date(value).toISOString();
    }
    return value.toString();
  }
  return undefined;
};

const buildPrometheusUrl = (path, params = {}) => {
  const url = new URL(`${PROMETHEUS_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, rawValue]) => {
    const value = rawValue;
    if (value === undefined || value === null || value === '') {
      return;
    }
    url.searchParams.append(key, value);
  });
  return url.toString();
};

const requestPrometheus = async (path, params = {}, { signal } = {}) => {
  const url = buildPrometheusUrl(path, params);
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Prometheus HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload.status !== 'success') {
    const reason = payload.error || payload.errorType || 'Prometheus query failed';
    throw new Error(reason);
  }
  return {
    data: payload.data,
    warnings: payload.warnings,
  };
};

export const promQuery = async ({ query, time, signal }) => {
  if (!query) {
    throw new Error('Prometheus query is required.');
  }
  const params = { query };
  const timeValue = normaliseTimeInput(time);
  if (timeValue !== undefined) {
    params.time = timeValue;
  }
  const { data } = await requestPrometheus('/api/v1/query', params, { signal });
  return data;
};

export const promQueryRange = async ({
  query,
  start,
  end,
  step = '1h',
  signal,
}) => {
  if (!query) {
    throw new Error('Prometheus range query requires a query expression.');
  }
  const params = { query, step };
  const startValue = normaliseTimeInput(start);
  const endValue = normaliseTimeInput(end);
  if (!startValue || !endValue) {
    throw new Error('Prometheus range query requires valid start and end times.');
  }
  params.start = startValue;
  params.end = endValue;
  const { data } = await requestPrometheus('/api/v1/query_range', params, {
    signal,
  });
  return data;
};

export const buildNamespaceQuery = (metric, namespacePattern) => {
  const trimmed = (namespacePattern || '').trim();
  const selector =
    trimmed && trimmed !== '.*'
      ? `{exported_namespace=~"${trimmed}"}`
      : '{exported_namespace=~".*"}';
  return `${metric}${selector}`;
};
