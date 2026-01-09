import { config } from '../config.js';
import { EmbedBuilder } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// App slug to display name mapping
const appNames = {
    'cheshbon-reflections': 'Cheshbon',
    'food-vitals-expo': 'FoodVitals',
    'opticrep-ai-workout-trainer': 'OpticRep',
    'life-hub-app': 'LifeHub',
    'remcast': 'REMcast',
    'defi-knowledge': 'DeFi Knowledge',
    'trueform-ai-physiotherapist': 'TrueForm'
};

// Pro queue storage (in-memory for now)
const proQueue = [];

// Pro tier pricing in SUITE tokens
const PRO_COST = 500;

// Office hours (EST)
const OFFICE_HOURS = {
    start: 9,  // 9 AM
    end: 17,   // 5 PM
    days: [1, 2, 3, 4, 5]  // Monday-Friday
};

/**
 * Check if currently within office hours
 */
function isOfficeHours() {
    const now = new Date();
    // Convert to EST
    const est = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const hour = est.getHours();
    const day = est.getDay();

    return OFFICE_HOURS.days.includes(day) &&
        hour >= OFFICE_HOURS.start &&
        hour < OFFICE_HOURS.end;
}

/**
 * Get next available slot message
 */
function getNextSlotMessage() {
    const now = new Date();
    const est = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const hour = est.getHours();
    const day = est.getDay();

    if (OFFICE_HOURS.days.includes(day) && hour < OFFICE_HOURS.start) {
        return `Today at ${OFFICE_HOURS.start} AM EST`;
    } else if (day === 5 && hour >= OFFICE_HOURS.end) {
        return 'Monday at 9 AM EST';
    } else if (day === 6) {
        return 'Monday at 9 AM EST';
    } else if (day === 0) {
        return 'Monday at 9 AM EST';
    } else {
        return `Tomorrow at ${OFFICE_HOURS.start} AM EST`;
    }
}

/**
 * Handle /feature-pro command - Human developer with AI assistance
 */
export async function handleFeaturePro(interaction) {
    const app = interaction.options.getString('app');
    const description = interaction.options.getString('description');
    const appName = appNames[app] || app;
    const userId = interaction.user.id;

    // Check if office hours
    const inOfficeHours = isOfficeHours();
    const queuePosition = proQueue.length + 1;

    // Create the queue entry
    const queueEntry = {
        id: Date.now(),
        type: 'feature',
        app,
        appName,
        description,
        userId,
        username: interaction.user.username,
        timestamp: new Date().toISOString(),
        status: 'pending'
    };
    proQueue.push(queueEntry);

    // Create embed for user response
    const embed = new EmbedBuilder()
        .setTitle(`👨‍💻 Pro Feature Request: ${appName}`)
        .setDescription(`**${description.slice(0, 200)}${description.length > 200 ? '...' : ''}**`)
        .setColor('#8B5CF6')
        .addFields(
            { name: '📱 App', value: appName, inline: true },
            { name: '📍 Queue Position', value: `#${queuePosition}`, inline: true },
            { name: '💰 Cost', value: `${PRO_COST} SUITE`, inline: true }
        );

    if (inOfficeHours) {
        embed.addFields({
            name: '⏱️ Estimated Time',
            value: '5-15 minutes\n*(Developer is available now!)*'
        });
    } else {
        embed.addFields({
            name: '⏱️ Next Available',
            value: `${getNextSlotMessage()}\n*Pro requests handled during office hours*`
        });
    }

    embed.setFooter({ text: '👨‍💻 Pro Mode: Human developer + AI for best results' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Post to pro-queue channel for developer pickup
    try {
        // Try to post to a pro-queue channel (needs to be configured)
        const proQueueChannelId = config.channels.proQueue || config.channels.pending;
        if (proQueueChannelId) {
            const channel = await interaction.client.channels.fetch(proQueueChannelId);

            const queueEmbed = new EmbedBuilder()
                .setTitle(`🎫 PRO REQUEST #${queueEntry.id}`)
                .setDescription(`**Feature:** ${description}`)
                .setColor('#8B5CF6')
                .addFields(
                    { name: '📱 App', value: appName, inline: true },
                    { name: '👤 User', value: `<@${userId}>`, inline: true },
                    { name: '💰 Cost', value: `${PRO_COST} SUITE`, inline: true }
                )
                .setFooter({ text: 'React with ✅ when complete, ❌ to reject' })
                .setTimestamp();

            const queueMsg = await channel.send({
                content: `<@${config.ownerId}> New Pro request!`,
                embeds: [queueEmbed]
            });

            // Add reactions for workflow
            await queueMsg.react('✅');
            await queueMsg.react('❌');
        }
    } catch (err) {
        console.log('Could not post to pro-queue channel:', err.message);
    }

    // Also save to file for persistence
    try {
        const queueDir = path.join(__dirname, '../../../pro-queue');
        await fs.mkdir(queueDir, { recursive: true });
        const filePath = path.join(queueDir, `pro_${queueEntry.id}.json`);
        await fs.writeFile(filePath, JSON.stringify(queueEntry, null, 2));
        console.log(`[Pro] Saved queue entry: pro_${queueEntry.id}.json`);
    } catch (err) {
        console.error('Could not save pro queue entry:', err);
    }

    console.log(`[FeaturePro] ${interaction.user.username} requested: ${description.slice(0, 50)}...`);
}

/**
 * Handle /bug-pro command - Human developer fixes bug with AI
 */
export async function handleBugPro(interaction) {
    const app = interaction.options.getString('app');
    const bugDescription = interaction.options.getString('bug_description');
    const appName = appNames[app] || app;
    const userId = interaction.user.id;

    const inOfficeHours = isOfficeHours();
    const queuePosition = proQueue.length + 1;

    const queueEntry = {
        id: Date.now(),
        type: 'bug',
        app,
        appName,
        description: bugDescription,
        userId,
        username: interaction.user.username,
        timestamp: new Date().toISOString(),
        status: 'pending'
    };
    proQueue.push(queueEntry);

    const embed = new EmbedBuilder()
        .setTitle(`👨‍💻 Pro Bug Fix: ${appName}`)
        .setDescription(`**${bugDescription.slice(0, 200)}${bugDescription.length > 200 ? '...' : ''}**`)
        .setColor('#EF4444')
        .addFields(
            { name: '📱 App', value: appName, inline: true },
            { name: '📍 Queue Position', value: `#${queuePosition}`, inline: true },
            { name: '💰 Cost', value: `${PRO_COST} SUITE`, inline: true }
        );

    if (inOfficeHours) {
        embed.addFields({
            name: '⏱️ Estimated Time',
            value: '5-15 minutes\n*(Developer is available now!)*'
        });
    } else {
        embed.addFields({
            name: '⏱️ Next Available',
            value: `${getNextSlotMessage()}\n*Pro requests handled during office hours*`
        });
    }

    embed.setFooter({ text: '👨‍💻 Pro Mode: Human developer + AI for guaranteed fixes' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Post to pro-queue channel
    try {
        const proQueueChannelId = config.channels.proQueue || config.channels.pending;
        if (proQueueChannelId) {
            const channel = await interaction.client.channels.fetch(proQueueChannelId);

            const queueEmbed = new EmbedBuilder()
                .setTitle(`🎫 PRO BUG FIX #${queueEntry.id}`)
                .setDescription(`**Bug:** ${bugDescription}`)
                .setColor('#EF4444')
                .addFields(
                    { name: '📱 App', value: appName, inline: true },
                    { name: '👤 User', value: `<@${userId}>`, inline: true },
                    { name: '💰 Cost', value: `${PRO_COST} SUITE`, inline: true }
                )
                .setFooter({ text: 'React with ✅ when complete, ❌ to reject' })
                .setTimestamp();

            const queueMsg = await channel.send({
                content: `<@${config.ownerId}> New Pro bug fix!`,
                embeds: [queueEmbed]
            });

            await queueMsg.react('✅');
            await queueMsg.react('❌');
        }
    } catch (err) {
        console.log('Could not post to pro-queue channel:', err.message);
    }

    // Save to file
    try {
        const queueDir = path.join(__dirname, '../../../pro-queue');
        await fs.mkdir(queueDir, { recursive: true });
        const filePath = path.join(queueDir, `pro_${queueEntry.id}.json`);
        await fs.writeFile(filePath, JSON.stringify(queueEntry, null, 2));
    } catch (err) {
        console.error('Could not save pro queue entry:', err);
    }

    console.log(`[BugPro] ${interaction.user.username} reported: ${bugDescription.slice(0, 50)}...`);
}

/**
 * Get current queue status
 */
export function getProQueueStatus() {
    return {
        length: proQueue.filter(e => e.status === 'pending').length,
        isOfficeHours: isOfficeHours(),
        nextSlot: getNextSlotMessage(),
        queue: proQueue
    };
}
