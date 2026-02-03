// Statistical utility functions

/**
 * Calculate mean of an array
 */
export function mean(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Calculate variance of an array
 */
export function variance(arr: number[]): number {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return arr.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / (arr.length - 1);
}

/**
 * Calculate standard deviation
 */
export function std(arr: number[]): number {
    return Math.sqrt(variance(arr));
}

/**
 * Calculate covariance between two arrays
 */
export function covariance(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;
    const meanX = mean(x);
    const meanY = mean(y);
    let sum = 0;
    for (let i = 0; i < x.length; i++) {
        sum += (x[i] - meanX) * (y[i] - meanY);
    }
    return sum / (x.length - 1);
}

/**
 * Calculate correlation coefficient
 */
export function correlation(x: number[], y: number[]): number {
    const cov = covariance(x, y);
    const stdX = std(x);
    const stdY = std(y);
    if (stdX === 0 || stdY === 0) return 0;
    return cov / (stdX * stdY);
}

/**
 * Standard error of a proportion
 */
export function proportionSE(p: number, n: number): number {
    if (n === 0) return 0;
    return Math.sqrt(p * (1 - p) / n);
}

/**
 * Standard error of difference between two proportions
 */
export function diffProportionSE(p1: number, n1: number, p2: number, n2: number): number {
    return Math.sqrt(proportionSE(p1, n1) ** 2 + proportionSE(p2, n2) ** 2);
}

/**
 * Standard error of a mean
 */
export function meanSE(values: number[]): number {
    if (values.length < 2) return 0;
    return std(values) / Math.sqrt(values.length);
}

/**
 * Z-score for a given value
 */
export function zScore(value: number, se: number): number {
    if (se === 0) return 0;
    return value / se;
}

/**
 * Two-tailed p-value from z-score (normal approximation)
 */
export function pValueFromZ(z: number): number {
    // Standard normal CDF approximation
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const absZ = Math.abs(z);
    const t = 1.0 / (1.0 + p * absZ);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absZ * absZ / 2);

    // Two-tailed p-value
    return 2 * (1 - y);
}

/**
 * Confidence interval (95% by default)
 */
export function confidenceInterval(
    estimate: number,
    se: number,
    confidence: number = 0.95
): [number, number] {
    // Z-score for confidence level (1.96 for 95%)
    const zTable: Record<number, number> = {
        0.90: 1.645,
        0.95: 1.96,
        0.99: 2.576,
    };
    const z = zTable[confidence] || 1.96;

    return [estimate - z * se, estimate + z * se];
}

/**
 * Sample Ratio Mismatch (SRM) check using chi-squared test
 * Returns p-value for the null hypothesis that the split is 50/50
 */
export function srmCheck(nControl: number, nTreatment: number): number {
    const total = nControl + nTreatment;
    if (total === 0) return 1;

    const expected = total / 2;
    const chiSquared =
        Math.pow(nControl - expected, 2) / expected +
        Math.pow(nTreatment - expected, 2) / expected;

    // Chi-squared with 1 df, using approximation
    // P(X > x) ≈ erfc(sqrt(x/2))
    const pValue = Math.exp(-chiSquared / 2);
    return pValue;
}
