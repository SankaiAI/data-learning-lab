'use client'

import { useState, useEffect } from 'react'
import PipelineGraph from '@/components/PipelineGraph'
import StepInspector from '@/components/StepInspector'
import MLflowExplorer from '@/components/MLflowExplorer'
import ClaimsStream from '@/components/ClaimsStream'
import Header from '@/components/Header'
import { useStore } from '@/lib/store'

export default function Home() {
  const {
    selectedStep,
    currentRunId,
    initializeWebSocket
  } = useStore()

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Initialize WebSocket when we have a run
  useEffect(() => {
    if (currentRunId) {
      initializeWebSocket(currentRunId)
    }
  }, [currentRunId, initializeWebSocket])

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner w-8 h-8"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-4 gap-4">
        {/* Top Section: Pipeline + Inspector + MLflow */}
        <div className="flex-1 grid grid-cols-12 gap-4 min-h-[500px]">
          {/* Pipeline Graph (Left) */}
          <div className="col-span-3 panel">
            <div className="panel-header">
              <h2 className="panel-title">Pipeline DAG</h2>
            </div>
            <div className="h-[calc(100%-48px)]">
              <PipelineGraph />
            </div>
          </div>

          {/* Step Inspector (Center) */}
          <div className="col-span-5 panel">
            <div className="panel-header">
              <h2 className="panel-title">
                Step Inspector
                {selectedStep && (
                  <span className="ml-2 text-gray-400 font-normal">
                    - {selectedStep}
                  </span>
                )}
              </h2>
            </div>
            <div className="h-[calc(100%-48px)]">
              <StepInspector />
            </div>
          </div>

          {/* MLflow Explorer (Right) */}
          <div className="col-span-4 panel">
            <div className="panel-header">
              <h2 className="panel-title">MLflow Run Explorer</h2>
            </div>
            <div className="h-[calc(100%-48px)] overflow-auto">
              <MLflowExplorer />
            </div>
          </div>
        </div>

        {/* Bottom Section: Claims Stream */}
        <div className="h-64 panel">
          <div className="panel-header">
            <h2 className="panel-title">Streaming Claims & Drift Monitor</h2>
          </div>
          <div className="h-[calc(100%-48px)]">
            <ClaimsStream />
          </div>
        </div>
      </div>
    </div>
  )
}
