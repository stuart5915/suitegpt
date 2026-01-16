import { config } from '../config.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { isPreflightPassed } from './preflightCheck.js';

const execAsync = promisify(exec);

// Supabase configuration for app store
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Cadence Supabase configuration (for marketing content generation)
const CADENCE_SUPABASE_URL = process.env.CADENCE_SUPABASE_URL || 'https://tbfpopablanksrzyxaxj.supabase.co';
const CADENCE_SUPABASE_KEY = process.env.CADENCE_SUPABASE_KEY;

// Store pending publish requests
const pendingPublishes = new Map();

// App folder mappings (local folder name -> display name)
const appFolders = {
    'cheshbon-reflections': { name: 'Cheshbon Reflections', category: 'lifestyle', description: 'Daily Bible reading with AI-powered insights and community discussion.' },
    'food-vitals-expo': { name: 'FoodVitals', category: 'health', description: 'Scan any food, get instant nutrition info with AI.' },
    'opticrep-ai-workout-trainer': { name: 'OpticRep', category: 'fitness', description: 'AI personal trainer that watches your form and counts reps.' },
    'life-hub-app': { name: 'Life Hub AI', category: 'ai', description: 'Your personal AI assistant that connects all your apps.' },
    'remcast': { name: 'REMcast', category: 'lifestyle', description: 'Record, analyze, and visualize your dreams with AI.' },
    'defi-knowledge': { name: 'DeFi Knowledge', category: 'finance', description: 'Learn crypto, DeFi, and Web3 with guided resources.' },
};

/**
 * Handle /publish-app command
 */
export async function handlePublishApp(interaction) {
    const appFolder = interaction.options.getString('app');
    const userId = interaction.user.id;
    const username = interaction.user.username;

    // Validate app exists
    const appInfo = appFolders[appFolder];
    if (!appInfo) {
        await interaction.reply({
            content: `❌ Unknown app: \`${appFolder}\`. Available apps:\n${Object.keys(appFolders).map(f => `• \`${f}\``).join('\n')}`,
            ephemeral: true
        });
        return;
    }

    // Check if preflight has passed
    if (!isPreflightPassed(appFolder)) {
        await interaction.reply({
            content: `⚠️ **Preflight check required!**\n\nBefore publishing, you need to run:\n\`/preflight-check ${appFolder}\`\n\nThis ensures your app is ready for PWA deployment.`,
            ephemeral: true
        });
        return;
    }

    // Check if app folder exists
    // Bot runs from suite-hub/bot, apps are in stuart-hollinger-landing (2 levels up)
    const baseDir = path.resolve(process.cwd(), '..', '..');
    const appPath = path.join(baseDir, appFolder);

    try {
        await fs.access(appPath);
    } catch {
        await interaction.reply({
            content: `❌ App folder not found: \`${appPath}\``,
            ephemeral: true
        });
        return;
    }

    // Defer reply since this takes time
    await interaction.deferReply();

    try {
        // Step 1: Build PWA
        await interaction.editReply({
            content: `🔨 **Building PWA for ${appInfo.name}...**\nThis may take a minute.`
        });

        const buildResult = await buildPWA(appPath);
        if (!buildResult.success) {
            await interaction.editReply({
                content: `❌ **Build failed:**\n\`\`\`\n${buildResult.error}\n\`\`\``
            });
            return;
        }

        // Step 2: Create vercel.json config for public access
        const distPath = path.join(appPath, 'dist');
        const vercelConfig = {
            "public": true,
            "github": {
                "silent": true
            }
        };
        await fs.writeFile(path.join(distPath, 'vercel.json'), JSON.stringify(vercelConfig, null, 2));

        // Step 3: Deploy to Vercel
        await interaction.editReply({
            content: `📤 **Deploying ${appInfo.name} to Vercel...**`
        });

        const deployResult = await deployToVercel(appPath, appFolder);
        if (!deployResult.success) {
            await interaction.editReply({
                content: `❌ **Deployment failed:**\n\`\`\`\n${deployResult.error}\n\`\`\``
            });
            return;
        }

        // Step 4: Add to Supabase (pending approval)
        const appData = {
            name: appInfo.name,
            slug: appFolder,
            description: appInfo.description,
            category: appInfo.category,
            creator_name: username,
            creator_discord_id: userId,
            app_url: deployResult.url,
            status: 'pending'
        };

        const dbResult = await addToAppStore(appData);
        if (!dbResult.success) {
            await interaction.editReply({
                content: `❌ **Database error:**\n\`\`\`\n${dbResult.error}\n\`\`\``
            });
            return;
        }

        // Store pending publish for approval
        const publishId = `publish_${Date.now()}`;
        pendingPublishes.set(publishId, {
            appData,
            requestedBy: userId,
            requestedAt: new Date()
        });

        // Step 4: Send approval request
        const embed = new EmbedBuilder()
            .setTitle('📱 New App Publish Request')
            .setDescription(`**${appInfo.name}** is ready for review!`)
            .addFields(
                { name: 'App', value: appInfo.name, inline: true },
                { name: 'Category', value: appInfo.category, inline: true },
                { name: 'Requested by', value: `<@${userId}>`, inline: true },
                { name: 'Deploy URL', value: deployResult.url },
                { name: 'Description', value: appInfo.description }
            )
            .setColor(0xff9500)
            .setTimestamp();

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`approve_publish_${publishId}`)
                    .setLabel('✅ Approve')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`reject_publish_${publishId}`)
                    .setLabel('❌ Reject')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setLabel('Preview App')
                    .setStyle(ButtonStyle.Link)
                    .setURL(deployResult.url)
            );

        // Send to owner for approval
        const owner = await interaction.client.users.fetch(config.ownerId);
        await owner.send({ embeds: [embed], components: [buttons] });

        // Confirm to user
        await interaction.editReply({
            content: `✅ **${appInfo.name}** has been built and deployed!\n\n🔗 Preview: ${deployResult.url}\n📋 Status: **Pending Approval**\n\nThe owner will review your app shortly.`
        });

    } catch (error) {
        console.error('Publish error:', error);
        await interaction.editReply({
            content: `❌ **Error:** ${error.message}`
        });
    }
}

/**
 * Handle publish approval/rejection button clicks
 */
export async function handlePublishButton(interaction) {
    const customId = interaction.customId;

    if (customId.startsWith('approve_publish_')) {
        const publishId = customId.replace('approve_publish_', '');
        const pending = pendingPublishes.get(publishId);

        if (!pending) {
            await interaction.reply({ content: '❌ Publish request not found or already processed.', ephemeral: true });
            return;
        }

        // Update database status to approved
        const updateResult = await updateAppStatus(pending.appData.slug, 'approved');
        if (updateResult.success) {
            // Also update Cadence's suite_apps table for marketing content generation
            await updateCadenceSuiteApps(pending.appData.slug, 'published', pending.appData);

            pendingPublishes.delete(publishId);

            await interaction.update({
                content: `✅ **${pending.appData.name}** has been approved and is now live on the app store!`,
                embeds: [],
                components: []
            });

            // Notify the requester
            try {
                const requester = await interaction.client.users.fetch(pending.requestedBy);
                await requester.send(`🎉 Great news! **${pending.appData.name}** has been approved and is now live on the SUITE App Store!\n\n🔗 ${pending.appData.app_url}`);
            } catch (e) {
                console.error('Could not notify requester:', e);
            }
        } else {
            await interaction.reply({ content: `❌ Failed to update database: ${updateResult.error}`, ephemeral: true });
        }

    } else if (customId.startsWith('reject_publish_')) {
        const publishId = customId.replace('reject_publish_', '');
        const pending = pendingPublishes.get(publishId);

        if (!pending) {
            await interaction.reply({ content: '❌ Publish request not found or already processed.', ephemeral: true });
            return;
        }

        // Update database status to rejected
        await updateAppStatus(pending.appData.slug, 'rejected');
        pendingPublishes.delete(publishId);

        await interaction.update({
            content: `❌ **${pending.appData.name}** has been rejected.`,
            embeds: [],
            components: []
        });
    }
}

/**
 * Build PWA from Expo app
 */
async function buildPWA(appPath) {
    try {
        const distPath = path.join(appPath, 'dist');

        // Check if dist already exists (skip build for speed during testing)
        try {
            await fs.access(distPath);
            console.log('dist exists, skipping build');
            return { success: true, buildPath: distPath };
        } catch {
            // Need to build
        }

        // Run expo export for web (new command in Expo SDK 50+)
        const { stdout, stderr } = await execAsync('npx expo export --platform web', {
            cwd: appPath,
            timeout: 300000 // 5 minute timeout
        });

        console.log('Build output:', stdout);
        if (stderr) console.log('Build stderr:', stderr);

        return { success: true, buildPath: distPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Deploy to Vercel - copies dist to main site folder and pushes
 * Apps are served at getsuite.app/slug/ (not separate subdomains)
 */
async function deployToVercel(appPath, appSlug) {
    try {
        const distPath = path.join(appPath, 'dist');

        // Bot runs from suite-hub/bot, main site is 2 levels up
        const baseDir = path.resolve(process.cwd(), '..', '..');
        const targetPath = path.join(baseDir, appSlug);

        // Copy dist to main site folder
        await fs.rm(targetPath, { recursive: true, force: true });
        await fs.cp(distPath, targetPath, { recursive: true });

        // Git add, commit, and push to deploy via Vercel
        await execAsync(`git add ${appSlug}/`, { cwd: baseDir });
        await execAsync(`git commit -m "Deploy ${appSlug} to main site"`, { cwd: baseDir });
        await execAsync('git push', { cwd: baseDir, timeout: 60000 });

        console.log(`Deployed ${appSlug} to main site`);

        // URL is now path-based on main domain
        const url = `https://www.getsuite.app/${appSlug}/`;

        return { success: true, url };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Add app to Supabase app store
 */
async function addToAppStore(appData) {
    if (!SUPABASE_SERVICE_KEY) {
        return { success: false, error: 'SUPABASE_SERVICE_KEY not configured' };
    }

    try {
        // First check if app already exists
        const checkResponse = await fetch(`${SUPABASE_URL}/rest/v1/apps?slug=eq.${appData.slug}&select=id`, {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
        });

        const existing = await checkResponse.json();

        if (existing && existing.length > 0) {
            // App exists, update it
            const response = await fetch(`${SUPABASE_URL}/rest/v1/apps?slug=eq.${appData.slug}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                },
                body: JSON.stringify({
                    ...appData,
                    updated_at: new Date().toISOString()
                })
            });

            if (!response.ok) {
                const error = await response.text();
                return { success: false, error };
            }
        } else {
            // App doesn't exist, insert it
            const response = await fetch(`${SUPABASE_URL}/rest/v1/apps`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                },
                body: JSON.stringify(appData)
            });

            if (!response.ok) {
                const error = await response.text();
                return { success: false, error };
            }
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Update app status in Supabase
 */
async function updateAppStatus(slug, status) {
    if (!SUPABASE_SERVICE_KEY) {
        return { success: false, error: 'SUPABASE_SERVICE_KEY not configured' };
    }

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/apps?slug=eq.${slug}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            },
            body: JSON.stringify({
                status,
                approved_at: status === 'approved' ? new Date().toISOString() : null
            })
        });

        if (!response.ok) {
            const error = await response.text();
            return { success: false, error };
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Update Cadence's suite_apps table for marketing content generation
 * This keeps Cadence in sync with published apps
 */
async function updateCadenceSuiteApps(slug, status, appData) {
    if (!CADENCE_SUPABASE_KEY) {
        console.log('CADENCE_SUPABASE_KEY not configured, skipping Cadence update');
        return { success: false, error: 'CADENCE_SUPABASE_KEY not configured' };
    }

    try {
        // Get app folder info for features
        const appInfo = appFolders[slug];
        const features = appInfo ? [appInfo.description] : [];

        const response = await fetch(`${CADENCE_SUPABASE_URL}/rest/v1/suite_apps?slug=eq.${slug}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': CADENCE_SUPABASE_KEY,
                'Authorization': `Bearer ${CADENCE_SUPABASE_KEY}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                status: status,
                name: appData?.name || appInfo?.name || slug,
                tagline: appInfo?.description || appData?.description,
                download_url: appData?.app_url,
                published_at: status === 'published' ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Cadence update failed:', error);
            return { success: false, error };
        }

        console.log(`✅ Updated Cadence suite_apps: ${slug} -> ${status}`);
        return { success: true };
    } catch (error) {
        console.error('Cadence update error:', error);
        return { success: false, error: error.message };
    }
}

export { pendingPublishes };
