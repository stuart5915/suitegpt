import { NextResponse, type NextRequest } from 'next/server'

// Session cookie name (must match the one in API routes)
const SESSION_COOKIE_NAME = 'suitehub_session'

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Public routes that don't require auth
    const publicRoutes = ['/', '/login', '/signup', '/demo', '/auth/callback', '/privacy', '/terms', '/support']

    // Internal API routes that can be called server-to-server
    const internalApiRoutes = [
        '/api/auth/telegram', // Auth endpoints should be public
        '/api/chat', // Chat API
        '/api/memories', // Memories API
    ]

    const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/auth/')
    const isInternalApi = internalApiRoutes.some(route => pathname.startsWith(route))

    // Check for Telegram session cookie
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value
    const isAuthenticated = !!sessionCookie

    // Also check for Mini App URL params (tg_id)
    const hasTelegramParams = request.nextUrl.searchParams.has('tg_id')

    // If user has tg_id params and is on login, redirect to dashboard with params
    if (hasTelegramParams && pathname === '/login') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
    }

    // If user is not logged in and trying to access protected route
    if (!isAuthenticated && !hasTelegramParams && !isPublicRoute && !isInternalApi) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // If user is logged in and trying to access login page, redirect to dashboard
    if (isAuthenticated && pathname === '/login') {
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
