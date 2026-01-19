import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateAndParseTelegramAuth, createSessionToken, TelegramAuthData } from '@/lib/telegram/validate'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN!
const sessionSecret = process.env.SESSION_SECRET || telegramBotToken

// Session cookie name
const SESSION_COOKIE_NAME = 'cadence_session'
// Session duration: 7 days
const SESSION_MAX_AGE = 7 * 24 * 60 * 60

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as TelegramAuthData

    if (!body.id) {
      return NextResponse.json(
        { error: 'Missing telegram user id' },
        { status: 400 }
      )
    }

    // Check if this is a mini app request (might not have hash)
    const isMiniApp = !body.hash || body.hash === ''

    // Validate Telegram auth data
    const validatedUser = validateAndParseTelegramAuth(body, telegramBotToken, {
      skipHashValidation: isMiniApp,
      maxAuthAgeSeconds: 86400 * 7, // Allow 7 day old auth for returning users
    })

    if (!validatedUser && !isMiniApp) {
      return NextResponse.json(
        { error: 'Invalid authentication data' },
        { status: 401 }
      )
    }

    // For mini app requests without hash validation, construct user from body
    const telegramUser = validatedUser || {
      id: body.id.toString(),
      username: body.username || '',
      firstName: body.first_name,
      lastName: body.last_name,
      photoUrl: body.photo_url || null,
    }

    // Create Supabase client with service role key for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Upsert user in cadence_users table
    const { data: upsertedUser, error: upsertError } = await supabase
      .from('cadence_users')
      .upsert(
        {
          telegram_id: telegramUser.id,
          telegram_username: telegramUser.username,
          first_name: telegramUser.firstName,
          photo_url: telegramUser.photoUrl,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'telegram_id',
        }
      )
      .select()
      .single()

    if (upsertError) {
      console.error('Error upserting user:', upsertError)
      // Continue anyway - user might not have the table yet
    }

    // Create session token
    const sessionToken = createSessionToken(telegramUser.id, sessionSecret)

    // Create response with user data
    const response = NextResponse.json({
      success: true,
      user: {
        id: telegramUser.id,
        username: telegramUser.username,
        firstName: telegramUser.firstName,
        photoUrl: telegramUser.photoUrl,
      },
    })

    // Set session cookie
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
