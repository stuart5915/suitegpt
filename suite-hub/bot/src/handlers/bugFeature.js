import { EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import { getAppsList } from './apps.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * /bug - Report a bug for an app
 */
export async function handleBugCommand(interaction) {
    const appName = interaction.options.getString('app');
    const description = interaction.options.getString('description');
    const priority = interaction.options.getString('priority') || 'medium';

    // Create pending embed
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

    // Post to pending channel
    if (config.channels.pending) {
        const pendingChannel = await interaction.client.channels.fetch(config.channels.pending);
        if (pendingChannel) {
            const msg = await pendingChannel.send({ embeds: [embed] });
            await msg.react('🚀'); // Approve/ship
            await msg.react('❌'); // Reject

            // Store the spec for later (with fields matching approval handler expectations)
            const spec = {
                type: 'bug',
                title: `[${appName}] Bug: ${description.slice(0, 50)}...`,
                app: appName,
                description,
                priority,
                authorId: interaction.user.id,  // For rejection notification
                userId: interaction.user.id,
                messageId: msg.id
            };

            // Store spec in memory for reaction handler
            global.pendingSpecs = global.pendingSpecs || new Map();
            global.pendingSpecs.set(msg.id, spec);
        }
    }

    await interaction.reply({
        content: `✅ Bug report submitted for **${appName}**!\n\nCheck <#${config.channels.pending}> and react 🚀 to approve.`,
        ephemeral: true
    });
}

/**
 * /feature - Request a feature for an app
 */
export async function handleFeatureCommand(interaction) {
    const appName = interaction.options.getString('app');
    const description = interaction.options.getString('description');

    const embed = new EmbedBuilder()
        .setTitle(`✨ Feature Request: ${appName}`)
        .setDescription(description)
        .addFields(
            { name: 'App', value: appName, inline: true },
            { name: 'Requested by', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setColor('#6366F1')
        .setTimestamp();

    // Post to pending channel
    if (config.channels.pending) {
        const pendingChannel = await interaction.client.channels.fetch(config.channels.pending);
        if (pendingChannel) {
            const msg = await pendingChannel.send({ embeds: [embed] });
            await msg.react('🚀');
            await msg.react('❌');

            const spec = {
                type: 'feature',
                title: `[${appName}] Feature: ${description.slice(0, 50)}...`,
                app: appName,
                description,
                authorId: interaction.user.id,  // For rejection notification
                userId: interaction.user.id,
                messageId: msg.id
            };

            global.pendingSpecs = global.pendingSpecs || new Map();
            global.pendingSpecs.set(msg.id, spec);
        }
    }

    await interaction.reply({
        content: `✅ Feature request submitted for **${appName}**!\n\nCheck <#${config.channels.pending}> and react 🚀 to approve.`,
        ephemeral: true
    });
}

/**
 * Get app choices for autocomplete
 */
export function getAppChoices() {
    const apps = getAppsList();
    return apps
        .filter(app => app.status !== 'idea') // Only show live/dev apps
        .map(app => ({
            name: `${app.emoji} ${app.name}`,
            value: app.name
        }));
}
