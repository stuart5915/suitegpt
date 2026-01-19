import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE_NAME = 'cadence_session'

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true })

  // Clear session cookie
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // Expire immediately
    path: '/',
  })

  return response
}
