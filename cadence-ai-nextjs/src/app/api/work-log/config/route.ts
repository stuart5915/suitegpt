import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Fetch current config
export async function GET() {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('automation_config')
            .select('*')
            .eq('type', 'work_log')
            .single()

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            throw error
        }

        // Return default config if none exists
        const config = data || {
            type: 'work_log',
            enabled: false,
            post_time: '18:00',
            platform: 'x',
            auto_approve: true,
            generate_image: true
        }

        return NextResponse.json({ success: true, config })

    } catch (error) {
        console.error('Error fetching work log config:', error)
        return NextResponse.json({
            error: 'Failed to fetch config',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
}

// POST - Save config
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { enabled, postTime, platform, autoApprove, generateImage } = body

        const supabase = await createClient()

        // Calculate next run time
        let nextRun: string | null = null
        if (enabled && postTime) {
            const now = new Date()
            const [hours, minutes] = postTime.split(':').map(Number)
            const next = new Date()
            next.setHours(hours, minutes, 0, 0)

            if (next <= now) {
                next.setDate(next.getDate() + 1)
            }
            nextRun = next.toISOString()
        }

        // Upsert config
        const { data, error } = await supabase
            .from('automation_config')
            .upsert({
                type: 'work_log',
                enabled,
                post_time: postTime,
                platform,
                auto_approve: autoApprove,
                generate_image: generateImage,
                next_run: nextRun,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'type'
            })
            .select()
            .single()

        if (error) {
            throw error
        }

        return NextResponse.json({
            success: true,
            config: data,
            message: enabled ? 'Work log automation enabled' : 'Work log automation disabled'
        })

    } catch (error) {
        console.error('Error saving work log config:', error)
        return NextResponse.json({
            error: 'Failed to save config',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
}
