import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { GoogleGenerativeAI } from '@google/generative-ai'

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

interface WorkLogRequest {
    scopeMovingForward?: string
    generatePost?: boolean
    platform?: 'x' | 'linkedin'
}

export async function POST(request: NextRequest) {
    try {
        const body: WorkLogRequest = await request.json()
        const { scopeMovingForward, generatePost = false, platform = 'x' } = body

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

        // Deduplicate commits by hash AND folder (same commit can appear under multiple categories)
        const uniqueCommits = commits.reduce((acc, commit) => {
            if (!acc.find(c => c.hash === commit.hash && c.folder === commit.folder)) {
                acc.push(commit)
            }
            return acc
        }, [] as CommitInfo[])

        // Sort by timestamp (newest first)
        uniqueCommits.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

        // Summarize work done
        const summary = {
            totalCommits: uniqueCommits.length,
            commits: uniqueCommits,
            projects: [...new Set(uniqueCommits.map(c => c.folder))],
            filesChanged: [...new Set(uniqueCommits.flatMap(c => c.filesChanged))].length
        }

        // Generate post if requested
        if (generatePost) {
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

            const hasCommits = uniqueCommits.length > 0
            const commitSummary = hasCommits
                ? uniqueCommits.map(c => `- ${c.message} (${c.folder})`).join('\n')
                : 'No commits recorded today'

            // Map folder names to proper app names for ecosystem promotion
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

            // Get proper app names from projects
            const appsMentioned = summary.projects
                .map(p => appNameMap[p] || p)
                .filter((v, i, a) => a.indexOf(v) === i) // unique

            // Separate SUITE Platform commits from app-specific commits
            const actualApps = appsMentioned.filter(a => a !== 'SUITE Platform')
            const hasPlatformUpdates = appsMentioned.includes('SUITE Platform')

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

${scopeMovingForward ? `UPCOMING:\n${scopeMovingForward}` : ''}

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

GOOD EXAMPLES:

"SUITE Dev Update:

• Mobile wallet connect
• API costs -80%
• Treasury UI refresh

FoodVitals:
• Nutrition scan optimized

Cadence AI:
• Work log generator"

"SUITE Update:

• Discord OAuth added
• PWA fixes

OpticRep:
• Form detection v2"

"SUITE shipping:

• Admin dashboard upgrade
• Credit system live

TrueForm:
• AI coaching enhanced"

Return ONLY the formatted post, nothing else.`

            const result = await model.generateContent(prompt)
            const response = await result.response
            let postText = response.text().trim()

            // Clean up quotes if present
            if ((postText.startsWith('"') && postText.endsWith('"')) ||
                (postText.startsWith("'") && postText.endsWith("'"))) {
                postText = postText.slice(1, -1)
            }

            return NextResponse.json({
                success: true,
                summary,
                generatedPost: postText,
                platform,
                characterCount: postText.length,
                withinLimit: platform === 'x' ? postText.length <= 280 : postText.length <= 2000
            })
        }

        return NextResponse.json({
            success: true,
            summary,
            message: uniqueCommits.length === 0
                ? 'No commits found for today'
                : `Found ${uniqueCommits.length} commits across ${summary.projects.length} projects`
        })

    } catch (error) {
        console.error('Work log error:', error)
        return NextResponse.json({
            error: 'Failed to analyze work log',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
}

// GET endpoint to just fetch commits without generating
export async function GET() {
    try {
        const parentDir = 'C:\\Users\\info\\Documents\\stuart-hollinger-landing\\stuart-hollinger-landing'

        // Get today's date for git
        const today = new Date()
        const todayStr = today.toISOString().split('T')[0]
        const gitCommand = `git log --all --since="${todayStr} 00:00:00" --pretty=format:"%h|%s|%ai" --name-only`

        let commits: CommitInfo[] = []

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
                        commits.push({
                            hash: parts[0],
                            message: parts[1],
                            timestamp: parts[2],
                            filesChanged: lines.slice(1).filter(f => f.trim() && !f.includes('|')),
                            folder: 'stuart-hollinger-landing'
                        })
                    }
                }
            }
        } catch {
            // Continue
        }

        // Deduplicate by hash AND folder, then sort
        const uniqueCommits = commits.reduce((acc, commit) => {
            if (!acc.find(c => c.hash === commit.hash && c.folder === commit.folder)) {
                acc.push(commit)
            }
            return acc
        }, [] as CommitInfo[])

        uniqueCommits.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

        return NextResponse.json({
            success: true,
            summary: {
                totalCommits: uniqueCommits.length,
                commits: uniqueCommits,
                projects: [...new Set(uniqueCommits.map(c => c.folder))],
                filesChanged: [...new Set(uniqueCommits.flatMap(c => c.filesChanged))].length
            }
        })

    } catch (error) {
        console.error('Work log GET error:', error)
        return NextResponse.json({ error: 'Failed to fetch commits' }, { status: 500 })
    }
}
