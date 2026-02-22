import { useState, useEffect } from 'react';
import type { MetricType } from '../simulation/types';
import { METRIC_CONFIGS } from '../simulation/types';
import { useLanguage } from '../i18n';
import { HelpTooltip } from './Tooltip';
import './SampleSizePanel.css';

// Normal distribution inverse CDF approximation
function normalInverseCDF(p: number): number {
    // Approximation using Abramowitz and Stegun formula 26.2.23
    const a1 = -3.969683028665376e+01;
    const a2 = 2.209460984245205e+02;
    const a3 = -2.759285104469687e+02;
    const a4 = 1.383577518672690e+02;
    const a5 = -3.066479806614716e+01;
    const a6 = 2.506628277459239e+00;
    const b1 = -5.447609879822406e+01;
    const b2 = 1.615858368580409e+02;
    const b3 = -1.556989798598866e+02;
    const b4 = 6.680131188771972e+01;
    const b5 = -1.328068155288572e+01;
    const c1 = -7.784894002430293e-03;
    const c2 = -3.223964580411365e-01;
    const c3 = -2.400758277161838e+00;
    const c4 = -2.549732539343734e+00;
    const c5 = 4.374664141464968e+00;
    const c6 = 2.938163982698783e+00;
    const d1 = 7.784695709041462e-03;
    const d2 = 3.224671290700398e-01;
    const d3 = 2.445134137142996e+00;
    const d4 = 3.754408661907416e+00;

    const pLow = 0.02425;
    const pHigh = 1 - pLow;

    let q: number, r: number;

    if (p < pLow) {
        q = Math.sqrt(-2 * Math.log(p));
        return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
            ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    } else if (p <= pHigh) {
        q = p - 0.5;
        r = q * q;
        return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
            (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
    } else {
        q = Math.sqrt(-2 * Math.log(1 - p));
        return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
            ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    }
}

function calculateSampleSize(
    baseline: number,
    mde: number,
    power: number,
    alpha: number,
    metricType: MetricType
): number {
    const zAlpha = normalInverseCDF(1 - alpha / 2);
    const zBeta = normalInverseCDF(power);

    let variance;
    if (metricType === 'ctr' || metricType === 'conversion') {
        // for proportion metrics, variance = p(1-p)
        const p = baseline;
        // clamp p to avoid negative variance
        const safeP = Math.max(0.001, Math.min(0.999, p));
        variance = safeP * (1 - safeP);
    } else {
        // for continuous metrics like revenue/duration
        // we assume a CV (Coefficient of Variation) or Standard Deviation
        // for simplicity, let's assume variance scales with the mean squared (CV=1 assumption if not provided)
        // or just use a fixed variance assumption for the demo.
        // Actually, let's use a CV assumption of 1.0 (sigma = mean) which is common for exponential-like data (revenue, duration)
        const sigma = baseline; // assume standard deviation ~= mean (CV=1)
        variance = sigma * sigma;
    }

    const n = 2 * Math.pow(zAlpha + zBeta, 2) * variance / Math.pow(mde, 2);

    return Math.ceil(n);
}

interface SampleSizePanelProps {
    metricType: MetricType;
    baselineValue: number;
}

export function SampleSizePanel({ metricType, baselineValue }: SampleSizePanelProps) {
    const { t, language } = useLanguage();
    const helpTitle = language === 'zh' ? t('helpTitleZh') : t('helpTitle');
    const config = METRIC_CONFIGS[metricType];

    // Determine default values based on metric type & prop baseline
    // This effect runs when metricType or baselineValue changes
    useEffect(() => {
        // Update baseline and MDE defaults when metric type/baseline changes
        setBaselineCTR(baselineValue);
        // Scale MDE: for % metrics, use small value (0.01), for continuous, use relative % of baseline
        const defaultRelativeMde = 0.05; // 5% lift 
        setMde(baselineValue * defaultRelativeMde);
    }, [metricType, baselineValue]);

    // Input states
    const [baselineCTR, setBaselineCTR] = useState(baselineValue);
    const [mde, setMde] = useState(baselineValue * 0.05); // Default MDE
    const [power, setPower] = useState(0.8); // 80%
    const [alpha, setAlpha] = useState(0.05); // 5%
    const [dailyTraffic, setDailyTraffic] = useState(10000);
    const [trafficAllocation, setTrafficAllocation] = useState(1.0); // 100%

    // Calculate sample size
    const sampleSizePerGroup = calculateSampleSize(baselineCTR, mde, power, alpha, metricType);
    const totalSampleSize = sampleSizePerGroup * 2;

    // Calculate duration
    const effectiveDailyTraffic = dailyTraffic * trafficAllocation;
    const durationDays = Math.ceil(totalSampleSize / effectiveDailyTraffic);
    const durationWeeks = (durationDays / 7).toFixed(1);

    // Get metric label
    const getMetricLabel = () => {
        switch (metricType) {
            case 'ctr': return 'CTR';
            case 'conversion': return language === 'zh' ? '转化率' : 'Conversion';
            case 'revenue': return language === 'zh' ? '收入' : 'Revenue';
            case 'duration': return language === 'zh' ? '时长' : 'Duration';
            default: return 'Metric';
        }
    };
    const metricLabel = getMetricLabel();

    const formatValue = (n: number) => {
        if (config.unit === 'percent') {
            return (n * 100).toFixed(1) + '%';
        } else if (config.unit === 'currency') {
            const symbol = language === 'zh' ? '¥' : '$';
            return symbol + n.toFixed(2);
        } else {
            const unit = language === 'zh' ? '秒' : 's';
            return n.toFixed(1) + unit;
        }
    };

    const formatPercent = (n: number) => (n * 100).toFixed(1) + '%';
    const formatNumber = (n: number) => n.toLocaleString();

    // Adjust step and max for inputs based on metric
    const baselineMax = config.unit === 'percent' ? 0.3 : config.maxValue;
    const baselineStep = config.unit === 'percent' ? 0.005 : (config.maxValue - config.minValue) / 100;

    const mdeMax = config.unit === 'percent' ? 0.05 : (config.baselineValue * 0.2); // max 20% lift
    const mdeStep = config.unit === 'percent' ? 0.001 : (config.baselineValue * 0.005);

    return (
        <div className="sample-size-panel analysis-panel">
            <div className="panel-header">
                <h2>{t('sampleSizeCalculator')}</h2>
                <span className="panel-subtitle">{t('sampleSizeSubtitle')}</span>
            </div>

            <div className="explanation-box">
                <h4>{t('whatIsSampleSize')}</h4>
                <p>{t('sampleSizeExplanation')}</p>
            </div>

            <div className="calculator-layout">
                <div className="input-section">
                    <h3>{t('inputParameters')}</h3>

                    <div className="input-group">
                        <label>
                            {language === 'zh' ? `基线 ${metricLabel}` : `Baseline ${metricLabel}`}
                            <HelpTooltip steps={t('helpBaselineCTR') as unknown as string[]} title={helpTitle} />
                            <strong>{formatValue(baselineCTR)}</strong>
                        </label>
                        <input
                            type="range"
                            min={config.minValue}
                            max={baselineMax}
                            step={baselineStep}
                            value={baselineCTR}
                            onChange={(e) => setBaselineCTR(parseFloat(e.target.value))}
                        />
                        <p className="input-desc">
                            {metricType === 'ctr' ? t('baselineCTRDesc') :
                                (language === 'zh' ? `实验前的当前${metricLabel}` : `Your current ${metricLabel} before the experiment.`)}
                        </p>
                    </div>

                    <div className="input-group">
                        <label>
                            {t('mdeLabel')}
                            <HelpTooltip steps={t('helpMDE') as unknown as string[]} title={helpTitle} />
                            <strong>{formatValue(mde)}</strong>
                        </label>
                        <input
                            type="range"
                            min={mdeStep}
                            max={mdeMax}
                            step={mdeStep}
                            value={mde}
                            onChange={(e) => setMde(parseFloat(e.target.value))}
                        />
                        <p className="input-desc">{t('mdeDesc')}</p>
                    </div>

                    <div className="input-group">
                        <label>
                            {t('statisticalPower')}
                            <HelpTooltip steps={t('helpPower') as unknown as string[]} title={helpTitle} />
                            <strong>{formatPercent(power)}</strong>
                        </label>
                        <input
                            type="range"
                            min="0.7"
                            max="0.95"
                            step="0.05"
                            value={power}
                            onChange={(e) => setPower(parseFloat(e.target.value))}
                        />
                        <p className="input-desc">{t('powerDesc')}</p>
                    </div>

                    <div className="input-group">
                        <label>
                            {t('significanceLevel')}
                            <HelpTooltip steps={t('helpSignificance') as unknown as string[]} title={helpTitle} />
                            <strong>{formatPercent(alpha)}</strong>
                        </label>
                        <input
                            type="range"
                            min="0.01"
                            max="0.1"
                            step="0.01"
                            value={alpha}
                            onChange={(e) => setAlpha(parseFloat(e.target.value))}
                        />
                        <p className="input-desc">{t('significanceDesc')}</p>
                    </div>

                    <div className="input-group">
                        <label>
                            {t('dailyTraffic')}
                            <HelpTooltip steps={t('helpDailyTraffic') as unknown as string[]} title={helpTitle} />
                            <strong>{formatNumber(dailyTraffic)}</strong>
                        </label>
                        <input
                            type="range"
                            min="1000"
                            max="100000"
                            step="1000"
                            value={dailyTraffic}
                            onChange={(e) => setDailyTraffic(parseInt(e.target.value))}
                        />
                        <p className="input-desc">{t('dailyTrafficDesc')}</p>
                    </div>

                    <div className="input-group">
                        <label>
                            {t('trafficAllocation')}
                            <HelpTooltip steps={t('helpTrafficAllocation') as unknown as string[]} title={helpTitle} />
                            <strong>{formatPercent(trafficAllocation)}</strong>
                        </label>
                        <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.1"
                            value={trafficAllocation}
                            onChange={(e) => setTrafficAllocation(parseFloat(e.target.value))}
                        />
                        <p className="input-desc">{t('trafficAllocationDesc')}</p>
                    </div>
                </div>

                <div className="results-section">
                    <h3>{t('calculationResults')}</h3>

                    <div className="result-card primary">
                        <div className="result-label">{t('requiredSampleSize')}</div>
                        <div className="result-value">{formatNumber(sampleSizePerGroup)}</div>
                        <div className="result-unit">{t('perGroup')}</div>
                    </div>

                    <div className="result-card">
                        <div className="result-label">{t('totalSampleSize')}</div>
                        <div className="result-value">{formatNumber(totalSampleSize)}</div>
                    </div>

                    <div className="result-card highlight">
                        <div className="result-label">{t('estimatedDuration')}</div>
                        <div className="result-value">{durationDays} {t('days')}</div>
                        <div className="result-unit">≈ {durationWeeks} {t('weeks')}</div>
                    </div>

                    <div className="formula-section">
                        <h4>{t('formulaExplanation')}</h4>
                        <div className="formula">{t('sampleSizeFormula')}</div>
                        <div className="formula">{t('durationFormula')}</div>
                    </div>
                </div>
            </div>

            <div className="recommendations">
                <h3>{t('recommendations')}</h3>
                <ul>
                    <li>{t('recMinDuration')}</li>
                    <li>{t('recNoPeeking')}</li>
                    <li>{t('recSeasonality')}</li>
                    <li>{t('recFullWeeks')}</li>
                </ul>
            </div>
        </div>
    );
}
