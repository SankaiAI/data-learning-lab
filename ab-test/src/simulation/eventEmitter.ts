import type { User, SimulationEvent, SimulationConfig } from './types';
import { selectRandomUser } from './userGenerator';

let eventCounter = 0;

export function generateEvent(
    user: User,
    elapsedSeconds: number,
    config: SimulationConfig
): SimulationEvent {
    const period = elapsedSeconds < config.launchTime ? 'pre' : 'post';

    let effectiveCTR = user.baselineCTR;

    const timeFactor = 1 + (config.timeTrendStrength * elapsedSeconds / 60);
    effectiveCTR *= timeFactor;

    if (period === 'post' && user.group === 'treatment') {
        effectiveCTR *= (1 + config.treatmentEffect);
    }

    const noise = 1 + (Math.random() - 0.5) * 0.1 * config.noiseLevel;
    effectiveCTR *= noise;

    effectiveCTR = Math.max(0, Math.min(1, effectiveCTR));

    const click = Math.random() < effectiveCTR ? 1 : 0;

    eventCounter++;

    return {
        id: `evt-${eventCounter}`,
        timestamp: Date.now(),
        userId: user.id,
        group: user.group,
        period,
        impression: 1,
        click: click as 0 | 1,
        sessionId: `session-${user.id}-${Math.floor(elapsedSeconds / 30)}`,
    };
}

export function updateUserMetrics(user: User, event: SimulationEvent): void {
    if (event.period === 'pre') {
        user.preImpressions++;
        user.preClicks += event.click;
    } else {
        user.postImpressions++;
        user.postClicks += event.click;
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
