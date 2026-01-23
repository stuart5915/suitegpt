// ================================
// CADENCE EXTENSIONS - API HELPERS
// ================================

import { createClient } from '@/lib/supabase/client'
import {
    ExtensionSlug,
    UserExtension,
    ExtensionUsage,
    getExtension
} from './types'

const supabase = createClient()

// ================================
// USER EXTENSION MANAGEMENT
// ================================

export async function getUserExtensions(userId: string): Promise<UserExtension[]> {
    const { data, error } = await supabase
        .from('user_extensions')
        .select('*')
        .eq('user_id', userId)

    if (error) {
        console.error('Error fetching user extensions:', error)
        return []
    }

    return data || []
}

export async function isExtensionEnabled(userId: string, slug: ExtensionSlug): Promise<boolean> {
    const { data } = await supabase
        .from('user_extensions')
        .select('enabled')
        .eq('user_id', userId)
        .eq('extension_slug', slug)
        .single()

    return data?.enabled || false
}

export async function enableExtension(userId: string, slug: ExtensionSlug): Promise<boolean> {
    const { error } = await supabase
        .from('user_extensions')
        .upsert({
            user_id: userId,
            extension_slug: slug,
            enabled: true,
            settings: {},
            credits_used_today: 0,
            credits_used_month: 0
        }, {
            onConflict: 'user_id,extension_slug'
        })

    if (error) {
        console.error('Error enabling extension:', error)
        return false
    }

    return true
}

export async function disableExtension(userId: string, slug: ExtensionSlug): Promise<boolean> {
    const { error } = await supabase
        .from('user_extensions')
        .update({ enabled: false })
        .eq('user_id', userId)
        .eq('extension_slug', slug)

    if (error) {
        console.error('Error disabling extension:', error)
        return false
    }

    return true
}

export async function updateExtensionSettings(
    userId: string,
    slug: ExtensionSlug,
    settings: Record<string, unknown>
): Promise<boolean> {
    const { error } = await supabase
        .from('user_extensions')
        .update({ settings })
        .eq('user_id', userId)
        .eq('extension_slug', slug)

    if (error) {
        console.error('Error updating extension settings:', error)
        return false
    }

    return true
}

// ================================
// CREDIT MANAGEMENT
// ================================

export async function checkCredits(userId: string, slug: ExtensionSlug): Promise<{
    hasCredits: boolean
    required: number
    available: number
}> {
    const extension = getExtension(slug)
    if (!extension) {
        return { hasCredits: false, required: 0, available: 0 }
    }

    // Get user's credit balance
    const { data: userData } = await supabase
        .from('users')
        .select('credits')
        .eq('telegram_id', userId)
        .single()

    const available = userData?.credits || 0
    const required = extension.credit_cost.per_use || 0

    // Free extensions always have credits
    if (extension.credit_cost.free) {
        return { hasCredits: true, required: 0, available }
    }

    return {
        hasCredits: available >= required,
        required,
        available
    }
}

export async function spendCredits(
    userId: string,
    slug: ExtensionSlug,
    action: string,
    amount?: number
): Promise<boolean> {
    const extension = getExtension(slug)
    if (!extension) return false

    // Free extensions don't spend credits
    if (extension.credit_cost.free) {
        await logUsage(userId, slug, action, 0)
        return true
    }

    const creditsToSpend = amount || extension.credit_cost.per_use || 0
    if (creditsToSpend === 0) {
        await logUsage(userId, slug, action, 0)
        return true
    }

    // Deduct credits from user
    const { error: deductError } = await supabase.rpc('deduct_credits', {
        p_telegram_id: userId,
        p_amount: creditsToSpend
    })

    if (deductError) {
        console.error('Error deducting credits:', deductError)
        return false
    }

    // Update daily/monthly usage
    const { error: updateError } = await supabase
        .from('user_extensions')
        .update({
            credits_used_today: supabase.rpc('increment', { x: creditsToSpend }),
            credits_used_month: supabase.rpc('increment', { x: creditsToSpend }),
            last_used_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('extension_slug', slug)

    if (updateError) {
        console.error('Error updating usage:', updateError)
    }

    // Log the usage
    await logUsage(userId, slug, action, creditsToSpend)

    return true
}

// ================================
// USAGE LOGGING
// ================================

export async function logUsage(
    userId: string,
    slug: ExtensionSlug,
    action: string,
    creditsSpent: number,
    metadata?: Record<string, unknown>
): Promise<void> {
    const { error } = await supabase
        .from('extension_usage')
        .insert({
            user_id: userId,
            extension_slug: slug,
            action,
            credits_spent: creditsSpent,
            metadata
        })

    if (error) {
        console.error('Error logging usage:', error)
    }
}

export async function getUsageHistory(
    userId: string,
    slug?: ExtensionSlug,
    limit: number = 50
): Promise<ExtensionUsage[]> {
    let query = supabase
        .from('extension_usage')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (slug) {
        query = query.eq('extension_slug', slug)
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching usage history:', error)
        return []
    }

    return data || []
}

// ================================
// ENGAGEMENT RULES (Social Engager)
// ================================

export async function getEngagementRules(userId: string) {
    const { data, error } = await supabase
        .from('engagement_rules')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching engagement rules:', error)
        return []
    }

    return data || []
}

export async function createEngagementRule(rule: {
    user_id: string
    name: string
    platform: string
    type: string
    target: string
    action: string
    reply_template?: string
    daily_limit: number
}) {
    const { data, error } = await supabase
        .from('engagement_rules')
        .insert({
            ...rule,
            is_active: true,
            actions_today: 0
        })
        .select()
        .single()

    if (error) {
        console.error('Error creating engagement rule:', error)
        return null
    }

    return data
}

export async function toggleEngagementRule(ruleId: string, isActive: boolean) {
    const { error } = await supabase
        .from('engagement_rules')
        .update({ is_active: isActive })
        .eq('id', ruleId)

    if (error) {
        console.error('Error toggling engagement rule:', error)
        return false
    }

    return true
}

export async function deleteEngagementRule(ruleId: string) {
    const { error } = await supabase
        .from('engagement_rules')
        .delete()
        .eq('id', ruleId)

    if (error) {
        console.error('Error deleting engagement rule:', error)
        return false
    }

    return true
}
