/**
 * Credits Balance API
 * GET - Get user's credit balance
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/telegram/validate'
import { getCreditsBalance } from '@/lib/credits'

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN!
const sessionSecret = process.env.SESSION_SECRET || telegramBotToken
const SESSION_COOKIE_NAME = 'cadence_session'

function getAuthenticatedUser(request: NextRequest): string | null {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!sessionToken) return null

    const session = verifySessionToken(sessionToken, sessionSecret)
    return session?.telegram_id || null
}

export async function GET(request: NextRequest) {
    const telegramId = getAuthenticatedUser(request)

    if (!telegramId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const result = await getCreditsBalance({ telegramId })

        return NextResponse.json({
            balance: result.balance,
            isLinked: result.isLinked,
            walletAddress: result.walletAddress
        })
    } catch (error) {
        console.error('Credits balance error:', error)
        return NextResponse.json({ error: 'Failed to get balance' }, { status: 500 })
    }
}
