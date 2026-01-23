import { NextResponse, type NextRequest } from 'next/server'

// Session cookie name (must match the one in API routes)
const SESSION_COOKIE_NAME = 'cadence_session'

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Public routes that don't require auth
    const publicRoutes = ['/login', '/auth/callback']

    // Internal API routes that can be called server-to-server
    const internalApiRoutes = [
        '/api/generate-dev-update-image',
        '/api/generate-fleet-image',
        '/api/generate-post',
        '/api/work-log/cron',
        '/api/auth/telegram', // Auth endpoints should be public
        '/api/twitter/latest-poll', // Public poll embed API
        '/api/ai/', // AI endpoints for extensions
    ]

    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
    const isInternalApi = internalApiRoutes.some(route => pathname.startsWith(route))

    // Check for Telegram session cookie
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value
    const isAuthenticated = !!sessionCookie

    // Also check for Mini App URL params (tg_id)
    const hasTelegramParams = request.nextUrl.searchParams.has('tg_id')

    // If user has tg_id params and is on root or login, redirect to dashboard with params
    if (hasTelegramParams && (pathname === '/' || pathname === '/login')) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        // Preserve all search params (tg_id, tg_username, etc.)
        return NextResponse.redirect(url)
    }

    // If user is not logged in and trying to access protected route
    if (!isAuthenticated && !hasTelegramParams && !isPublicRoute && !isInternalApi) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // If user is logged in and trying to access login page (without tg params)
    if (isAuthenticated && pathname === '/login' && !hasTelegramParams) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
