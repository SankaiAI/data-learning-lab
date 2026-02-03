import type { User, SimulationEvent, SimulationConfig, MetricType } from './types';
import { selectRandomUser, randomLogNormal, randomDuration } from './userGenerator';

let eventCounter = 0;

// Generate metric value based on metric type
function generateMetricValue(
    metricType: MetricType,
    effectiveRate: number,
    config: SimulationConfig
): { click: 0 | 1; metricValue: number } {
    const noise = 1 + (Math.random() - 0.5) * 0.2 * config.noiseLevel;

    switch (metricType) {
        case 'ctr':
        case 'conversion': {
            // Proportion metrics: binary outcome
            const probability = Math.max(0, Math.min(1, effectiveRate * noise));
            const click = Math.random() < probability ? 1 : 0;
            return { click: click as 0 | 1, metricValue: click };
        }
        case 'revenue': {
            // Revenue: log-normal distribution around user's baseline
            const baseRevenue = effectiveRate * noise;
            // Some users don't convert (revenue = 0), others have positive revenue
            const converts = Math.random() < 0.3; // 30% purchase rate
            const metricValue = converts ? randomLogNormal(baseRevenue, 0.5 * config.noiseLevel) : 0;
            return { click: converts ? 1 : 0, metricValue };
        }
        case 'duration': {
            // Session duration: gamma distribution (always positive)
            const baseDuration = effectiveRate * noise;
            const metricValue = randomDuration(baseDuration, 0.4 * config.noiseLevel);
            return { click: 1, metricValue }; // Duration events always have a value
        }
        default:
            return { click: 0, metricValue: 0 };
    }
}

export function generateEvent(
    user: User,
    elapsedSeconds: number,
    config: SimulationConfig
): SimulationEvent {
    const period = elapsedSeconds < config.launchTime ? 'pre' : 'post';

    let effectiveRate = user.baselineCTR;

    // Apply time trend
    const timeFactor = 1 + (config.timeTrendStrength * elapsedSeconds / 60);
    effectiveRate *= timeFactor;

    // Apply treatment effect in post period
    if (period === 'post' && user.group === 'treatment') {
        effectiveRate *= (1 + config.treatmentEffect);
    }

    // Generate metric-appropriate value
    const { click, metricValue } = generateMetricValue(
        config.metricType,
        effectiveRate,
        config
    );

    eventCounter++;

    return {
        id: `evt-${eventCounter}`,
        timestamp: Date.now(),
        userId: user.id,
        group: user.group,
        period,
        impression: 1,
        click,
        metricValue,
        sessionId: `session-${user.id}-${Math.floor(elapsedSeconds / 30)}`,
    };
}

export function updateUserMetrics(user: User, event: SimulationEvent): void {
    if (event.period === 'pre') {
        user.preImpressions++;
        user.preClicks += event.click;
        user.preMetricSum += event.metricValue;
        user.preMetricCount++;
    } else {
        user.postImpressions++;
        user.postClicks += event.click;
        user.postMetricSum += event.metricValue;
        user.postMetricCount++;
    }
}

export function generateEventBatch(
    users: User[],
    elapsedSeconds: number,
    config: SimulationConfig,
    batchSize: number = 1
): SimulationEvent[] {
    const events: SimulationEvent[] = [];

    for (let i = 0; i < batchSize; i++) {
        const user = selectRandomUser(users);
        const event = generateEvent(user, elapsedSeconds, config);
        updateUserMetrics(user, event);
        events.push(event);
    }

    return events;
}

export function resetEventCounter(): void {
    eventCounter = 0;
}
