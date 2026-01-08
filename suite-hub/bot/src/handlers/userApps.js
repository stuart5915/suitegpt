import { EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '../../data/user-apps.json');

// Load user apps data
function loadUserApps() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        }
    } catch (error) {
        console.error('Error loading user apps:', error);
    }
    return {};
}

// Save user apps data
function saveUserApps(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error('Error saving user apps:', error);
    }
}

/**
 * Get all apps for a user
 */
export function getUserApps(userId) {
    const data = loadUserApps();
    return data[userId]?.apps || [];
}

/**
 * Add a new app for a user
 */
export function addUserApp(userId, appData) {
    const data = loadUserApps();
    
    if (!data[userId]) {
        data[userId] = { apps: [] };
    }
    
    // Check if app already exists
    const existing = data[userId].apps.find(a => a.name.toLowerCase() === appData.name.toLowerCase());
    if (existing) {
        return { success: false, error: 'App with this name already exists' };
    }
    
    data[userId].apps.push({
        name: appData.name,
        description: appData.description || '',
        status: 'pending', // pending → building → testing → live → archived
        createdAt: new Date().toISOString(),
        features: [],
        bugs: [],
        history: [{
            action: 'created',
            timestamp: new Date().toISOString()
        }]
    });
    
    saveUserApps(data);
    return { success: true };
}

/**
 * Update app status
 */
export function updateAppStatus(userId, appName, newStatus) {
    const data = loadUserApps();
    
    if (!data[userId]) {
        return { success: false, error: 'User not found' };
    }
    
    const app = data[userId].apps.find(a => a.name.toLowerCase() === appName.toLowerCase());
    if (!app) {
        return { success: false, error: 'App not found' };
    }
    
    const oldStatus = app.status;
    app.status = newStatus;
    app.history.push({
        action: `status_change`,
        from: oldStatus,
        to: newStatus,
        timestamp: new Date().toISOString()
    });
    
    saveUserApps(data);
    return { success: true, oldStatus, newStatus };
}

/**
 * Soft-delete (archive) a user's app
 */
export function deleteUserApp(userId, appName) {
    const data = loadUserApps();
    
    if (!data[userId]) {
        return { success: false, error: 'User not found' };
    }
    
    const app = data[userId].apps.find(a => a.name.toLowerCase() === appName.toLowerCase());
    if (!app) {
        return { success: false, error: 'App not found' };
    }
    
    app.status = 'archived';
    app.archivedAt = new Date().toISOString();
    app.history.push({
        action: 'archived',
        timestamp: new Date().toISOString()
    });
    
    saveUserApps(data);
    return { success: true };
}

/**
 * Add feature to app tracking
 */
export function addFeatureToApp(userId, appName, feature) {
    const data = loadUserApps();
    
    if (!data[userId]) return { success: false };
    
    const app = data[userId].apps.find(a => a.name.toLowerCase() === appName.toLowerCase());
    if (!app) return { success: false };
    
    app.features.push({
        description: feature,
        submittedAt: new Date().toISOString(),
        status: 'pending'
    });
    
    saveUserApps(data);
    return { success: true };
}

/**
 * Add bug to app tracking
 */
export function addBugToApp(userId, appName, bug, priority = 'medium') {
    const data = loadUserApps();
    
    if (!data[userId]) return { success: false };
    
    const app = data[userId].apps.find(a => a.name.toLowerCase() === appName.toLowerCase());
    if (!app) return { success: false };
    
    app.bugs.push({
        description: bug,
        priority,
        submittedAt: new Date().toISOString(),
        status: 'pending'
    });
    
    saveUserApps(data);
    return { success: true };
}

/**
 * Get app choices for a specific user (for autocomplete)
 */
export function getUserAppChoices(userId) {
    const apps = getUserApps(userId);
    return apps
        .filter(app => app.status !== 'archived')
        .map(app => ({
            name: `${getStatusEmoji(app.status)} ${app.name}`,
            value: app.name
        }));
}

function getStatusEmoji(status) {
    const emojis = {
        pending: '⏳',
        building: '🔨',
        testing: '🧪',
        live: '🟢',
        archived: '📦'
    };
    return emojis[status] || '❓';
}

/**
 * /my-apps command handler
 */
export async function handleMyAppsCommand(interaction) {
    const apps = getUserApps(interaction.user.id);
    
    if (apps.length === 0) {
        await interaction.reply({
            content: `📱 **You haven't created any apps yet!**\n\nUse \`/dev-create-app\` to submit your first application.`,
            ephemeral: true
        });
        return;
    }
    
    const activeApps = apps.filter(a => a.status !== 'archived');
    const archivedApps = apps.filter(a => a.status === 'archived');
    
    const formatApp = (app) => {
        const emoji = getStatusEmoji(app.status);
        const created = new Date(app.createdAt).toLocaleDateString();
        return `${emoji} **${app.name}** - ${app.status}\n   └ Created: ${created} | Features: ${app.features.length} | Bugs: ${app.bugs.length}`;
    };
    
    const embed = new EmbedBuilder()
        .setTitle(`📱 Your Applications`)
        .setColor('#8B5CF6')
        .setDescription(
            activeApps.length > 0 
                ? activeApps.map(formatApp).join('\n\n')
                : '_No active apps_'
        )
        .setFooter({ text: `${activeApps.length} active | ${archivedApps.length} archived • Use /my-app-status for details` })
        .setTimestamp();
    
    if (archivedApps.length > 0) {
        embed.addFields({
            name: '📦 Archived',
            value: archivedApps.map(a => `• ${a.name}`).join('\n').slice(0, 200)
        });
    }
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * /my-app-status command handler
 */
export async function handleMyAppStatusCommand(interaction) {
    const appName = interaction.options.getString('app');
    const apps = getUserApps(interaction.user.id);
    
    const app = apps.find(a => a.name.toLowerCase() === appName.toLowerCase());
    
    if (!app) {
        await interaction.reply({
            content: `❌ App "${appName}" not found. Use \`/my-apps\` to see your applications.`,
            ephemeral: true
        });
        return;
    }
    
    const created = new Date(app.createdAt).toLocaleDateString();
    const emoji = getStatusEmoji(app.status);
    
    const embed = new EmbedBuilder()
        .setTitle(`${emoji} ${app.name}`)
        .setDescription(app.description || '_No description_')
        .setColor(app.status === 'live' ? '#22C55E' : app.status === 'archived' ? '#6B7280' : '#8B5CF6')
        .addFields(
            { name: 'Status', value: app.status.toUpperCase(), inline: true },
            { name: 'Created', value: created, inline: true },
            { name: 'Features Submitted', value: `${app.features.length}`, inline: true }
        )
        .setTimestamp();
    
    // Add recent features
    if (app.features.length > 0) {
        const recentFeatures = app.features.slice(-3).map(f => 
            `• ${f.description.slice(0, 50)}${f.description.length > 50 ? '...' : ''} (${f.status})`
        ).join('\n');
        embed.addFields({ name: 'Recent Features', value: recentFeatures });
    }
    
    // Add bugs
    if (app.bugs.length > 0) {
        const recentBugs = app.bugs.slice(-3).map(b => 
            `• [${b.priority.toUpperCase()}] ${b.description.slice(0, 40)}... (${b.status})`
        ).join('\n');
        embed.addFields({ name: 'Recent Bugs', value: recentBugs });
    }
    
    // Add history
    if (app.history && app.history.length > 0) {
        const timeline = app.history.slice(-5).map(h => {
            const date = new Date(h.timestamp).toLocaleDateString();
            if (h.action === 'status_change') {
                return `• ${date}: ${h.from} → ${h.to}`;
            }
            return `• ${date}: ${h.action}`;
        }).join('\n');
        embed.addFields({ name: 'Timeline', value: timeline });
    }
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * /delete-my-app command handler
 */
export async function handleDeleteMyAppCommand(interaction) {
    const appName = interaction.options.getString('app');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    const result = deleteUserApp(interaction.user.id, appName);
    
    if (!result.success) {
        await interaction.reply({
            content: `❌ ${result.error || 'Could not delete app'}. Use \`/my-apps\` to see your applications.`,
            ephemeral: true
        });
        return;
    }
    
    await interaction.reply({
        content: `📦 **${appName}** has been archived.\n\n_Reason: ${reason}_\n\n> Your app data is preserved but the app is no longer active.`,
        ephemeral: true
    });
}

/**
 * Find app owner by app name (for integration with other handlers)
 */
export function findAppOwner(appName) {
    const data = loadUserApps();
    
    for (const [userId, userData] of Object.entries(data)) {
        const app = userData.apps?.find(a => a.name.toLowerCase() === appName.toLowerCase());
        if (app) {
            return { userId, app };
        }
    }
    
    return null;
}
