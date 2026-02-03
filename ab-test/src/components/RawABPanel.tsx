import type { StatResult, AggregatedMetrics, MetricType } from '../simulation/types';
import { METRIC_CONFIGS } from '../simulation/types';
import { useLanguage } from '../i18n';
import { HelpTooltip } from './Tooltip';
import './RawABPanel.css';

interface RawABPanelProps {
    result: StatResult;
    metrics: AggregatedMetrics;
    imbalanceCheck: {
        imbalanceDetected: boolean;
        preDifference: number;
        pValue: number;
    };
    metricType: MetricType;
}

// Helper to format metric values based on type
function formatMetricValue(value: number, metricType: MetricType, language: string): string {
    const config = METRIC_CONFIGS[metricType];
    const currencySymbol = language === 'zh' ? '¥' : '$';
    const timeUnit = language === 'zh' ? '秒' : 's';

    switch (config.unit) {
        case 'percent':
            return (value * 100).toFixed(2) + '%';
        case 'currency':
            return currencySymbol + value.toFixed(2);
        case 'time':
            return value.toFixed(1) + timeUnit;
        default:
            return value.toFixed(2);
    }
}

export function RawABPanel({ result, metrics, imbalanceCheck, metricType }: RawABPanelProps) {
    const { t, language } = useLanguage();
    const config = METRIC_CONFIGS[metricType];

    // Get metric label key based on type
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

    const formatPValue = (p: number) => {
        if (p < 0.001) return '< 0.001';
        return p.toFixed(4);
    };

    // Get the appropriate metric value
    const getMetricValueFromGroup = (group: 'control' | 'treatment') => {
        if (config.isContinuous) {
            return metrics[group].post.metricMean;
        }
        return metrics[group].post.ctr;
    };

    const controlValue = getMetricValueFromGroup('control');
    const treatmentValue = getMetricValueFromGroup('treatment');
    const relativeLift = controlValue > 0 ? result.estimate / controlValue : 0;

    const helpTitle = language === 'zh' ? t('helpTitleZh') : t('helpTitle');

    return (
        <div className="raw-ab-panel analysis-panel">
            <div className="panel-header">
                <h2>{t('rawABResult')}</h2>
                <span className="panel-subtitle">{t('naivePostComparison')}</span>
            </div>

            {imbalanceCheck.imbalanceDetected && (
                <div className="warning-banner">
                    <span className="warning-icon">⚠️</span>
                    <div>
                        <strong>{t('baselineImbalanceDetected')}</strong>
                        <p>{t('baselineImbalanceWarning')}</p>
                    </div>
                </div>
            )}

            <div className="explanation-box">
                <h4>{t('whatIsThis')}</h4>
                <p>{t('rawABExplanation')}</p>
                <div className="formula">
                    Effect = {metricLabel}<sub>treatment</sub> - {metricLabel}<sub>control</sub>
                </div>
                <p className="caveat">{t('rawABCaveat')}</p>
            </div>

            <div className="results-grid">
                <div className="result-card">
                    <div className="result-label">
                        {t('control')} {metricLabel}
                        <HelpTooltip steps={t('helpControlCTR') as unknown as string[]} title={helpTitle} />
                    </div>
                    <div className="result-value">{formatMetricValue(controlValue, metricType, language)}</div>
                </div>
                <div className="result-card">
                    <div className="result-label">
                        {t('treatment')} {metricLabel}
                        <HelpTooltip steps={t('helpTreatmentCTR') as unknown as string[]} title={helpTitle} />
                    </div>
                    <div className="result-value">{formatMetricValue(treatmentValue, metricType, language)}</div>
                </div>
            </div>

            <div className="main-result">
                <div className="effect-display">
                    <span className="effect-label">
                        {t('observedDifference')}
                        <HelpTooltip steps={t('helpObservedDiff') as unknown as string[]} title={helpTitle} />
                    </span>
                    <span className={`effect-value ${result.estimate > 0 ? 'positive' : 'negative'}`}>
                        {result.estimate > 0 ? '+' : ''}{formatMetricValue(result.estimate, metricType, language)}
                    </span>
                    <span className="effect-relative">
                        ({relativeLift > 0 ? '+' : ''}{(relativeLift * 100).toFixed(1)}% {t('relativeLift')})
                    </span>
                </div>

                <div className="ci-display">
                    <span className="ci-label">
                        {t('confidenceInterval')}
                        <HelpTooltip steps={t('helpConfidenceInterval') as unknown as string[]} title={helpTitle} />
                    </span>
                    <div className="ci-bar">
                        <div
                            className="ci-range"
                            style={{
                                left: `${Math.max(0, 50 + result.confidenceInterval[0] / 0.1 * 50)}%`,
                                right: `${Math.max(0, 50 - result.confidenceInterval[1] / 0.1 * 50)}%`,
                            }}
                        >
                            <span className="ci-lower">{formatMetricValue(result.confidenceInterval[0], metricType, language)}</span>
                            <span className="ci-upper">{formatMetricValue(result.confidenceInterval[1], metricType, language)}</span>
                        </div>
                        <div className="ci-zero" />
                    </div>
                </div>

                <div className="stat-row">
                    <div className="stat-item">
                        <span className="stat-label">
                            {t('standardError')}
                            <HelpTooltip steps={t('helpStandardError') as unknown as string[]} title={helpTitle} />
                        </span>
                        <span className="stat-value">{formatMetricValue(result.standardError, metricType, language)}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">
                            {t('pValue')}
                            <HelpTooltip steps={t('helpPValue') as unknown as string[]} title={helpTitle} />
                        </span>
                        <span className={`stat-value ${result.significant ? 'significant' : ''}`}>
                            {formatPValue(result.pValue)}
                        </span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">{t('significant')}</span>
                        <span className={`stat-value badge ${result.significant ? 'yes' : 'no'}`}>
                            {result.significant ? t('yes') : t('no')}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
