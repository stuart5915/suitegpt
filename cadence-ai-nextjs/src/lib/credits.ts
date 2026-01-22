/**
 * Credits System for Cadence AI
 * Handles credit checking, deduction, and balance management
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Credit costs for different features
export const CREDIT_COSTS = {
    // Instagram
    instagram_comment_suggestion: 25,  // 3 suggestions

    // Twitter/X
    twitter_reply_suggestion: 25,      // 3 suggestions

    // Content Generation
    brand_voice_generation: 50,
    content_pillar_suggestions: 50,
    weekly_content_plan: 100,
    loop_item_generation: 50,

    // Articles
    article_generation: 150,
    article_image_generation: 75
} as const

export type CreditFeature = keyof typeof CREDIT_COSTS

// Suite users table structure (from main SUITE database)
interface SuiteUser {
    id: string
    wallet_address: string
    credits: number
    email?: string
}

// Get Supabase client for SUITE main database
export function getSuiteSupabase(): SupabaseClient {
    const supabaseUrl = process.env.SUITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUITE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
    return createClient(supabaseUrl, supabaseServiceKey)
}

// Get Cadence Supabase client
export function getCadenceSupabase(): SupabaseClient {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    return createClient(supabaseUrl, supabaseServiceKey)
}

/**
 * Check if a user has enough credits for a feature
 */
export async function checkCredits(
    identifier: { telegramId?: string; walletAddress?: string },
    feature: CreditFeature
): Promise<{ hasCredits: boolean; balance: number; required: number }> {
    const required = CREDIT_COSTS[feature]

    // First, check if telegram user has linked wallet
    if (identifier.telegramId) {
        const cadenceDb = getCadenceSupabase()
        const { data: walletLink } = await cadenceDb
            .from('cadence_wallet_links')
            .select('wallet_address')
            .eq('telegram_id', identifier.telegramId)
            .single()

        if (walletLink?.wallet_address) {
            identifier.walletAddress = walletLink.wallet_address
        }
    }

    // If we have a wallet address, check SUITE credits
    if (identifier.walletAddress) {
        const suiteDb = getSuiteSupabase()
        const { data: user } = await suiteDb
            .from('users')
            .select('credits')
            .eq('wallet_address', identifier.walletAddress.toLowerCase())
            .single()

        const balance = user?.credits || 0
        return {
            hasCredits: balance >= required,
            balance,
            required
        }
    }

    // No wallet linked - return free tier (limited credits)
    // For now, allow unlimited usage for unlinked users (demo mode)
    return {
        hasCredits: true,
        balance: 999999,
        required
    }
}

/**
 * Deduct credits from a user's balance
 */
export async function deductCredits(
    identifier: { telegramId?: string; walletAddress?: string },
    feature: CreditFeature,
    description?: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    const amount = CREDIT_COSTS[feature]

    // First, check if telegram user has linked wallet
    let walletAddress = identifier.walletAddress
    if (identifier.telegramId && !walletAddress) {
        const cadenceDb = getCadenceSupabase()
        const { data: walletLink } = await cadenceDb
            .from('cadence_wallet_links')
            .select('wallet_address')
            .eq('telegram_id', identifier.telegramId)
            .single()

        if (walletLink?.wallet_address) {
            walletAddress = walletLink.wallet_address
        }
    }

    // If no wallet linked, allow free usage (demo mode)
    if (!walletAddress) {
        // Log the usage anyway for analytics
        const cadenceDb = getCadenceSupabase()
        await cadenceDb.from('cadence_credit_transactions').insert({
            telegram_id: identifier.telegramId,
            amount: 0,  // Free usage
            type: 'ai_usage',
            feature,
            description: description || `${feature} (demo mode)`
        })

        return { success: true, newBalance: 999999 }
    }

    const suiteDb = getSuiteSupabase()

    // Get current balance
    const { data: user, error: fetchError } = await suiteDb
        .from('users')
        .select('id, credits')
        .eq('wallet_address', walletAddress.toLowerCase())
        .single()

    if (fetchError || !user) {
        return { success: false, error: 'User not found' }
    }

    if (user.credits < amount) {
        return { success: false, error: 'Insufficient credits' }
    }

    // Deduct credits
    const newBalance = user.credits - amount
    const { error: updateError } = await suiteDb
        .from('users')
        .update({ credits: newBalance })
        .eq('id', user.id)

    if (updateError) {
        console.error('Failed to deduct credits:', updateError)
        return { success: false, error: 'Failed to deduct credits' }
    }

    // Log the transaction in SUITE
    await suiteDb.from('credit_transactions').insert({
        user_id: user.id,
        amount: -amount,
        type: 'ai_usage',
        description: description || `Cadence AI: ${feature}`
    })

    // Also log in Cadence for local tracking
    const cadenceDb = getCadenceSupabase()
    await cadenceDb.from('cadence_credit_transactions').insert({
        telegram_id: identifier.telegramId,
        wallet_address: walletAddress,
        amount: -amount,
        type: 'ai_usage',
        feature,
        description: description || `${feature}`
    })

    return { success: true, newBalance }
}

/**
 * Get user's credit balance
 */
export async function getCreditsBalance(
    identifier: { telegramId?: string; walletAddress?: string }
): Promise<{ balance: number; isLinked: boolean; walletAddress?: string }> {
    // Check for linked wallet
    let walletAddress = identifier.walletAddress
    if (identifier.telegramId && !walletAddress) {
        const cadenceDb = getCadenceSupabase()
        const { data: walletLink } = await cadenceDb
            .from('cadence_wallet_links')
            .select('wallet_address')
            .eq('telegram_id', identifier.telegramId)
            .single()

        if (walletLink?.wallet_address) {
            walletAddress = walletLink.wallet_address
        }
    }

    if (!walletAddress) {
        return { balance: 0, isLinked: false }
    }

    const suiteDb = getSuiteSupabase()
    const { data: user } = await suiteDb
        .from('users')
        .select('credits')
        .eq('wallet_address', walletAddress.toLowerCase())
        .single()

    return {
        balance: user?.credits || 0,
        isLinked: true,
        walletAddress
    }
}

/**
 * Link a wallet address to a Telegram user
 */
export async function linkWallet(
    telegramId: string,
    walletAddress: string,
    signature: string
): Promise<{ success: boolean; error?: string }> {
    // In production, verify the signature here
    // For now, just link the wallet

    const cadenceDb = getCadenceSupabase()

    // Check if wallet is already linked to another user
    const { data: existingLink } = await cadenceDb
        .from('cadence_wallet_links')
        .select('telegram_id')
        .eq('wallet_address', walletAddress.toLowerCase())
        .single()

    if (existingLink && existingLink.telegram_id !== telegramId) {
        return { success: false, error: 'Wallet already linked to another account' }
    }

    // Upsert the link
    const { error } = await cadenceDb
        .from('cadence_wallet_links')
        .upsert({
            telegram_id: telegramId,
            wallet_address: walletAddress.toLowerCase()
        }, {
            onConflict: 'telegram_id'
        })

    if (error) {
        console.error('Failed to link wallet:', error)
        return { success: false, error: 'Failed to link wallet' }
    }

    return { success: true }
}

/**
 * Unlink a wallet from a Telegram user
 */
export async function unlinkWallet(telegramId: string): Promise<{ success: boolean }> {
    const cadenceDb = getCadenceSupabase()

    await cadenceDb
        .from('cadence_wallet_links')
        .delete()
        .eq('telegram_id', telegramId)

    return { success: true }
}
