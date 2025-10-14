import React, {useState, useEffect, useContext} from "react";
import AuthContext from "../context/AuthContext";
import { PieChart } from 'react-minimal-pie-chart';
import { Card } from 'react-bootstrap';
import './Home.css'
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { KUBEFLOW_HTTP } from './Urls';
import CountUp from 'react-countup';


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
    const nsValue = nsFixed.trim() || '.*';
    const timeValue = timeFixed.trim() || 'now';
    setFixedError('');
    setFixedLoading(true);
    try {
      const response = await fetch(`/api/namespace_cost?namespace=${encodeURIComponent(nsValue)}&metric=${metricFixed}&time=${encodeURIComponent(timeValue)}`);
      const data = await response.json();
      if (data.error) {
        setFixedError(data.error);
        setFixedOutput('');
        return;
      }
      if (!data.length) {
        setFixedOutput('No data');
        return;
      }
      const msg = data.map((item) => `${item.namespace} ${item.value} (at ${item.time})`).join('\n');
      setFixedOutput(msg);
    } catch (error) {
      setFixedError(error.message || '查詢失敗');
      setFixedOutput('');
    } finally {
      setFixedLoading(false);
    }
  };

  const handleRangeQuery = async () => {
    const nsValue = rangeNs.trim() || '.*';
    setRangeError('');
    setRangeLoading(true);
    try {
      const params = new URLSearchParams({
        namespace: nsValue,
        metric: rangeMetric,
        start: rangeStart,
        end: rangeEnd,
      });
      const response = await fetch(`/api/namespace_cost_range?${params.toString()}`);
      const data = await response.json();
      if (data.error) {
        setRangeError(data.error);
        setRangeOutput('');
        return;
      }
      let text = `區間: ${data.start} → ${data.end}\n`;
      if (!data.data.length) {
        text += 'No data';
      } else {
        text += data.data.map((item) => `${item.namespace} ${item.value} (at ${item.time})`).join('\n');
      }
      setRangeOutput(text);
    } catch (error) {
      setRangeError(error.message || '查詢失敗');
      setRangeOutput('');
    } finally {
      setRangeLoading(false);
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
            ease: [0, 0.71, 0.2, 1.01]
          }}
        >
        <div className="pie">
          <div className="piediv">
            <h2 style={{marginTop: '5%', fontFamily: 'Bahnschrift light'}}>??# of users: <CountUp end={user_num} duration={5}/></h2>
            <PieChart className="PieStyle"
              data={PieData2}
              labelStyle={{
                textAlign: "center"
              }}

            />
          </div>
          <div className="piediv">
            <h2 style={{marginTop: '5%', fontFamily: 'Bahnschrift light'}}># of labs: <CountUp end={lab_num} duration={5}/></h2>
            <PieChart className="PieStyle" textAnchor="middle" dominantBaseline="middle"
              data={PieData}
              label={({ dataEntry }) => dataEntry.value}
              labelStyle={(index) => ({
                fill: '#fff',
                fontSize: '15px',
                fontFamily: 'comic sans ms'
              })}
            />
          </div>
        </div>
        </motion.div>

        <br/><br/>
	        <Card className="text-center">
	          <Card.Header>Kubeflow</Card.Header>
	          <Card.Body>
	            <Card.Title>CGU AI Center Kubeflow System</Card.Title>
	            <Card.Text>
	            With Kubeflow you can build, deploy, and manage your machine learning workflows on Kubernetes.
	            </Card.Text>
	            <Link to={KUBEFLOW_HTTP} className="btn btn-primary">Kubernetes Dashboard</Link>
	          </Card.Body>
	        </Card>
          <Card className="mt-4">
            <Card.Header>Usage 查詢（Namespace Cost）</Card.Header>
            <Card.Body className="text-start">
              <div className="row">
                <div className="col-md-6 mb-4">
                  <h5>固定時間查詢</h5>
                  <div className="mb-3">
                    <label className="form-label">Namespace</label>
                    <input className="form-control" value={nsFixed} onChange={(e) => setNsFixed(e.target.value)} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Metric</label>
                    <select className="form-select" value={metricFixed} onChange={(e) => setMetricFixed(e.target.value)}>
                      <option value="namespace_cpu_cost">CPU</option>
                      <option value="namespace_gpu_cost">GPU</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Time</label>
                    <input className="form-control" value={timeFixed} onChange={(e) => setTimeFixed(e.target.value)} placeholder="YYYY-MM-DD HH:MM:SS 或 now" />
                  </div>
                  <button className="btn btn-primary" onClick={handleFixedQuery} disabled={fixedLoading}>
                    {fixedLoading ? '查詢中…' : '查詢'}
                  </button>
                  <pre className="mt-3 p-3 bg-light border" style={{ minHeight: '120px' }}>
                    {fixedError ? `ERROR: ${fixedError}` : fixedOutput}
                  </pre>
                </div>
                <div className="col-md-6 mb-4">
                  <h5>區間查詢 (max-min)</h5>
                  <div className="mb-3">
                    <label className="form-label">Namespace</label>
                    <input className="form-control" value={rangeNs} onChange={(e) => setRangeNs(e.target.value)} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Metric</label>
                    <select className="form-select" value={rangeMetric} onChange={(e) => setRangeMetric(e.target.value)}>
                      <option value="namespace_cpu_cost">CPU</option>
                      <option value="namespace_gpu_cost">GPU</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Start</label>
                    <input className="form-control" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} placeholder="YYYY-MM-DD HH:MM:SS" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">End</label>
                    <input className="form-control" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} placeholder="YYYY-MM-DD HH:MM:SS" />
                  </div>
                  <div className="mb-3 d-flex gap-2">
                    <button className="btn btn-primary" onClick={handleRangeQuery} disabled={rangeLoading}>
                      {rangeLoading ? '查詢中…' : '查詢區間'}
                    </button>
                    <button className="btn btn-outline-secondary" type="button" onClick={handleSetLastMonth}>
                      上個月
                    </button>
                    <button className="btn btn-outline-secondary" type="button" onClick={handleSetThisMonth}>
                      本月至今
                    </button>
                  </div>
                  <pre className="mt-3 p-3 bg-light border" style={{ minHeight: '160px' }}>
                    {rangeError ? `ERROR: ${rangeError}` : rangeOutput}
                  </pre>
                </div>
              </div>
            </Card.Body>
          </Card>
	      </div>
	    </div>

	  );
	}
export default Home;
