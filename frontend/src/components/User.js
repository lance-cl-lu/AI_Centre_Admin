import React, { useState, useEffect, useRef } from 'react'
import { useLocation, Link } from 'react-router-dom'
import "./User.css";
import { Col, Form, ListGroup, Row, FloatingLabel } from 'react-bootstrap';
import { Button, Card, Box, Spinner } from '@chakra-ui/react';
import jwt_decode from "jwt-decode";
import ListNoteBook from './ListNoteBook';
import Swal from 'sweetalert2';
import { promQueryRange, buildNamespaceQuery, buildNamespacePattern } from '../api/prometheus';

// Fallback mock data when Prometheus data is unavailable.
const buildFallbackUsageData = () => {
    const formatPeriod = (date) => `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return [
        {
            period: formatPeriod(now),
            cpuHours: 1345,
            cpuCost: 1345,
            gpuHours: 2234,
            gpuCost: 2222,
            totalCost: 3567,
        },
        {
            period: formatPeriod(lastMonth),
            cpuHours: 1280,
            cpuCost: 1280,
            gpuHours: 2015,
            gpuCost: 2015,
            totalCost: 3295,
        },
        {
            period: formatPeriod(twoMonthsAgo),
            cpuHours: 1175,
            cpuCost: 1175,
            gpuHours: 1890,
            gpuCost: 1890,
            totalCost: 3065,
        },
    ];
};

const createMonthlyPeriods = (count = 3, now = new Date()) => {
    const periods = [];
    const base = new Date(now);
    for (let index = 0; index < count; index += 1) {
        const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - index, 1, 0, 0, 0));
        let end;
        if (index === 0) {
            end = new Date(base);
        } else {
            end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - index + 1, 1, 0, 0, 0));
        }
        const label = `${start.getUTCFullYear()}/${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
        periods.push({
            label,
            start,
            end,
        });
    }
    return periods;
};

const secondsFromDate = (date) => Math.floor(date.getTime() / 1000);

const extractSeriesValues = (rangeData) => {
    if (!rangeData || !Array.isArray(rangeData.result) || !rangeData.result.length) {
        return [];
    }
    const [series] = rangeData.result;
    if (!series || !Array.isArray(series.values)) {
        return [];
    }
    return series.values
        .map(([timestamp, value]) => [Number(timestamp), Number(value)])
        .filter(([, value]) => Number.isFinite(value));
};

const getValueAtOrBefore = (values, targetSeconds) => {
    let candidate = null;
    for (let index = 0; index < values.length; index += 1) {
        const [timestamp, value] = values[index];
        if (timestamp <= targetSeconds) {
            candidate = value;
        } else {
            break;
        }
    }
    if (candidate === null && values.length) {
        candidate = values[0][1];
    }
    return candidate;
};

const computeDiffWithinRange = (values, startDate, endDate) => {
    if (!values || !values.length) {
        return 0;
    }
    const startSeconds = secondsFromDate(startDate);
    const endSeconds = secondsFromDate(endDate);
    const startValue = getValueAtOrBefore(values, startSeconds);
    const endValue = getValueAtOrBefore(values, endSeconds);
    if (endValue === null) {
        return 0;
    }
    if (startValue !== null) {
        const diff = endValue - startValue;
        if (Number.isFinite(diff) && diff > 0) {
            return diff;
        }
    }
    return Number.isFinite(endValue) && endValue > 0 ? endValue : 0;
};

const minutesToHours = (minutes) => {
    if (!Number.isFinite(minutes)) {
        return 0;
    }
    return minutes / 60;
};

const usageRecordHasData = (record) => {
    return ['cpuHours', 'cpuCost', 'gpuHours', 'gpuCost', 'totalCost'].some((key) => {
        const value = record[key];
        return Number.isFinite(value) && value > 0;
    });
};

function User() {
    let state = useLocation().state;
    let [user, setUser] = useState(null);
    const [permissions, setPermissions] = useState({});
    let cpuQuota = 0;
    let memoryQuota = 0;
    let gpuQuota = 0;
    const [ userPermission ] = useState(() =>localStorage.getItem('authToken') ? jwt_decode(localStorage.getItem('authToken'))['permission'] : null)
    const [usageVisible, setUsageVisible] = useState(false);
    const [usageLoading, setUsageLoading] = useState(false);
    const [usageError, setUsageError] = useState('');
    const [usageRecords, setUsageRecords] = useState([]);
    const [selectedUsagePeriod, setSelectedUsagePeriod] = useState('');
    const usageFetchAbort = useRef(null);
    const usageFallbackRef = useRef(buildFallbackUsageData());
    const [usageNotice, setUsageNotice] = useState('');
    useEffect(() => {
        if (usageFetchAbort.current) {
            usageFetchAbort.current.abort();
            usageFetchAbort.current = null;
        }
        setUsageVisible(false);
        setUsageLoading(false);
        setUsageError('');
        setUsageRecords([]);
        setSelectedUsagePeriod('');
        setUsageNotice('');
    }, [state?.user]);
    useEffect(() => {
        return () => {
            if (usageFetchAbort.current) {
                usageFetchAbort.current.abort();
                usageFetchAbort.current = null;
            }
        }
    }, []);
    useEffect(() => {
        getuserinfo();
    }, [state]);
    console.log(state)
    
    function convertCpuQuota(cpuQuota) {
        // Check if it's a string ending with 'm' (millicores)
        if (typeof cpuQuota === 'string' && cpuQuota.endsWith('m')) {
            // Remove the 'm' and parse the number
            cpuQuota = parseInt(cpuQuota.replace('m', ''), 10);
        }

        // If it's a number and not an integer, convert to an integer
        if (cpuQuota >= 1100) {
            cpuQuota = Math.round(cpuQuota / 1100);
        }

        return cpuQuota;
    }
    function convertMemQuota(memQuota) {
        if (typeof cpuQuota === 'string') {
            // Remove "Gi" and parse the number
            memQuota = parseInt(memQuota.replace('Gi', ''), 10);
        }

        // If it's a number and not an integer, convert to an integer
        if (memQuota >= 1100) {
            memQuota = Math.round(memQuota / 1100);
        }

        return memQuota;
    }



    let getuserinfo = async () => {
        document.getElementsByClassName('userPage')[0].style.opacity = 0;

        fetch('/api/ldap/user/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                "username":state.user,
            }),
        })
        .then(response => response.json())
        .then(data => {
            console.log('Success:', data);
            setTimeout(() => {
                setUser(data);
                cpuQuota = convertCpuQuota(data.cpu_quota);
                memoryQuota = convertMemQuota(data.mem_quota);
                gpuQuota = data.gpu_quota;

                document.getElementById("cpuQuota").value = cpuQuota;
                document.getElementById("memQuota").value = memoryQuota;
                document.getElementById("gpuQuota").value = gpuQuota;
                setPermissions(data.permission);
                document.getElementById("editandsave").className = "btn btn-primary";
                document.getElementById("editandsave").innerHTML = "Edit";
            }, 400);
            setTimeout(() => {
                document.getElementsByClassName('userPage')[0].style.opacity = 1;
            }, 300);
        })
        .catch((error) => {
            console.error('Error:', error);
        }
        );

        setTimeout(() => {
            userPermission && userPermission === "root" ? document.getElementById("showNotebooks").style.display = "block" : document.getElementById("showNotebooks").style.display = "none";
        }, 400);
    }

    const deleteUser = async () => {
        if(!window.confirm("Are you sure you want to delete this user?")) return;
        let response = await fetch('/api/ldap/user/delete/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                "username":state.user,
            }),
        })
        if(response.status===200){
            Swal.fire({
                title: 'User deleted successfully',
                icon: 'success',
                timer: 2000,
                timerProgressBar: true,
            }).then(() => {
                // back to the previous page
                window.history.back();
            }
        )} else {
            Swal.fire({
                title: 'Something wrong!!!',
                icon: 'error',
                timer: 2000,
                timerProgressBar: true,
            })
        }
    }

    const editreadonly = async () => {
        if(document.getElementById("editandsave").innerHTML === "Edit"){
            document.getElementById("inputFirstName").readOnly = false;
            document.getElementById("inputLastName").readOnly = false;
            document.getElementById("inputEmail").readOnly = false;
            document.getElementById("cpuQuota").readOnly = false;
            document.getElementById("memQuota").readOnly = false;
            document.getElementById("gpuQuota").disabled = false;
            document.getElementById("inputFirstName").style.backgroundColor = "#b4d9d7";
            document.getElementById("inputLastName").style.backgroundColor = "#b4d9d7";
            document.getElementById("inputEmail").style.backgroundColor = "#b4d9d7";
            document.getElementById("cpuQuota").style.backgroundColor = "#b4d9d7";
            document.getElementById("memQuota").style.backgroundColor = "#b4d9d7";
            document.getElementById("gpuQuota").style.backgroundColor = "#b4d9d7";

            if(userPermission && userPermission === "root"){
                let check = document.getElementsByClassName("form-check-input");
                for(let i=0; i<check.length; i++){
                    check[i].disabled = false;
                    check[i].style.backgroundColor = "#b4d9d7";
                }
            }
            document.getElementById("editandsave").innerHTML = "Save";
            document.getElementById("editandsave").className = "btn btn-success";
        }
        else if(document.getElementById("editandsave").innerHTML === "Save"){
            document.getElementById("inputFirstName").readOnly = true;
            document.getElementById("inputLastName").readOnly = true;
            document.getElementById("inputEmail").readOnly = true;
            document.getElementById("cpuQuota").readOnly = true;
            document.getElementById("memQuota").readOnly = true;
            document.getElementById("gpuQuota").disabled = true;
            document.getElementById("inputFirstName").style.backgroundColor = "#fff";
            document.getElementById("inputLastName").style.backgroundColor = "#fff";
            document.getElementById("inputEmail").style.backgroundColor = "#fff";
            document.getElementById("cpuQuota").style.backgroundColor = "#fff";
            document.getElementById("memQuota").style.backgroundColor = "#fff";
            document.getElementById("gpuQuota").style.backgroundColor = "#fff";
            if(userPermission && userPermission === "root"){
            let check = document.getElementsByClassName("form-check-input");
                for(let i=0; i<check.length; i++){
                    check[i].disabled = true;
                    check[i].style.backgroundColor = "#fff";
                }
            }

            document.getElementById("editandsave").innerHTML = "Edit";
            document.getElementById("editandsave").className = "btn btn-primary";
            // return the checked and unchecked group and group name
            let saveUser = () => {
                let check = document.getElementsByClassName("form-check-input");
                let group = [];
                for(let i=0; i<check.length; i++){
                    if(check[i].checked){
                        group.push({"groupname":check[i].id, "permission":"admin"});
                    } else {
                        group.push({"groupname":check[i].id, "permission":"user"});
                    }
                }
                return group;
            }
            console.log(saveUser());


            //saveUser();
            let response = await fetch('/api/user/change/', {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    "username": document.getElementById("inputUsername").value,
                    "firstname": document.getElementById("inputFirstName").value,
                    "lastname": document.getElementById("inputLastName").value,
                    "email": document.getElementById("inputEmail").value,
                    "cpu_quota": document.getElementById("cpuQuota").value,
                    "mem_quota": document.getElementById("memQuota").value,
                    "gpu_quota": document.getElementById("gpuQuota").value,
                    "permission": saveUser(),
                }),
            });
            if (response.status===200) {
                Swal.fire({
                    title: 'User updated successfully',
                    icon: 'success',
                    timer: 2000,
                    timerProgressBar: true,
                })
                setTimeout(() => {
                    window.history.back();
                }, 2000);
            } else {
                Swal.fire({
                    title: 'Something wrong!!!',
                    icon: 'error',
                    timer: 2000,
                    timerProgressBar: true,
                })
            }

        }
    }

    function handleShowNotebooks() {
        return () => {
            document.getElementById("listNotebook").style.display === "block" ? document.getElementById("listNotebook").style.display = "none" : document.getElementById("listNotebook").style.display = "block";
        }
    }
    const applyUsageRecords = (records) => {
        setUsageRecords(records);
        setSelectedUsagePeriod(records && records.length ? records[0].period : '');
    };
    const toNumber = (value) => {
        if (value === null || value === undefined) {
            return 0;
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string') {
            const cleaned = value.replace(/[^0-9.-]+/g, '');
            const parsed = Number(cleaned);
            return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
    };
    const loadUsage = async () => {
        if (!state?.user) {
            setUsageError('No user is selected.');
            setUsageNotice('');
            applyUsageRecords([]);
            return;
        }
        if (usageFetchAbort.current) {
            usageFetchAbort.current.abort();
        }
        const controller = new AbortController();
        usageFetchAbort.current = controller;
        setUsageLoading(true);
        setUsageError('');
        setUsageNotice('');
        try {
            const namespace = state.user;
            const namespacePattern = buildNamespacePattern(namespace);
            const now = new Date();
            const periods = createMonthlyPeriods(3, now);
            const rangeStart = periods[periods.length - 1].start;
            const rangeEnd = new Date(periods[0].end);
            const queryOptions = {
                start: rangeStart,
                end: rangeEnd,
                step: '1d',
                signal: controller.signal,
            };
            const queryConfigs = [
                { key: 'cpuCost', metric: 'namespace_cpu_cost' },
                { key: 'cpuTime', metric: 'namespace_cpu_cost_time' },
                { key: 'gpuCost', metric: 'namespace_gpu_cost' },
                { key: 'gpuTime', metric: 'namespace_gpu_cost_time' },
            ];
            const queryResults = await Promise.allSettled(
                queryConfigs.map(({ metric }) =>
                    promQueryRange({
                        query: buildNamespaceQuery(metric, namespacePattern),
                        ...queryOptions,
                    })
                )
            );
            const ranges = {};
            const missingMetrics = [];
            queryResults.forEach((result, index) => {
                const { key, metric } = queryConfigs[index];
                if (result.status === 'fulfilled') {
                    ranges[key] = result.value;
                } else {
                    ranges[key] = null;
                    missingMetrics.push(metric);
                    console.warn(`Prometheus query failed for ${metric}`, result.reason);
                }
            });
            const successfulCount = queryResults.filter((result) => result.status === 'fulfilled').length;
            if (successfulCount === 0) {
                throw new Error('All Prometheus usage queries failed.');
            }
            const cpuCostValues = extractSeriesValues(ranges.cpuCost);
            const cpuTimeValues = extractSeriesValues(ranges.cpuTime);
            const gpuCostValues = extractSeriesValues(ranges.gpuCost);
            const gpuTimeValues = extractSeriesValues(ranges.gpuTime);
            const records = periods.map(({ label, start, end }) => {
                const cpuCostDelta = computeDiffWithinRange(cpuCostValues, start, end);
                const gpuCostDelta = computeDiffWithinRange(gpuCostValues, start, end);
                const cpuMinutes = computeDiffWithinRange(cpuTimeValues, start, end);
                const gpuMinutes = computeDiffWithinRange(gpuTimeValues, start, end);
                const cpuHours = minutesToHours(cpuMinutes);
                const gpuHours = minutesToHours(gpuMinutes);
                const totalCost = cpuCostDelta + gpuCostDelta;
                return {
                    period: label,
                    cpuHours,
                    cpuCost: cpuCostDelta,
                    gpuHours,
                    gpuCost: gpuCostDelta,
                    totalCost,
                };
            });
            applyUsageRecords(records);
            const hasData = records.some(usageRecordHasData);
            if (hasData) {
                if (missingMetrics.length) {
                    setUsageNotice(`資料來源：Prometheus；部分指標 (${missingMetrics.join(', ')}) 尚未回報，已以 0 顯示。`);
                } else {
                    setUsageNotice('資料來源：Prometheus namespace_cpu_cost / namespace_gpu_cost 指標。');
                }
            } else {
                setUsageNotice('Prometheus 尚未回報此使用者的使用紀錄，顯示為 0。');
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                return;
            }
            console.warn('Failed to load usage data from Prometheus, fallback to mock data.', error);
            setUsageError('');
            setUsageNotice('暫以示意資料呈現，後續將串接 K8s/Prometheus 資料。');
            const fallbackRecords = usageFallbackRef.current;
            if (fallbackRecords && fallbackRecords.length) {
                applyUsageRecords(fallbackRecords);
            } else {
                applyUsageRecords([]);
            }
        } finally {
            if (!controller.signal.aborted) {
                setUsageLoading(false);
            }
            if (usageFetchAbort.current === controller) {
                usageFetchAbort.current = null;
            }
        }
    };
    const handleUsageButtonClick = () => {
        const nextVisible = !usageVisible;
        setUsageVisible(nextVisible);
        if (nextVisible && usageRecords.length === 0 && !usageLoading) {
            loadUsage();
        }
    };
    const formatNumber = (value, maximumFractionDigits = 0) => {
        return toNumber(value).toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits,
        });
    };
    const selectedUsageRecord = usageRecords.find((record) => record.period === selectedUsagePeriod) || usageRecords[0];
    const permissionList = Array.isArray(permissions)
        ? permissions
        : Object.values(permissions || {});
    return (
        <div className='userPage'>
                <h1>User {state && state.user}</h1><br/>
                <Form className='form-css' style={{boxShadow: "0px 0px 10px 0px #888888", padding: "20px", borderRadius: "12px", display:"flex", flexWrap:"wrap"}}>
                    <Form.Group as={Col} style={{width:"50%"}}>
                        <Form.Group as={Row} className="mb-3" style={{flexWrap: 'nowrap'}}>
                            <Form.Label column sm="2">
                                Username
                            </Form.Label>
                            <Col sm="10" style={{width:"100%"}}>
                                <Form.Control plaintext readOnly id="inputUsername" style={{width:"50%"}} defaultValue={user && user.username} />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row} className="mb-3" style={{flexWrap: 'nowrap'}}>
                            <Form.Label column sm="2">
                                First Name
                            </Form.Label>
                            <Col sm="10" style={{width:"100%"}}>
                                <Form.Control plaintext readOnly id="inputFirstName" style={{width:"50%", border:"ridge 1px", borderRadius:"10px"}} defaultValue={user && user.first_name} />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row} className="mb-3" style={{flexWrap: 'nowrap'}}>
                            <Form.Label column sm="2">
                                Last Name
                            </Form.Label>
                            <Col sm="10" style={{width:"100%"}}>
                                <Form.Control plaintext readOnly id="inputLastName" style={{width:"50%", border:"ridge 1px", borderRadius:"10px"}} defaultValue={user && user.last_name} />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row} className="mb-3" style={{flexWrap: 'nowrap'}}>
                            <Form.Label column sm="2">
                                Email
                            </Form.Label>
                            <Col sm="10" style={{width:"100%"}}>
                                <Form.Control plaintext readOnly id="inputEmail" style={{width:"52%", border:"ridge 1px", borderRadius:"10px"}} defaultValue={user && user.email} />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row} className="mb-3" style={{flexWrap: 'nowrap'}}>
                            <Form.Label column sm="2">CPU Quota</Form.Label>
                            <FloatingLabel
                                controlId="floatingSelect"
                                label="CPU Quota"
                                className="mb-3"
                            >
                                <Form.Control type="number" id="cpuQuota" placeholder="Enter CPU Quota" min="0.5" max="8" defaultValue={cpuQuota} step="0.1" readOnly/>
                            </FloatingLabel>
                        </Form.Group>
                        <Form.Group as={Row} className="mb-3" style={{flexWrap: 'nowrap'}}>
                            <Form.Label column sm="2">Memory Quota</Form.Label>
                            <FloatingLabel
                                controlId="floatingInput"
                                label="Memory Quota (GiB)"
                                className="mb-3"
                            >
                                <Form.Control type="number" id="memQuota" placeholder="Enter Memory Quota" min="1" defaultValue={memoryQuota} step="0.1" readOnly/>
                            </FloatingLabel>
                        </Form.Group>
                        <Form.Group as={Row} className="mb-3" style={{flexWrap: 'nowrap'}}>
                            <Form.Label column sm="2">GPU Quota</Form.Label>
                            <FloatingLabel
                                controlId="floatingInput"
                                label="GPU Quota"
                                className="mb-3"
                            >
                                <Form.Select aria-label="Floating label select example" id="gpuQuota" defaultValue={gpuQuota} disabled>
                                    <option value="0">0</option>
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                    <option value="5">5</option>
                                    <option value="6">6</option>
                                    <option value="7">7</option>
                                    <option value="8">8</option>
                                </Form.Select>
                            </FloatingLabel>
                        </Form.Group>
                    </Form.Group>
                    <Form.Group as={Col} style={{width:"50%"}}>
                        <Form.Group as={Row} className="mb-3" style={{flexWrap: 'nowrap', alignItems:"start"}}>
                            <Form.Label column sm="2" style={{width:"20%"}}>
                                Current Group:
                            </Form.Label>
                            <Form.Group as={Col} style={{width:"80%"}}>
                                <ListGroup>
                                {permissionList && permissionList.length > 0 ? (
                                    permissionList.map((permission, index) => (
                                        <ListGroup.Item className='ListGroupItem' key={index} style={{border:"none", padding:"0px", display:"flex", flexWrap:"nowrap", alignItems:"center", justifyContent:"space-evenly"}}>
                                            <Form.Label column sm="2" style={{width:"90%"}}>
                                                {permission.groupname}
                                            </Form.Label>
                                            <Form.Check type="checkbox" defaultChecked={permission.permission === "admin"} disabled id={permission.groupname} style={{width:"10%"}}/>
                                        </ListGroup.Item>
                                    ))
                                ) : (
                                    <ListGroup.Item className='ListGroupItem' style={{border:"none", padding:"0px", display:"flex", justifyContent:"center", alignItems:"center", margin:"1px auto", width:"80%", borderRadius:"10px"}}>
                                        No Permission
                                    </ListGroup.Item>
                                )}
                                </ListGroup>
                            </Form.Group>
                        </Form.Group>
                    </Form.Group>
                </Form>
                <Box style={{display:"flex", alignItems:"center", marginTop:"16px", justifyContent:"center"}}>
                    <Button variant="blue" onClick={editreadonly} id='editandsave' className='buttom-button'>Edit</Button>
                    <Button colorScheme='red' onClick={deleteUser} className='buttom-button'>Delete</Button>
                    <Button colorScheme='blackAlpha' className='buttom-button'>{user? <Link to='/password' state={state} style={{textDecoration:"none", color:"#fff"}}>Change Password</Link>: null}</Button>
                    <Button colorScheme='yellow' className='buttom-button' onClick={handleShowNotebooks()} style={{display:"none"}} id="showNotebooks">Notebook</Button>
                    <Button colorScheme='cyan' className='buttom-button' onClick={handleUsageButtonClick}>Usage</Button>
                    <Button colorScheme='orange' className='buttom-button' onClick={() => window.history.back()}> Cancel and Back</Button>
                </Box>
                <Card className="card-css" id="listNotebook" style={{display:"none"}}>
                    <ListNoteBook user={state.user}/>
                </Card>
                {usageVisible && (
                    <Card className="card-css usage-card">
                        <div className="usage-card-header">
                            <Form.Select
                                className="usage-select"
                                value={selectedUsagePeriod || ''}
                                onChange={(event) => setSelectedUsagePeriod(event.target.value)}
                                disabled={usageRecords.length === 0 || usageLoading}
                            >
                                {usageRecords.length === 0 ? (
                                    <option value="">No usage data</option>
                                ) : (
                                    usageRecords.map((record) => (
                                        <option key={record.period} value={record.period}>
                                            {record.period}
                                        </option>
                                    ))
                                )}
                            </Form.Select>
                        </div>
                        <div className="usage-card-body">
                            {usageLoading ? (
                                <div className="usage-loading">
                                    <Spinner size='sm' style={{ marginRight: '8px' }} />
                                    Loading usage…
                                </div>
                            ) : usageError ? (
                                <div className="usage-error">{usageError}</div>
                            ) : usageRecords.length === 0 ? (
                                <div className="usage-empty">No usage data available.</div>
                            ) : (
                                <>
                                    {usageNotice && (
                                        <div className="usage-notice">{usageNotice}</div>
                                    )}
                                    <div className="usage-metrics">
                                        <div className="usage-metric-row">
                                            <span className="usage-metric-label">CPU:</span>
                                            <span className="usage-metric-value">{formatNumber(selectedUsageRecord?.cpuHours, 2)} hours</span>
                                            <span className="usage-metric-value">{formatNumber(selectedUsageRecord?.cpuCost)} NTD</span>
                                        </div>
                                        <div className="usage-metric-row">
                                            <span className="usage-metric-label">GPU:</span>
                                            <span className="usage-metric-value">{formatNumber(selectedUsageRecord?.gpuHours, 2)} hours</span>
                                            <span className="usage-metric-value">{formatNumber(selectedUsageRecord?.gpuCost)} NTD</span>
                                        </div>
                                        <div className="usage-metric-row usage-total">
                                            <span className="usage-metric-label">Total:</span>
                                            <span className="usage-metric-value usage-total-value">{formatNumber(selectedUsageRecord?.totalCost)} NTD</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </Card>
                )}
        </div>

    )
}
export default User
