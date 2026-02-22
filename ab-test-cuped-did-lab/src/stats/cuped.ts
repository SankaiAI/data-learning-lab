import type { User, CupedResult, MetricType } from '../simulation/types';
import { METRIC_CONFIGS } from '../simulation/types';
import { mean, variance, covariance, confidenceInterval, zScore, pValueFromZ } from './utils';

export interface UserMetrics {
    userId: string;
    group: 'control' | 'treatment';
    preMetric: number;
    postMetric: number;
}

export function extractUserMetrics(users: User[], metricType: MetricType = 'ctr'): UserMetrics[] {
    const config = METRIC_CONFIGS[metricType];

    if (config.isContinuous) {
        // For continuous metrics, use metric sums/counts
        return users
            .filter(u => u.preMetricCount > 0 && u.postMetricCount > 0)
            .map(u => ({
                userId: u.id,
                group: u.group,
                preMetric: u.preMetricSum / u.preMetricCount,
                postMetric: u.postMetricSum / u.postMetricCount,
            }));
    } else {
        // For proportions, use clicks/impressions
        return users
            .filter(u => u.preImpressions > 0 && u.postImpressions > 0)
            .map(u => ({
                userId: u.id,
                group: u.group,
                preMetric: u.preClicks / u.preImpressions,
                postMetric: u.postClicks / u.postImpressions,
            }));
    }
}

export function computeCUPED(users: User[], metricType: MetricType = 'ctr'): CupedResult {
    const userMetrics = extractUserMetrics(users, metricType);

    if (userMetrics.length < 10) {
        return {
            estimate: 0,
            standardError: 0,
            confidenceInterval: [0, 0],
            pValue: 1,
            significant: false,
            theta: 0,
            varianceReduction: 0,
            varianceBefore: 0,
            varianceAfter: 0,
        };
    }

    const control = userMetrics.filter(u => u.group === 'control');
    const treatment = userMetrics.filter(u => u.group === 'treatment');

    const allX = userMetrics.map(u => u.preMetric);
    const allY = userMetrics.map(u => u.postMetric);

    const covYX = covariance(allY, allX);
    const varX = variance(allX);
    const theta = varX > 0 ? covYX / varX : 0;

    const meanX = mean(allX);

    const controlAdjusted = control.map(u => u.postMetric - theta * (u.preMetric - meanX));
    const treatmentAdjusted = treatment.map(u => u.postMetric - theta * (u.preMetric - meanX));

    const controlRaw = control.map(u => u.postMetric);
    const treatmentRaw = treatment.map(u => u.postMetric);

    const meanControlAdj = mean(controlAdjusted);
    const meanTreatmentAdj = mean(treatmentAdjusted);
    const estimate = meanTreatmentAdj - meanControlAdj;

    const pooledVariance = (
        variance(controlAdjusted) * (control.length - 1) +
        variance(treatmentAdjusted) * (treatment.length - 1)
    ) / (control.length + treatment.length - 2);

    const se = Math.sqrt(pooledVariance * (1 / control.length + 1 / treatment.length));

    const varianceBefore = variance([...controlRaw, ...treatmentRaw]);
    const varianceAfter = variance([...controlAdjusted, ...treatmentAdjusted]);
    const varianceReduction = varianceBefore > 0
        ? 1 - varianceAfter / varianceBefore
        : 0;

    const ci = confidenceInterval(estimate, se);
    const z = zScore(estimate, se);
    const pValue = pValueFromZ(z);

    return {
        estimate,
        standardError: se,
        confidenceInterval: ci,
        pValue,
        significant: pValue < 0.05,
        theta,
        varianceReduction,
        varianceBefore,
        varianceAfter,
    };
}

export function getCupedScatterData(users: User[], metricType: MetricType = 'ctr'): {
    control: Array<{ x: number; y: number }>;
    treatment: Array<{ x: number; y: number }>;
} {
    const userMetrics = extractUserMetrics(users, metricType);

    return {
        control: userMetrics
            .filter(u => u.group === 'control')
            .map(u => ({ x: u.preMetric, y: u.postMetric })),
        treatment: userMetrics
            .filter(u => u.group === 'treatment')
            .map(u => ({ x: u.preMetric, y: u.postMetric })),
    };
}
