import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../config.js';
import { getAppsList } from './apps.js';

// Store pending submissions waiting for confirmation
export const pendingSubmissions = new Map();

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

/**
 * Check if user has pro mode enabled (skip confirmation)
 */
async function hasProMode(userId) {
    if (!SUPABASE_SERVICE_KEY) return false;

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/forge_credits?discord_id=eq.${userId}&select=pro_mode`, {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            }
        });

        const users = await response.json();
        return users?.[0]?.pro_mode === true;
    } catch {
        return false;
    }
}

/**
 * Enable pro mode for user (skip future confirmations)
 */
async function enableProMode(userId) {
    if (!SUPABASE_SERVICE_KEY) return;

    try {
        // Update or insert
        await fetch(`${SUPABASE_URL}/rest/v1/forge_credits?discord_id=eq.${userId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            },
            body: JSON.stringify({ pro_mode: true })
        });
    } catch (error) {
        console.error('Error enabling pro mode:', error);
    }
}

/**
 * Actually submit the bug/feature to pending channel
 */
async function submitToPending(client, submission) {
    const { type, appName, description, priority, userId, embed } = submission;

    if (!config.channels.pending) return null;

    const pendingChannel = await client.channels.fetch(config.channels.pending);
    if (!pendingChannel) return null;

    const msg = await pendingChannel.send({ embeds: [embed] });
    await msg.react('🚀');
    await msg.react('❌');

    const spec = {
        type,
        title: `[${appName}] ${type === 'bug' ? 'Bug' : 'Feature'}: ${description.slice(0, 50)}...`,
        app: appName,
        description,
        priority: priority || 'medium',
        authorId: userId,
        userId: userId,
        messageId: msg.id
    };

    global.pendingSpecs = global.pendingSpecs || new Map();
    global.pendingSpecs.set(msg.id, spec);

    return msg;
}

/**
 * /bug - Report a bug for an app
 */
export async function handleBugCommand(interaction) {
    const appName = interaction.options.getString('app');
    const description = interaction.options.getString('description');
    const priority = interaction.options.getString('priority') || 'medium';

    // Check if user has pro mode
    const isPro = await hasProMode(interaction.user.id);

    // Create the embed
    const embed = new EmbedBuilder()
        .setTitle(`🐛 Bug Report: ${appName}`)
        .setDescription(description)
        .addFields(
            { name: 'App', value: appName, inline: true },
            { name: 'Priority', value: priority.toUpperCase(), inline: true },
            { name: 'Reported by', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setColor(priority === 'high' ? '#EF4444' : priority === 'low' ? '#22C55E' : '#F59E0B')
        .setTimestamp();

    if (isPro) {
        // Pro mode - skip confirmation, submit directly
        await submitToPending(interaction.client, {
            type: 'bug',
            appName,
            description,
            priority,
            userId: interaction.user.id,
            embed
        });

        await interaction.reply({
            content: `✅ Bug report submitted for **${appName}**!\n\n*Pro Mode: Confirmation skipped*`,
            ephemeral: true
        });
        return;
    }

    // Store for confirmation
    const confirmId = `bug_${interaction.user.id}_${Date.now()}`;
    pendingSubmissions.set(confirmId, {
        type: 'bug',
        appName,
        description,
        priority,
        userId: interaction.user.id,
        embed,
        timestamp: Date.now()
    });

    // Show confirmation with buttons
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_submit_${confirmId}`)
                .setLabel('✅ I Understand, Submit')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`cancel_submit_${confirmId}`)
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`pro_mode_${confirmId}`)
                .setLabel('🚀 Pro Mode (Don\'t Ask Again)')
                .setStyle(ButtonStyle.Primary)
        );

    await interaction.reply({
        content: `## ⚠️ Submission Confirmation

> **You are about to submit a bug report for ${appName}**

This report may trigger **AI-powered code changes** to a **LIVE application**.

**Please be aware:**
• 🤖 An AI agent will analyze and potentially modify the app's codebase
• 👥 Changes may affect all users of this app
• 🚫 False or spam reports will result in **suspension**
• 📋 Your Discord ID is logged with this submission

---
**Your report:** ${description.slice(0, 100)}${description.length > 100 ? '...' : ''}`,
        components: [row],
        ephemeral: true
    });
}

/**
 * /feature - Request a feature for an app
 */
export async function handleFeatureCommand(interaction) {
    const appName = interaction.options.getString('app');
    const description = interaction.options.getString('description');

    // Check if user has pro mode
    const isPro = await hasProMode(interaction.user.id);

    const embed = new EmbedBuilder()
        .setTitle(`✨ Feature Request: ${appName}`)
        .setDescription(description)
        .addFields(
            { name: 'App', value: appName, inline: true },
            { name: 'Requested by', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setColor('#6366F1')
        .setTimestamp();

    if (isPro) {
        // Pro mode - skip confirmation
        await submitToPending(interaction.client, {
            type: 'feature',
            appName,
            description,
            userId: interaction.user.id,
            embed
        });

        await interaction.reply({
            content: `✅ Feature request submitted for **${appName}**!\n\n*Pro Mode: Confirmation skipped*`,
            ephemeral: true
        });
        return;
    }

    // Store for confirmation
    const confirmId = `feature_${interaction.user.id}_${Date.now()}`;
    pendingSubmissions.set(confirmId, {
        type: 'feature',
        appName,
        description,
        userId: interaction.user.id,
        embed,
        timestamp: Date.now()
    });

    // Show confirmation with buttons
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_submit_${confirmId}`)
                .setLabel('✅ I Understand, Submit')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`cancel_submit_${confirmId}`)
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`pro_mode_${confirmId}`)
                .setLabel('🚀 Pro Mode (Don\'t Ask Again)')
                .setStyle(ButtonStyle.Primary)
        );

    await interaction.reply({
        content: `## ⚠️ Submission Confirmation

> **You are about to submit a feature request for ${appName}**

This request may trigger **AI-powered code changes** to a **LIVE application**.

**Please be aware:**
• 🤖 An AI agent will analyze and potentially modify the app's codebase
• 👥 Changes may affect all users of this app
• 🚫 Spam or low-quality requests will result in **suspension**
• 📋 Your Discord ID is logged with this submission

---
**Your request:** ${description.slice(0, 100)}${description.length > 100 ? '...' : ''}`,
        components: [row],
        ephemeral: true
    });
}

/**
 * Handle confirmation button clicks
 */
export async function handleSubmissionConfirmation(interaction) {
    const customId = interaction.customId;

    // Extract the confirmId from customId
    let confirmId;
    if (customId.startsWith('confirm_submit_')) {
        confirmId = customId.replace('confirm_submit_', '');
    } else if (customId.startsWith('cancel_submit_')) {
        confirmId = customId.replace('cancel_submit_', '');
    } else if (customId.startsWith('pro_mode_')) {
        confirmId = customId.replace('pro_mode_', '');
    } else {
        return false; // Not our button
    }

    const submission = pendingSubmissions.get(confirmId);

    if (!submission) {
        await interaction.update({
            content: '❌ This submission has expired. Please try again.',
            components: []
        });
        return true;
    }

    // Verify it's the same user
    if (submission.userId !== interaction.user.id) {
        await interaction.reply({ content: '❌ This is not your submission.', ephemeral: true });
        return true;
    }

    if (customId.startsWith('confirm_submit_')) {
        // Submit to pending
        await submitToPending(interaction.client, submission);

        await interaction.update({
            content: `✅ **${submission.type === 'bug' ? 'Bug report' : 'Feature request'}** submitted for **${submission.appName}**!\n\nCheck <#${config.channels.pending}> for status.`,
            components: []
        });

    } else if (customId.startsWith('cancel_submit_')) {
        // Cancel
        await interaction.update({
            content: '❌ Submission cancelled.',
            components: []
        });

    } else if (customId.startsWith('pro_mode_')) {
        // Enable pro mode and submit
        await enableProMode(interaction.user.id);
        await submitToPending(interaction.client, submission);

        await interaction.update({
            content: `✅ **${submission.type === 'bug' ? 'Bug report' : 'Feature request'}** submitted for **${submission.appName}**!\n\n🚀 **Pro Mode enabled!** Future submissions will skip this confirmation.`,
            components: []
        });
    }

    // Clean up
    pendingSubmissions.delete(confirmId);
    return true;
}

/**
 * Get app choices for autocomplete
 */
export function getAppChoices() {
    const apps = getAppsList();
    return apps
        .filter(app => app.status !== 'idea')
        .map(app => ({
            name: `${app.emoji} ${app.name}`,
            value: app.name
        }));
}
