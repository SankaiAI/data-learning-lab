import type { SimulationEvent, AggregatedMetrics, MetricType } from '../simulation/types';
import { METRIC_CONFIGS } from '../simulation/types';
import { useLanguage } from '../i18n';
import './LiveStream.css';

interface LiveStreamProps {
    events: SimulationEvent[];
    metrics: AggregatedMetrics;
    metricType: MetricType;
    elapsedTime: number;
    launchTime: number;
    onExportCSV: () => void;
    onExportJSON: () => void;
}

export function LiveStream({ events, metrics, metricType, elapsedTime, launchTime, onExportCSV, onExportJSON }: LiveStreamProps) {
    const { t, language } = useLanguage();
    const config = METRIC_CONFIGS[metricType];
    const currentPeriod = elapsedTime >= launchTime ? 'post' : 'pre';

    const formatNumber = (n: number) => n.toLocaleString();


    // Format value based on metric type
    const formatValue = (n: number) => {
        if (config.unit === 'percent') {
            return (n * 100).toFixed(2) + '%';
        } else if (config.unit === 'currency') {
            const symbol = language === 'zh' ? '¥' : '$';
            return symbol + n.toFixed(2);
        } else {
            const unit = language === 'zh' ? '秒' : 's';
            return n.toFixed(1) + unit;
        }
    };

    // Get value to display in summary (CTR vs Mean)
    const getSummaryValue = (m: any) => config.isContinuous ? m.metricMean : m.ctr;



    return (
        <div className="live-stream">
            <div className="panel-header">
                <h2>{t('liveStream')}</h2>
                <div className="header-badges">
                    <span className={`period-indicator ${currentPeriod}`}>
                        {currentPeriod === 'pre' ? t('prePeriod') : t('postPeriod')}
                    </span>
                    <span className="event-count">{events.length} {t('events')}</span>
                </div>
            </div>

            <div className="metrics-grid">
                <div className="metric-card control">
                    <div className="metric-label">{t('controlGroup')}</div>
                    <div className="metric-row">
                        <span>{t('prePeriod')}</span>
                        <span>{formatNumber(metrics.control.pre.clicks)}/{formatNumber(metrics.control.pre.impressions)}</span>
                        <span className="ctr">{formatValue(getSummaryValue(metrics.control.pre))}</span>
                    </div>
                    <div className="metric-row">
                        <span>{t('postPeriod')}</span>
                        <span>{formatNumber(metrics.control.post.clicks)}/{formatNumber(metrics.control.post.impressions)}</span>
                        <span className="ctr">{formatValue(getSummaryValue(metrics.control.post))}</span>
                    </div>
                </div>

                <div className="metric-card treatment">
                    <div className="metric-label">{t('treatmentGroup')}</div>
                    <div className="metric-row">
                        <span>{t('prePeriod')}</span>
                        <span>{formatNumber(metrics.treatment.pre.clicks)}/{formatNumber(metrics.treatment.pre.impressions)}</span>
                        <span className="ctr">{formatValue(getSummaryValue(metrics.treatment.pre))}</span>
                    </div>
                    <div className="metric-row">
                        <span>{t('postPeriod')}</span>
                        <span>{formatNumber(metrics.treatment.post.clicks)}/{formatNumber(metrics.treatment.post.impressions)}</span>
                        <span className="ctr">{formatValue(getSummaryValue(metrics.treatment.post))}</span>
                    </div>
                </div>
            </div>

            <div className="event-log">
                <div className="log-header">
                    <span>{t('time')}</span>
                    <span>{t('user')}</span>
                    <span>{t('group')}</span>
                    <span>{t('period')}</span>
                    <span>{t('result')}</span>
                </div>
                <div className="log-body">
                    {events.map((event) => (
                        <div
                            key={event.id}
                            className={`log-row ${event.group} ${event.click ? 'clicked' : ''}`}
                        >
                            <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                            <span className="user-id">{event.userId.slice(0, 8)}</span>
                            <span className={`group-badge ${event.group}`}>
                                {event.group === 'control' ? 'C' : 'T'}
                            </span>
                            <span className={`period-badge ${event.period}`}>
                                {event.period === 'pre' ? t('prePeriod') : t('postPeriod')}
                            </span>
                            <span className="result">
                                {event.click ?
                                    (config.isContinuous ? formatValue(event.metricValue) : (metricType === 'conversion' ? t('converted') : t('click')))
                                    : t('view')}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="export-bar">
                <span className="export-label">Export Data:</span>
                <button className="btn-export" onClick={onExportCSV}>
                    {t('exportCSV')}
                </button>
                <button className="btn-export" onClick={onExportJSON}>
                    {t('exportJSON')}
                </button>
            </div>
        </div>
    );
}
