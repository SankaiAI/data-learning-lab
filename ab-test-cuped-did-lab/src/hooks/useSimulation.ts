import { useState, useRef, useCallback, useEffect } from 'react';
import type {
    User,
    SimulationEvent,
    SimulationConfig,
    TimeSeriesPoint
} from '../simulation/types';
import { DEFAULT_CONFIG, METRIC_CONFIGS } from '../simulation/types';
import { generateUsers } from '../simulation/userGenerator';
import { generateEventBatch, resetEventCounter, fastForwardSimulation } from '../simulation/eventEmitter';
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
    const lastTickRef = useRef<number>(0);
    const lastTimeSeriesRef = useRef<number>(0);
    const usersRef = useRef<User[]>([]);
    const elapsedTimeRef = useRef<number>(0);

    const initializeUsers = useCallback(() => {
        resetEventCounter();
        const newUsers = generateUsers(config);
        setUsers(newUsers);
        usersRef.current = newUsers;
        setEvents([]);
        setTimeSeries([]);
        setElapsedTime(0);
        elapsedTimeRef.current = 0;
        lastTimeSeriesRef.current = 0;
    }, [config]);

    const start = useCallback(() => {
        if (usersRef.current.length === 0) {
            const newUsers = generateUsers(config);
            setUsers(newUsers);
            usersRef.current = newUsers;
        }

        lastTickRef.current = Date.now();
        setIsRunning(true);

        intervalRef.current = setInterval(() => {
            const now = Date.now();
            const realDelta = (now - lastTickRef.current) / 1000;
            lastTickRef.current = now;

            // Apply speed multiplier
            const simDelta = realDelta * config.speed;

            // Update elapsed time ref synchronously
            const newElapsed = elapsedTimeRef.current + simDelta;
            elapsedTimeRef.current = newElapsed;
            setElapsedTime(newElapsed);

            // Adjust event generation for speed
            // eventsPerSecond is in Simulated Time
            // We need to generate (eventsPerSecond * speed) events per Real Second
            // Loop runs at 10Hz (100ms)
            const eventsPerTick = Math.max(1, Math.round((config.eventsPerSecond * config.speed) / 10));

            const newEvents = generateEventBatch(
                usersRef.current,
                newElapsed,
                config,
                eventsPerTick
            );

            setEvents(prev => [...newEvents, ...prev].slice(0, MAX_EVENTS_DISPLAY));
            setUsers([...usersRef.current]);

            if (newElapsed - lastTimeSeriesRef.current >= TIME_SERIES_INTERVAL) {
                lastTimeSeriesRef.current = newElapsed;

                // Use the helper to generate point consistent with fastForward
                const point = generateTimeSeriesPoint(
                    usersRef.current,
                    config,
                    newElapsed
                );

                setTimeSeries(prev => [...prev, point]);
            }
        }, 100);
    }, [config]);

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
        // Reset refs
        lastTickRef.current = 0;
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

    // Helper to generate a time series point
    const generateTimeSeriesPoint = (
        currentUsers: User[],
        currentConfig: SimulationConfig,
        timestamp: number
    ): TimeSeriesPoint => {
        const controlUsers = currentUsers.filter(u => u.group === 'control');
        const treatmentUsers = currentUsers.filter(u => u.group === 'treatment');

        const isPost = timestamp >= currentConfig.launchTime;
        const metricConfig = METRIC_CONFIGS[currentConfig.metricType];

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

        return {
            time: timestamp,
            controlCTR: controlMetric,
            treatmentCTR: treatmentMetric,
            controlMetric,
            treatmentMetric,
            isPostPeriod: isPost,
        };
    };

    const fastForward = useCallback((days: number) => {
        const totalDuration = days * 24 * 3600;
        // Generate ~50 points for the chart to look smooth, or fewer for performance
        // If jumping 1 hour (3600s), step = 72s. 
        // If jumping 1 week (604800s), step = 12000s.
        const steps = 50;
        const stepDuration = totalDuration / steps;

        let currentElapsed = elapsedTimeRef.current;
        const newPoints: TimeSeriesPoint[] = [];

        // Mutate users incrementally
        for (let i = 0; i < steps; i++) {
            fastForwardSimulation(usersRef.current, config, stepDuration, currentElapsed);
            currentElapsed += stepDuration;

            // Capture point
            // Ensure we capture start/end of period transitions roughly
            newPoints.push(generateTimeSeriesPoint(usersRef.current, config, currentElapsed));
        }

        // Trigger state updates
        setUsers([...usersRef.current]);
        setElapsedTime(currentElapsed);
        setTimeSeries(prev => [...prev, ...newPoints]);

        // Update refs
        elapsedTimeRef.current = currentElapsed;
        lastTimeSeriesRef.current = currentElapsed;

    }, [config]);

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
        fastForward,
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
