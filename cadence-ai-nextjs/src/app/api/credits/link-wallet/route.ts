/**
 * Wallet Link API
 * POST - Link a wallet address to the user's account
 * DELETE - Unlink wallet from account
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/telegram/validate'
import { linkWallet, unlinkWallet, getCreditsBalance } from '@/lib/credits'

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN!
const sessionSecret = process.env.SESSION_SECRET || telegramBotToken
const SESSION_COOKIE_NAME = 'cadence_session'

function getAuthenticatedUser(request: NextRequest): string | null {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!sessionToken) return null

    const session = verifySessionToken(sessionToken, sessionSecret)
    return session?.telegram_id || null
}

export async function POST(request: NextRequest) {
    const telegramId = getAuthenticatedUser(request)

    if (!telegramId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { walletAddress, signature } = body

        if (!walletAddress) {
            return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 })
        }

        // Validate wallet address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
            return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 })
        }

        const result = await linkWallet(telegramId, walletAddress, signature || '')

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 })
        }

        // Get the new balance
        const balanceResult = await getCreditsBalance({ telegramId })

        return NextResponse.json({
            success: true,
            balance: balanceResult.balance,
            walletAddress: balanceResult.walletAddress
        })
    } catch (error) {
        console.error('Link wallet error:', error)
        return NextResponse.json({ error: 'Failed to link wallet' }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    const telegramId = getAuthenticatedUser(request)

    if (!telegramId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        await unlinkWallet(telegramId)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Unlink wallet error:', error)
        return NextResponse.json({ error: 'Failed to unlink wallet' }, { status: 500 })
    }
}
