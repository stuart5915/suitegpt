import { config } from '../config.js';
import { EmbedBuilder } from 'discord.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

// Store preflight completion status (app slug -> timestamp)
const preflightPassed = new Map();

// How long preflight stays valid (1 hour)
const PREFLIGHT_VALIDITY_MS = 60 * 60 * 1000;

// App folder mappings (same as publishApp.js)
const appFolders = {
    'cheshbon-reflections': { name: 'Cheshbon Reflections', category: 'lifestyle' },
    'food-vitals-expo': { name: 'FoodVitals', category: 'health' },
    'opticrep-ai-workout-trainer': { name: 'OpticRep', category: 'fitness' },
    'life-hub-app': { name: 'Life Hub AI', category: 'ai' },
    'remcast': { name: 'REMcast', category: 'lifestyle' },
    'defi-knowledge': { name: 'DeFi Knowledge', category: 'finance' },
};

/**
 * Check if preflight has passed for an app
 */
export function isPreflightPassed(appSlug) {
    const passedAt = preflightPassed.get(appSlug);
    if (!passedAt) return false;

    const elapsed = Date.now() - passedAt;
    return elapsed < PREFLIGHT_VALIDITY_MS;
}

/**
 * Handle /preflight-check command
 */
export async function handlePreflightCheck(interaction) {
    const appFolder = interaction.options.getString('app');

    // Validate app exists
    const appInfo = appFolders[appFolder];
    if (!appInfo) {
        await interaction.reply({
            content: `❌ Unknown app: \`${appFolder}\`. Available apps:\n${Object.keys(appFolders).map(f => `• \`${f}\``).join('\n')}`,
            ephemeral: true
        });
        return;
    }

    // Check if app folder exists
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

    await interaction.deferReply();

    const checks = [];
    let allPassed = true;

    // Check 1: Supabase fallbacks
    await interaction.editReply({ content: `🔍 **Checking ${appInfo.name}...**\n\n⏳ Checking Supabase configuration...` });
    const supabaseCheck = await checkSupabaseFallbacks(appPath);
    checks.push(supabaseCheck);
    if (!supabaseCheck.passed) allPassed = false;

    // Check 2: OAuth redirect
    await interaction.editReply({ content: `🔍 **Checking ${appInfo.name}...**\n\n${formatChecks(checks)}\n⏳ Checking OAuth redirect...` });
    const oauthCheck = await checkOAuthRedirect(appPath);
    checks.push(oauthCheck);
    if (!oauthCheck.passed) allPassed = false;

    // Check 3: Web config in app.config
    await interaction.editReply({ content: `🔍 **Checking ${appInfo.name}...**\n\n${formatChecks(checks)}\n⏳ Checking web configuration...` });
    const webConfigCheck = await checkWebConfig(appPath);
    checks.push(webConfigCheck);
    if (!webConfigCheck.passed) allPassed = false;

    // Check 4: Test build
    await interaction.editReply({ content: `🔍 **Checking ${appInfo.name}...**\n\n${formatChecks(checks)}\n⏳ Testing web build (this may take a minute)...` });
    const buildCheck = await checkBuildWorks(appPath);
    checks.push(buildCheck);
    if (!buildCheck.passed) allPassed = false;

    // Final result
    if (allPassed) {
        preflightPassed.set(appFolder, Date.now());

        const embed = new EmbedBuilder()
            .setTitle('✅ Preflight Check Passed!')
            .setDescription(`**${appInfo.name}** is ready to publish.`)
            .addFields(
                { name: 'Status', value: formatChecks(checks) },
                { name: 'Next Step', value: 'Run `/publish-app` within the next hour to deploy.' }
            )
            .setColor(0x00ff00)
            .setTimestamp();

        await interaction.editReply({ content: null, embeds: [embed] });
    } else {
        const embed = new EmbedBuilder()
            .setTitle('❌ Preflight Check Failed')
            .setDescription(`**${appInfo.name}** needs fixes before publishing.`)
            .addFields(
                { name: 'Results', value: formatChecks(checks) },
                { name: 'How to Fix', value: getFixInstructions(checks) }
            )
            .setColor(0xff0000)
            .setTimestamp();

        await interaction.editReply({ content: null, embeds: [embed] });
    }
}

/**
 * Check for hardcoded Supabase URL fallbacks
 */
async function checkSupabaseFallbacks(appPath) {
    try {
        const supabasePath = path.join(appPath, 'services', 'supabase.ts');
        const content = await fs.readFile(supabasePath, 'utf-8');

        // Check for hardcoded fallback pattern
        const hasFallbackUrl = content.includes('FALLBACK_SUPABASE_URL') ||
            content.includes("|| 'https://") ||
            content.includes('|| "https://');

        if (hasFallbackUrl) {
            return { name: 'Supabase Fallbacks', passed: true, message: 'Hardcoded fallbacks found' };
        } else {
            return { name: 'Supabase Fallbacks', passed: false, message: 'Missing hardcoded URL fallbacks for web builds' };
        }
    } catch (error) {
        // No supabase file = app doesn't use Supabase
        return { name: 'Supabase Fallbacks', passed: true, message: 'No Supabase detected (skipped)' };
    }
}

/**
 * Check OAuth redirect uses window.location.origin
 */
async function checkOAuthRedirect(appPath) {
    try {
        const authPath = path.join(appPath, 'contexts', 'AuthContext.tsx');
        const content = await fs.readFile(authPath, 'utf-8');

        // Check for proper web redirect pattern
        const usesWindowLocation = content.includes('window.location.origin');
        const usesMakeRedirectUri = content.includes('makeRedirectUri') && !content.includes('window.location.origin');

        if (usesWindowLocation) {
            return { name: 'OAuth Redirect', passed: true, message: 'Uses window.location.origin for web' };
        } else if (usesMakeRedirectUri) {
            return { name: 'OAuth Redirect', passed: false, message: 'Uses makeRedirectUri which returns localhost on production' };
        } else {
            return { name: 'OAuth Redirect', passed: true, message: 'No OAuth detected (skipped)' };
        }
    } catch (error) {
        // No auth context = app doesn't use OAuth
        return { name: 'OAuth Redirect', passed: true, message: 'No OAuth detected (skipped)' };
    }
}

/**
 * Check web config exists in app.config.js
 */
async function checkWebConfig(appPath) {
    try {
        // Try app.config.js first, then app.json
        let configPath = path.join(appPath, 'app.config.js');
        let content;

        try {
            content = await fs.readFile(configPath, 'utf-8');
        } catch {
            configPath = path.join(appPath, 'app.json');
            content = await fs.readFile(configPath, 'utf-8');
        }

        const hasWebConfig = content.includes('"web"') || content.includes('web:');

        if (hasWebConfig) {
            return { name: 'Web Config', passed: true, message: 'Web configuration found in app config' };
        } else {
            return { name: 'Web Config', passed: false, message: 'Missing web configuration in app.config.js' };
        }
    } catch (error) {
        return { name: 'Web Config', passed: false, message: 'Could not read app config file' };
    }
}

/**
 * Test that the web build works
 */
async function checkBuildWorks(appPath) {
    try {
        // Clean dist first
        const distPath = path.join(appPath, 'dist');
        try {
            await fs.rm(distPath, { recursive: true, force: true });
        } catch (e) { }

        // Run build
        const { stdout, stderr } = await execAsync('npx expo export --platform web', {
            cwd: appPath,
            timeout: 300000 // 5 minute timeout
        });

        // Check if dist was created
        await fs.access(distPath);

        return { name: 'Web Build', passed: true, message: 'Build completed successfully' };
    } catch (error) {
        const errorMsg = error.message.substring(0, 100);
        return { name: 'Web Build', passed: false, message: `Build failed: ${errorMsg}` };
    }
}

/**
 * Format check results
 */
function formatChecks(checks) {
    return checks.map(c => {
        const icon = c.passed ? '✅' : '❌';
        return `${icon} **${c.name}**: ${c.message}`;
    }).join('\n');
}

/**
 * Get fix instructions for failed checks
 */
function getFixInstructions(checks) {
    const failed = checks.filter(c => !c.passed);
    const instructions = [];

    for (const check of failed) {
        if (check.name === 'Supabase Fallbacks') {
            instructions.push('• Add hardcoded Supabase URL/key fallbacks in `services/supabase.ts`');
        } else if (check.name === 'OAuth Redirect') {
            instructions.push('• Change OAuth redirect to use `window.location.origin` for web in `contexts/AuthContext.tsx`');
        } else if (check.name === 'Web Config') {
            instructions.push('• Add `web` configuration section to `app.config.js`');
        } else if (check.name === 'Web Build') {
            instructions.push('• Fix build errors shown above');
        }
    }

    instructions.push('\nSee `/pwa-publish-checklist` for detailed instructions.');
    return instructions.join('\n');
}

export { preflightPassed };
