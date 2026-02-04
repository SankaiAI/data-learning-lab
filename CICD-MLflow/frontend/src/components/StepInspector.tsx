'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useStore } from '@/lib/store'
import { stepsApi } from '@/lib/api'

// Dynamically import Monaco Editor (client-side only)
const MonacoEditor = dynamic(
  () => import('@monaco-editor/react'),
  { ssr: false }
)

type TabType = 'code' | 'config' | 'logs' | 'outputs'

export default function StepInspector() {
  const { selectedStep, steps, logs } = useStore()
  const [activeTab, setActiveTab] = useState<TabType>('code')
  const [code, setCode] = useState<string>('')
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)

  const step = selectedStep ? steps[selectedStep] : null

  // Load code and config when step changes
  useEffect(() => {
    if (!selectedStep) return

    const loadStepData = async () => {
      setLoading(true)
      try {
        const [codeData, configData] = await Promise.all([
          stepsApi.getCode(selectedStep),
          stepsApi.getConfig(selectedStep)
        ])
        setCode(codeData)
        setConfig(configData)
      } catch (e) {
        console.error('Failed to load step data:', e)
        setCode('# Code not available')
        setConfig({ error: 'Config not available' })
      } finally {
        setLoading(false)
      }
    }

    loadStepData()
  }, [selectedStep])

  // Auto-scroll logs
  useEffect(() => {
    if (activeTab === 'logs') {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, activeTab])

  if (!selectedStep || !step) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">←</div>
          <div>Select a step from the pipeline graph</div>
        </div>
      </div>
    )
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'code', label: 'Code' },
    { id: 'config', label: 'Config' },
    { id: 'logs', label: 'Logs' },
    { id: 'outputs', label: 'Outputs' }
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Step Info */}
      <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-200">{step.displayName}</h3>
            <p className="text-sm text-gray-400">{step.description}</p>
          </div>
          <span className={`status-badge status-${step.status.replace('_', '-')}`}>
            {step.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-button ${
              activeTab === tab.id ? 'tab-button-active' : 'tab-button-inactive'
            }`}
          >
            {tab.label}
            {tab.id === 'logs' && logs.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-900 text-blue-200 rounded-full">
                {logs.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="spinner w-8 h-8"></div>
          </div>
        ) : (
          <>
            {/* Code Tab */}
            {activeTab === 'code' && (
              <div className="h-full">
                <MonacoEditor
                  height="100%"
                  language="python"
                  theme="vs-dark"
                  value={code}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: 'on'
                  }}
                />
              </div>
            )}

            {/* Config Tab */}
            {activeTab === 'config' && (
              <div className="h-full">
                <MonacoEditor
                  height="100%"
                  language="yaml"
                  theme="vs-dark"
                  value={config ? JSON.stringify(config, null, 2) : ''}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'off',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: 'on'
                  }}
                />
              </div>
            )}

            {/* Logs Tab */}
            {activeTab === 'logs' && (
              <div className="h-full overflow-auto bg-gray-900 p-2 log-stream">
                {logs.length === 0 ? (
                  <div className="text-gray-500 text-center py-8">
                    No logs yet. Start a pipeline to see logs.
                  </div>
                ) : (
                  logs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`log-line log-${log.level}`}
                    >
                      <span className="text-gray-500 mr-2">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`mr-2 uppercase text-xs font-medium ${
                        log.level === 'error' ? 'text-red-400' :
                        log.level === 'warning' ? 'text-amber-400' :
                        log.level === 'debug' ? 'text-gray-500' :
                        'text-blue-400'
                      }`}>
                        [{log.level}]
                      </span>
                      <span>{log.message}</span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            )}

            {/* Outputs Tab */}
            {activeTab === 'outputs' && (
              <div className="h-full overflow-auto p-4">
                {step.outputs ? (
                  <div className="space-y-4">
                    {/* Metrics */}
                    {step.outputs.metrics && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-300 mb-2">Metrics</h4>
                        <div className="grid grid-cols-3 gap-3">
                          {Object.entries(step.outputs.metrics).map(([key, value]) => (
                            <div key={key} className="bg-gray-800 rounded p-3">
                              <div className="text-xs text-gray-400 uppercase">{key}</div>
                              <div className="text-lg font-semibold text-white">
                                {typeof value === 'number' ? value.toFixed(4) : String(value)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Champion vs Challenger */}
                    {step.outputs.challenger_metrics && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-300 mb-2">Model Comparison</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-emerald-900/30 border border-emerald-700 rounded p-3">
                            <div className="text-xs text-emerald-400 mb-1">Challenger</div>
                            {Object.entries(step.outputs.challenger_metrics).map(([k, v]) => (
                              <div key={k} className="flex justify-between text-sm">
                                <span className="text-gray-400">{k}:</span>
                                <span className="text-white">{typeof v === 'number' ? (v as number).toFixed(4) : String(v)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="bg-gray-800 border border-gray-700 rounded p-3">
                            <div className="text-xs text-gray-400 mb-1">Champion</div>
                            {step.outputs.champion_metrics && Object.entries(step.outputs.champion_metrics).map(([k, v]) => (
                              <div key={k} className="flex justify-between text-sm">
                                <span className="text-gray-400">{k}:</span>
                                <span className="text-white">{typeof v === 'number' ? (v as number).toFixed(4) : String(v)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {step.outputs.challenger_wins !== undefined && (
                          <div className={`mt-2 p-2 rounded text-center text-sm ${
                            step.outputs.challenger_wins
                              ? 'bg-emerald-900/30 text-emerald-400'
                              : 'bg-red-900/30 text-red-400'
                          }`}>
                            {step.outputs.challenger_wins
                              ? `✓ Challenger wins by ${step.outputs.improvement_pct?.toFixed(2)}%`
                              : '✗ Challenger does not beat champion'
                            }
                          </div>
                        )}
                      </div>
                    )}

                    {/* MLflow Run ID */}
                    {step.outputs.mlflow_run_id && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-300 mb-2">MLflow</h4>
                        <div className="bg-gray-800 rounded p-3">
                          <div className="text-xs text-gray-400">Run ID</div>
                          <code className="text-blue-400">{step.outputs.mlflow_run_id}</code>
                        </div>
                      </div>
                    )}

                    {/* Deployment Info */}
                    {step.outputs.environment && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-300 mb-2">Deployment</h4>
                        <div className="bg-gray-800 rounded p-3 space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Environment:</span>
                            <span className="text-emerald-400">{step.outputs.environment}</span>
                          </div>
                          {step.outputs.model_version && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Version:</span>
                              <span className="text-white">{step.outputs.model_version}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Shadow/Drift Monitoring */}
                    {step.outputs.drift_metrics && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-300 mb-2">Drift Monitoring</h4>
                        <div className={`p-3 rounded ${
                          step.outputs.drift_detected
                            ? 'bg-red-900/30 border border-red-700'
                            : 'bg-emerald-900/30 border border-emerald-700'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm">Drift Status</span>
                            <span className={step.outputs.drift_detected ? 'text-red-400' : 'text-emerald-400'}>
                              {step.outputs.drift_detected ? 'DETECTED' : 'NOT DETECTED'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-400">
                            Mean PSI: {step.outputs.drift_metrics.mean_psi?.toFixed(4)}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Generic outputs */}
                    {!step.outputs.metrics && !step.outputs.challenger_metrics && (
                      <pre className="bg-gray-800 rounded p-3 text-sm overflow-auto">
                        {JSON.stringify(step.outputs, null, 2)}
                      </pre>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-8">
                    No outputs yet. Run this step to see outputs.
                  </div>
                )}

                {/* Error display */}
                {step.error && (
                  <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded">
                    <div className="text-sm font-semibold text-red-400 mb-1">Error</div>
                    <div className="text-sm text-red-300">{step.error}</div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
