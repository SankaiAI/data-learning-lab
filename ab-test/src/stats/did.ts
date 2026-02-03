import type { AggregatedMetrics, DidResult } from '../simulation/types';
import { confidenceInterval, zScore, pValueFromZ } from './utils';

export function computeDiD(metrics: AggregatedMetrics): DidResult {
    const treatPre = metrics.treatment.pre.ctr;
    const treatPost = metrics.treatment.post.ctr;
    const ctrlPre = metrics.control.pre.ctr;
    const ctrlPost = metrics.control.post.ctr;

    const treatDelta = treatPost - treatPre;
    const ctrlDelta = ctrlPost - ctrlPre;

    const estimate = treatDelta - ctrlDelta;

    const n1 = metrics.control.pre.impressions + metrics.control.post.impressions;
    const n2 = metrics.treatment.pre.impressions + metrics.treatment.post.impressions;

    const p1 = (metrics.control.pre.clicks + metrics.control.post.clicks) / (n1 || 1);
    const p2 = (metrics.treatment.pre.clicks + metrics.treatment.post.clicks) / (n2 || 1);

    const se1 = Math.sqrt(p1 * (1 - p1) * (1 / (metrics.control.pre.impressions || 1) + 1 / (metrics.control.post.impressions || 1)));
    const se2 = Math.sqrt(p2 * (1 - p2) * (1 / (metrics.treatment.pre.impressions || 1) + 1 / (metrics.treatment.post.impressions || 1)));

    const se = Math.sqrt(se1 * se1 + se2 * se2);

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

export function checkParallelTrends(metrics: AggregatedMetrics): {
    preDifference: number;
    isParallel: boolean;
    warning: string | null;
} {
    const preDifference = metrics.treatment.pre.ctr - metrics.control.pre.ctr;

    const threshold = 0.02;
    const isParallel = Math.abs(preDifference) < threshold;

    return {
        preDifference,
        isParallel,
        warning: isParallel ? null : 'Pre-period CTR differs between groups. Parallel trends assumption may be violated.',
    };
}

export function didRegressionInterpretation(metrics: AggregatedMetrics): {
    intercept: number;
    treatCoef: number;
    postCoef: number;
    interactionCoef: number;
} {
    const ctrlPre = metrics.control.pre.ctr;
    const ctrlPost = metrics.control.post.ctr;
    const treatPre = metrics.treatment.pre.ctr;
    const treatPost = metrics.treatment.post.ctr;

    return {
        intercept: ctrlPre,
        treatCoef: treatPre - ctrlPre,
        postCoef: ctrlPost - ctrlPre,
        interactionCoef: (treatPost - treatPre) - (ctrlPost - ctrlPre),
    };
}
