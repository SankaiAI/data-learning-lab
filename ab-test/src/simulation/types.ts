// Core types for the A/B testing simulation

export interface User {
  id: string;
  group: 'control' | 'treatment';
  baselineCTR: number;
  trafficIntensity: number;
  preClicks: number;
  preImpressions: number;
  postClicks: number;
  postImpressions: number;
}

export interface SimulationEvent {
  id: string;
  timestamp: number;
  userId: string;
  group: 'control' | 'treatment';
  period: 'pre' | 'post';
  impression: 1;
  click: 0 | 1;
  sessionId?: string;
}

export interface SimulationConfig {
  treatmentEffect: number;
  baselineImbalance: number;
  timeTrendStrength: number;
  noiseLevel: number;
  eventsPerSecond: number;
  launchTime: number;
  totalUsers: number;
}

export interface GroupMetrics {
  impressions: number;
  clicks: number;
  ctr: number;
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
  isPostPeriod: boolean;
}

export const DEFAULT_CONFIG: SimulationConfig = {
  treatmentEffect: 0.05,
  baselineImbalance: 0,
  timeTrendStrength: 0,
  noiseLevel: 1,
  eventsPerSecond: 15,
  launchTime: 30,
  totalUsers: 200,
};
