import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import type { DidResult, TimeSeriesPoint, MetricType } from '../simulation/types';
import { METRIC_CONFIGS } from '../simulation/types';
import { useLanguage } from '../i18n';
import { HelpTooltip } from './Tooltip';
import './DidPanel.css';

interface DidPanelProps {
    result: DidResult;
    timeSeries: TimeSeriesPoint[];
    launchTime: number;
    parallelCheck: {
        preDifference: number;
        isParallel: boolean;
        warning: string | null;
    };
    regression: {
        intercept: number;
        treatCoef: number;
        postCoef: number;
        interactionCoef: number;
    };
    metricType: MetricType;
}

export function DidPanel({ result, timeSeries, launchTime, parallelCheck, regression, metricType }: DidPanelProps) {
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
    const chartUnit = config.unit === 'percent' ? '%' : (config.unit === 'currency' ? '$' : 's');

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

    const formatPValue = (p: number) => {
        if (p < 0.001) return '< 0.001';
        return p.toFixed(4);
    };

    const chartData = timeSeries.map(p => ({
        time: p.time,
        Control: config.unit === 'percent' ? p.controlCTR * 100 : p.controlMetric,
        Treatment: config.unit === 'percent' ? p.treatmentCTR * 100 : p.treatmentMetric,
        isPost: p.isPostPeriod,
    }));

    // Format time for x-axis labels (human-readable)
    const formatTime = (seconds: number): string => {
        if (seconds < 60) return `${Math.round(seconds)}${t('second')}`;
        if (seconds < 3600) return `${Math.round(seconds / 60)}${t('minute')}`;
        if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}${t('hour')}`;
        if (seconds < 604800) return `${(seconds / 86400).toFixed(1)}${t('day')}`;
        return `${(seconds / 604800).toFixed(1)}${t('week')}`;
    };

    const helpTitle = language === 'zh' ? t('helpTitleZh') : t('helpTitle');

    return (
        <div className="did-panel analysis-panel">
            <div className="panel-header">
                <h2>{t('didWalkthrough')}</h2>
                <span className="panel-subtitle">{t('didSubtitle')}</span>
            </div>

            <div className="explanation-box">
                <h4>{t('whatIsDid')}</h4>
                <p>{t('didExplanation')}</p>
                <div className="formula">
                    DiD = (Treat<sub>post</sub> - Treat<sub>pre</sub>) - (Ctrl<sub>post</sub> - Ctrl<sub>pre</sub>)
                </div>
                <p className="caveat">{t('parallelTrendsCaveat')}</p>
            </div>

            {!parallelCheck.isParallel && (
                <div className="warning-banner">
                    <span className="warning-icon">!</span>
                    <div>
                        <strong>{t('parallelTrendsWarning')}</strong>
                        <p>{parallelCheck.warning}</p>
                    </div>
                </div>
            )}

            <div className="did-table-section">
                <h3>{t('didTable')}</h3>
                <table className="did-table">
                    <thead>
                        <tr>
                            <th></th>
                            <th>{t('prePeriodLabel')}</th>
                            <th>{t('postPeriodLabel')}</th>
                            <th>{t('change')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="control-row">
                            <td>{t('control')}</td>
                            <td>{formatValue(result.ctrlPre)}</td>
                            <td>{formatValue(result.ctrlPost)}</td>
                            <td className="delta">{formatValue(result.ctrlDelta)}</td>
                        </tr>
                        <tr className="treatment-row">
                            <td>{t('treatment')}</td>
                            <td>{formatValue(result.treatPre)}</td>
                            <td>{formatValue(result.treatPost)}</td>
                            <td className="delta">{formatValue(result.treatDelta)}</td>
                        </tr>
                        <tr className="did-row">
                            <td colSpan={3}>
                                {t('didEstimate')}
                                <HelpTooltip steps={t('helpDidEstimate') as unknown as string[]} title={helpTitle} />
                            </td>
                            <td className="did-value">{formatValue(result.estimate)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="steps-section">
                <h3>{t('stepByStep')}</h3>

                <div className="step">
                    <div className="step-number">1</div>
                    <div className="step-content">
                        <h4>{t('computeGroupMeans')}</h4>
                        <div className="step-result">
                            {t('control')}: {formatValue(result.ctrlPre)} → {formatValue(result.ctrlPost)}<br />
                            {t('treatment')}: {formatValue(result.treatPre)} → {formatValue(result.treatPost)}
                        </div>
                    </div>
                </div>

                <div className="step">
                    <div className="step-number">2</div>
                    <div className="step-content">
                        <h4>{t('computeDeltas')}</h4>
                        <div className="step-result">
                            {t('control')} Δ = {formatValue(result.ctrlPost)} - {formatValue(result.ctrlPre)} = <strong>{formatValue(result.ctrlDelta)}</strong><br />
                            {t('treatment')} Δ = {formatValue(result.treatPost)} - {formatValue(result.treatPre)} = <strong>{formatValue(result.treatDelta)}</strong>
                        </div>
                    </div>
                </div>

                <div className="step">
                    <div className="step-number">3</div>
                    <div className="step-content">
                        <h4>{t('computeDid')}</h4>
                        <div className="step-result">
                            DiD = {formatValue(result.treatDelta)} - {formatValue(result.ctrlDelta)} = <strong className="highlight">{formatValue(result.estimate)}</strong>
                        </div>
                        <p className="step-explain">{t('didRemovesTimeEffect')}</p>
                    </div>
                </div>
            </div>

            <div className="chart-section">
                <h3>{language === 'zh' ? `${metricLabel} 随时间变化` : `${metricLabel} Over Time`}</h3>
                <div className="chart-container">
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData} margin={{ top: 20, right: 30, bottom: 40, left: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis
                                dataKey="time"
                                stroke="rgba(255,255,255,0.5)"
                                tickFormatter={formatTime}
                                label={{ value: language === 'zh' ? '时间' : 'Time', position: 'bottom', fill: 'rgba(255,255,255,0.6)' }}
                            />
                            <YAxis
                                stroke="rgba(255,255,255,0.5)"
                                label={{ value: `${metricLabel} (${chartUnit})`, angle: -90, position: 'left', fill: 'rgba(255,255,255,0.6)' }}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: 'rgba(0,0,0,0.8)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: 'white'
                                }}
                                labelFormatter={(label) => formatTime(Number(label))}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <ReferenceLine
                                x={launchTime}
                                stroke="#f5576c"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                label={{ value: language === 'zh' ? '启动' : 'Launch', fill: '#f5576c', position: 'top' }}
                            />
                            <Line
                                type="monotone"
                                dataKey="Control"
                                name={t('control')}
                                stroke="#667eea"
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="Treatment"
                                name={t('treatment')}
                                stroke="#38ef7d"
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <p className="chart-explain">{t('ctrOverTimeExplain')}</p>
            </div>

            <div className="regression-section">
                <h3>{t('regressionInterpretation')}</h3>
                <div className="regression-formula">
                    Y = α + β₁×Treat + β₂×Post + β₃×(Treat×Post) + ε
                </div>
                <div className="regression-results">
                    <div className="reg-item">
                        <span className="reg-label">{t('intercept')}</span>
                        <span className="reg-value">{formatValue(regression.intercept)}</span>
                        <span className="reg-explain">{t('controlPreMean')}</span>
                    </div>
                    <div className="reg-item">
                        <span className="reg-label">{t('treatCoef')}</span>
                        <span className="reg-value">{formatValue(regression.treatCoef)}</span>
                        <span className="reg-explain">{t('baselineDiff')}</span>
                    </div>
                    <div className="reg-item">
                        <span className="reg-label">{t('postCoef')}</span>
                        <span className="reg-value">{formatValue(regression.postCoef)}</span>
                        <span className="reg-explain">{t('timeEffectControl')}</span>
                    </div>
                    <div className="reg-item highlight">
                        <span className="reg-label">{t('interaction')}</span>
                        <span className="reg-value">{formatValue(regression.interactionCoef)}</span>
                        <span className="reg-explain">{t('didEstimateLabel')}</span>
                    </div>
                </div>
            </div>

            <div className="main-result">
                <div className="effect-display">
                    <span className="effect-label">{t('didTreatmentEffect')}</span>
                    <span className={`effect-value ${result.estimate > 0 ? 'positive' : 'negative'}`}>
                        {result.estimate > 0 ? '+' : ''}{formatValue(result.estimate)}
                    </span>
                </div>

                <div className="stat-row">
                    <div className="stat-item">
                        <span className="stat-label">
                            {t('stdError')}
                            <HelpTooltip steps={t('helpStandardError') as unknown as string[]} title={helpTitle} />
                        </span>
                        <span className="stat-value">{formatValue(result.standardError, 3)}</span>
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
