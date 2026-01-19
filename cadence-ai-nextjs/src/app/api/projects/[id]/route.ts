import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySessionToken } from '@/lib/telegram/validate'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN!
const sessionSecret = process.env.SESSION_SECRET || telegramBotToken
const SESSION_COOKIE_NAME = 'cadence_session'

// Helper to get authenticated telegram_id from session
function getAuthenticatedUser(request: NextRequest): string | null {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!sessionToken) return null

  const session = verifySessionToken(sessionToken, sessionSecret)
  return session?.telegram_id || null
}

// GET - Fetch a single project by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const telegramId = getAuthenticatedUser(request)

  if (!telegramId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('telegram_id', telegramId) // Ensure user owns this project
    .single()

  if (error) {
    console.error('Error fetching project:', error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  return NextResponse.json({ project: data })
}

// PUT - Update a project
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const telegramId = getAuthenticatedUser(request)

  if (!telegramId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const body = await request.json()
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Build update object with provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    // Map frontend field names to database field names
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.brand_voice !== undefined) updateData.brand_voice = body.brand_voice
    if (body.brand_tone !== undefined) updateData.brand_tone = body.brand_tone
    if (body.emoji_style !== undefined) updateData.emoji_style = body.emoji_style
    if (body.default_hashtags !== undefined) updateData.default_hashtags = body.default_hashtags
    if (body.target_audience !== undefined) updateData.target_audience = body.target_audience
    if (body.content_pillars !== undefined) updateData.content_pillars = body.content_pillars
    if (body.platforms !== undefined) updateData.platforms = body.platforms
    if (body.posting_schedule !== undefined) updateData.posting_schedule = body.posting_schedule
    if (body.logo_url !== undefined) updateData.logo_url = body.logo_url

    const { data, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .eq('telegram_id', telegramId) // Ensure user owns this project
      .select()
      .single()

    if (error) {
      console.error('Error updating project:', error)
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, project: data })
  } catch (error) {
    console.error('Error updating project:', error)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

// DELETE - Delete a project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const telegramId = getAuthenticatedUser(request)

  if (!telegramId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('telegram_id', telegramId) // Ensure user owns this project

  if (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
