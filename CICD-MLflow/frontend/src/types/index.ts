// Pipeline Types
export type StepStatus = 'idle' | 'queued' | 'running' | 'success' | 'failed' | 'skipped' | 'awaiting_approval'

export interface PipelineStep {
  name: string
  displayName: string
  description: string
  stage: 'ci' | 'cd' | 'deploy'
  status: StepStatus
  startedAt?: string
  completedAt?: string
  outputs?: Record<string, any>
  error?: string
  codeFile: string
  configFile: string
  requiresApproval: boolean
  dependencies: string[]
}

export interface PipelineRun {
  runId: string
  commitSha: string
  status: string
  stage: string
  createdAt: string
  mlflowRunId?: string
  steps: PipelineStep[]
  pendingApproval: boolean
}

// MLflow Types
export interface MLflowRun {
  runId: string
  runName: string
  status: string
  startTime: number
  endTime?: number
  params: Record<string, string>
  metrics: Record<string, number>
  tags: Record<string, string>
  artifactUri?: string
}

export interface MLflowArtifact {
  path: string
  isDir: boolean
  fileSize?: number
}

export interface MLflowModel {
  name: string
  versions: {
    version: string
    stage: string
    runId: string
  }[]
}

// Claims Types
export interface Claim {
  claimId: string
  timestamp: string
  cptBucket: string
  cptBucketIdx: number
  providerType: string
  providerTypeIdx: number
  billedAmount: number
  allowedAmount: number
  allowedRatio: number
  diagnosisGroup: string
  diagnosisGroupIdx: number
  patientAge: number
  serviceDate: string
  settlementOutcome: number
  settlementLabel: string
}

export interface DriftMetrics {
  psi: number
  driftDetected: boolean
  metrics: {
    billedAmount: {
      currentMean: number
      referenceMean: number
      drift: number
    }
    approvalRate: {
      current: number
      reference: number
      drift: number
    }
    age: {
      currentMean: number
    }
  }
  sampleSize: number
  timestamp: string
}

// WebSocket Message Types
export interface WSMessage {
  type: 'log' | 'status' | 'metrics' | 'artifact' | 'claim' | 'drift' | 'connected' | 'heartbeat'
  timestamp?: string
  [key: string]: any
}

export interface LogMessage {
  type: 'log'
  timestamp: string
  level: 'info' | 'warning' | 'error' | 'debug'
  message: string
}

export interface StatusMessage {
  type: 'status'
  timestamp: string
  stepName: string
  status: StepStatus
  outputs?: Record<string, any>
  error?: string
  message?: string
}

// Failure Modes
export interface FailureMode {
  id: string
  name: string
  description: string
  stepAffected: string
  enabled: boolean
}

// API Response Types
export interface ApiResponse<T> {
  data?: T
  error?: string
}

export interface PipelineStartResponse {
  runId: string
  commitSha: string
  status: string
  stage: string
  message?: string
}

export interface StepDefinition {
  name: string
  displayName: string
  description: string
  stage: string
  codeFile: string
  configFile: string
  requiresApproval: boolean
  dependencies: string[]
}
