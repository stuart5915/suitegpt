import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createLeaderboardEmbed } from '../utils/embeds.js';
import { config } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');
const REWARDS_FILE = join(DATA_DIR, 'rewards.json');

// In-memory cache
let rewardsData = {
    weekStart: getWeekStart(),
    contributors: {},
    history: []
};

/**
 * Get the start of the current week (Sunday)
 */
function getWeekStart() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day;
    const weekStart = new Date(now.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart.toISOString();
}

/**
 * Initialize rewards system - load from file
 */
export function initRewards() {
    // Ensure data directory exists
    if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
    }

    // Load existing data
    if (existsSync(REWARDS_FILE)) {
        try {
            rewardsData = JSON.parse(readFileSync(REWARDS_FILE, 'utf-8'));

            // Check if we need to reset for new week
            const currentWeekStart = getWeekStart();
            if (rewardsData.weekStart !== currentWeekStart) {
                // Archive current week and reset
                if (Object.keys(rewardsData.contributors).length > 0) {
                    rewardsData.history.push({
                        weekStart: rewardsData.weekStart,
                        contributors: { ...rewardsData.contributors }
                    });
                }
                rewardsData.weekStart = currentWeekStart;
                rewardsData.contributors = {};
                saveRewards();
            }
        } catch (error) {
            console.error('Error loading rewards data:', error);
        }
    } else {
        saveRewards();
    }

    console.log('Rewards system initialized');
}

/**
 * Save rewards data to file
 */
function saveRewards() {
    try {
        writeFileSync(REWARDS_FILE, JSON.stringify(rewardsData, null, 2));
    } catch (error) {
        console.error('Error saving rewards:', error);
    }
}

/**
 * Add reward to a contributor
 */
export async function addReward(userId, username, amount, type) {
    if (!rewardsData.contributors[userId]) {
        rewardsData.contributors[userId] = {
            username,
            totalSuite: 0,
            contributions: []
        };
    }

    const contributor = rewardsData.contributors[userId];
    contributor.totalSuite += amount;
    contributor.contributions.push({
        type,
        amount,
        timestamp: new Date().toISOString()
    });

    saveRewards();
    console.log(`Added ${amount} SUITE to ${username} (Total: ${contributor.totalSuite})`);
}

/**
 * Get current week's leaderboard
 */
export function getLeaderboard() {
    const contributors = Object.entries(rewardsData.contributors)
        .map(([userId, data]) => ({
            userId,
            username: data.username,
            totalSuite: data.totalSuite,
            contributionCount: data.contributions.length
        }))
        .sort((a, b) => b.totalSuite - a.totalSuite);

    return contributors;
}

/**
 * Post leaderboard to channel
 */
export async function postLeaderboard(client) {
    const leaderboardChannel = client.channels.cache.get(config.channels.leaderboard);
    if (!leaderboardChannel) {
        console.error('Leaderboard channel not found');
        return;
    }

    const leaders = getLeaderboard();
    const embed = createLeaderboardEmbed(leaders);

    await leaderboardChannel.send({ embeds: [embed] });
}

/**
 * Get a contributor's stats
 */
export function getContributorStats(userId) {
    return rewardsData.contributors[userId] || null;
}

/**
 * Get all rewards data (for admin purposes)
 */
export function getAllRewardsData() {
    return rewardsData;
}
