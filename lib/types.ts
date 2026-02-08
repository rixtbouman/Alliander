export interface Session {
  id: string
  code: string
  current_step: number
  language: string
  status: string
  created_at: string
}

export interface SessionInputs {
  id: string
  session_id: string
  resources: 'abundance' | 'scarce'
  system: 'stable' | 'breaks_down'
  dominant_value: 'collectivism' | 'individualism'
  technology_1: string
  technology_2: string
  intervention: string | null
}

export interface SessionOutputs {
  id: string
  session_id: string
  step_name: string
  content: string
  created_at: string
}

export type UserRole = 'moderator' | 'viewer'

export type Language = 'en' | 'nl'

export const TECHNOLOGIES = [
  'Quantum',
  'Neuro tech',
  'Bio tech',
  'Climate tech',
  'AGI',
  'Robotics'
] as const

export type Technology = typeof TECHNOLOGIES[number]
