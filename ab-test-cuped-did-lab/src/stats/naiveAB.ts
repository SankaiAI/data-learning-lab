import type { User, StatResult, AggregatedMetrics, MetricType } from '../simulation/types';
import { METRIC_CONFIGS } from '../simulation/types';
import {
    diffProportionSE,
    diffMeanSE,
    welchDF,
    confidenceInterval,
    confidenceIntervalT,
    zScore,
    tScore,
    pValueFromZ,
    pValueFromT,
    variance as calcVariance
} from './utils';

export function computeAggregatedMetrics(users: User[]): AggregatedMetrics {
    const metrics: AggregatedMetrics = {
        control: {
            pre: { impressions: 0, clicks: 0, ctr: 0, metricSum: 0, metricCount: 0, metricMean: 0 },
            post: { impressions: 0, clicks: 0, ctr: 0, metricSum: 0, metricCount: 0, metricMean: 0 },
        },
        treatment: {
            pre: { impressions: 0, clicks: 0, ctr: 0, metricSum: 0, metricCount: 0, metricMean: 0 },
            post: { impressions: 0, clicks: 0, ctr: 0, metricSum: 0, metricCount: 0, metricMean: 0 },
        },
    };

    for (const user of users) {
        const group = metrics[user.group];
        group.pre.impressions += user.preImpressions;
        group.pre.clicks += user.preClicks;
        group.pre.metricSum += user.preMetricSum;
        group.pre.metricCount += user.preMetricCount;

        group.post.impressions += user.postImpressions;
        group.post.clicks += user.postClicks;
        group.post.metricSum += user.postMetricSum;
        group.post.metricCount += user.postMetricCount;
    }

    for (const group of ['control', 'treatment'] as const) {
        for (const period of ['pre', 'post'] as const) {
            const m = metrics[group][period];
            m.ctr = m.impressions > 0 ? m.clicks / m.impressions : 0;
            m.metricMean = m.metricCount > 0 ? m.metricSum / m.metricCount : 0;
        }
    }

    return metrics;
}

// Get metric values for users for variance calculation
export function getUserMetricValues(
    users: User[],
    period: 'pre' | 'post',
    group: 'control' | 'treatment',
    metricType: MetricType
): number[] {
    const filteredUsers = users.filter(u => u.group === group);

    if (metricType === 'ctr' || metricType === 'conversion') {
        // For proportions, return individual user CTRs
        return filteredUsers.map(u => {
            const impressions = period === 'pre' ? u.preImpressions : u.postImpressions;
            const clicks = period === 'pre' ? u.preClicks : u.postClicks;
            return impressions > 0 ? clicks / impressions : 0;
        }).filter(v => v > 0 || true); // Include all users
    } else {
        // For continuous metrics, return per-user means
        return filteredUsers.map(u => {
            const sum = period === 'pre' ? u.preMetricSum : u.postMetricSum;
            const count = period === 'pre' ? u.preMetricCount : u.postMetricCount;
            return count > 0 ? sum / count : 0;
        }).filter(v => v > 0); // Only include users with data
    }
}

export function naiveABTest(
    metrics: AggregatedMetrics,
    metricType: MetricType = 'ctr',
    users?: User[]
): StatResult {
    const ctrl = metrics.control.post;
    const treat = metrics.treatment.post;
    const config = METRIC_CONFIGS[metricType];

    if (config.isContinuous) {
        // T-test for continuous metrics
        const ctrlMean = ctrl.metricMean;
        const treatMean = treat.metricMean;
        const estimate = treatMean - ctrlMean;

        // Calculate variances from user-level data if available
        let ctrlVar = 0, treatVar = 0;
        if (users) {
            const ctrlValues = getUserMetricValues(users, 'post', 'control', metricType);
            const treatValues = getUserMetricValues(users, 'post', 'treatment', metricType);
            ctrlVar = calcVariance(ctrlValues);
            treatVar = calcVariance(treatValues);
        } else {
            // Fallback: estimate variance from mean (rough approximation)
            ctrlVar = ctrlMean * 0.5;
            treatVar = treatMean * 0.5;
        }

        const se = diffMeanSE(ctrlMean, ctrlVar, ctrl.metricCount, treatMean, treatVar, treat.metricCount);
        const df = welchDF(ctrlVar, ctrl.metricCount, treatVar, treat.metricCount);
        const t = tScore(estimate, se);
        const pValue = pValueFromT(t, df);
        const ci = confidenceIntervalT(estimate, se, df);

        return {
            estimate,
            standardError: se,
            confidenceInterval: ci,
            pValue,
            significant: pValue < 0.05,
        };
    } else {
        // Z-test for proportions
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
}

export function computeRelativeLift(
    metrics: AggregatedMetrics,
    metricType: MetricType = 'ctr',
    users?: User[]
): { lift: number; liftCI: [number, number] } {
    const config = METRIC_CONFIGS[metricType];
    const ctrl = metrics.control.post;
    const treat = metrics.treatment.post;

    const baseValue = config.isContinuous ? ctrl.metricMean : ctrl.ctr;
    const treatValue = config.isContinuous ? treat.metricMean : treat.ctr;

    if (baseValue === 0) {
        return { lift: 0, liftCI: [0, 0] };
    }

    const lift = (treatValue - baseValue) / baseValue;

    const abResult = naiveABTest(metrics, metricType, users);
    const seLift = abResult.standardError / baseValue;
    const liftCI = confidenceInterval(lift, seLift);

    return { lift, liftCI };
}

export function checkBaselineImbalance(
    metrics: AggregatedMetrics,
    metricType: MetricType = 'ctr'
): {
    imbalanceDetected: boolean;
    preDifference: number;
    pValue: number;
} {
    const ctrl = metrics.control.pre;
    const treat = metrics.treatment.pre;
    const config = METRIC_CONFIGS[metricType];

    let preDifference: number;
    let se: number;

    if (config.isContinuous) {
        preDifference = treat.metricMean - ctrl.metricMean;
        // Rough variance estimate
        const ctrlVar = ctrl.metricMean * 0.5;
        const treatVar = treat.metricMean * 0.5;
        se = diffMeanSE(ctrl.metricMean, ctrlVar, ctrl.metricCount, treat.metricMean, treatVar, treat.metricCount);
    } else {
        preDifference = treat.ctr - ctrl.ctr;
        se = diffProportionSE(
            ctrl.ctr, ctrl.impressions,
            treat.ctr, treat.impressions
        );
    }

    const z = zScore(preDifference, se);
    const pValue = pValueFromZ(z);

    return {
        imbalanceDetected: pValue < 0.1,
        preDifference,
        pValue,
    };
}
