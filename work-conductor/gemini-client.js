/**
 * WorkConductor - Gemini API Client
 * Handles all communication with Google's Gemini API
 */

const GeminiClient = (function () {
    // API Configuration
    const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

    // Model IDs (January 2026)
    const MODELS = {
        PRO: 'gemini-2.5-pro',           // Deep analysis, 5 RPM, 100 RPD free
        FLASH: 'gemini-3-flash-preview',  // Quick responses, 10 RPM, 100 RPD free
        FLASH_LITE: 'gemini-2.5-flash-lite' // Fallback, 15 RPM, 1000 RPD free
    };

    // Rate limits (free tier)
    const RATE_LIMITS = {
        PRO: { rpm: 5, rpd: 100 },
        FLASH: { rpm: 10, rpd: 100 },
        FLASH_LITE: { rpm: 15, rpd: 1000 }
    };

    // System prompt for work session planning
    const SYSTEM_PROMPT = `You are WorkConductor, a strategic work planner for a software developer named Stuart who is building the SUITE ecosystem.

Your job is to analyze Stuart's goals, recent work, and feedback to provide a detailed WORK SESSION PLAN. Each session should be 30min-2hrs of focused work.

FORMAT YOUR OUTPUT EXACTLY LIKE THIS (use this exact structure):

📋 WORK SESSION PLAN
Focus: [Component/Feature Name]
Estimated Time: [e.g., ~45 minutes]

---

STEP 1: [Task Name] (~X min)

**What to do:**
[Clear, specific instruction]

**Send to Antigravity:**
\`\`\`
[Exact prompt to copy-paste into the AI coding assistant]
\`\`\`

**Verify:**
- [Specific thing to check when done]

---

STEP 2: [Task Name] (~X min)

**What to do:**
[Clear, specific instruction]

**Send to Antigravity:**
\`\`\`
[Exact prompt to copy-paste]
\`\`\`

**Verify:**
- [What to check]

---

(Continue for 3-5 steps typically)

---

🏁 CHECKPOINT
[When to come back - e.g., "Return when all tasks are complete, or if you get stuck on any step. Be ready to explain what happened."]

IMPORTANT RULES:
1. Be SPECIFIC - give exact prompts that can be copy-pasted
2. Be REALISTIC - each session should be achievable in the estimated time
3. DEFEND your reasoning - if user pushes back but you believe you're right, explain why
4. ADAPT genuinely - if they provide new info that changes things, update your plan
5. Stay aligned with their TELOS (goals/values) at all times
6. Each prompt should be self-contained and actionable
7. Consider dependencies - order tasks so each builds on the previous
8. Include verification steps so Stuart knows when a task is truly "done"`;

    // Feedback processing prompt
    const FEEDBACK_PROMPT = `You are WorkConductor processing feedback from Stuart.

Stuart has indicated that the guidance didn't work as expected. Your job is to:
1. UNDERSTAND what went wrong
2. CONSIDER whether your original guidance was actually correct
3. Either DEFEND your position (if you believe you were right) or ADAPT your guidance (if the feedback reveals new information)

DO NOT just agree with everything the user says. If you believe your original guidance was correct, explain why.
But if the feedback reveals something you missed, genuinely update your approach.

Respond with either:
1. An explanation of why the original approach was correct + how to proceed
2. OR an updated mini work session plan addressing the feedback

Keep your response focused and actionable.`;

    /**
     * Get API key from localStorage
     */
    function getApiKey() {
        return localStorage.getItem('conductor_api_key');
    }

    /**
     * Set API key in localStorage
     */
    function setApiKey(key) {
        localStorage.setItem('conductor_api_key', key);
    }

    /**
     * Get rate limit status from localStorage
     */
    function getRateLimitStatus() {
        const today = new Date().toDateString();
        const stored = JSON.parse(localStorage.getItem('conductor_rate_limits') || '{}');

        // Reset if it's a new day
        if (stored.date !== today) {
            const fresh = {
                date: today,
                pro: { count: 0, lastCall: 0 },
                flash: { count: 0, lastCall: 0 },
                flashLite: { count: 0, lastCall: 0 }
            };
            localStorage.setItem('conductor_rate_limits', JSON.stringify(fresh));
            return fresh;
        }

        return stored;
    }

    /**
     * Update rate limit count
     */
    function updateRateLimit(model) {
        const status = getRateLimitStatus();
        const now = Date.now();

        if (model === 'PRO') {
            status.pro.count++;
            status.pro.lastCall = now;
        } else if (model === 'FLASH') {
            status.flash.count++;
            status.flash.lastCall = now;
        } else {
            status.flashLite.count++;
            status.flashLite.lastCall = now;
        }

        localStorage.setItem('conductor_rate_limits', JSON.stringify(status));
        return status;
    }

    /**
     * Check if we can make a request (rate limit check)
     */
    function canMakeRequest(model) {
        const status = getRateLimitStatus();
        const limits = RATE_LIMITS[model];
        const now = Date.now();

        let modelStatus;
        if (model === 'PRO') modelStatus = status.pro;
        else if (model === 'FLASH') modelStatus = status.flash;
        else modelStatus = status.flashLite;

        // Check daily limit
        if (modelStatus.count >= limits.rpd) {
            return { allowed: false, reason: 'daily_limit', remaining: 0 };
        }

        // Check minute limit (60000ms = 1 minute)
        const timeSinceLastCall = now - modelStatus.lastCall;
        const minWait = 60000 / limits.rpm;

        if (timeSinceLastCall < minWait) {
            const waitTime = Math.ceil((minWait - timeSinceLastCall) / 1000);
            return { allowed: false, reason: 'rate_limit', waitSeconds: waitTime };
        }

        return {
            allowed: true,
            remaining: limits.rpd - modelStatus.count,
            model: model
        };
    }

    /**
     * Get cooldown time until next request is allowed
     */
    function getCooldownTime(model) {
        const status = getRateLimitStatus();
        const limits = RATE_LIMITS[model];
        const now = Date.now();

        let modelStatus;
        if (model === 'PRO') modelStatus = status.pro;
        else if (model === 'FLASH') modelStatus = status.flash;
        else modelStatus = status.flashLite;

        const minWait = 60000 / limits.rpm;
        const timeSinceLastCall = now - modelStatus.lastCall;

        if (timeSinceLastCall >= minWait) return 0;

        return Math.ceil((minWait - timeSinceLastCall) / 1000);
    }

    /**
     * Reset rate limits (for testing/manual reset)
     */
    function resetRateLimits() {
        localStorage.removeItem('conductor_rate_limits');
        return getRateLimitStatus();
    }

    /**
     * Make API request to Gemini
     */
    async function callGemini(model, prompt, systemPrompt = null) {
        const apiKey = getApiKey();
        if (!apiKey) {
            throw new Error('API key not configured');
        }

        // Check rate limits
        const canCall = canMakeRequest(model);
        if (!canCall.allowed) {
            if (canCall.reason === 'daily_limit') {
                throw new Error(`Daily limit reached for ${model}. Try again tomorrow.`);
            } else {
                throw new Error(`Rate limited. Please wait ${canCall.waitSeconds} seconds.`);
            }
        }

        const modelId = MODELS[model];
        const url = `${API_BASE}/${modelId}:generateContent?key=${apiKey}`;

        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192
            }
        };

        // Add system instruction if provided
        if (systemPrompt) {
            requestBody.systemInstruction = {
                parts: [{
                    text: systemPrompt
                }]
            };
        }

        // Add thinking for Flash (Gemini 3 Flash supports this)
        if (model === 'FLASH') {
            requestBody.generationConfig.thinkingConfig = {
                thinkingBudget: 2048 // Medium thinking level
            };
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.error?.message || `API error: ${response.status}`;
                throw new Error(errorMessage);
            }

            const data = await response.json();

            // Update rate limits after successful call
            updateRateLimit(model);

            // Extract text from response
            if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                return {
                    text: data.candidates[0].content.parts[0].text,
                    model: model,
                    rateLimitStatus: getRateLimitStatus()
                };
            } else {
                throw new Error('Unexpected response format from Gemini');
            }
        } catch (error) {
            console.error('Gemini API error:', error);
            throw error;
        }
    }

    /**
     * Analyze project and create work session plan
     */
    async function createSessionPlan(context) {
        const { telos, recentSessions, feedback, additionalContext } = context;

        let prompt = `## Current Goals & Telos
${telos}

`;

        if (recentSessions && recentSessions.length > 0) {
            prompt += `## Recent Work Sessions
`;
            recentSessions.forEach((session, i) => {
                prompt += `
### Session ${i + 1} (${session.date})
Focus: ${session.focus}
Status: ${session.status}
${session.feedback ? `Feedback: ${session.feedback}` : ''}
`;
            });
            prompt += '\n';
        }

        if (feedback) {
            prompt += `## Important Feedback from Previous Session
${feedback}

`;
        }

        if (additionalContext) {
            prompt += `## Additional Context
${additionalContext}

`;
        }

        prompt += `
## Your Task
Based on the above, create a strategic work session plan for right now. Consider:
1. What's the most impactful thing to work on?
2. What can realistically be accomplished?
3. How does this move toward the stated goals?

Provide the work session plan in the exact format specified.`;

        return await callGemini('PRO', prompt, SYSTEM_PROMPT);
    }

    /**
     * Process feedback and provide updated guidance
     */
    async function processFeedback(feedbackType, feedbackDetails, originalPlan, telos) {
        const prompt = `## Original Work Session Plan
${originalPlan}

## User's Telos (for context)
${telos}

## Feedback Type
${feedbackType}

## Feedback Details
${feedbackDetails}

## Your Task
Process this feedback and respond appropriately. Remember:
- If you believe your original guidance was correct, DEFEND it and explain why
- If the feedback reveals something you missed, ADAPT genuinely
- Be specific and actionable in your response`;

        return await callGemini('FLASH', prompt, FEEDBACK_PROMPT);
    }

    /**
     * Quick clarification request
     */
    async function askClarification(question, context) {
        const prompt = `## Context
${context}

## Question
${question}

Please provide a brief, helpful answer.`;

        return await callGemini('FLASH', prompt);
    }

    // Public API
    return {
        getApiKey,
        setApiKey,
        getRateLimitStatus,
        canMakeRequest,
        getCooldownTime,
        resetRateLimits,
        createSessionPlan,
        processFeedback,
        askClarification,
        MODELS,
        RATE_LIMITS
    };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.GeminiClient = GeminiClient;
}
