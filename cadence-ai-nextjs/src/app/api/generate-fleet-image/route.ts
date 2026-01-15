import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer'
import path from 'path'
import fs from 'fs'

export async function POST(req: NextRequest) {
    try {
        const { appName, tagline, iconUrl, screenshots = [], buildNumber } = await req.json()

        // Read the template HTML from public folder
        const templatePath = path.join(process.cwd(), 'public', 'ai-fleet-template.html')
        let template = fs.readFileSync(templatePath, 'utf-8')

        // Replace app icon - use img tag if iconUrl provided
        const iconHtml = iconUrl
            ? `<img src="${iconUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 20px;" />`
            : '📱'

        // Replace screenshots - use img tags if provided, otherwise show placeholder
        const screenshot1Html = screenshots[0]
            ? `<img src="${screenshots[0]}" />`
            : '<div style="width:100%;height:100%;background:rgba(255,255,255,0.1);"></div>'
        const screenshot2Html = screenshots[1]
            ? `<img src="${screenshots[1]}" />`
            : '<div style="width:100%;height:100%;background:rgba(255,255,255,0.1);"></div>'
        const screenshot3Html = screenshots[2]
            ? `<img src="${screenshots[2]}" />`
            : '<div style="width:100%;height:100%;background:rgba(255,255,255,0.1);"></div>'

        // Generate build number if not provided (format: 3-digit, e.g., 001, 047)
        const buildNum = buildNumber || String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')

        template = template
            .replace(/\{\{APP_ICON\}\}/g, iconHtml)
            .replace(/\{\{APP_NAME\}\}/g, appName || 'APP NAME')
            .replace(/\{\{APP_TAGLINE\}\}/g, tagline || 'Tagline text placeholder')
            .replace(/\{\{SCREENSHOT_1\}\}/g, screenshot1Html)
            .replace(/\{\{SCREENSHOT_2\}\}/g, screenshot2Html)
            .replace(/\{\{SCREENSHOT_3\}\}/g, screenshot3Html)
            .replace(/\{\{BUILD_NUMBER\}\}/g, buildNum)

        // Launch headless browser
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        })

        const page = await browser.newPage()

        // Set viewport to Twitter card size
        await page.setViewport({ width: 1200, height: 675 })

        // Load the template
        await page.setContent(template, { waitUntil: 'networkidle0' })

        // Wait for fonts and images to load
        await page.evaluateHandle('document.fonts.ready')
        await new Promise(resolve => setTimeout(resolve, 500)) // Extra time for images

        // Take screenshot
        const screenshot = await page.screenshot({
            type: 'png',
            encoding: 'base64'
        })

        await browser.close()

        // Save to public folder
        const outputDir = path.join(process.cwd(), 'public', 'fleet-images')
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true })
        }

        const slug = appName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        const filename = `${slug}-${Date.now()}.png`
        const filepath = path.join(outputDir, filename)

        fs.writeFileSync(filepath, screenshot, 'base64')

        return NextResponse.json({
            imageUrl: `/fleet-images/${filename}`,
            buildNumber: buildNum,
            success: true
        })

    } catch (error) {
        console.error('Error generating image:', error)
        return NextResponse.json(
            { error: 'Failed to generate image' },
            { status: 500 }
        )
    }
}
