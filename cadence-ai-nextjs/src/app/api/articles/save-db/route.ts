import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()

        // Check auth - though in this local dashboard context we might already be authenticated
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const {
            projectId,
            title,
            content,
            imagePrompt,
            imageDataUrl, // Base64 data URL from Gemini
            slug
        } = body

        if (!title || !projectId) {
            return NextResponse.json({ error: 'Title and Project ID are required' }, { status: 400 })
        }

        let publicImageUrl = null

        // Upload Image if present
        if (imageDataUrl) {
            // Convert data URL to buffer
            const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '')
            const buffer = Buffer.from(base64Data, 'base64')

            const timestamp = Date.now()
            const imagePath = `${projectId}/${timestamp}-${slug || 'image'}.png`

            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from('article-images')
                .upload(imagePath, buffer, {
                    contentType: 'image/png',
                    upsert: true
                })

            if (uploadError) {
                console.error('Image upload error:', uploadError)
                // Continue saving article even if image fails? 
                // Let's warn but continue.
            } else {
                const { data: { publicUrl } } = supabase
                    .storage
                    .from('article-images')
                    .getPublicUrl(imagePath)
                publicImageUrl = publicUrl
            }
        }

        // Insert Article
        // Generate slug if not provided
        const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

        const { data: article, error: dbError } = await supabase
            .from('articles')
            .insert({
                project_id: projectId,
                title,
                slug: finalSlug,
                content,
                image_url: publicImageUrl,
                image_prompt: imagePrompt,
                status: 'draft',
                // user_id: user.id // If we add user_id to table later
            })
            .select()
            .single()

        if (dbError) {
            throw dbError
        }

        return NextResponse.json({ success: true, article })

    } catch (error) {
        console.error('Save to DB error:', error)
        return NextResponse.json({ error: 'Failed to save article to database' }, { status: 500 })
    }
}
