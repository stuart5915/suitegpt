import { config } from '../config.js';
import { refineSubmission } from '../gemini.js';
import { createPendingEmbed } from '../utils/embeds.js';

// Map channel IDs to submission types
const SUBMISSION_CHANNELS = new Map();

// Store pending specs by message ID (so we don't have to show ugly JSON)
export const pendingSpecs = new Map();

export function initSubmissionHandler(client) {
    // Unified submit channel - type detected from message content
    if (config.channels.submit) {
        SUBMISSION_CHANNELS.set(config.channels.submit, 'auto');
    }
}

/**
 * Detect submission type from message content
 */
function detectSubmissionType(content) {
    const lower = content.toLowerCase();
    if (lower.includes('bug') || lower.includes('error') || lower.includes('broken') || lower.includes('fix')) {
        return 'bug';
    }
    if (lower.includes('feature') || lower.includes('add') || lower.includes('want') || lower.includes('could')) {
        return 'feature';
    }
    if (lower.includes('video') || lower.includes('tiktok') || lower.includes('twitter') || lower.includes('blog')) {
        return 'content';
    }
    return 'feature'; // Default to feature
}

/**
 * Handle a new message in a submission channel
 */
// Track processed messages to prevent duplicates (by ID and content hash)
const processedMessages = new Set();

export async function handleSubmission(message) {
    // Ignore bot messages FIRST - before any other logic
    if (message.author.bot) return;

    let submissionType = SUBMISSION_CHANNELS.get(message.channel.id);

    if (!submissionType) {
        return; // Not a submission channel
    }

    // Auto-detect type from message content if using unified channel
    if (submissionType === 'auto') {
        submissionType = detectSubmissionType(message.content);
    }

    // Create a unique key combining message ID, channel ID, and content length
    const uniqueKey = `${message.id}_${message.channel.id}_${message.content.length}`;

    // Prevent duplicate processing
    if (processedMessages.has(message.id) || processedMessages.has(uniqueKey)) {
        console.log(`[DUPLICATE BLOCKED] Message ${message.id} already processed`);
        return; // Already processed
    }
    processedMessages.add(message.id);
    processedMessages.add(uniqueKey);

    // Clean up old entries after 5 minutes
    setTimeout(() => {
        processedMessages.delete(message.id);
        processedMessages.delete(uniqueKey);
    }, 300000);

    console.log(`[SUBMISSION] Processing message ${message.id} from ${message.author.username}`);

    // Check if user has tester role (if configured)
    if (config.testerRoleId) {
        const member = await message.guild.members.fetch(message.author.id);
        const hasTesterRole = member.roles.cache.has(config.testerRoleId) ||
            member.roles.cache.has(config.reviewerRoleId) ||
            member.permissions.has('Administrator');

        if (!hasTesterRole) {
            await message.react('❌');
            await message.reply({
                content: `❌ Only testers can submit bugs/features. Ask an admin for the Tester role!`
            });
            return;
        }
    }

    // Ignore very short messages
    if (message.content.length < 10) {
        await message.react('❓');
        await message.reply({
            content: 'Your submission seems too short. Please provide more details!',
            ephemeral: true
        }).catch(() => { });
        return;
    }

    // Extract and validate app channel mention (e.g., <#1457482744664948986>)
    const channelMentionMatch = message.content.match(/<#(\d+)>/);

    if (!channelMentionMatch) {
        await message.react('❌');
        const validChannelMentions = Object.entries(config.validAppChannels)
            .map(([id, name]) => `<#${id}>`)
            .join(', ');
        await message.reply({
            content: `❌ **Missing App Channel**\n\nYou must tag which app this is for using a channel mention.\n\n**Valid apps:**\n${validChannelMentions}\n\n**Example:**\n<#1457482744664948986> Login button doesn't work on mobile\n\n**Tip:** Type \`#\` and select the app from the dropdown!`
        });
        return;
    }

    const mentionedChannelId = channelMentionMatch[1];
    const appName = config.validAppChannels[mentionedChannelId];

    if (!appName) {
        await message.react('❌');
        const validChannelMentions = Object.entries(config.validAppChannels)
            .map(([id, name]) => `<#${id}>`)
            .join(', ');
        await message.reply({
            content: `❌ **Unknown App Channel**\n\n**Valid apps:**\n${validChannelMentions}`
        });
        return;
    }

    try {
        // React to show we're processing
        await message.react('⏳');

        // Get the pending channel
        const pendingChannel = message.guild.channels.cache.get(config.channels.pending);
        if (!pendingChannel) {
            console.error('Pending channel not found');
            await message.react('❌');
            return;
        }

        // Use Gemini to refine the submission
        console.log(`Processing ${submissionType} submission from ${message.author.username} for ${appName}`);
        const spec = await refineSubmission(
            submissionType,
            message.content,
            message.author.username,
            appName  // Pass the validated app name
        );

        // Store original message info for reference
        spec.originalMessageId = message.id;
        spec.originalChannelId = message.channel.id;
        spec.authorId = message.author.id;
        spec.app = appName;  // Add app to spec
        spec.appChannelId = mentionedChannelId;  // Store channel ID for reference

        // Create and send the pending embed (CLEAN - no ugly JSON!)
        const embed = createPendingEmbed(spec);
        const pendingMessage = await pendingChannel.send({
            embeds: [embed]
        });

        // Store spec data for approval handler (hidden from users)
        pendingSpecs.set(pendingMessage.id, spec);

        // Add approval reactions
        await pendingMessage.react('🚀');                    // 🚀 Send to Antigravity IDE
        await pendingMessage.react(config.emojis.manual);    // 🔧 Manual (complex work)
        await pendingMessage.react(config.emojis.todo);      // 📋 TODO (backlog)
        await pendingMessage.react(config.emojis.needsInfo); // 🔍 Needs Info
        await pendingMessage.react(config.emojis.reject);    // ❌ Reject

        // Update original message reaction to show success
        await message.reactions.removeAll().catch(() => { });
        await message.react('✅');

        // Reply to user
        await message.reply({
            content: `Your ${submissionType} has been submitted for review! Check <#${config.channels.pending}> for updates.`
        });

        console.log(`Created pending ticket: ${spec.title}`);

    } catch (error) {
        console.error('============ SUBMISSION ERROR ============');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Message content:', message.content);
        console.error('=========================================');
        await message.reactions.removeAll().catch(() => { });
        await message.react('❌');
        await message.reply({
            content: 'Sorry, there was an error processing your submission. Please try again.'
        }).catch(() => { });
    }
}
