import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySessionToken } from '@/lib/telegram/validate'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN!
const sessionSecret = process.env.SESSION_SECRET || telegramBotToken

const SESSION_COOKIE_NAME = 'cadence_session'

export async function GET(request: NextRequest) {
  try {
    // Get session cookie
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value

    if (!sessionToken) {
      return NextResponse.json(
        { user: null },
        { status: 200 }
      )
    }

    // Verify session token
    const session = verifySessionToken(sessionToken, sessionSecret)

    if (!session) {
      // Invalid or expired token
      const response = NextResponse.json(
        { user: null },
        { status: 200 }
      )
      // Clear invalid cookie
      response.cookies.delete(SESSION_COOKIE_NAME)
      return response
    }

    // Fetch user from database
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: user, error } = await supabase
      .from('cadence_users')
      .select('telegram_id, telegram_username, first_name, photo_url')
      .eq('telegram_id', session.telegram_id)
      .single()

    if (error || !user) {
      // User not found in database, but token is valid
      // Return minimal user data from token
      return NextResponse.json({
        user: {
          id: session.telegram_id,
          username: '',
          firstName: 'User',
          photoUrl: null,
        },
      })
    }

    return NextResponse.json({
      user: {
        id: user.telegram_id,
        username: user.telegram_username || '',
        firstName: user.first_name || 'User',
        photoUrl: user.photo_url,
      },
    })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { user: null },
      { status: 200 }
    )
  }
}
