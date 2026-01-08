import { EmbedBuilder } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// App metadata - add new apps here
const APPS = [
    { name: 'Cheshbon', folder: 'cheshbon-reflections', status: 'live', emoji: '📊', desc: 'Jewish financial reflection app' },
    { name: 'DeFi Knowledge', folder: 'defi-knowledge', status: 'live', emoji: '💎', desc: 'Learn DeFi concepts' },
    { name: 'OpticRep', folder: 'opticrep-ai-workout-trainer', status: 'testing', emoji: '💪', desc: 'AI workout trainer' },
    { name: 'REMcast', folder: 'remcast', status: 'testing', emoji: '😴', desc: 'Dream journal & analysis' },
    { name: 'TrueForm', folder: 'trueform-expo', status: 'created', emoji: '🏃', desc: 'AI posture analysis' },
    { name: 'FoodVitals', folder: 'food-vitals-expo', status: 'created', emoji: '🥗', desc: 'Nutrition tracking' },
    { name: 'LifeHub', folder: 'life-hub-app', status: 'created', emoji: '🧠', desc: 'Personal AI assistant' },
    { name: 'DealFinder', folder: 'cambridge-deals', status: 'created', emoji: '🏷️', desc: 'Local deal tracker' },
    { name: 'ContentBounty', folder: null, status: 'idea', emoji: '🎯', desc: 'Content creation marketplace' },
];

const STATUS_EMOJI = {
    live: '🟢',
    testing: '🧪',
    created: '🔨',
    idea: '💡',
};

const STATUS_ORDER = ['live', 'testing', 'created', 'idea'];

/**
 * /apps - List all apps with status
 */
export async function handleAppsCommand(interaction) {
    const liveApps = APPS.filter(a => a.status === 'live');
    const testingApps = APPS.filter(a => a.status === 'testing');
    const createdApps = APPS.filter(a => a.status === 'created');
    const ideaApps = APPS.filter(a => a.status === 'idea');

    const formatApp = (app) => `${app.emoji} **${app.name}** - ${app.desc}`;

    const embed = new EmbedBuilder()
        .setTitle('📱 SUITE Apps')
        .setColor('#6366F1')
        .addFields(
            {
                name: '🟢 Live (In Production)',
                value: liveApps.map(formatApp).join('\n') || 'None yet',
                inline: false
            },
            {
                name: '🧪 Testing (With Testers)',
                value: testingApps.map(formatApp).join('\n') || 'None',
                inline: false
            },
            {
                name: '🔨 Created (Just Started)',
                value: createdApps.map(formatApp).join('\n') || 'None',
                inline: false
            },
            {
                name: '💡 Ideas (On the Plate)',
                value: ideaApps.map(formatApp).join('\n') || 'None',
                inline: false
            }
        )
        .setFooter({ text: `${APPS.length} total apps • Use /promote or /demote to change status` })
        .setTimestamp();

    return await interaction.reply({ embeds: [embed], fetchReply: true });
}

/**
 * Get apps list for other handlers
 */
export function getAppsList() {
    return APPS;
}

/**
 * Add a new app idea (can be called programmatically)
 */
export function addAppIdea(name, description, emoji = '📱') {
    APPS.push({
        name,
        folder: null,
        status: 'idea',
        emoji,
        desc: description
    });
}

/**
 * /promote - Move app up one status level
 * idea → created → testing → live
 */
export async function handlePromoteCommand(interaction) {
    const appName = interaction.options.getString('app');

    const app = APPS.find(a => a.name.toLowerCase() === appName.toLowerCase());

    if (!app) {
        await interaction.reply({ content: `❌ App "${appName}" not found.`, ephemeral: true });
        return;
    }

    if (app.status === 'live') {
        await interaction.reply({ content: `🟢 **${app.name}** is already live!`, ephemeral: true });
        return;
    }

    const oldStatus = app.status;

    // Move up one level
    if (app.status === 'idea') {
        app.status = 'created';
    } else if (app.status === 'created') {
        app.status = 'testing';
    } else if (app.status === 'testing') {
        app.status = 'live';
    }

    const newStatus = app.status;

    await interaction.reply({
        content: `🚀 **${app.name}** promoted!\n\n${STATUS_EMOJI[oldStatus]} ${oldStatus} → ${STATUS_EMOJI[newStatus]} ${newStatus}`
    });
}

/**
 * /demote - Move app down one status level
 * live → testing → created → idea
 */
export async function handleDemoteCommand(interaction) {
    const appName = interaction.options.getString('app');

    const app = APPS.find(a => a.name.toLowerCase() === appName.toLowerCase());

    if (!app) {
        await interaction.reply({ content: `❌ App "${appName}" not found.`, ephemeral: true });
        return;
    }

    if (app.status === 'idea') {
        await interaction.reply({ content: `💡 **${app.name}** is already an idea. Use /delete-app to remove.`, ephemeral: true });
        return;
    }

    const oldStatus = app.status;

    // Move down one level
    if (app.status === 'live') {
        app.status = 'testing';
    } else if (app.status === 'testing') {
        app.status = 'created';
    } else if (app.status === 'created') {
        app.status = 'idea';
    }

    const newStatus = app.status;

    await interaction.reply({
        content: `⬇️ **${app.name}** demoted.\n\n${STATUS_EMOJI[oldStatus]} ${oldStatus} → ${STATUS_EMOJI[newStatus]} ${newStatus}`
    });
}
