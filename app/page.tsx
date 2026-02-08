'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { TECHNOLOGIES, Technology, UserRole, Language } from '@/lib/types'

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11

interface SessionData {
  id: string
  code: string
  current_step: number
}

interface Inputs {
  resources: 'abundance' | 'scarce' | null
  system: 'stable' | 'breaks_down' | null
  dominant_value: 'collectivism' | 'individualism' | null
  technology_1: Technology | null
  technology_2: Technology | null
  intervention: string
}

interface Outputs {
  distant_future: string
  not_so_distant: string
  near_future: string
  consequences: string
}

export default function Home() {
  const [step, setStep] = useState<Step>(1)
  const [role, setRole] = useState<UserRole | null>(null)
  const [language, setLanguage] = useState<Language>('en')
  const [sessionCode, setSessionCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [session, setSession] = useState<SessionData | null>(null)
  const [inputs, setInputs] = useState<Inputs>({
    resources: null,
    system: null,
    dominant_value: null,
    technology_1: null,
    technology_2: null,
    intervention: ''
  })
  const [outputs, setOutputs] = useState<Outputs>({
    distant_future: '',
    not_so_distant: '',
    near_future: '',
    consequences: ''
  })
  const [insight, setInsight] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)

  // Generate session code
  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = 'ALL-'
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  // Create session (moderator)
  const createSession = async () => {
    const code = generateCode()
    const { data, error } = await supabase
      .from('sessions')
      .insert({ code, current_step: 1, language, status: 'active' })
      .select()
      .single()

    if (data) {
      setSession(data)
      setSessionCode(code)
      setStep(3)
    }
  }

  // Join session (viewer)
  const joinSession = async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select()
      .eq('code', joinCode.toUpperCase())
      .single()

    if (data) {
      setSession(data)
      setSessionCode(data.code)
      setStep(data.current_step as Step)
      subscribeToSession(data.id)
    }
  }

  // Subscribe to realtime updates
  const subscribeToSession = (sessionId: string) => {
    supabase
      .channel(`session-${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${sessionId}`
      }, (payload) => {
        const newStep = payload.new.current_step as Step
        setStep(newStep)
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'session_outputs',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        if (payload.new) {
          const { step_name, content } = payload.new as { step_name: string, content: string }
          setOutputs(prev => ({ ...prev, [step_name]: content }))
        }
      })
      .subscribe()
  }

  // Advance step (moderator only)
  const advanceStep = async () => {
    if (!session || role !== 'moderator') return
    const nextStep = (step + 1) as Step
    await supabase
      .from('sessions')
      .update({ current_step: nextStep })
      .eq('id', session.id)
    setStep(nextStep)
  }

  // Handle role selection
  const selectRole = (selectedRole: UserRole) => {
    setRole(selectedRole)
    if (selectedRole === 'moderator') {
      createSession()
    }
  }

  // Toggle technology selection
  const toggleTechnology = (tech: Technology) => {
    if (inputs.technology_1 === tech) {
      setInputs({ ...inputs, technology_1: null })
    } else if (inputs.technology_2 === tech) {
      setInputs({ ...inputs, technology_2: null })
    } else if (!inputs.technology_1) {
      setInputs({ ...inputs, technology_1: tech })
    } else if (!inputs.technology_2) {
      setInputs({ ...inputs, technology_2: tech })
    }
  }

  // Check if inputs are complete
  const inputsComplete = inputs.resources && inputs.system && inputs.dominant_value && inputs.technology_1 && inputs.technology_2

  // Generate scenario (placeholder - will connect to API)
  const generateScenario = async () => {
    if (!session || !inputsComplete) return
    setIsLoading(true)

    // Save inputs to Supabase
    await supabase.from('session_inputs').insert({
      session_id: session.id,
      resources: inputs.resources,
      system: inputs.system,
      dominant_value: inputs.dominant_value,
      technology_1: inputs.technology_1,
      technology_2: inputs.technology_2
    })

    // TODO: Call generation API
    // For now, advance to next step
    await advanceStep()
    setIsLoading(false)
  }

  // Submit intervention
  const submitIntervention = async () => {
    if (!session || !inputs.intervention) return
    setIsLoading(true)

    await supabase
      .from('session_inputs')
      .update({ intervention: inputs.intervention })
      .eq('session_id', session.id)

    // TODO: Call intervention API
    await advanceStep()
    setIsLoading(false)
  }

  // Submit insight
  const submitInsight = async () => {
    if (!session || !insight) return

    await supabase.from('session_insights').insert({
      session_id: session.id,
      insight: insight
    })

    setInsight('')
    if (role === 'moderator') {
      await advanceStep()
    }
  }

  // ============ SCREENS ============

  // Screen 1: Welcome
  if (step === 1) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8">
        <div className="max-w-md w-full text-center">
          <p className="label mb-4">Future Scenario Tool</p>
          <h1 className="text-4xl font-light tracking-tight mb-2">ALLIANDER</h1>
          <p className="text-muted text-sm mb-12">Energy Futures / 2025</p>

          <button
            onClick={() => setStep(2)}
            className="btn-primary w-full"
          >
            Begin Session
          </button>
        </div>
      </div>
    )
  }

  // Screen 2: Language & Role Selection
  if (step === 2) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8">
        <div className="max-w-md w-full">
          <p className="label mb-8">Setup</p>

          <div className="mb-8">
            <p className="data-label mb-3">Language</p>
            <div className="flex gap-3">
              <button
                onClick={() => setLanguage('en')}
                className={`chip ${language === 'en' ? 'selected' : ''}`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage('nl')}
                className={`chip ${language === 'nl' ? 'selected' : ''}`}
              >
                Nederlands
              </button>
            </div>
          </div>

          <div className="mb-8">
            <p className="data-label mb-3">Join as</p>
            <div className="flex gap-3">
              <button
                onClick={() => selectRole('moderator')}
                className="chip flex-1"
              >
                Moderator
              </button>
              <button
                onClick={() => { setRole('viewer'); setStep(3) }}
                className="chip flex-1"
              >
                Viewer
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Screen 3: Session Code
  if (step === 3) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8">
        <div className="max-w-md w-full">
          <p className="label mb-8">Session</p>

          {role === 'moderator' ? (
            <div className="text-center">
              <p className="data-label mb-3">Share this code</p>
              <div className="card-cream mb-8">
                <p className="text-4xl font-mono tracking-widest">{sessionCode}</p>
              </div>
              <button onClick={() => setStep(4)} className="btn-primary w-full">
                Continue to Card Selection
              </button>
            </div>
          ) : (
            <div>
              <p className="data-label mb-3">Enter session code</p>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ALL-XXXX"
                className="w-full p-4 border border-border text-center text-2xl font-mono tracking-widest mb-4"
              />
              <button
                onClick={joinSession}
                disabled={joinCode.length < 8}
                className="btn-primary w-full disabled:opacity-50"
              >
                Join Session
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Screen 4: Card Selection
  if (step === 4) {
    return (
      <div className="min-h-screen px-8 py-12">
        <div className="max-w-2xl mx-auto">
          <p className="label mb-2">Card Selection</p>
          <h2 className="text-2xl font-light mb-8">Configure your scenario</h2>

          {/* Technologies */}
          <div className="mb-8">
            <p className="data-label mb-3">Technologies — Select 2</p>
            <div className="flex flex-wrap gap-2">
              {TECHNOLOGIES.map(tech => (
                <button
                  key={tech}
                  onClick={() => toggleTechnology(tech)}
                  className={`chip ${inputs.technology_1 === tech || inputs.technology_2 === tech ? 'selected' : ''}`}
                >
                  {tech}
                </button>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div className="mb-8">
            <p className="data-label mb-3">Resources</p>
            <div className="flex gap-3">
              <button
                onClick={() => setInputs({ ...inputs, resources: 'abundance' })}
                className={`chip flex-1 ${inputs.resources === 'abundance' ? 'selected' : ''}`}
              >
                Abundance
              </button>
              <button
                onClick={() => setInputs({ ...inputs, resources: 'scarce' })}
                className={`chip flex-1 ${inputs.resources === 'scarce' ? 'selected' : ''}`}
              >
                Scarce
              </button>
            </div>
          </div>

          {/* System */}
          <div className="mb-8">
            <p className="data-label mb-3">System</p>
            <div className="flex gap-3">
              <button
                onClick={() => setInputs({ ...inputs, system: 'stable' })}
                className={`chip flex-1 ${inputs.system === 'stable' ? 'selected' : ''}`}
              >
                Stable
              </button>
              <button
                onClick={() => setInputs({ ...inputs, system: 'breaks_down' })}
                className={`chip flex-1 ${inputs.system === 'breaks_down' ? 'selected' : ''}`}
              >
                Breaks Down
              </button>
            </div>
          </div>

          {/* Dominant Value */}
          <div className="mb-8">
            <p className="data-label mb-3">Dominant Value</p>
            <div className="flex gap-3">
              <button
                onClick={() => setInputs({ ...inputs, dominant_value: 'collectivism' })}
                className={`chip flex-1 ${inputs.dominant_value === 'collectivism' ? 'selected' : ''}`}
              >
                Collectivism
              </button>
              <button
                onClick={() => setInputs({ ...inputs, dominant_value: 'individualism' })}
                className={`chip flex-1 ${inputs.dominant_value === 'individualism' ? 'selected' : ''}`}
              >
                Individualism
              </button>
            </div>
          </div>

          {role === 'moderator' && (
            <button
              onClick={generateScenario}
              disabled={!inputsComplete || isLoading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {isLoading ? 'Generating...' : 'See How This Future Unfolds'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // Screen 5: Distant Future
  if (step === 5) {
    return (
      <div className="min-h-screen px-8 py-12">
        <div className="max-w-2xl mx-auto">
          <p className="label mb-2">Distant Future</p>
          <p className="data-label mb-6">2045–2050</p>

          <div className="card-cream mb-8">
            <p className="scenario-text">
              {outputs.distant_future || 'Generating scenario...'}
            </p>
          </div>

          {role === 'moderator' && (
            <button onClick={advanceStep} className="btn-primary w-full">
              Continue to Not So Distant Future
            </button>
          )}
        </div>
      </div>
    )
  }

  // Screen 6: Not So Distant Future
  if (step === 6) {
    return (
      <div className="min-h-screen px-8 py-12">
        <div className="max-w-2xl mx-auto">
          <p className="label mb-2">Not So Distant Future</p>
          <p className="data-label mb-6">2035–2040</p>

          <div className="card-cream mb-8">
            <p className="scenario-text">
              {outputs.not_so_distant || 'Generating scenario...'}
            </p>
          </div>

          {role === 'moderator' && (
            <button onClick={advanceStep} className="btn-primary w-full">
              Continue to Near Future
            </button>
          )}
        </div>
      </div>
    )
  }

  // Screen 7: Near Future
  if (step === 7) {
    return (
      <div className="min-h-screen px-8 py-12">
        <div className="max-w-2xl mx-auto">
          <p className="label mb-2">Near Future</p>
          <p className="data-label mb-6">2027–2030</p>

          <div className="card-cream mb-8">
            <p className="scenario-text">
              {outputs.near_future || 'Generating scenario...'}
            </p>
          </div>

          {role === 'moderator' && (
            <button onClick={advanceStep} className="btn-primary w-full">
              Continue to Intervention
            </button>
          )}
        </div>
      </div>
    )
  }

  // Screen 8: Intervention Input
  if (step === 8) {
    return (
      <div className="min-h-screen px-8 py-12">
        <div className="max-w-2xl mx-auto">
          <p className="label mb-2">Intervention</p>
          <h2 className="text-2xl font-light mb-6">What would you change?</h2>

          <textarea
            value={inputs.intervention}
            onChange={(e) => setInputs({ ...inputs, intervention: e.target.value })}
            placeholder="Describe an intervention that could alter this future..."
            className="w-full p-4 border border-border min-h-[200px] mb-6"
          />

          {role === 'moderator' && (
            <button
              onClick={submitIntervention}
              disabled={!inputs.intervention || isLoading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {isLoading ? 'Calculating Consequences...' : 'See Consequences'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // Screen 9: Consequences
  if (step === 9) {
    return (
      <div className="min-h-screen px-8 py-12">
        <div className="max-w-2xl mx-auto">
          <p className="label mb-2">Consequences</p>
          <p className="data-label mb-6">Revised Distant Future</p>

          <div className="card-cream mb-8">
            <p className="scenario-text">
              {outputs.consequences || 'Calculating consequences...'}
            </p>
          </div>

          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className="btn-outline w-full mb-4"
          >
            {showOriginal ? 'Hide' : 'View'} Original Scenario
          </button>

          {showOriginal && (
            <div className="card mb-8">
              <p className="data-label mb-3">Original Distant Future</p>
              <p className="scenario-text text-muted">{outputs.distant_future}</p>
            </div>
          )}

          {role === 'moderator' && (
            <button onClick={advanceStep} className="btn-primary w-full">
              Continue to Insights
            </button>
          )}
        </div>
      </div>
    )
  }

  // Screen 10: Insights
  if (step === 10) {
    return (
      <div className="min-h-screen px-8 py-12">
        <div className="max-w-2xl mx-auto">
          <p className="label mb-2">Insights</p>
          <h2 className="text-2xl font-light mb-6">What did you learn?</h2>

          <textarea
            value={insight}
            onChange={(e) => setInsight(e.target.value)}
            placeholder="Share your key insights from this session..."
            className="w-full p-4 border border-border min-h-[200px] mb-6"
          />

          <button
            onClick={submitInsight}
            disabled={!insight}
            className="btn-primary w-full disabled:opacity-50"
          >
            Submit Insight
          </button>

          {role === 'moderator' && (
            <button onClick={advanceStep} className="btn-outline w-full mt-4">
              End Session
            </button>
          )}
        </div>
      </div>
    )
  }

  // Screen 11: Closing
  if (step === 11) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8">
        <div className="max-w-md w-full text-center">
          <p className="label mb-4">Session Complete</p>
          <h1 className="text-3xl font-light tracking-tight mb-4">Thank You</h1>
          <p className="text-muted mb-8">
            Your insights have been recorded.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-outline"
          >
            Start New Session
          </button>
        </div>
      </div>
    )
  }

  return null
}
