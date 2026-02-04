'use client'

import { useState, useEffect } from 'react'
import { mlflowApi } from '@/lib/api'
import { MLflowRun, MLflowArtifact } from '@/types'

export default function MLflowExplorer() {
  const [runs, setRuns] = useState<any[]>([])
  const [selectedRun, setSelectedRun] = useState<any | null>(null)
  const [artifacts, setArtifacts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'ci' | 'cd'>('all')
  const [champion, setChampion] = useState<any>(null)

  // Load runs on mount and when filter changes
  useEffect(() => {
    loadRuns()
    loadChampion()
  }, [filter])

  const loadRuns = async () => {
    setLoading(true)
    try {
      const stage = filter === 'all' ? undefined : filter
      const response = await mlflowApi.listRuns(stage)
      setRuns(response.runs || [])
    } catch (e) {
      console.error('Failed to load MLflow runs:', e)
      setRuns([])
    } finally {
      setLoading(false)
    }
  }

  const loadChampion = async () => {
    try {
      const response = await mlflowApi.getChampion()
      setChampion(response.champion)
    } catch (e) {
      console.error('Failed to load champion:', e)
    }
  }

  // Helper to get run ID (handles both snake_case and camelCase)
  const getRunId = (run: any) => run?.run_id || run?.runId || 'unknown'
  const getRunName = (run: any) => run?.run_name || run?.runName || ''
  const getStartTime = (run: any) => run?.start_time || run?.startTime || 0

  const selectRun = async (run: any) => {
    setSelectedRun(run)
    try {
      const response = await mlflowApi.listArtifacts(getRunId(run))
      setArtifacts(response.artifacts || [])
    } catch (e) {
      console.error('Failed to load artifacts:', e)
      setArtifacts([])
    }
  }

  const formatTimestamp = (ts: number) => {
    if (!ts) return 'N/A'
    return new Date(ts).toLocaleString()
  }

  return (
    <div className="h-full flex flex-col">
      {/* Filters and Refresh */}
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex space-x-2">
          {(['all', 'ci', 'cd'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-full ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          onClick={loadRuns}
          className="text-gray-400 hover:text-white"
          disabled={loading}
        >
          {loading ? (
            <span className="spinner w-4 h-4"></span>
          ) : (
            '↻ Refresh'
          )}
        </button>
      </div>

      {/* Champion Model Banner */}
      {champion && (
        <div className="p-3 bg-emerald-900/30 border-b border-emerald-700">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-emerald-400 font-medium">CHAMPION MODEL</span>
              <div className="text-sm text-white">{champion.name} v{champion.version}</div>
            </div>
            <span className="status-badge status-success">{champion.stage}</span>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Runs List */}
        <div className="w-1/2 border-r border-gray-700 overflow-auto">
          {runs.length === 0 ? (
            <div className="text-gray-500 text-center py-8 text-sm">
              {loading ? 'Loading runs...' : 'No MLflow runs found'}
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {runs.map((run: any) => (
                <div
                  key={getRunId(run) || Math.random()}
                  onClick={() => selectRun(run)}
                  className={`p-3 cursor-pointer hover:bg-gray-700/50 ${
                    getRunId(selectedRun) === getRunId(run) ? 'bg-gray-700' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white truncate">
                      {getRunName(run) || getRunId(run).slice(0, 8)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      run.status === 'FINISHED' ? 'bg-emerald-900 text-emerald-200' :
                      run.status === 'RUNNING' ? 'bg-blue-900 text-blue-200' :
                      run.status === 'FAILED' ? 'bg-red-900 text-red-200' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {run.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatTimestamp(getStartTime(run))}
                  </div>
                  {run.tags?.stage && (
                    <span className="text-xs text-blue-400">{run.tags.stage}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Run Details */}
        <div className="w-1/2 overflow-auto">
          {selectedRun ? (
            <div className="p-3 space-y-4">
              {/* Run Info */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Run Info</h4>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Run ID:</span>
                    <code className="text-blue-400">{getRunId(selectedRun).slice(0, 16)}...</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Started:</span>
                    <span className="text-gray-300">{formatTimestamp(getStartTime(selectedRun))}</span>
                  </div>
                  {selectedRun.tags?.commit_sha && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Commit:</span>
                      <code className="text-gray-300">{selectedRun.tags.commit_sha}</code>
                    </div>
                  )}
                </div>
              </div>

              {/* Parameters */}
              {Object.keys(selectedRun.params || {}).length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Parameters</h4>
                  <div className="bg-gray-800 rounded p-2 text-xs space-y-1">
                    {Object.entries(selectedRun.params).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-gray-500">{key}:</span>
                        <span className="text-gray-300">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metrics */}
              {Object.keys(selectedRun.metrics || {}).length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Metrics</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedRun.metrics).map(([key, value]) => (
                      <div key={key} className="bg-gray-800 rounded p-2">
                        <div className="text-xs text-gray-500">{key}</div>
                        <div className="text-sm font-semibold text-white">
                          {typeof value === 'number' ? value.toFixed(4) : value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Artifacts */}
              {artifacts.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Artifacts</h4>
                  <div className="space-y-1">
                    {artifacts.map((artifact: any) => (
                      <div
                        key={artifact.path}
                        className="flex items-center justify-between bg-gray-800 rounded p-2 text-xs"
                      >
                        <span className="text-gray-300">
                          {(artifact.is_dir || artifact.isDir) ? '📁' : '📄'} {artifact.path}
                        </span>
                        {!(artifact.is_dir || artifact.isDir) && (
                          <a
                            href={mlflowApi.getArtifactUrl(getRunId(selectedRun), artifact.path)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300"
                          >
                            View
                          </a>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Preview images */}
                  {artifacts.filter((a: any) => a.path.endsWith('.png')).map((img: any) => (
                    <div key={img.path} className="mt-2">
                      <div className="text-xs text-gray-500 mb-1">{img.path}</div>
                      <img
                        src={mlflowApi.getArtifactUrl(getRunId(selectedRun), img.path)}
                        alt={img.path}
                        className="max-w-full rounded border border-gray-700"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Tags */}
              {Object.keys(selectedRun.tags || {}).length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(selectedRun.tags)
                      .filter(([key]) => !key.startsWith('mlflow.'))
                      .map(([key, value]) => (
                        <span
                          key={key}
                          className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300"
                        >
                          {key}: {value}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 text-sm">
              Select a run to view details
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
