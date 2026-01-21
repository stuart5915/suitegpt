import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE_NAME = 'cadence_session'

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true })

  // Clear session cookie
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'none', // Match login cookie settings for cross-site iframe
    maxAge: 0, // Expire immediately
    path: '/',
  })

  return response
}
