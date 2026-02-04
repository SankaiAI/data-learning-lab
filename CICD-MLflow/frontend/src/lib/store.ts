import { create } from 'zustand'
import { PipelineStep, PipelineRun, MLflowRun, Claim, DriftMetrics, LogMessage, StepStatus, FailureMode } from '@/types'

interface AppState {
  // Pipeline state
  currentRunId: string | null
  pipelineRuns: PipelineRun[]
  steps: Record<string, PipelineStep>
  selectedStep: string | null
  pendingApproval: boolean

  // Logs
  logs: LogMessage[]

  // MLflow state
  mlflowRuns: MLflowRun[]
  selectedMLflowRun: string | null

  // Claims stream
  claims: Claim[]
  driftMetrics: DriftMetrics | null
  claimsStreamActive: boolean

  // Failure modes
  failureModes: FailureMode[]

  // WebSocket
  ws: WebSocket | null
  wsConnected: boolean

  // Actions
  setCurrentRunId: (runId: string | null) => void
  setSelectedStep: (stepName: string | null) => void
  updateStepStatus: (stepName: string, status: StepStatus, outputs?: Record<string, any>, error?: string) => void
  addLog: (log: LogMessage) => void
  clearLogs: () => void
  addClaim: (claim: Claim) => void
  setDriftMetrics: (metrics: DriftMetrics) => void
  setClaimsStreamActive: (active: boolean) => void
  setFailureModes: (modes: FailureMode[]) => void
  toggleFailureMode: (modeId: string) => void
  setMLflowRuns: (runs: MLflowRun[]) => void
  setSelectedMLflowRun: (runId: string | null) => void
  setPendingApproval: (pending: boolean) => void
  initializeWebSocket: (runId: string) => void
  initializeClaimsWebSocket: () => void
  disconnectWebSocket: () => void
  resetPipeline: () => void
}

// Initial step definitions
const initialSteps: Record<string, PipelineStep> = {
  commit_received: {
    name: 'commit_received',
    displayName: 'Commit/PR',
    description: 'New commit or PR triggers the pipeline',
    stage: 'ci',
    status: 'idle',
    codeFile: 'ml/training/commit_handler.py',
    configFile: 'configs/commit.yaml',
    requiresApproval: false,
    dependencies: []
  },
  ci_tests: {
    name: 'ci_tests',
    displayName: 'CI Tests',
    description: 'Run unit tests and linting',
    stage: 'ci',
    status: 'idle',
    codeFile: 'ml/validation/ci_tests.py',
    configFile: 'configs/ci_tests.yaml',
    requiresApproval: false,
    dependencies: ['commit_received']
  },
  data_validation: {
    name: 'data_validation',
    displayName: 'Data Validation',
    description: 'Validate data schema and quality',
    stage: 'ci',
    status: 'idle',
    codeFile: 'ml/validation/data_validation.py',
    configFile: 'configs/data_validation.yaml',
    requiresApproval: false,
    dependencies: ['ci_tests']
  },
  ci_quick_train: {
    name: 'ci_quick_train',
    displayName: 'Quick Train',
    description: 'Fast training on sample data',
    stage: 'ci',
    status: 'idle',
    codeFile: 'ml/training/quick_train.py',
    configFile: 'configs/quick_train.yaml',
    requiresApproval: false,
    dependencies: ['data_validation']
  },
  mlflow_log_ci: {
    name: 'mlflow_log_ci',
    displayName: 'MLflow Log',
    description: 'Log CI results to MLflow',
    stage: 'ci',
    status: 'idle',
    codeFile: 'ml/training/mlflow_logger.py',
    configFile: 'configs/mlflow.yaml',
    requiresApproval: false,
    dependencies: ['ci_quick_train']
  },
  cd_full_train: {
    name: 'cd_full_train',
    displayName: 'Full Train',
    description: 'Full model training',
    stage: 'cd',
    status: 'idle',
    codeFile: 'ml/training/full_train.py',
    configFile: 'configs/full_train.yaml',
    requiresApproval: false,
    dependencies: ['mlflow_log_ci']
  },
  evaluate_vs_champion: {
    name: 'evaluate_vs_champion',
    displayName: 'Evaluate',
    description: 'Compare vs champion model',
    stage: 'cd',
    status: 'idle',
    codeFile: 'ml/validation/evaluate_champion.py',
    configFile: 'configs/evaluation.yaml',
    requiresApproval: false,
    dependencies: ['cd_full_train']
  },
  manual_approval: {
    name: 'manual_approval',
    displayName: 'Approval',
    description: 'Manual approval gate',
    stage: 'cd',
    status: 'idle',
    codeFile: 'ml/training/approval_gate.py',
    configFile: 'configs/approval.yaml',
    requiresApproval: true,
    dependencies: ['evaluate_vs_champion']
  },
  deploy_staging: {
    name: 'deploy_staging',
    displayName: 'Staging',
    description: 'Deploy to staging',
    stage: 'deploy',
    status: 'idle',
    codeFile: 'ml/training/deploy.py',
    configFile: 'configs/deploy_staging.yaml',
    requiresApproval: false,
    dependencies: ['manual_approval']
  },
  shadow_monitor: {
    name: 'shadow_monitor',
    displayName: 'Shadow Test',
    description: 'Shadow scoring & drift monitor',
    stage: 'deploy',
    status: 'idle',
    codeFile: 'ml/validation/shadow_monitor.py',
    configFile: 'configs/shadow_monitor.yaml',
    requiresApproval: false,
    dependencies: ['deploy_staging']
  },
  promote_prod: {
    name: 'promote_prod',
    displayName: 'Production',
    description: 'Promote to production',
    stage: 'deploy',
    status: 'idle',
    codeFile: 'ml/training/promote_prod.py',
    configFile: 'configs/deploy_prod.yaml',
    requiresApproval: false,
    dependencies: ['shadow_monitor']
  },
  rollback: {
    name: 'rollback',
    displayName: 'Rollback',
    description: 'Rollback to previous version',
    stage: 'deploy',
    status: 'idle',
    codeFile: 'ml/training/rollback.py',
    configFile: 'configs/rollback.yaml',
    requiresApproval: false,
    dependencies: []
  }
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  currentRunId: null,
  pipelineRuns: [],
  steps: { ...initialSteps },
  selectedStep: null,
  pendingApproval: false,
  logs: [],
  mlflowRuns: [],
  selectedMLflowRun: null,
  claims: [],
  driftMetrics: null,
  claimsStreamActive: false,
  failureModes: [],
  ws: null,
  wsConnected: false,

  // Actions
  setCurrentRunId: (runId) => set({ currentRunId: runId }),

  setSelectedStep: (stepName) => set({ selectedStep: stepName }),

  updateStepStatus: (stepName, status, outputs, error) => set((state) => ({
    steps: {
      ...state.steps,
      [stepName]: {
        ...state.steps[stepName],
        status,
        outputs: outputs || state.steps[stepName]?.outputs,
        error: error || state.steps[stepName]?.error
      }
    }
  })),

  addLog: (log) => set((state) => ({
    logs: [...state.logs.slice(-500), log] // Keep last 500 logs
  })),

  clearLogs: () => set({ logs: [] }),

  addClaim: (claim) => set((state) => ({
    claims: [...state.claims.slice(-50), claim] // Keep last 50 claims
  })),

  setDriftMetrics: (metrics) => set({ driftMetrics: metrics }),

  setClaimsStreamActive: (active) => set({ claimsStreamActive: active }),

  setFailureModes: (modes) => set({ failureModes: modes }),

  toggleFailureMode: (modeId) => set((state) => ({
    failureModes: state.failureModes.map(mode =>
      mode.id === modeId ? { ...mode, enabled: !mode.enabled } : mode
    )
  })),

  setMLflowRuns: (runs) => set({ mlflowRuns: runs }),

  setSelectedMLflowRun: (runId) => set({ selectedMLflowRun: runId }),

  setPendingApproval: (pending) => set({ pendingApproval: pending }),

  initializeWebSocket: (runId) => {
    const state = get()

    // Close existing connection
    if (state.ws) {
      state.ws.close()
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'
    const ws = new WebSocket(`${wsUrl}/ws/logs/${runId}`)

    ws.onopen = () => {
      console.log('WebSocket connected for run:', runId)
      set({ wsConnected: true })
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)

        switch (message.type) {
          case 'log':
            get().addLog({
              type: 'log',
              timestamp: message.timestamp,
              level: message.level,
              message: message.message
            })
            break

          case 'status':
            get().updateStepStatus(
              message.step_name,
              message.status,
              message.outputs,
              message.error
            )
            if (message.status === 'awaiting_approval') {
              set({ pendingApproval: true })
            }
            break

          case 'metrics':
            // Could update step outputs with metrics
            break

          case 'connected':
            get().addLog({
              type: 'log',
              timestamp: new Date().toISOString(),
              level: 'info',
              message: message.message
            })
            break
        }
      } catch (e) {
        console.error('WebSocket message error:', e)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      set({ wsConnected: false })
    }

    set({ ws })
  },

  initializeClaimsWebSocket: () => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'
    const ws = new WebSocket(`${wsUrl}/ws/claims`)

    ws.onopen = () => {
      console.log('Claims WebSocket connected')
      set({ claimsStreamActive: true })
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)

        if (message.type === 'claim') {
          get().addClaim(message.data)
        } else if (message.type === 'drift') {
          get().setDriftMetrics(message.data)
        }
      } catch (e) {
        console.error('Claims WebSocket message error:', e)
      }
    }

    ws.onclose = () => {
      set({ claimsStreamActive: false })
    }
  },

  disconnectWebSocket: () => {
    const { ws } = get()
    if (ws) {
      ws.close()
      set({ ws: null, wsConnected: false })
    }
  },

  resetPipeline: () => set({
    steps: { ...initialSteps },
    logs: [],
    currentRunId: null,
    pendingApproval: false
  })
}))
