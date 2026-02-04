'use client'

import { useState, useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'
import { claimsApi } from '@/lib/api'
import { Claim } from '@/types'

export default function ClaimsStream() {
  const {
    claims,
    driftMetrics,
    claimsStreamActive,
    addClaim,
    setDriftMetrics,
    setClaimsStreamActive
  } = useStore()

  const [wsConnected, setWsConnected] = useState(false)
  const [streamInterval, setStreamInterval] = useState(1000)
  const wsRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<HTMLDivElement>(null)

  // Connect to claims WebSocket
  const connectWebSocket = () => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'
    const ws = new WebSocket(`${wsUrl}/ws/claims`)

    ws.onopen = () => {
      setWsConnected(true)
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)

        if (message.type === 'claim') {
          addClaim(message.data)
        } else if (message.type === 'drift') {
          setDriftMetrics(message.data)
        }
      } catch (e) {
        console.error('Claims WS message error:', e)
      }
    }

    ws.onclose = () => {
      setWsConnected(false)
    }

    ws.onerror = (error) => {
      console.error('Claims WS error:', error)
      setWsConnected(false)
    }

    wsRef.current = ws
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  // Auto-scroll stream
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollLeft = streamRef.current.scrollWidth
    }
  }, [claims])

  const startStream = async () => {
    try {
      await claimsApi.startStream(streamInterval)
      connectWebSocket()
      setClaimsStreamActive(true)
    } catch (e) {
      console.error('Failed to start stream:', e)
    }
  }

  const stopStream = async () => {
    try {
      await claimsApi.stopStream()
      if (wsRef.current) {
        wsRef.current.close()
      }
      setClaimsStreamActive(false)
    } catch (e) {
      console.error('Failed to stop stream:', e)
    }
  }

  // Calculate drift level for meter
  const getDriftLevel = () => {
    if (!driftMetrics) return { level: 'low', percentage: 0 }

    const psi = driftMetrics.psi
    if (psi < 0.1) return { level: 'low', percentage: psi * 500 }
    if (psi < 0.2) return { level: 'medium', percentage: psi * 400 }
    return { level: 'high', percentage: Math.min(psi * 300, 100) }
  }

  const driftLevel = getDriftLevel()

  return (
    <div className="h-full flex">
      {/* Claims Stream (left) */}
      <div className="flex-1 flex flex-col border-r border-gray-700">
        {/* Stream Controls */}
        <div className="p-2 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400">Live Claims Feed</span>
            <span className={`w-2 h-2 rounded-full ${
              claimsStreamActive && wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
            }`} />
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={streamInterval}
              onChange={(e) => setStreamInterval(Number(e.target.value))}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
              disabled={claimsStreamActive}
            >
              <option value={500}>500ms</option>
              <option value={1000}>1s</option>
              <option value={2000}>2s</option>
              <option value={5000}>5s</option>
            </select>
            {claimsStreamActive ? (
              <button
                onClick={stopStream}
                className="btn btn-danger btn-sm text-xs"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={startStream}
                className="btn btn-success btn-sm text-xs"
              >
                Start Stream
              </button>
            )}
          </div>
        </div>

        {/* Claims Cards */}
        <div
          ref={streamRef}
          className="flex-1 overflow-x-auto overflow-y-hidden p-2 flex items-center space-x-2"
        >
          {claims.length === 0 ? (
            <div className="text-gray-500 text-sm w-full text-center">
              Click "Start Stream" to see live claims
            </div>
          ) : (
            claims.map((claim, idx) => (
              <ClaimCard key={`${claim.claimId}-${idx}`} claim={claim} />
            ))
          )}
        </div>
      </div>

      {/* Drift Monitor (right) */}
      <div className="w-80 p-3 flex flex-col">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Drift Monitor</h3>

        {/* PSI Meter */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Population Stability Index (PSI)</span>
            <span className={`font-medium ${
              driftLevel.level === 'low' ? 'text-emerald-400' :
              driftLevel.level === 'medium' ? 'text-amber-400' :
              'text-red-400'
            }`}>
              {driftMetrics?.psi?.toFixed(4) || '0.0000'}
            </span>
          </div>
          <div className="drift-meter">
            <div
              className={`drift-meter-fill drift-${driftLevel.level}`}
              style={{ width: `${driftLevel.percentage}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0</span>
            <span>0.1</span>
            <span>0.2+</span>
          </div>
        </div>

        {/* Drift Status */}
        <div className={`p-3 rounded mb-3 ${
          !driftMetrics ? 'bg-gray-800' :
          driftMetrics.driftDetected ? 'bg-red-900/30 border border-red-700' :
          'bg-emerald-900/30 border border-emerald-700'
        }`}>
          <div className="text-xs font-medium mb-1">
            {!driftMetrics ? 'Waiting for data...' :
             driftMetrics.driftDetected ? '⚠ DRIFT DETECTED' : '✓ NO SIGNIFICANT DRIFT'}
          </div>
          {driftMetrics && (
            <div className="text-xs text-gray-400">
              Based on {driftMetrics.sampleSize} samples
            </div>
          )}
        </div>

        {/* Drift Metrics */}
        {driftMetrics?.metrics && (
          <div className="space-y-2 text-xs">
            <div className="bg-gray-800 rounded p-2">
              <div className="text-gray-500 mb-1">Billed Amount</div>
              <div className="flex justify-between">
                <span>Current: ${driftMetrics.metrics.billedAmount?.currentMean?.toFixed(2)}</span>
                <span className={driftMetrics.metrics.billedAmount?.drift > 0.1 ? 'text-amber-400' : 'text-gray-400'}>
                  Δ {(driftMetrics.metrics.billedAmount?.drift * 100)?.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="bg-gray-800 rounded p-2">
              <div className="text-gray-500 mb-1">Approval Rate</div>
              <div className="flex justify-between">
                <span>Current: {(driftMetrics.metrics.approvalRate?.current * 100)?.toFixed(1)}%</span>
                <span className={driftMetrics.metrics.approvalRate?.drift > 0.05 ? 'text-amber-400' : 'text-gray-400'}>
                  Δ {(driftMetrics.metrics.approvalRate?.drift * 100)?.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="bg-gray-800 rounded p-2">
              <div className="text-gray-500 mb-1">Patient Age</div>
              <div>Mean: {driftMetrics.metrics.age?.currentMean?.toFixed(1)} years</div>
            </div>
          </div>
        )}

        {/* Shadow Scoring Status */}
        <div className="mt-auto pt-3 border-t border-gray-700">
          <div className="text-xs text-gray-400">
            Shadow scoring monitors drift between current stream and training data distribution.
          </div>
        </div>
      </div>
    </div>
  )
}

// Individual claim card component
function ClaimCard({ claim }: { claim: Claim }) {
  return (
    <div className={`claim-card flex-shrink-0 w-48 ${
      claim.settlementOutcome === 1
        ? 'border-l-2 border-l-emerald-500'
        : 'border-l-2 border-l-red-500'
    }`}>
      <div className="flex justify-between items-start mb-1">
        <code className="text-xs text-gray-500">{claim.claimId.slice(-10)}</code>
        <span className={`text-xs font-medium ${
          claim.settlementOutcome === 1 ? 'text-emerald-400' : 'text-red-400'
        }`}>
          {claim.settlementLabel}
        </span>
      </div>
      <div className="text-sm font-semibold text-white mb-1">
        ${claim.billedAmount.toFixed(2)}
      </div>
      <div className="text-xs text-gray-400 truncate" title={claim.cptBucket}>
        {claim.cptBucket}
      </div>
      <div className="text-xs text-gray-500">
        {claim.providerType} • Age {claim.patientAge}
      </div>
    </div>
  )
}
