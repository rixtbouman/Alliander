import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      session_id,
      step,
      resources,
      system,
      dominant_value,
      technology_1,
      technology_2,
      sector_name = 'Alliander',
      intervention,
      previous_scenario
    } = body

    console.log('Generate request:', { session_id, step, technology_1, technology_2 })

    // Fetch all prompts
    const { data: prompts, error: promptsError } = await supabase
      .from('prompts')
      .select('prompt_id, step_name, prompt_text')

    if (promptsError) {
      console.error('Error fetching prompts:', promptsError)
      return NextResponse.json({ error: 'Failed to fetch prompts' }, { status: 500 })
    }

    // Fetch technology analyses
    const { data: techAnalyses, error: techError } = await supabase
      .from('technology_sector_analyses')
      .select('technology_name, content')
      .in('technology_name', [technology_1, technology_2])

    if (techError) {
      console.error('Error fetching tech analyses:', techError)
    }

    // Fetch sector profile
    const { data: sectorProfile, error: sectorError } = await supabase
      .from('sector_profile')
      .select('content, organization_name')
      .eq('sector_name', sector_name)
      .single()

    if (sectorError) {
      console.error('Error fetching sector profile:', sectorError)
    }

    // Build context
    const tech1Content = techAnalyses?.find(t => t.technology_name === technology_1)?.content || ''
    const tech2Content = techAnalyses?.find(t => t.technology_name === technology_2)?.content || ''
    const sectorContent = sectorProfile?.content || ''

    // Determine archetype based on resources + system
    let archetype = ''
    if (resources === 'abundance' && system === 'stable') {
      archetype = 'Continued Growth'
    } else if (resources === 'scarce' && system === 'breaks_down') {
      archetype = 'Collapse'
    } else if (resources === 'scarce' && system === 'stable') {
      archetype = 'Discipline'
    } else if (resources === 'abundance' && system === 'breaks_down') {
      archetype = 'Transformation'
    }

    // Get the right prompt based on step
    const promptMap: Record<string, string> = {
      'seed': 'b1',
      'distant_future': 'b2',
      'assessment': 'b3',
      'revision': 'b3_revision',
      'not_so_distant': 'b5',
      'near_future': 'b6',
      'backcasting_assessment': 'b7',
      'intervention': 'b8'
    }

    const promptId = promptMap[step]
    const promptTemplate = prompts?.find(p => p.prompt_id === promptId)?.prompt_text || ''

    if (!promptTemplate) {
      return NextResponse.json({ error: `Prompt not found for step: ${step}` }, { status: 404 })
    }

    // Build the full prompt with context
    let fullPrompt = promptTemplate
      .replace('{{ARCHETYPE}}', archetype)
      .replace('{{DOMINANT_VALUE}}', dominant_value || '')
      .replace('{{TECHNOLOGY_1}}', technology_1 || '')
      .replace('{{TECHNOLOGY_2}}', technology_2 || '')
      .replace('{{TECH_1_ANALYSIS}}', tech1Content)
      .replace('{{TECH_2_ANALYSIS}}', tech2Content)
      .replace('{{SECTOR_PROFILE}}', sectorContent)
      .replace('{{RESOURCES}}', resources || '')
      .replace('{{SYSTEM}}', system || '')
      .replace('{{INTERVENTION}}', intervention || '')
      .replace('{{PREVIOUS_SCENARIO}}', previous_scenario || '')

    console.log('Calling Gemini with prompt length:', fullPrompt.length)

    // Call Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
    const result = await model.generateContent(fullPrompt)
    const response = await result.response
    const generatedText = response.text()

    console.log('Generated text length:', generatedText.length)

    // Save to session_outputs
    const { error: saveError } = await supabase
      .from('session_outputs')
      .insert({
        session_id,
        step_name: step,
        content: generatedText
      })

    if (saveError) {
      console.error('Error saving output:', saveError)
    }

    return NextResponse.json({
      success: true,
      content: generatedText,
      archetype,
      step
    })

  } catch (error) {
    console.error('Generate error:', error)
    return NextResponse.json({
      error: 'Generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
