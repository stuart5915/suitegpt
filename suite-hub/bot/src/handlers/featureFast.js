import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';
import { EmbedBuilder } from 'discord.js';
import { getRepoFiles, listRepoFiles, commitChangesToRepo, writeCompletionFile } from './github.js';

// Use Gemini 1.5 Pro for higher quality code generation (free tier: 50 req/day)
const genAI = new GoogleGenerativeAI(config.geminiApiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

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

// Key files to fetch for context
const CONTEXT_FILES = [
    'App.js', 'app/_layout.tsx', 'app/index.tsx',
    'src/App.js', 'src/screens/HomeScreen.js',
    'package.json', 'app.config.js'
];

/**
 * Parse AI response to extract file changes
 * @param {string} response - AI response containing code blocks
 * @returns {Object} Map of filename -> content
 */
function parseCodeChanges(response) {
    const changes = {};

    // Match patterns like: 📄 **[filename.js]** (CREATE/MODIFY)
    // or: **filename.js** (MODIFY)
    const filePattern = /(?:📄\s*)?\*\*\[?([^\]\*]+)\]?\*\*\s*\((?:CREATE|MODIFY)\)/gi;
    const codePattern = /```(?:javascript|typescript|jsx|tsx|json)?\s*([\s\S]*?)```/g;

    let fileMatches = [...response.matchAll(filePattern)];
    let codeMatches = [...response.matchAll(codePattern)];

    // Pair files with their code blocks
    for (let i = 0; i < Math.min(fileMatches.length, codeMatches.length); i++) {
        const filename = fileMatches[i][1].trim();
        const code = codeMatches[i][1].trim();
        if (filename && code) {
            changes[filename] = code;
        }
    }

    return changes;
}

/**
 * Handle /feature-fast command - Instant AI feature implementation with GitHub commit
 */
export async function handleFeatureFast(interaction) {
    const app = interaction.options.getString('app');
    const description = interaction.options.getString('description');
    const appName = appNames[app] || app;

    await interaction.deferReply();

    try {
        // Check if GitHub is configured
        if (!config.githubToken) {
            await interaction.editReply({
                content: `⚠️ **GitHub not configured** - Running in preview mode (no auto-commit).\n\nTo enable auto-commit, add \`GITHUB_TOKEN\` to Railway env vars.`,
            });
            // Fall back to preview mode (just show code)
            return handleFeatureFastPreview(interaction, app, description, appName);
        }

        // Step 1: Fetch relevant files from GitHub for context
        await interaction.editReply({ content: `⏳ Fetching ${appName} codebase...` });

        let contextCode = '';
        try {
            const files = await getRepoFiles(app, CONTEXT_FILES);
            for (const [path, data] of Object.entries(files)) {
                contextCode += `\n\n--- ${path} ---\n${data.content.slice(0, 2000)}`; // Limit per file
            }
        } catch (err) {
            console.log(`Could not fetch context files: ${err.message}`);
        }

        // Step 2: Generate code with Gemini 1.5 Pro
        await interaction.editReply({ content: `⏳ ${appName}: Generating feature code...` });

        const prompt = `You are an expert React Native/Expo developer for the SUITE app ecosystem.

**Task:** Implement this feature for the ${appName} app:
"${description}"

**Current App Code (for context):**
${contextCode || '(No existing files found - create from scratch)'}

**App Context:**
- ${appName} is a React Native Expo app
- Uses Supabase for backend
- Uses Google Gemini AI for smart features
- Follows modern React patterns with hooks

**CRITICAL: Response Format**
For EACH file you modify or create, use this EXACT format:

📄 **[path/to/filename.js]** (MODIFY)
\`\`\`javascript
// COMPLETE file content here - not just a snippet!
\`\`\`

Use full paths from the repo root (e.g., app/screens/HomeScreen.tsx or src/components/Button.js).
Provide complete, working code that can be directly committed.`;

        const result = await model.generateContent(prompt);
        const response = result.response.text();

        // Step 3: Parse the code changes
        const codeChanges = parseCodeChanges(response);

        if (Object.keys(codeChanges).length === 0) {
            // No parseable changes - show response in Discord instead
            return handleFeatureFastPreview(interaction, app, description, appName, response);
        }

        // Step 4: Commit changes to GitHub
        await interaction.editReply({ content: `⏳ ${appName}: Committing ${Object.keys(codeChanges).length} file(s) to GitHub...` });

        // Get existing file SHAs for updates
        const existingFiles = await getRepoFiles(app, Object.keys(codeChanges));
        const filesToCommit = {};

        for (const [path, content] of Object.entries(codeChanges)) {
            filesToCommit[path] = {
                content,
                sha: existingFiles[path]?.sha // Include SHA if file exists
            };
        }

        const commitResult = await commitChangesToRepo(
            app,
            filesToCommit,
            `⚡ feature-fast: ${description.slice(0, 50)}`
        );

        // Step 5: Write completion file for notification
        await writeCompletionFile('feature_added', {
            appName,
            appSlug: app,
            description: description.slice(0, 200),
            developerId: interaction.user.id,
            files: Object.keys(codeChanges),
            commitUrl: commitResult.repoUrl
        });

        // Step 6: Send success embed
        const embed = new EmbedBuilder()
            .setTitle(`⚡ Feature Added: ${appName}`)
            .setDescription(`**${description.slice(0, 100)}${description.length > 100 ? '...' : ''}**`)
            .setColor('#22C55E')
            .addFields(
                { name: '📝 Files Changed', value: Object.keys(codeChanges).join('\n').slice(0, 1000) || 'N/A', inline: false },
                { name: '🔗 View Changes', value: `[GitHub](${commitResult.repoUrl})`, inline: true },
                { name: '📱 Status', value: '✅ Committed & Deploying', inline: true }
            )
            .setFooter({ text: '⚡ Fast mode - Changes are live! Check your app in ~1 min.' })
            .setTimestamp();

        await interaction.editReply({ content: null, embeds: [embed] });

        // DM the user
        try {
            await interaction.user.send({
                content: `✅ **Feature added to ${appName}!**\n\n"${description}"\n\n🔗 ${commitResult.repoUrl}\n\nYour app is deploying now - check it in ~1 minute!`
            });
        } catch (err) {
            console.log('Could not DM user:', err.message);
        }

        console.log(`[FeatureFast] ✅ ${interaction.user.username} added feature to ${appName}`);

    } catch (error) {
        console.error('Feature Fast error:', error);
        await interaction.editReply({
            content: `❌ Error: ${error.message}\n\nTry again or use \`/feature\` for the slower but more reliable IDE queue.`,
            embeds: []
        });
    }
}

/**
 * Preview mode - just show code without committing (when no GitHub token)
 */
async function handleFeatureFastPreview(interaction, app, description, appName, response = null) {
    if (!response) {
        // Generate code if not provided
        const prompt = `You are an expert React Native/Expo developer. Implement this feature for ${appName}:\n"${description}"\n\nProvide complete code.`;
        const result = await model.generateContent(prompt);
        response = result.response.text();
    }

    const embed = new EmbedBuilder()
        .setTitle(`⚡ Feature Preview: ${appName}`)
        .setDescription(`**Request:** ${description.slice(0, 200)}`)
        .setColor('#FFA500')
        .addFields(
            { name: '⚠️ Mode', value: 'Preview Only (no GitHub token)', inline: true },
            { name: '📱 App', value: appName, inline: true }
        )
        .setFooter({ text: 'Add GITHUB_TOKEN to Railway for auto-commit' })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Post code in thread
    const reply = await interaction.fetchReply();
    const thread = await reply.startThread({
        name: `Feature: ${description.slice(0, 50)}`,
        autoArchiveDuration: 1440
    });

    const chunks = response.match(/[\s\S]{1,1900}/g) || [response];
    for (const chunk of chunks) {
        await thread.send(chunk);
    }
    await thread.send(`\n✅ **Preview complete!**\n\nTo apply: Copy code above and commit to ${appName} repo manually.`);
}

/**
 * Handle /bug-fast command - Instant AI bug fix with GitHub commit
 */
export async function handleBugFast(interaction) {
    const app = interaction.options.getString('app');
    const bugDescription = interaction.options.getString('bug_description');
    const appName = appNames[app] || app;

    await interaction.deferReply();

    try {
        // Check if GitHub is configured
        if (!config.githubToken) {
            await interaction.editReply({
                content: `⚠️ **GitHub not configured** - Running in preview mode.\n\nAdd \`GITHUB_TOKEN\` to Railway env vars for auto-commit.`,
            });
            return handleBugFastPreview(interaction, app, bugDescription, appName);
        }

        // Step 1: Fetch relevant files for context
        await interaction.editReply({ content: `⏳ Fetching ${appName} codebase...` });

        let contextCode = '';
        try {
            const files = await getRepoFiles(app, CONTEXT_FILES);
            for (const [path, data] of Object.entries(files)) {
                contextCode += `\n\n--- ${path} ---\n${data.content.slice(0, 2000)}`;
            }
        } catch (err) {
            console.log(`Could not fetch context: ${err.message}`);
        }

        // Step 2: Generate fix with Gemini
        await interaction.editReply({ content: `⏳ ${appName}: Analyzing bug and generating fix...` });

        const prompt = `You are an expert React Native/Expo developer debugging the ${appName} app.

**Bug Report:**
"${bugDescription}"

**Current App Code (for context):**
${contextCode || '(No existing files found)'}

**CRITICAL: Response Format**
For EACH file you fix, use this EXACT format:

📄 **[path/to/filename.js]** (MODIFY)
\`\`\`javascript
// COMPLETE fixed file content here
\`\`\`

Then provide a brief summary of the fix.`;

        const result = await model.generateContent(prompt);
        const response = result.response.text();

        // Step 3: Parse code changes
        const codeChanges = parseCodeChanges(response);

        if (Object.keys(codeChanges).length === 0) {
            return handleBugFastPreview(interaction, app, bugDescription, appName, response);
        }

        // Step 4: Commit to GitHub
        await interaction.editReply({ content: `⏳ ${appName}: Committing fix...` });

        const existingFiles = await getRepoFiles(app, Object.keys(codeChanges));
        const filesToCommit = {};

        for (const [path, content] of Object.entries(codeChanges)) {
            filesToCommit[path] = {
                content,
                sha: existingFiles[path]?.sha
            };
        }

        const commitResult = await commitChangesToRepo(
            app,
            filesToCommit,
            `🔧 bug-fast: ${bugDescription.slice(0, 50)}`
        );

        // Step 5: Write completion file
        await writeCompletionFile('bug_fixed', {
            appName,
            appSlug: app,
            description: bugDescription.slice(0, 200),
            developerId: interaction.user.id,
            files: Object.keys(codeChanges),
            commitUrl: commitResult.repoUrl
        });

        // Step 6: Success embed
        const embed = new EmbedBuilder()
            .setTitle(`🔧 Bug Fixed: ${appName}`)
            .setDescription(`**${bugDescription.slice(0, 100)}${bugDescription.length > 100 ? '...' : ''}**`)
            .setColor('#22C55E')
            .addFields(
                { name: '📝 Files Fixed', value: Object.keys(codeChanges).join('\n').slice(0, 1000) || 'N/A', inline: false },
                { name: '🔗 View Fix', value: `[GitHub](${commitResult.repoUrl})`, inline: true },
                { name: '📱 Status', value: '✅ Fixed & Deploying', inline: true }
            )
            .setFooter({ text: '⚡ Fast mode - Fix is live! Check your app in ~1 min.' })
            .setTimestamp();

        await interaction.editReply({ content: null, embeds: [embed] });

        // DM user
        try {
            await interaction.user.send({
                content: `🔧 **Bug fixed in ${appName}!**\n\n"${bugDescription}"\n\n🔗 ${commitResult.repoUrl}\n\nFix is deploying now - check it in ~1 minute!`
            });
        } catch (err) {
            console.log('Could not DM user:', err.message);
        }

        console.log(`[BugFast] ✅ ${interaction.user.username} fixed bug in ${appName}`);

    } catch (error) {
        console.error('Bug Fast error:', error);
        await interaction.editReply({
            content: `❌ Error: ${error.message}\n\nTry again or use \`/bug\` for the IDE queue.`,
            embeds: []
        });
    }
}

/**
 * Preview mode for bug-fast
 */
async function handleBugFastPreview(interaction, app, bugDescription, appName, response = null) {
    if (!response) {
        const prompt = `Fix this bug in ${appName}: "${bugDescription}"`;
        const result = await model.generateContent(prompt);
        response = result.response.text();
    }

    const embed = new EmbedBuilder()
        .setTitle(`🔧 Bug Fix Preview: ${appName}`)
        .setDescription(`**Bug:** ${bugDescription.slice(0, 200)}`)
        .setColor('#FFA500')
        .addFields(
            { name: '⚠️ Mode', value: 'Preview Only', inline: true },
            { name: '📱 App', value: appName, inline: true }
        )
        .setFooter({ text: 'Add GITHUB_TOKEN for auto-commit' })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    const reply = await interaction.fetchReply();
    const thread = await reply.startThread({
        name: `Bug Fix: ${bugDescription.slice(0, 50)}`,
        autoArchiveDuration: 1440
    });

    const chunks = response.match(/[\s\S]{1,1900}/g) || [response];
    for (const chunk of chunks) {
        await thread.send(chunk);
    }
    await thread.send(`\n🔧 **Fix ready!**\n\nApply manually to ${appName} repo.`);
}
