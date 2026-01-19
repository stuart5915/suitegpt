/**
 * Find Engagement Opportunities API
 * POST - Search X/Twitter and return scored opportunities
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySessionToken } from '@/lib/telegram/validate'
import { searchTweets, buildSearchQuery, SearchedTweet } from '@/lib/twitter'
import { GoogleGenerativeAI } from '@google/generative-ai'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN!
const sessionSecret = process.env.SESSION_SECRET || telegramBotToken
const SESSION_COOKIE_NAME = 'cadence_session'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

interface EngagementOpportunity {
    id: string
    tweetId: string
    tweetUrl: string
    authorHandle: string
    authorName: string
    authorFollowers: number
    authorAvatar?: string
    content: string
    postedAt: string
    likes: number
    retweets: number
    replies: number
    relevanceScore: number
    engagementPotential: 'high' | 'medium' | 'low'
    suggestedAngle: string
    matchedKeywords: string[]
}

function getAuthenticatedUser(request: NextRequest): string | null {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!sessionToken) return null

    const session = verifySessionToken(sessionToken, sessionSecret)
    return session?.telegram_id || null
}

// Calculate relevance score based on multiple factors
function calculateBaseScore(
    tweet: SearchedTweet,
    config: {
        minFollowers: number
        maxFollowers: number
        minEngagement: number
        keywords: string[]
    },
    keywordStats: Map<string, { skipRate: number }>,
    blockedAuthors: Set<string>
): { score: number; matchedKeywords: string[] } {
    let score = 50 // Base score

    const matchedKeywords: string[] = []

    // Check which keywords matched
    const tweetLower = tweet.text.toLowerCase()
    for (const keyword of config.keywords) {
        if (tweetLower.includes(keyword.toLowerCase())) {
            matchedKeywords.push(keyword)
        }
    }

    // Keyword matches (+10 each, max +30)
    score += Math.min(matchedKeywords.length * 10, 30)

    // Author quality - sweet spot: 1k-50k followers (+20 max)
    if (tweet.authorFollowers > 1000 && tweet.authorFollowers < 50000) {
        score += 20
    } else if (tweet.authorFollowers >= 50000) {
        score += 5 // Still decent but lower chance of notice
    }

    // Engagement potential (+15 max)
    // Some engagement but not viral
    if (tweet.likes > 5 && tweet.likes < 500) {
        score += 15
    } else if (tweet.likes >= 500) {
        score -= 5 // Too viral, your reply will get lost
    }

    // Recency (+10 max)
    const ageHours = (Date.now() - new Date(tweet.createdAt).getTime()) / (1000 * 60 * 60)
    if (ageHours < 2) {
        score += 10
    } else if (ageHours < 6) {
        score += 5
    }

    // Reply opportunity (-10 if crowded)
    if (tweet.replies > 50) {
        score -= 10
    } else if (tweet.replies > 100) {
        score -= 20
    }

    // Learning from keyword stats
    for (const keyword of matchedKeywords) {
        const stats = keywordStats.get(keyword)
        if (stats) {
            if (stats.skipRate > 0.7) {
                score -= 15 // Often skipped keyword
            } else if (stats.skipRate < 0.3) {
                score += 10 // Rarely skipped keyword
            }
        }
    }

    // Check if author is soft-blocked
    if (blockedAuthors.has(tweet.authorHandle.toLowerCase())) {
        score -= 50 // Effectively blocks
    }

    return {
        score: Math.max(0, Math.min(100, score)),
        matchedKeywords
    }
}

// Generate AI suggested angle for reply
async function generateSuggestedAngle(tweet: SearchedTweet, brandVoice?: string): Promise<string> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        const prompt = `You're helping craft a reply strategy for a tweet. Based on the tweet content, suggest a brief angle for how to reply that would add value and encourage engagement.

Tweet by @${tweet.authorHandle}:
"${tweet.text}"

${brandVoice ? `Brand voice/expertise: ${brandVoice}` : ''}

Return ONLY a brief suggested angle (1 sentence, max 15 words). Examples:
- "Share your experience with similar tools"
- "Ask a clarifying question about their approach"
- "Offer a complementary perspective on yield strategies"
- "Congratulate and share a relevant tip"

Suggested angle:`

        const result = await model.generateContent(prompt)
        const response = await result.response
        let text = response.text().trim()

        // Clean up
        if (text.startsWith('"') && text.endsWith('"')) {
            text = text.slice(1, -1)
        }

        return text || 'Engage with a thoughtful comment'
    } catch (error) {
        console.error('Error generating suggested angle:', error)
        return 'Engage with a thoughtful comment'
    }
}

export async function POST(request: NextRequest) {
    const telegramId = getAuthenticatedUser(request)

    if (!telegramId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        // 1. Get user's config
        const { data: configData } = await supabase
            .from('engagement_config')
            .select('*')
            .eq('telegram_id', telegramId)
            .single()

        if (!configData || (
            (!configData.keywords || configData.keywords.length === 0) &&
            (!configData.hashtags || configData.hashtags.length === 0) &&
            (!configData.target_accounts || configData.target_accounts.length === 0)
        )) {
            return NextResponse.json({
                error: 'No search criteria configured. Please add keywords, hashtags, or target accounts.',
                needsConfig: true
            }, { status: 400 })
        }

        const config = {
            keywords: configData.keywords || [],
            hashtags: configData.hashtags || [],
            targetAccounts: configData.target_accounts || [],
            minFollowers: configData.min_followers || 100,
            maxFollowers: configData.max_followers || 100000,
            minEngagement: configData.min_engagement || 5,
            maxAgeHours: configData.max_age_hours || 24
        }

        // 2. Get seen tweets to exclude
        const { data: seenTweets } = await supabase
            .from('seen_tweets')
            .select('tweet_id')
            .eq('telegram_id', telegramId)

        const seenTweetIds = seenTweets?.map(t => t.tweet_id) || []

        // Also get tweets from engagement history
        const { data: historyTweets } = await supabase
            .from('engagement_history')
            .select('tweet_id')
            .eq('telegram_id', telegramId)

        const historyTweetIds = historyTweets?.map(t => t.tweet_id) || []
        const excludeTweetIds = [...new Set([...seenTweetIds, ...historyTweetIds])]

        // 3. Get keyword stats for scoring
        const { data: keywordStatsData } = await supabase
            .from('keyword_stats')
            .select('keyword, skip_rate')
            .eq('telegram_id', telegramId)

        const keywordStats = new Map<string, { skipRate: number }>()
        for (const stat of keywordStatsData || []) {
            keywordStats.set(stat.keyword, { skipRate: parseFloat(stat.skip_rate) || 0 })
        }

        // 4. Get blocked authors
        const { data: blockedData } = await supabase
            .from('blocked_authors')
            .select('author_handle')
            .eq('telegram_id', telegramId)
            .gte('skip_count', 2) // 2+ skips = blocked

        const blockedAuthors = new Set<string>(
            blockedData?.map(b => b.author_handle.toLowerCase()) || []
        )

        // 5. Build search query and search Twitter
        const query = buildSearchQuery(config)

        if (!query) {
            return NextResponse.json({
                error: 'No valid search criteria',
                needsConfig: true
            }, { status: 400 })
        }

        // Search for more tweets than we need, we'll filter
        const searchResult = await searchTweets(query, 20, excludeTweetIds)

        if (!searchResult.success) {
            return NextResponse.json({
                error: searchResult.error || 'Failed to search tweets',
                rateLimit: searchResult.rateLimit
            }, { status: 500 })
        }

        // 6. Filter by config criteria
        const maxAgeMs = config.maxAgeHours * 60 * 60 * 1000
        const now = Date.now()

        let filteredTweets = (searchResult.tweets || []).filter(tweet => {
            // Filter by follower count
            if (tweet.authorFollowers < config.minFollowers) return false
            if (tweet.authorFollowers > config.maxFollowers) return false

            // Filter by age
            const tweetAge = now - new Date(tweet.createdAt).getTime()
            if (tweetAge > maxAgeMs) return false

            // Filter by minimum engagement
            if (tweet.likes < config.minEngagement) return false

            // Skip blocked authors
            if (blockedAuthors.has(tweet.authorHandle.toLowerCase())) return false

            return true
        })

        // 7. Score tweets
        const scoredTweets = filteredTweets.map(tweet => {
            const { score, matchedKeywords } = calculateBaseScore(
                tweet,
                config,
                keywordStats,
                blockedAuthors
            )
            return { tweet, score, matchedKeywords }
        })

        // Sort by score descending
        scoredTweets.sort((a, b) => b.score - a.score)

        // Take top 4
        const topTweets = scoredTweets.slice(0, 4)

        // 8. Get user's brand voice for AI suggestions
        const { data: settingsData } = await supabase
            .from('cadence_user_settings')
            .select('brand_voice')
            .eq('telegram_id', telegramId)
            .single()

        const brandVoice = settingsData?.brand_voice || ''

        // 9. Generate AI suggestions for each tweet
        const opportunities: EngagementOpportunity[] = await Promise.all(
            topTweets.map(async ({ tweet, score, matchedKeywords }) => {
                const suggestedAngle = await generateSuggestedAngle(tweet, brandVoice)

                // Determine engagement potential
                let engagementPotential: 'high' | 'medium' | 'low' = 'medium'
                if (score >= 75) engagementPotential = 'high'
                else if (score < 50) engagementPotential = 'low'

                return {
                    id: `opp-${tweet.id}`,
                    tweetId: tweet.id,
                    tweetUrl: tweet.url,
                    authorHandle: tweet.authorHandle,
                    authorName: tweet.authorName,
                    authorFollowers: tweet.authorFollowers,
                    authorAvatar: tweet.authorAvatar,
                    content: tweet.text,
                    postedAt: tweet.createdAt,
                    likes: tweet.likes,
                    retweets: tweet.retweets,
                    replies: tweet.replies,
                    relevanceScore: score,
                    engagementPotential,
                    suggestedAngle,
                    matchedKeywords
                }
            })
        )

        // 10. Mark tweets as seen
        if (opportunities.length > 0) {
            const seenRecords = opportunities.map(opp => ({
                telegram_id: telegramId,
                tweet_id: opp.tweetId
            }))

            await supabase
                .from('seen_tweets')
                .upsert(seenRecords, { onConflict: 'telegram_id,tweet_id' })
        }

        return NextResponse.json({
            success: true,
            opportunities,
            rateLimit: searchResult.rateLimit,
            meta: {
                searched: searchResult.tweets?.length || 0,
                filtered: filteredTweets.length,
                returned: opportunities.length
            }
        })

    } catch (error) {
        console.error('Find engagement error:', error)
        return NextResponse.json({
            error: 'Failed to find engagement opportunities'
        }, { status: 500 })
    }
}
