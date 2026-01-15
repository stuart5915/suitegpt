import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Get today's date as the start (not Monday-based)
function getWeekStart(weekOffset: number = 0) {
    const now = new Date()
    now.setDate(now.getDate() + (weekOffset * 7))
    return now.toISOString().split('T')[0]
}

// Get dates for the next 7 days starting from today
function getWeekDates(weekStart: string) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const start = new Date(weekStart)
    const dates = []

    for (let i = 0; i < 7; i++) {
        const date = new Date(start)
        date.setDate(start.getDate() + i)
        dates.push({
            day: dayNames[date.getDay()],
            date: date.toISOString().split('T')[0]
        })
    }

    return dates
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            projectId,
            specificDay,
            // New: contentMix specifies exactly what to generate
            contentMix = [] as { platform: string, contentType: string, includeNews?: boolean }[],
            topicGuidance,
            // Advanced options
            tone,
            cta,
            hookStyle,
            contentLength = 'punchy',
            engagementGoal,
            referencePost,
            // Legacy params for backward compatibility
            postsPerDay = 3,
            platforms: selectedPlatforms,
            weekOffset = 0,
            includeTopical = false,
            topicalPercent = 30,
            videoDuration = 'standard',
        } = body

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
        }

        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single()

        if (projectError || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 })
        }

        const branding = (project.posting_schedule as any) || {}
        const platforms = selectedPlatforms || project.platforms || ['instagram', 'x']
        const platformList = platforms.join(', ')
        const weekStart = getWeekStart(weekOffset)
        const weekDates = getWeekDates(weekStart)

        // ============================================
        // AI MEMORY: Fetch recent posts to avoid repetition
        // ============================================
        let recentTopics: string[] = []
        try {
            const { data: recentPosts } = await supabase
                .from('content_items')
                .select('ai_reasoning, caption')
                .eq('project_id', projectId)
                .order('created_at', { ascending: false })
                .limit(30)

            if (recentPosts && recentPosts.length > 0) {
                recentTopics = recentPosts
                    .map(p => p.ai_reasoning || '')
                    .filter(t => t.length > 0)
                    .slice(0, 20)
            }
        } catch (err) {
            console.error('Failed to fetch recent posts:', err)
        }

        const memoryContext = recentTopics.length > 0
            ? `\n\nIMPORTANT - AVOID REPETITION: You have recently created posts about these topics. DO NOT repeat them:
${recentTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Generate FRESH, NEW content ideas that are different from the above.`
            : ''

        // ============================================
        // TOPICAL RESEARCH: Search for industry news if any posts need it
        // ============================================
        let topicalContext = ''
        const postsWithNews = contentMix.filter((p: any) => p.includeNews)
        const hasNewsContent = postsWithNews.length > 0 || includeTopical // backward compat

        if (hasNewsContent) {
            try {
                // Build search query based on project context
                const industry = project.description || project.name
                const searchQuery = `${industry} news trends this week ${new Date().toLocaleDateString()}`

                // Use Gemini with search grounding to get current news
                const researchModel = genAI.getGenerativeModel({
                    model: 'gemini-2.0-flash',
                    // @ts-ignore - grounding tools may not be in types yet
                    tools: [{
                        googleSearch: {}
                    }]
                })

                const researchPrompt = `Search for the latest news and trends related to: "${industry}"
        
Focus on:
- Breaking news from the past week
- Industry trends and developments
- Noteworthy announcements or events
- Topics that would interest ${project.target_audience || 'the general public'}

Return a concise summary of 3-5 key topics/headlines that a ${project.name} brand could comment on or reference in social media posts.
Format as a numbered list with brief descriptions.`

                const researchResult = await researchModel.generateContent(researchPrompt)
                const newsTopics = researchResult.response.text()

                topicalContext = `

=== CURRENT NEWS & TRENDS (for posts marked as news-focused) ===
${newsTopics}

TOPICAL CONTENT INSTRUCTIONS:
- Posts marked with "includeNews: true" should reference current news/trends from above
- Posts marked with "includeNews: false" should be EVERGREEN (brand-focused, timeless)
- For news posts: tie current events back to your brand's expertise
- Use phrases like "This week...", "In light of recent...", "Industry update:"
`
            } catch (err) {
                console.error('Failed to fetch topical news:', err)
                // Continue without topical content if search fails
            }
        }

        const bannedWordsContext = branding.banned_words
            ? `\n\nBANNED WORDS - NEVER USE THESE: ${branding.banned_words}\nDo NOT use any of the words listed above in any post. Find alternative ways to express similar concepts.`
            : ''

        // Build advanced options context
        const toneLabels: Record<string, string> = {
            professional: 'Professional and polished - use industry terminology, be authoritative',
            casual: 'Casual and conversational - use everyday language, be relatable and friendly',
            funny: 'Funny and witty - use humor, puns, and playful language',
            inspirational: 'Inspirational and motivational - use uplifting language, share encouragement',
            educational: 'Educational and informative - teach concepts, provide valuable insights',
            promotional: 'Promotional and sales-focused - highlight benefits, create urgency',
        }
        const ctaLabels: Record<string, string> = {
            comment: 'Drive comments - ask questions, start discussions, request opinions',
            share: 'Encourage sharing - create shareable quotes, relatable content, viral hooks',
            link: 'Get link clicks - tease valuable content, create curiosity gaps',
            buy: 'Drive purchases - highlight benefits, create urgency, show social proof',
            signup: 'Get signups - emphasize value proposition, reduce friction',
            save: 'Encourage saves - provide reference-worthy tips, lists, or guides',
        }
        const hookLabels: Record<string, string> = {
            'how-to': 'Use "How to..." format - step-by-step guides, tutorials, actionable advice',
            'reasons': 'Use "X reasons why..." format - listicle style with clear numbered points',
            'truth': 'Use "The truth about..." format - myth-busting, contrarian takes, revelations',
            'stop': 'Use "Stop doing X..." format - identify mistakes, provide corrections',
            'secret': 'Use "What nobody tells you about..." format - insider knowledge, hidden insights',
            'mistake': 'Use "The #1 mistake..." format - identify common errors and solutions',
        }
        const goalLabels: Record<string, string> = {
            reach: 'Optimize for REACH - use trending topics, broad appeal, shareable format',
            engagement: 'Optimize for ENGAGEMENT - ask questions, create debate, encourage responses',
            clicks: 'Optimize for CLICKS - use curiosity gaps, tease without revealing',
            saves: 'Optimize for SAVES - create reference guides, checklists, valuable tips',
        }

        let advancedContext = ''
        if (tone || cta || hookStyle || engagementGoal || referencePost || contentLength) {
            advancedContext = '\n\n=== ADVANCED CONTENT INSTRUCTIONS ===\n'
            if (tone && toneLabels[tone]) {
                advancedContext += `TONE: ${toneLabels[tone]}\n`
            }
            if (cta && ctaLabels[cta]) {
                advancedContext += `CALL-TO-ACTION: ${ctaLabels[cta]}\n`
            }
            if (hookStyle && hookLabels[hookStyle]) {
                advancedContext += `HOOK STYLE: ${hookLabels[hookStyle]}\n`
            }
            if (contentLength) {
                advancedContext += `CONTENT LENGTH: ${contentLength === 'punchy'
                    ? 'Keep it SHORT and PUNCHY - concise, impactful, no fluff'
                    : 'Make it DETAILED and in-depth - comprehensive, thorough explanations'}\n`
            }
            if (engagementGoal && goalLabels[engagementGoal]) {
                advancedContext += `GOAL: ${goalLabels[engagementGoal]}\n`
            }
            if (referencePost) {
                advancedContext += `\nREFERENCE POST (emulate this style):\n"${referencePost}"\nMatch the tone, structure, and style of this example.\n`
            }
        }

        // Build video duration instruction
        const videoDurationMap: Record<string, string> = {
            quick: 'QUICK (15 seconds): 4 frames, ~30 words. Ultra-punchy single idea. Use HOOK → POINT → PROOF → CTA structure.',
            standard: 'STANDARD (30-60 seconds): 6-8 frames, ~100-150 words. Problem-solution arc. Use HOOK → PROBLEM → TEASE → SOLUTION 1-3 → RESULT → CTA structure.',
            extended: 'EXTENDED (90-180 seconds): 12+ frames, ~300-500 words. Full story with examples. Use HOOK → CREDIBILITY → PROBLEM → STORY → FRAMEWORK → STEP 1-3 → RESULTS → OBJECTION → REFRAME → CTA structure.'
        }
        const videoDurationInstruction = `
VIDEO DURATION TIER: ${videoDuration.toUpperCase()}
${videoDurationMap[videoDuration] || videoDurationMap.standard}
For ALL video content types (video_script, short, reel), use this duration tier for script length.
`

        const context = `
PROJECT: ${project.name}
DESCRIPTION: ${project.description || 'N/A'}
MISSION: ${branding.mission_statement || 'N/A'}
UNIQUE VALUE: ${branding.unique_value_prop || 'N/A'}
BRAND VOICE: ${project.brand_voice || 'Professional and engaging'}
TARGET AUDIENCE: ${project.target_audience || 'General audience'}
CONTENT PILLARS: ${project.content_pillars?.join(', ') || 'General content'}
KEY MESSAGES: ${branding.key_messages?.join(', ') || 'N/A'}
HASHTAG STRATEGY: ${branding.hashtag_strategy || 'Use relevant industry hashtags'}
CONTENT GUIDELINES: ${branding.content_rules || 'Keep content appropriate and on-brand'}
PLATFORMS: ${platformList}
${memoryContext}
${topicalContext}
${bannedWordsContext}
${advancedContext}
${videoDurationInstruction}
`.trim()

        // Build prompt for single day or full week
        const daysToGenerate = specificDay
            ? weekDates.filter(d => d.day === specificDay)
            : weekDates

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        // Build content requirements based on contentMix or legacy params
        const useContentMix = contentMix.length > 0
        const availableContentTypes = ['text', 'image', 'video_script', 'carousel', 'short', 'thread', 'poll']

        // Map content types to AI-friendly names
        const contentTypeLabels: Record<string, string> = {
            'text': 'Text Post',
            'image': 'Image Post',
            'video_script': 'Video Script',
            'carousel': 'Carousel Post',
            'short': 'Short-form Video (Reel/TikTok)',
            'thread': 'Thread',
            'poll': 'Poll'
        }

        let contentRequirements = ''
        if (useContentMix) {
            contentRequirements = `
SPECIFIC CONTENT TO GENERATE (create exactly these posts FOR EACH DAY):
${contentMix.map((item: any, idx: number) => {
                const label = contentTypeLabels[item.contentType] || item.contentType
                const newsTag = item.includeNews ? ' [INCLUDE CURRENT NEWS/TRENDS]' : ' [EVERGREEN - timeless content]'
                return `${idx + 1}. ${item.platform.toUpperCase()} - ${label}${newsTag}`
            }).join('\n')}

Total posts per day: ${contentMix.length}
`
        } else {
            contentRequirements = `
- Create EXACTLY ${postsPerDay} posts per day
- Use these platforms: ${platformList}
- Distribute posts across platforms for variety
${includeTopical ? '- Mix topical (30%) and evergreen (70%) content as instructed above' : ''}
`
        }

        // Add topic guidance if provided
        const topicContext = topicGuidance
            ? `\n\nTOPIC FOCUS: The user wants content about: "${topicGuidance}"\nMake sure the generated content relates to or incorporates this topic.\n`
            : ''

        const prompt = `You are a social media content strategist. Create social media content for this brand:

${context}
${topicContext}
Generate content for these days:
${daysToGenerate.map(d => `- ${d.day} (${d.date})`).join('\n')}

REQUIREMENTS:
${contentRequirements}
For each post include:
- platform: the social media platform
- contentType: one of [text, image, video_script, carousel, short, thread, poll]
- title: a short descriptive title (3-6 words) that summarizes the topic
- content: the actual post text (appropriate length for the platform)
- suggestedTime: optimal posting time in 24h format spread throughout the day (e.g., "09:00", "12:30", "18:00")
- hashtags: array of 3-7 relevant hashtags (without #)
- notes: ${hasNewsContent ? 'mark as "topical" or "evergreen", plus any creator notes' : 'any brief notes for the content creator'}

Create varied content that matches the brand voice and addresses the target audience.

Return ONLY valid JSON:
{
  "days": [
    {
      "day": "Monday",
      "date": "2024-01-15",
      "posts": [
        {
          "platform": "instagram",
          "contentType": "image",
          "title": "Example Title",
          "content": "Post content here...",
          "suggestedTime": "10:00",
          "hashtags": ["hashtag1", "hashtag2"],
          "notes": "evergreen - brand focus"
        }
      ]
    }
  ]
}

Generate the content now:`

        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()

        let weekContent
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                weekContent = JSON.parse(jsonMatch[0])
            } else {
                throw new Error('No JSON found')
            }
        } catch {
            console.error('Failed to parse AI response:', text)
            return NextResponse.json({ error: 'Failed to parse generated content' }, { status: 500 })
        }

        // Create or get weekly plan
        let weeklyPlanId: string
        const { data: existingPlan } = await supabase
            .from('weekly_plans')
            .select('id')
            .eq('project_id', projectId)
            .eq('week_start', weekStart)
            .single()

        if (existingPlan) {
            weeklyPlanId = existingPlan.id

            if (specificDay) {
                const dayDate = weekDates.find(d => d.day === specificDay)?.date
                if (dayDate) {
                    await supabase
                        .from('content_items')
                        .delete()
                        .eq('weekly_plan_id', weeklyPlanId)
                        .eq('scheduled_date', dayDate)
                }
            } else {
                await supabase
                    .from('content_items')
                    .delete()
                    .eq('weekly_plan_id', weeklyPlanId)
            }
        } else {
            const { data: newPlan, error: planError } = await supabase
                .from('weekly_plans')
                .insert({
                    project_id: projectId,
                    week_start: weekStart,
                    status: 'draft',
                })
                .select('id')
                .single()

            if (planError || !newPlan) {
                console.error('Failed to create weekly plan:', planError)
                return NextResponse.json({ error: 'Failed to create weekly plan' }, { status: 500 })
            }
            weeklyPlanId = newPlan.id
        }

        // Map content type to database enum
        const mapContentType = (type: string) => {
            const mapping: Record<string, string> = {
                'text': 'text',
                'image': 'image',
                'video': 'video_script',
                'carousel': 'carousel',
            }
            return mapping[type] || 'text'
        }
        // Build generation metadata object
        const generationMeta = {
            tone: tone || null,
            cta: cta || null,
            hookStyle: hookStyle || null,
            contentLength: contentLength || null,
            engagementGoal: engagementGoal || null,
            hasNews: contentMix.some((p: any) => p.includeNews) || false,
            videoDuration: videoDuration || null,
        }

        // Save content items
        const contentItems = weekContent.days.flatMap((day: any) =>
            (day.posts || []).map((post: any) => ({
                weekly_plan_id: weeklyPlanId,
                project_id: projectId,
                scheduled_date: day.date,
                scheduled_time: post.suggestedTime ? `${post.suggestedTime}:00` : '10:00:00',
                platform: post.platform,
                content_type: mapContentType(post.contentType),
                caption: post.content,
                hashtags: post.hashtags || [],
                status: 'draft',
                ai_reasoning: post.title,
                media_prompt: JSON.stringify({
                    notes: post.notes,
                    generationMeta,
                }),
            }))
        )

        if (contentItems.length > 0) {
            const { error: insertError } = await supabase
                .from('content_items')
                .insert(contentItems)

            if (insertError) {
                console.error('Failed to save content:', insertError)
                return NextResponse.json({ error: 'Failed to save content' }, { status: 500 })
            }
        }

        // Fetch and return all content for the week
        const { data: savedContent } = await supabase
            .from('content_items')
            .select('*')
            .eq('weekly_plan_id', weeklyPlanId)
            .order('scheduled_date')
            .order('scheduled_time')

        // Group by day
        const dayMap = new Map<string, any[]>()
        weekDates.forEach(d => dayMap.set(d.date, []))

        savedContent?.forEach(item => {
            const existing = dayMap.get(item.scheduled_date) || []
            existing.push({
                id: item.id,
                platform: item.platform,
                contentType: item.content_type,
                title: item.ai_reasoning || 'Post',
                content: item.caption,
                suggestedTime: item.scheduled_time?.slice(0, 5) || '10:00',
                hashtags: item.hashtags || [],
                notes: item.media_prompt,
                status: item.status === 'approved' ? 'approved' :
                    item.status === 'scheduled' ? 'approved' : 'pending',
                projectId: item.project_id,
            })
            dayMap.set(item.scheduled_date, existing)
        })

        const days = weekDates.map(d => ({
            day: d.day,
            date: d.date,
            posts: dayMap.get(d.date) || [],
        }))

        return NextResponse.json({
            weekOf: weekStart,
            weeklyPlanId,
            projectId,
            projectName: project.name,
            days,
            topicalEnabled: includeTopical,
        })
    } catch (error: any) {
        console.error('Generate week error:', error)
        return NextResponse.json({ error: error.message || 'Failed to generate' }, { status: 500 })
    }
}
