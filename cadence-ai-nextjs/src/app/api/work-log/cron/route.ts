import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60 seconds for this endpoint

export async function GET(request: NextRequest) {
    // Verify cron secret for security (Vercel sends this automatically)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // In production, verify the secret
    if (process.env.NODE_ENV === 'production' && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        console.log('Cron: Unauthorized request')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Cron: Work log automation triggered')

    try {
        const supabase = await createClient()

        // Get work log config from Supabase
        const { data: config, error: configError } = await supabase
            .from('automation_config')
            .select('*')
            .eq('type', 'work_log')
            .single()

        // If no config exists or it's disabled, skip
        if (configError || !config || !config.enabled) {
            console.log('Cron: Work log automation is disabled or not configured')
            return NextResponse.json({
                success: true,
                message: 'Work log automation is disabled or not configured',
                skipped: true
            })
        }

        console.log('Cron: Running work log with config:', config)

        // Call the run endpoint
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000'

        const response = await fetch(`${baseUrl}/api/work-log/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                platform: config.platform || 'x',
                autoApprove: config.auto_approve ?? true,
                generateImage: config.generate_image ?? true
            })
        })

        const result = await response.json()

        console.log('Cron: Work log result:', result)

        // Update last run time
        await supabase
            .from('automation_config')
            .update({
                last_run: new Date().toISOString(),
                last_result: result.success ? 'success' : 'error'
            })
            .eq('type', 'work_log')

        return NextResponse.json({
            success: true,
            message: 'Cron job completed',
            result
        })

    } catch (error) {
        console.error('Cron error:', error)
        return NextResponse.json({
            error: 'Cron job failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
}
