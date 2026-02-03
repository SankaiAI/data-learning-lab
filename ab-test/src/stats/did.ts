import type { AggregatedMetrics, DidResult, MetricType } from '../simulation/types';
import { METRIC_CONFIGS } from '../simulation/types';
import { confidenceInterval, zScore, pValueFromZ } from './utils';

// Helper to get the appropriate metric value based on metric type
function getMetricValue(group: { ctr: number; metricMean: number }, metricType: MetricType): number {
    const config = METRIC_CONFIGS[metricType];
    return config.isContinuous ? group.metricMean : group.ctr;
}

export function computeDiD(metrics: AggregatedMetrics, metricType: MetricType = 'ctr'): DidResult {
    const config = METRIC_CONFIGS[metricType];

    const treatPre = getMetricValue(metrics.treatment.pre, metricType);
    const treatPost = getMetricValue(metrics.treatment.post, metricType);
    const ctrlPre = getMetricValue(metrics.control.pre, metricType);
    const ctrlPost = getMetricValue(metrics.control.post, metricType);

    const treatDelta = treatPost - treatPre;
    const ctrlDelta = ctrlPost - ctrlPre;

    const estimate = treatDelta - ctrlDelta;

    let se: number;

    if (config.isContinuous) {
        // For continuous metrics, use counts and estimated variance
        const n1Pre = metrics.control.pre.metricCount || 1;
        const n1Post = metrics.control.post.metricCount || 1;
        const n2Pre = metrics.treatment.pre.metricCount || 1;
        const n2Post = metrics.treatment.post.metricCount || 1;

        // Rough variance estimate based on mean
        const varCtrl = ((ctrlPre + ctrlPost) / 2) * 0.5;
        const varTreat = ((treatPre + treatPost) / 2) * 0.5;

        const se1 = Math.sqrt(varCtrl * (1 / n1Pre + 1 / n1Post));
        const se2 = Math.sqrt(varTreat * (1 / n2Pre + 1 / n2Post));
        se = Math.sqrt(se1 * se1 + se2 * se2);
    } else {
        // For proportions, use impressions
        const n1 = metrics.control.pre.impressions + metrics.control.post.impressions;
        const n2 = metrics.treatment.pre.impressions + metrics.treatment.post.impressions;

        const p1 = (metrics.control.pre.clicks + metrics.control.post.clicks) / (n1 || 1);
        const p2 = (metrics.treatment.pre.clicks + metrics.treatment.post.clicks) / (n2 || 1);

        const se1 = Math.sqrt(p1 * (1 - p1) * (1 / (metrics.control.pre.impressions || 1) + 1 / (metrics.control.post.impressions || 1)));
        const se2 = Math.sqrt(p2 * (1 - p2) * (1 / (metrics.treatment.pre.impressions || 1) + 1 / (metrics.treatment.post.impressions || 1)));

        se = Math.sqrt(se1 * se1 + se2 * se2);
    }

    const ci = confidenceInterval(estimate, se);
    const z = zScore(estimate, se);
    const pValue = pValueFromZ(z);

    return {
        estimate,
        standardError: se,
        confidenceInterval: ci,
        pValue,
        significant: pValue < 0.05,
        treatPre,
        treatPost,
        ctrlPre,
        ctrlPost,
        treatDelta,
        ctrlDelta,
    };
}

export function checkParallelTrends(
    metrics: AggregatedMetrics,
    metricType: MetricType = 'ctr'
): {
    preDifference: number;
    isParallel: boolean;
    warning: string | null;
} {
    const config = METRIC_CONFIGS[metricType];
    const treatPre = getMetricValue(metrics.treatment.pre, metricType);
    const ctrlPre = getMetricValue(metrics.control.pre, metricType);

    const preDifference = treatPre - ctrlPre;

    // Threshold depends on metric type
    const threshold = config.isContinuous
        ? (ctrlPre * 0.2) // 20% relative difference for continuous
        : 0.02; // 2pp for proportions

    const isParallel = Math.abs(preDifference) < threshold;

    const metricName = config.isContinuous ? 'metric' : 'CTR';

    return {
        preDifference,
        isParallel,
        warning: isParallel ? null : `Pre-period ${metricName} differs between groups. Parallel trends assumption may be violated.`,
    };
}

export function didRegressionInterpretation(
    metrics: AggregatedMetrics,
    metricType: MetricType = 'ctr'
): {
    intercept: number;
    treatCoef: number;
    postCoef: number;
    interactionCoef: number;
} {
    const ctrlPre = getMetricValue(metrics.control.pre, metricType);
    const ctrlPost = getMetricValue(metrics.control.post, metricType);
    const treatPre = getMetricValue(metrics.treatment.pre, metricType);
    const treatPost = getMetricValue(metrics.treatment.post, metricType);

    return {
        intercept: ctrlPre,
        treatCoef: treatPre - ctrlPre,
        postCoef: ctrlPost - ctrlPre,
        interactionCoef: (treatPost - treatPre) - (ctrlPost - ctrlPre),
    };
}
