// AI Prompt Refinement Handler
// Triggered by 🤖 reaction on pending prompts
// Uses Gemini to analyze and improve prompt specificity

const { generateWithGemini } = require('../gemini');

/**
 * Handle 🤖 reaction - AI refines the prompt
 * @param {import('discord.js').Message} message - The prompt message
 * @param {import('discord.js').User} user - User who clicked the robot emoji
 */
async function handleAIRefinement(message, user) {
    try {
        // Get original prompt content
        const originalPrompt = message.embeds[0]?.description || message.content;

        if (!originalPrompt) {
            await user.send('❌ Could not find the original prompt to refine.');
            return;
        }

        // Extract app name from prompt metadata
        const appMatch = originalPrompt.match(/\*\*App:\*\* (.+)/);
        const appName = appMatch ? appMatch[1] : 'defi-knowledge';

        // Get app structure context (simplified for now)
        const appContext = getAppContext(appName);

        // Send "analyzing" message
        const dmChannel = await user.createDM();
        const analyzingMsg = await dmChannel.send('🤖 **AI Prompt Refinement**\n\nAnalyzing your prompt and suggesting improvements...');

        // Call Gemini API for refinement
        const refinementPrompt = `You are an expert at writing clear,specific feature requests for mobile apps.

Original Prompt:
"""
${originalPrompt}
"""

App Context:
${appContext}

Task: Refine this prompt to be more specific and actionable for a developer. Include:
1. Exact screen/tab location
2. Specific UI components to add/modify  
3. Data sources and API requirements
4. Any edge cases or error handling

Return ONLY the refined prompt text, no preamble or explanation.`;

        const refinedPrompt = await generateWithGemini(refinementPrompt);

        // Update the analyzing message with the result
        await analyzingMsg.edit({
            content: `🤖 **AI Prompt Refinement Complete**\n\n**Original Prompt:**\n\`\`\`${originalPrompt}\`\`\`\n\n**Refined Suggestion:**\n\`\`\`${refinedPrompt}\`\`\`\n\n**Next Steps:**\n1. Review the refined version\n2. Copy it or make edits\n3. Re-submit to #pending with your improvements\n\nThe refined version provides more specific details that will help get better results!`
        });

    } catch (error) {
        console.error('Error in AI refinement:', error);
        await user.send(`❌ Error refining prompt: ${error.message}`);
    }
}

/**
 * Get app structure context for refinement
 * @param {string} appName - Name of the app
 * @returns {string} Context description
 */
function getAppContext(appName) {
    const contexts = {
        'defi-knowledge': `
App Structure (DeFiKnowledge - React Native/Expo):
- Tabs: Home (Command Center), Learn, Explore, Consult, Profile
- Explore tab has sub-tabs: Overview, Swap, Yields
- Yields sub-tab has sections: Simple, Strategies, Top Voted
- Home screen shows: Learning progress, Trending news, Quick actions
- Uses WalletConnect for blockchain integration
        `,
        'suite-hub': `
App Structure (SUITE Hub - Discord Bot):
- Channels: #pending, #approved, #archive
- Workflow: Submission → Review → Approval → Execution
- Integrations: G emini AI, Claude AI, GitHub
        `,
        'default': `
General app structure - please be as specific as possible about:
- Which screen/tab the feature belongs to
- What UI components are needed
- What data should be displayed
        `
    };

    return contexts[appName.toLowerCase()] || contexts['default'];
}

module.exports = { handleAIRefinement };
