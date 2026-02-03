import type { SimulationEvent, AggregatedMetrics } from '../simulation/types';
import { useLanguage } from '../i18n';
import './LiveStream.css';

interface LiveStreamProps {
    events: SimulationEvent[];
    metrics: AggregatedMetrics;
}

export function LiveStream({ events, metrics }: LiveStreamProps) {
    const { t } = useLanguage();
    const formatNumber = (n: number) => n.toLocaleString();
    const formatPercent = (n: number) => (n * 100).toFixed(2) + '%';

    return (
        <div className="live-stream">
            <div className="panel-header">
                <h2>{t('liveStream')}</h2>
                <span className="event-count">{events.length} {t('events')}</span>
            </div>

            <div className="metrics-grid">
                <div className="metric-card control">
                    <div className="metric-label">{t('controlGroup')}</div>
                    <div className="metric-row">
                        <span>{t('prePeriod')}</span>
                        <span>{formatNumber(metrics.control.pre.clicks)}/{formatNumber(metrics.control.pre.impressions)}</span>
                        <span className="ctr">{formatPercent(metrics.control.pre.ctr)}</span>
                    </div>
                    <div className="metric-row">
                        <span>{t('postPeriod')}</span>
                        <span>{formatNumber(metrics.control.post.clicks)}/{formatNumber(metrics.control.post.impressions)}</span>
                        <span className="ctr">{formatPercent(metrics.control.post.ctr)}</span>
                    </div>
                </div>

                <div className="metric-card treatment">
                    <div className="metric-label">{t('treatmentGroup')}</div>
                    <div className="metric-row">
                        <span>{t('prePeriod')}</span>
                        <span>{formatNumber(metrics.treatment.pre.clicks)}/{formatNumber(metrics.treatment.pre.impressions)}</span>
                        <span className="ctr">{formatPercent(metrics.treatment.pre.ctr)}</span>
                    </div>
                    <div className="metric-row">
                        <span>{t('postPeriod')}</span>
                        <span>{formatNumber(metrics.treatment.post.clicks)}/{formatNumber(metrics.treatment.post.impressions)}</span>
                        <span className="ctr">{formatPercent(metrics.treatment.post.ctr)}</span>
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
                                {event.click ? t('click') : t('view')}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
