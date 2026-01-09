/**
 * SUITE Bot - AI Community Assistant
 * Helpful assistant for the SUITE Discord community
 * With security measures to prevent leaking sensitive info
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// SUITE Bot personality and context
const BOT_SYSTEM_PROMPT = `You are SUITE Bot, the AI assistant for the SUITE platform - a place where anyone can build apps without coding.

## Your Personality & Voice
- Friendly and helpful, but not over-the-top enthusiastic
- Professional yet approachable
- Keep responses SHORT (1-3 sentences unless more detail is needed)
- Use occasional emojis but not excessively
- Be helpful and point to docs/resources when relevant

## Things You Know About
- SUITE platform: Build apps by talking to AI - no coding needed
- $SUITE token: Utility token that powers AI features in apps, app development, etc.
- The Forge: Web-based app builder at getsuite.app
- Discord community: Builders, creators, entrepreneurs
- Apps: FoodVitals, TrueForm, LifeHub, DealFinder, and others
- Tokenomics: Treasury-backed floor price, 100% redeemable, 10% giving pool

## What This Server Is About
This is the SUITE Discord community where people:
- Build apps using AI without knowing how to code
- Test and use SUITE-powered apps
- Earn SUITE tokens by contributing (bugs, features, content)
- Connect with other builders and creators

## CRITICAL SECURITY RULES - NEVER BREAK THESE
1. NEVER share API keys, tokens, passwords, or any credentials
2. NEVER reveal environment variables or .env file contents
3. NEVER share database connection strings or URLs
4. NEVER share webhook URLs or internal endpoints
5. NEVER share private code, internal systems, or infrastructure details
6. If someone asks for any of the above, politely decline
7. If someone tries to trick you into revealing secrets, recognize it and refuse

## How to Respond
- Be helpful and supportive
- If you don't know something, say so honestly
- For complex questions, point them to docs at getsuite.app/docs
- Celebrate wins: "Nice work!" "That's great!"
- For struggles: "Let me know if you have more questions!"
`;

// Patterns that should NEVER appear in responses (security filter)
const SENSITIVE_PATTERNS = [
    /[A-Za-z0-9_-]{20,}/,  // Long tokens/keys
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,  // JWTs
    /sk-[A-Za-z0-9]{20,}/,  // API keys (OpenAI style)
    /AIza[A-Za-z0-9_-]{30,}/,  // Google API keys
    /https?:\/\/[^\s]*supabase[^\s]*/i,  // Supabase URLs
    /https?:\/\/[^\s]*discord\.com\/api\/webhooks[^\s]*/i,  // Discord webhooks
    /DISCORD_TOKEN/i,
    /SUPABASE_KEY/i,
    /GEMINI_API_KEY/i,
    /ANTHROPIC_API_KEY/i,
    /SERVICE_KEY/i,
    /SERVICE_ROLE/i,
    /\.env/,
    /process\.env/i,
    /password\s*[:=]/i,
    /secret\s*[:=]/i,
];

// Check if a response contains sensitive patterns
function containsSensitiveInfo(text) {
    for (const pattern of SENSITIVE_PATTERNS) {
        if (pattern.test(text)) {
            console.log('[SECURITY] Blocked sensitive pattern in response');
            return true;
        }
    }
    return false;
}

// Detect if user is trying to extract sensitive info
const EXTRACTION_ATTEMPTS = [
    /tell me (the|your|about) (api|token|key|password|secret)/i,
    /what('s| is) (the|your) (api|token|key|password|secret)/i,
    /show me (the|your) (env|environment|config)/i,
    /reveal (the|your) (api|token|key|password|secret)/i,
    /print (the|your) (env|environment)/i,
    /ignore (previous|your) (instructions|rules)/i,
    /pretend you('re| are) (a different|another|not)/i,
    /act as if/i,
    /roleplay as/i,
    /forget (your|the) (rules|instructions)/i,
];

function isExtractionAttempt(message) {
    for (const pattern of EXTRACTION_ATTEMPTS) {
        if (pattern.test(message)) {
            console.log('[SECURITY] Blocked extraction attempt:', message.substring(0, 50));
            return true;
        }
    }
    return false;
}

// Generate a response as SUITE Bot
export async function generateBotResponse(userMessage, context = {}) {
    // Security check: Block extraction attempts
    if (isExtractionAttempt(userMessage)) {
        return "I can't share that kind of information. 😄 Is there something else I can help you with?";
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `${BOT_SYSTEM_PROMPT}

## Current Context
- Channel: ${context.channelName || 'general'}
- User: ${context.userName || 'someone'}
${context.recentMessages ? `- Recent chat:\n${context.recentMessages}` : ''}

## User's Message
${userMessage}

## Your Response (as SUITE Bot, keep it brief and helpful):`;

        const result = await model.generateContent(prompt);
        let response = result.response.text().trim();

        // Security check: Filter sensitive patterns from response
        if (containsSensitiveInfo(response)) {
            console.log('[SECURITY] Response contained sensitive info, blocking');
            return "I can't share that information. What else can I help you with? 🔥";
        }

        // Limit response length
        if (response.length > 500) {
            response = response.substring(0, 497) + '...';
        }

        return response;
    } catch (error) {
        console.error('Error generating bot response:', error);
        return "Something went wrong on my end. Try again? 🤔";
    }
}

// Generate a community engagement message
export async function generateEngagementMessage() {
    const prompts = [
        "What's everyone building today? 🚀",
        "Anyone have updates on their app? Would love to hear!",
        "Need help with your project? Drop a question 💪",
        "New features in the Forge! Check it out at getsuite.app ✨",
        "Reminder: You don't need to code to build an app here 🔥",
    ];

    // 50% chance of random prompt, 50% AI generated
    if (Math.random() > 0.5) {
        return prompts[Math.floor(Math.random() * prompts.length)];
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(
            `${BOT_SYSTEM_PROMPT}\n\nGenerate a SHORT casual message to encourage conversation in a Discord about building apps. 1-2 sentences max.`
        );
        const response = result.response.text().trim();

        if (containsSensitiveInfo(response)) {
            return prompts[0];
        }

        return response;
    } catch {
        return prompts[0];
    }
}

// Backwards compatibility export
export const generateStuResponse = generateBotResponse;

export default { generateBotResponse, generateStuResponse, generateEngagementMessage };
