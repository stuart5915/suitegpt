import 'dotenv/config';

export const config = {
  // Discord
  discordToken: process.env.DISCORD_TOKEN,
  guildId: process.env.GUILD_ID,
  ownerId: process.env.OWNER_ID,
  reviewerRoleId: process.env.REVIEWER_ROLE_ID,
  testerRoleId: process.env.TESTER_ROLE_ID,
  developerRoleId: process.env.DEVELOPER_ROLE_ID,

  // ════ CHANNELS ════ (Only 6 needed!)
  channels: {
    welcome: process.env.CHANNEL_WELCOME,     // Pinned guide + daily briefs
    commands: process.env.CHANNEL_COMMANDS,   // All slash commands here
    ai: process.env.CHANNEL_AI,               // AI outputs (/idea /study /content)
    pending: process.env.CHANNEL_PENDING,     // Bugs/features awaiting approval
    shipped: process.env.CHANNEL_SHIPPED,     // Completed work
    savedIdeas: process.env.CHANNEL_SAVED_IDEAS, // User-saved AI outputs
    general: process.env.CHANNEL_GENERAL,     // General chat for welcome messages
  },

  // Gemini
  geminiApiKey: process.env.GEMINI_API_KEY,

  // Anthropic (Claude)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,

  // Reward values in SUITE tokens
  rewards: {
    bugReport: 500,
    featureIdea: 1000,
    shipBonus: 750,
    tutorialVideo: 5000,
    twitterThread: 1000,
    tiktokShort: 2000,
    blogPost: 3000,
  },

  // Emojis for reactions
  emojis: {
    approve: '✅',
    opus: '🧠',
    manual: '🔧',
    todo: '📋',
    needsInfo: '🔍',
    reject: '❌',
    pending: '⏳',
    shipped: '🚀',
  },

  // Feature flags
  maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
  maintenanceMessage: process.env.MAINTENANCE_MESSAGE || '🚀 **SUITE is launching January 10th!**\n\nCommands are temporarily disabled while we prepare for launch.\n\nIn the meantime:\n• Join the waitlist at https://getsuite.app\n• Follow @suiteappstore on X\n• Get ready to build! 🎉',
  enableRewards: process.env.ENABLE_REWARDS === 'true',
};

// Validate required config
const required = ['discordToken', 'geminiApiKey'];
for (const key of required) {
  if (!config[key]) {
    console.error(`Missing required config: ${key}`);
    process.exit(1);
  }
}
