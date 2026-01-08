import { config } from '../config.js';
import { EmbedBuilder } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import { addUserApp, updateAppStatus } from './userApps.js';

/**
 * Handle app creation request submission
 */
export async function handleAppCreationRequest(message) {
    // Only allow server owner to create apps
    if (message.author.id !== config.ownerId) {
        await message.reply('❌ Only the server owner can create apps.');
        return;
    }

    const content = message.content;

    // Parse app creation request
    const appNameMatch = content.match(/App Name:\s*(.+)/i);
    const descriptionMatch = content.match(/Description:\s*(.+)/i);
    const typeMatch = content.match(/Type:\s*(expo-go|testflight)/i);
    const featuresMatch = content.match(/Features:\s*([\s\S]+?)(?=\n\n|$)/i);

    if (!appNameMatch || !descriptionMatch || !typeMatch) {
        await message.reply(`❌ **Invalid format.** Please use this template:

\`\`\`
App Name: YourAppName
Description: What your app does
Type: expo-go OR testflight
Features:
- Feature 1
- Feature 2
\`\`\`

**Type must be either \`expo-go\` or \`testflight\`**`);
        return;
    }

    const appName = appNameMatch[1].trim();
    const description = descriptionMatch[1].trim();
    const type = typeMatch[1].trim().toLowerCase();
    const features = featuresMatch ? featuresMatch[1].trim() : '';

    // Move to pending-apps channel
    const pendingChannel = await message.client.channels.fetch(config.channels.pendingApps);

    const embed = new EmbedBuilder()
        .setTitle(`📱 New App Request: ${appName}`)
        .setDescription(description)
        .addFields(
            { name: 'Type', value: type === 'expo-go' ? '🟢 Expo Go' : '🔵 TestFlight', inline: true },
            { name: 'Submitted by', value: `<@${message.author.id}>`, inline: true }
        )
        .setColor(type === 'expo-go' ? '#00FF00' : '#0000FF')
        .setTimestamp();

    if (features) {
        embed.addFields({ name: 'Features', value: features });
    }

    const pendingMessage = await pendingChannel.send({ embeds: [embed] });

    // Add 🚀 reaction for approval
    await pendingMessage.react('🚀');
    await pendingMessage.react('❌');

    // Confirm in original channel
    await message.reply(`✅ App creation request submitted! Check <#${config.channels.pendingApps}> and react with 🚀 to create the app.`);

    // Delete original message
    await message.delete().catch(() => { });
}

/**
 * Handle app creation approval (🚀 reaction)
 */
export async function handleAppCreationApproval(reaction, user) {
    const message = reaction.message;
    const embed = message.embeds[0];

    // Accept both owner apps and developer apps
    const isOwnerApp = embed?.title?.startsWith('📱 New App Request:');
    const isDeveloperApp = embed?.title?.startsWith('📱 New Developer App:');

    if (!embed || (!isOwnerApp && !isDeveloperApp)) {
        return;
    }

    // Parse app details from embed
    let appName = embed.title.replace('📱 New App Request: ', '').replace('📱 New Developer App: ', '').trim();
    const description = embed.description;

    let promptContent;
    let filename;
    const timestamp = Date.now();

    if (isDeveloperApp) {
        // Developer app - get fields from embed
        const developerIdField = embed.fields.find(f => f.name === '🆔 Developer ID');
        const developerId = developerIdField?.value || 'unknown';
        const freeFeaturesField = embed.fields.find(f => f.name === '🆓 Free Features');
        const freeFeatures = freeFeaturesField?.value || '';
        const paidFeaturesField = embed.fields.find(f => f.name === '💰 Paid Features');
        const paidFeatures = paidFeaturesField?.value || 'None';

        promptContent = `Create Developer App: ${appName}

Developer ID: ${developerId}
App Name: ${appName}
Description: ${description}

Free Features:
${freeFeatures.split(',').map(f => `- ${f.trim()}`).join('\n')}

Paid AI Features (in SUITE tokens):
${paidFeatures}

Instructions:
1. Generate a complete React Native Expo app
2. Use modern, clean UI with proper navigation
3. Integrate @suite/payments SDK for any paid features:
   - import { SUITE } from '@suite/payments';
   - const suite = SUITE.init({ appId: '${appName}', developerId: '${developerId}' });
   - await suite.charge({ amount: X, description: 'feature name' });
4. Create the app in: stuart-hollinger-landing/community-apps/${appName}/
5. Set up Expo project ready for testing
6. Push to GitHub and publish to Expo
7. Delete this prompt file after completion
8. Post results back to Discord with:
   - Expo Go link for testing
   - GitHub URL
   - Instructions for developer

Revenue split: 70% to developer (${developerId}), 30% platform
IMPORTANT: All paid features must use SUITE tokens via the SDK!
`;
        filename = `DevApp_${timestamp}_${appName}.txt`;
    } else {
        // Owner app - original logic
        const typeField = embed.fields.find(f => f.name === 'Type');
        const type = typeField?.value.includes('Expo Go') ? 'expo-go' : 'testflight';
        const featuresField = embed.fields.find(f => f.name === 'Features');
        const features = featuresField?.value || '';

        promptContent = `Create New App: ${appName}

Description: ${description}

Type: ${type}

Features:
${features}

Instructions:
1. Create new Expo app in stuart-hollinger-landing/${appName.toLowerCase().replace(/\s+/g, '-')}
2. Set up proper structure with app/, components/, constants/
3. Add theme.ts with color palette and styling
4. Create working App.js with the requested features
5. Configure app.config.js with:
   - Fixed runtimeVersion: "1.0.0"
   - owner: "stuart5915"
   - slug: "${appName.toLowerCase().replace(/\s+/g, '-')}"
6. Initialize git and commit
7. Push to GitHub repo: stuart5915/${appName.toLowerCase().replace(/\s+/g, '-')}
8. Add GitHub Actions workflow for auto-updates
9. Delete this prompt file after completion
10. Notify user with:
    - GitHub URL
    - Expo Go link: exp://exp.host/@stuart5915/${appName.toLowerCase().replace(/\s+/g, '-')}
    - Instructions for testers

NOTE: App will be available via Expo Go once pushed to GitHub and published.
No dev server needed - users access via the permanent Expo link!
`;
        filename = `CreateApp_${timestamp}_${appName.replace(/\s+/g, '_')}.txt`;
    }

    // Save to prompts folder
    const promptsDir = path.join(process.cwd(), '../prompts');
    const filePath = path.join(promptsDir, filename);

    try {
        await fs.writeFile(filePath, promptContent, 'utf-8');
        console.log(`✅ App creation prompt saved: ${filename}`);

        // Track developer app in user's app list
        if (isDeveloperApp) {
            const developerIdField = embed.fields.find(f => f.name === '🆔 Developer ID');
            const developerId = developerIdField?.value || 'unknown';
            addUserApp(developerId, {
                name: appName,
                description: description
            });
            updateAppStatus(developerId, appName, 'building');
            console.log(`📱 Tracked app "${appName}" for developer ${developerId}`);
        }

        // Update embed to show approved
        const approvedEmbed = EmbedBuilder.from(embed)
            .setColor('#00FF00')
            .setFooter({ text: `✅ Approved by ${user.tag} | Building now...` });

        await message.edit({ embeds: [approvedEmbed] });
        await message.reactions.removeAll();
        await message.react('✅');

    } catch (error) {
        console.error('Error saving app creation prompt:', error);
        await message.reply('❌ Failed to generate app creation prompt.');
    }
}

/**
 * Handle app deletion request
 */
export async function handleAppDeletionRequest(message) {
    // Only allow server owner to delete apps
    if (message.author.id !== config.ownerId) {
        await message.reply('❌ Only the server owner can delete apps.');
        return;
    }

    const content = message.content;

    // Parse deletion request
    const appNameMatch = content.match(/App Name:\s*(.+)/i);
    const reasonMatch = content.match(/Reason:\s*(.+)/i);

    if (!appNameMatch) {
        await message.reply(`❌ ** Invalid format.** Please use this template:

    \`\`\`
App Name: YourAppName
Reason: Why you're deleting it
\`\`\`

**Reason is optional but helpful!**`);
        return;
    }

    const appName = appNameMatch[1].trim();
    const reason = reasonMatch ? reasonMatch[1].trim() : 'Not specified';

    // Generate prompt file for deletion
    const promptContent = `Delete App: ${appName}

Reason: ${reason}

Instructions:
1. Delete folder: stuart-hollinger-landing/${appName.toLowerCase().replace(/\s+/g, '-')}
2. Remove from bot config (validAppChannels)
3. Archive Discord channel for app
4. Remove from GitHub (or archive repo)
5. Confirm deletion to user

IMPORTANT: Verify app name is correct before deleting!
`;

    // Save to prompts folder
    const timestamp = Date.now();
    const filename = `DeleteApp_${timestamp}_${appName.replace(/\s+/g, '_')}.txt`;
    const promptsDir = path.join(process.cwd(), '../prompts');
    const filePath = path.join(promptsDir, filename);

    try {
        await fs.writeFile(filePath, promptContent, 'utf-8');
        console.log(`✅ App deletion prompt saved: ${filename}`);

        await message.reply(`✅ Deletion request submitted for **${appName}**. The app will be removed shortly.`);
        await message.delete().catch(() => { });

    } catch (error) {
        console.error('Error saving deletion prompt:', error);
        await message.reply('❌ Failed to process deletion request.');
    }
}
