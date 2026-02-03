import type { SimulationConfig, MetricType } from '../simulation/types';
import { METRIC_CONFIGS } from '../simulation/types';
import { useLanguage } from '../i18n';
import { HelpTooltip } from './Tooltip';
import './ControlPanel.css';

interface ControlPanelProps {
    config: SimulationConfig;
    isRunning: boolean;
    elapsedTime: number;
    onUpdateConfig: (updates: Partial<SimulationConfig>) => void;
    onStart: () => void;
    onPause: () => void;
    onReset: () => void;
    onExportJSON: () => void;
    onExportCSV: () => void;
}

// Helper to format baseline value based on metric type
function formatBaselineValue(value: number, metricType: MetricType, language: string): string {
    const config = METRIC_CONFIGS[metricType];
    const currencySymbol = language === 'zh' ? '¥' : '$';
    const timeUnit = language === 'zh' ? '秒' : 's';

    switch (config.unit) {
        case 'percent':
            return `${(value * 100).toFixed(1)}%`;
        case 'currency':
            return `${currencySymbol}${value.toFixed(2)}`;
        case 'time':
            return `${value.toFixed(0)}${timeUnit}`;
        default:
            return value.toFixed(2);
    }
}

export function ControlPanel({
    config,
    isRunning,
    elapsedTime,
    onUpdateConfig,
    onStart,
    onPause,
    onReset,
    onExportJSON,
    onExportCSV,
}: ControlPanelProps) {
    const { t, language } = useLanguage();
    const helpTitle = language === 'zh' ? t('helpTitleZh') : t('helpTitle');
    const isPrePeriod = elapsedTime < config.launchTime;
    const metricConfig = METRIC_CONFIGS[config.metricType];

    const handleMetricChange = (newMetricType: MetricType) => {
        const newMetricConfig = METRIC_CONFIGS[newMetricType];
        onUpdateConfig({
            metricType: newMetricType,
            baselineValue: newMetricConfig.baselineValue
        });
    };

    return (
        <div className="control-panel">
            <div className="panel-header">
                <h2>{t('simulatorControls')}</h2>
                <div className="time-display">
                    <span className={`period-badge ${isPrePeriod ? 'pre' : 'post'}`}>
                        {isPrePeriod ? t('prePeriod') : t('postPeriod')}
                    </span>
                    {isPrePeriod && isRunning && (
                        <span style={{ fontSize: '0.8rem', color: '#a8edea', fontWeight: 'bold' }}>
                            T-{Math.ceil(config.launchTime - elapsedTime)}s
                        </span>
                    )}
                    <span className="elapsed-time">{elapsedTime.toFixed(1)}s</span>
                </div>
            </div>

            <div className="control-buttons">
                {!isRunning ? (
                    <button className="btn btn-primary" onClick={onStart}>
                        {t('start')}
                    </button>
                ) : (
                    <button className="btn btn-warning" onClick={onPause}>
                        {t('pause')}
                    </button>
                )}
                <button className="btn btn-secondary" onClick={onReset}>
                    {t('reset')}
                </button>
                <button className="btn btn-outline" onClick={onExportCSV}>
                    {t('exportCSV')}
                </button>
                <button className="btn btn-outline" onClick={onExportJSON}>
                    {t('exportJSON')}
                </button>
            </div>

            <div className="control-section metric-selector-section">
                <h3>{t('metricSelector')}</h3>
                <div className="metric-selector">
                    <select
                        value={config.metricType}
                        onChange={(e) => handleMetricChange(e.target.value as MetricType)}
                        disabled={isRunning}
                        className="metric-dropdown"
                    >
                        <option value="ctr">{t('metricCTR')}</option>
                        <option value="conversion">{t('metricConversion')}</option>
                        <option value="revenue">{t('metricRevenue')}</option>
                        <option value="duration">{t('metricDuration')}</option>
                    </select>
                </div>
                <p className="hint">{t('metricSelectorDesc')}</p>

                <div className="slider-group">
                    <label>
                        {t('baselineValue')}: <strong>{formatBaselineValue(config.baselineValue, config.metricType, language)}</strong>
                    </label>
                    <input
                        type="range"
                        min={metricConfig.minValue}
                        max={metricConfig.maxValue}
                        step={metricConfig.step}
                        value={config.baselineValue}
                        onChange={(e) => onUpdateConfig({ baselineValue: parseFloat(e.target.value) })}
                        disabled={isRunning}
                    />
                </div>
            </div>

            <div className="control-section">
                <h3>{t('treatmentSettings')}</h3>

                <div className="slider-group">
                    <label>
                        {t('treatmentEffect')}: <strong>{(config.treatmentEffect * 100).toFixed(1)}%</strong> {t('lift')}
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="0.2"
                        step="0.01"
                        value={config.treatmentEffect}
                        onChange={(e) => onUpdateConfig({ treatmentEffect: parseFloat(e.target.value) })}
                    />
                    <p className="hint">{t('treatmentEffectHint')}</p>
                </div>

                <div className="slider-group">
                    <label>
                        {t('baselineImbalance')}: <strong>{(config.baselineImbalance * 100).toFixed(1)}%</strong>
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="0.3"
                        step="0.01"
                        value={config.baselineImbalance}
                        onChange={(e) => onUpdateConfig({ baselineImbalance: parseFloat(e.target.value) })}
                    />
                    <p className="hint">{t('baselineImbalanceHint')}</p>
                </div>
            </div>

            <div className="control-section">
                <h3>{t('timeEffects')}</h3>

                <div className="slider-group">
                    <label>
                        {t('timeTrend')}: <strong>{(config.timeTrendStrength * 100).toFixed(1)}%</strong> {t('perMinute')}
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="0.5"
                        step="0.01"
                        value={config.timeTrendStrength}
                        onChange={(e) => onUpdateConfig({ timeTrendStrength: parseFloat(e.target.value) })}
                    />
                    <p className="hint">{t('timeTrendHint')}</p>
                </div>

                <div className="slider-group">
                    <label>
                        {t('launchTime')}: <strong>{config.launchTime}s</strong>
                    </label>
                    <input
                        type="range"
                        min="10"
                        max="60"
                        step="5"
                        value={config.launchTime}
                        onChange={(e) => onUpdateConfig({ launchTime: parseFloat(e.target.value) })}
                        disabled={isRunning}
                    />
                    <p className="hint">{t('launchTimeHint')}</p>
                </div>
            </div>

            <div className="control-section">
                <h3>{t('simulationSettings')}</h3>

                <div className="slider-group">
                    <label>
                        {t('eventsPerSecond')}
                        <HelpTooltip steps={t('helpEventsPerSecond') as unknown as string[]} title={helpTitle} />
                        <strong>{config.eventsPerSecond}</strong>
                    </label>
                    <input
                        type="range"
                        min="5"
                        max="30"
                        step="1"
                        value={config.eventsPerSecond}
                        onChange={(e) => onUpdateConfig({ eventsPerSecond: parseFloat(e.target.value) })}
                    />
                    <p className="hint">{t('eventsPerSecondDesc')}</p>
                </div>

                <div className="slider-group">
                    <label>
                        {t('noiseLevel')}
                        <HelpTooltip steps={t('helpNoiseLevel') as unknown as string[]} title={helpTitle} />
                        <strong>{config.noiseLevel.toFixed(1)}x</strong>
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="3"
                        step="0.1"
                        value={config.noiseLevel}
                        onChange={(e) => onUpdateConfig({ noiseLevel: parseFloat(e.target.value) })}
                    />
                    <p className="hint">{t('noiseLevelDesc')}</p>
                </div>

                <div className="slider-group">
                    <label>
                        {t('totalUsers')}
                        <HelpTooltip steps={t('helpTotalUsers') as unknown as string[]} title={helpTitle} />
                        <strong>{config.totalUsers}</strong>
                    </label>
                    <input
                        type="range"
                        min="50"
                        max="500"
                        step="10"
                        value={config.totalUsers}
                        onChange={(e) => onUpdateConfig({ totalUsers: parseFloat(e.target.value) })}
                        disabled={isRunning}
                    />
                    <p className="hint">{t('totalUsersDesc')}</p>
                </div>
            </div>
        </div>
    );
}
