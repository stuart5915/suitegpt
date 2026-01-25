import { NextRequest, NextResponse } from 'next/server'

// GitHub repos to track for SUITE ecosystem
const REPOS = [
    'stuart5915/stuart-hollinger-landing', // Main repo with cadence, suitegpt, etc.
]

interface Commit {
    sha: string
    message: string
    date: string
    author: string
    repo: string
}

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams
        const days = parseInt(searchParams.get('days') || '7')

        // Calculate date range
        const sinceDate = new Date()
        sinceDate.setDate(sinceDate.getDate() - days)
        const sinceISO = sinceDate.toISOString()

        const allCommits: Commit[] = []

        // Fetch commits from each repo
        for (const repo of REPOS) {
            try {
                const response = await fetch(
                    `https://api.github.com/repos/${repo}/commits?since=${sinceISO}&per_page=100`,
                    {
                        headers: {
                            'Accept': 'application/vnd.github.v3+json',
                            'User-Agent': 'Cadence-AI',
                            // Add token if available for higher rate limits
                            ...(process.env.GITHUB_TOKEN && {
                                'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
                            })
                        },
                        next: { revalidate: 300 } // Cache for 5 minutes
                    }
                )

                if (response.ok) {
                    const commits = await response.json()
                    for (const commit of commits) {
                        // Skip merge commits and bot commits
                        if (commit.commit.message.startsWith('Merge ')) continue

                        allCommits.push({
                            sha: commit.sha.substring(0, 7),
                            message: commit.commit.message.split('\n')[0], // First line only
                            date: commit.commit.author.date,
                            author: commit.commit.author.name,
                            repo: repo.split('/')[1] // Just repo name
                        })
                    }
                }
            } catch (error) {
                console.error(`Failed to fetch commits from ${repo}:`, error)
            }
        }

        // Sort by date descending
        allCommits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

        // Format for prompt inclusion
        const formattedForPrompt = allCommits.map(c => {
            const date = new Date(c.date).toLocaleDateString()
            return `[${date}] ${c.message}`
        }).join('\n')

        // Group by category (based on commit message patterns)
        const categorized = {
            features: allCommits.filter(c =>
                c.message.toLowerCase().includes('add') ||
                c.message.toLowerCase().includes('implement') ||
                c.message.toLowerCase().includes('create')
            ),
            fixes: allCommits.filter(c =>
                c.message.toLowerCase().includes('fix') ||
                c.message.toLowerCase().includes('bug')
            ),
            improvements: allCommits.filter(c =>
                c.message.toLowerCase().includes('improve') ||
                c.message.toLowerCase().includes('update') ||
                c.message.toLowerCase().includes('enhance')
            ),
            other: allCommits.filter(c => {
                const msg = c.message.toLowerCase()
                return !msg.includes('add') && !msg.includes('implement') &&
                       !msg.includes('create') && !msg.includes('fix') &&
                       !msg.includes('bug') && !msg.includes('improve') &&
                       !msg.includes('update') && !msg.includes('enhance')
            })
        }

        return NextResponse.json({
            success: true,
            days,
            count: allCommits.length,
            commits: allCommits,
            categorized,
            formattedForPrompt,
            summary: {
                total: allCommits.length,
                features: categorized.features.length,
                fixes: categorized.fixes.length,
                improvements: categorized.improvements.length
            }
        })
    } catch (error) {
        console.error('Error fetching GitHub activity:', error)
        return NextResponse.json(
            { error: 'Failed to fetch GitHub activity' },
            { status: 500 }
        )
    }
}
