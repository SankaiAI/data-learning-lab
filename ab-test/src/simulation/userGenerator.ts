import type { User, SimulationConfig } from './types';

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

function randomGamma(shape: number): number {
    if (shape < 1) {
        return randomGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
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
            return d * v;
        }

        if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
            return d * v;
        }
    }
}

function generateId(): string {
    return Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
}

export function generateUsers(config: SimulationConfig): User[] {
    const users: User[] = [];

    for (let i = 0; i < config.totalUsers; i++) {
        const group = Math.random() < 0.5 ? 'control' : 'treatment';

        let baselineCTR = randomBeta(2, 38);

        if (group === 'treatment') {
            baselineCTR *= (1 + config.baselineImbalance);
        }

        baselineCTR = Math.max(0.001, Math.min(0.5, baselineCTR));

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
