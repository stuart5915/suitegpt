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

// GET - Fetch user settings
export async function GET(request: NextRequest) {
  const telegramId = getAuthenticatedUser(request)

  if (!telegramId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data, error } = await supabase
    .from('cadence_user_settings')
    .select('*')
    .eq('telegram_id', telegramId)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found, which is okay for new users
    console.error('Error fetching settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }

  // Return default settings if none exist
  const settings = data || {
    telegram_id: telegramId,
    brand_voice: '',
    tone: 'casual',
    speaking_perspective: 'I',
    emoji_style: 'moderate',
    exclusion_words: '',
    default_hashtags: '',
  }

  // Transform to frontend format
  return NextResponse.json({
    settings: {
      brandVoice: settings.brand_voice || '',
      tone: settings.tone || 'casual',
      speakingPerspective: settings.speaking_perspective || 'I',
      emojiStyle: settings.emoji_style || 'moderate',
      exclusionWords: settings.exclusion_words || '',
      defaultHashtags: settings.default_hashtags || '',
    }
  })
}

// PUT - Update user settings
export async function PUT(request: NextRequest) {
  const telegramId = getAuthenticatedUser(request)

  if (!telegramId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Upsert settings (insert or update)
    const { data, error } = await supabase
      .from('cadence_user_settings')
      .upsert(
        {
          telegram_id: telegramId,
          brand_voice: body.brandVoice,
          tone: body.tone,
          speaking_perspective: body.speakingPerspective,
          emoji_style: body.emojiStyle,
          exclusion_words: body.exclusionWords,
          default_hashtags: body.defaultHashtags,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'telegram_id',
        }
      )
      .select()
      .single()

    if (error) {
      console.error('Error updating settings:', error)
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      settings: {
        brandVoice: data.brand_voice || '',
        tone: data.tone || 'casual',
        speakingPerspective: data.speaking_perspective || 'I',
        emojiStyle: data.emoji_style || 'moderate',
        exclusionWords: data.exclusion_words || '',
        defaultHashtags: data.default_hashtags || '',
      }
    })
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
