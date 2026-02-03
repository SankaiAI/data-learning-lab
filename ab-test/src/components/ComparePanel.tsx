import type { StatResult, CupedResult, DidResult, AggregatedMetrics } from '../simulation/types';
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
}

export function ComparePanel({ naiveResult, cupedResult, didResult, metrics, trueEffect }: ComparePanelProps) {
    const { t, language } = useLanguage();
    const formatPercent = (n: number, decimals = 2) => (n * 100).toFixed(decimals) + '%';
    const formatPValue = (p: number) => {
        if (p < 0.001) return '< 0.001';
        return p.toFixed(4);
    };

    const nControl = metrics.control.pre.impressions + metrics.control.post.impressions;
    const nTreatment = metrics.treatment.pre.impressions + metrics.treatment.post.impressions;
    const srmPValue = srmCheck(nControl, nTreatment);
    const srmOk = srmPValue > 0.01;

    const preBalanceCheck = Math.abs(metrics.treatment.pre.ctr - metrics.control.pre.ctr);
    const preBalanceOk = preBalanceCheck < 0.02;

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
                <span className="true-value">{formatPercent(trueEffect)} {t('relativeLift')}</span>
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
                                    {method.result.estimate > 0 ? '+' : ''}{formatPercent(method.result.estimate)}
                                </span>
                            </div>
                            <div className="ci">
                                <span className="ci-label">{t('confidenceInterval')}</span>
                                <span className="ci-value">
                                    [{formatPercent(method.result.confidenceInterval[0])}, {formatPercent(method.result.confidenceInterval[1])}]
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
                            <span>{t('control')} pre-CTR: {formatPercent(metrics.control.pre.ctr)}</span>
                            <span>{t('treatment')} pre-CTR: {formatPercent(metrics.treatment.pre.ctr)}</span>
                            <span>Difference: {formatPercent(preBalanceCheck)}</span>
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
