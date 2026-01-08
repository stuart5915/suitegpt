/**
 * SUITE Credits System
 * Handles user credits, free tier limits, and balance tracking
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Configuration
const FREE_TIER_LIMIT = 20;
const SUITE_PER_AD = 10; // SUITE credits per ad watched

/**
 * Get or create user credits record
 */
export async function getOrCreateUser(discordId, discordUsername = null) {
    // Try to get existing user
    let { data: user, error } = await supabase
        .from('user_credits')
        .select('*')
        .eq('discord_id', discordId)
        .single();

    if (error && error.code === 'PGRST116') {
        // User doesn't exist, create them
        const { data: newUser, error: createError } = await supabase
            .from('user_credits')
            .insert({
                discord_id: discordId,
                discord_username: discordUsername,
                free_actions_used: 0,
                suite_balance: 0
            })
            .select()
            .single();

        if (createError) {
            console.error('Error creating user credits:', createError);
            return null;
        }
        return newUser;
    }

    if (error) {
        console.error('Error getting user credits:', error);
        return null;
    }

    return user;
}

/**
 * Check if user can perform an action
 * Returns: { canAct: boolean, reason: string, remaining: number }
 */
export async function canPerformAction(discordId, discordUsername = null) {
    const user = await getOrCreateUser(discordId, discordUsername);
    if (!user) {
        return { canAct: false, reason: 'database_error', remaining: 0 };
    }

    const freeRemaining = FREE_TIER_LIMIT - user.free_actions_used;
    const suiteBalance = parseFloat(user.suite_balance) || 0;

    // Still have free actions?
    if (freeRemaining > 0) {
        return {
            canAct: true,
            reason: 'free_tier',
            remaining: freeRemaining,
            suiteBalance
        };
    }

    // Have SUITE balance?
    if (suiteBalance >= 1) {
        return {
            canAct: true,
            reason: 'suite_balance',
            remaining: Math.floor(suiteBalance),
            suiteBalance
        };
    }

    // No credits left
    return {
        canAct: false,
        reason: 'no_credits',
        remaining: 0,
        suiteBalance: 0
    };
}

/**
 * Use one action (deduct from free tier or SUITE balance)
 */
export async function useAction(discordId, discordUsername = null) {
    const user = await getOrCreateUser(discordId, discordUsername);
    if (!user) return false;

    const freeRemaining = FREE_TIER_LIMIT - user.free_actions_used;

    if (freeRemaining > 0) {
        // Deduct from free tier
        const { error } = await supabase
            .from('user_credits')
            .update({ free_actions_used: user.free_actions_used + 1 })
            .eq('discord_id', discordId);

        if (error) {
            console.error('Error updating free actions:', error);
            return false;
        }
        console.log(`[Credits] ${discordId} used free action (${freeRemaining - 1} remaining)`);
        return true;
    }

    const suiteBalance = parseFloat(user.suite_balance) || 0;
    if (suiteBalance >= 1) {
        // Deduct from SUITE balance
        const { error } = await supabase
            .from('user_credits')
            .update({ suite_balance: suiteBalance - 1 })
            .eq('discord_id', discordId);

        if (error) {
            console.error('Error updating suite balance:', error);
            return false;
        }
        console.log(`[Credits] ${discordId} used 1 SUITE (${suiteBalance - 1} remaining)`);
        return true;
    }

    return false;
}

/**
 * Add SUITE credits (from watching ads, deposits, etc.)
 */
export async function addCredits(discordId, amount, source = 'unknown') {
    const user = await getOrCreateUser(discordId);
    if (!user) return false;

    const newBalance = (parseFloat(user.suite_balance) || 0) + amount;
    const updates = { suite_balance: newBalance };

    // Track ad watches
    if (source === 'ad') {
        updates.total_ads_watched = (user.total_ads_watched || 0) + 1;
        updates.last_ad_watched = new Date().toISOString();
    }

    const { error } = await supabase
        .from('user_credits')
        .update(updates)
        .eq('discord_id', discordId);

    if (error) {
        console.error('Error adding credits:', error);
        return false;
    }

    console.log(`[Credits] Added ${amount} SUITE to ${discordId} (source: ${source})`);
    return true;
}

/**
 * Get user stats for display
 */
export async function getUserStats(discordId) {
    const user = await getOrCreateUser(discordId);
    if (!user) return null;

    return {
        freeActionsUsed: user.free_actions_used,
        freeActionsRemaining: Math.max(0, FREE_TIER_LIMIT - user.free_actions_used),
        suiteBalance: parseFloat(user.suite_balance) || 0,
        totalAdsWatched: user.total_ads_watched || 0,
        totalActionsAvailable: Math.max(0, FREE_TIER_LIMIT - user.free_actions_used) + (parseFloat(user.suite_balance) || 0)
    };
}

/**
 * Generate "Get SUITE" message for users who hit the limit
 */
export function getNoCreditsMessage() {
    return `**⚡ You've used your free tier!**

You've used all 20 free actions. To continue using AI features, you need SUITE tokens.

**How to get SUITE:**
💳 **Buy** - Deposit at getsuite.app/wallet
📺 **Watch Ads** - Coming soon!

Type \`/suite\` for more info!`;
}

export default {
    getOrCreateUser,
    canPerformAction,
    useAction,
    addCredits,
    getUserStats,
    getNoCreditsMessage,
    FREE_TIER_LIMIT,
    SUITE_PER_AD
};
