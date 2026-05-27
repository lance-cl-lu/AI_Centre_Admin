import React, {useState, useEffect, useContext, useRef, useMemo, useCallback} from "react";
import AuthContext from "../context/AuthContext";
import { PieChart } from 'react-minimal-pie-chart';
import { Card, Row, Col } from 'react-bootstrap';
import './Home.css'
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { KUBEFLOW_HTTP } from './Urls';
import CountUp from 'react-countup';
import {
  promQuery,
  promQueryRange,
  buildNamespaceQuery,
  buildUserNamespaceQuery,
  buildNamespacePattern,
  getNamespaceMetricService,
  setNamespaceMetricService,
  getNamespaceMetricServiceOption,
  PROMETHEUS_NAMESPACE_METRIC_SERVICE_OPTIONS,
} from '../api/prometheus';


function getRandomBlueShade() {
  const blueComponent = Math.floor(Math.random() * 256).toString(16).padStart(2, '0'); // Random blue component
  const color = `#0000${blueComponent}`; // Fixed red and green, random blue
  return color;
}

function getRandomOrangeShade() {
  const redComponent = Math.floor(Math.random() * 128 + 128).toString(16).padStart(2, '0'); // Random red component in the orange range
  const greenComponent = Math.floor(Math.random() * 128).toString(16).padStart(2, '0'); // Random green component
  const blueComponent = Math.floor(Math.random() * 128).toString(16).padStart(2, '0'); // Random blue component
  const color = `#${redComponent}${greenComponent}${blueComponent}`; // Random orange shade

  return color;
}


const parseDateTimeInput = (value) => {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.toLowerCase() === 'now') {
    return new Date();
  }
  const candidate = trimmed.replace(' ', 'T');
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const normaliseRangeValues = (series) => {
  if (!series || !Array.isArray(series.values)) {
    return [];
  }
  return series.values
    .map(([timestamp, value]) => [Number(timestamp), Number(value)])
    .filter(([, value]) => Number.isFinite(value));
};

const formatMetricValue = (value, maximumFractionDigits = 2) => {
  if (!Number.isFinite(value)) {
    return 'NaN';
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
};

const formatTimestamp = (seconds) => {
  if (!Number.isFinite(seconds)) {
    return '未知時間';
  }
  return new Date(seconds * 1000).toLocaleString();
};

const formatMinutes = (minutes, maximumFractionDigits = 1) => {
  if (!Number.isFinite(minutes)) {
    return '無資料';
  }
  return formatMetricValue(minutes, maximumFractionDigits) + ' 分鐘';
};

const formatBillingHours = (minutes) => {
  if (!Number.isFinite(minutes)) {
    return '無資料';
  }
  const hours = minutes / 60;
  return formatMetricValue(hours, 2) + ' 小時（' + formatMetricValue(minutes, 1) + ' 分鐘）';
};

const summariseSeriesDiff = (values) => {
  if (!values.length) {
    return {
      diff: 0,
      minValue: 0,
      maxValue: 0,
      minTimestamp: null,
      maxTimestamp: null,
    };
  }
  let minValue = values[0][1];
  let maxValue = values[0][1];
  let minTimestamp = values[0][0];
  let maxTimestamp = values[0][0];
  for (let index = 1; index < values.length; index += 1) {
    const [timestamp, numericValue] = values[index];
    if (numericValue < minValue) {
      minValue = numericValue;
      minTimestamp = timestamp;
    }
    if (numericValue > maxValue) {
      maxValue = numericValue;
      maxTimestamp = timestamp;
    }
  }
  return {
    diff: Math.max(0, maxValue - minValue),
    minValue,
    maxValue,
    minTimestamp,
    maxTimestamp,
  };
};

const HOME_USAGE_QUERY_MAX_POINTS = 50000;
const HOME_USAGE_QUERY_CHUNK_MAX_POINTS = 10000;
const V71_NAMESPACE_METRIC_SERVICE = 'prom-app-v71';

const V71_USAGE_METRICS = {
  namespace_cpu_cost: {
    cpu: true,
    gpu: false,
    usageUnit: 'CPU core',
  },
  namespace_gpu_cost: {
    cpu: false,
    gpu: true,
    usageUnit: 'GPU card',
  },
  namespace_total_cost: {
    cpu: true,
    gpu: true,
    usageUnit: '',
  },
};

const toNumericValue = (value) => {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]+/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const getCostRatesFromConfig = (costConfig) => ({
  cpuCostPerMinute: toNumericValue(costConfig.cpuCostPerMinute),
  gpuCostPerMinute: toNumericValue(costConfig.gpuCostPerMinute),
});

const getV71RangeQueryStep = ({ startDate, endDate, namespacePattern }) => {
  const durationMinutes = Math.max(
    1,
    Math.ceil((endDate.getTime() - startDate.getTime()) / 60000)
  );
  const minimumStepMinutes = 1;
  const boundedStepMinutes = Math.max(
    minimumStepMinutes,
    Math.ceil(durationMinutes / HOME_USAGE_QUERY_MAX_POINTS)
  );
  return `${boundedStepMinutes}m`;
};

const parsePrometheusDurationToSeconds = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const match = String(value || '').trim().match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d|w|y)$/);
  if (!match) {
    return 60;
  }
  const amount = Number(match[1]);
  const multipliers = {
    ms: 0.001,
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
    w: 7 * 24 * 60 * 60,
    y: 365 * 24 * 60 * 60,
  };
  return amount * multipliers[match[2]];
};

const getMetricKey = (metricInfo = {}) => {
  return JSON.stringify(
    Object.keys(metricInfo)
      .sort()
      .reduce((entry, key) => ({
        ...entry,
        [key]: metricInfo[key],
      }), {})
  );
};

const combineRangeChunks = (chunks) => {
  const seriesByMetric = new Map();
  chunks.forEach((chunk) => {
    if (!chunk || !Array.isArray(chunk.result)) {
      return;
    }
    chunk.result.forEach((series) => {
      const metric = series.metric || {};
      const key = getMetricKey(metric);
      if (!seriesByMetric.has(key)) {
        seriesByMetric.set(key, {
          metric,
          values: new Map(),
        });
      }
      const entry = seriesByMetric.get(key);
      (series.values || []).forEach(([rawTimestamp, rawValue]) => {
        const timestamp = Number(rawTimestamp);
        const value = Number(rawValue);
        if (!Number.isFinite(timestamp) || !Number.isFinite(value)) {
          return;
        }
        entry.values.set(timestamp, value.toString());
      });
    });
  });

  return {
    result: Array.from(seriesByMetric.values()).map((series) => ({
      metric: series.metric,
      values: Array.from(series.values.entries())
        .sort((left, right) => left[0] - right[0])
        .map(([timestamp, value]) => [timestamp, value]),
    })),
  };
};

const promQueryRangeChunked = async ({
  query,
  start,
  end,
  step,
  signal,
}) => {
  const stepSeconds = parsePrometheusDurationToSeconds(step);
  const stepMs = Math.max(1000, stepSeconds * 1000);
  const maxChunkSpanMs = stepMs * (HOME_USAGE_QUERY_CHUNK_MAX_POINTS - 1);
  const endMs = end.getTime();
  let cursorMs = start.getTime();
  const chunks = [];

  while (cursorMs <= endMs) {
    const chunkEndMs = Math.min(endMs, cursorMs + maxChunkSpanMs);
    const chunk = await promQueryRange({
      query,
      start: new Date(cursorMs),
      end: new Date(chunkEndMs),
      step,
      signal,
    });
    chunks.push(chunk);
    cursorMs = chunkEndMs + stepMs;
  }

  return combineRangeChunks(chunks);
};

const extractInstantNamespaceValues = (dataset) => {
  const values = new Map();
  if (!dataset || !Array.isArray(dataset.result)) {
    return values;
  }
  dataset.result.forEach((item) => {
    const metricInfo = item.metric || {};
    const namespaceLabel =
      metricInfo.user_namespace
      || metricInfo.exported_namespace
      || metricInfo.namespace
      || '(unknown)';
    const [rawTimestamp, rawValue] = item.value || [];
    const numericValue = Number(rawValue);
    if (!namespaceLabel || !Number.isFinite(numericValue)) {
      return;
    }
    const timestamp = Number(rawTimestamp);
    values.set(namespaceLabel, {
      value: numericValue,
      timestamp: Number.isFinite(timestamp) ? timestamp : null,
    });
  });
  return values;
};

const extractRangeNamespaceValues = (dataset) => {
  const values = new Map();
  if (!dataset || !Array.isArray(dataset.result)) {
    return values;
  }
  dataset.result.forEach((series) => {
    const metricInfo = series.metric || {};
    const namespaceLabel =
      metricInfo.user_namespace
      || metricInfo.exported_namespace
      || metricInfo.namespace
      || '(unknown)';
    if (!namespaceLabel) {
      return;
    }
    values.set(namespaceLabel, normaliseRangeValues(series));
  });
  return values;
};

const normaliseSteppedRangeValues = (values, startSeconds, endSeconds, stepSeconds) => {
  const sortedValues = (values || [])
    .filter(([timestamp, value]) => (
      Number.isFinite(timestamp)
      && Number.isFinite(value)
      && timestamp >= startSeconds
      && timestamp <= endSeconds
    ))
    .sort((left, right) => left[0] - right[0]);

  if (!sortedValues.length) {
    return [];
  }

  const normalised = [];
  sortedValues.forEach(([timestamp, value], index) => {
    normalised.push([timestamp, value]);
    if (!Number.isFinite(stepSeconds) || stepSeconds <= 0) {
      return;
    }
    const nextTimestamp = sortedValues[index + 1]?.[0] ?? endSeconds;
    const staleTimestamp = timestamp + stepSeconds;
    if (staleTimestamp < Math.min(nextTimestamp, endSeconds)) {
      normalised.push([staleTimestamp, 0]);
    }
  });
  return normalised.sort((left, right) => left[0] - right[0]);
};

const buildUsageSegments = ({
  cpuValues,
  gpuValues,
  startDate,
  endDate,
  costRates,
  includeCpu,
  includeGpu,
  stepSeconds,
}) => {
  const startSeconds = Math.floor(startDate.getTime() / 1000);
  const endSeconds = Math.floor(endDate.getTime() / 1000);
  const cpuSeries = includeCpu
    ? normaliseSteppedRangeValues(cpuValues, startSeconds, endSeconds, stepSeconds)
    : [];
  const gpuSeries = includeGpu
    ? normaliseSteppedRangeValues(gpuValues, startSeconds, endSeconds, stepSeconds)
    : [];
  const cpuCostRateSeries = includeCpu
    ? normaliseSteppedRangeValues(
      costRates.cpuCostRateValues,
      startSeconds,
      endSeconds,
      stepSeconds,
    )
    : [];
  const gpuCostRateSeries = includeGpu
    ? normaliseSteppedRangeValues(
      costRates.gpuCostRateValues,
      startSeconds,
      endSeconds,
      stepSeconds,
    )
    : [];
  const cpuByTimestamp = new Map(cpuSeries);
  const gpuByTimestamp = new Map(gpuSeries);
  const cpuCostRateByTimestamp = new Map(cpuCostRateSeries);
  const gpuCostRateByTimestamp = new Map(gpuCostRateSeries);
  const timeline = Array.from(new Set([
    ...cpuSeries.map(([timestamp]) => timestamp),
    ...gpuSeries.map(([timestamp]) => timestamp),
    ...cpuCostRateSeries.map(([timestamp]) => timestamp),
    ...gpuCostRateSeries.map(([timestamp]) => timestamp),
  ])).sort((left, right) => left - right);

  if (!timeline.length) {
    return [];
  }

  let currentCpu = 0;
  let currentGpu = 0;
  let currentCpuCostRate = 0;
  let currentGpuCostRate = 0;
  let previousTimestamp = startSeconds;
  let currentSegment = null;
  const segments = [];

  const closeSegment = () => {
    if (!currentSegment) {
      return;
    }
    if (currentSegment.durationMinutes > 0) {
      segments.push(currentSegment);
    }
    currentSegment = null;
  };

  const addInterval = (nextTimestamp) => {
    const boundedTimestamp = Math.min(nextTimestamp, endSeconds);
    const durationSeconds = Math.max(0, boundedTimestamp - previousTimestamp);
    if (!durationSeconds) {
      return;
    }
    const durationMinutes = durationSeconds / 60;
    const hasCpuUsage = includeCpu && currentCpuCostRate > 0;
    const hasGpuUsage = includeGpu && currentGpuCostRate > 0;
    if (!hasCpuUsage && !hasGpuUsage) {
      closeSegment();
      return;
    }
    if (!currentSegment) {
      currentSegment = {
        startTimestamp: previousTimestamp,
        endTimestamp: boundedTimestamp,
        durationMinutes: 0,
        cpuActiveMinutes: 0,
        gpuActiveMinutes: 0,
        cpuUsageMinutes: 0,
        gpuUsageMinutes: 0,
        cost: 0,
      };
    }
    currentSegment.endTimestamp = boundedTimestamp;
    currentSegment.durationMinutes += durationMinutes;
    if (hasCpuUsage) {
      currentSegment.cpuActiveMinutes += durationMinutes;
      currentSegment.cpuUsageMinutes += currentCpu * durationMinutes;
      currentSegment.cost += currentCpu * durationMinutes * costRates.cpuCostPerMinute;
    }
    if (hasGpuUsage) {
      currentSegment.gpuActiveMinutes += durationMinutes;
      currentSegment.gpuUsageMinutes += currentGpu * durationMinutes;
      currentSegment.cost += currentGpu * durationMinutes * costRates.gpuCostPerMinute;
    }
  };

  timeline.forEach((timestamp) => {
    addInterval(timestamp);
    previousTimestamp = Math.min(timestamp, endSeconds);
    if (cpuByTimestamp.has(timestamp)) {
      currentCpu = cpuByTimestamp.get(timestamp);
    }
    if (gpuByTimestamp.has(timestamp)) {
      currentGpu = gpuByTimestamp.get(timestamp);
    }
    if (cpuCostRateByTimestamp.has(timestamp)) {
      currentCpuCostRate = cpuCostRateByTimestamp.get(timestamp);
    }
    if (gpuCostRateByTimestamp.has(timestamp)) {
      currentGpuCostRate = gpuCostRateByTimestamp.get(timestamp);
    }
  });
  addInterval(endSeconds);
  closeSegment();

  return segments.map((segment) => ({
    ...segment,
    averageCpu: segment.cpuActiveMinutes > 0
      ? segment.cpuUsageMinutes / segment.cpuActiveMinutes
      : 0,
    averageGpu: segment.gpuActiveMinutes > 0
      ? segment.gpuUsageMinutes / segment.gpuActiveMinutes
      : 0,
  }));
};

const fetchV71UsageLeaders = async ({ costRates, signal }) => {
  const [cpuData, gpuData] = await Promise.all([
    promQuery({
      query: buildUserNamespaceQuery('cgu_namespace_billable_cpu_cores', '.*'),
      signal,
    }).catch(() => null),
    promQuery({
      query: buildUserNamespaceQuery('cgu:namespace_billable_gpu_cards_total', '.*'),
      signal,
    }).catch(() => null),
  ]);
  const cpuValues = extractInstantNamespaceValues(cpuData);
  const gpuValues = extractInstantNamespaceValues(gpuData);
  const namespaceLabels = new Set([
    ...Array.from(cpuValues.keys()),
    ...Array.from(gpuValues.keys()),
  ]);
  return Array.from(namespaceLabels)
    .map((namespaceLabel) => {
      const cpu = cpuValues.get(namespaceLabel)?.value || 0;
      const gpu = gpuValues.get(namespaceLabel)?.value || 0;
      return {
        namespaceLabel,
        cpu,
        gpu,
        costRate:
          cpu * costRates.cpuCostPerMinute
          + gpu * costRates.gpuCostPerMinute,
      };
    })
    .filter((row) => row.cpu > 0 || row.gpu > 0 || row.costRate > 0)
    .sort((left, right) => right.costRate - left.costRate)
    .slice(0, 5);
};

const filterNamespaces = (namespaces, keyword) => {
  if (!Array.isArray(namespaces) || !namespaces.length) {
    return [];
  }
  const trimmed = (keyword || '').trim();
  if (!trimmed) {
    return namespaces;
  }
  try {
    const regex = new RegExp(trimmed, 'i');
    return namespaces.filter((item) => regex.test(item));
  } catch (error) {
    const lower = trimmed.toLowerCase();
    return namespaces.filter((item) => item.toLowerCase().includes(lower));
  }
};

const NamespacePicker = ({
  selectId,
  selected,
  onSelect,
  keyword,
  onKeywordChange,
  filteredOptions,
  includeAllOption,
}) => {
  const trimmedKeyword = keyword.trim();
  const showAllOption = includeAllOption && !trimmedKeyword;
  const previewItems = filteredOptions.slice(0, 10);
  return (
    <>
      <div className="d-flex flex-column flex-md-row gap-2">
        <select
          id={selectId}
          className="form-select"
          value={selected}
          onChange={(event) => onSelect(event.target.value)}
        >
          {showAllOption && <option value="">全部 Namespace</option>}
          {filteredOptions.map((namespace) => (
            <option key={namespace} value={namespace}>
              {namespace}
            </option>
          ))}
        </select>
        <input
          className="form-control"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="Search Namespace"
        />
      </div>
      <div className="mt-2">
        <span>User Filter:</span>
        <ul className="list-unstyled mb-0 small">
          {filteredOptions.length === 0 ? (
            <li>無符合項目</li>
          ) : (
            previewItems.map((namespace) => <li key={namespace}>{namespace}</li>)
          )}
          {filteredOptions.length > previewItems.length ? <li>...</li> : null}
        </ul>
      </div>
    </>
  );
};

const getNamespaceKey = (metricInfo = {}) => {
  return metricInfo.exported_namespace || metricInfo.namespace || JSON.stringify(metricInfo);
};

const buildNamespaceMetricInfo = (metricInfo = {}) => {
  const namespaceValue = metricInfo.exported_namespace || metricInfo.namespace;
  if (namespaceValue) {
    return { exported_namespace: namespaceValue };
  }
  return { ...metricInfo };
};

const combineInstantNamespaceResults = (...datasets) => {
  const map = new Map();
  datasets.forEach((dataset) => {
    if (!dataset || !Array.isArray(dataset.result)) {
      return;
    }
    dataset.result.forEach((item) => {
      const metricInfo = item.metric || {};
      const key = getNamespaceKey(metricInfo);
      if (!map.has(key)) {
        map.set(key, {
          metric: buildNamespaceMetricInfo(metricInfo),
          sum: 0,
          timestamp: null,
          hasValue: false,
        });
      }
      const entry = map.get(key);
      const [rawTimestamp, rawValue] = item.value || [];
      const timestamp = Number(rawTimestamp);
      const numericValue = Number(rawValue);
      if (Number.isFinite(numericValue)) {
        entry.sum += numericValue;
        entry.hasValue = true;
      }
      if (Number.isFinite(timestamp)) {
        if (entry.timestamp === null || timestamp > entry.timestamp) {
          entry.timestamp = timestamp;
        }
      }
    });
  });
  const result = [];
  map.forEach((entry) => {
    if (!entry.hasValue) {
      return;
    }
    const timestamp = entry.timestamp !== null ? entry.timestamp : Math.floor(Date.now() / 1000);
    result.push({
      metric: entry.metric,
      value: [timestamp, entry.sum.toString()],
    });
  });
  return {
    result,
  };
};

const combineRangeNamespaceResults = (...datasets) => {
  const map = new Map();
  datasets.forEach((dataset) => {
    if (!dataset || !Array.isArray(dataset.result)) {
      return;
    }
    dataset.result.forEach((series) => {
      const metricInfo = series.metric || {};
      const key = getNamespaceKey(metricInfo);
      if (!map.has(key)) {
        map.set(key, {
          metric: buildNamespaceMetricInfo(metricInfo),
          values: new Map(),
        });
      }
      const entry = map.get(key);
      (series.values || []).forEach(([rawTimestamp, rawValue]) => {
        const timestamp = Number(rawTimestamp);
        const numericValue = Number(rawValue);
        if (!Number.isFinite(timestamp) || !Number.isFinite(numericValue)) {
          return;
        }
        const previous = entry.values.get(timestamp) || 0;
        entry.values.set(timestamp, previous + numericValue);
      });
    });
  });
  const result = [];
  map.forEach((entry) => {
    if (!entry.values.size) {
      return;
    }
    const sortedValues = Array.from(entry.values.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([timestamp, sum]) => [timestamp, sum.toString()]);
    result.push({
      metric: entry.metric,
      values: sortedValues,
    });
  });
  return {
    result,
  };
};

const TIME_METRIC_MAP = {
  namespace_cpu_cost: ['namespace_cpu_cost_time'],
  namespace_gpu_cost: ['namespace_gpu_cost_time'],
  namespace_total_cost: ['namespace_cpu_cost_time', 'namespace_gpu_cost_time'],
};

const fetchFixedNamespaceMetric = async ({
  metric,
  namespacePattern,
  serviceName,
  time,
  signal,
}) => {
  const query = buildNamespaceQuery(metric, namespacePattern, serviceName);
  const data = await promQuery({
    query,
    time,
    signal,
  });
  if (
    metric !== 'namespace_total_cost'
    || (data && Array.isArray(data.result) && data.result.length)
  ) {
    return data;
  }
  const [cpuData, gpuData] = await Promise.all([
    promQuery({
      query: buildNamespaceQuery('namespace_cpu_cost', namespacePattern, serviceName),
      time,
      signal,
    }).catch(() => null),
    promQuery({
      query: buildNamespaceQuery('namespace_gpu_cost', namespacePattern, serviceName),
      time,
      signal,
    }).catch(() => null),
  ]);
  return combineInstantNamespaceResults(cpuData, gpuData);
};

const fetchFixedNamespaceTimeMetric = async ({
  metric,
  namespacePattern,
  serviceName,
  time,
  signal,
}) => {
  const metricNames = TIME_METRIC_MAP[metric];
  if (!Array.isArray(metricNames) || !metricNames.length) {
    return null;
  }
  const datasets = await Promise.all(
    metricNames.map((metricName) =>
      promQuery({
        query: buildNamespaceQuery(metricName, namespacePattern, serviceName),
        time,
        signal,
      }).catch(() => null),
    ),
  );
  return combineInstantNamespaceResults(...datasets);
};

const fetchRangeNamespaceMetric = async ({
  metric,
  namespacePattern,
  serviceName,
  start,
  end,
  step,
  signal,
}) => {
  const query = buildNamespaceQuery(metric, namespacePattern, serviceName);
  const data = await promQueryRange({
    query,
    start,
    end,
    step,
    signal,
  });
  if (
    metric !== 'namespace_total_cost'
    || (data && Array.isArray(data.result) && data.result.length)
  ) {
    return data;
  }
  const [cpuData, gpuData] = await Promise.all([
    promQueryRange({
      query: buildNamespaceQuery('namespace_cpu_cost', namespacePattern, serviceName),
      start,
      end,
      step,
      signal,
    }).catch(() => null),
    promQueryRange({
      query: buildNamespaceQuery('namespace_gpu_cost', namespacePattern, serviceName),
      start,
      end,
      step,
      signal,
    }).catch(() => null),
  ]);
  return combineRangeNamespaceResults(cpuData, gpuData);
};

const fetchRangeNamespaceTimeMetric = async ({
  metric,
  namespacePattern,
  serviceName,
  start,
  end,
  step,
  costRates,
  signal,
}) => {
  const metricNames = TIME_METRIC_MAP[metric];
  if (!Array.isArray(metricNames) || !metricNames.length) {
    return null;
  }
  const datasets = await Promise.all(
    metricNames.map((metricName) =>
      promQueryRange({
        query: buildNamespaceQuery(metricName, namespacePattern, serviceName),
        start,
        end,
        step,
        signal,
      }).catch(() => null),
    ),
  );
  return combineRangeNamespaceResults(...datasets);
};

const fetchV71FixedNamespaceSummary = async ({
  metric,
  namespacePattern,
  time,
  costRates,
  signal,
}) => {
  const metricConfig = V71_USAGE_METRICS[metric] || V71_USAGE_METRICS.namespace_cpu_cost;
  const queryRequests = [];
  if (metricConfig.cpu) {
    queryRequests.push({
      key: 'cpu',
      request: promQuery({
        query: buildUserNamespaceQuery('cgu_namespace_billable_cpu_cores', namespacePattern),
        time,
        signal,
      }).catch(() => null),
    });
  }
  if (metricConfig.gpu) {
    queryRequests.push({
      key: 'gpu',
      request: promQuery({
        query: buildUserNamespaceQuery('cgu:namespace_billable_gpu_cards_total', namespacePattern),
        time,
        signal,
      }).catch(() => null),
    });
  }

  const resolved = await Promise.all(queryRequests.map((item) => item.request));
  const datasets = {};
  resolved.forEach((dataset, index) => {
    datasets[queryRequests[index].key] = extractInstantNamespaceValues(dataset);
  });

  const namespaceLabels = new Set();
  Object.values(datasets).forEach((values) => {
    values.forEach((_, namespaceLabel) => namespaceLabels.add(namespaceLabel));
  });

  return Array.from(namespaceLabels).map((namespaceLabel) => {
    const cpuEntry = datasets.cpu?.get(namespaceLabel);
    const gpuEntry = datasets.gpu?.get(namespaceLabel);
    const cpuValue = cpuEntry?.value || 0;
    const gpuValue = gpuEntry?.value || 0;
    const cost =
      (metricConfig.cpu ? cpuValue * costRates.cpuCostPerMinute : 0)
      + (metricConfig.gpu ? gpuValue * costRates.gpuCostPerMinute : 0);
    const usageValue =
      metric === 'namespace_cpu_cost'
        ? cpuValue
        : metric === 'namespace_gpu_cost'
          ? gpuValue
          : null;
    const usageText =
      metric === 'namespace_total_cost'
        ? `CPU ${formatMetricValue(cpuValue, 2)} core / GPU ${formatMetricValue(gpuValue, 2)} card`
        : '';
    const timestamps = [cpuEntry?.timestamp, gpuEntry?.timestamp].filter(Number.isFinite);
    return {
      namespaceLabel,
      cost,
      time: usageValue,
      timeText: usageText,
      timestamp: timestamps.length ? Math.max(...timestamps) : null,
      usageUnit: metricConfig.usageUnit,
      source: 'v71',
    };
  });
};

const fetchV71RangeNamespaceSummary = async ({
  metric,
  namespacePattern,
  start,
  end,
  step,
  costRates,
  signal,
}) => {
  const metricConfig = V71_USAGE_METRICS[metric] || V71_USAGE_METRICS.namespace_cpu_cost;
  const queryRequests = [];
  if (metricConfig.cpu) {
    queryRequests.push({
      key: 'cpu',
      request: promQueryRangeChunked({
        query: buildUserNamespaceQuery('cgu_namespace_billable_cpu_cores', namespacePattern),
        start,
        end,
        step,
        signal,
      }).catch(() => null),
    });
    queryRequests.push({
      key: 'cpuCostRate',
      request: promQueryRangeChunked({
        query: buildUserNamespaceQuery('cgu_namespace_billable_cpu_cost_per_minute', namespacePattern),
        start,
        end,
        step,
        signal,
      }).catch(() => null),
    });
  }
  if (metricConfig.gpu) {
    queryRequests.push({
      key: 'gpu',
      request: promQueryRangeChunked({
        query: buildUserNamespaceQuery('cgu:namespace_billable_gpu_cards_total', namespacePattern),
        start,
        end,
        step,
        signal,
      }).catch(() => null),
    });
    queryRequests.push({
      key: 'gpuCostRate',
      request: promQueryRangeChunked({
        query: buildUserNamespaceQuery('cgu_namespace_billable_gpu_cost_per_minute', namespacePattern),
        start,
        end,
        step,
        signal,
      }).catch(() => null),
    });
  }

  const resolved = await Promise.all(queryRequests.map((item) => item.request));
  const datasets = {};
  resolved.forEach((dataset, index) => {
    datasets[queryRequests[index].key] = extractRangeNamespaceValues(dataset);
  });

  const namespaceLabels = new Set();
  Object.values(datasets).forEach((values) => {
    values.forEach((_, namespaceLabel) => namespaceLabels.add(namespaceLabel));
  });

  return Array.from(namespaceLabels).map((namespaceLabel) => {
    const cpuValues = datasets.cpu?.get(namespaceLabel) || [];
    const gpuValues = datasets.gpu?.get(namespaceLabel) || [];
    const cpuCostRateValues = datasets.cpuCostRate?.get(namespaceLabel) || [];
    const gpuCostRateValues = datasets.gpuCostRate?.get(namespaceLabel) || [];
    const usageSegments = buildUsageSegments({
      cpuValues,
      gpuValues,
      startDate: start,
      endDate: end,
      costRates: {
        cpuCostRateValues,
        gpuCostRateValues,
        cpuCostPerMinute: costRates.cpuCostPerMinute,
        gpuCostPerMinute: costRates.gpuCostPerMinute,
      },
      includeCpu: metricConfig.cpu,
      includeGpu: metricConfig.gpu,
      stepSeconds: parsePrometheusDurationToSeconds(step),
    });
    const costTotal = usageSegments.reduce((sum, segment) => sum + segment.cost, 0);
    const cpuUsageMinutes = usageSegments.reduce(
      (sum, segment) => sum + segment.cpuUsageMinutes,
      0,
    );
    const gpuUsageMinutes = usageSegments.reduce(
      (sum, segment) => sum + segment.gpuUsageMinutes,
      0,
    );
    const cpuActiveMinutes = usageSegments.reduce(
      (sum, segment) => sum + segment.cpuActiveMinutes,
      0,
    );
    const gpuActiveMinutes = usageSegments.reduce(
      (sum, segment) => sum + segment.gpuActiveMinutes,
      0,
    );

    return {
      namespaceLabel,
      costSummary: { diff: costTotal },
      cpuUsageMinutes: metricConfig.cpu ? cpuUsageMinutes : null,
      gpuUsageMinutes: metricConfig.gpu ? gpuUsageMinutes : null,
      cpuActiveMinutes: metricConfig.cpu ? cpuActiveMinutes : null,
      gpuActiveMinutes: metricConfig.gpu ? gpuActiveMinutes : null,
      cpuAverageCores:
        metricConfig.cpu && cpuActiveMinutes > 0 ? cpuUsageMinutes / cpuActiveMinutes : null,
      gpuAverageCards:
        metricConfig.gpu && gpuActiveMinutes > 0 ? gpuUsageMinutes / gpuActiveMinutes : null,
      usageSegments,
      usageUnit: metricConfig.usageUnit,
      source: 'v71',
    };
  }).filter((row) => row.costSummary.diff > 0 || row.usageSegments.length > 0);
};

const buildInstantNamespaceSummary = (costData, timeData) => {
  const map = new Map();
  const ingest = (dataset, key) => {
    if (!dataset || !Array.isArray(dataset.result)) {
      return;
    }
    dataset.result.forEach((item) => {
      const metricInfo = item.metric || {};
      const namespaceLabel =
        metricInfo.exported_namespace || metricInfo.namespace || '(unknown)';
      if (!namespaceLabel) {
        return;
      }
      const [rawTimestamp, rawValue] = item.value || [];
      const numericValue = Number(rawValue);
      if (!Number.isFinite(numericValue)) {
        return;
      }
      const timestamp = Number(rawTimestamp);
      const entry = map.get(namespaceLabel) || {
        namespaceLabel,
        cost: null,
        time: null,
        timestamp: null,
      };
      entry[key] = numericValue;
      if (Number.isFinite(timestamp)) {
        entry.timestamp =
          entry.timestamp === null ? timestamp : Math.max(entry.timestamp, timestamp);
      }
      map.set(namespaceLabel, entry);
    });
  };
  ingest(costData, 'cost');
  ingest(timeData, 'time');
  return Array.from(map.values());
};

const readJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
};

const buildRangeNamespaceSummary = (costData, timeData) => {
  const map = new Map();
  const ingest = (dataset, key) => {
    if (!dataset || !Array.isArray(dataset.result)) {
      return;
    }
    dataset.result.forEach((series) => {
      const metricInfo = series.metric || {};
      const namespaceLabel =
        metricInfo.exported_namespace || metricInfo.namespace || '(unknown)';
      if (!namespaceLabel) {
        return;
      }
      const entry = map.get(namespaceLabel) || {
        namespaceLabel,
        costValues: [],
        timeValues: [],
      };
      const values = normaliseRangeValues(series);
      if (key === 'costValues') {
        entry.costValues = values;
      } else if (key === 'timeValues') {
        entry.timeValues = values;
      }
      map.set(namespaceLabel, entry);
    });
  };
  ingest(costData, 'costValues');
  ingest(timeData, 'timeValues');
  return Array.from(map.values());
};


function Home() {
  let {user} = useContext(AuthContext);
  let [user_num, setUser_num] = useState(0);
  let [lab_num, setLab_num] = useState(0);
  const [PieData, setPieData] = useState([]);
  const [PieData2, setPieData2] = useState([]);
  const [namespaceOptions, setNamespaceOptions] = useState([]);
  const [nsFixed, setNsFixed] = useState('');
  const [fixedSearchKeyword, setFixedSearchKeyword] = useState('');
  const [metricFixed, setMetricFixed] = useState('namespace_cpu_cost');
  const [timeFixed, setTimeFixed] = useState('now');
  const [fixedOutput, setFixedOutput] = useState('請查詢…');
  const [fixedError, setFixedError] = useState('');
  const [fixedLoading, setFixedLoading] = useState(false);
  const [rangeNs, setRangeNs] = useState('');
  const [rangeSearchKeyword, setRangeSearchKeyword] = useState('');
  const [rangeMetric, setRangeMetric] = useState('namespace_total_cost');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeOutput, setRangeOutput] = useState('請查詢…');
  const [rangeError, setRangeError] = useState('');
  const [rangeLoading, setRangeLoading] = useState(false);
  const [activeUsageTab, setActiveUsageTab] = useState('fixed');
  const [fixedRows, setFixedRows] = useState([]);
  const [rangeRows, setRangeRows] = useState([]);
  const [rangeWindowLabel, setRangeWindowLabel] = useState('');
  const [usageLeaders, setUsageLeaders] = useState([]);
  const [usageLeadersLoading, setUsageLeadersLoading] = useState(false);
  const [usageLeadersError, setUsageLeadersError] = useState('');
  const [namespaceMetricService, setNamespaceMetricServiceState] = useState(
    () => getNamespaceMetricService()
  );
  const initialCostState = {
    cpuCostPerMinute: '',
    gpuCostPerMinute: '',
  };
  const [costForm, setCostForm] = useState(initialCostState);
  const [costOriginal, setCostOriginal] = useState(initialCostState);
  const [costLoading, setCostLoading] = useState(false);
  const [costSaving, setCostSaving] = useState(false);
  const [costMessage, setCostMessage] = useState('');
  const [costError, setCostError] = useState('');
  const [costEditMode, setCostEditMode] = useState(false);
  const fixedQueryAbort = useRef(null);
  const rangeQueryAbort = useRef(null);
  const fixedSearchTrimmed = useMemo(
    () => fixedSearchKeyword.trim(),
    [fixedSearchKeyword],
  );
  const rangeSearchTrimmed = useMemo(
    () => rangeSearchKeyword.trim(),
    [rangeSearchKeyword],
  );
  const filteredFixedNamespaces = useMemo(
    () => filterNamespaces(namespaceOptions, fixedSearchKeyword),
    [namespaceOptions, fixedSearchKeyword],
  );
  const filteredRangeNamespaces = useMemo(
    () => filterNamespaces(namespaceOptions, rangeSearchKeyword),
    [namespaceOptions, rangeSearchKeyword],
  );
  const namespaceMetricServiceOption = useMemo(
    () => getNamespaceMetricServiceOption(namespaceMetricService),
    [namespaceMetricService],
  );
  const isV71NamespaceMetricService =
    namespaceMetricService === V71_NAMESPACE_METRIC_SERVICE;
  const fixedCostColumnLabel = isV71NamespaceMetricService ? '即時費用率 / 分鐘' : '費用';
  const fixedTimeColumnLabel = isV71NamespaceMetricService ? '即時使用量' : '時間';
  const rangeCostColumnLabel = isV71NamespaceMetricService ? '區間費用' : '費用增量';
  const rangeCostMaxColumnLabel =
    isV71NamespaceMetricService ? '最大即時費用率 / 分鐘' : '費用最大值';
  const rangeCostMinColumnLabel =
    isV71NamespaceMetricService ? '最小即時費用率 / 分鐘' : '費用最小值';
  const rangeTimeColumnLabel = isV71NamespaceMetricService ? '區間計費使用量' : '時間增量';
  const rangeTimeMaxColumnLabel =
    isV71NamespaceMetricService ? '最大即時使用量' : '時間最大值';
  const rangeTimeMinColumnLabel =
    isV71NamespaceMetricService ? '最小即時使用量' : '時間最小值';
  const rangeUsageSegments = useMemo(() => {
    return rangeRows.flatMap((row) => {
      return (row.usageSegments || []).map((segment, index) => ({
        ...segment,
        namespaceLabel: row.namespaceLabel,
        segmentKey: `${row.namespaceLabel}-${segment.startTimestamp}-${segment.endTimestamp}-${index}`,
      }));
    }).sort((left, right) => {
      if (left.startTimestamp !== right.startTimestamp) {
        return left.startTimestamp - right.startTimestamp;
      }
      return left.namespaceLabel.localeCompare(right.namespaceLabel);
    });
  }, [rangeRows]);
  const hasCostConfigLoaded =
    costOriginal.cpuCostPerMinute !== '' || costOriginal.gpuCostPerMinute !== '';
  useEffect(() => {
    if (!isV71NamespaceMetricService || !hasCostConfigLoaded) {
      setUsageLeaders([]);
      setUsageLeadersError('');
      setUsageLeadersLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setUsageLeadersLoading(true);
    setUsageLeadersError('');
    fetchV71UsageLeaders({
      costRates: getCostRatesFromConfig(costOriginal),
      signal: controller.signal,
    })
      .then((rows) => {
        if (!controller.signal.aborted) {
          setUsageLeaders(rows);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted && error.name !== 'AbortError') {
          setUsageLeaders([]);
          setUsageLeadersError(error.message || '無法取得目前用量前五名。');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setUsageLeadersLoading(false);
        }
      });
    return () => controller.abort();
  }, [isV71NamespaceMetricService, hasCostConfigLoaded, costOriginal]);
  useEffect(() => {
    setNsFixed((current) => {
      if (!fixedSearchTrimmed) {
        return current;
      }
      if (!filteredFixedNamespaces.length) {
        return '';
      }
      const exactMatch = filteredFixedNamespaces.find(
        (item) => item.toLowerCase() === fixedSearchTrimmed.toLowerCase(),
      );
      if (exactMatch) {
        return exactMatch;
      }
      return filteredFixedNamespaces[0] || '';
    });
  }, [fixedSearchTrimmed, filteredFixedNamespaces]);
  useEffect(() => {
    setRangeNs((current) => {
      if (!rangeSearchTrimmed) {
        return current;
      }
      if (!filteredRangeNamespaces.length) {
        return '';
      }
      const exactMatch = filteredRangeNamespaces.find(
        (item) => item.toLowerCase() === rangeSearchTrimmed.toLowerCase(),
      );
      if (exactMatch) {
        return exactMatch;
      }
      return filteredRangeNamespaces[0] || '';
    });
  }, [rangeSearchTrimmed, filteredRangeNamespaces]);
  useEffect(() => {
    fetch('/api/home/', { // 'http://localhost:31190/api/ldap/home/
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .then(response => response.json())
    .then(data => {
      setUser_num(data.user_num);
      setLab_num(data.lab_num);
      setPieData((data.lab_list || []).map((lab) => {
        return { title: lab, value: 1, color: getRandomBlueShade() }
      }))
      const users = Array.isArray(data.user_list) ? data.user_list : [];
      setNamespaceOptions(users);
      setPieData2(users.map((user) => {
        return { title: user, value: 1, color: getRandomOrangeShade() }
      }))
      if (users.length) {
        setNsFixed((prev) => prev || users[0]);
        setRangeNs((prev) => prev || users[0]);
      }
    })
    .catch((error) => {
      console.error('Error:', error);
    }
    );
  }, [user]);

  useEffect(() => {
    return () => {
      if (fixedQueryAbort.current) {
        fixedQueryAbort.current.abort();
      }
      if (rangeQueryAbort.current) {
        rangeQueryAbort.current.abort();
      }
    };
  }, []);

  const fetchCostConfig = useCallback(async () => {
    setCostLoading(true);
    setCostError('');
    setCostMessage('');
    try {
      const response = await fetch('/api/node-resource-monitor/config/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await readJsonSafely(response);
      if (!response.ok) {
        const message = data?.detail || data?.error || '無法取得費率設定。';
        throw new Error(message);
      }
      const next = {
        cpuCostPerMinute: data?.cpuCostPerMinute ?? '',
        gpuCostPerMinute: data?.gpuCostPerMinute ?? '',
      };
      setCostOriginal(next);
      setCostForm(next);
      setCostEditMode(false);
    } catch (error) {
      setCostError(error.message || '無法取得費率設定。');
    } finally {
      setCostLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCostConfig();
  }, [fetchCostConfig]);


  const [unsyncList, setUnsyncList] = useState([]);
  useEffect(() => {
    fetch('/api/check/syschronize/', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .then(response => response.json())
    .then(data => {
      setUnsyncList(data);
    })
    .catch((error) => {
      console.error('Error: User Exist');
    }
    );
  }, []);


  const handleCostInputChange = (event) => {
    const { name, value } = event.target;
    setCostForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const beginCostEdit = () => {
    setCostForm(costOriginal);
    setCostEditMode(true);
    setCostError('');
    setCostMessage('');
  };

  const cancelCostEdit = () => {
    setCostForm(costOriginal);
    setCostEditMode(false);
    setCostError('');
    setCostMessage('');
  };

  const handleCostSubmit = async (event) => {
    event.preventDefault();
    if (!costEditMode) {
      return;
    }
    setCostError('');
    setCostMessage('');
    const payload = {};
    if (costForm.cpuCostPerMinute !== '') {
      payload.cpuCostPerMinute = costForm.cpuCostPerMinute;
    }
    if (costForm.gpuCostPerMinute !== '') {
      payload.gpuCostPerMinute = costForm.gpuCostPerMinute;
    }
    if (!Object.keys(payload).length) {
      setCostError('請輸入至少一個費率數值。');
      return;
    }
    setCostSaving(true);
    try {
      const response = await fetch('/api/node-resource-monitor/config/', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await readJsonSafely(response);
      if (!response.ok) {
        const firstError =
          (data?.errors && Object.values(data.errors).find(Boolean)) || null;
        const detail =
          (typeof firstError === 'string'
            ? firstError
            : Array.isArray(firstError)
              ? firstError[0]
              : null) ||
          data?.detail ||
          '費率更新失敗。';
        throw new Error(detail);
      }
      const next = {
        cpuCostPerMinute: data?.cpuCostPerMinute ?? '',
        gpuCostPerMinute: data?.gpuCostPerMinute ?? '',
      };
      setCostOriginal(next);
      setCostForm(next);
      setCostEditMode(false);
      setCostMessage('費率已更新，新的設定將立即生效。');
    } catch (error) {
      setCostError(error.message || '費率更新失敗。');
    } finally {
      setCostSaving(false);
    }
  };

  const pad = (n) => n.toString().padStart(2, '0');
  const fmt = (date) => {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T`
      + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const handleFixedQuery = async () => {
    const namespaceInput = nsFixed.trim() || '.*';
    setFixedError('');
    setFixedRows([]);
    setFixedOutput('');
    setFixedLoading(true);
    if (fixedQueryAbort.current) {
      fixedQueryAbort.current.abort();
    }
    const controller = new AbortController();
    fixedQueryAbort.current = controller;
    try {
      const timeValue = parseDateTimeInput(timeFixed);
      if (timeFixed && timeValue === null) {
        throw new Error('時間格式錯誤，請使用 YYYY-MM-DD HH:MM:SS 或 now');
      }
      const namespacePattern = buildNamespacePattern(namespaceInput);
      if (namespaceMetricService === V71_NAMESPACE_METRIC_SERVICE) {
        if (!hasCostConfigLoaded) {
          throw new Error('費率設定尚未載入，請稍後再查詢。');
        }
        const rows = await fetchV71FixedNamespaceSummary({
          metric: metricFixed,
          namespacePattern,
          time: timeValue || undefined,
          costRates: getCostRatesFromConfig(costOriginal),
          signal: controller.signal,
        });
        if (!rows.length) {
          setFixedOutput('No data');
          setFixedRows([]);
          return;
        }
        setFixedRows(rows);
        setFixedOutput('');
        return;
      }
      const [costData, timeData] = await Promise.all([
        fetchFixedNamespaceMetric({
          metric: metricFixed,
          namespacePattern,
          serviceName: namespaceMetricService,
          time: timeValue || undefined,
          signal: controller.signal,
        }),
        fetchFixedNamespaceTimeMetric({
          metric: metricFixed,
          namespacePattern,
          serviceName: namespaceMetricService,
          time: timeValue || undefined,
          signal: controller.signal,
        }),
      ]);
      const summaries = buildInstantNamespaceSummary(costData, timeData);
      if (!summaries.length) {
        setFixedOutput('No data');
        setFixedRows([]);
        return;
      }
      const rows = summaries.map((entry) => ({
        namespaceLabel: entry.namespaceLabel,
        cost: entry.cost,
        time: entry.time,
        timestamp: entry.timestamp,
      }));
      setFixedRows(rows);
      setFixedOutput('');
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }
      setFixedError(error.message || '查詢失敗');
      setFixedOutput('');
      setFixedRows([]);
    } finally {
      setFixedLoading(false);
      if (fixedQueryAbort.current === controller) {
        fixedQueryAbort.current = null;
      }
    }
  };

  const handleRangeQuery = async () => {
    const namespaceInput = rangeNs.trim() || '.*';
    setRangeError('');
    setRangeRows([]);
    setRangeWindowLabel('');
    setRangeOutput('');
    setRangeLoading(true);
    if (rangeQueryAbort.current) {
      rangeQueryAbort.current.abort();
    }
    const controller = new AbortController();
    rangeQueryAbort.current = controller;
    try {
      const startDate = parseDateTimeInput(rangeStart);
      const endDate = parseDateTimeInput(rangeEnd);
      if (!startDate || !endDate) {
        throw new Error('請輸入正確的開始與結束時間');
      }
      if (endDate <= startDate) {
        throw new Error('結束時間需晚於開始時間');
      }
      const namespacePattern = buildNamespacePattern(namespaceInput);
      const header = `區間: ${startDate.toLocaleString()} → ${endDate.toLocaleString()}`;
      if (namespaceMetricService === V71_NAMESPACE_METRIC_SERVICE) {
        if (!hasCostConfigLoaded) {
          throw new Error('費率設定尚未載入，請稍後再查詢。');
        }
        const rangeStep = getV71RangeQueryStep({
          startDate,
          endDate,
          namespacePattern,
        });
        const rows = await fetchV71RangeNamespaceSummary({
          metric: rangeMetric,
          namespacePattern,
          start: startDate,
          end: endDate,
          step: rangeStep,
          costRates: getCostRatesFromConfig(costOriginal),
          signal: controller.signal,
        });
        setRangeWindowLabel(
          `${header}；資料粒度：${rangeStep}；只列入歷史費用率大於 0 的區段，費用用目前費率設定計算`
        );
        if (!rows.length) {
          setRangeRows([]);
          setRangeOutput('No data');
          return;
        }
        setRangeRows(rows);
        setRangeOutput('');
        return;
      }
      const [costData, timeData] = await Promise.all([
        fetchRangeNamespaceMetric({
          metric: rangeMetric,
          namespacePattern,
          serviceName: namespaceMetricService,
          start: startDate,
          end: endDate,
          step: '6h',
          signal: controller.signal,
        }),
        fetchRangeNamespaceTimeMetric({
          metric: rangeMetric,
          namespacePattern,
          serviceName: namespaceMetricService,
          start: startDate,
          end: endDate,
          step: '6h',
          signal: controller.signal,
        }),
      ]);
      const summaries = buildRangeNamespaceSummary(costData, timeData);
      if (!summaries.length) {
        setRangeWindowLabel(header);
        setRangeRows([]);
        setRangeOutput('No data');
        return;
      }
      const rows = summaries.map((entry) => {
        const hasCost = entry.costValues && entry.costValues.length;
        const hasTime = entry.timeValues && entry.timeValues.length;
        return {
          namespaceLabel: entry.namespaceLabel,
          costSummary: hasCost ? summariseSeriesDiff(entry.costValues) : null,
          timeSummary: hasTime ? summariseSeriesDiff(entry.timeValues) : null,
        };
      });
      setRangeWindowLabel(header);
      setRangeRows(rows);
      setRangeOutput('');
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }
      setRangeError(error.message || '查詢失敗');
      setRangeRows([]);
      setRangeWindowLabel('');
      setRangeOutput('');
    } finally {
      setRangeLoading(false);
      if (rangeQueryAbort.current === controller) {
        rangeQueryAbort.current = null;
      }
    }
  };

  const handleSetLastMonth = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const start = new Date(y, m - 1, 1, 0, 0, 0);
    const end = new Date(y, m, 0, 23, 59, 59);
    setRangeStart(fmt(start));
    setRangeEnd(fmt(end));
  };

  const handleSetThisMonth = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const start = new Date(y, m, 1, 0, 0, 0);
    setRangeStart(fmt(start));
    setRangeEnd(fmt(now));
  };

  const handleNamespaceMetricServiceChange = (event) => {
    const next = setNamespaceMetricService(event.target.value);
    setNamespaceMetricServiceState(next);
    setFixedRows([]);
    setRangeRows([]);
    setFixedOutput('請查詢…');
    setRangeOutput('請查詢…');
    setFixedError('');
    setRangeError('');
  };


  return (
    <div className="Home">
      <div className="jumbotron">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.8,
            delay: 0.6,
            ease: [0, 0.71, 0.2, 1.01],
          }}
        >
          <div className="pie">
            <div className="piediv">
              <h2 style={{ marginTop: '5%', fontFamily: 'Bahnschrift light' }}>
                ??# of users: <CountUp end={user_num} duration={5} />
              </h2>
              <PieChart
                className="PieStyle"
                data={PieData2}
                labelStyle={{
                  textAlign: 'center',
                }}
              />
            </div>
            <div className="piediv">
              <h2 style={{ marginTop: '5%', fontFamily: 'Bahnschrift light' }}>
                ??# of labs: <CountUp end={lab_num} duration={5} />
              </h2>
              <PieChart
                className="PieStyle"
                data={PieData}
                labelStyle={{
                  textAlign: 'center',
                }}
              />
            </div>
          </div>
        </motion.div>

        {/* <Card className="text-center mt-4">
            <Card.Header>Kubeflow</Card.Header>
            <Card.Body>
              <Card.Title>AI Center LDAP管理平台</Card.Title>
              <Card.Text>
                CGU LDAP management platform provides features the faculty needs to
                facilitate the permission of AI center users.
              </Card.Text>
              <a
                href={KUBEFLOW_HTTP}
                className="btn btn-primary"
                target="_blank"
                rel="noreferrer"
              >
                Kubeflow dashboard
              </a>
            </Card.Body>
          </Card>

          <Row xs={1} md={2} className="g-3 mt-3">
            <Col>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title>平台介紹</Card.Title>
                  <Card.Text>
                    The CGU AI Center website manages user information and
                    permissions for the AI Center&apos;s exclusive environment.
                  </Card.Text>
                  <Link
                    to="/lab"
                    state={{ lab: null }}
                    className="btn btn-primary"
                  >
                    Lab
                  </Link>
                </Card.Body>
              </Card>
            </Col>
            <Col>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title>通知總覽</Card.Title>
                  <Card.Text>
                    CGU AI Center has the following data not yet synchronized with
                    LDAP:
                  </Card.Text>
                  <ul style={{ marginTop: '1vh', maxHeight: '120px', overflowY: 'auto' }}>
                    {unsyncList.map((msg, index) => (
                      <li
                        key={index}
                        style={{ fontSize: '12px', marginBottom: '5px' }}
                      >
                        {msg.message}
                      </li>
                    ))}
                  </ul>
                  <Link to="/notification" className="btn btn-primary">
                    通知細項
                  </Link>
                </Card.Body>
              </Card>
            </Col>
          </Row> */}

        <Card className="mt-4">
          <Card.Header>Node Resource Monitor 費率設定</Card.Header>
          <Card.Body className="text-start">
            <p className="text-muted small mb-3">
              直接更新 `node-resource-monitor-config` ConfigMap（namespace: cgu）中的
              CPU/GPU 每分鐘費率，變更後新的計費將立即採用最新設定。
            </p>
            <div className="mb-2 small text-muted">
              <strong>目前 CPU：</strong>
              {costOriginal.cpuCostPerMinute !== ''
                ? `$${costOriginal.cpuCostPerMinute} / min`
                : '尚未設定'}
              ，<strong>目前 GPU：</strong>
              {costOriginal.gpuCostPerMinute !== ''
                ? `$${costOriginal.gpuCostPerMinute} / min`
                : '尚未設定'}
            </div>
            <form onSubmit={handleCostSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="cpu-cost-input">
                    CPU 費率（每分鐘）
                  </label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input
                      id="cpu-cost-input"
                      name="cpuCostPerMinute"
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-control"
                      value={costForm.cpuCostPerMinute}
                      onChange={handleCostInputChange}
                      disabled={!costEditMode || costLoading || costSaving}
                    />
                    <span className="input-group-text">/ min</span>
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="gpu-cost-input">
                    GPU 費率（每分鐘）
                  </label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input
                      id="gpu-cost-input"
                      name="gpuCostPerMinute"
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-control"
                      value={costForm.gpuCostPerMinute}
                      onChange={handleCostInputChange}
                      disabled={!costEditMode || costLoading || costSaving}
                    />
                    <span className="input-group-text">/ min</span>
                  </div>
                </div>
              </div>
              <div className="d-flex flex-wrap gap-2 mt-3 align-items-center">
                {costEditMode ? (
                  <>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={costSaving}
                    >
                      {costSaving ? '儲存中…' : '儲存費率'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={cancelCostEdit}
                      disabled={costSaving}
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={beginCostEdit}
                    disabled={costLoading}
                  >
                    編輯費率
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={fetchCostConfig}
                  disabled={costLoading || costSaving}
                >
                  重新讀取
                </button>
              </div>
              {costLoading ? (
                <div className="text-muted small mt-2">讀取費率中…</div>
              ) : null}
              {costError ? (
                <div className="text-danger small mt-2">{costError}</div>
              ) : null}
              {costMessage ? (
                <div className="text-success small mt-2">{costMessage}</div>
              ) : null}
            </form>
          </Card.Body>
        </Card>

        <Card className="mt-4">
          <Card.Header>Usage 查詢（Namespace Cost）</Card.Header>
          <Card.Body className="text-start">
            <div className="mb-3">
              <label className="form-label" htmlFor="namespace-metric-service-home">
                Prometheus 資料來源
              </label>
              <select
                id="namespace-metric-service-home"
                className="form-select"
                value={namespaceMetricService}
                onChange={handleNamespaceMetricServiceChange}
              >
                {PROMETHEUS_NAMESPACE_METRIC_SERVICE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.value})
                  </option>
                ))}
              </select>
              <div className="form-text">
                目前來源：{namespaceMetricServiceOption.label}。
                {namespaceMetricServiceOption.description}
              </div>
            </div>
            {isV71NamespaceMetricService ? (
              <div className="mb-3">
                <div className="usage-notice">
                  目前有用量的 Namespace 前五名（依即時費用率排序）
                </div>
                {usageLeadersLoading ? (
                  <div className="usage-loading">讀取中…</div>
                ) : usageLeadersError ? (
                  <div className="usage-error">{usageLeadersError}</div>
                ) : usageLeaders.length ? (
                  <table className="usage-table usage-table-compact">
                    <thead>
                      <tr>
                        <th>Namespace</th>
                        <th>即時費用率 / 分鐘</th>
                        <th>CPU</th>
                        <th>GPU</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageLeaders.map((row) => (
                        <tr key={row.namespaceLabel}>
                          <th scope="row">{row.namespaceLabel}</th>
                          <td>{formatMetricValue(row.costRate, 4)}</td>
                          <td>{formatMetricValue(row.cpu, 2)} core</td>
                          <td>{formatMetricValue(row.gpu, 2)} card</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="usage-empty">目前沒有正在計費的 Namespace。</div>
                )}
              </div>
            ) : null}
            <div className="usage-tabs">
              <button
                type="button"
                className={`usage-tab-btn ${activeUsageTab === 'fixed' ? 'active' : ''}`}
                onClick={() => setActiveUsageTab('fixed')}
              >
                固定時間查詢
              </button>
              <button
                type="button"
                className={`usage-tab-btn ${activeUsageTab === 'range' ? 'active' : ''}`}
                onClick={() => setActiveUsageTab('range')}
              >
                {isV71NamespaceMetricService ? '區間查詢（用量積分）' : '區間查詢 (max-min)'}
              </button>
            </div>

            {activeUsageTab === 'fixed' ? (
              <div className="usage-panel">
                <div className="usage-form-grid">
                  <div className="mb-3">
                    <label className="form-label" htmlFor="fixed-namespace-select">
                      Namespace
                    </label>
                    <NamespacePicker
                      selectId="fixed-namespace-select"
                      selected={nsFixed}
                      onSelect={setNsFixed}
                      keyword={fixedSearchKeyword}
                      onKeywordChange={setFixedSearchKeyword}
                      filteredOptions={filteredFixedNamespaces}
                      includeAllOption
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Metric</label>
                    <select
                      className="form-select"
                      value={metricFixed}
                      onChange={(event) => setMetricFixed(event.target.value)}
                    >
                      <option value="namespace_cpu_cost">CPU</option>
                      <option value="namespace_gpu_cost">GPU</option>
                      <option value="namespace_total_cost">Total</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Time</label>
                    <input
                      className="form-control"
                      value={timeFixed}
                      onChange={(event) => setTimeFixed(event.target.value)}
                      placeholder="YYYY-MM-DD HH:MM:SS 或 now"
                    />
                  </div>
                  <div className="d-flex gap-2 flex-wrap">
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={handleFixedQuery}
                      disabled={fixedLoading}
                    >
                      {fixedLoading ? '查詢中…' : '查詢'}
                    </button>
                  </div>
                </div>
                <div className="usage-results">
                  {fixedLoading ? (
                    <div className="usage-loading">查詢中…</div>
                  ) : null}
                  {fixedError ? (
                    <div className="usage-error">{fixedError}</div>
                  ) : null}
                  {!fixedLoading && !fixedError ? (
                    fixedRows.length ? (
                      <table className="usage-table usage-table-compact">
                        <thead>
                          <tr>
                            <th>Namespace</th>
                            <th>{fixedCostColumnLabel}</th>
                            <th>{fixedTimeColumnLabel}</th>
                            <th>查詢時間</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fixedRows.map((row) => (
                            <tr key={row.namespaceLabel}>
                              <th scope="row">{row.namespaceLabel}</th>
                              <td>
                                {row.cost !== null
                                  ? formatMetricValue(row.cost, 2)
                                  : '無資料'}
                              </td>
                              <td>
                                {row.timeText
                                  || (row.time !== null
                                    ? `${formatMetricValue(row.time, 2)}${row.usageUnit ? ` ${row.usageUnit}` : ''}`
                                    : '無資料')}
                              </td>
                              <td>
                                {row.timestamp !== null
                                  ? formatTimestamp(row.timestamp)
                                  : '未知時間'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="usage-empty">{fixedOutput || '請查詢…'}</div>
                    )
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="usage-panel">
                <div className="usage-form-grid">
                  <div className="mb-3">
                    <label className="form-label" htmlFor="range-namespace-select">
                      Namespace
                    </label>
                    <NamespacePicker
                      selectId="range-namespace-select"
                      selected={rangeNs}
                      onSelect={setRangeNs}
                      keyword={rangeSearchKeyword}
                      onKeywordChange={setRangeSearchKeyword}
                      filteredOptions={filteredRangeNamespaces}
                      includeAllOption
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Metric</label>
                    <select
                      className="form-select"
                      value={rangeMetric}
                      onChange={(event) => setRangeMetric(event.target.value)}
                    >
                      <option value="namespace_cpu_cost">CPU</option>
                      <option value="namespace_gpu_cost">GPU</option>
                      <option value="namespace_total_cost">Total</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Start</label>
                    <input
                      className="form-control"
                      type="datetime-local"
                      step="1"
                      value={rangeStart}
                      onChange={(event) => setRangeStart(event.target.value)}
                      placeholder="YYYY-MM-DDTHH:MM:SS"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">End</label>
                    <input
                      className="form-control"
                      type="datetime-local"
                      step="1"
                      value={rangeEnd}
                      onChange={(event) => setRangeEnd(event.target.value)}
                      placeholder="YYYY-MM-DDTHH:MM:SS"
                    />
                  </div>
                  <div className="mb-3 d-flex gap-2 flex-wrap">
                    <button
                      className="btn btn-outline-secondary"
                      type="button"
                      onClick={handleSetLastMonth}
                    >
                      上個月
                    </button>
                    <button
                      className="btn btn-outline-secondary"
                      type="button"
                      onClick={handleSetThisMonth}
                    >
                      本月至今
                    </button>
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={handleRangeQuery}
                      disabled={rangeLoading}
                    >
                      {rangeLoading ? '查詢中…' : '查詢區間'}
                    </button>
                  </div>
                </div>
                <div className="usage-results">
                  {rangeWindowLabel ? (
                    <div className="usage-notice">{rangeWindowLabel}</div>
                  ) : null}
                  {rangeLoading ? (
                    <div className="usage-loading">查詢中…</div>
                  ) : null}
                  {rangeError ? (
                    <div className="usage-error">{rangeError}</div>
                  ) : null}
                  {!rangeLoading && !rangeError ? (
                    rangeRows.length ? (
                      isV71NamespaceMetricService ? (
                        <>
                          <table className="usage-table usage-table-compact">
                            <thead>
                              <tr>
                                <th>Namespace</th>
                                <th>區間費用</th>
                                <th>平均 CPU core</th>
                                <th>CPU 計費小時</th>
                                <th>平均 GPU card</th>
                                <th>GPU 計費小時</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rangeRows.map((row) => (
                                <tr key={row.namespaceLabel}>
                                  <th scope="row">{row.namespaceLabel}</th>
                                  <td>
                                    {row.costSummary
                                      ? formatMetricValue(row.costSummary.diff, 2)
                                      : '無資料'}
                                  </td>
                                  <td>
                                    {row.cpuAverageCores !== null
                                      ? `${formatMetricValue(row.cpuAverageCores, 2)} core`
                                      : '無資料'}
                                  </td>
                                  <td>
                                    {row.cpuActiveMinutes !== null
                                      ? formatBillingHours(row.cpuActiveMinutes)
                                      : '無資料'}
                                  </td>
                                  <td>
                                    {row.gpuAverageCards !== null
                                      ? `${formatMetricValue(row.gpuAverageCards, 2)} card`
                                      : '無資料'}
                                  </td>
                                  <td>
                                    {row.gpuActiveMinutes !== null
                                      ? formatBillingHours(row.gpuActiveMinutes)
                                      : '無資料'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="usage-detail-title">使用區段明細</div>
                          {rangeUsageSegments.length ? (
                            <table className="usage-table usage-table-compact usage-detail-table">
                              <thead>
                                <tr>
                                  <th>Namespace</th>
                                  <th>開始</th>
                                  <th>結束</th>
                                  <th>使用分鐘</th>
                                  <th>CPU</th>
                                  <th>CPU 分鐘</th>
                                  <th>GPU</th>
                                  <th>GPU 分鐘</th>
                                  <th>費用</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rangeUsageSegments.map((segment) => (
                                  <tr key={segment.segmentKey}>
                                    <th scope="row">{segment.namespaceLabel}</th>
                                    <td>{formatTimestamp(segment.startTimestamp)}</td>
                                    <td>{formatTimestamp(segment.endTimestamp)}</td>
                                    <td>{formatMinutes(segment.durationMinutes)}</td>
                                    <td>
                                      {segment.cpuActiveMinutes > 0
                                        ? `${formatMetricValue(segment.averageCpu, 2)} core`
                                        : '無資料'}
                                    </td>
                                    <td>
                                      {segment.cpuActiveMinutes > 0
                                        ? formatMinutes(segment.cpuActiveMinutes)
                                        : '無資料'}
                                    </td>
                                    <td>
                                      {segment.gpuActiveMinutes > 0
                                        ? `${formatMetricValue(segment.averageGpu, 2)} card`
                                        : '無資料'}
                                    </td>
                                    <td>
                                      {segment.gpuActiveMinutes > 0
                                        ? formatMinutes(segment.gpuActiveMinutes)
                                        : '無資料'}
                                    </td>
	                                    <td>{formatMetricValue(segment.cost, 2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="usage-empty">沒有可列出的使用區段。</div>
                          )}
                        </>
                      ) : (
                        <table className="usage-table usage-table-compact">
                          <thead>
                            <tr>
                              <th>Namespace</th>
                              <th>{rangeCostColumnLabel}</th>
                              <th>{rangeCostMaxColumnLabel}</th>
                              <th>{rangeCostMinColumnLabel}</th>
                              <th>{rangeTimeColumnLabel}</th>
                              <th>{rangeTimeMaxColumnLabel}</th>
                              <th>{rangeTimeMinColumnLabel}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rangeRows.map((row) => (
                              <tr key={row.namespaceLabel}>
                                <th scope="row">{row.namespaceLabel}</th>
                                <td>
                                  {row.costSummary
                                    ? formatMetricValue(row.costSummary.diff, 2)
                                    : '無資料'}
                                </td>
                                <td>
                                  {row.costSummary ? (
                                    <div className="usage-cell">
                                      <span className="usage-cell-value">
                                        {formatMetricValue(row.costSummary.maxValue, 2)}
                                      </span>
                                      <span className="usage-cell-time">
                                        {formatTimestamp(row.costSummary.maxTimestamp)}
                                      </span>
                                    </div>
                                  ) : (
                                    '無資料'
                                  )}
                                </td>
                                <td>
                                  {row.costSummary ? (
                                    <div className="usage-cell">
                                      <span className="usage-cell-value">
                                        {formatMetricValue(row.costSummary.minValue, 2)}
                                      </span>
                                      <span className="usage-cell-time">
                                        {formatTimestamp(row.costSummary.minTimestamp)}
                                      </span>
                                    </div>
                                  ) : (
                                    '無資料'
                                  )}
                                </td>
                                <td>
                                  {row.timeSummaryText
                                    || (row.timeSummary
                                      ? `${formatMetricValue(row.timeSummary.diff, 2)}${row.timeUnit ? ` ${row.timeUnit}` : ''}`
                                      : '無資料')}
                                </td>
                                <td>
                                  {row.timeMaxText ? (
                                    <div className="usage-cell">
                                      <span className="usage-cell-value">
                                        {row.timeMaxText}
                                      </span>
                                    </div>
                                  ) : row.timeSummary ? (
                                    <div className="usage-cell">
                                      <span className="usage-cell-value">
                                        {formatMetricValue(row.timeSummary.maxValue, 2)}
                                        {row.usageUnit ? ` ${row.usageUnit}` : ''}
                                      </span>
                                      <span className="usage-cell-time">
                                        {formatTimestamp(row.timeSummary.maxTimestamp)}
                                      </span>
                                    </div>
                                  ) : (
                                    '無資料'
                                  )}
                                </td>
                                <td>
                                  {row.timeMinText ? (
                                    <div className="usage-cell">
                                      <span className="usage-cell-value">
                                        {row.timeMinText}
                                      </span>
                                    </div>
                                  ) : row.timeSummary ? (
                                    <div className="usage-cell">
                                      <span className="usage-cell-value">
                                        {formatMetricValue(row.timeSummary.minValue, 2)}
                                        {row.usageUnit ? ` ${row.usageUnit}` : ''}
                                      </span>
                                      <span className="usage-cell-time">
                                        {formatTimestamp(row.timeSummary.minTimestamp)}
                                      </span>
                                    </div>
                                  ) : (
                                    '無資料'
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )
                    ) : (
                      <div className="usage-empty">{rangeOutput || '請查詢…'}</div>
                    )
                  ) : null}
                </div>
              </div>
            )}
          </Card.Body>
        </Card>

        {/* <Row xs={1} md={3} className="g-3 mt-4">
            <Col>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title>新增使用者</Card.Title>
                  <Card.Text>
                    Add new users to the AI center by clicking the button below.
                  </Card.Text>
                  <Link to="/add" className="btn btn-primary">
                    新增
                  </Link>
                </Card.Body>
              </Card>
            </Col>
            <Col>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title>查詢資料</Card.Title>
                  <Card.Text>
                    Search for user or lab information in the platform.
                  </Card.Text>
                  <Link to="/search" className="btn btn-primary">
                    搜尋
                  </Link>
                </Card.Body>
              </Card>
            </Col>
            <Col>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title>管理Lab</Card.Title>
                  <Card.Text>
                    Manage lab resources and configurations for users.
                  </Card.Text>
                  <Link to="/lab" className="btn btn-primary">
                    管理
                  </Link>
                </Card.Body>
              </Card>
            </Col>
          </Row> */}
      </div>
    </div>
  );
}

export default Home;
