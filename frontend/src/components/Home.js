import React, {useState, useEffect, useContext, useRef} from "react";
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


function Home() {
  let {user} = useContext(AuthContext);
  let [user_num, setUser_num] = useState(0);
  let [lab_num, setLab_num] = useState(0);
  const [PieData, setPieData] = useState([]);
  const [PieData2, setPieData2] = useState([]);
  const [nsFixed, setNsFixed] = useState('teacher0001');
  const [metricFixed, setMetricFixed] = useState('namespace_cpu_cost');
  const [timeFixed, setTimeFixed] = useState('now');
  const [fixedOutput, setFixedOutput] = useState('請查詢…');
  const [fixedError, setFixedError] = useState('');
  const [fixedLoading, setFixedLoading] = useState(false);
  const [rangeNs, setRangeNs] = useState('teacher0001');
  const [rangeMetric, setRangeMetric] = useState('namespace_cpu_cost');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeOutput, setRangeOutput] = useState('請查詢…');
  const [rangeError, setRangeError] = useState('');
  const [rangeLoading, setRangeLoading] = useState(false);
  const fixedQueryAbort = useRef(null);
  const rangeQueryAbort = useRef(null);
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
      setPieData(data.lab_list.map((lab, index) => {
        return { title: lab, value: 1, color: getRandomBlueShade() }
      }))
      setPieData2(data.user_list.map((user, index) => {
        return { title: user, value: 1, color: getRandomOrangeShade() }
      }))
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


  const [ unsych_list, setUnsych_list ] = useState([]);
  useEffect(() => {
    fetch('/api/check/syschronize/', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .then(response => response.json())
    .then(data => {
      setUnsych_list(data);
    })
    .catch((error) => {
      console.error('Error: User Exist');
    }
    );
  }, []);


  const pad = (n) => n.toString().padStart(2, '0');
  const fmt = (date) => {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
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
      const namespacePattern = buildNamespacePattern(namespaceInput);
      const query = buildNamespaceQuery(metricFixed, namespacePattern);
      const timeValue = parseDateTimeInput(timeFixed);
      if (timeFixed && timeValue === null) {
        throw new Error('時間格式錯誤，請使用 YYYY-MM-DD HH:MM:SS 或 now');
      }
      const data = await promQuery({
        query,
        time: timeValue || undefined,
        signal: controller.signal,
      });
      if (!data || !Array.isArray(data.result) || !data.result.length) {
        setFixedOutput('No data');
        return;
      }
      const lines = data.result.map((item) => {
        const metricInfo = item.metric || {};
        const namespaceLabel = metricInfo.exported_namespace || metricInfo.namespace || '(unknown)';
        const [timestamp, rawValue] = item.value || [];
        const numericValue = Number(rawValue);
        const valueText = Number.isFinite(numericValue)
          ? formatMetricValue(numericValue, 2)
          : rawValue;
        const timeText = timestamp !== undefined
          ? formatTimestamp(Number(timestamp))
          : '未知時間';
        return `${namespaceLabel} ${valueText} (at ${timeText})`;
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
      const query = buildNamespaceQuery(rangeMetric, namespacePattern);
      const data = await promQueryRange({
        query,
        start: startDate,
        end: endDate,
        step: '6h',
        signal: controller.signal,
      });
      const header = `區間: ${startDate.toLocaleString()} → ${endDate.toLocaleString()}`;
      if (!data || !Array.isArray(data.result) || !data.result.length) {
        setRangeOutput(`${header}\nNo data`);
        return;
      }
      const lines = data.result.map((series) => {
        const namespaceLabel = series.metric?.exported_namespace || series.metric?.namespace || '(unknown)';
        const values = normaliseRangeValues(series);
        const summary = summariseSeriesDiff(values);
        const diffText = formatMetricValue(summary.diff, 2);
        const maxText = `max ${formatMetricValue(summary.maxValue, 2)} at ${formatTimestamp(summary.maxTimestamp)}`;
        const minText = `min ${formatMetricValue(summary.minValue, 2)} at ${formatTimestamp(summary.minTimestamp)}`;
        return `${namespaceLabel} ${diffText} (${maxText}, ${minText})`;
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
                  {unsych_list.map((msg, index) => (
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
                  <label className="form-label">Namespace</label>
                  <input
                    className="form-control"
                    value={nsFixed}
                    onChange={(event) => setNsFixed(event.target.value)}
                    placeholder="teacher0001 或留空表示全部"
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
                  <label className="form-label">Namespace</label>
                  <input
                    className="form-control"
                    value={rangeNs}
                    onChange={(event) => setRangeNs(event.target.value)}
                    placeholder="teacher0001 或留空表示全部"
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
                    value={rangeStart}
                    onChange={(event) => setRangeStart(event.target.value)}
                    placeholder="YYYY-MM-DD HH:MM:SS"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">End</label>
                  <input
                    className="form-control"
                    value={rangeEnd}
                    onChange={(event) => setRangeEnd(event.target.value)}
                    placeholder="YYYY-MM-DD HH:MM:SS"
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
