import type { User, SimulationEvent, SimulationConfig, MetricType } from './types';
import { selectRandomUser, randomLogNormal, randomDuration, randomNormal, randomBinomial } from './userGenerator';

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

export function fastForwardSimulation(
    users: User[],
    config: SimulationConfig,
    durationSeconds: number,
    currentElapsed: number
): void {
    const endElapsed = currentElapsed + durationSeconds;
    const totalSystemEvents = config.eventsPerSecond * durationSeconds;

    // Compute total weight once
    const totalWeight = users.reduce((sum, u) => sum + u.trafficIntensity, 0);

    users.forEach(user => {
        const expectedEvents = totalSystemEvents * (user.trafficIntensity / totalWeight);
        // Sample actual events for this period
        const actualEvents = Math.max(0, Math.round(randomNormal(expectedEvents, Math.sqrt(expectedEvents))));

        if (actualEvents <= 0) return;

        // Split into Pre and Post
        let preDuration = 0;
        let postDuration = 0;

        // Determine split based on launchTime overlap
        if (endElapsed <= config.launchTime) {
            preDuration = durationSeconds;
        } else if (currentElapsed >= config.launchTime) {
            postDuration = durationSeconds;
        } else {
            preDuration = config.launchTime - currentElapsed;
            postDuration = endElapsed - config.launchTime;
        }

        // Allocate events proportionally
        const preEvents = Math.round(actualEvents * (preDuration / durationSeconds));
        const postEvents = actualEvents - preEvents;

        const updateBulkStats = (count: number, period: 'pre' | 'post') => {
            if (count <= 0) return;

            // Determine effective rate (using midpoint time)
            const duration = period === 'pre' ? preDuration : postDuration;
            const startTime = period === 'pre' ? currentElapsed : Math.max(currentElapsed, config.launchTime);
            const tMid = startTime + duration / 2;

            let rate = user.baselineCTR * (1 + config.timeTrendStrength * tMid / 60);

            if (period === 'post' && user.group === 'treatment') {
                rate *= (1 + config.treatmentEffect);
            }

            // Apply metric specific logic
            if (config.metricType === 'ctr' || config.metricType === 'conversion') {
                const clicks = randomBinomial(count, rate);
                if (period === 'pre') {
                    user.preImpressions += count;
                    user.preClicks += clicks;
                    user.preMetricSum += clicks;
                    user.preMetricCount += count;
                } else {
                    user.postImpressions += count;
                    user.postClicks += clicks;
                    user.postMetricSum += clicks;
                    user.postMetricCount += count;
                }
            } else if (config.metricType === 'revenue') {
                // Revenue: 30% conversion rate, then log-normal value
                // Expected Sum = Conversions * Rate (Base Revenue)
                const conversions = randomBinomial(count, 0.3);

                if (conversions > 0) {
                    const cv = 0.5 * config.noiseLevel;
                    // variance of single purchase ~ (rate * cv)^2
                    // std of Sum ~ sqrt(conversions) * rate * cv
                    const totalRev = Math.max(0, randomNormal(conversions * rate, Math.sqrt(conversions) * rate * cv));

                    if (period === 'pre') {
                        user.preClicks += conversions;
                        user.preMetricSum += totalRev;
                    } else {
                        user.postClicks += conversions;
                        user.postMetricSum += totalRev;
                    }
                }
                // Impressions/Count always increments
                if (period === 'pre') {
                    user.preImpressions += count;
                    user.preMetricCount += count;
                } else {
                    user.postImpressions += count;
                    user.postMetricCount += count;
                }
            } else if (config.metricType === 'duration') {
                // Duration: always > 0. Mean = rate.
                const cv = 0.4 * config.noiseLevel;
                const totalDur = Math.max(0, randomNormal(count * rate, Math.sqrt(count) * rate * cv));

                if (period === 'pre') {
                    user.preImpressions += count;
                    user.preClicks += count; // "Active" sessions
                    user.preMetricSum += totalDur;
                    user.preMetricCount += count;
                } else {
                    user.postImpressions += count;
                    user.postClicks += count;
                    user.postMetricSum += totalDur;
                    user.postMetricCount += count;
                }
            }
        };

        updateBulkStats(preEvents, 'pre');
        updateBulkStats(postEvents, 'post');
    });
}
