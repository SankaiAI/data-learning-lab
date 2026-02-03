import type { SimulationConfig } from '../simulation/types';
import { useLanguage } from '../i18n';
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
    const { t } = useLanguage();
    const isPrePeriod = elapsedTime < config.launchTime;

    return (
        <div className="control-panel">
            <div className="panel-header">
                <h2>{t('simulatorControls')}</h2>
                <div className="time-display">
                    <span className={`period-badge ${isPrePeriod ? 'pre' : 'post'}`}>
                        {isPrePeriod ? t('prePeriod') : t('postPeriod')}
                    </span>
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
                        {t('eventsPerSecond')}: <strong>{config.eventsPerSecond}</strong>
                    </label>
                    <input
                        type="range"
                        min="5"
                        max="30"
                        step="1"
                        value={config.eventsPerSecond}
                        onChange={(e) => onUpdateConfig({ eventsPerSecond: parseFloat(e.target.value) })}
                    />
                </div>

                <div className="slider-group">
                    <label>
                        {t('noiseLevel')}: <strong>{config.noiseLevel.toFixed(1)}x</strong>
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="3"
                        step="0.1"
                        value={config.noiseLevel}
                        onChange={(e) => onUpdateConfig({ noiseLevel: parseFloat(e.target.value) })}
                    />
                </div>

                <div className="slider-group">
                    <label>
                        {t('totalUsers')}: <strong>{config.totalUsers}</strong>
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
                </div>
            </div>
        </div>
    );
}
