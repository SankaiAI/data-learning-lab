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
    { id: 'samplesize' as TabType, label: t('tabSampleSize'), icon: '🧮' },
    { id: 'raw' as TabType, label: t('tabRaw'), icon: '📊' },
    { id: 'cuped' as TabType, label: t('tabCuped'), icon: '🎯' },
    { id: 'did' as TabType, label: t('tabDid'), icon: '📈' },
    { id: 'compare' as TabType, label: t('tabCompare'), icon: '⚖️' },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-top">
            <h1>{t('appTitle')}</h1>
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
            onExportJSON={simulation.exportJSON}
            onExportCSV={simulation.exportCSV}
          />
          <LiveStream
            events={simulation.events}
            metrics={simulation.metrics}
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
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="tab-content">
            {activeTab === 'samplesize' && (
              <SampleSizePanel />
            )}
            {activeTab === 'raw' && (
              <RawABPanel
                result={simulation.naiveResult}
                metrics={simulation.metrics}
                imbalanceCheck={simulation.imbalanceCheck}
              />
            )}
            {activeTab === 'cuped' && (
              <CupedPanel
                result={simulation.cupedResult}
                scatterData={simulation.cupedScatter}
              />
            )}
            {activeTab === 'did' && (
              <DidPanel
                result={simulation.didResult}
                timeSeries={simulation.timeSeries}
                launchTime={simulation.config.launchTime}
                parallelCheck={simulation.parallelCheck}
                regression={simulation.didRegression}
              />
            )}
            {activeTab === 'compare' && (
              <ComparePanel
                naiveResult={simulation.naiveResult}
                cupedResult={simulation.cupedResult}
                didResult={simulation.didResult}
                metrics={simulation.metrics}
                trueEffect={simulation.config.treatmentEffect}
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
