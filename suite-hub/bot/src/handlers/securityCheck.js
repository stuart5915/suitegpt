/**
 * Security Check Handler
 * Scans app codebase for exposed secrets before publishing
 */

import fs from 'fs/promises';
import path from 'path';
import { EmbedBuilder } from 'discord.js';

// Patterns to search for (regex patterns)
const SECRET_PATTERNS = [
    { name: 'Google/Gemini API Key', pattern: /AIzaSy[A-Za-z0-9_-]{33}/g, severity: 'critical' },
    { name: 'Stripe Live Key', pattern: /sk_live_[A-Za-z0-9]{24,}/g, severity: 'critical' },
    { name: 'Stripe Test Key', pattern: /sk_test_[A-Za-z0-9]{24,}/g, severity: 'warning' },
    { name: 'AWS Access Key', pattern: /AKIA[A-Z0-9]{16}/g, severity: 'critical' },
    { name: 'GitHub Token', pattern: /ghp_[A-Za-z0-9]{36}/g, severity: 'critical' },
    { name: 'Discord Bot Token', pattern: /[MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27}/g, severity: 'critical' },
    { name: 'Private Key', pattern: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/g, severity: 'critical' },
    { name: 'OpenAI API Key', pattern: /sk-[A-Za-z0-9]{48}/g, severity: 'critical' },
];

// Files/directories to skip
const SKIP_DIRS = ['node_modules', '.git', '.expo', 'dist', 'build', '.next'];
const SKIP_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.webp'];

// App folder mappings
const APP_FOLDERS = {
    'cheshbon-reflections': 'cheshbon-reflections-temp',
    'food-vitals-expo': 'foodvitals-full',
    'opticrep-ai-workout-trainer': 'opticrep-ai-workout-trainer-temp',
    'life-hub-app': 'life-hub-app',
    'remcast': 'remcast-temp',
    'defi-knowledge': 'defi-knowledge-temp',
    'trueform-ai-physiotherapist': 'trueform-full',
};

// Supabase anon key pattern (allowed - these are meant to be public)
const SUPABASE_ANON_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

/**
 * Recursively scan a directory for secrets
 */
async function scanDirectory(dirPath, results = []) {
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            // Skip excluded directories
            if (entry.isDirectory()) {
                if (SKIP_DIRS.includes(entry.name)) continue;
                await scanDirectory(fullPath, results);
            } else {
                // Skip binary files
                const ext = path.extname(entry.name).toLowerCase();
                if (SKIP_EXTENSIONS.includes(ext)) continue;

                // Scan the file
                try {
                    const content = await fs.readFile(fullPath, 'utf-8');

                    for (const { name, pattern, severity } of SECRET_PATTERNS) {
                        const matches = content.match(pattern);
                        if (matches) {
                            for (const match of matches) {
                                // Get relative path
                                const relativePath = fullPath.split('stuart-hollinger-landing').pop().replace(/\\/g, '/');
                                results.push({
                                    type: name,
                                    severity,
                                    file: relativePath,
                                    preview: match.slice(0, 10) + '...' + match.slice(-4),
                                });
                            }
                        }
                    }
                } catch (readErr) {
                    // Skip files that can't be read as text
                }
            }
        }
    } catch (err) {
        console.error(`Error scanning ${dirPath}:`, err);
    }

    return results;
}

/**
 * Handle /security-check command
 */
export async function handleSecurityCheck(interaction) {
    const appSlug = interaction.options.getString('app');
    const folderName = APP_FOLDERS[appSlug];

    if (!folderName) {
        await interaction.reply({
            content: `❌ Unknown app: ${appSlug}`,
            ephemeral: true
        });
        return;
    }

    // Acknowledge the command (scanning takes time)
    await interaction.deferReply();

    // Get the app folder path
    const basePath = process.env.APPS_BASE_PATH || 'C:\\Users\\info\\Documents\\stuart-hollinger-landing\\stuart-hollinger-landing';
    const appPath = path.join(basePath, folderName);

    try {
        // Check if folder exists
        await fs.access(appPath);

        // Scan for secrets
        console.log(`🔍 Scanning ${appPath} for secrets...`);
        const findings = await scanDirectory(appPath);

        // Build response
        const critical = findings.filter(f => f.severity === 'critical');
        const warnings = findings.filter(f => f.severity === 'warning');

        const embed = new EmbedBuilder()
            .setTitle(`🔒 Security Scan: ${appSlug}`)
            .setTimestamp();

        if (critical.length === 0 && warnings.length === 0) {
            // PASS
            embed.setColor(0x22c55e)
                .setDescription('✅ **PASS** - No exposed secrets found!')
                .addFields(
                    { name: 'Scanned', value: folderName, inline: true },
                    { name: 'Critical Issues', value: '0', inline: true },
                    { name: 'Warnings', value: '0', inline: true }
                );
        } else if (critical.length > 0) {
            // FAIL - Critical issues
            embed.setColor(0xef4444)
                .setDescription('❌ **FAIL** - Critical secrets exposed!')
                .addFields(
                    { name: '🚨 Critical Issues', value: critical.length.toString(), inline: true },
                    { name: '⚠️ Warnings', value: warnings.length.toString(), inline: true }
                );

            // Add details for critical findings
            const criticalDetails = critical.slice(0, 5).map(f =>
                `• **${f.type}** in \`${f.file}\`\n  Preview: \`${f.preview}\``
            ).join('\n\n');
            embed.addFields({ name: 'Critical Findings', value: criticalDetails || 'None' });

            embed.addFields({
                name: '🔧 How to Fix',
                value: '1. Move secrets to `.env` file\n2. Use `process.env.VAR_NAME` in code\n3. Ensure `.env` is in `.gitignore`'
            });
        } else {
            // WARN - Only warnings
            embed.setColor(0xf59e0b)
                .setDescription('⚠️ **PASS (with warnings)** - No critical issues, but review recommended')
                .addFields(
                    { name: '🚨 Critical Issues', value: '0', inline: true },
                    { name: '⚠️ Warnings', value: warnings.length.toString(), inline: true }
                );

            const warningDetails = warnings.slice(0, 3).map(f =>
                `• **${f.type}** in \`${f.file}\``
            ).join('\n');
            embed.addFields({ name: 'Warnings', value: warningDetails || 'None' });
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (err) {
        console.error('Security check error:', err);
        await interaction.editReply({
            content: `❌ Error scanning app: ${err.message}`
        });
    }
}
