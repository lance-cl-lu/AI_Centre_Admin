import React, {useState, useEffect, useContext, useRef, useMemo} from "react";
import AuthContext from "../context/AuthContext";
import { PieChart } from 'react-minimal-pie-chart';
import { Card, Row, Col } from 'react-bootstrap';
import './Home.css'
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { KUBEFLOW_HTTP } from './Urls';
import CountUp from 'react-countup';
import { promQuery, promQueryRange, buildNamespaceQuery, buildNamespacePattern } from '../api/prometheus';


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
  time,
  signal,
}) => {
  const query = buildNamespaceQuery(metric, namespacePattern);
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
      query: buildNamespaceQuery('namespace_cpu_cost', namespacePattern),
      time,
      signal,
    }).catch(() => null),
    promQuery({
      query: buildNamespaceQuery('namespace_gpu_cost', namespacePattern),
      time,
      signal,
    }).catch(() => null),
  ]);
  return combineInstantNamespaceResults(cpuData, gpuData);
};

const fetchFixedNamespaceTimeMetric = async ({
  metric,
  namespacePattern,
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
        query: buildNamespaceQuery(metricName, namespacePattern),
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
  start,
  end,
  step,
  signal,
}) => {
  const query = buildNamespaceQuery(metric, namespacePattern);
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
      query: buildNamespaceQuery('namespace_cpu_cost', namespacePattern),
      start,
      end,
      step,
      signal,
    }).catch(() => null),
    promQueryRange({
      query: buildNamespaceQuery('namespace_gpu_cost', namespacePattern),
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
  start,
  end,
  step,
  signal,
}) => {
  const metricNames = TIME_METRIC_MAP[metric];
  if (!Array.isArray(metricNames) || !metricNames.length) {
    return null;
  }
  const datasets = await Promise.all(
    metricNames.map((metricName) =>
      promQueryRange({
        query: buildNamespaceQuery(metricName, namespacePattern),
        start,
        end,
        step,
        signal,
      }).catch(() => null),
    ),
  );
  return combineRangeNamespaceResults(...datasets);
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
  const [rangeMetric, setRangeMetric] = useState('namespace_cpu_cost');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeOutput, setRangeOutput] = useState('請查詢…');
  const [rangeError, setRangeError] = useState('');
  const [rangeLoading, setRangeLoading] = useState(false);
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


  const pad = (n) => n.toString().padStart(2, '0');
  const fmt = (date) => {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T`
      + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const handleFixedQuery = async () => {
    const namespaceInput = nsFixed.trim() || '.*';
    setFixedError('');
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
      const [costData, timeData] = await Promise.all([
        fetchFixedNamespaceMetric({
          metric: metricFixed,
          namespacePattern,
          time: timeValue || undefined,
          signal: controller.signal,
        }),
        fetchFixedNamespaceTimeMetric({
          metric: metricFixed,
          namespacePattern,
          time: timeValue || undefined,
          signal: controller.signal,
        }),
      ]);
      const summaries = buildInstantNamespaceSummary(costData, timeData);
      if (!summaries.length) {
        setFixedOutput('No data');
        return;
      }
      const lines = summaries.map((entry) => {
        const costText =
          entry.cost !== null ? formatMetricValue(entry.cost, 2) : '無費用資料';
        const timeTextValue =
          entry.time !== null ? formatMetricValue(entry.time, 2) : '無時間資料';
        const timestampText =
          entry.timestamp !== null ? formatTimestamp(entry.timestamp) : '未知時間';
        return `${entry.namespaceLabel} 費用 ${costText} / 時間 ${timeTextValue} (at ${timestampText})`;
      });
      setFixedOutput(lines.join('\n'));
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }
      setFixedError(error.message || '查詢失敗');
      setFixedOutput('');
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
      const [costData, timeData] = await Promise.all([
        fetchRangeNamespaceMetric({
          metric: rangeMetric,
          namespacePattern,
          start: startDate,
          end: endDate,
          step: '6h',
          signal: controller.signal,
        }),
        fetchRangeNamespaceTimeMetric({
          metric: rangeMetric,
          namespacePattern,
          start: startDate,
          end: endDate,
          step: '6h',
          signal: controller.signal,
        }),
      ]);
      const header = `區間: ${startDate.toLocaleString()} → ${endDate.toLocaleString()}`;
      const summaries = buildRangeNamespaceSummary(costData, timeData);
      if (!summaries.length) {
        setRangeOutput(`${header}\nNo data`);
        return;
      }
      const lines = summaries.map((entry) => {
        const costSummary = summariseSeriesDiff(entry.costValues);
        const costSection =
          entry.costValues && entry.costValues.length
            ? `費用 ${formatMetricValue(costSummary.diff, 2)} (max ${formatMetricValue(costSummary.maxValue, 2)} at ${formatTimestamp(costSummary.maxTimestamp)}, min ${formatMetricValue(costSummary.minValue, 2)} at ${formatTimestamp(costSummary.minTimestamp)})`
            : '費用資料缺失';
        const timeSection =
          entry.timeValues && entry.timeValues.length
            ? (() => {
                const timeSummary = summariseSeriesDiff(entry.timeValues);
                return `時間 ${formatMetricValue(timeSummary.diff, 2)} (max ${formatMetricValue(timeSummary.maxValue, 2)} at ${formatTimestamp(timeSummary.maxTimestamp)}, min ${formatMetricValue(timeSummary.minValue, 2)} at ${formatTimestamp(timeSummary.minTimestamp)})`;
              })()
            : '時間資料缺失';
        return `${entry.namespaceLabel} ${costSection} / ${timeSection}`;
      });
      setRangeOutput([header, ...lines].join('\n'));
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }
      setRangeError(error.message || '查詢失敗');
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

        <Card className="text-center mt-4">
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
        </Row>

        <Card className="mt-4">
          <Card.Header>Usage 查詢（Namespace Cost）</Card.Header>
          <Card.Body className="text-start">
            <div className="row">
              <div className="col-md-6 mb-4">
                <h5>固定時間查詢</h5>
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
                <button
                  className="btn btn-primary"
                  onClick={handleFixedQuery}
                  disabled={fixedLoading}
                >
                  {fixedLoading ? '查詢中…' : '查詢'}
                </button>
                <pre
                  className="mt-3 p-3 bg-light border"
                  style={{ minHeight: '120px' }}
                >
                  {fixedError ? `ERROR: ${fixedError}` : fixedOutput}
                </pre>
              </div>
              <div className="col-md-6 mb-4">
                <h5>區間查詢 (max-min)</h5>
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
                    onClick={handleRangeQuery}
                    disabled={rangeLoading}
                  >
                    {rangeLoading ? '查詢中…' : '查詢區間'}
                  </button>
                </div>
                <pre
                  className="mt-3 p-3 bg-light border"
                  style={{ minHeight: '160px' }}
                >
                  {rangeError ? `ERROR: ${rangeError}` : rangeOutput}
                </pre>
              </div>
            </div>
          </Card.Body>
        </Card>

        <Row xs={1} md={3} className="g-3 mt-4">
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
        </Row>
      </div>
    </div>
  );
}

export default Home;
