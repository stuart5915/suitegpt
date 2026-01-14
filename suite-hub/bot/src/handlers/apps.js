import { EmbedBuilder } from 'discord.js';

// Supabase config - use the main SUITE project
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const STATUS_EMOJI = {
    approved: '🟢',
    featured: '⭐',
    live: '🟢',
    pending: '🔨',
    rejected: '❌',
    removed: '🗑️',
};

/**
 * Fetch apps from Supabase `apps` table
 */
async function fetchAppsFromSupabase() {
    if (!SUPABASE_SERVICE_KEY) {
        console.error('SUPABASE_SERVICE_KEY not configured');
        return [];
    }

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/apps?select=*&order=name`, {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            }
        });

        if (!response.ok) {
            console.error('Failed to fetch apps:', await response.text());
            return [];
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching apps:', error);
        return [];
    }
}

/**
 * /apps - List all apps with status (fetched from Supabase)
 */
export async function handleAppsCommand(interaction) {
    await interaction.deferReply();

    const apps = await fetchAppsFromSupabase();

    if (apps.length === 0) {
        await interaction.editReply({
            content: '❌ Could not fetch apps. Check Supabase connection.'
        });
        return;
    }

    // Group by status
    const liveApps = apps.filter(a => a.status === 'approved' || a.status === 'live' || a.status === 'featured');
    const pendingApps = apps.filter(a => a.status === 'pending');

    const formatApp = (app) => {
        const emoji = app.icon_url ? '' : '📱';
        const url = app.app_url ? `[Open](${app.app_url})` : '';
        return `**${app.name}** — ${app.description?.slice(0, 50) || 'No description'}${app.description?.length > 50 ? '...' : ''} ${url}`;
    };

    const embed = new EmbedBuilder()
        .setTitle('📱 SUITE App Store')
        .setColor('#6366F1')
        .setDescription(`Browse all apps at [getsuite.app/apps](https://getsuite.app/apps)`)
        .setTimestamp();

    if (liveApps.length > 0) {
        embed.addFields({
            name: `🟢 Live Apps (${liveApps.length})`,
            value: liveApps.slice(0, 10).map(formatApp).join('\n') || 'None',
            inline: false
        });
    }

    if (pendingApps.length > 0) {
        embed.addFields({
            name: `🔨 In Development (${pendingApps.length})`,
            value: pendingApps.slice(0, 5).map(formatApp).join('\n') || 'None',
            inline: false
        });
    }

    embed.setFooter({ text: `${apps.length} total apps in database` });

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Get apps list for other handlers (fetches from Supabase)
 */
export async function getAppsList() {
    return await fetchAppsFromSupabase();
}

/**
 * /promote - Update app status in Supabase
 */
export async function handlePromoteCommand(interaction) {
    const appName = interaction.options.getString('app');

    if (!SUPABASE_SERVICE_KEY) {
        await interaction.reply({ content: '❌ SUPABASE_SERVICE_KEY not configured.', ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        // Update status to approved
        const response = await fetch(`${SUPABASE_URL}/rest/v1/apps?name=eq.${encodeURIComponent(appName)}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ status: 'approved' })
        });

        if (response.ok) {
            const updated = await response.json();
            if (updated.length > 0) {
                await interaction.editReply({
                    content: `🚀 **${appName}** promoted to **approved** (live)!`
                });
            } else {
                await interaction.editReply({
                    content: `❌ App "${appName}" not found in database.`
                });
            }
        } else {
            await interaction.editReply({
                content: `❌ Failed to promote: ${await response.text()}`
            });
        }
    } catch (error) {
        console.error('Promote error:', error);
        await interaction.editReply({ content: `❌ Error: ${error.message}` });
    }
}

/**
 * /demote - Update app status to pending in Supabase
 */
export async function handleDemoteCommand(interaction) {
    const appName = interaction.options.getString('app');

    if (!SUPABASE_SERVICE_KEY) {
        await interaction.reply({ content: '❌ SUPABASE_SERVICE_KEY not configured.', ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        // Update status to pending
        const response = await fetch(`${SUPABASE_URL}/rest/v1/apps?name=eq.${encodeURIComponent(appName)}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ status: 'pending' })
        });

        if (response.ok) {
            const updated = await response.json();
            if (updated.length > 0) {
                await interaction.editReply({
                    content: `⬇️ **${appName}** demoted to **pending** (offline).`
                });
            } else {
                await interaction.editReply({
                    content: `❌ App "${appName}" not found in database.`
                });
            }
        } else {
            await interaction.editReply({
                content: `❌ Failed to demote: ${await response.text()}`
            });
        }
    } catch (error) {
        console.error('Demote error:', error);
        await interaction.editReply({ content: `❌ Error: ${error.message}` });
    }
}
