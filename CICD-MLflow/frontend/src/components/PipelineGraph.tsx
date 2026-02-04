'use client'

import { useCallback, useMemo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  NodeTypes,
  Position,
  MarkerType
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useStore } from '@/lib/store'
import { StepStatus } from '@/types'

// Custom node component for pipeline steps
function StepNode({ data }: { data: { label: string; status: StepStatus; stage: string } }) {
  const statusColors = {
    idle: 'bg-gray-700 border-gray-600',
    queued: 'bg-amber-900 border-amber-600',
    running: 'bg-blue-900 border-blue-500',
    success: 'bg-emerald-900 border-emerald-500',
    failed: 'bg-red-900 border-red-500',
    skipped: 'bg-gray-700 border-gray-500',
    awaiting_approval: 'bg-purple-900 border-purple-500'
  }

  const stageColors = {
    ci: 'text-cyan-400',
    cd: 'text-amber-400',
    deploy: 'text-emerald-400'
  }

  const isRunning = data.status === 'running'

  return (
    <div
      className={`
        px-3 py-2 rounded-lg border-2 min-w-[100px] text-center
        ${statusColors[data.status] || statusColors.idle}
        ${isRunning ? 'animate-pulse' : ''}
        cursor-pointer transition-all hover:scale-105
      `}
    >
      <div className={`text-[10px] font-medium ${stageColors[data.stage as keyof typeof stageColors] || 'text-gray-400'}`}>
        {data.stage.toUpperCase()}
      </div>
      <div className="text-sm font-semibold text-white">
        {data.label}
      </div>
      <div className="mt-1">
        <span className={`
          inline-block w-2 h-2 rounded-full
          ${data.status === 'idle' ? 'bg-gray-500' :
            data.status === 'queued' ? 'bg-amber-400' :
              data.status === 'running' ? 'bg-blue-400 animate-pulse' :
                data.status === 'success' ? 'bg-emerald-400' :
                  data.status === 'failed' ? 'bg-red-400' :
                    data.status === 'awaiting_approval' ? 'bg-purple-400 animate-pulse' :
                      'bg-gray-500'
          }
        `} />
      </div>
    </div>
  )
}

const nodeTypes: NodeTypes = {
  step: StepNode
}

export default function PipelineGraph() {
  const { steps, setSelectedStep, selectedStep } = useStore()

  // Generate nodes from steps
  const nodes: Node[] = useMemo(() => {
    const stepPositions: Record<string, { x: number; y: number }> = {
      // CI Stage (top row)
      commit_received: { x: 50, y: 30 },
      ci_tests: { x: 50, y: 110 },
      data_validation: { x: 50, y: 190 },
      ci_quick_train: { x: 50, y: 270 },
      mlflow_log_ci: { x: 50, y: 350 },

      // CD Stage (middle row)
      cd_full_train: { x: 200, y: 110 },
      evaluate_vs_champion: { x: 200, y: 190 },
      manual_approval: { x: 200, y: 270 },

      // Deploy Stage (right column)
      deploy_staging: { x: 350, y: 110 },
      shadow_monitor: { x: 350, y: 190 },
      promote_prod: { x: 350, y: 270 },
      rollback: { x: 350, y: 350 }
    }

    return Object.values(steps).map(step => ({
      id: step.name,
      type: 'step',
      position: stepPositions[step.name] || { x: 0, y: 0 },
      data: {
        label: step.displayName,
        status: step.status,
        stage: step.stage
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      selected: selectedStep === step.name
    }))
  }, [steps, selectedStep])

  // Generate edges from dependencies
  const edges: Edge[] = useMemo(() => {
    const edgeList: Edge[] = []

    // CI flow
    edgeList.push(
      { id: 'e1', source: 'commit_received', target: 'ci_tests', animated: steps.ci_tests?.status === 'running' },
      { id: 'e2', source: 'ci_tests', target: 'data_validation', animated: steps.data_validation?.status === 'running' },
      { id: 'e3', source: 'data_validation', target: 'ci_quick_train', animated: steps.ci_quick_train?.status === 'running' },
      { id: 'e4', source: 'ci_quick_train', target: 'mlflow_log_ci', animated: steps.mlflow_log_ci?.status === 'running' },
    )

    // CI to CD transition
    edgeList.push(
      { id: 'e5', source: 'mlflow_log_ci', target: 'cd_full_train', animated: steps.cd_full_train?.status === 'running', style: { strokeDasharray: '5,5' } },
    )

    // CD flow
    edgeList.push(
      { id: 'e6', source: 'cd_full_train', target: 'evaluate_vs_champion', animated: steps.evaluate_vs_champion?.status === 'running' },
      { id: 'e7', source: 'evaluate_vs_champion', target: 'manual_approval', animated: steps.manual_approval?.status === 'running' },
    )

    // CD to Deploy transition
    edgeList.push(
      { id: 'e8', source: 'manual_approval', target: 'deploy_staging', animated: steps.deploy_staging?.status === 'running', style: { strokeDasharray: '5,5' } },
    )

    // Deploy flow
    edgeList.push(
      { id: 'e9', source: 'deploy_staging', target: 'shadow_monitor', animated: steps.shadow_monitor?.status === 'running' },
      { id: 'e10', source: 'shadow_monitor', target: 'promote_prod', animated: steps.promote_prod?.status === 'running' },
    )

    // Rollback edge (dashed, from promote_prod)
    edgeList.push(
      { id: 'e11', source: 'promote_prod', target: 'rollback', style: { strokeDasharray: '3,3', stroke: '#ef4444' }, animated: steps.rollback?.status === 'running' },
    )

    // Filter edges to only include those where both source and target nodes exist
    const validEdges = edgeList.filter(edge =>
      steps[edge.source] && steps[edge.target]
    )

    return validEdges.map(edge => ({
      ...edge,
      markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: '#6b7280' },
      style: { stroke: '#6b7280', strokeWidth: 2, ...edge.style }
    }))
  }, [steps])

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedStep(node.id)
  }, [setSelectedStep])

  return (
    <div className="w-full h-full bg-gray-900 relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.5}
        maxZoom={1.5}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#374151" gap={20} />
        <Controls
          className="bg-gray-800 border-gray-700"
          showInteractive={false}
        />
      </ReactFlow>

      {/* Stage Legend - positioned at bottom-right to avoid ReactFlow controls */}
      <div className="absolute bottom-2 right-2 flex space-x-3 text-xs bg-gray-900/80 px-2 py-1 rounded z-10">
        <div className="flex items-center">
          <span className="w-3 h-3 rounded bg-cyan-900 border border-cyan-500 mr-1"></span>
          <span className="text-gray-400">CI</span>
        </div>
        <div className="flex items-center">
          <span className="w-3 h-3 rounded bg-amber-900 border border-amber-500 mr-1"></span>
          <span className="text-gray-400">CD</span>
        </div>
        <div className="flex items-center">
          <span className="w-3 h-3 rounded bg-emerald-900 border border-emerald-500 mr-1"></span>
          <span className="text-gray-400">Deploy</span>
        </div>
      </div>
    </div>
  )
}
