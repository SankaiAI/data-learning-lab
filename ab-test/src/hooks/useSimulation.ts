import { useState, useRef, useCallback, useEffect } from 'react';
import type {
    User,
    SimulationEvent,
    SimulationConfig,
    TimeSeriesPoint
} from '../simulation/types';
import { DEFAULT_CONFIG, METRIC_CONFIGS } from '../simulation/types';
import { generateUsers } from '../simulation/userGenerator';
import { generateEventBatch, resetEventCounter } from '../simulation/eventEmitter';
import { computeAggregatedMetrics, naiveABTest, checkBaselineImbalance } from '../stats/naiveAB';
import { computeCUPED, getCupedScatterData } from '../stats/cuped';
import { computeDiD, checkParallelTrends, didRegressionInterpretation } from '../stats/did';

const MAX_EVENTS_DISPLAY = 50;
const TIME_SERIES_INTERVAL = 2;

export function useSimulation() {
    const [config, setConfig] = useState<SimulationConfig>(DEFAULT_CONFIG);
    const [users, setUsers] = useState<User[]>([]);
    const [events, setEvents] = useState<SimulationEvent[]>([]);
    const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number>(0);
    const lastTimeSeriesRef = useRef<number>(0);
    const usersRef = useRef<User[]>([]);

    const initializeUsers = useCallback(() => {
        resetEventCounter();
        const newUsers = generateUsers(config);
        setUsers(newUsers);
        usersRef.current = newUsers;
        setEvents([]);
        setTimeSeries([]);
        setElapsedTime(0);
        lastTimeSeriesRef.current = 0;
    }, [config]);

    const start = useCallback(() => {
        if (usersRef.current.length === 0) {
            const newUsers = generateUsers(config);
            setUsers(newUsers);
            usersRef.current = newUsers;
        }

        startTimeRef.current = Date.now() - elapsedTime * 1000;
        setIsRunning(true);

        intervalRef.current = setInterval(() => {
            const now = Date.now();
            const elapsed = (now - startTimeRef.current) / 1000;
            setElapsedTime(elapsed);

            const eventsPerTick = Math.max(1, Math.round(config.eventsPerSecond / 10));
            const newEvents = generateEventBatch(
                usersRef.current,
                elapsed,
                config,
                eventsPerTick
            );

            setEvents(prev => [...newEvents, ...prev].slice(0, MAX_EVENTS_DISPLAY));
            setUsers([...usersRef.current]);

            if (elapsed - lastTimeSeriesRef.current >= TIME_SERIES_INTERVAL) {
                lastTimeSeriesRef.current = elapsed;

                const controlUsers = usersRef.current.filter(u => u.group === 'control');
                const treatmentUsers = usersRef.current.filter(u => u.group === 'treatment');

                const isPost = elapsed >= config.launchTime;
                const metricConfig = METRIC_CONFIGS[config.metricType];

                // Calculate metric based on type
                const calcMetric = (userList: User[]) => {
                    if (metricConfig.isContinuous) {
                        const sum = userList.reduce((s, u) =>
                            s + (isPost ? u.postMetricSum : u.preMetricSum), 0);
                        const count = userList.reduce((s, u) =>
                            s + (isPost ? u.postMetricCount : u.preMetricCount), 0);
                        return count > 0 ? sum / count : 0;
                    } else {
                        const clicks = userList.reduce((sum, u) =>
                            sum + (isPost ? u.postClicks : u.preClicks), 0);
                        const imps = userList.reduce((sum, u) =>
                            sum + (isPost ? u.postImpressions : u.preImpressions), 0);
                        return imps > 0 ? clicks / imps : 0;
                    }
                };

                const controlMetric = calcMetric(controlUsers);
                const treatmentMetric = calcMetric(treatmentUsers);

                const point: TimeSeriesPoint = {
                    time: elapsed,
                    controlCTR: controlMetric, // Keep for backward compat
                    treatmentCTR: treatmentMetric,
                    controlMetric,
                    treatmentMetric,
                    isPostPeriod: isPost,
                };

                setTimeSeries(prev => [...prev, point]);
            }
        }, 100);
    }, [config, elapsedTime]);

    const pause = useCallback(() => {
        setIsRunning(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const reset = useCallback(() => {
        pause();
        initializeUsers();
        startTimeRef.current = 0;
    }, [pause, initializeUsers]);

    const updateConfig = useCallback((updates: Partial<SimulationConfig>) => {
        setConfig(prev => {
            const newConfig = { ...prev, ...updates };

            // If metric type changed, update baseline value and reset
            if (updates.metricType && updates.metricType !== prev.metricType) {
                const metricConfig = METRIC_CONFIGS[updates.metricType];
                newConfig.baselineValue = metricConfig.baselineValue;
            }

            return newConfig;
        });
    }, []);

    // Reset when metric type changes
    useEffect(() => {
        if (!isRunning && users.length > 0) {
            // Don't auto-reset, let user decide
        }
    }, [config.metricType, isRunning, users.length]);

    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    const metrics = computeAggregatedMetrics(users);
    const naiveResult = naiveABTest(metrics, config.metricType, users);
    const imbalanceCheck = checkBaselineImbalance(metrics, config.metricType);
    const cupedResult = computeCUPED(users, config.metricType);
    const cupedScatter = getCupedScatterData(users, config.metricType);
    const didResult = computeDiD(metrics, config.metricType);
    const parallelCheck = checkParallelTrends(metrics, config.metricType);
    const didRegression = didRegressionInterpretation(metrics, config.metricType);

    const exportJSON = useCallback(() => {
        const data = {
            config,
            metrics,
            naiveResult,
            cupedResult,
            didResult,
            timeSeries,
            users: users.map(u => ({
                id: u.id,
                group: u.group,
                baselineCTR: u.baselineCTR,
                preClicks: u.preClicks,
                preImpressions: u.preImpressions,
                postClicks: u.postClicks,
                postImpressions: u.postImpressions,
                preMetricSum: u.preMetricSum,
                postMetricSum: u.postMetricSum,
                preMetricCount: u.preMetricCount,
                postMetricCount: u.postMetricCount,
            })),
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ab-test-data-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [config, metrics, naiveResult, cupedResult, didResult, timeSeries, users]);

    const exportCSV = useCallback(() => {
        const metricConfig = METRIC_CONFIGS[config.metricType];
        const headers = metricConfig.isContinuous
            ? [
                'userId',
                'group',
                'baselineValue',
                'preMetricSum',
                'preMetricCount',
                'preMean',
                'postMetricSum',
                'postMetricCount',
                'postMean'
            ]
            : [
                'userId',
                'group',
                'baselineCTR',
                'preClicks',
                'preImpressions',
                'preCTR',
                'postClicks',
                'postImpressions',
                'postCTR'
            ];

        const rows = users.map(u => {
            if (metricConfig.isContinuous) {
                return [
                    u.id,
                    u.group,
                    u.baselineCTR.toFixed(6),
                    u.preMetricSum.toFixed(2),
                    u.preMetricCount,
                    u.preMetricCount > 0 ? (u.preMetricSum / u.preMetricCount).toFixed(2) : '0',
                    u.postMetricSum.toFixed(2),
                    u.postMetricCount,
                    u.postMetricCount > 0 ? (u.postMetricSum / u.postMetricCount).toFixed(2) : '0'
                ];
            } else {
                return [
                    u.id,
                    u.group,
                    u.baselineCTR.toFixed(6),
                    u.preClicks,
                    u.preImpressions,
                    u.preImpressions > 0 ? (u.preClicks / u.preImpressions).toFixed(6) : '0',
                    u.postClicks,
                    u.postImpressions,
                    u.postImpressions > 0 ? (u.postClicks / u.postImpressions).toFixed(6) : '0'
                ];
            }
        });

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ab-test-users-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [users, config.metricType]);

    return {
        config,
        users,
        events,
        timeSeries,
        isRunning,
        elapsedTime,
        start,
        pause,
        reset,
        updateConfig,
        exportJSON,
        exportCSV,
        metrics,
        naiveResult,
        imbalanceCheck,
        cupedResult,
        cupedScatter,
        didResult,
        parallelCheck,
        didRegression,
    };
}
