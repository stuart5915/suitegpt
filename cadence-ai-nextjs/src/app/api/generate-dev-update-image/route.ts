import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer'
import path from 'path'
import fs from 'fs'
import { createClient } from '@/lib/supabase/server'

interface DbApp {
    id: string
    name: string
    slug: string
    icon_url: string | null
    status: 'pending' | 'approved' | 'rejected' | 'featured'
}

// Map folder names to app slugs for matching
const FOLDER_TO_SLUG: Record<string, string> = {
    'foodvitals-full': 'foodvitals',
    'food-vitals-ai-temp': 'foodvitals',
    'cheshbon-reflections-temp': 'cheshbon',
    'opticrep-ai-workout-trainer-temp': 'opticrep',
    'trueform-ai-physiotherapist-temp': 'trueform',
    'trueform-full': 'trueform',
    'remcast-temp': 'remcast',
    'cadence-ai-nextjs': 'cadence',
    'stuart-hollinger-landing': 'suite-platform'
}

// Fallback app info if not in database
const FALLBACK_APPS: Record<string, { name: string; emoji: string; color: string }> = {
    'foodvitals': { name: 'FoodVitals', emoji: '🥗', color: '#22c55e' },
    'opticrep': { name: 'OpticRep', emoji: '💪', color: '#3b82f6' },
    'trueform': { name: 'TrueForm', emoji: '🏃', color: '#f59e0b' },
    'cheshbon': { name: 'Cheshbon', emoji: '📊', color: '#8b5cf6' },
    'remcast': { name: 'RemCast', emoji: '🎙️', color: '#ec4899' },
    'cadence': { name: 'Cadence AI', emoji: '✨', color: '#a855f7' },
    'suite-platform': { name: 'SUITE Platform', emoji: '🔷', color: '#ff9500' },
}

export async function POST(req: NextRequest) {
    console.log('=== generate-dev-update-image API called ===')
    try {
        const { commits, appsUpdated, filesChanged, timestamp } = await req.json()
        console.log('Request data:', { commits, appsUpdated, filesChanged })

        // Fetch real apps from Supabase
        const supabase = await createClient()
        const { data: dbApps } = await supabase
            .from('apps')
            .select('id, name, slug, icon_url, status')
            .in('status', ['pending', 'approved', 'featured'])
            .order('name')

        // Convert appsUpdated (display names) to slugs for matching
        const updatedSlugs = new Set<string>()
        if (appsUpdated) {
            for (const appName of appsUpdated) {
                // Find matching slug
                const slug = Object.entries(FOLDER_TO_SLUG).find(([_, s]) =>
                    FALLBACK_APPS[s]?.name === appName
                )?.[1] || appName.toLowerCase().replace(/\s+/g, '-')
                updatedSlugs.add(slug)
            }
        }

        // Build app list - use DB apps + add any missing fallbacks
        const allApps: Array<{
            slug: string
            name: string
            iconUrl: string | null
            emoji: string
            color: string
            status: 'live' | 'pending' | 'standby'
            wasUpdated: boolean
        }> = []

        // Add apps from database
        if (dbApps) {
            for (const app of dbApps) {
                const fallback = FALLBACK_APPS[app.slug] || { emoji: '📱', color: '#6b7280' }
                const wasUpdated = updatedSlugs.has(app.slug)

                allApps.push({
                    slug: app.slug,
                    name: app.name,
                    iconUrl: app.icon_url,
                    emoji: fallback.emoji,
                    color: fallback.color,
                    status: app.status === 'approved' || app.status === 'featured' ? 'live' : 'pending',
                    wasUpdated
                })
            }
        }

        // Add fallback apps that aren't in DB
        for (const [slug, info] of Object.entries(FALLBACK_APPS)) {
            if (!allApps.find(a => a.slug === slug)) {
                allApps.push({
                    slug,
                    name: info.name,
                    iconUrl: null,
                    emoji: info.emoji,
                    color: info.color,
                    status: 'standby',
                    wasUpdated: updatedSlugs.has(slug)
                })
            }
        }

        // Read the template HTML
        const templatePath = path.join(process.cwd(), 'public', 'dev-update-template.html')
        let template = fs.readFileSync(templatePath, 'utf-8')

        // Generate activity bars
        const generateActivityBar = (isActive: boolean) => {
            const heights = isActive
                ? [40, 70, 55, 85, 60, 45, 90, 50].map(h => `${h}%`)
                : [20, 15, 25, 18, 22, 15, 20, 18].map(h => `${h}%`)

            return heights.map((h, i) =>
                `<div class="activity-bar-segment ${isActive && i > 3 ? 'active' : ''}" style="height: ${h}"></div>`
            ).join('')
        }

        // Generate app cards with real data
        const appCardsHtml = allApps.slice(0, 8).map(app => {
            // Determine display status
            let statusText = '○ STANDBY'
            let statusClass = ''
            let cardClass = ''

            if (app.wasUpdated) {
                statusText = '● UPDATED'
                statusClass = 'updated'
                cardClass = 'active'
            } else if (app.status === 'live') {
                statusText = '◉ LIVE'
                statusClass = 'live'
            } else if (app.status === 'pending') {
                statusText = '◐ PENDING'
                statusClass = 'pending'
            }

            // Use actual icon if available, otherwise emoji with gradient background
            const iconHtml = app.iconUrl
                ? `<img src="${app.iconUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 10px;" />`
                : app.emoji

            return `
                <div class="app-card ${cardClass}">
                    <div class="app-icon-small" style="background: linear-gradient(135deg, ${app.color}, ${app.color}aa);">
                        ${iconHtml}
                    </div>
                    <div class="app-info">
                        <div class="app-name">${app.name}</div>
                        <div class="app-status ${statusClass}">${statusText}</div>
                    </div>
                    <div class="activity-bar">
                        ${generateActivityBar(app.wasUpdated || app.status === 'live')}
                    </div>
                </div>
            `
        }).join('')

        // Format timestamp
        const now = new Date()
        const formattedTimestamp = timestamp || now.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }) + ' • ' + now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        })

        // Count apps that are live or updated
        const activeAppsCount = allApps.filter(a => a.wasUpdated).length || appsUpdated?.length || 0

        // Replace template variables
        template = template
            .replace(/\{\{COMMITS\}\}/g, String(commits || 0))
            .replace(/\{\{APPS_COUNT\}\}/g, String(activeAppsCount))
            .replace(/\{\{FILES\}\}/g, String(filesChanged || 0))
            .replace(/\{\{TIMESTAMP\}\}/g, formattedTimestamp)
            .replace(/\{\{APP_CARDS\}\}/g, appCardsHtml)

        // Launch headless browser
        console.log('Launching puppeteer...')
        let browser
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            })
            console.log('Puppeteer launched successfully')
        } catch (launchError) {
            console.error('Puppeteer launch failed:', launchError)
            throw launchError
        }

        const page = await browser.newPage()

        // Set viewport to Twitter card size
        await page.setViewport({ width: 1200, height: 675 })

        // Load the template
        await page.setContent(template, { waitUntil: 'networkidle0' })

        // Wait for fonts and images to load
        await page.evaluateHandle('document.fonts.ready')
        await new Promise(resolve => setTimeout(resolve, 500))

        // Take screenshot as buffer
        const screenshotBuffer = await page.screenshot({
            type: 'png'
        })

        await browser.close()

        const filename = `dev-update-${Date.now()}.png`

        // Try to upload to Supabase Storage
        try {
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('dev-updates')
                .upload(filename, screenshotBuffer, {
                    contentType: 'image/png',
                    upsert: true
                })

            if (!uploadError && uploadData) {
                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('dev-updates')
                    .getPublicUrl(filename)

                return NextResponse.json({
                    imageUrl: urlData.publicUrl,
                    success: true
                })
            }
        } catch (storageError) {
            console.log('Supabase storage not available, falling back to local:', storageError)
        }

        // Fallback: Save to public folder for local development
        const outputDir = path.join(process.cwd(), 'public', 'dev-updates')
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true })
        }

        const filepath = path.join(outputDir, filename)
        fs.writeFileSync(filepath, screenshotBuffer)

        return NextResponse.json({
            imageUrl: `/dev-updates/${filename}`,
            success: true
        })

    } catch (error) {
        console.error('=== ERROR generating dev update image ===')
        console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error)
        console.error('Error message:', error instanceof Error ? error.message : String(error))
        console.error('Full error:', error)
        return NextResponse.json(
            { error: 'Failed to generate image', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        )
    }
}
