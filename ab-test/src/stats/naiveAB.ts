import type { User, StatResult, AggregatedMetrics } from '../simulation/types';
import { diffProportionSE, confidenceInterval, zScore, pValueFromZ } from './utils';

export function computeAggregatedMetrics(users: User[]): AggregatedMetrics {
    const metrics: AggregatedMetrics = {
        control: {
            pre: { impressions: 0, clicks: 0, ctr: 0 },
            post: { impressions: 0, clicks: 0, ctr: 0 },
        },
        treatment: {
            pre: { impressions: 0, clicks: 0, ctr: 0 },
            post: { impressions: 0, clicks: 0, ctr: 0 },
        },
    };

    for (const user of users) {
        const group = metrics[user.group];
        group.pre.impressions += user.preImpressions;
        group.pre.clicks += user.preClicks;
        group.post.impressions += user.postImpressions;
        group.post.clicks += user.postClicks;
    }

    for (const group of ['control', 'treatment'] as const) {
        for (const period of ['pre', 'post'] as const) {
            const m = metrics[group][period];
            m.ctr = m.impressions > 0 ? m.clicks / m.impressions : 0;
        }
    }

    return metrics;
}

export function naiveABTest(metrics: AggregatedMetrics): StatResult {
    const ctrl = metrics.control.post;
    const treat = metrics.treatment.post;

    const ctrControl = ctrl.ctr;
    const ctrTreatment = treat.ctr;

    const estimate = ctrTreatment - ctrControl;

    const se = diffProportionSE(
        ctrControl, ctrl.impressions,
        ctrTreatment, treat.impressions
    );

    const ci = confidenceInterval(estimate, se);
    const z = zScore(estimate, se);
    const pValue = pValueFromZ(z);

    return {
        estimate,
        standardError: se,
        confidenceInterval: ci,
        pValue,
        significant: pValue < 0.05,
    };
}

export function computeRelativeLift(
    metrics: AggregatedMetrics
): { lift: number; liftCI: [number, number] } {
    const ctrControl = metrics.control.post.ctr;
    const ctrTreatment = metrics.treatment.post.ctr;

    if (ctrControl === 0) {
        return { lift: 0, liftCI: [0, 0] };
    }

    const lift = (ctrTreatment - ctrControl) / ctrControl;

    const abResult = naiveABTest(metrics);
    const seLift = abResult.standardError / ctrControl;
    const liftCI = confidenceInterval(lift, seLift);

    return { lift, liftCI };
}

export function checkBaselineImbalance(metrics: AggregatedMetrics): {
    imbalanceDetected: boolean;
    preDifference: number;
    pValue: number;
} {
    const ctrl = metrics.control.pre;
    const treat = metrics.treatment.pre;

    const preDifference = treat.ctr - ctrl.ctr;

    const se = diffProportionSE(
        ctrl.ctr, ctrl.impressions,
        treat.ctr, treat.impressions
    );

    const z = zScore(preDifference, se);
    const pValue = pValueFromZ(z);

    return {
        imbalanceDetected: pValue < 0.1,
        preDifference,
        pValue,
    };
}
