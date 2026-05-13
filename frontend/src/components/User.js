import React, { useState, useEffect, useRef } from 'react'
import { useLocation, Link } from 'react-router-dom'
import "./User.css";
import { Col, Form, ListGroup, Row, FloatingLabel } from 'react-bootstrap';
import { Button, Card, Box, Spinner } from '@chakra-ui/react';
import jwt_decode from "jwt-decode";
import ListNoteBook from './ListNoteBook';
import Swal from 'sweetalert2';
import {
    promQueryRange,
    buildUserNamespaceQuery,
    buildNamespacePattern,
} from '../api/prometheus';

const createMonthlyPeriods = (count = 3, now = new Date()) => {
    const periods = [];
    const base = new Date(now);
    for (let index = 0; index < count; index += 1) {
        const start = new Date(base.getFullYear(), base.getMonth() - index, 1, 0, 0, 0);
        let end;
        if (index === 0) {
            end = new Date(base);
        } else {
            end = new Date(base.getFullYear(), base.getMonth() - index + 1, 1, 0, 0, 0);
        }
        const label = `${start.getFullYear()}/${String(start.getMonth() + 1).padStart(2, '0')}`;
        periods.push({
            label,
            start,
            end,
        });
    }
    return periods;
};

const secondsFromDate = (date) => Math.floor(date.getTime() / 1000);
const USAGE_QUERY_STEP_MINUTES = 1;
const USAGE_QUERY_STEP = `${USAGE_QUERY_STEP_MINUTES}m`;
const USAGE_QUERY_CHUNK_MAX_POINTS = 10000;

const parsePrometheusDurationToSeconds = (value) => {
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
    const maxChunkSpanMs = stepMs * (USAGE_QUERY_CHUNK_MAX_POINTS - 1);
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

const extractSeriesValues = (rangeData) => {
    if (!rangeData || !Array.isArray(rangeData.result) || !rangeData.result.length) {
        return [];
    }
    const valuesByTimestamp = new Map();
    rangeData.result.forEach((series) => {
        if (!series || !Array.isArray(series.values)) {
            return;
        }
        series.values.forEach(([timestamp, value]) => {
            const numericTimestamp = Number(timestamp);
            const numericValue = Number(value);
            if (!Number.isFinite(numericTimestamp) || !Number.isFinite(numericValue)) {
                return;
            }
            valuesByTimestamp.set(
                numericTimestamp,
                (valuesByTimestamp.get(numericTimestamp) || 0) + numericValue
            );
        });
    });
    return Array.from(valuesByTimestamp.entries()).sort((left, right) => left[0] - right[0]);
};

const getEarliestSeriesTimestamp = (rangeData) => {
    if (!rangeData || !Array.isArray(rangeData.result)) {
        return null;
    }
    let earliest = null;
    rangeData.result.forEach((series) => {
        if (!series || !Array.isArray(series.values) || !series.values.length) {
            return;
        }
        const [rawTimestamp] = series.values[0];
        const timestamp = Number(rawTimestamp);
        if (!Number.isFinite(timestamp)) {
            return;
        }
        if (earliest === null || timestamp < earliest) {
            earliest = timestamp;
        }
    });
    return earliest;
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

    const normalised = [];
    sortedValues.forEach(([timestamp, value], index) => {
        normalised.push([timestamp, value]);
        const nextTimestamp = sortedValues[index + 1]?.[0] ?? endSeconds;
        const staleTimestamp = timestamp + stepSeconds;
        if (staleTimestamp < Math.min(nextTimestamp, endSeconds)) {
            normalised.push([staleTimestamp, 0]);
        }
    });
    return normalised.sort((left, right) => left[0] - right[0]);
};

const summariseBillableUsage = ({
    cpuUsageValues,
    gpuUsageValues,
    cpuCostRateValues,
    gpuCostRateValues,
    startDate,
    endDate,
    cpuCostPerMinute,
    gpuCostPerMinute,
}) => {
    const startSeconds = secondsFromDate(startDate);
    const endSeconds = secondsFromDate(endDate);
    const stepSeconds = parsePrometheusDurationToSeconds(USAGE_QUERY_STEP);
    const cpuSeries = normaliseSteppedRangeValues(
        cpuUsageValues,
        startSeconds,
        endSeconds,
        stepSeconds,
    );
    const gpuSeries = normaliseSteppedRangeValues(
        gpuUsageValues,
        startSeconds,
        endSeconds,
        stepSeconds,
    );
    const cpuCostRateSeries = normaliseSteppedRangeValues(
        cpuCostRateValues,
        startSeconds,
        endSeconds,
        stepSeconds,
    );
    const gpuCostRateSeries = normaliseSteppedRangeValues(
        gpuCostRateValues,
        startSeconds,
        endSeconds,
        stepSeconds,
    );
    const cpuByTimestamp = new Map(cpuSeries);
    const gpuByTimestamp = new Map(gpuSeries);
    const cpuCostRateByTimestamp = new Map(cpuCostRateSeries);
    const gpuCostRateByTimestamp = new Map(gpuCostRateSeries);
    const timeline = Array.from(new Set([
        ...cpuByTimestamp.keys(),
        ...gpuByTimestamp.keys(),
        ...cpuCostRateByTimestamp.keys(),
        ...gpuCostRateByTimestamp.keys(),
    ])).sort((left, right) => left - right);

    let currentCpu = 0;
    let currentGpu = 0;
    let currentCpuCostRate = 0;
    let currentGpuCostRate = 0;
    let previousTimestamp = startSeconds;
    const totals = {
        cpuActiveMinutes: 0,
        gpuActiveMinutes: 0,
        cpuCost: 0,
        gpuCost: 0,
    };

    const addInterval = (nextTimestamp) => {
        const boundedTimestamp = Math.min(nextTimestamp, endSeconds);
        const durationMinutes = Math.max(0, boundedTimestamp - previousTimestamp) / 60;
        if (!durationMinutes) {
            return;
        }
        if (currentCpuCostRate > 0) {
            totals.cpuActiveMinutes += durationMinutes;
            totals.cpuCost += currentCpu * durationMinutes * cpuCostPerMinute;
        }
        if (currentGpuCostRate > 0) {
            totals.gpuActiveMinutes += durationMinutes;
            totals.gpuCost += currentGpu * durationMinutes * gpuCostPerMinute;
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

    return {
        cpuHours: totals.cpuActiveMinutes / 60,
        gpuHours: totals.gpuActiveMinutes / 60,
        cpuCost: totals.cpuCost,
        gpuCost: totals.gpuCost,
        totalCost: totals.cpuCost + totals.gpuCost,
    };
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
            const costConfigResponse = await fetch('/api/node-resource-monitor/config/', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: controller.signal,
            });
            if (!costConfigResponse.ok) {
                throw new Error('Failed to load Node Resource Monitor cost config.');
            }
            const costConfig = await costConfigResponse.json();
            const cpuCostPerMinute = toNumber(costConfig?.cpuCostPerMinute);
            const gpuCostPerMinute = toNumber(costConfig?.gpuCostPerMinute);
            const queryConfigs = [
                { key: 'cpuUsage', metric: 'cgu_namespace_billable_cpu_cores' },
                { key: 'gpuUsage', metric: 'cgu:namespace_billable_gpu_cards_total' },
                { key: 'cpuCostRate', metric: 'cgu_namespace_billable_cpu_cost_per_minute' },
                { key: 'gpuCostRate', metric: 'cgu_namespace_billable_gpu_cost_per_minute' },
            ];
            const missingMetrics = new Set();
            let successfulCount = 0;
            let earliestAvailableTimestamp = null;
            const records = await Promise.all(periods.map(async ({ label, start, end }) => {
                const queryResults = await Promise.allSettled(
                    queryConfigs.map(({ metric }) =>
                        promQueryRangeChunked({
                            query: buildUserNamespaceQuery(metric, namespacePattern),
                            start,
                            end,
                            step: USAGE_QUERY_STEP,
                            signal: controller.signal,
                        })
                    )
                );
                const ranges = {};
                queryResults.forEach((result, index) => {
                    const { key, metric } = queryConfigs[index];
                    if (result.status === 'fulfilled') {
                        ranges[key] = result.value;
                        successfulCount += 1;
                        const metricEarliest = getEarliestSeriesTimestamp(result.value);
                        if (
                            Number.isFinite(metricEarliest)
                            && (
                                earliestAvailableTimestamp === null
                                || metricEarliest < earliestAvailableTimestamp
                            )
                        ) {
                            earliestAvailableTimestamp = metricEarliest;
                        }
                    } else {
                        ranges[key] = null;
                        missingMetrics.add(metric);
                        console.warn(`Prometheus query failed for ${metric}`, result.reason);
                    }
                });
                const cpuUsageValues = extractSeriesValues(ranges.cpuUsage);
                const gpuUsageValues = extractSeriesValues(ranges.gpuUsage);
                const cpuCostRateValues = extractSeriesValues(ranges.cpuCostRate);
                const gpuCostRateValues = extractSeriesValues(ranges.gpuCostRate);
                const usageSummary = summariseBillableUsage({
                    cpuUsageValues,
                    gpuUsageValues,
                    cpuCostRateValues,
                    gpuCostRateValues,
                    startDate: start,
                    endDate: end,
                    cpuCostPerMinute,
                    gpuCostPerMinute,
                });
                return {
                    period: label,
                    cpuHours: usageSummary.cpuHours,
                    cpuCost: usageSummary.cpuCost,
                    gpuHours: usageSummary.gpuHours,
                    gpuCost: usageSummary.gpuCost,
                    totalCost: usageSummary.totalCost,
                };
            }));
            if (successfulCount === 0) {
                throw new Error('All Prometheus usage queries failed.');
            }
            applyUsageRecords(records);
            const hasData = records.some(usageRecordHasData);
            if (hasData) {
                const notices = [
                    `資料來源：Prometheus v71；只列入歷史費用率大於 0 的區段，費用使用目前設定 CPU ${cpuCostPerMinute} / min、GPU ${gpuCostPerMinute} / min。`
                ];
                if (
                    earliestAvailableTimestamp !== null
                    && earliestAvailableTimestamp > secondsFromDate(rangeStart)
                ) {
                    notices.push(
                        `目前最早僅查得到 ${new Date(earliestAvailableTimestamp * 1000).toLocaleDateString()} 之後的歷史資料，較早月份會顯示 0。`
                    );
                }
                if (missingMetrics.size) {
                    notices.push(`部分指標 (${Array.from(missingMetrics).join(', ')}) 尚未回報，已以 0 顯示。`);
                    setUsageNotice(notices.join(' '));
                } else {
                    setUsageNotice(notices.join(' '));
                }
            } else {
                setUsageNotice('Prometheus 尚未回報此使用者的使用紀錄，顯示為 0。');
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                return;
            }
            console.warn('Failed to load usage data from Prometheus.', error);
            setUsageError(error.message || '無法取得 Prometheus usage 資料。');
            setUsageNotice('');
            applyUsageRecords([]);
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
                            <div className="d-flex gap-2 flex-wrap w-100">
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
                                    <table className="usage-table">
                                        <thead>
                                            <tr>
                                                <th>Resource</th>
                                                <th>Hours</th>
                                                <th>Cost (NTD)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <th scope="row">CPU</th>
                                                <td>{formatNumber(selectedUsageRecord?.cpuHours, 2)} hours</td>
                                                <td>{formatNumber(selectedUsageRecord?.cpuCost)} NTD</td>
                                            </tr>
                                            <tr>
                                                <th scope="row">GPU</th>
                                                <td>{formatNumber(selectedUsageRecord?.gpuHours, 2)} hours</td>
                                                <td>{formatNumber(selectedUsageRecord?.gpuCost)} NTD</td>
                                            </tr>
                                        </tbody>
                                        <tfoot>
                                            <tr className="usage-total-row">
                                                <td colSpan={2}>Total</td>
                                                <td className="usage-total-value">{formatNumber(selectedUsageRecord?.totalCost)} NTD</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </>
                            )}
                        </div>
                    </Card>
                )}
        </div>

    )
}
export default User
