import { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { config } from './config.js';
import { handleSubmission, initSubmissionHandler } from './handlers/submission.js';
import { handleReactionAdd, handleShipReaction } from './handlers/approval.js';
import { handleAppCreationRequest, handleAppCreationApproval, handleAppDeletionRequest } from './handlers/appCreation.js';
import { initRewards, postLeaderboard, getContributorStats, getLeaderboard } from './handlers/rewards.js';
import { createLeaderboardEmbed } from './utils/embeds.js';
import { startCompletionWatcher } from './handlers/completions.js';
import { handleIdeaCommand, handleStudyCommand, handleReviewCommand, handleContentCommand, handleSuggestCommand, pendingSuggestions } from './handlers/aiCommands.js';
import { startDailyBriefScheduler, handleDailyBriefCommand } from './handlers/dailyBrief.js';
import { handleAppsCommand, handlePromoteCommand, handleDemoteCommand } from './handlers/apps.js';
import { handleBugCommand, handleFeatureCommand, getAppChoices } from './handlers/bugFeature.js';
import { handleMyAppsCommand, handleMyAppStatusCommand, handleDeleteMyAppCommand, getUserAppChoices, addUserApp } from './handlers/userApps.js';
import { handlePublishApp, handlePublishButton } from './handlers/publishApp.js';
import { handlePreflightCheck } from './handlers/preflightCheck.js';
import { handleFeatureFast, handleBugFast } from './handlers/featureFast.js';
import { handleFeaturePro, handleBugPro } from './handlers/featurePro.js';
import { generateBotResponse } from './ai/suiteBot.js';
import { canPerformAction, useAction, getNoCreditsMessage, getUserStats } from './credits.js';
import fs from 'fs';
import path from 'path';

// Deduplication: track processed interactions to prevent double-processing
const processedInteractions = new Set();
function isProcessed(interactionId) {
    if (processedInteractions.has(interactionId)) return true;
    processedInteractions.add(interactionId);
    // Clean up old entries after 30 seconds
    setTimeout(() => processedInteractions.delete(interactionId), 30000);
    return false;
}

// Auto-delete helper: deletes a message after specified seconds
function autoDelete(message, seconds = 30) {
    setTimeout(() => {
        message.delete().catch(() => { });
    }, seconds * 1000);
}

// Create Discord client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
    ],
});

// Slash commands
const commands = [
    new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Show this week\'s SUITE leaderboard'),
    new SlashCommandBuilder()
        .setName('mystats')
        .setDescription('Show your SUITE earnings'),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Learn about this server and available commands'),
    new SlashCommandBuilder()
        .setName('suite')
        .setDescription('How to get SUITE tokens'),
    new SlashCommandBuilder()
        .setName('earn')
        .setDescription('Watch ads to earn free SUITE tokens'),
    new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your SUITE balance and free actions'),
    new SlashCommandBuilder()
        .setName('create-app')
        .setDescription('Create a new app in the ecosystem')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('App name')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('What the app does')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('App platform type')
                .setRequired(true)
                .addChoices(
                    { name: 'Expo Go (mobile)', value: 'expo-go' },
                    { name: 'TestFlight (iOS)', value: 'testflight' },
                    { name: 'Web (Next.js)', value: 'web' }
                ))
        .addStringOption(option =>
            option.setName('features')
                .setDescription('Key features (comma-separated)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('archive-app')
        .setDescription('Archive an existing app')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('App name to archive')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Why archiving this app')
                .setRequired(false)),
    // Remove app from live website (Supabase)
    new SlashCommandBuilder()
        .setName('remove-app')
        .setDescription('Remove an app from the live website (sets status to removed)')
        .addStringOption(option =>
            option.setName('slug')
                .setDescription('App slug (e.g., food-vitals)')
                .setRequired(true)),
    // Developer app creation command (for community devs)
    new SlashCommandBuilder()
        .setName('dev-create-app')
        .setDescription('Create a new app using AI (for approved developers)')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('App name (lowercase, no spaces, e.g. meditation-timer)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Detailed description of what the app should do')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('free_features')
                .setDescription('Free features (comma-separated)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('paid_features')
                .setDescription('Paid AI features with SUITE price (e.g. AI analysis: 30)')
                .setRequired(false)),
    // AI Commands
    new SlashCommandBuilder()
        .setName('idea')
        .setDescription('Analyze an idea with AI - get rating, pros/cons, market fit')
        .addStringOption(option =>
            option.setName('idea')
                .setDescription('Describe your idea')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('study')
        .setDescription('Deep research on a topic with structured findings')
        .addStringOption(option =>
            option.setName('topic')
                .setDescription('Topic to research')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('review')
        .setDescription('AI code review for a GitHub file')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('GitHub file URL')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('content')
        .setDescription('Generate TikTok/Twitter/blog content ideas for an app')
        .addStringOption(option =>
            option.setName('app')
                .setDescription('Select app')
                .setRequired(true)
                .addChoices(
                    { name: '📊 Cheshbon', value: 'Cheshbon' },
                    { name: '💎 DeFi Knowledge', value: 'DeFi Knowledge' },
                    { name: '💪 OpticRep', value: 'OpticRep' },
                    { name: '😴 REMcast', value: 'REMcast' },
                    { name: '🏃 TrueForm', value: 'TrueForm' },
                    { name: '🥗 FoodVitals', value: 'FoodVitals' },
                    { name: '🧠 LifeHub', value: 'LifeHub' },
                    { name: '🏷️ DealFinder', value: 'DealFinder' }
                )),
    new SlashCommandBuilder()
        .setName('status')
        .setDescription('Get current project status and priorities'),
    new SlashCommandBuilder()
        .setName('apps')
        .setDescription('View all SUITE apps and their status'),
    new SlashCommandBuilder()
        .setName('bug')
        .setDescription('Report a bug for an app')
        .addStringOption(option =>
            option.setName('app')
                .setDescription('Which app?')
                .setRequired(true)
                .addChoices(
                    { name: '📊 Cheshbon', value: 'Cheshbon' },
                    { name: '💎 DeFi Knowledge', value: 'DeFi Knowledge' },
                    { name: '💪 OpticRep', value: 'OpticRep' },
                    { name: '😴 REMcast', value: 'REMcast' },
                    { name: '🏃 TrueForm', value: 'TrueForm' },
                    { name: '🥗 FoodVitals', value: 'FoodVitals' },
                    { name: '🧠 LifeHub', value: 'LifeHub' },
                    { name: '🏷️ DealFinder', value: 'DealFinder' }
                ))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Describe the bug')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('priority')
                .setDescription('Bug priority')
                .addChoices(
                    { name: '🔴 High', value: 'high' },
                    { name: '🟡 Medium', value: 'medium' },
                    { name: '🟢 Low', value: 'low' }
                )),
    new SlashCommandBuilder()
        .setName('feature')
        .setDescription('Request a feature for an app')
        .addStringOption(option =>
            option.setName('app')
                .setDescription('Which app?')
                .setRequired(true)
                .addChoices(
                    { name: '📊 Cheshbon', value: 'Cheshbon' },
                    { name: '💎 DeFi Knowledge', value: 'DeFi Knowledge' },
                    { name: '💪 OpticRep', value: 'OpticRep' },
                    { name: '😴 REMcast', value: 'REMcast' },
                    { name: '🏃 TrueForm', value: 'TrueForm' },
                    { name: '🥗 FoodVitals', value: 'FoodVitals' },
                    { name: '🧠 LifeHub', value: 'LifeHub' },
                    { name: '🏷️ DealFinder', value: 'DealFinder' }
                ))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Describe the feature')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('promote')
        .setDescription('Promote an app to live (owner only)')
        .addStringOption(option =>
            option.setName('app')
                .setDescription('App to promote')
                .setRequired(true)
                .addChoices(
                    { name: 'TrueForm', value: 'TrueForm' },
                    { name: 'FoodVitals', value: 'FoodVitals' },
                    { name: 'LifeHub', value: 'LifeHub' },
                    { name: 'DealFinder', value: 'DealFinder' },
                    { name: 'ContentBounty', value: 'ContentBounty' }
                )),
    new SlashCommandBuilder()
        .setName('demote')
        .setDescription('Demote an app to dev (owner only)')
        .addStringOption(option =>
            option.setName('app')
                .setDescription('App to demote')
                .setRequired(true)
                .addChoices(
                    { name: 'Cheshbon', value: 'Cheshbon' },
                    { name: 'DeFi Knowledge', value: 'DeFi Knowledge' },
                    { name: 'OpticRep', value: 'OpticRep' },
                    { name: 'REMcast', value: 'REMcast' },
                    { name: 'TrueForm', value: 'TrueForm' },
                    { name: 'FoodVitals', value: 'FoodVitals' },
                    { name: 'LifeHub', value: 'LifeHub' },
                    { name: 'DealFinder', value: 'DealFinder' }
                )),
    new SlashCommandBuilder()
        .setName('suggest')
        .setDescription('AI suggests features to build for an app')
        .addStringOption(option =>
            option.setName('app')
                .setDescription('Which app?')
                .setRequired(true)
                .addChoices(
                    { name: '📊 Cheshbon', value: 'Cheshbon' },
                    { name: '💎 DeFi Knowledge', value: 'DeFi Knowledge' },
                    { name: '💪 OpticRep', value: 'OpticRep' },
                    { name: '😴 REMcast', value: 'REMcast' },
                    { name: '🏃 TrueForm', value: 'TrueForm' },
                    { name: '🥗 FoodVitals', value: 'FoodVitals' },
                    { name: '🧠 LifeHub', value: 'LifeHub' },
                    { name: '🏷️ DealFinder', value: 'DealFinder' },
                    { name: '🎯 ContentBounty', value: 'ContentBounty' }
                )),
    // Environment variables management
    new SlashCommandBuilder()
        .setName('set-env')
        .setDescription('Set an environment variable for your app')
        .addStringOption(option =>
            option.setName('app')
                .setDescription('Select your app')
                .setRequired(true)
                .addChoices(
                    { name: '📊 Cheshbon', value: 'cheshbon-reflections' },
                    { name: '💎 DeFi Knowledge', value: 'defi-knowledge' },
                    { name: '💪 OpticRep', value: 'opticrep-ai-workout-trainer' },
                    { name: '😴 REMcast', value: 'remcast' },
                    { name: '🏃 TrueForm', value: 'trueform-ai-physiotherapist' },
                    { name: '🥗 FoodVitals', value: 'food-vitals-expo' }
                ))
        .addStringOption(option =>
            option.setName('key')
                .setDescription('Variable name (e.g., API_KEY)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('value')
                .setDescription('Variable value')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('get-env')
        .setDescription('View environment variables for your app (values hidden)')
        .addStringOption(option =>
            option.setName('app')
                .setDescription('Select your app')
                .setRequired(true)
                .addChoices(
                    { name: '📊 Cheshbon', value: 'cheshbon-reflections' },
                    { name: '💎 DeFi Knowledge', value: 'defi-knowledge' },
                    { name: '💪 OpticRep', value: 'opticrep-ai-workout-trainer' },
                    { name: '😴 REMcast', value: 'remcast' },
                    { name: '🏃 TrueForm', value: 'trueform-ai-physiotherapist' },
                    { name: '🥗 FoodVitals', value: 'food-vitals-expo' }
                )),
    // User app management commands
    new SlashCommandBuilder()
        .setName('my-apps')
        .setDescription('View all your submitted applications and their status'),
    new SlashCommandBuilder()
        .setName('my-app-status')
        .setDescription('Get detailed status of your application')
        .addStringOption(option =>
            option.setName('app')
                .setDescription('App name')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('delete-my-app')
        .setDescription('Archive your application')
        .addStringOption(option =>
            option.setName('app')
                .setDescription('App name to delete')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for deleting')
                .setRequired(false)),
    // Preflight check before publishing
    new SlashCommandBuilder()
        .setName('preflight-check')
        .setDescription('Verify your app is ready for PWA publishing')
        .addStringOption(option =>
            option.setName('app')
                .setDescription('Select app to check')
                .setRequired(true)
                .addChoices(
                    { name: '📖 Cheshbon Reflections', value: 'cheshbon-reflections' },
                    { name: '🥗 FoodVitals', value: 'food-vitals-expo' },
                    { name: '💪 OpticRep', value: 'opticrep-ai-workout-trainer' },
                    { name: '🧠 Life Hub AI', value: 'life-hub-app' },
                    { name: '💭 REMcast', value: 'remcast' },
                    { name: '💎 DeFi Knowledge', value: 'defi-knowledge' }
                )),
    // Publish app to SUITE App Store
    new SlashCommandBuilder()
        .setName('publish-app')
        .setDescription('Build and publish an app to the SUITE App Store (requires preflight-check)')
        .addStringOption(option =>
            option.setName('app')
                .setDescription('Select app to publish')
                .setRequired(true)
                .addChoices(
                    { name: '📖 Cheshbon Reflections', value: 'cheshbon-reflections' },
                    { name: '🥗 FoodVitals', value: 'food-vitals-expo' },
                    { name: '💪 OpticRep', value: 'opticrep-ai-workout-trainer' },
                    { name: '🧠 Life Hub AI', value: 'life-hub-app' },
                    { name: '💭 REMcast', value: 'remcast' },
                    { name: '💎 DeFi Knowledge', value: 'defi-knowledge' }
                )),
    // ⚡ FAST COMMANDS - Instant AI-powered changes via Gemini 1.5 Pro
    new SlashCommandBuilder()
        .setName('feature-fast')
        .setDescription('⚡ INSTANT feature implementation using AI - bypasses IDE queue')
        .addStringOption(option =>
            option.setName('app')
                .setDescription('Select app to update')
                .setRequired(true)
                .addChoices(
                    { name: '📊 Cheshbon', value: 'cheshbon-reflections' },
                    { name: '🥗 FoodVitals', value: 'food-vitals-expo' },
                    { name: '💪 OpticRep', value: 'opticrep-ai-workout-trainer' },
                    { name: '🧠 LifeHub', value: 'life-hub-app' },
                    { name: '💭 REMcast', value: 'remcast' },
                    { name: '💎 DeFi Knowledge', value: 'defi-knowledge' },
                    { name: '🏃 TrueForm', value: 'trueform-ai-physiotherapist' }
                ))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Describe the feature to add')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('bug-fast')
        .setDescription('⚡ INSTANT bug fix using AI - bypasses IDE queue')
        .addStringOption(option =>
            option.setName('app')
                .setDescription('Select app to fix')
                .setRequired(true)
                .addChoices(
                    { name: '📊 Cheshbon', value: 'cheshbon-reflections' },
                    { name: '🥗 FoodVitals', value: 'food-vitals-expo' },
                    { name: '💪 OpticRep', value: 'opticrep-ai-workout-trainer' },
                    { name: '🧠 LifeHub', value: 'life-hub-app' },
                    { name: '💭 REMcast', value: 'remcast' },
                    { name: '💎 DeFi Knowledge', value: 'defi-knowledge' },
                    { name: '🏃 TrueForm', value: 'trueform-ai-physiotherapist' }
                ))
        .addStringOption(option =>
            option.setName('bug_description')
                .setDescription('Describe the bug to fix')
                .setRequired(true)),
    // 👨‍💻 PRO COMMANDS - Human developer with AI assistance (5-15 min, during office hours)
    new SlashCommandBuilder()
        .setName('feature-pro')
        .setDescription('👨‍💻 PRO: Human developer implements your feature with AI (5-15 min)')
        .addStringOption(option =>
            option.setName('app')
                .setDescription('Select app to update')
                .setRequired(true)
                .addChoices(
                    { name: '📊 Cheshbon', value: 'cheshbon-reflections' },
                    { name: '🥗 FoodVitals', value: 'food-vitals-expo' },
                    { name: '💪 OpticRep', value: 'opticrep-ai-workout-trainer' },
                    { name: '🧠 LifeHub', value: 'life-hub-app' },
                    { name: '💭 REMcast', value: 'remcast' },
                    { name: '💎 DeFi Knowledge', value: 'defi-knowledge' },
                    { name: '🏃 TrueForm', value: 'trueform-ai-physiotherapist' }
                ))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Describe the feature in detail')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('bug-pro')
        .setDescription('👨‍💻 PRO: Human developer fixes your bug with AI (5-15 min)')
        .addStringOption(option =>
            option.setName('app')
                .setDescription('Select app to fix')
                .setRequired(true)
                .addChoices(
                    { name: '📊 Cheshbon', value: 'cheshbon-reflections' },
                    { name: '🥗 FoodVitals', value: 'food-vitals-expo' },
                    { name: '💪 OpticRep', value: 'opticrep-ai-workout-trainer' },
                    { name: '🧠 LifeHub', value: 'life-hub-app' },
                    { name: '💭 REMcast', value: 'remcast' },
                    { name: '💎 DeFi Knowledge', value: 'defi-knowledge' },
                    { name: '🏃 TrueForm', value: 'trueform-ai-physiotherapist' }
                ))
        .addStringOption(option =>
            option.setName('bug_description')
                .setDescription('Describe the bug in detail')
                .setRequired(true)),
];

// Register slash commands
async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(config.discordToken);

    try {
        console.log('Registering slash commands...');
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, config.guildId),
            { body: commands.map(c => c.toJSON()) }
        );
        console.log('Slash commands registered!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
}

// Bot ready event
client.once('ready', async () => {
    console.log(`🤖 SUITE Hub Bot is online as ${client.user.tag}`);

    // Initialize handlers
    initSubmissionHandler(client);
    initRewards();

    // Register commands
    await registerCommands();

    // Start watching for completed prompts
    startCompletionWatcher(client);

    // Start daily brief scheduler (8 AM)
    startDailyBriefScheduler(client);

    // Cleanup #commands channel on startup
    if (config.channels.commands) {
        try {
            const commandsChannel = await client.channels.fetch(config.channels.commands);
            if (commandsChannel) {
                const messages = await commandsChannel.messages.fetch({ limit: 100 });
                if (messages.size > 0) {
                    console.log(`🧹 Cleaning up ${messages.size} messages from #commands...`);
                    await commandsChannel.bulkDelete(messages, true).catch(() => {
                        // Messages older than 14 days can't be bulk deleted
                        console.log('Some messages too old for bulk delete, deleting individually...');
                        messages.forEach(msg => msg.delete().catch(() => { }));
                    });
                    console.log('✅ #commands channel cleaned!');
                }
            }
        } catch (err) {
            console.error('Error cleaning commands channel:', err);
        }
    }

    console.log('Bot fully initialized!');
});

// Welcome new members in #general
client.on('guildMemberAdd', async (member) => {
    console.log(`👋 New member joined: ${member.user.tag}`);

    // Get the general channel
    const generalChannelId = config.channels.general;
    if (!generalChannelId) {
        console.log('No CHANNEL_GENERAL configured, skipping welcome message');
        return;
    }

    try {
        const generalChannel = await client.channels.fetch(generalChannelId);
        if (!generalChannel) return;

        // Welcome message
        const welcomeMessages = [
            `Welcome <@${member.id}>! 👋 Need help with SUITE or building apps? Just @mention me anytime. What brings you here?`,
            `Hey <@${member.id}>! 🚀 Welcome to SUITE! I'm here 24/7 if you need help - just @mention me. What are you building?`,
            `Yo <@${member.id}>! Good to have you here! 🎉 Need help? Just @mention me and I'll jump in. Let's build something awesome!`,
        ];

        const randomWelcome = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
        await generalChannel.send(randomWelcome);

        console.log(`✅ Sent welcome message for ${member.user.tag}`);
    } catch (error) {
        console.error('Error sending welcome message:', error);
    }
});

// Handle new messages (for submissions)
client.on('messageCreate', async (message) => {
    // Ignore messages from bots
    if (message.author.bot) return;

    try {
        console.log(`Message received in channel ${message.channelId} from ${message.author.tag}`);

        // Handle app deletion requests
        if (message.channelId === config.channels.deleteApp) {
            console.log('Handling app deletion request');
            await handleAppDeletionRequest(message);
            return;
        }

        // Handle app creation requests
        if (message.channelId === config.channels.createApp) {
            console.log('Handling app creation request');
            await handleAppCreationRequest(message);
            return;
        }

        // Handle regular bug/feature submissions
        await handleSubmission(message);
    } catch (error) {
        console.error('Message handling error:', error);
    }
});

// AUTO-DELETE: Delete ALL messages in #commands channel after 5 minutes
client.on('messageCreate', async (message) => {
    // Only in commands channel
    if (message.channel.id !== config.channels.commands) return;

    // Schedule deletion after 5 minutes (300 seconds)
    setTimeout(async () => {
        try {
            await message.delete();
        } catch (err) {
            // Message may already be deleted
        }
    }, 300 * 1000);
});

// AI Bot - Respond when @mentioned or auto-respond to SUITE questions
// Rate limiting for auto-responses to prevent spam
const autoResponseCooldown = new Map();
const AUTO_RESPONSE_COOLDOWN_MS = 60000; // 1 minute per channel

client.on('messageCreate', async (message) => {
    // Ignore bots
    if (message.author.bot) return;

    // Don't respond in certain channels
    const noChatChannels = [config.channels.commands, config.channels.pending, config.channels.pendingApps];
    if (noChatChannels.includes(message.channel.id)) return;

    const content = message.content.toLowerCase();
    const isMentioned = message.mentions.has(client.user);

    // Auto-dialog: detect questions or SUITE-related topics
    const isQuestion = content.endsWith('?') ||
        /\b(how|what|why|when|where|can i|is there|does|will|should)\b/i.test(content);
    const isSuiteRelated = /\b(app|build|create|token|earn|submit)\b/i.test(content);

    // Determine if we should respond - @mention only or auto for questions
    let shouldRespond = isMentioned;
    let isAutoResponse = false;

    // Auto-respond to questions about SUITE topics (with rate limiting)
    if (!shouldRespond && isQuestion && isSuiteRelated) {
        // Check cooldown for this channel
        const lastResponse = autoResponseCooldown.get(message.channel.id);
        if (!lastResponse || (Date.now() - lastResponse > AUTO_RESPONSE_COOLDOWN_MS)) {
            // 30% chance to auto-respond to relevant questions
            if (Math.random() < 0.3) {
                shouldRespond = true;
                isAutoResponse = true;
                autoResponseCooldown.set(message.channel.id, Date.now());
            }
        }
    }

    if (!shouldRespond) return;

    // Show typing indicator
    await message.channel.sendTyping();

    // Get some context
    const context = {
        channelName: message.channel.name,
        userName: message.author.username,
        isAutoResponse: isAutoResponse,
    };

    try {
        // Clean up the message
        let userMessage = message.content
            .replace(/<@!?\d+>/g, '')  // Remove mentions
            .trim();

        if (!userMessage) {
            userMessage = "what's up?";  // Default if just pinged
        }

        // Bot chat is FREE - no credits charged, but show balance footer
        const response = await generateBotResponse(userMessage, context);

        // Build footer - Admin gets unlimited, others see balance
        let footer = '';
        if (message.author.id === config.ownerId) {
            // Owner/Admin gets unlimited
            footer = `\n\n─────────────────────────\n👑 Admin • ∞ Unlimited`;
        } else {
            // Get both free tier and SUITE balance
            const stats = await getUserStats(message.author.id);
            const freeRemaining = stats ? stats.freeActionsRemaining : 20;
            const suiteBalance = stats ? Math.floor(stats.suiteBalance) : 0;
            // $0.001 per SUITE (only real SUITE is cashable)
            const dollarValue = (suiteBalance * 0.001).toFixed(2);

            if (freeRemaining > 0 && suiteBalance > 0) {
                // Has both
                footer = `\n\n─────────────────────────\n🎁 ${freeRemaining} free + 💰 ${suiteBalance} SUITE (~$${dollarValue}) • \`/suite\``;
            } else if (freeRemaining > 0) {
                // Only free tier
                footer = `\n\n─────────────────────────\n🎁 ${freeRemaining} free actions • \`/earn\` for SUITE`;
            } else if (suiteBalance > 0) {
                // Only SUITE
                footer = `\n\n─────────────────────────\n💰 ${suiteBalance} SUITE (~$${dollarValue}) • \`/suite\``;
            } else {
                // Nothing left
                footer = `\n\n─────────────────────────\n🚨 0 credits! Use \`/earn\` to watch ads`;
            }
        }

        await message.reply(response + footer);
        console.log(`[SUITE Bot] Responded ${isAutoResponse ? '(auto)' : '(mentioned)'} to ${message.author.username} (${message.author.id === config.ownerId ? 'ADMIN' : 'FREE chat'})`);
    } catch (error) {
        console.error('SUITE Bot error:', error);
        if (!isAutoResponse) {  // Only show error if they directly asked
            await message.reply("Something went wrong, try again? 🤔");
        }
    }
});

// Handle reactions (for approvals)
client.on('messageReactionAdd', async (reaction, user) => {
    // Fetch partial data if needed
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Error fetching reaction:', error);
            return;
        }
    }

    if (reaction.message.partial) {
        try {
            await reaction.message.fetch();
        } catch (error) {
            console.error('Error fetching message:', error);
            return;
        }
    }

    try {
        // Handle pending-apps channel approvals
        if (reaction.message.channelId === config.channels.pendingApps && reaction.emoji.name === '🚀') {
            await handleAppCreationApproval(reaction, user);
            return;
        }

        // Handle pending channel approvals
        await handleReactionAdd(reaction, user);
        // Handle approved channel ship reactions
        await handleShipReaction(reaction, user);
    } catch (error) {
        console.error('Reaction handling error:', error);
    }
});

// Handle slash commands and button interactions
client.on('interactionCreate', async (interaction) => {
    // Deduplicate - prevent processing same interaction twice
    if (isProcessed(interaction.id)) {
        console.log(`[Dedup] Skipping duplicate interaction: ${interaction.id}`);
        return;
    }

    // Handle button interactions (suggestion buttons)
    if (interaction.isButton()) {
        const customId = interaction.customId;

        // Handle suggestion buttons
        if (customId.startsWith('suggest_')) {
            const featureIndex = parseInt(customId.split('_')[1]) - 1;
            const messageId = interaction.message.id;
            const suggestionData = pendingSuggestions.get(messageId);

            if (!suggestionData) {
                await interaction.reply({ content: '❌ This suggestion has expired. Run /suggest again.', ephemeral: true });
                return;
            }

            const feature = suggestionData.features[featureIndex];
            if (!feature) {
                await interaction.reply({ content: '❌ Feature not found.', ephemeral: true });
                return;
            }

            // Post to #commands channel
            if (config.channels.commands) {
                const commandsChannel = await interaction.client.channels.fetch(config.channels.commands);
                if (commandsChannel) {
                    await commandsChannel.send(`📝 **Feature Request from AI Suggestion**\n**App:** ${suggestionData.appName}\n**Feature:** ${feature.name}\n**Description:** ${feature.description}`);
                }
            }

            // Create pending feature request
            if (config.channels.pending) {
                const pendingChannel = await interaction.client.channels.fetch(config.channels.pending);
                if (pendingChannel) {
                    const { EmbedBuilder } = await import('discord.js');
                    const embed = new EmbedBuilder()
                        .setTitle(`✨ Feature Request: ${suggestionData.appName}`)
                        .setDescription(`**${feature.name}**\n${feature.description}`)
                        .addFields(
                            { name: 'Impact', value: feature.impact, inline: true },
                            { name: 'Source', value: 'AI Suggestion', inline: true }
                        )
                        .setColor('#6366F1')
                        .setFooter({ text: `Added by ${interaction.user.username}` })
                        .setTimestamp();

                    const msg = await pendingChannel.send({ embeds: [embed] });
                    await msg.react('🚀');
                    await msg.react('❌');
                }
            }

            await interaction.reply({ content: `✅ Added **${feature.name}** to pending features for ${suggestionData.appName}!`, ephemeral: true });
            return;
        }

        // Handle SAVE button (💾) - save AI outputs to #saved-ideas
        if (customId.startsWith('save_')) {
            // Get the original message content
            const message = interaction.message;
            const embed = message.embeds[0];
            const title = embed?.title || 'Saved Item';
            const description = embed?.description?.slice(0, 100) || '';

            // Get the saved-ideas channel
            if (!config.channels.savedIdeas) {
                await interaction.reply({ content: '❌ Saved Ideas channel not configured.', ephemeral: true });
                return;
            }

            try {
                const savedChannel = await interaction.client.channels.fetch(config.channels.savedIdeas);

                // Create a compact header message
                const headerMsg = await savedChannel.send({
                    content: `💾 **${title}**\n> ${description.slice(0, 80)}...\n_Saved by <@${interaction.user.id}>_`
                });

                // Create a thread for the full content
                const thread = await headerMsg.startThread({
                    name: `${title.slice(0, 50)}`,
                    autoArchiveDuration: 10080 // 7 days
                });

                // Get thread content from the original view
                if (message.thread) {
                    // If it was in a thread, get those messages
                    const threadMessages = await message.thread.messages.fetch({ limit: 20 });
                    for (const [, msg] of threadMessages) {
                        if (!msg.author.bot) continue;
                        await thread.send({ content: msg.content.slice(0, 2000) || '_(embed content)_' });
                    }
                } else {
                    // Just save the embed description
                    await thread.send({ content: embed?.description || message.content || '_(no content)_' });
                }

                await interaction.reply({ content: `💾 Saved to <#${config.channels.savedIdeas}>!`, ephemeral: true });
            } catch (error) {
                console.error('Save error:', error);
                await interaction.reply({ content: '❌ Failed to save. Please try again.', ephemeral: true });
            }
            return;
        }

        // Handle publish approval/rejection buttons
        if (customId.startsWith('approve_publish_') || customId.startsWith('reject_publish_')) {
            await handlePublishButton(interaction);
            return;
        }

        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // Track if we should auto-delete (for non-ephemeral replies in commands channel)
    const shouldAutoDelete = interaction.channel.id === config.channels.commands;

    // ════ MAINTENANCE MODE ════
    // Block all commands except for owner during maintenance
    if (config.maintenanceMode && interaction.user.id !== config.ownerId) {
        await interaction.reply({
            content: config.maintenanceMessage,
            ephemeral: true
        });
        return;
    }

    try {
        switch (commandName) {
            case 'leaderboard': {
                const leaders = getLeaderboard();
                const embed = createLeaderboardEmbed(leaders);
                const reply = await interaction.reply({ embeds: [embed], fetchReply: true });
                // Auto-delete after 5 minutes in commands channel
                if (interaction.channel.id === config.channels.commands) {
                    autoDelete(reply, 300);
                }
                break;
            }

            case 'mystats': {
                const stats = getContributorStats(interaction.user.id);
                if (!stats) {
                    await interaction.reply({
                        content: 'You haven\'t earned any SUITE yet! Submit bugs, features, or content to get started.',
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: `📊 **Your Stats**\n💰 Total SUITE: **${stats.totalSuite}**\n📝 Contributions: **${stats.contributions.length}**`,
                        ephemeral: true
                    });
                }
                break;
            }

            case 'help': {
                await interaction.reply({
                    content: `**👋 Welcome to SUITE!**

This is the SUITE community - where anyone can build apps without coding.

**🤖 Talk to SUITE Bot**
• @mention the bot to ask a question
• Ask anything: "@SUITE what is SUITE?" or "@SUITE help me"

**📱 Commands:**
• \`/apps\` - Browse all SUITE apps
• \`/suite\` - How to get SUITE tokens
• \`/idea\` - Get AI analysis of your idea
• \`/study\` - Research a topic with AI
• \`/content\` - Get content ideas for an app
• \`/suggest\` - AI suggests features for an app
• \`/bug\` - Report a bug
• \`/feature\` - Request a feature
• \`/mystats\` - See your contributions
• \`/leaderboard\` - Weekly rankings

**🔗 Links:**
• Website: getsuite.app
• Forge (build apps): getsuite.app (Start Building)
• Docs: getsuite.app/docs`,
                    ephemeral: true
                });
                break;
            }

            case 'suite': {
                await interaction.reply({
                    content: `**💰 How to Get SUITE**

**💳 Buy (Card/Crypto)**
• Deposit with credit/debit card
• Or deposit ETH, USDC, other tokens
• Swapped to SUITE automatically

**🔄 Trade on DEX**
• Coming soon: Trade SUITE on decentralized exchanges

**📺 Watch Ads**
• Earn real SUITE by watching ads
• Use \`/earn\` to get started!

**🏆 Earn Rewards**
• Report bugs: 500 SUITE
• Request features: 1,000 SUITE
• Ship fixes: 750 SUITE bonus

**🎁 Free Tier vs 💰 SUITE**
• 🎁 Free tier = 20 trial credits (can't cash out)
• 💰 SUITE = Real tokens you earn/buy (can cash out!)

**What is SUITE?**
1 SUITE = ~$0.001 (treasury-backed floor price)
Redeem anytime for ETH at getsuite.app/wallet

**More info:** getsuite.app/docs/tokenomics.html`,
                    ephemeral: true
                });
                break;
            }

            case 'earn': {
                await interaction.reply({
                    content: `**📺 Earn Free SUITE **

                    Watch short video ads to earn SUITE tokens - no purchase required!

                        **🔗 Click here to start earning:**
                            https://getsuite.app/earn

** How it works:**
                    1. Click the link above
                2. Login with Discord
3. Watch a 30 - second ad
                4. Get + 10 SUITE instantly!

You can watch unlimited ads to earn as much SUITE as you want! 🚀`,
                    ephemeral: true
                });
                break;
            }

            case 'balance': {
                const stats = await getUserStats(interaction.user.id);

                if (!stats) {
                    await interaction.reply({
                        content: `**💰 Your SUITE Balance **

                    You haven't used any actions yet!

                        ** Free Tier:** 20 actions remaining
                            ** SUITE Balance:** 0 SUITE

Start chatting with me or use \`/earn\` to get more SUITE!`,
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: `**💰 Your SUITE Balance**

**Free Tier:** ${stats.freeActionsRemaining} actions remaining
**SUITE Balance:** ${stats.suiteBalance.toFixed(0)} SUITE
**Total Available:** ${Math.floor(stats.totalActionsAvailable)} actions

**Ads Watched:** ${stats.totalAdsWatched}

Need more? Use \`/earn\` to watch ads for free SUITE!`,
                        ephemeral: true
                    });
                }
                break;
            }

            case 'create-app': {
                // Only allow server owner
                if (interaction.user.id !== config.ownerId) {
                    await interaction.reply({
                        content: '❌ Only the server owner can create apps.',
                        ephemeral: true
                    });
                    return;
                }

                const name = interaction.options.getString('name');
                const description = interaction.options.getString('description');
                const type = interaction.options.getString('type');
                const features = interaction.options.getString('features') || '';

                // Create pending approval embed
                const pendingChannel = await interaction.client.channels.fetch(config.channels.pendingApps);

                const embed = new EmbedBuilder()
                    .setTitle(`📱 New App Request: ${name}`)
                    .setDescription(description)
                    .addFields(
                        {
                            name: 'Type',
                            value: type === 'expo-go' ? '🟢 Expo Go' : type === 'testflight' ? '🔵 TestFlight' : '🌐 Web',
                            inline: true
                        },
                        { name: 'Submitted by', value: `<@${interaction.user.id}>`, inline: true }
                    )
                    .setColor(type === 'expo-go' ? '#00FF00' : type === 'testflight' ? '#0000FF' : '#FF6B00')
                    .setTimestamp();

                if (features) {
                    embed.addFields({ name: 'Features', value: features });
                }

                const pendingMessage = await pendingChannel.send({ embeds: [embed] });
                await pendingMessage.react('🚀');
                await pendingMessage.react('❌');

                await interaction.reply({
                    content: `✅ App creation request submitted! Check <#${config.channels.pendingApps}> and react with 🚀 to approve.`,
                    ephemeral: true
                });
                break;
            }

            case 'archive-app': {
                // Only allow server owner
                if (interaction.user.id !== config.ownerId) {
                    await interaction.reply({
                        content: '❌ Only the server owner can archive apps.',
                        ephemeral: true
                    });
                    return;
                }

                const name = interaction.options.getString('name');
                const reason = interaction.options.getString('reason') || 'Not specified';

                // Generate deletion prompt
                const { default: fs } = await import('fs/promises');
                const { default: path } = await import('path');

                const promptContent = `Archive App: ${name}

Reason: ${reason}

Instructions:
1. Archive folder: stuart-hollinger-landing/${name.toLowerCase().replace(/\s+/g, '-')}
2. Remove from bot config (validAppChannels)
3. Archive Discord channel for app
4. Archive GitHub repo
5. Update website apps list
6. Confirm archival to user

IMPORTANT: Verify app name is correct before archiving!
`;

                const timestamp = Date.now();
                const filename = `ArchiveApp_${timestamp}_${name.replace(/\s+/g, '_')}.txt`;
                const promptsDir = path.join(process.cwd(), '../prompts');
                const filePath = path.join(promptsDir, filename);

                try {
                    await fs.writeFile(filePath, promptContent, 'utf-8');

                    await interaction.reply({
                        content: `✅ Archive request submitted for **${name}**. The app will be archived shortly.`,
                        ephemeral: true
                    });
                } catch (error) {
                    console.error('Error saving archive prompt:', error);
                    await interaction.reply({
                        content: '❌ Failed to process archive request.',
                        ephemeral: true
                    });
                }
                break;
            }

            case 'dev-create-app': {
                // Check if user has Developer role
                const member = await interaction.guild.members.fetch(interaction.user.id);
                const hasDeveloperRole = member.roles.cache.has(config.developerRoleId);

                if (!hasDeveloperRole) {
                    await interaction.reply({
                        content: `❌ You need the **Developer** role to create apps.\n\nApply in <#${config.channels.devApplications}> to get access!`,
                        ephemeral: true
                    });
                    return;
                }

                const name = interaction.options.getString('name');
                const description = interaction.options.getString('description');
                const freeFeatures = interaction.options.getString('free_features');
                const paidFeatures = interaction.options.getString('paid_features') || 'None specified';

                // Validate app name format
                if (!/^[a-z0-9-]+$/.test(name)) {
                    await interaction.reply({
                        content: '❌ App name must be lowercase letters, numbers, and dashes only.\nExample: `meditation-timer`',
                        ephemeral: true
                    });
                    return;
                }

                try {
                    // Post to pending-apps channel for approval (NO prompt file yet - that happens on 🚀 approval)
                    const pendingChannel = await interaction.client.channels.fetch(config.channels.pendingApps);

                    const { EmbedBuilder } = await import('discord.js');
                    const embed = new EmbedBuilder()
                        .setTitle(`📱 New Developer App: ${name}`)
                        .setDescription(description)
                        .addFields(
                            { name: '👤 Developer', value: `<@${interaction.user.id}>`, inline: true },
                            { name: '🆔 Developer ID', value: interaction.user.id, inline: true },
                            { name: '🆓 Free Features', value: freeFeatures },
                            { name: '💰 Paid Features', value: paidFeatures }
                        )
                        .setColor('#8B5CF6')
                        .setFooter({ text: 'React with 🚀 to approve and start building!' })
                        .setTimestamp();

                    const pendingMessage = await pendingChannel.send({ embeds: [embed] });
                    await pendingMessage.react('🚀');
                    await pendingMessage.react('❌');

                    await interaction.reply({
                        content: `✅ **App submitted for approval!**\n\n📱 **${name}** is waiting in <#${config.channels.pendingApps}>\n🚀 Once approved, AI will start building it!\n\nYou'll get a notification when it's ready to test.`,
                        ephemeral: true
                    });

                } catch (error) {
                    console.error('Error creating developer app:', error);
                    await interaction.reply({
                        content: '❌ Failed to submit app. Please try again.',
                        ephemeral: true
                    });
                }
                break;
            }

            // AI-POWERED COMMANDS - These cost 1 SUITE credit (admin gets unlimited)
            case 'idea':
            case 'study':
            case 'review':
            case 'content':
            case 'suggest': {
                const isAdmin = interaction.user.id === config.ownerId;

                // Check credits before AI command (admin bypasses)
                if (!isAdmin) {
                    const creditCheck = await canPerformAction(interaction.user.id, interaction.user.username);

                    if (!creditCheck.canAct) {
                        await interaction.reply({
                            content: getNoCreditsMessage(),
                            ephemeral: true
                        });
                        return;
                    }
                }

                // Run the appropriate handler
                const commandName = interaction.commandName;
                if (commandName === 'idea') await handleIdeaCommand(interaction);
                else if (commandName === 'study') await handleStudyCommand(interaction);
                else if (commandName === 'review') await handleReviewCommand(interaction);
                else if (commandName === 'content') await handleContentCommand(interaction);
                else if (commandName === 'suggest') await handleSuggestCommand(interaction);

                // Deduct credit after successful response (admin skips)
                if (!isAdmin) {
                    await useAction(interaction.user.id, interaction.user.username);
                }

                // Follow up with balance footer
                let footer;
                if (isAdmin) {
                    footer = `👑 Admin • ∞ Unlimited`;
                } else {
                    const updatedStats = await getUserStats(interaction.user.id);
                    const freeRemaining = updatedStats ? updatedStats.freeActionsRemaining : 0;
                    const suiteBalance = updatedStats ? Math.floor(updatedStats.suiteBalance) : 0;
                    const dollarValue = (suiteBalance * 0.001).toFixed(2);

                    if (freeRemaining > 0 && suiteBalance > 0) {
                        footer = `🎁 ${freeRemaining} free + 💰 ${suiteBalance} SUITE (~$${dollarValue})`;
                    } else if (freeRemaining > 0) {
                        footer = `🎁 ${freeRemaining} free actions left • \`/earn\` for SUITE`;
                    } else if (suiteBalance > 0) {
                        footer = `💰 ${suiteBalance} SUITE (~$${dollarValue})`;
                    } else {
                        footer = `🚨 0 credits! Use \`/earn\` to watch ads`;
                    }
                }

                await interaction.followUp({
                    content: `─────────────────────────\n${footer}`,
                    ephemeral: true
                });
                break;
            }

            case 'status': {
                await handleDailyBriefCommand(interaction);
                break;
            }

            case 'apps': {
                await handleAppsCommand(interaction);
                break;
            }

            case 'bug': {
                await handleBugCommand(interaction);
                break;
            }

            case 'feature': {
                await handleFeatureCommand(interaction);
                break;
            }

            case 'promote': {
                if (interaction.user.id !== config.ownerId) {
                    await interaction.reply({ content: '❌ Only the owner can promote apps.', ephemeral: true });
                    return;
                }
                await handlePromoteCommand(interaction);
                break;
            }

            case 'demote': {
                if (interaction.user.id !== config.ownerId) {
                    await interaction.reply({ content: '❌ Only the owner can demote apps.', ephemeral: true });
                    return;
                }
                await handleDemoteCommand(interaction);
                break;
            }

            case 'set-env': {
                const appName = interaction.options.getString('app');
                const key = interaction.options.getString('key');
                const value = interaction.options.getString('value');

                // Validate app name format
                const appNameRegex = /^[a-z0-9-]+$/;
                if (!appNameRegex.test(appName)) {
                    await interaction.reply({
                        content: '❌ App name must be lowercase letters, numbers, and dashes only.',
                        ephemeral: true
                    });
                    return;
                }

                // Validate key format (uppercase with underscores)
                const keyRegex = /^[A-Z][A-Z0-9_]*$/;
                if (!keyRegex.test(key)) {
                    await interaction.reply({
                        content: '❌ Variable name must be UPPERCASE with underscores (e.g., API_KEY, MY_SECRET)',
                        ephemeral: true
                    });
                    return;
                }

                try {
                    // Find app directory
                    const appDir = path.join(process.cwd(), '..', appName);
                    const envPath = path.join(appDir, '.env');

                    // Check if app exists
                    if (!fs.existsSync(appDir)) {
                        await interaction.reply({
                            content: `❌ App \`${appName}\` not found. Make sure the app exists in the workspace.`,
                            ephemeral: true
                        });
                        return;
                    }

                    // Read existing .env or create new
                    let envContent = '';
                    if (fs.existsSync(envPath)) {
                        envContent = fs.readFileSync(envPath, 'utf-8');
                    }

                    // Parse and update env
                    const lines = envContent.split('\n').filter(l => l.trim());
                    const envMap = new Map();
                    lines.forEach(line => {
                        const match = line.match(/^([^=]+)=(.*)$/);
                        if (match) {
                            envMap.set(match[1], match[2]);
                        }
                    });

                    envMap.set(key, value);

                    // Write back
                    const newContent = Array.from(envMap.entries())
                        .map(([k, v]) => `${k}=${v}`)
                        .join('\n');
                    fs.writeFileSync(envPath, newContent + '\n', 'utf-8');

                    await interaction.reply({
                        content: `✅ Set \`${key}\` for \`${appName}\`\n\n⚠️ **Note:** You'll need to push an update for the app to use the new value.\n\`\`\`\ncd ${appName}\nnpx eas update --branch production --message "Updated env vars"\n\`\`\``,
                        ephemeral: true
                    });
                } catch (error) {
                    console.error('Error setting env var:', error);
                    await interaction.reply({
                        content: '❌ Failed to set environment variable. Check app exists and permissions.',
                        ephemeral: true
                    });
                }
                break;
            }

            case 'get-env': {
                const appName = interaction.options.getString('app');

                try {
                    const envPath = path.join(process.cwd(), '..', appName, '.env');

                    if (!fs.existsSync(envPath)) {
                        await interaction.reply({
                            content: `📋 No environment variables set for \`${appName}\``,
                            ephemeral: true
                        });
                        return;
                    }

                    const envContent = fs.readFileSync(envPath, 'utf-8');
                    const lines = envContent.split('\n').filter(l => l.trim());

                    // Show keys but hide values
                    const keys = lines
                        .filter(line => line.includes('='))
                        .map(line => {
                            const key = line.split('=')[0];
                            return `• \`${key}\` = ••••••••`;
                        })
                        .join('\n');

                    await interaction.reply({
                        content: `📋 **Environment variables for \`${appName}\`:**\n\n${keys || 'None set'}\n\n*Values hidden for security*`,
                        ephemeral: true
                    });
                } catch (error) {
                    console.error('Error getting env vars:', error);
                    await interaction.reply({
                        content: '❌ Failed to read environment variables.',
                        ephemeral: true
                    });
                }
                break;
            }

            case 'my-apps': {
                await handleMyAppsCommand(interaction);
                break;
            }

            case 'my-app-status': {
                await handleMyAppStatusCommand(interaction);
                break;
            }

            case 'delete-my-app': {
                await handleDeleteMyAppCommand(interaction);
                break;
            }

            case 'preflight-check': {
                await handlePreflightCheck(interaction);
                break;
            }

            case 'publish-app': {
                await handlePublishApp(interaction);
                break;
            }

            case 'remove-app': {
                // Only allow server owner
                if (interaction.user.id !== config.ownerId) {
                    await interaction.reply({
                        content: '❌ Only the server owner can remove apps.',
                        ephemeral: true
                    });
                    return;
                }

                const slug = interaction.options.getString('slug');

                // Update Supabase to set status to 'removed'
                const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co';
                const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

                if (!SUPABASE_SERVICE_KEY) {
                    await interaction.reply({
                        content: '❌ SUPABASE_SERVICE_KEY not configured. Cannot remove app.',
                        ephemeral: true
                    });
                    return;
                }

                try {
                    await interaction.deferReply({ ephemeral: true });

                    const response = await fetch(`${SUPABASE_URL}/rest/v1/apps?slug=eq.${slug}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': SUPABASE_SERVICE_KEY,
                            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                            'Prefer': 'return=representation'
                        },
                        body: JSON.stringify({ status: 'removed' })
                    });

                    if (response.ok) {
                        const updatedApps = await response.json();
                        if (updatedApps && updatedApps.length > 0) {
                            await interaction.editReply({
                                content: `✅ **${slug}** has been removed from the live website!\n\nThe app won't show in the App Store anymore. To restore it later, set status back to 'approved' in Supabase.`
                            });
                        } else {
                            await interaction.editReply({
                                content: `⚠️ No app found with slug \`${slug}\`. Check the app slug and try again.`
                            });
                        }
                    } else {
                        const errorText = await response.text();
                        console.error('Supabase error:', errorText);
                        await interaction.editReply({
                            content: `❌ Failed to remove app. Error: ${errorText.slice(0, 200)}`
                        });
                    }
                } catch (error) {
                    console.error('Remove app error:', error);
                    await interaction.editReply({
                        content: '❌ Failed to remove app. Check logs for details.'
                    });
                }
                break;
            }

            // ⚡ FAST COMMANDS - Instant AI changes
            case 'feature-fast': {
                await handleFeatureFast(interaction);
                break;
            }

            case 'bug-fast': {
                await handleBugFast(interaction);
                break;
            }

            // 👨‍💻 PRO COMMANDS - Human developer with AI
            case 'feature-pro': {
                await handleFeaturePro(interaction);
                break;
            }

            case 'bug-pro': {
                await handleBugPro(interaction);
                break;
            }
        }
    } catch (error) {
        console.error('Command error:', error);
        await interaction.reply({
            content: 'An error occurred. Please try again.',
            ephemeral: true
        }).catch(() => { });
    }
});

// Welcome new members with onboarding DM
client.on('guildMemberAdd', async (member) => {
    try {
        const welcomeMessage = `👋 **Welcome to SUITE Hub, ${member.displayName}!**

🚀 **Ready to Build?**
Use \`/dev-create-app\` to submit your application idea!

📱 **App Publishing Flow:**
1. Submit your app idea with \`/dev-create-app\`
2. Once approved, prepare your app with \`/preflight-check\`
3. Publish to the SUITE App Store with \`/publish-app\`

🔧 **Key Commands:**
• \`/apps\` - Browse all ecosystem apps
• \`/my-apps\` - View your submitted applications
• \`/preflight-check\` - Verify app is ready for PWA publishing
• \`/publish-app\` - Deploy your app (requires preflight)
• \`/bug\` - Report bugs for any app
• \`/feature\` - Request new features
• \`/idea\` - Get AI analysis of your ideas

📖 **Need Help?**
Check out \`/pwa-publish-checklist\` for detailed publishing requirements.

See you in the server! 🎉`;

        await member.send(welcomeMessage).catch(() => {
            // User has DMs disabled, that's okay
            console.log(`Could not DM ${member.displayName} - DMs disabled`);
        });

        console.log(`👋 Welcomed new member: ${member.displayName}`);
    } catch (error) {
        console.error('Error welcoming member:', error);
    }
});

// Error handling
client.on('error', (error) => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

// Login to Discord
console.log('Starting SUITE Hub Bot...');
client.login(config.discordToken);
