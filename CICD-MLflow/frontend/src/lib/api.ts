import axios from 'axios'
import { PipelineStartResponse, StepDefinition, MLflowRun, FailureMode } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Pipeline API
export const pipelineApi = {
  // Start a new pipeline run
  start: async (commitSha?: string, stage: string = 'ci'): Promise<PipelineStartResponse> => {
    const response = await api.post('/pipeline/start', { commit_sha: commitSha, stage })
    return response.data
  },

  // Run a specific step
  runStep: async (runId: string, stepName: string) => {
    const response = await api.post(`/pipeline/step/${stepName}/run?run_id=${runId}`)
    return response.data
  },

  // Get pipeline status
  getStatus: async (runId: string) => {
    const response = await api.get(`/pipeline/${runId}/status`)
    return response.data
  },

  // List pipeline runs
  listRuns: async (limit: number = 20) => {
    const response = await api.get(`/pipeline/runs?limit=${limit}`)
    return response.data
  },

  // Approve pending step
  approve: async (runId: string) => {
    const response = await api.post(`/pipeline/${runId}/approve`)
    return response.data
  },

  // Reject pending step
  reject: async (runId: string, reason?: string) => {
    const response = await api.post(`/pipeline/${runId}/reject`, { approved: false, reason })
    return response.data
  },

  // Continue to next stage
  continue: async (runId: string, stage: string) => {
    const response = await api.post(`/pipeline/continue/${runId}?stage=${stage}`)
    return response.data
  },

  // Rollback
  rollback: async (environment: string = 'production') => {
    const response = await api.post(`/pipeline/rollback?environment=${environment}`)
    return response.data
  },

  // Generate fake commit
  fakeCommit: async () => {
    const response = await api.post('/pipeline/commit')
    return response.data
  }
}

// Steps API
export const stepsApi = {
  // List all steps
  list: async (): Promise<StepDefinition[]> => {
    const response = await api.get('/steps')
    return response.data
  },

  // Get step definition
  get: async (stepName: string): Promise<StepDefinition> => {
    const response = await api.get(`/steps/${stepName}`)
    return response.data
  },

  // Get step code
  getCode: async (stepName: string): Promise<string> => {
    const response = await api.get(`/steps/${stepName}/code`)
    return response.data
  },

  // Get step config
  getConfig: async (stepName: string) => {
    const response = await api.get(`/steps/${stepName}/config`)
    return response.data
  }
}

// MLflow API
export const mlflowApi = {
  // List runs
  listRuns: async (stage?: string, commitSha?: string, limit: number = 50): Promise<{ runs: MLflowRun[] }> => {
    const params = new URLSearchParams()
    if (stage) params.append('stage', stage)
    if (commitSha) params.append('commit_sha', commitSha)
    params.append('limit', limit.toString())

    const response = await api.get(`/mlflow/runs?${params}`)
    return response.data
  },

  // Get run details
  getRun: async (runId: string): Promise<MLflowRun> => {
    const response = await api.get(`/mlflow/runs/${runId}`)
    return response.data
  },

  // List artifacts
  listArtifacts: async (runId: string, path: string = '') => {
    const response = await api.get(`/mlflow/runs/${runId}/artifacts?path=${path}`)
    return response.data
  },

  // Get artifact URL
  getArtifactUrl: (runId: string, artifactPath: string): string => {
    return `${API_URL}/mlflow/runs/${runId}/artifacts/${artifactPath}`
  },

  // List experiments
  listExperiments: async () => {
    const response = await api.get('/mlflow/experiments')
    return response.data
  },

  // List models
  listModels: async () => {
    const response = await api.get('/mlflow/models')
    return response.data
  },

  // Get champion model
  getChampion: async () => {
    const response = await api.get('/mlflow/champion')
    return response.data
  },

  // Compare models
  compareModels: async (challengerRunId: string, championRunId: string, metric: string = 'f1_score') => {
    const response = await api.post(`/mlflow/compare?challenger_run_id=${challengerRunId}&champion_run_id=${championRunId}&metric=${metric}`)
    return response.data
  }
}

// Claims API
export const claimsApi = {
  // Generate claims
  generate: async (n: number = 10, seed?: number) => {
    const params = new URLSearchParams({ n: n.toString() })
    if (seed) params.append('seed', seed.toString())

    const response = await api.get(`/claims/generate?${params}`)
    return response.data
  },

  // Get single claim
  single: async (seed?: number) => {
    const params = seed ? `?seed=${seed}` : ''
    const response = await api.get(`/claims/single${params}`)
    return response.data
  },

  // Generate dataset
  dataset: async (nSamples: number = 10000, seed: number = 42) => {
    const response = await api.get(`/claims/dataset?n_samples=${nSamples}&seed=${seed}`)
    return response.data
  },

  // Start stream
  startStream: async (intervalMs: number = 1000) => {
    const response = await api.post(`/claims/stream/start?interval_ms=${intervalMs}`)
    return response.data
  },

  // Stop stream
  stopStream: async () => {
    const response = await api.post('/claims/stream/stop')
    return response.data
  },

  // Get stream status
  streamStatus: async () => {
    const response = await api.get('/claims/stream/status')
    return response.data
  },

  // Calculate drift
  calculateDrift: async (nSamples: number = 100) => {
    const response = await api.get(`/claims/drift?n_samples=${nSamples}`)
    return response.data
  },

  // Get schema
  getSchema: async () => {
    const response = await api.get('/claims/schema')
    return response.data
  }
}

// Failure Modes API
export const failuresApi = {
  // List failure modes
  list: async (): Promise<{ failure_modes: Record<string, FailureMode> }> => {
    const response = await api.get('/failures')
    return response.data
  },

  // Get failure mode
  get: async (modeId: string): Promise<FailureMode> => {
    const response = await api.get(`/failures/${modeId}`)
    return response.data
  },

  // Set failure mode
  set: async (modeId: string, enabled: boolean) => {
    const response = await api.post(`/failures/${modeId}`, { enabled })
    return response.data
  },

  // Toggle failure mode
  toggle: async (modeId: string) => {
    const response = await api.post(`/failures/${modeId}/toggle`)
    return response.data
  },

  // Reset all
  reset: async () => {
    const response = await api.post('/failures/reset')
    return response.data
  },

  // Enable all (chaos mode)
  enableAll: async () => {
    const response = await api.post('/failures/enable-all')
    return response.data
  }
}

export default api
