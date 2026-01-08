import { config } from '../config.js';
import { createApprovedEmbed, createShippedEmbed, createCodeReviewEmbed } from '../utils/embeds.js';
import { addReward } from './rewards.js';
import { pendingSpecs } from './submission.js';
import { generateCodeChange, initClaude } from '../claude.js';
import { getQueuePosition, addToQueue, isBusy, QueueStatus } from './queue-status.js';

// Store approved specs by message ID
const approvedSpecs = new Map();

// Initialize Claude on module load
initClaude();

/**
 * Handle reaction add events for approval workflow
 */
export async function handleReactionAdd(reaction, user) {
    // Ignore bot reactions
    if (user.bot) return;

    // Only process reactions in pending channel
    if (reaction.message.channel.id !== config.channels.pending) return;

    // Check if user has reviewer role
    const member = await reaction.message.guild.members.fetch(user.id);
    const hasReviewerRole = member.roles.cache.has(config.reviewerRoleId) ||
        member.permissions.has('Administrator');

    if (!hasReviewerRole) {
        // Remove unauthorized reaction
        await reaction.users.remove(user.id).catch(() => { });
        return;
    }

    const emoji = reaction.emoji.name;

    // Only process approval/reject/AI reactions
    const isApprove = emoji === config.emojis.approve;  // ✅ Sonnet
    const isOpus = emoji === config.emojis.opus;        // 🧠 Opus
    const isManual = emoji === config.emojis.manual;    // 🔧 Manual
    const isTodo = emoji === config.emojis.todo;        // 📋 TODO
    const isNeedsInfo = emoji === config.emojis.needsInfo; // 🔍 Needs Info
    const isReject = emoji === config.emojis.reject;    // ❌ Reject
    const isAIRefine = emoji === '🤖';                  // 🤖 AI Refine
    const isSendToIDE = emoji === '🚀';                 // 🚀 Send to Antigravity

    if (!isApprove && !isOpus && !isManual && !isTodo && !isNeedsInfo && !isReject && !isAIRefine && !isSendToIDE) {
        return; // Not a valid reaction
    }

    try {
        // Get spec from Map (check both imported and global)
        const message = reaction.message;
        let spec = pendingSpecs.get(message.id);

        // Also check global.pendingSpecs (used by /bug and /feature commands)
        if (!spec && global.pendingSpecs) {
            spec = global.pendingSpecs.get(message.id);
        }

        if (!spec) {
            console.error('Could not find spec for message:', message.id);
            return;
        }

        if (isApprove || isOpus) {
            const model = isOpus ? 'opus' : 'sonnet';
            await handleApproval(message, spec, user.username, model);
        } else if (isManual) {
            await handleManual(message, spec, user);
        } else if (isTodo) {
            await handleTodo(message, spec, user.username);
        } else if (isNeedsInfo) {
            await handleNeedsInfo(message, spec, user.username);
        } else if (isReject) {
            await handleRejection(message, spec, user.username);
        } else if (isAIRefine) {
            // Import AI refinement handler
            const { handleAIRefinement } = await import('./ai-refinement.js');
            await handleAIRefinement(message, user);
            // Don't delete the spec - they can still approve after refining
            return; // Early return to prevent deletion
        } else if (isSendToIDE) {
            // 🚀 Send to Antigravity IDE
            await handleSendToIDE(message, spec, user);
            // Don't delete yet - will be deleted after IDE processes it
            return;
        }

        // Clean up after processing
        pendingSpecs.delete(message.id);

    } catch (error) {
        console.error('Reaction handling error:', error);
    }
}

/**
 * Handle approval of a submission
 * @param {Object} message - Discord message
 * @param {Object} spec - Submission specification
 * @param {string} approvedBy - Username who approved
 * @param {string} model - 'sonnet' or 'opus'
 */
async function handleApproval(message, spec, approvedBy, model = 'sonnet') {
    const guild = message.guild;

    // Get the approved channel
    const approvedChannel = guild.channels.cache.get(config.channels.approved);
    if (!approvedChannel) {
        console.error('Approved channel not found');
        return;
    }

    // Create approved embed and post to #approved
    const embed = createApprovedEmbed(spec, approvedBy);
    const approvedMessage = await approvedChannel.send({
        embeds: [embed],
        content: `🤖 **Claude ${model === 'opus' ? 'Opus 🧠' : 'Sonnet ⚡'}** is generating code...`
    });

    // Trigger Claude AI to generate code!
    console.log(`🤖 Triggering Claude ${model} for: ${spec.title}`);
    const codeResult = await generateCodeChange(spec, model);

    if (codeResult.success) {
        // Update the approved message with code result
        const codeEmbed = createCodeReviewEmbed(spec, codeResult, model);
        await approvedMessage.edit({
            embeds: [embed, codeEmbed],
            content: `✅ **Code generated by Claude ${model === 'opus' ? 'Opus 🧠' : 'Sonnet ⚡'}**`
        });
        console.log(`✅ Code generated for: ${spec.title}`);
    } else {
        await approvedMessage.edit({
            embeds: [embed],
            content: `❌ **Claude error:** ${codeResult.error}`
        });
    }

    // Store for ship handler
    approvedSpecs.set(approvedMessage.id, {
        ...spec,
        approvedBy,
        approvedAt: new Date().toISOString(),
        codeResult
    });

    // Add ship reaction
    await approvedMessage.react(config.emojis.shipped);

    // Add reward to contributor (if enabled)
    if (config.enableRewards) {
        await addReward(spec.authorId, spec.submittedBy, spec.suiteReward, spec.type);
    }

    // Delete the pending message
    await message.delete().catch(() => { });

    // Notify the original submitter
    try {
        const submitter = await guild.members.fetch(spec.authorId);
        const rewardMsg = config.enableRewards ? ` You earned **${spec.suiteReward} SUITE**!` : '';
        await submitter.send({
            content: `🎉 Your ${spec.type} "${spec.title}" was approved!${rewardMsg}\n\n🤖 Claude ${model} is generating the code fix now!`
        });
    } catch {
        // User may have DMs disabled
    }

    console.log(`Approved: ${spec.title} by ${approvedBy} (using ${model})`);
}

/**
 * Handle rejection of a submission
 */
async function handleRejection(message, spec, rejectedBy) {
    const channel = message.channel;

    // Notify in channel by mentioning the user
    await channel.send({
        content: `❌ <@${spec.authorId}> Your ${spec.type} "${spec.title}" was not approved by **${rejectedBy}**.\n\nFeel free to improve and resubmit!`
    });

    // Delete the pending message
    await message.delete().catch(() => { });

    console.log(`Rejected: ${spec.title} by ${rejectedBy}`);
}

/**
 * Handle TODO - save to backlog for later
 */
async function handleTodo(message, spec, addedBy) {
    const guild = message.guild;

    // For now, just react to confirm and keep the message
    // Later we can move to a dedicated #backlog channel
    await message.react('✅');

    // Notify in the channel
    await message.reply({
        content: `📋 **Added to TODO** by ${addedBy}\nThis will be addressed later.`
    });

    console.log(`TODO: ${spec.title} added by ${addedBy}`);

    // Note: We DON'T delete the message or remove from pendingSpecs
    // so it stays visible in pending as a "saved for later" item
}

/**
 * Handle Needs Info - ask submitter for more details
 */
async function handleNeedsInfo(message, spec, requestedBy) {
    const guild = message.guild;

    // React to show it needs info
    await message.react('❓');

    // Get the original submission channel where user typed
    const originalChannel = guild.channels.cache.get(spec.originalChannelId);

    if (originalChannel) {
        // Reply in the original channel (e.g., #submit-bugs)
        await originalChannel.send({
            content: `🔍 **More info needed** <@${spec.authorId}>

Your submission "${spec.title}" needs more details before it can be approved.

**Reviewer:** ${requestedBy}

**Please provide:**
• Specific steps to reproduce (if bug)
• Expected vs actual behavior  
• Screenshots if applicable

Please resubmit with more details!`
        });
    } else {
        // Fallback: reply in pending channel
        await message.reply({
            content: `🔍 **More info needed** from <@${spec.authorId}>. Please provide more details about this ${spec.type}.`
        });
    }

    console.log(`Needs info: ${spec.title} - requested by ${requestedBy}`);

    // Note: We DON'T delete - it stays in pending waiting for more info
}

/**
 * Handle Send to IDE (Antigravity) - queue for auto-processing
 */
async function handleSendToIDE(message, spec, user) {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const promptsFolder = path.join(__dirname, '../../../prompts');

    // Check queue status
    const queuePos = getQueuePosition();

    if (queuePos.isBusy) {
        // Queue is busy - add to queue and notify
        const position = addToQueue({
            title: spec.title,
            type: spec.type,
            app: spec.app,
            messageId: message.id
        });

        await message.react('⏳');
        await message.reply({
            content: `⏳ **Queued!** The IDE is currently processing: "${queuePos.currentPrompt}"

Your request "${spec.title}" is **#${position}** in queue.

I'll process it automatically when the current build finishes! 🚀`
        });

        console.log(`Queued for IDE: ${spec.title} (position ${position})`);
        return;
    }

    // Queue is free - send immediately
    try {
        // Create prompt file for IDE
        const sanitizedTitle = spec.title.replace(/[^a-zA-Z0-9_ ]/g, '').substring(0, 30).replace(/ /g, '_');
        const timestamp = Date.now();
        const filename = `${spec.app || 'unknown'}_${timestamp}_${sanitizedTitle}.txt`;
        const filepath = path.join(promptsFolder, filename);

        // Download any attached images
        const imageDir = path.join(promptsFolder, 'images');
        if (!fs.existsSync(imageDir)) {
            fs.mkdirSync(imageDir, { recursive: true });
        }

        let imageReferences = '';
        const attachments = message.attachments?.filter(a =>
            a.contentType?.startsWith('image/') ||
            a.url?.match(/\.(png|jpg|jpeg|gif|webp)$/i)
        );

        if (attachments && attachments.size > 0) {
            const https = await import('https');
            const http = await import('http');

            let imgIndex = 0;
            for (const [id, attachment] of attachments) {
                try {
                    const imgFilename = `${spec.app}_${timestamp}_img${imgIndex}.png`;
                    const imgPath = path.join(imageDir, imgFilename);

                    // Download image
                    const protocol = attachment.url.startsWith('https') ? https : http;
                    await new Promise((resolve, reject) => {
                        const file = fs.createWriteStream(imgPath);
                        protocol.get(attachment.url, (response) => {
                            response.pipe(file);
                            file.on('finish', () => {
                                file.close();
                                resolve();
                            });
                        }).on('error', reject);
                    });

                    imageReferences += `\nScreenshot ${imgIndex + 1}: prompts/images/${imgFilename}`;
                    imgIndex++;
                    console.log(`Downloaded image: ${imgFilename}`);
                } catch (imgError) {
                    console.error('Error downloading image:', imgError);
                }
            }
        }

        const promptContent = `[${spec.app || 'App'}] ${spec.title}

${spec.description}

Type: ${spec.type}
Priority: ${spec.priority || 'Medium'}
${imageReferences ? `\n📸 Attached Screenshots:${imageReferences}\nUse view_file to see these images for visual context.` : ''}

Please implement this change, test it, and commit with a descriptive message.
After committing, run: expo publish --non-interactive`;

        fs.writeFileSync(filepath, promptContent);

        // React and notify
        await message.react('🚀');
        await message.reply({
            content: `🚀 **Sent to Antigravity IDE!**

"${spec.title}" is now being processed.${imageReferences ? '\n\n📸 Screenshots included!' : ''}

⏳ The IDE will:
1. Implement the changes
2. Test and commit
3. Publish to Expo OTA

You'll see updates appear in the app within minutes! 🎉`
        });

        console.log(`Sent to IDE: ${spec.title} -> ${filename}`);

    } catch (error) {
        console.error('Error sending to IDE:', error);
        await message.react('❌');
        await message.reply({
            content: `❌ Error sending to IDE: ${error.message}`
        });
    }
}

/**
 * Handle manual mode - generate a prompt for IDE paste instead of auto-coding
 */
async function handleManual(message, spec, user) {
    const guild = message.guild;

    // Generate the IDE-ready prompt
    const prompt = generateIDEPrompt(spec);

    // Write to prompts queue folder
    const fs = await import('fs');
    const path = await import('path');

    const promptsDir = path.join(process.cwd(), '..', 'prompts');
    const timestamp = Date.now();
    const safeTitle = spec.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const filename = `${spec.app.toLowerCase()}_${timestamp}_${safeTitle}.txt`;
    const filepath = path.join(promptsDir, filename);

    try {
        // Ensure prompts directory exists
        if (!fs.existsSync(promptsDir)) {
            fs.mkdirSync(promptsDir, { recursive: true });
        }

        // Write the prompt file
        fs.writeFileSync(filepath, prompt);

        // DM the user with confirmation
        await user.send({
            content: `🔧 **Prompt queued for IDE!**\n\n**Project:** ${spec.app}\n**File:** \`${filename}\`\n\n📂 Check your \`prompts/\` folder, then tell Antigravity: "Process all prompts in the prompts folder"`
        });

        // React to confirm
        await message.react('📨');

        console.log(`Manual prompt queued: ${filename}`);
    } catch (error) {
        console.error('Error writing prompt file:', error);
        // Fallback: DM the prompt directly
        await user.send({
            content: `🔧 **Manual Mode - IDE Prompt Ready**\n\n**Project:** ${spec.app}\n**Type:** ${spec.type}\n\n📋 **Copy this prompt and paste into your IDE:**\n\`\`\`\n${prompt}\n\`\`\``
        }).catch(() => { });
    }
}

/**
 * Generate an IDE-ready prompt from a spec
 */
function generateIDEPrompt(spec) {
    return `[${spec.app}] ${spec.title}

${spec.description}

Type: ${spec.type}
Priority: ${spec.priority || 'Medium'}
${spec.steps ? `\nSteps to reproduce:\n${spec.steps}` : ''}
${spec.expected ? `\nExpected behavior: ${spec.expected}` : ''}
${spec.impact ? `\nImpact: ${spec.impact}` : ''}

Please implement this change, test it, and commit with a descriptive message.`;
}

/**
 * Handle ship reaction on approved items
 */
export async function handleShipReaction(reaction, user) {
    // Ignore bot reactions
    if (user.bot) return;

    // Only process in approved channel
    if (reaction.message.channel.id !== config.channels.approved) return;

    const emoji = reaction.emoji.name;
    if (emoji !== config.emojis.shipped) return;

    // Check if user has reviewer role
    const member = await reaction.message.guild.members.fetch(user.id);
    const hasReviewerRole = member.roles.cache.has(config.reviewerRoleId) ||
        member.permissions.has('Administrator');

    if (!hasReviewerRole) {
        await reaction.users.remove(user.id).catch(() => { });
        return;
    }

    try {
        const message = reaction.message;
        const spec = approvedSpecs.get(message.id);

        if (!spec) {
            console.error('Could not find spec for approved message:', message.id);
            return;
        }
        const guild = message.guild;

        // Get shipped channel
        const shippedChannel = guild.channels.cache.get(config.channels.shipped);
        if (!shippedChannel) {
            console.error('Shipped channel not found');
            return;
        }

        // Post to shipped
        const embed = createShippedEmbed(spec, user.username);
        await shippedChannel.send({ embeds: [embed] });

        // Add ship bonus
        const bonus = config.rewards.shipBonus;
        await addReward(spec.authorId, spec.submittedBy, bonus, 'ship_bonus');

        // Notify contributor
        try {
            const submitter = await guild.members.fetch(spec.authorId);
            await submitter.send({
                content: `🚀 Your ${spec.type} "${spec.title}" has shipped! Bonus: **${bonus} SUITE**!`
            });
        } catch {
            // DMs disabled
        }

        // Delete from approved
        await message.delete().catch(() => { });

        console.log(`Shipped: ${spec.title} by ${user.username}`);

    } catch (error) {
        console.error('Ship handling error:', error);
    }
}
