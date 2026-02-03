import type { User, SimulationConfig, MetricType } from './types';

function randomNormal(mean: number = 0, std: number = 1): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * std + mean;
}

function randomBeta(alpha: number, beta: number): number {
    const gammaAlpha = randomGamma(alpha);
    const gammaBeta = randomGamma(beta);
    return gammaAlpha / (gammaAlpha + gammaBeta);
}

export function randomGamma(shape: number, scale: number = 1): number {
    if (shape < 1) {
        return randomGamma(shape + 1, scale) * Math.pow(Math.random(), 1 / shape);
    }

    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);

    while (true) {
        let x, v;
        do {
            x = randomNormal();
            v = 1 + c * x;
        } while (v <= 0);

        v = v * v * v;
        const u = Math.random();

        if (u < 1 - 0.0331 * (x * x) * (x * x)) {
            return d * v * scale;
        }

        if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
            return d * v * scale;
        }
    }
}

// Generate log-normal distributed revenue values
export function randomLogNormal(mean: number, cv: number = 0.5): number {
    // cv = coefficient of variation = std/mean
    const variance = (cv * mean) ** 2;
    const mu = Math.log(mean ** 2 / Math.sqrt(variance + mean ** 2));
    const sigma = Math.sqrt(Math.log(1 + variance / mean ** 2));
    return Math.exp(randomNormal(mu, sigma));
}

// Generate gamma-distributed duration values (always positive, right-skewed)
export function randomDuration(mean: number, cv: number = 0.5): number {
    // For gamma: shape = 1/cv^2, scale = mean * cv^2
    const shape = 1 / (cv * cv);
    const scale = mean * cv * cv;
    return randomGamma(shape, scale);
}

function generateId(): string {
    return Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
}

// Get baseline rate based on metric type
function getBaselineRate(metricType: MetricType, baselineValue: number): number {
    switch (metricType) {
        case 'ctr':
        case 'conversion':
            // For proportions, use beta distribution around the baseline
            return randomBeta(2, (2 / baselineValue) - 2);
        case 'revenue':
        case 'duration':
            // For continuous metrics, use the baseline directly with some user variation
            return baselineValue * Math.exp(randomNormal(0, 0.3));
        default:
            return baselineValue;
    }
}

export function generateUsers(config: SimulationConfig): User[] {
    const users: User[] = [];

    for (let i = 0; i < config.totalUsers; i++) {
        const group = Math.random() < 0.5 ? 'control' : 'treatment';

        let baselineCTR = getBaselineRate(config.metricType, config.baselineValue);

        if (group === 'treatment') {
            baselineCTR *= (1 + config.baselineImbalance);
        }

        // Clamp based on metric type
        if (config.metricType === 'ctr' || config.metricType === 'conversion') {
            baselineCTR = Math.max(0.001, Math.min(0.5, baselineCTR));
        } else {
            baselineCTR = Math.max(1, baselineCTR); // Minimum $1 or 1 second
        }

        const trafficIntensity = Math.exp(randomNormal(0, 0.5));

        users.push({
            id: generateId(),
            group,
            baselineCTR,
            trafficIntensity,
            preClicks: 0,
            preImpressions: 0,
            postClicks: 0,
            postImpressions: 0,
            preMetricSum: 0,
            postMetricSum: 0,
            preMetricCount: 0,
            postMetricCount: 0,
        });
    }

    return users;
}

export function selectRandomUser(users: User[]): User {
    const totalWeight = users.reduce((sum, u) => sum + u.trafficIntensity, 0);
    let r = Math.random() * totalWeight;

    for (const user of users) {
        r -= user.trafficIntensity;
        if (r <= 0) return user;
    }

    return users[users.length - 1];
}
