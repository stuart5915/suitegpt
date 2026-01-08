/**
 * AI Stu - Community Manager Persona
 * Acts like Stu when he's away, engages the community, answers questions
 * With security measures to prevent leaking sensitive info
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Stu's personality and context
const STU_SYSTEM_PROMPT = `You are Stu, the founder of SUITE - a platform where anyone can build apps without coding.

## Your Personality & Voice
- Greetings: "hey what's up", "hey how's it going"
- Signature phrases: "one step at a time", "hopefully", "if you have any questions let me know"
- Encouraging: "oh nice work!", "good work @username!"
- Calm, supportive, not overly hyped
- Keep responses SHORT (1-3 sentences)
- NOT robotic or generic - sound like a real person
- DON'T say things like "yo that's sick" or "let's gooo" - that's not your vibe
- DO use occasional emojis but not excessively
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
- Celebrate wins: "nice work!" "that's great!"
- For struggles: "if you have any questions let me know"
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

// Generate a response as Stu
export async function generateStuResponse(userMessage, context = {}) {
    // Security check: Block extraction attempts
    if (isExtractionAttempt(userMessage)) {
        return "haha nice try 😄 i don't share that kinda stuff. anyway, what are you building? 🚀";
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `${STU_SYSTEM_PROMPT}

## Current Context
- Channel: ${context.channelName || 'general'}
- User: ${context.userName || 'someone'}
${context.recentMessages ? `- Recent chat:\n${context.recentMessages}` : ''}

## User's Message
${userMessage}

## Your Response (as Stu, keep it brief and casual):`;

        const result = await model.generateContent(prompt);
        let response = result.response.text().trim();

        // Security check: Filter sensitive patterns from response
        if (containsSensitiveInfo(response)) {
            console.log('[SECURITY] Response contained sensitive info, blocking');
            return "yo that's not something i can share lol. what else you wanna know about SUITE? 🔥";
        }

        // Limit response length
        if (response.length > 500) {
            response = response.substring(0, 497) + '...';
        }

        return response;
    } catch (error) {
        console.error('Error generating Stu response:', error);
        return "yo my brain glitched for a sec lol. try again? 🤔";
    }
}

// Generate a community engagement message (for stirring conversation)
export async function generateEngagementMessage() {
    const prompts = [
        "what's everyone building today? 🚀",
        "yo who's got updates on their app? would love to hear!",
        "anyone need help with their project? drop a question 💪",
        "just shipped a new feature to the Forge! check it out at getsuite.app ✨",
        "reminder: you don't need to know how to code to build something sick here 🔥",
    ];

    // 50% chance of random prompt, 50% AI generated
    if (Math.random() > 0.5) {
        return prompts[Math.floor(Math.random() * prompts.length)];
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(
            `${STU_SYSTEM_PROMPT}\n\nGenerate a SHORT casual message to stir up conversation in a Discord about building apps. Be encouraging. 1-2 sentences max.`
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

export default { generateStuResponse, generateEngagementMessage };
