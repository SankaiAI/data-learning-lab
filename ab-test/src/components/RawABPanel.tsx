import type { StatResult, AggregatedMetrics } from '../simulation/types';
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
}

export function RawABPanel({ result, metrics, imbalanceCheck }: RawABPanelProps) {
    const { t, language } = useLanguage();
    const formatPercent = (n: number, decimals = 2) => (n * 100).toFixed(decimals) + '%';
    const formatPValue = (p: number) => {
        if (p < 0.001) return '< 0.001';
        return p.toFixed(4);
    };

    const relativeLift = metrics.control.post.ctr > 0
        ? result.estimate / metrics.control.post.ctr
        : 0;

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
                    Effect = CTR<sub>treatment</sub> - CTR<sub>control</sub>
                </div>
                <p className="caveat">{t('rawABCaveat')}</p>
            </div>

            <div className="results-grid">
                <div className="result-card">
                    <div className="result-label">
                        {t('controlCTR')}
                        <HelpTooltip steps={t('helpControlCTR') as unknown as string[]} title={helpTitle} />
                    </div>
                    <div className="result-value">{formatPercent(metrics.control.post.ctr)}</div>
                </div>
                <div className="result-card">
                    <div className="result-label">
                        {t('treatmentCTR')}
                        <HelpTooltip steps={t('helpTreatmentCTR') as unknown as string[]} title={helpTitle} />
                    </div>
                    <div className="result-value">{formatPercent(metrics.treatment.post.ctr)}</div>
                </div>
            </div>

            <div className="main-result">
                <div className="effect-display">
                    <span className="effect-label">
                        {t('observedDifference')}
                        <HelpTooltip steps={t('helpObservedDiff') as unknown as string[]} title={helpTitle} />
                    </span>
                    <span className={`effect-value ${result.estimate > 0 ? 'positive' : 'negative'}`}>
                        {result.estimate > 0 ? '+' : ''}{formatPercent(result.estimate)}
                    </span>
                    <span className="effect-relative">
                        ({relativeLift > 0 ? '+' : ''}{formatPercent(relativeLift)} {t('relativeLift')})
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
                            <span className="ci-lower">{formatPercent(result.confidenceInterval[0])}</span>
                            <span className="ci-upper">{formatPercent(result.confidenceInterval[1])}</span>
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
                        <span className="stat-value">{formatPercent(result.standardError, 3)}</span>
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
