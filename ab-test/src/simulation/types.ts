// Core types for the A/B testing simulation

// Metric types supported by the simulator
export type MetricType = 'ctr' | 'conversion' | 'revenue' | 'duration';

// Configuration for each metric type
export interface MetricConfig {
  type: MetricType;
  name: string;
  nameKey: string; // i18n key
  unit: 'percent' | 'currency' | 'time';
  baselineValue: number;
  minValue: number;
  maxValue: number;
  step: number;
  statTest: 'z-test' | 't-test';
  isContinuous: boolean;
}

// Predefined metric configurations
export const METRIC_CONFIGS: Record<MetricType, MetricConfig> = {
  ctr: {
    type: 'ctr',
    name: 'Click-Through Rate',
    nameKey: 'metricCTR',
    unit: 'percent',
    baselineValue: 0.05,
    minValue: 0.01,
    maxValue: 0.3,
    step: 0.005,
    statTest: 'z-test',
    isContinuous: false,
  },
  conversion: {
    type: 'conversion',
    name: 'Conversion Rate',
    nameKey: 'metricConversion',
    unit: 'percent',
    baselineValue: 0.03,
    minValue: 0.005,
    maxValue: 0.2,
    step: 0.005,
    statTest: 'z-test',
    isContinuous: false,
  },
  revenue: {
    type: 'revenue',
    name: 'Revenue (ARPU)',
    nameKey: 'metricRevenue',
    unit: 'currency',
    baselineValue: 25,
    minValue: 5,
    maxValue: 100,
    step: 1,
    statTest: 't-test',
    isContinuous: true,
  },
  duration: {
    type: 'duration',
    name: 'Session Duration',
    nameKey: 'metricDuration',
    unit: 'time',
    baselineValue: 120,
    minValue: 30,
    maxValue: 600,
    step: 10,
    statTest: 't-test',
    isContinuous: true,
  },
};

export interface User {
  id: string;
  group: 'control' | 'treatment';
  baselineCTR: number; // Also used as baseline rate for other metrics
  trafficIntensity: number;
  preClicks: number;
  preImpressions: number;
  postClicks: number;
  postImpressions: number;
  // For continuous metrics
  preMetricSum: number;
  postMetricSum: number;
  preMetricCount: number;
  postMetricCount: number;
}

export interface SimulationEvent {
  id: string;
  timestamp: number;
  userId: string;
  group: 'control' | 'treatment';
  period: 'pre' | 'post';
  impression: 1;
  click: 0 | 1;
  metricValue: number; // The actual metric value (revenue $, duration seconds, or 0/1 for proportions)
  sessionId?: string;
}

export interface SimulationConfig {
  metricType: MetricType;
  treatmentEffect: number;
  baselineImbalance: number;
  timeTrendStrength: number;
  noiseLevel: number;
  eventsPerSecond: number;
  launchTime: number;
  totalUsers: number;
  baselineValue: number; // Dynamic based on metric type
}

export interface GroupMetrics {
  impressions: number;
  clicks: number;
  ctr: number;
  // For continuous metrics
  metricSum: number;
  metricCount: number;
  metricMean: number;
}

export interface AggregatedMetrics {
  control: {
    pre: GroupMetrics;
    post: GroupMetrics;
  };
  treatment: {
    pre: GroupMetrics;
    post: GroupMetrics;
  };
}

export interface StatResult {
  estimate: number;
  standardError: number;
  confidenceInterval: [number, number];
  pValue: number;
  significant: boolean;
}

export interface CupedResult extends StatResult {
  theta: number;
  varianceReduction: number;
  varianceBefore: number;
  varianceAfter: number;
}

export interface DidResult extends StatResult {
  treatPre: number;
  treatPost: number;
  ctrlPre: number;
  ctrlPost: number;
  treatDelta: number;
  ctrlDelta: number;
}

export interface TimeSeriesPoint {
  time: number;
  controlCTR: number;
  treatmentCTR: number;
  controlMetric: number;
  treatmentMetric: number;
  isPostPeriod: boolean;
}

export const DEFAULT_CONFIG: SimulationConfig = {
  metricType: 'ctr',
  treatmentEffect: 0.05,
  baselineImbalance: 0,
  timeTrendStrength: 0,
  noiseLevel: 1,
  eventsPerSecond: 15,
  launchTime: 15,
  totalUsers: 200,
  baselineValue: 0.05,
};
