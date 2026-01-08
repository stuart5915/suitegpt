import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config.js';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

/**
 * Refine a user submission into a structured specification
 * @param {string} type - 'bug' | 'feature' | 'content'
 * @param {string} rawInput - The user's original message
 * @param {string} username - The submitter's Discord username
 * @param {string} appTag - The validated app tag (e.g., 'LifeHub')
 * @returns {Promise<Object>} Refined specification
 */
export async function refineSubmission(type, rawInput, username, appTag) {
  const prompts = {
    bug: `You are a technical analyst for SUITE Hub. A user submitted a bug report for the ${appTag} app.
    
Analyze this bug report and create a structured specification:

**App:** ${appTag}
**User Submission:**
${rawInput}

Respond in this exact JSON format:
{
  "title": "Brief, clear title for the bug",
  "severity": "critical|high|medium|low",
  "description": "Clear description of the issue",
  "stepsToReproduce": ["step 1", "step 2"],
  "expectedBehavior": "What should happen",
  "actualBehavior": "What actually happens",
  "suiteReward": 500
}`,

    feature: `You are a product analyst for SUITE Hub. A user submitted a feature idea for the ${appTag} app.
    
Analyze this feature request and create a structured specification:

**App:** ${appTag}
**User Submission:**
${rawInput}

Respond in this exact JSON format:
{
  "title": "Brief, clear title for the feature",
  "priority": "high|medium|low",
  "description": "Clear description of the feature",
  "userStory": "As a [user], I want [feature] so that [benefit]",
  "acceptanceCriteria": ["criteria 1", "criteria 2"],
  "suiteReward": 1000
}`,

    content: `You are a content analyst for SUITE Hub. A user submitted content for review related to the ${appTag} app.
    
Analyze this content submission:

**App:** ${appTag}
**User Submission:**
${rawInput}

Respond in this exact JSON format:
{
  "title": "Title of the content",
  "type": "tutorial_video|twitter_thread|tiktok_short|blog_post|other",
  "description": "Brief description of the content",
  "platform": "Platform where content is/will be published",
  "url": "URL if provided, or null",
  "quality": "excellent|good|needs_work",
  "suiteReward": 1000
}
Note: Rewards are - tutorial_video: 5000, twitter_thread: 1000, tiktok_short: 2000, blog_post: 3000`
  };

  try {
    const result = await model.generateContent(prompts[type]);
    const response = result.response.text();

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr.trim());
    parsed.submittedBy = username;
    parsed.submittedAt = new Date().toISOString();
    parsed.type = type;

    return parsed;
  } catch (error) {
    console.error('Gemini refinement error:', error);
    // Return a basic structure if AI fails
    return {
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Submission`,
      description: rawInput.substring(0, 500),
      submittedBy: username,
      submittedAt: new Date().toISOString(),
      type,
      suiteReward: config.rewards[type === 'bug' ? 'bugReport' : 'featureIdea'],
      aiError: true
    };
  }
}
