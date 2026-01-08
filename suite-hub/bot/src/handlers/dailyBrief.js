import { GoogleGenerativeAI } from '@google/generative-ai';
import { EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const genAI = new GoogleGenerativeAI(config.geminiApiKey);

/**
 * Start the daily brief scheduler
 * Runs every day at 8 AM local time
 */
export function startDailyBriefScheduler(client) {
    console.log('📅 Daily Brief scheduler started');

    // Check every minute if it's time for daily brief
    setInterval(async () => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();

        // Run at 8:00 AM
        if (hours === 8 && minutes === 0) {
            await generateAndPostDailyBrief(client);
        }
    }, 60000); // Check every minute
}

/**
 * Generate and post the daily brief
 */
export async function generateAndPostDailyBrief(client) {
    console.log('📊 Generating daily brief...');

    try {
        // Gather context from workspace
        const workspaceInfo = await gatherWorkspaceInfo();

        const prompt = `You are a helpful AI assistant creating a morning brief for a solo developer/entrepreneur.

Based on this context from their project workspace:
${workspaceInfo}

Create a concise, motivating morning brief:

## ☀️ Good Morning!

### 📊 Project Status
[Brief status of active projects/apps]

### 🎯 Today's Priorities
1. [Most important task]
2. [Second priority]
3. [Third priority]

### 💡 Quick Win
[One small thing they could do in 5 minutes for momentum]

### 🔥 Motivation
[One sentence to pump them up]

Keep it brief and actionable. No fluff.`;

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        const brief = result.response.text();

        const embed = new EmbedBuilder()
            .setTitle('☀️ Daily Brief')
            .setDescription(brief.slice(0, 4000))
            .setColor('#F59E0B')
            .setFooter({ text: `Generated ${new Date().toLocaleDateString()}` })
            .setTimestamp();

        // Post to welcome channel (daily briefs go here)
        if (config.channels.welcome) {
            const channel = await client.channels.fetch(config.channels.welcome);
            if (channel) {
                await channel.send({ embeds: [embed] });
                console.log('✅ Daily brief posted!');
            }
        }

    } catch (error) {
        console.error('Daily brief error:', error);
    }
}

/**
 * Gather info about the workspace for context
 */
async function gatherWorkspaceInfo() {
    const workspacePath = path.join(__dirname, '../../../../');

    try {
        // List apps/projects
        const items = await fs.readdir(workspacePath);
        const appFolders = items.filter(item =>
            !item.startsWith('.') &&
            !item.startsWith('node_modules') &&
            !['contracts', 'marketing', 'suite-hub'].includes(item)
        );

        // Check for recent git activity
        let recentActivity = [];
        for (const app of appFolders.slice(0, 5)) {
            try {
                const appPath = path.join(workspacePath, app);
                const stat = await fs.stat(appPath);
                if (stat.isDirectory()) {
                    recentActivity.push(`${app}: Last modified ${stat.mtime.toLocaleDateString()}`);
                }
            } catch (e) {
                // Skip if can't access
            }
        }

        // Check for pending prompts
        const promptsPath = path.join(__dirname, '../../../prompts');
        let pendingPrompts = [];
        try {
            const prompts = await fs.readdir(promptsPath);
            pendingPrompts = prompts.filter(p => p.endsWith('.txt') && !p.startsWith('README'));
        } catch (e) {
            // No prompts folder
        }

        return `
Apps in workspace: ${appFolders.join(', ')}
Recent activity: ${recentActivity.join('; ')}
Pending prompts: ${pendingPrompts.length > 0 ? pendingPrompts.join(', ') : 'None'}
    `.trim();

    } catch (error) {
        return 'Could not gather workspace info';
    }
}

/**
 * Manual trigger for daily brief (can be called via command)
 */
export async function handleDailyBriefCommand(interaction) {
    await interaction.deferReply();

    try {
        const workspaceInfo = await gatherWorkspaceInfo();

        const prompt = `You are a helpful AI assistant. Create a quick status update:

Context: ${workspaceInfo}

Provide a brief status in this format:

## 📊 Current Status

### Active Projects
[List projects with brief status]

### Recent Activity
[What's been worked on recently]

### Suggestions
[1-2 things to focus on]`;

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        const status = result.response.text();

        const embed = new EmbedBuilder()
            .setTitle('📊 Status Update')
            .setColor('#3B82F6')
            .setFooter({ text: `Generated by Gemini • ${interaction.user.username}` })
            .setTimestamp();

        // Post compact reply and create thread for full content
        const replyMessage = await interaction.followUp({
            embeds: [embed],
            content: '📊 Status ready! See thread below.'
        });

        // Create thread for full status
        const thread = await replyMessage.startThread({
            name: `Status: ${new Date().toLocaleDateString()}`,
            autoArchiveDuration: 1440 // 24 hours
        });

        // Send status in chunks
        const chunks = status.match(/.{1,1900}/gs) || [];
        for (const chunk of chunks) {
            await thread.send({ content: chunk });
        }

        // Add save button
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`save_${Date.now()}`)
                    .setLabel('💾 Save')
                    .setStyle(ButtonStyle.Secondary)
            );
        await thread.send({ content: 'Save this status?', components: [row] });

    } catch (error) {
        console.error('Status error:', error);
        await interaction.followUp({ content: '❌ Error generating status.' });
    }
}
