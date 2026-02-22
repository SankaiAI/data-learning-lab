import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import type { CupedResult, MetricType } from '../simulation/types';
import { METRIC_CONFIGS } from '../simulation/types';
import { useLanguage } from '../i18n';
import { HelpTooltip } from './Tooltip';
import './CupedPanel.css';

interface CupedPanelProps {
    result: CupedResult;
    scatterData: {
        control: Array<{ x: number; y: number }>;
        treatment: Array<{ x: number; y: number }>;
    };
    metricType: MetricType;
}

export function CupedPanel({ result, scatterData, metricType }: CupedPanelProps) {
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

    const formatPValue = (p: number) => {
        if (p < 0.001) return '< 0.001';
        return p.toFixed(4);
    };

    // Scale data for display based on metric type
    const controlData = config.unit === 'percent'
        ? scatterData.control.map(p => ({ x: p.x * 100, y: p.y * 100 }))
        : scatterData.control;
    const treatmentData = config.unit === 'percent'
        ? scatterData.treatment.map(p => ({ x: p.x * 100, y: p.y * 100 }))
        : scatterData.treatment;
    const helpTitle = language === 'zh' ? t('helpTitleZh') : t('helpTitle');
    const chartUnit = config.unit === 'percent' ? '%' : (config.unit === 'currency' ? '$' : 's');

    return (
        <div className="cuped-panel analysis-panel">
            <div className="panel-header">
                <h2>{t('cupedWalkthrough')}</h2>
                <span className="panel-subtitle">{t('cupedSubtitle')}</span>
            </div>

            <div className="explanation-box">
                <h4>{t('whatIsCuped')}</h4>
                <p>{t('cupedExplanation')}</p>
                <div className="formula">
                    Y<sub>adj</sub> = Y - θ × (X - X̄)
                </div>
                <p>Where X is pre-period {metricLabel}, Y is post-period {metricLabel}, and θ = Cov(Y,X) / Var(X)</p>
            </div>

            <div className="steps-section">
                <h3>{t('stepByStep')}</h3>

                <div className="step">
                    <div className="step-number">1</div>
                    <div className="step-content">
                        <h4>{t('step1Title')}</h4>
                        <p>{t('step1Desc')}</p>
                    </div>
                </div>

                <div className="step">
                    <div className="step-number">2</div>
                    <div className="step-content">
                        <h4>{t('step2Title')}</h4>
                        <p>{t('step2Desc')}</p>
                    </div>
                </div>

                <div className="step">
                    <div className="step-number">3</div>
                    <div className="step-content">
                        <h4>{t('step3Title')}</h4>
                        <div className="step-result">
                            θ = Cov(Y, X) / Var(X) = <strong>{result.theta.toFixed(4)}</strong>
                        </div>
                        <p className="step-explain">{t('step3Explain')}</p>
                    </div>
                </div>

                <div className="step">
                    <div className="step-number">4</div>
                    <div className="step-content">
                        <h4>{t('step4Title')}</h4>
                        <p>Y<sub>adj</sub> = Y - {result.theta.toFixed(4)} × (X - X̄)</p>
                    </div>
                </div>
            </div>


            <div className="scatter-section">
                <h3>{language === 'zh' ? `前后期 ${metricLabel} 对比` : `Pre vs Post ${metricLabel}`}</h3>
                <div className="chart-container">
                    {controlData.length === 0 && treatmentData.length === 0 ? (
                        <div className="empty-chart-message">
                            <span className="empty-icon">—</span>
                            <p>{t('noScatterData')}</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={320}>
                            <ScatterChart margin={{ top: 30, right: 20, bottom: 50, left: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis
                                    type="number"
                                    dataKey="x"
                                    name={`Pre-period ${metricLabel}`}
                                    unit={chartUnit}
                                    stroke="rgba(255,255,255,0.5)"
                                    label={{ value: `Pre-period ${metricLabel} (${chartUnit})`, position: 'insideBottom', offset: -10, fill: 'rgba(255,255,255,0.6)' }}
                                />
                                <YAxis
                                    type="number"
                                    dataKey="y"
                                    name={`Post-period ${metricLabel}`}
                                    unit={chartUnit}
                                    stroke="rgba(255,255,255,0.5)"
                                    label={{ value: `Post-period ${metricLabel} (${chartUnit})`, angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.6)' }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(0,0,0,0.9)',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        borderRadius: '8px',
                                        color: 'white'
                                    }}
                                    itemStyle={{ color: 'white' }}
                                    labelStyle={{ color: 'white', fontWeight: 'bold', marginBottom: '4px' }}
                                    formatter={(value?: number) => value !== undefined ? `${value.toFixed(2)}${chartUnit}` : ''}
                                />
                                <Legend verticalAlign="top" height={36} />
                                <ZAxis type="number" range={[60, 60]} />
                                <Scatter
                                    name={t('control')}
                                    data={controlData}
                                    fill="#667eea"
                                    fillOpacity={0.8}
                                    isAnimationActive={false}
                                />
                                <Scatter
                                    name={t('treatment')}
                                    data={treatmentData}
                                    fill="#38ef7d"
                                    fillOpacity={0.8}
                                    isAnimationActive={false}
                                />
                                <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                                <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" />
                            </ScatterChart>
                        </ResponsiveContainer>
                    )}
                </div>
                <p className="chart-explain">{t('scatterExplain')}</p>
            </div>

            <div className="variance-section">
                <h3>
                    {t('varianceReduction')}
                    <HelpTooltip steps={t('helpVarianceReduction') as unknown as string[]} title={helpTitle} />
                </h3>
                <div className="variance-comparison">
                    <div className="variance-card before">
                        <div className="variance-label">{t('before')}</div>
                        <div className="variance-value">{(result.varianceBefore * 10000).toFixed(4)}</div>
                    </div>
                    <div className="variance-arrow">→</div>
                    <div className="variance-card after">
                        <div className="variance-label">{t('after')}</div>
                        <div className="variance-value">{(result.varianceAfter * 10000).toFixed(4)}</div>
                    </div>
                    <div className="variance-reduction">
                        <span className="reduction-value">
                            {(result.varianceReduction * 100).toFixed(1)}% {t('reduction')}
                        </span>
                        <span className="reduction-explain">{t('inVariance')}</span>
                    </div>
                </div>
                <p className="power-note">{t('powerNote')}</p>
            </div>

            <div className="main-result">
                <div className="effect-display">
                    <span className="effect-label">{t('cupedAdjustedEffect')}</span>
                    <span className={`effect-value ${result.estimate > 0 ? 'positive' : 'negative'}`}>
                        {result.estimate > 0 ? '+' : ''}{formatValue(result.estimate)}
                    </span>
                </div>

                <div className="stat-row">
                    <div className="stat-item">
                        <span className="stat-label">
                            {t('theta')}
                            <HelpTooltip steps={t('helpTheta') as unknown as string[]} title={helpTitle} />
                        </span>
                        <span className="stat-value">{result.theta.toFixed(4)}</span>
                    </div>
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
