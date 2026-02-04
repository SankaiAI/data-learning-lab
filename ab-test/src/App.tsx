import { useState } from 'react';
import { LanguageProvider, useLanguage } from './i18n';
import { useSimulation } from './hooks/useSimulation';
import { ControlPanel } from './components/ControlPanel';
import { LiveStream } from './components/LiveStream';
import { RawABPanel } from './components/RawABPanel';
import { CupedPanel } from './components/CupedPanel';
import { DidPanel } from './components/DidPanel';
import { ComparePanel } from './components/ComparePanel';
import { SampleSizePanel } from './components/SampleSizePanel';
import { LanguageSwitch } from './components/LanguageSwitch';
import './App.css';

type TabType = 'samplesize' | 'raw' | 'cuped' | 'did' | 'compare';

function AppContent() {
  const simulation = useSimulation();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>('samplesize');

  const tabs = [
    { id: 'samplesize' as TabType, label: t('tabSampleSize') },
    { id: 'raw' as TabType, label: t('tabRaw') },
    { id: 'cuped' as TabType, label: t('tabCuped') },
    { id: 'did' as TabType, label: t('tabDid') },
    { id: 'compare' as TabType, label: t('tabCompare') },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-top">
            <h1>
              <svg className="lab-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3h6v4H9z" />
                <path d="M10 7v4l-5 8a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-8V7" />
              </svg>
              {t('appTitle')}
            </h1>
            <LanguageSwitch />
          </div>
          <p className="subtitle">{t('appSubtitle')}</p>
        </div>
      </header>

      <main className="app-main">
        <aside className="sidebar">
          <ControlPanel
            config={simulation.config}
            isRunning={simulation.isRunning}
            elapsedTime={simulation.elapsedTime}
            onUpdateConfig={simulation.updateConfig}
            onStart={simulation.start}
            onPause={simulation.pause}
            onReset={simulation.reset}
            onFastForward={simulation.fastForward}
          />
          <LiveStream
            events={simulation.events}
            metrics={simulation.metrics}
            metricType={simulation.config.metricType}
            elapsedTime={simulation.elapsedTime}
            launchTime={simulation.config.launchTime}
            onExportCSV={simulation.exportCSV}
            onExportJSON={simulation.exportJSON}
          />
        </aside>

        <section className="content">
          <nav className="tab-nav">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="tab-content">
            {activeTab === 'samplesize' && (
              <SampleSizePanel
                metricType={simulation.config.metricType}
                baselineValue={simulation.config.baselineValue}
              />
            )}
            {activeTab === 'raw' && (
              <RawABPanel
                result={simulation.naiveResult}
                metrics={simulation.metrics}
                imbalanceCheck={simulation.imbalanceCheck}
                metricType={simulation.config.metricType}
              />
            )}
            {activeTab === 'cuped' && (
              <CupedPanel
                result={simulation.cupedResult}
                scatterData={simulation.cupedScatter}
                metricType={simulation.config.metricType}
              />
            )}
            {activeTab === 'did' && (
              <DidPanel
                result={simulation.didResult}
                timeSeries={simulation.timeSeries}
                launchTime={simulation.config.launchTime}
                parallelCheck={simulation.parallelCheck}
                regression={simulation.didRegression}
                metricType={simulation.config.metricType}
              />
            )}
            {activeTab === 'compare' && (
              <ComparePanel
                naiveResult={simulation.naiveResult}
                cupedResult={simulation.cupedResult}
                didResult={simulation.didResult}
                metrics={simulation.metrics}
                trueEffect={simulation.config.treatmentEffect}
                metricType={simulation.config.metricType}
              />
            )}
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <p>{t('footerText')}</p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;
