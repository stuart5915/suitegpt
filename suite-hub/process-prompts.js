#!/usr/bin/env node
/**
 * SUITE App Builder - Automated Prompt Processor
 * 
 * This script processes prompts from Discord and:
 * 1. Creates Expo apps in the workspace
 * 2. Pushes to GitHub
 * 3. Publishes to Expo
 * 4. Creates completion file for Discord bot to post link
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.join(__dirname, 'prompts');
const WORKSPACE_DIR = path.resolve(__dirname, '..');
const COMPLETIONS_DIR = path.join(__dirname, 'completions');

// Ensure completions directory exists
if (!fs.existsSync(COMPLETIONS_DIR)) {
    fs.mkdirSync(COMPLETIONS_DIR, { recursive: true });
}

/**
 * Process a CreateApp prompt
 */
async function processCreateAppPrompt(promptPath) {
    const content = fs.readFileSync(promptPath, 'utf-8');

    // Parse the prompt
    const appNameMatch = content.match(/App Name:\s*(.+)/i);
    const descriptionMatch = content.match(/Description:\s*(.+)/i);
    const developerIdMatch = content.match(/Developer ID:\s*(.+)/i);

    if (!appNameMatch) {
        console.error('Could not parse app name from prompt');
        return;
    }

    const appName = appNameMatch[1].trim();
    const description = descriptionMatch?.[1]?.trim() || '';
    const developerId = developerIdMatch?.[1]?.trim() || '';
    const slug = appName.toLowerCase().replace(/\s+/g, '-');
    const appDir = path.join(WORKSPACE_DIR, 'community-apps', slug);

    console.log(`\n🚀 Creating app: ${appName}`);
    console.log(`   Slug: ${slug}`);
    console.log(`   Developer: ${developerId}`);

    try {
        // Step 1: Create Expo app
        console.log('\n📦 Step 1: Creating Expo app...');
        fs.mkdirSync(path.join(WORKSPACE_DIR, 'community-apps'), { recursive: true });
        execSync(`npx -y create-expo-app@latest ${slug} --template blank-typescript`, {
            cwd: path.join(WORKSPACE_DIR, 'community-apps'),
            stdio: 'inherit'
        });

        // Step 2: Update app.json with proper config
        console.log('\n⚙️ Step 2: Configuring app...');
        const appJsonPath = path.join(appDir, 'app.json');
        const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
        appJson.expo.name = appName;
        appJson.expo.slug = slug;
        appJson.expo.owner = 'stuart5915';
        appJson.expo.extra = {
            developerId,
            eas: { projectId: slug }
        };
        fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));

        // Step 3: Push to GitHub
        console.log('\n🐙 Step 3: Pushing to GitHub...');
        execSync('git init', { cwd: appDir, stdio: 'inherit' });
        execSync('git add .', { cwd: appDir, stdio: 'inherit' });
        execSync(`git commit -m "Initial commit - ${appName}"`, { cwd: appDir, stdio: 'inherit' });
        execSync(`gh repo create stuart5915/${slug} --private --push --source .`, {
            cwd: appDir,
            stdio: 'inherit'
        });

        // Step 4: Create EAS config for OTA updates
        console.log('\n⚡ Step 4: Setting up Expo EAS...');
        const easConfig = {
            cli: { version: ">= 5.2.0", appVersionSource: "remote" },
            build: {
                development: { developmentClient: true, distribution: "internal", channel: "development" },
                preview: { distribution: "internal", channel: "preview" },
                production: { channel: "production", autoIncrement: true }
            },
            submit: { production: {} }
        };
        fs.writeFileSync(path.join(appDir, 'eas.json'), JSON.stringify(easConfig, null, 2));

        // Add EAS project ID to app.json
        const appJsonUpdated = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
        appJsonUpdated.expo.updates = {
            url: `https://u.expo.dev/@sgcnadesf/${slug}`
        };
        appJsonUpdated.expo.runtimeVersion = { policy: "appVersion" };
        fs.writeFileSync(appJsonPath, JSON.stringify(appJsonUpdated, null, 2));

        // Step 5: Publish to Expo
        console.log('\n📤 Step 5: Publishing to Expo...');
        let expoLink = `exp://u.expo.dev/update/${slug}`;
        try {
            execSync('npx eas update --branch production --message "Initial release"', {
                cwd: appDir,
                stdio: 'inherit'
            });
        } catch (e) {
            console.log('   EAS update skipped (need to run eas init first). Using Expo Go dev link.');
            expoLink = `exp://exp.host/@sgcnadesf/${slug}`;
        }

        // Step 5: Create completion file for Discord bot
        console.log('\n✅ Step 5: Creating completion file...');
        const completion = {
            type: 'app_created',
            appName,
            slug,
            developerId,
            githubUrl: `https://github.com/stuart5915/${slug}`,
            expoLink,
            timestamp: new Date().toISOString()
        };

        const completionPath = path.join(COMPLETIONS_DIR, `completed_${slug}_${Date.now()}.json`);
        fs.writeFileSync(completionPath, JSON.stringify(completion, null, 2));

        // Delete the original prompt
        fs.unlinkSync(promptPath);

        console.log(`\n🎉 SUCCESS! App created:`);
        console.log(`   GitHub: ${completion.githubUrl}`);
        console.log(`   Expo: ${completion.expoLink}`);
        console.log(`   Completion file: ${completionPath}`);

        return completion;

    } catch (error) {
        console.error('Error creating app:', error.message);
    }
}

/**
 * Process all pending prompts
 */
async function processAllPrompts() {
    const files = fs.readdirSync(PROMPTS_DIR);
    const prompts = files.filter(f => f.endsWith('.txt') && !f.startsWith('README'));

    if (prompts.length === 0) {
        console.log('No prompts to process.');
        return;
    }

    console.log(`Found ${prompts.length} prompt(s) to process:`);
    prompts.forEach(p => console.log(`  - ${p}`));

    for (const prompt of prompts) {
        const promptPath = path.join(PROMPTS_DIR, prompt);

        if (prompt.startsWith('CreateApp_') || prompt.startsWith('DevApp_')) {
            await processCreateAppPrompt(promptPath);
        } else if (prompt.startsWith('ArchiveApp_') || prompt.startsWith('DeleteApp_')) {
            console.log(`Skipping archive prompt: ${prompt}`);
            // TODO: Implement archive handling
        } else {
            console.log(`Unknown prompt type: ${prompt}`);
        }
    }
}

// Run
processAllPrompts();
