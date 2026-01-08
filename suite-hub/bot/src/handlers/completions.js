import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmbedBuilder } from 'discord.js';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMPLETIONS_DIR = path.join(__dirname, '../../../completions');

/**
 * Watch for completion files and post results to Discord
 */
export function startCompletionWatcher(client) {
    console.log('👀 Starting completion file watcher...');

    // Check for completions every 10 seconds
    setInterval(async () => {
        try {
            await processCompletions(client);
        } catch (error) {
            console.error('Error processing completions:', error);
        }
    }, 10000);
}

/**
 * Process any pending completion files
 */
async function processCompletions(client) {
    try {
        const files = await fs.readdir(COMPLETIONS_DIR);
        const completions = files.filter(f => f.startsWith('completed_') && f.endsWith('.json'));

        for (const file of completions) {
            const filePath = path.join(COMPLETIONS_DIR, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const completion = JSON.parse(content);

            await handleCompletion(client, completion);

            // Delete the completion file after processing
            await fs.unlink(filePath);
            console.log(`✅ Processed and deleted: ${file}`);
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }
}

/**
 * Handle a completion and post to Discord
 */
async function handleCompletion(client, completion) {
    switch (completion.type) {
        case 'app_created':
            await postAppCreatedMessage(client, completion);
            break;
        case 'build_ready':
            await handleBuildReady(client, completion);
            break;
        case 'bug_fixed':
            await postBugFixedMessage(client, completion);
            break;
        case 'feature_added':
            await postFeatureAddedMessage(client, completion);
            break;
        default:
            console.log(`Unknown completion type: ${completion.type}`);
    }
}

/**
 * Post app created message to #new-releases
 */
async function postAppCreatedMessage(client, completion) {
    const channel = await client.channels.fetch(config.channels.newReleases);
    if (!channel) {
        console.error('Could not find new-releases channel');
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(`🚀 New App: ${completion.appName}`)
        .setDescription('A new app has been created and is ready for testing!')
        .addFields(
            { name: '📱 Expo Go Link', value: `\`${completion.expoLink}\``, inline: false },
            { name: '🐙 GitHub', value: `[View Code](${completion.githubUrl})`, inline: true },
            { name: '👤 Developer', value: `<@${completion.developerId}>`, inline: true }
        )
        .setColor('#00FF00')
        .setFooter({ text: 'Open in Expo Go to test!' })
        .setTimestamp();

    await channel.send({
        content: completion.developerId ? `<@${completion.developerId}> Your app is ready!` : 'A new app is ready!',
        embeds: [embed]
    });

    console.log(`📢 Posted app created message for: ${completion.appName}`);
}

/**
 * Post bug fixed message to shipped channel
 */
async function postBugFixedMessage(client, completion) {
    // Post to shipped channel
    if (!config.channels.shipped) {
        console.error('No shipped channel configured');
        return;
    }

    const channel = await client.channels.fetch(config.channels.shipped);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle(`🐛 Bug Fixed: ${completion.appName}`)
        .setDescription(completion.description || 'A bug has been fixed.')
        .setColor('#22C55E')
        .setTimestamp();

    await channel.send({ embeds: [embed] });
}

/**
 * Post feature added message to shipped channel
 */
async function postFeatureAddedMessage(client, completion) {
    // Post to shipped channel
    if (!config.channels.shipped) {
        console.error('No shipped channel configured');
        return;
    }

    const channel = await client.channels.fetch(config.channels.shipped);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle(`✨ New Feature: ${completion.appName}`)
        .setDescription(completion.description || 'A new feature has been added.')
        .setColor('#6366F1')
        .setTimestamp();

    await channel.send({ embeds: [embed] });
}

/**
 * Handle build ready notification - DM developer and post to #new-releases
 * Completion format:
 * {
 *   type: 'build_ready',
 *   appName: 'MyApp',
 *   developerId: '123456789',
 *   installLink: 'https://expo.dev/...',
 *   platform: 'ios' or 'android',
 *   buildId: 'abc123'
 * }
 */
async function handleBuildReady(client, completion) {
    const { appName, developerId, installLink, platform, buildId } = completion;

    console.log(`🔔 Build ready for ${appName} (${platform})`);

    // 1. DM the developer
    try {
        const guild = await client.guilds.fetch(config.guildId);
        const member = await guild.members.fetch(developerId);

        const dmEmbed = new EmbedBuilder()
            .setTitle(`🎉 Your app "${appName}" is ready!`)
            .setDescription('Your app has finished building and is ready to install!')
            .addFields(
                { name: '📱 Platform', value: platform === 'ios' ? '🍎 iOS' : '🤖 Android', inline: true },
                { name: '📦 Install Link', value: `[Download Here](${installLink})`, inline: true }
            )
            .addFields({
                name: '📋 Next Steps',
                value: platform === 'ios'
                    ? '1. Open the link on your iPhone\n2. Install the app via TestFlight\n3. Future updates will appear automatically!'
                    : '1. Open the link on your Android device\n2. Download and install the APK\n3. Future updates will appear automatically!'
            })
            .setColor('#00FF00')
            .setFooter({ text: 'All future /feature and /bug updates will push automatically!' })
            .setTimestamp();

        await member.send({ embeds: [dmEmbed] });
        console.log(`📨 DM sent to developer ${developerId}`);
    } catch (error) {
        console.error(`Could not DM developer ${developerId}:`, error.message);
    }

    // 2. Post to #new-releases channel
    try {
        const releasesChannel = await client.channels.fetch(config.channels.shipped);
        if (releasesChannel) {
            const channelEmbed = new EmbedBuilder()
                .setTitle(`🚀 New App Available: ${appName}`)
                .setDescription(`A new ${platform === 'ios' ? 'iOS' : 'Android'} app is ready for testing!`)
                .addFields(
                    { name: '👤 Developer', value: `<@${developerId}>`, inline: true },
                    { name: '📱 Platform', value: platform === 'ios' ? '🍎 iOS' : '🤖 Android', inline: true },
                    { name: '📦 Install', value: `[Download](${installLink})`, inline: true }
                )
                .setColor('#6366F1')
                .setTimestamp();

            await releasesChannel.send({
                content: `<@${developerId}> Your app is live! 🎉`,
                embeds: [channelEmbed]
            });
        }
    } catch (error) {
        console.error('Could not post to releases channel:', error.message);
    }
}

