'use client'

import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { pipelineApi, failuresApi } from '@/lib/api'
import { FailureMode } from '@/types'

export default function Header() {
  const {
    currentRunId,
    pendingApproval,
    steps,
    setCurrentRunId,
    setPendingApproval,
    resetPipeline,
    addLog
  } = useStore()

  const [loading, setLoading] = useState(false)
  const [showFailureModes, setShowFailureModes] = useState(false)
  const [failureModes, setFailureModes] = useState<Record<string, FailureMode>>({})
  const [pipelineStatus, setPipelineStatus] = useState<string>('')

  // Load failure modes
  useEffect(() => {
    loadFailureModes()
  }, [])

  // Poll pipeline status
  useEffect(() => {
    if (!currentRunId) return

    const interval = setInterval(async () => {
      try {
        const status = await pipelineApi.getStatus(currentRunId)
        setPipelineStatus(status.status)

        // Check for pending approval
        if (status.pending_approval) {
          setPendingApproval(true)
        }
      } catch (e) {
        // Ignore errors during polling
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [currentRunId, setPendingApproval])

  const loadFailureModes = async () => {
    try {
      const response = await failuresApi.list()
      setFailureModes(response.failure_modes)
    } catch (e) {
      console.error('Failed to load failure modes:', e)
    }
  }

  const handleFakeCommit = async () => {
    setLoading(true)
    resetPipeline()

    try {
      const result = await pipelineApi.fakeCommit()
      setCurrentRunId(result.run_id)
      addLog({
        type: 'log',
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Started pipeline for commit ${result.commit_sha}`
      })
    } catch (e) {
      console.error('Failed to start pipeline:', e)
      addLog({
        type: 'log',
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Failed to start pipeline'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleContinueCD = async () => {
    if (!currentRunId) return
    setLoading(true)

    try {
      await pipelineApi.continue(currentRunId, 'cd')
      addLog({
        type: 'log',
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Continuing to CD stage...'
      })
    } catch (e) {
      console.error('Failed to continue:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!currentRunId) return
    setLoading(true)

    try {
      await pipelineApi.approve(currentRunId)
      setPendingApproval(false)
      addLog({
        type: 'log',
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Approved! Continuing to deployment...'
      })
    } catch (e) {
      console.error('Failed to approve:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!currentRunId) return
    setLoading(true)

    try {
      await pipelineApi.reject(currentRunId, 'Rejected by user')
      setPendingApproval(false)
      addLog({
        type: 'log',
        timestamp: new Date().toISOString(),
        level: 'warning',
        message: 'Pipeline rejected'
      })
    } catch (e) {
      console.error('Failed to reject:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleRollback = async () => {
    setLoading(true)

    try {
      const result = await pipelineApi.rollback()
      addLog({
        type: 'log',
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Rolled back from ${result.from_version} to ${result.to_version}`
      })
    } catch (e) {
      console.error('Failed to rollback:', e)
      addLog({
        type: 'log',
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Rollback failed'
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleFailureMode = async (modeId: string) => {
    try {
      await failuresApi.toggle(modeId)
      await loadFailureModes()
    } catch (e) {
      console.error('Failed to toggle failure mode:', e)
    }
  }

  // Determine if we can continue to CD
  const ciComplete = pipelineStatus === 'ci_complete'
  const cdComplete = pipelineStatus === 'cd_complete'

  return (
    <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Logo and Title */}
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-white">
            Claim ML CI/CD Lab
          </h1>
          {currentRunId && (
            <span className="text-sm text-gray-400">
              Run: <code className="text-blue-400">{currentRunId}</code>
            </span>
          )}
          {pipelineStatus && (
            <span className={`status-badge ${
              pipelineStatus === 'running' ? 'status-running' :
              pipelineStatus === 'ci_complete' || pipelineStatus === 'cd_complete' ? 'status-success' :
              pipelineStatus === 'failed' || pipelineStatus === 'rejected' ? 'status-failed' :
              'status-idle'
            }`}>
              {pipelineStatus.replace('_', ' ')}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-3">
          {/* Failure Modes Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowFailureModes(!showFailureModes)}
              className="btn btn-secondary btn-sm"
            >
              Failure Modes
            </button>

            {showFailureModes && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
                <div className="p-3 border-b border-gray-700">
                  <h3 className="text-sm font-semibold">Toggle Failure Scenarios</h3>
                </div>
                <div className="p-2">
                  {Object.entries(failureModes).map(([id, mode]) => (
                    <label key={id} className="flex items-center p-2 hover:bg-gray-700 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={mode.enabled}
                        onChange={() => toggleFailureMode(id)}
                        className="mr-3"
                      />
                      <div>
                        <div className="text-sm font-medium">{mode.name}</div>
                        <div className="text-xs text-gray-400">{mode.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Approval Buttons */}
          {pendingApproval && (
            <>
              <button
                onClick={handleApprove}
                disabled={loading}
                className="btn btn-success btn-sm"
              >
                ✓ Approve
              </button>
              <button
                onClick={handleReject}
                disabled={loading}
                className="btn btn-danger btn-sm"
              >
                ✗ Reject
              </button>
            </>
          )}

          {/* Continue to CD */}
          {ciComplete && !pendingApproval && (
            <button
              onClick={handleContinueCD}
              disabled={loading}
              className="btn btn-primary btn-sm"
            >
              Continue to CD →
            </button>
          )}

          {/* Rollback */}
          <button
            onClick={handleRollback}
            disabled={loading}
            className="btn btn-danger btn-sm"
          >
            Rollback
          </button>

          {/* Fake Commit */}
          <button
            onClick={handleFakeCommit}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? (
              <>
                <span className="spinner w-4 h-4 mr-2"></span>
                Running...
              </>
            ) : (
              '+ Fake Commit'
            )}
          </button>

          {/* MLflow Link */}
          <a
            href={process.env.NEXT_PUBLIC_MLFLOW_URL || 'http://localhost:5000'}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
          >
            MLflow UI ↗
          </a>
        </div>
      </div>
    </header>
  )
}
