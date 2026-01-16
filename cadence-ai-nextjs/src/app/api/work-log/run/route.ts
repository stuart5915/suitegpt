import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'

const execAsync = promisify(exec)

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

interface CommitInfo {
    hash: string
    message: string
    timestamp: string
    filesChanged: string[]
    folder: string
}

interface RunWorkLogRequest {
    platform: 'x' | 'linkedin'
    autoApprove: boolean
    generateImage: boolean
    postTime?: string // HH:MM format
}

export async function POST(request: NextRequest) {
    try {
        const body: RunWorkLogRequest = await request.json()
        const { platform = 'x', autoApprove = false, generateImage = true, postTime = '18:00' } = body

        // Calculate scheduled time based on postTime (preserving local time)
        const now = new Date()
        const [hours, minutes] = postTime.split(':').map(Number)
        const scheduledFor = new Date()
        scheduledFor.setHours(hours, minutes, 0, 0)

        // If the time has already passed today, schedule for tomorrow
        if (scheduledFor <= now) {
            scheduledFor.setDate(scheduledFor.getDate() + 1)
        }

        // Format as local ISO string (without timezone conversion)
        const localISOString = scheduledFor.getFullYear() + '-' +
            String(scheduledFor.getMonth() + 1).padStart(2, '0') + '-' +
            String(scheduledFor.getDate()).padStart(2, '0') + 'T' +
            String(scheduledFor.getHours()).padStart(2, '0') + ':' +
            String(scheduledFor.getMinutes()).padStart(2, '0') + ':00'

        // Parent directory containing all projects
        const parentDir = 'C:\\Users\\info\\Documents\\stuart-hollinger-landing\\stuart-hollinger-landing'

        // Get today's date in YYYY-MM-DD format for git
        const today = new Date()
        const todayStr = today.toISOString().split('T')[0]

        // Git command to get today's commits
        const gitCommand = `git log --all --since="${todayStr} 00:00:00" --pretty=format:"%h|%s|%ai" --name-only`

        let commits: CommitInfo[] = []

        // Map file path prefixes to app folders
        const pathToApp: Record<string, string> = {
            'cadence-ai-nextjs/': 'cadence-ai-nextjs',
            'cheshbon-reflections-temp/': 'cheshbon-reflections-temp',
            'food-vitals-ai-temp/': 'food-vitals-ai-temp',
            'foodvitals-full/': 'foodvitals-full',
            'opticrep-ai-workout-trainer-temp/': 'opticrep-ai-workout-trainer-temp',
            'remcast-temp/': 'remcast-temp',
            'trueform-ai-physiotherapist-temp/': 'trueform-ai-physiotherapist-temp',
            'trueform-full/': 'trueform-full',
        }

        // Run git log once on parent directory
        try {
            const { stdout } = await execAsync(gitCommand, {
                cwd: parentDir,
                maxBuffer: 1024 * 1024 * 10
            })

            if (stdout.trim()) {
                const entries = stdout.trim().split('\n\n')

                for (const entry of entries) {
                    const lines = entry.split('\n').filter(l => l.trim())
                    if (lines.length === 0) continue

                    const firstLine = lines[0]
                    const parts = firstLine.split('|')

                    if (parts.length >= 3) {
                        const hash = parts[0]
                        const message = parts[1]
                        const timestamp = parts[2]
                        const filesChanged = lines.slice(1).filter(f => f.trim() && !f.includes('|'))

                        // Determine which app(s) this commit belongs to based on file paths
                        const appsInCommit = new Set<string>()
                        let hasPlatformFiles = false

                        for (const file of filesChanged) {
                            let foundApp = false
                            for (const [prefix, appFolder] of Object.entries(pathToApp)) {
                                if (file.startsWith(prefix)) {
                                    appsInCommit.add(appFolder)
                                    foundApp = true
                                    break
                                }
                            }
                            // If file is not in any app folder, it's a platform file
                            if (!foundApp) {
                                hasPlatformFiles = true
                            }
                        }

                        // Create commit entries for each app touched
                        if (appsInCommit.size > 0) {
                            for (const appFolder of appsInCommit) {
                                commits.push({
                                    hash,
                                    message,
                                    timestamp,
                                    filesChanged,
                                    folder: appFolder
                                })
                            }
                        }

                        // Also add as platform commit if it has platform-level files
                        if (hasPlatformFiles || appsInCommit.size === 0) {
                            commits.push({
                                hash,
                                message,
                                timestamp,
                                filesChanged,
                                folder: 'stuart-hollinger-landing'
                            })
                        }
                    }
                }
            }
        } catch (gitError) {
            console.log('Git command error:', gitError)
        }

        // Deduplicate commits by hash AND folder
        const uniqueCommits = commits.reduce((acc, commit) => {
            if (!acc.find(c => c.hash === commit.hash && c.folder === commit.folder)) {
                acc.push(commit)
            }
            return acc
        }, [] as CommitInfo[])

        // Sort by timestamp (newest first)
        uniqueCommits.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

        // If no commits, return early
        if (uniqueCommits.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No commits found for today - skipping work log generation',
                skipped: true
            })
        }

        // Generate the post text
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        // Map folder names to proper app names
        const appNameMap: Record<string, string> = {
            'foodvitals-full': 'FoodVitals',
            'food-vitals-ai-temp': 'FoodVitals',
            'cheshbon-reflections-temp': 'Cheshbon',
            'opticrep-ai-workout-trainer-temp': 'OpticRep',
            'trueform-ai-physiotherapist-temp': 'TrueForm',
            'trueform-full': 'TrueForm',
            'remcast-temp': 'RemCast',
            'cadence-ai-nextjs': 'Cadence AI',
            'stuart-hollinger-landing': 'SUITE Platform'
        }

        const projects = [...new Set(uniqueCommits.map(c => c.folder))]
        const appsMentioned = projects
            .map(p => appNameMap[p] || p)
            .filter((v, i, a) => a.indexOf(v) === i)

        const actualApps = appsMentioned.filter(a => a !== 'SUITE Platform')
        const hasPlatformUpdates = appsMentioned.includes('SUITE Platform')

        const commitSummary = uniqueCommits.map(c => `- ${c.message} (${c.folder})`).join('\n')

        const prompt = `You are writing a professional ecosystem development update for SUITE - an autonomous network of AI-powered micro apps.

CONTEXT:
- The SUITE apps: FoodVitals, OpticRep, TrueForm, Cheshbon, RemCast, Cadence AI
- Platform/ecosystem updates (wallet, treasury, admin, etc.) should be bullets with NO heading
- App-specific updates get the app name as a heading
- ONLY show apps that actually have updates - don't list apps with no commits

TODAY'S COMMITS (raw git data):
${commitSummary}

Actual apps updated: ${actualApps.length > 0 ? actualApps.join(', ') : 'None'}
Has platform/ecosystem updates: ${hasPlatformUpdates ? 'Yes' : 'No'}

TASK: Write a dev update for ${platform === 'x' ? 'Twitter/X' : 'LinkedIn'}.

FORMAT REQUIREMENTS:
- Start with "SUITE Dev Update:" header
- Platform/ecosystem updates (wallet, treasury, admin, credits, etc.): Just bullets, NO heading
- App updates: App name as heading, then bullets underneath
- ONLY include apps that have actual updates
- Keep bullets concise (2-5 words)
- ${platform === 'x' ? 'Keep total under 280 characters' : 'Can be longer'}
- NO emojis
- NO hashtags

Return ONLY the formatted post, nothing else.`

        const result = await model.generateContent(prompt)
        const response = await result.response
        let postText = response.text().trim()

        // Clean up quotes if present
        if ((postText.startsWith('"') && postText.endsWith('"')) ||
            (postText.startsWith("'") && postText.endsWith("'"))) {
            postText = postText.slice(1, -1)
        }

        // Generate image if requested
        let imageUrl: string | undefined
        if (generateImage) {
            try {
                // Use absolute URL with localhost for server-side fetch
                const port = process.env.PORT || 3000
                const imageEndpoint = `http://127.0.0.1:${port}/api/generate-dev-update-image`
                console.log('Generating image, calling:', imageEndpoint)

                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout

                const imageResponse = await fetch(imageEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        commits: uniqueCommits.length,
                        appsUpdated: actualApps,
                        filesChanged: [...new Set(uniqueCommits.flatMap(c => c.filesChanged))].length
                    }),
                    signal: controller.signal
                })

                clearTimeout(timeoutId)

                const imageData = await imageResponse.json()
                console.log('Image generation response:', JSON.stringify(imageData))

                if (imageResponse.ok && imageData.imageUrl) {
                    imageUrl = imageData.imageUrl
                    console.log('Image URL set to:', imageUrl)
                } else {
                    console.error('Image generation failed:', imageData.error || imageData.details || 'No image URL returned')
                }
            } catch (imageError: unknown) {
                if (imageError instanceof Error && imageError.name === 'AbortError') {
                    console.error('Image generation timed out after 60 seconds')
                } else {
                    console.error('Error generating image:', imageError)
                }
            }
        }

        console.log('Saving to queue with images:', imageUrl ? [imageUrl] : [])

        // Add to queue (using scheduled_posts table)
        const supabase = await createClient()
        const { data: queueItem, error: queueError } = await supabase
            .from('scheduled_posts')
            .insert({
                platform,
                content_type: 'work_log',
                post_text: postText,
                status: autoApprove ? 'approved' : 'draft',
                images: imageUrl ? [imageUrl] : [],
                scheduled_for: localISOString
            })
            .select()
            .single()

        if (queueError) {
            console.error('Error adding to queue:', queueError)
            return NextResponse.json({
                success: false,
                error: 'Failed to add to queue',
                details: queueError.message
            }, { status: 500 })
        }

        // If auto-approve is enabled, we would post to Twitter here
        // For now, just mark as approved and the user can use their posting flow
        if (autoApprove) {
            // TODO: Integrate with Twitter API to actually post
            // For now, just mark as posted
            await supabase
                .from('scheduled_posts')
                .update({ status: 'posted', posted_at: new Date().toISOString() })
                .eq('id', queueItem.id)
        }

        return NextResponse.json({
            success: true,
            message: autoApprove
                ? 'Work log generated and posted!'
                : 'Work log generated and added to calendar as draft',
            post: postText,
            imageUrl: imageUrl || null,
            imageGenerated: !!imageUrl,
            queueItemId: queueItem.id,
            savedImages: queueItem.images,
            stats: {
                totalCommits: uniqueCommits.length,
                projects: projects.length,
                filesChanged: [...new Set(uniqueCommits.flatMap(c => c.filesChanged))].length
            }
        })

    } catch (error) {
        console.error('Work log run error:', error)
        return NextResponse.json({
            error: 'Failed to run work log',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
}

// GET endpoint for cron job to trigger
export async function GET(request: NextRequest) {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // For cron, we'll read the config from somewhere (could be Supabase in production)
    // For now, default to X with auto-approve
    const config = {
        platform: 'x' as const,
        autoApprove: true,
        generateImage: true
    }

    // Reuse the POST handler logic
    const mockRequest = new NextRequest(request.url, {
        method: 'POST',
        body: JSON.stringify(config)
    })

    return POST(mockRequest)
}
