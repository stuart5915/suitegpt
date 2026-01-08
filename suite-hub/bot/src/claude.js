import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';

/**
 * Claude AI Coding Integration
 * Handles automated code changes via Claude Sonnet/Opus
 */

let anthropic = null;

export function initClaude() {
    if (config.anthropicApiKey) {
        anthropic = new Anthropic({
            apiKey: config.anthropicApiKey,
        });
        console.log('Claude AI coding integration initialized');
        return true;
    } else {
        console.log('Claude AI coding disabled (no ANTHROPIC_API_KEY)');
        return false;
    }
}

/**
 * Generate code changes using Claude
 * @param {Object} spec - The refined specification from Gemini
 * @param {string} model - 'sonnet' or 'opus'
 * @returns {Object} - { success, code, explanation, error }
 */
export async function generateCodeChange(spec, model = 'sonnet') {
    if (!anthropic) {
        return {
            success: false,
            error: 'Claude AI not configured. Add ANTHROPIC_API_KEY to .env'
        };
    }

    const modelId = model === 'opus'
        ? 'claude-sonnet-4-20250514'  // Using Sonnet 4 as placeholder; Opus 4.5 not yet available via API
        : 'claude-sonnet-4-20250514';

    const appContext = getAppContext(spec.app);

    const prompt = buildCodingPrompt(spec, appContext);

    try {
        console.log(`🤖 Calling Claude ${model}...`);

        const message = await anthropic.messages.create({
            model: modelId,
            max_tokens: 4096,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            system: `You are an expert React Native/Expo developer working on the ${spec.app} app. 
Your job is to implement fixes and features based on specifications.
Always respond with:
1. A brief explanation of what you're changing
2. The exact code changes needed (full file contents or clear diffs)
3. Any migration or testing notes

Be concise and focus on production-ready code.`
        });

        const response = message.content[0].text;

        return {
            success: true,
            model: model,
            explanation: extractExplanation(response),
            code: extractCode(response),
            fullResponse: response
        };

    } catch (error) {
        console.error('Claude API error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get app-specific context for Claude
 */
function getAppContext(appName) {
    const contexts = {
        'LifeHub': {
            tech: 'React Native + Expo + Supabase',
            path: 'life-hub/',
            description: 'Personal AI assistant app with memory/chat features'
        },
        'DeFiKnowledge': {
            tech: 'React Native + Expo + Web3',
            path: 'defi-knowledge/',
            description: 'DeFi education and wallet integration app'
        },
        'DealFinder': {
            tech: 'React Native + Expo',
            path: 'deal-finder/',
            description: 'Local deal and coupon tracker app'
        },
        'SUITEHub': {
            tech: 'Node.js + Discord.js',
            path: 'suite-hub/',
            description: 'Discord bot for community contributions'
        },
        'TrueForm': {
            tech: 'React Native + Expo',
            path: 'trueform/',
            description: 'Fitness and workout tracking app'
        },
        'OpticRep': {
            tech: 'React Native + Expo',
            path: 'opticrep/',
            description: 'Vision and eye health app'
        },
        'REMcast': {
            tech: 'React Native + Expo + Gemini API',
            path: 'remcast/',
            description: 'Dream capture app with Gemini voice listening, video generation, and dream analysis'
        }
    };

    return contexts[appName] || { tech: 'Unknown', path: '', description: '' };
}

/**
 * Build the coding prompt for Claude
 */
function buildCodingPrompt(spec, appContext) {
    let prompt = `## Task: Implement ${spec.type.toUpperCase()}\n\n`;
    prompt += `**App:** ${spec.app}\n`;
    prompt += `**Tech Stack:** ${appContext.tech}\n`;
    prompt += `**Description:** ${appContext.description}\n\n`;

    prompt += `## Specification\n`;
    prompt += `**Title:** ${spec.title}\n`;
    prompt += `**Description:** ${spec.description || spec.userStory || 'No description'}\n\n`;

    if (spec.type === 'bug') {
        if (spec.stepsToReproduce?.length) {
            prompt += `**Steps to Reproduce:**\n`;
            spec.stepsToReproduce.forEach((step, i) => {
                prompt += `${i + 1}. ${step}\n`;
            });
            prompt += '\n';
        }
        if (spec.severity) {
            prompt += `**Severity:** ${spec.severity}\n`;
        }
    } else if (spec.type === 'feature') {
        if (spec.acceptanceCriteria?.length) {
            prompt += `**Acceptance Criteria:**\n`;
            spec.acceptanceCriteria.forEach(c => {
                prompt += `• ${c}\n`;
            });
            prompt += '\n';
        }
        if (spec.priority) {
            prompt += `**Priority:** ${spec.priority}\n`;
        }
    }

    prompt += `\n## Instructions\n`;
    prompt += `1. Analyze the issue/feature\n`;
    prompt += `2. Provide the exact code changes needed\n`;
    prompt += `3. Include full file paths\n`;
    prompt += `4. Make it production-ready\n`;

    return prompt;
}

/**
 * Extract explanation from Claude's response
 */
function extractExplanation(response) {
    // Get text before first code block
    const match = response.match(/^([\s\S]*?)```/);
    return match ? match[1].trim() : response.substring(0, 500);
}

/**
 * Extract code blocks from Claude's response
 */
function extractCode(response) {
    const codeBlocks = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(response)) !== null) {
        codeBlocks.push({
            language: match[1] || 'text',
            code: match[2].trim()
        });
    }

    return codeBlocks;
}

export { getAppContext };
