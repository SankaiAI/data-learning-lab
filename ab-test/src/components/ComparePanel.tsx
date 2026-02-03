import type { StatResult, CupedResult, DidResult, AggregatedMetrics, MetricType, GroupMetrics } from '../simulation/types';
import { METRIC_CONFIGS } from '../simulation/types';
import { useLanguage } from '../i18n';
import { HelpTooltip } from './Tooltip';
import { srmCheck } from '../stats/utils';
import './ComparePanel.css';

interface ComparePanelProps {
    naiveResult: StatResult;
    cupedResult: CupedResult;
    didResult: DidResult;
    metrics: AggregatedMetrics;
    trueEffect: number;
    metricType: MetricType;
}

export function ComparePanel({ naiveResult, cupedResult, didResult, metrics, trueEffect, metricType }: ComparePanelProps) {
    const { t, language } = useLanguage();
    const config = METRIC_CONFIGS[metricType];

    // Get metric label for display
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

    // Format value based on metric type
    const formatValue = (n: number, decimals = 2) => {
        if (config.unit === 'percent') {
            return (n * 100).toFixed(decimals) + '%';
        } else if (config.unit === 'currency') {
            const symbol = language === 'zh' ? '¥' : '$';
            return symbol + n.toFixed(decimals);
        } else {
            const unit = language === 'zh' ? '秒' : 's';
            return n.toFixed(decimals) + unit;
        }
    };

    const formatPercent = (n: number, decimals = 2) => (n * 100).toFixed(decimals) + '%';
    const formatPValue = (p: number) => {
        if (p < 0.001) return '< 0.001';
        return p.toFixed(4);
    };

    const nControl = metrics.control.pre.impressions + metrics.control.post.impressions;
    const nTreatment = metrics.treatment.pre.impressions + metrics.treatment.post.impressions;
    const srmPValue = srmCheck(nControl, nTreatment);
    const srmOk = srmPValue > 0.01;

    // Helper to get mean value based on metric type
    const getMean = (m: GroupMetrics) => config.isContinuous ? m.metricMean : m.ctr;

    // Balance check using the correct metric
    const controlPreMean = getMean(metrics.control.pre);
    const treatPreMean = getMean(metrics.treatment.pre);
    const preBalanceCheck = Math.abs(treatPreMean - controlPreMean);

    // Check threshold depends on metric scale. For %, 0.02 (2 points) is reasonable? 
    // Actually, simple randomized check usually looks for p-value > 0.05 not magnitude.
    // But for this simplified check, if it's percent, we use 0.02. If continuous, 5% of baseline?
    const balanceThreshold = config.unit === 'percent' ? 0.02 : (config.baselineValue * 0.1);
    const preBalanceOk = preBalanceCheck < balanceThreshold;


    const helpTitle = language === 'zh' ? t('helpTitleZh') : t('helpTitle');

    const methods = [
        {
            name: t('naiveAB'),
            icon: '📊',
            result: naiveResult,
            description: t('naiveABDesc'),
            pros: [t('easyToUnderstand'), t('noPrePeriodNeeded')],
            cons: [t('affectedByImbalance'), t('ignoresTimeTrends')],
            when: t('whenNaive'),
        },
        {
            name: t('cuped'),
            icon: '🎯',
            result: cupedResult,
            description: t('cupedDesc'),
            pros: [t('reducesVariance'), t('controlsBaseline')],
            cons: [t('needsPrePeriod'), t('doesntCorrectTrends')],
            when: t('whenCuped'),
        },
        {
            name: t('did'),
            icon: '📈',
            result: didResult,
            description: t('didDesc'),
            pros: [t('removesTimeEffects'), t('controlsForTrends')],
            cons: [t('needsParallelTrends'), t('lowerPowerThanCuped')],
            when: t('whenDid'),
        },
    ];

    return (
        <div className="compare-panel analysis-panel">
            <div className="panel-header">
                <h2>{t('compareMethods')}</h2>
                <span className="panel-subtitle">{t('sideByAnalysis')}</span>
            </div>

            <div className="true-effect-banner">
                <span className="true-label">{t('trueEffectConfigured')}</span>
                <span className="true-value">{formatValue(trueEffect)} {t('relativeLift')}</span>
            </div>

            <div className="methods-grid">
                {methods.map((method) => (
                    <div key={method.name} className="method-card">
                        <div className="method-header">
                            <span className="method-icon">{method.icon}</span>
                            <h3>{method.name}</h3>
                        </div>
                        <p className="method-description">{method.description}</p>

                        <div className="method-result">
                            <div className="estimate">
                                <span className="estimate-label">Effect</span>
                                <span className={`estimate-value ${method.result.estimate > 0 ? 'positive' : 'negative'}`}>
                                    {method.result.estimate > 0 ? '+' : ''}{formatValue(method.result.estimate)}
                                </span>
                            </div>
                            <div className="ci">
                                <span className="ci-label">{t('confidenceInterval')}</span>
                                <span className="ci-value">
                                    [{formatValue(method.result.confidenceInterval[0])}, {formatValue(method.result.confidenceInterval[1])}]
                                </span>
                            </div>
                            <div className="pvalue">
                                <span className={`pvalue-badge ${method.result.significant ? 'sig' : 'nosig'}`}>
                                    p = {formatPValue(method.result.pValue)}
                                </span>
                            </div>
                        </div>

                        <div className="method-details">
                            <div className="pros">
                                <h4>{t('strengths')}</h4>
                                <ul>
                                    {method.pros.map((pro, i) => <li key={i}>{pro}</li>)}
                                </ul>
                            </div>
                            <div className="cons">
                                <h4>{t('weaknesses')}</h4>
                                <ul>
                                    {method.cons.map((con, i) => <li key={i}>{con}</li>)}
                                </ul>
                            </div>
                        </div>

                        <div className="when-to-use">
                            <strong>{t('whenToUse')}</strong> {method.when}
                        </div>
                    </div>
                ))}
            </div>

            <div className="sanity-checks">
                <h3>{t('sanityChecks')}</h3>

                <div className="checks-grid">
                    <div className={`check-card ${srmOk ? 'pass' : 'fail'}`}>
                        <div className="check-header">
                            <span className="check-icon">{srmOk ? '✓' : '✗'}</span>
                            <span className="check-name">
                                {t('srmCheck')}
                                <HelpTooltip steps={t('helpSRM') as unknown as string[]} title={helpTitle} />
                            </span>
                        </div>
                        <div className="check-details">
                            <span>{t('control')}: {nControl.toLocaleString()} | {t('treatment')}: {nTreatment.toLocaleString()}</span>
                            <span>Ratio: {(nTreatment / (nControl || 1)).toFixed(3)} (expected: 1.0)</span>
                            <span>p-value: {formatPValue(srmPValue)}</span>
                        </div>
                        <p className="check-explain">
                            {srmOk ? t('srmOk') : t('srmWarning')}
                        </p>
                    </div>

                    <div className={`check-card ${preBalanceOk ? 'pass' : 'warn'}`}>
                        <div className="check-header">
                            <span className="check-icon">{preBalanceOk ? '✓' : '⚠'}</span>
                            <span className="check-name">{t('preBalanceCheck')}</span>
                        </div>
                        <div className="check-details">
                            <span>{t('control')} pre-{metricLabel}: {formatValue(controlPreMean)}</span>
                            <span>{t('treatment')} pre-{metricLabel}: {formatValue(treatPreMean)}</span>
                            <span>Difference: {formatValue(preBalanceCheck)}</span>
                        </div>
                        <p className="check-explain">
                            {preBalanceOk ? t('preBalanceOk') : t('preBalanceWarning')}
                        </p>
                    </div>

                    <div className="check-card info">
                        <div className="check-header">
                            <span className="check-icon">📊</span>
                            <span className="check-name">{t('parallelTrendsVisual')}</span>
                        </div>
                        <p className="check-explain">{t('parallelTrendsExplain')}</p>
                    </div>
                </div>
            </div>

            <div className="key-insights">
                <h3>{t('keyInsights')}</h3>
                <ul>
                    <li><strong>{t('insightImbalance')}</strong></li>
                    <li><strong>{t('insightTrends')}</strong></li>
                    <li><strong>{t('insightPower')}</strong></li>
                    <li>
                        <strong>CUPED {t('varianceReduction')}:</strong> {formatPercent(cupedResult.varianceReduction)}
                    </li>
                </ul>
            </div>
        </div>
    );
}
