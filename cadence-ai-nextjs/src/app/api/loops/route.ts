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

// GET - Fetch loops for a user (optionally filtered by project)
export async function GET(request: NextRequest) {
  const telegramId = getAuthenticatedUser(request)

  if (!telegramId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const projectId = request.nextUrl.searchParams.get('project_id')

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  let query = supabase
    .from('cadence_loops')
    .select('*')
    .eq('telegram_id', telegramId)
    .order('created_at', { ascending: false })

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching loops:', error)
    return NextResponse.json({ error: 'Failed to fetch loops' }, { status: 500 })
  }

  // Transform database format to frontend format
  const loops = data.map(loop => ({
    id: loop.id,
    name: loop.name,
    emoji: loop.emoji,
    color: loop.color,
    description: loop.description,
    rotationDays: loop.rotation_days,
    isActive: loop.is_active,
    items: loop.items || [],
    audiences: loop.audiences || [],
    lastPosted: loop.last_posted,
    createdAt: loop.created_at,
  }))

  return NextResponse.json({ loops })
}

// POST - Create a new loop
export async function POST(request: NextRequest) {
  const telegramId = getAuthenticatedUser(request)

  if (!telegramId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data, error } = await supabase
      .from('cadence_loops')
      .insert({
        telegram_id: telegramId,
        project_id: body.projectId || null,
        name: body.name,
        emoji: body.emoji || '📝',
        color: body.color || '#6366f1',
        description: body.description || '',
        rotation_days: body.rotationDays || 7,
        is_active: body.isActive ?? true,
        items: body.items || [],
        audiences: body.audiences || [],
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating loop:', error)
      return NextResponse.json({ error: 'Failed to create loop' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      loop: {
        id: data.id,
        name: data.name,
        emoji: data.emoji,
        color: data.color,
        description: data.description,
        rotationDays: data.rotation_days,
        isActive: data.is_active,
        items: data.items || [],
        audiences: data.audiences || [],
        lastPosted: data.last_posted,
        createdAt: data.created_at,
      }
    })
  } catch (error) {
    console.error('Error creating loop:', error)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

// PUT - Update an existing loop
export async function PUT(request: NextRequest) {
  const telegramId = getAuthenticatedUser(request)

  if (!telegramId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json({ error: 'Loop ID required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.name !== undefined) updateData.name = body.name
    if (body.emoji !== undefined) updateData.emoji = body.emoji
    if (body.color !== undefined) updateData.color = body.color
    if (body.description !== undefined) updateData.description = body.description
    if (body.rotationDays !== undefined) updateData.rotation_days = body.rotationDays
    if (body.isActive !== undefined) updateData.is_active = body.isActive
    if (body.items !== undefined) updateData.items = body.items
    if (body.audiences !== undefined) updateData.audiences = body.audiences
    if (body.lastPosted !== undefined) updateData.last_posted = body.lastPosted

    const { data, error } = await supabase
      .from('cadence_loops')
      .update(updateData)
      .eq('id', body.id)
      .eq('telegram_id', telegramId) // Ensure user owns this loop
      .select()
      .single()

    if (error) {
      console.error('Error updating loop:', error)
      return NextResponse.json({ error: 'Failed to update loop' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Loop not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      loop: {
        id: data.id,
        name: data.name,
        emoji: data.emoji,
        color: data.color,
        description: data.description,
        rotationDays: data.rotation_days,
        isActive: data.is_active,
        items: data.items || [],
        audiences: data.audiences || [],
        lastPosted: data.last_posted,
        createdAt: data.created_at,
      }
    })
  } catch (error) {
    console.error('Error updating loop:', error)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

// DELETE - Delete a loop
export async function DELETE(request: NextRequest) {
  const telegramId = getAuthenticatedUser(request)

  if (!telegramId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const loopId = request.nextUrl.searchParams.get('id')

  if (!loopId) {
    return NextResponse.json({ error: 'Loop ID required' }, { status: 400 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { error } = await supabase
    .from('cadence_loops')
    .delete()
    .eq('id', loopId)
    .eq('telegram_id', telegramId) // Ensure user owns this loop

  if (error) {
    console.error('Error deleting loop:', error)
    return NextResponse.json({ error: 'Failed to delete loop' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
