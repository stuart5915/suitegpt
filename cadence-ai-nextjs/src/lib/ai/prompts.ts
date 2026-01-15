import { Platform, ContentType, Project, ContentItem } from '@/lib/supabase/types'

// ================================
// WEEKLY CONTENT GENERATION
// ================================

export function buildWeeklyProposalPrompt(project: Project, weekStart: string): string {
  const platformsStr = project.platforms.join(', ')
  const pillarsStr = project.content_pillars?.join(', ') || 'general topics'

  // Extract branding settings from posting_schedule (where we store them)
  const branding = (project.posting_schedule as any) || {}
  const toneOfVoice = branding.tone_of_voice || ''
  const speakingPerspective = branding.speaking_perspective || 'we'
  const productsServices = branding.products_services?.join(', ') || ''
  const bannedWords = branding.banned_words || ''

  // Build perspective instruction
  const perspectiveMap: Record<string, string> = {
    'i': 'Write from a first-person singular perspective ("I", "my", "me") as if the founder/owner is speaking directly.',
    'we': 'Write from a first-person plural perspective ("we", "our", "us") as a team/company voice.',
    'you': 'Write primarily addressing the reader directly ("you", "your") to create engagement.',
    'they': 'Write in third-person about the brand ("they", "the company") for a more formal tone.',
  }
  const perspectiveInstruction = perspectiveMap[speakingPerspective] || perspectiveMap['we']

  return `You are a expert social media marketing strategist and content creator.

## PROJECT CONTEXT
**Brand/Project:** ${project.name}
${project.description ? `**Description:** ${project.description}` : ''}
${project.brand_voice ? `**Brand Voice:** ${project.brand_voice}` : '**Brand Voice:** Professional but approachable'}
${toneOfVoice ? `**Tone of Voice:** ${toneOfVoice}` : ''}
${project.target_audience ? `**Target Audience:** ${project.target_audience}` : ''}
**Content Pillars/Themes:** ${pillarsStr}
**Platforms:** ${platformsStr}
${productsServices ? `**Products/Services to Feature:** ${productsServices}` : ''}

## SPEAKING STYLE
${perspectiveInstruction}

${bannedWords ? `## BANNED WORDS (NEVER USE THESE)
The following words/phrases must NEVER appear in any content: ${bannedWords}
` : ''}

## TASK
Generate a complete weekly content calendar for the week starting ${weekStart}.

Create 1-2 posts per day across the specified platforms. Vary the content types for engagement:
- Text posts for quick thoughts/tips
- Image posts for visual impact
- Infographics for data/education
- Carousels for in-depth topics
- Video scripts for engaging content
- Testimonials for social proof
- Threads for X (deep dives)
- Behind-the-scenes for authenticity
- Polls for engagement

## CONTENT TYPE GUIDELINES
- **text**: Short, punchy posts (good for X, LinkedIn)
- **image**: Single powerful visual with caption
- **carousel**: 5-10 slides telling a story (Instagram, LinkedIn)
- **infographic**: Data visualization, stats, processes
- **comparison**: Before/after, vs, side-by-side
- **collage**: Multiple related images
- **knowledge**: Educational, how-to, tips
- **testimonial**: Customer quotes, success stories
- **behind_scenes**: Team, process, authentic moments
- **thread**: Multi-post connected narrative (X only)
- **poll**: Engaging question with options
- **live_prompt**: Topic outline for live stream
- **story**: Ephemeral, casual, vertical

## VIDEO SCRIPT FORMATS (Duration-Based)

Choose the script format based on the video duration specified:

### QUICK (15 seconds) - TikTok, Reels
4 frames, ~30 words total. Ultra-punchy single idea.
\`\`\`
[HOOK - 0:00-0:03] "Pattern interrupt - one shocking sentence"
[POINT - 0:03-0:08] "The single key insight"
[PROOF - 0:08-0:12] "Quick example or stat"
[CTA - 0:12-0:15] "Follow for more!"
\`\`\`

### STANDARD (30-60 seconds) - Most versatile
6-8 frames, ~100-150 words. Problem-solution arc.
\`\`\`
[HOOK - 0:00-0:05] "Stop scrolling if..." or controversial opener
[PROBLEM - 0:05-0:12] "Here's why most people fail at X"
[TEASE - 0:12-0:18] "But there's a simple fix..."
[SOLUTION 1 - 0:18-0:28] "First, do this..."
[SOLUTION 2 - 0:28-0:38] "Second, try this..."
[SOLUTION 3 - 0:38-0:48] "And finally..."
[RESULT - 0:48-0:55] "Now you'll see X improvement"
[CTA - 0:55-0:60] "Save this and follow for more!"
\`\`\`

### EXTENDED (90-180 seconds) - YouTube, LinkedIn
12+ frames, ~300-500 words. Full story arc with examples.
\`\`\`
[HOOK - 0:00-0:08] "I made $X doing Y, and I'm going to show you exactly how"
[CREDIBILITY - 0:08-0:20] "Quick background on why you should listen"
[PROBLEM - 0:20-0:35] "Most people struggle with X because..."
[STORY - 0:35-0:55] "Here's what happened to me/my client..."
[FRAMEWORK - 0:55-1:10] "Introducing the [Name] method"
[STEP 1 - 1:10-1:30] "First step with detailed example"
[STEP 2 - 1:30-1:50] "Second step with detailed example"
[STEP 3 - 1:50-2:10] "Third step with detailed example"
[RESULTS - 2:10-2:30] "Here's what you'll achieve"
[OBJECTION - 2:30-2:45] "Now you might be thinking..."
[REFRAME - 2:45-2:55] "But here's the truth..."
[CTA - 2:55-3:00] "Subscribe and grab the free guide in the description"
\`\`\`

**Script Requirements:**
1. Write EXACTLY what to say - not summaries
2. Use conversational, spoken language
3. Include specific numbers and examples
4. Hook must create pattern interrupt
5. Match word count to duration tier

**BAD Example:** "Video content: Introduction to DeFi"
**GOOD Example:** "[HOOK] Stop scrolling if you still think crypto is just Bitcoin."


## OUTPUT FORMAT
Return a JSON object with this exact structure:
{
  "summary": "Brief overview of the week's content strategy",
  "content_items": [
    {
      "day": "monday",
      "platform": "instagram",
      "content_type": "image",
      "caption": "Full caption text with emojis",
      "hashtags": ["relevant", "hashtags", "here"],
      "reasoning": "Why this content works for the audience",
      "media_prompt": "Description for AI image generation (if applicable)"
    }
  ]
}

## REQUIREMENTS
1. Create varied, engaging content that matches the brand voice and tone
2. Include clear calls-to-action where appropriate
3. Use relevant hashtags (5-10 per post for Instagram, 3-5 for others)
4. Ensure content types match platform capabilities
5. Space out similar content types throughout the week
6. Consider optimal posting for engagement
7. Make captions complete and ready to post (not placeholders)
${productsServices ? '8. Feature the products/services naturally where it makes sense - balance promotional with value content' : ''}
${bannedWords ? '9. NEVER use any of the banned words listed above' : ''}

Generate the full week's content now:`
}

// ================================
// CONTENT REFINEMENT
// ================================

export function buildRefinementPrompt(
  project: Project,
  currentProposal: string,
  userFeedback: string
): string {
  return `You are a expert social media marketing strategist refining a content proposal.

## PROJECT CONTEXT
**Brand/Project:** ${project.name}
${project.brand_voice ? `**Brand Voice:** ${project.brand_voice}` : ''}
${project.target_audience ? `**Target Audience:** ${project.target_audience}` : ''}

## CURRENT PROPOSAL
${currentProposal}

## USER FEEDBACK
${userFeedback}

## TASK
Based on the user's feedback, revise the weekly content proposal. Keep what works, improve what doesn't.

Return the complete revised proposal in the same JSON format:
{
  "summary": "Updated overview reflecting changes",
  "content_items": [...]
}

Revised proposal:`
}

// ================================
// SINGLE CONTENT REGENERATION
// ================================

export function buildRegenerateItemPrompt(
  project: Project,
  item: Partial<ContentItem>,
  feedback?: string
): string {
  return `You are a expert social media content creator.

## PROJECT CONTEXT
**Brand/Project:** ${project.name}
${project.brand_voice ? `**Brand Voice:** ${project.brand_voice}` : ''}
${project.target_audience ? `**Target Audience:** ${project.target_audience}` : ''}

## CONTENT TO REGENERATE
**Platform:** ${item.platform}
**Content Type:** ${item.content_type}
**Scheduled Date:** ${item.scheduled_date}

${item.caption ? `**Original Caption:** ${item.caption}` : ''}
${feedback ? `**User Feedback:** ${feedback}` : ''}

## TASK
Generate a new, improved version of this content piece.

Return JSON:
{
  "caption": "New caption text with appropriate emojis and CTAs",
  "hashtags": ["relevant", "hashtags"],
  "reasoning": "Why this version is better",
  "media_prompt": "Image description if applicable"
}

New content:`
}

// ================================
// AI COMMENT SUGGESTIONS (Advanced)
// ================================

export function buildEngagementCommentPrompt(
  project: Project,
  postContent: string,
  postAuthor: string
): string {
  return `You are a social media engagement specialist.

## BRAND CONTEXT
**Brand:** ${project.name}
${project.brand_voice ? `**Voice:** ${project.brand_voice}` : ''}

## POST TO ENGAGE WITH
**Author:** @${postAuthor}
**Content:** ${postContent}

## TASK
Write a genuine, helpful comment that:
1. Adds value to the conversation
2. Matches the brand voice
3. Is not salesy or spammy
4. Encourages further engagement
5. Is 1-3 sentences max

Return JSON:
{
  "comment": "Your suggested comment",
  "reasoning": "Why this comment works"
}

Suggested comment:`
}
