import { GoogleGenerativeAI } from '@google/generative-ai';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../config.js';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

/**
 * /idea [description] - Analyze an idea with Gemini
 */
export async function handleIdeaCommand(interaction) {
    await interaction.deferReply();

    const idea = interaction.options.getString('idea');

    const prompt = `You are a startup advisor and product strategist. Analyze this idea:

"${idea}"

Provide your analysis in this exact format:
**Rating:** [1-10]/10

**Summary:** [One sentence summary]

**Pros:**
• [Pro 1]
• [Pro 2]
• [Pro 3]

**Cons:**
• [Con 1]
• [Con 2]
• [Con 3]

**Market Fit:** [One paragraph on market opportunity]

**Verdict:** [PURSUE / PIVOT / PASS] - [Brief justification]`;

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        const analysis = result.response.text();

        const embed = new EmbedBuilder()
            .setTitle('💡 Idea Analysis')
            .setDescription(`**Original Idea:**\n> ${idea.slice(0, 200)}${idea.length > 200 ? '...' : ''}`)
            .addFields({ name: 'AI Analysis', value: analysis.slice(0, 1024) })
            .setColor('#FFD700')
            .setFooter({ text: `Analyzed by Gemini • Requested by ${interaction.user.username}` })
            .setTimestamp();

        // If analysis is long, add continuation
        if (analysis.length > 1024) {
            embed.addFields({ name: 'Continued...', value: analysis.slice(1024, 2048) });
        }

        // Create save button
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`save_${Date.now()}`)
                    .setLabel('💾 Save')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.followUp({ embeds: [embed], components: [row] });

        // Also post to #ai channel if configured
        if (config.channels.ai) {
            const aiChannel = await interaction.client.channels.fetch(config.channels.ai);
            if (aiChannel) {
                await aiChannel.send({ embeds: [embed] });
            }
        }

    } catch (error) {
        console.error('Idea analysis error:', error);
        await interaction.followUp({ content: '❌ Error analyzing idea. Please try again.' });
    }
}

/**
 * /study [topic] - Deep research with structured findings
 */
export async function handleStudyCommand(interaction) {
    await interaction.deferReply();

    const topic = interaction.options.getString('topic');

    const prompt = `You are a senior researcher with deep expertise. Conduct comprehensive research on:

"${topic}"

Provide a structured research report:

## Executive Summary
[2-3 sentences]

## Key Findings
1. [Finding 1 with evidence]
2. [Finding 2 with evidence]
3. [Finding 3 with evidence]

## Current State of the Art
[What's the best solution/approach right now?]

## Opportunities
• [Opportunity 1]
• [Opportunity 2]

## Risks & Challenges
• [Risk 1]
• [Risk 2]

## Recommendations
1. [Action item 1]
2. [Action item 2]
3. [Action item 3]

## Next Steps to Integrate
If implementing this, the first step would be: [Specific actionable step]`;

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        const research = result.response.text();

        // Create initial reply with embed
        const embed = new EmbedBuilder()
            .setTitle('🔬 Deep Research Report')
            .setDescription(`**Topic:** ${topic}`)
            .setColor('#6366F1')
            .setFooter({ text: `Research by Gemini Ultra • ${interaction.user.username}` })
            .setTimestamp();

        const replyMessage = await interaction.followUp({ embeds: [embed], content: '📚 Research complete! See thread below.' });

        // Create a thread from the reply
        const thread = await replyMessage.startThread({
            name: `Research: ${topic.slice(0, 50)}...`,
            autoArchiveDuration: 1440 // 24 hours
        });

        // Split research into chunks and post in thread
        const chunks = research.match(/.{1,1900}/gs) || [];
        for (const chunk of chunks) {
            await thread.send({ content: chunk });
        }

        // Add action buttons in thread
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`integrate_${Date.now()}`)
                    .setLabel('📋 Create Task')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`save_${Date.now()}`)
                    .setLabel('💾 Save to Notes')
                    .setStyle(ButtonStyle.Secondary)
            );

        await thread.send({ content: 'What would you like to do with this research?', components: [row] });

    } catch (error) {
        console.error('Study error:', error);
        await interaction.followUp({ content: '❌ Error conducting research. Please try again.' });
    }
}

/**
 * /review [github-url] - AI code review
 */
export async function handleReviewCommand(interaction) {
    await interaction.deferReply();

    const githubUrl = interaction.options.getString('url');

    // Extract raw content URL
    let rawUrl = githubUrl;
    if (githubUrl.includes('github.com') && !githubUrl.includes('raw.')) {
        rawUrl = githubUrl
            .replace('github.com', 'raw.githubusercontent.com')
            .replace('/blob/', '/');
    }

    try {
        // Fetch the code
        const response = await fetch(rawUrl);
        if (!response.ok) throw new Error('Could not fetch code');

        const code = await response.text();
        const codeSnippet = code.slice(0, 8000); // Limit for context

        const prompt = `You are a senior code reviewer. Review this code:

\`\`\`
${codeSnippet}
\`\`\`

Provide a structured code review:

## Overall Quality: [1-10]/10

## What's Good ✅
• [Good practice 1]
• [Good practice 2]

## Issues Found ⚠️
• [Issue 1] - [Severity: Low/Medium/High]
• [Issue 2] - [Severity: Low/Medium/High]

## Suggestions for Improvement
1. [Suggestion with code example if helpful]
2. [Suggestion with code example if helpful]

## Security Concerns 🔒
[Any security issues or "None found"]

## Performance Notes ⚡
[Any performance issues or "Looks good"]`;

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        const review = result.response.text();

        const embed = new EmbedBuilder()
            .setTitle('🔍 Code Review')
            .setDescription(`[View Code](${githubUrl})`)
            .setColor('#22C55E')
            .setFooter({ text: `Reviewed by Gemini • ${interaction.user.username}` })
            .setTimestamp();

        const chunks = review.match(/.{1,1900}/gs) || [];

        await interaction.followUp({ embeds: [embed] });

        for (const chunk of chunks.slice(0, 3)) {
            await interaction.followUp({ content: '```md\n' + chunk + '\n```' });
        }

    } catch (error) {
        console.error('Review error:', error);
        await interaction.followUp({ content: '❌ Error fetching or reviewing code. Make sure the URL is public.' });
    }
}

/**
 * /content [app] - Generate content ideas for an app
 */
export async function handleContentCommand(interaction) {
    await interaction.deferReply();

    const appName = interaction.options.getString('app');

    const prompt = `You are a social media strategist and content creator. Generate content ideas for this app:

App: "${appName}"

Create a content calendar with specific ideas:

## 🎬 TikTok Videos (3 ideas)
1. **Hook:** [First 3 seconds]
   **Content:** [What happens]
   **CTA:** [Call to action]

2. **Hook:** [First 3 seconds]
   **Content:** [What happens]
   **CTA:** [Call to action]

3. **Hook:** [First 3 seconds]
   **Content:** [What happens]
   **CTA:** [Call to action]

## 🐦 Twitter Threads (2 ideas)
1. **Opening tweet:** [Tweet 1]
   **Key points:** [What the thread covers]

2. **Opening tweet:** [Tweet 1]
   **Key points:** [What the thread covers]

## 📝 Blog Post Ideas (2 ideas)
1. **Title:** [SEO-optimized title]
   **Angle:** [What makes it unique]

2. **Title:** [SEO-optimized title]
   **Angle:** [What makes it unique]

## 📊 Best Times to Post
• TikTok: [Best times]
• Twitter: [Best times]

## Hashtags to Use
[5-7 relevant hashtags]`;

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        const ideas = result.response.text();

        console.log(`[Content] Generated ${ideas.length} chars for ${appName}`);

        const embed = new EmbedBuilder()
            .setTitle(`📱 Content Ideas: ${appName}`)
            .setColor('#E11D48')
            .setFooter({ text: `Generated by Gemini • ${interaction.user.username}` })
            .setTimestamp();

        const replyMessage = await interaction.followUp({ embeds: [embed], content: '🎬 Content ideas ready! See thread below.' });

        // Create a thread from the reply
        const thread = await replyMessage.startThread({
            name: `Content: ${appName}`,
            autoArchiveDuration: 1440 // 24 hours
        });

        console.log(`[Content] Thread created: ${thread.name}`);

        // Split ideas into chunks and post in thread
        const chunks = ideas.match(/.{1,1900}/gs) || [];
        console.log(`[Content] Sending ${chunks.length} chunks to thread`);

        for (let i = 0; i < chunks.length; i++) {
            try {
                await thread.send({ content: chunks[i] });
                console.log(`[Content] Sent chunk ${i + 1}/${chunks.length}`);
            } catch (sendError) {
                console.error(`[Content] Error sending chunk ${i}:`, sendError);
            }
        }

        // Add save button in thread
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`save_${Date.now()}`)
                    .setLabel('💾 Save')
                    .setStyle(ButtonStyle.Secondary)
            );
        await thread.send({ content: 'Like these ideas?', components: [row] });

    } catch (error) {
        console.error('Content error:', error);
        await interaction.followUp({ content: '❌ Error generating content ideas. Please try again.' });
    }
}
// Store pending suggestions for button handlers
export const pendingSuggestions = new Map();

/**
 * /suggest [app] - AI suggests features for an app
 */
export async function handleSuggestCommand(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const appName = interaction.options.getString('app');

    // App descriptions for context
    const appDescriptions = {
        'Cheshbon': 'Jewish financial reflection app for tracking expenses with weekly Shabbat summaries and gratitude journaling',
        'DeFi Knowledge': 'Educational app teaching DeFi concepts like yield farming, liquidity pools, and smart contracts',
        'OpticRep': 'AI workout trainer that uses camera to track reps and form in real-time',
        'REMcast': 'Dream journal with AI analysis to find patterns and meanings in your dreams',
        'TrueForm': 'AI posture and movement analysis for physiotherapy and injury prevention',
        'FoodVitals': 'Nutrition tracking app with AI meal analysis from photos',
        'LifeHub': 'Personal AI assistant that remembers your context and helps with daily tasks',
        'DealFinder': 'Local deal tracker for Cambridge area, aggregating Kijiji and marketplace listings',
        'ContentBounty': 'Marketplace where brands post bounties for content creators to compete'
    };

    const appDesc = appDescriptions[appName] || appName;

    const prompt = `You are a product manager. Suggest 5 features for this app.

App: "${appName}"
Description: ${appDesc}

IMPORTANT: Return ONLY a JSON array with exactly 5 features. No other text. Format:
[
  {"name": "Feature Name", "description": "One sentence description", "impact": "High"},
  {"name": "Feature Name", "description": "One sentence description", "impact": "Medium"},
  {"name": "Feature Name", "description": "One sentence description", "impact": "High"},
  {"name": "Feature Name", "description": "One sentence description", "impact": "Low"},
  {"name": "Feature Name", "description": "One sentence description", "impact": "Medium"}
]`;

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        let responseText = result.response.text();

        // Clean up response - extract JSON
        responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        let features;
        try {
            features = JSON.parse(responseText);
        } catch (e) {
            console.error('Failed to parse suggestions:', responseText);
            await interaction.followUp({ content: '❌ Error parsing suggestions. Please try again.', ephemeral: true });
            return;
        }

        // Build feature list text
        let featureList = '';
        for (let i = 0; i < features.length; i++) {
            const f = features[i];
            featureList += `**${i + 1}. ${f.name}**\n${f.description}\nImpact: ${f.impact}\n\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle(`🎯 Feature Suggestions: ${appName}`)
            .setDescription(featureList)
            .setColor('#8B5CF6')
            .setFooter({ text: `Click a button to add feature to backlog` })
            .setTimestamp();

        // Create buttons for each feature
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('suggest_1')
                    .setLabel('Add #1')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('suggest_2')
                    .setLabel('Add #2')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('suggest_3')
                    .setLabel('Add #3')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('suggest_4')
                    .setLabel('Add #4')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('suggest_5')
                    .setLabel('Add #5')
                    .setStyle(ButtonStyle.Primary),
            );

        // Short confirmation to user
        await interaction.followUp({ content: `✅ Suggestions for **${appName}** posted to <#${config.channels.ai}>`, ephemeral: true });

        // Post to #ai channel with buttons
        if (config.channels.ai) {
            const aiChannel = await interaction.client.channels.fetch(config.channels.ai);
            if (aiChannel) {
                const msg = await aiChannel.send({ embeds: [embed], components: [row] });

                // Store features for button handler (keyed by message ID)
                pendingSuggestions.set(msg.id, {
                    appName,
                    features,
                    userId: interaction.user.id
                });

                // Clean up after 1 hour
                setTimeout(() => pendingSuggestions.delete(msg.id), 3600000);
            }
        }

    } catch (error) {
        console.error('Suggest error:', error);
        await interaction.followUp({ content: '❌ Error generating suggestions. Please try again.', ephemeral: true });
    }
}
