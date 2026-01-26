import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET - Fetch day images
export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('day_images')
            .select('*')
            .order('date', { ascending: true })

        if (error) throw error

        return NextResponse.json({ dayImages: data || [] })
    } catch (error) {
        console.error('Error fetching day images:', error)
        return NextResponse.json(
            { error: 'Failed to fetch day images' },
            { status: 500 }
        )
    }
}

// POST - Upload image for a day and apply to all posts
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File
        const date = formData.get('date') as string // YYYY-MM-DD format

        if (!file || !date) {
            return NextResponse.json(
                { error: 'File and date are required' },
                { status: 400 }
            )
        }

        console.log('[day-image] Uploading for date:', date)

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Upload to Supabase storage
        const fileName = `day-backgrounds/${date}-${Date.now()}.${file.type.includes('png') ? 'png' : 'jpg'}`

        const uploadResponse = await fetch(
            `${SUPABASE_URL}/storage/v1/object/content/${fileName}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': file.type,
                    'x-upsert': 'true'
                },
                body: buffer
            }
        )

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text()
            console.error('Storage upload failed:', errorText)
            return NextResponse.json(
                { error: 'Failed to upload image' },
                { status: 500 }
            )
        }

        const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/content/${fileName}`
        console.log('[day-image] Uploaded to:', imageUrl)

        // Save to day_images table (upsert by date)
        const supabase = await createClient()

        const { error: upsertError } = await supabase
            .from('day_images')
            .upsert(
                { date, image_url: imageUrl },
                { onConflict: 'date' }
            )

        if (upsertError) {
            console.error('Day image upsert error:', upsertError)
        }

        // Apply to all posts scheduled for this date
        // Get posts for this date
        const startOfDay = `${date}T00:00:00`
        const endOfDay = `${date}T23:59:59`

        const updateResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/scheduled_posts?scheduled_for=gte.${startOfDay}&scheduled_for=lte.${endOfDay}`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ ai_background_url: imageUrl })
            }
        )

        console.log('[day-image] Applied to posts, status:', updateResponse.status)

        return NextResponse.json({
            success: true,
            imageUrl,
            date
        })

    } catch (error) {
        console.error('Error uploading day image:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to upload' },
            { status: 500 }
        )
    }
}

// DELETE - Remove day image
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const date = searchParams.get('date')

        if (!date) {
            return NextResponse.json(
                { error: 'Date is required' },
                { status: 400 }
            )
        }

        const supabase = await createClient()

        // Remove from day_images table
        const { error } = await supabase
            .from('day_images')
            .delete()
            .eq('date', date)

        if (error) throw error

        // Optionally clear from posts too
        const startOfDay = `${date}T00:00:00`
        const endOfDay = `${date}T23:59:59`

        await fetch(
            `${SUPABASE_URL}/rest/v1/scheduled_posts?scheduled_for=gte.${startOfDay}&scheduled_for=lte.${endOfDay}`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ ai_background_url: null })
            }
        )

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Error deleting day image:', error)
        return NextResponse.json(
            { error: 'Failed to delete day image' },
            { status: 500 }
        )
    }
}
