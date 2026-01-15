// REMcast Video Reel Generation Edge Function
// Generates 3 video clips from dream scenes using Luma Dream Machine API

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DreamScene {
    scene_number: number
    duration_seconds: number
    visual_description: string
    camera_movement: string
    mood_lighting: string
    key_elements: string[]
}

interface LumaGenerationResponse {
    id: string
    state: string
    video?: {
        url: string
    }
}

const LUMA_API_BASE = 'https://api.lumalabs.ai/dream-machine/v1'

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { dreamId } = await req.json()

        if (!dreamId) {
            throw new Error('dreamId is required')
        }

        console.log('[generate-reel] Starting generation for dream:', dreamId)

        // Initialize Supabase
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Get Luma API key
        const lumaApiKey = Deno.env.get('LUMA_API_KEY')
        if (!lumaApiKey) {
            throw new Error('LUMA_API_KEY not configured')
        }

        // Get dream record
        const { data: dream, error: dreamError } = await supabase
            .from('dreams')
            .select('*')
            .eq('id', dreamId)
            .single()

        if (dreamError || !dream) {
            throw new Error(`Dream not found: ${dreamError?.message}`)
        }

        if (!dream.scenes || dream.scenes.length === 0) {
            throw new Error('Dream has no scenes - run processing first')
        }

        // Check user credits
        const { data: credits, error: creditsError } = await supabase
            .from('user_credits')
            .select('video_credits')
            .eq('user_id', dream.user_id)
            .single()

        if (creditsError) {
            // Create credits row if doesn't exist
            await supabase
                .from('user_credits')
                .insert({ user_id: dream.user_id, video_credits: 3 })
        } else if (credits.video_credits <= 0) {
            throw new Error('NO_CREDITS')
        }

        // Update status to generating
        await updateDreamStatus(supabase, dreamId, 'generating_1', 0)

        const scenes = dream.scenes as DreamScene[]
        const videoUrls: string[] = []

        // ============================================
        // Generate video for each scene
        // ============================================
        for (let i = 0; i < Math.min(scenes.length, 3); i++) {
            const scene = scenes[i]
            const sceneNum = i + 1

            await updateDreamStatus(supabase, dreamId, `generating_${sceneNum}`, Math.round((i / 3) * 100))

            console.log(`[generate-reel] Generating scene ${sceneNum}:`, scene.visual_description.substring(0, 50))

            // Build prompt for Luma
            const prompt = buildScenePrompt(scene, dream.title || 'Dream')

            // Start generation
            const generationId = await startLumaGeneration(lumaApiKey, prompt)

            // Poll for completion (up to 5 minutes per clip)
            const videoUrl = await pollLumaGeneration(lumaApiKey, generationId, 300)

            if (videoUrl) {
                videoUrls.push(videoUrl)
                console.log(`[generate-reel] Scene ${sceneNum} complete:`, videoUrl.substring(0, 50))
            } else {
                console.error(`[generate-reel] Scene ${sceneNum} failed to generate`)
            }
        }

        if (videoUrls.length === 0) {
            throw new Error('Failed to generate any video clips')
        }

        // ============================================
        // For MVP: Use first clip as the reel
        // Future: Stitch clips together with FFmpeg
        // ============================================
        await updateDreamStatus(supabase, dreamId, 'uploading', 90)

        // Download the first video and upload to Supabase Storage
        const finalVideoUrl = videoUrls[0] // MVP: just use first clip
        const reelPath = `${dream.user_id}/${dreamId}/reel.mp4`

        // Download video
        const videoResponse = await fetch(finalVideoUrl)
        const videoBlob = await videoResponse.blob()

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('dream-reels')
            .upload(reelPath, videoBlob, {
                contentType: 'video/mp4',
                upsert: true,
            })

        if (uploadError) {
            console.error('[generate-reel] Upload error:', uploadError)
            throw new Error('Failed to upload video')
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('dream-reels')
            .getPublicUrl(reelPath)

        // Calculate total duration
        const totalDuration = scenes.slice(0, 3).reduce((sum, s) => sum + (s.duration_seconds || 5), 0)

        // Update dream with reel URL
        const { error: updateError } = await supabase
            .from('dreams')
            .update({
                reel_url: urlData.publicUrl,
                reel_duration_seconds: totalDuration,
                generation_status: 'complete',
                generation_progress: 100,
                generated_at: new Date().toISOString(),
            })
            .eq('id', dreamId)

        if (updateError) {
            throw new Error(`Failed to update dream: ${updateError.message}`)
        }

        // Deduct credit
        await supabase.rpc('decrement_video_credits', { user_id_param: dream.user_id })
            .catch(() => {
                // If RPC doesn't exist, do it manually
                return supabase
                    .from('user_credits')
                    .update({
                        video_credits: (credits?.video_credits || 1) - 1,
                        total_generated: (credits?.total_generated || 0) + 1,
                    })
                    .eq('user_id', dream.user_id)
            })

        console.log('[generate-reel] Complete! Reel URL:', urlData.publicUrl)

        return new Response(
            JSON.stringify({
                success: true,
                dreamId,
                reelUrl: urlData.publicUrl,
                duration: totalDuration,
                clipsGenerated: videoUrls.length,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('[generate-reel] Error:', error.message)

        // Update dream with error
        try {
            const { dreamId } = await req.json().catch(() => ({}))
            if (dreamId) {
                const supabase = createClient(
                    Deno.env.get('SUPABASE_URL')!,
                    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
                )
                await supabase
                    .from('dreams')
                    .update({
                        generation_status: 'error',
                        generation_error: error.message,
                    })
                    .eq('id', dreamId)
            }
        } catch { }

        const status = error.message === 'NO_CREDITS' ? 402 : 500

        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status }
        )
    }
})

// ============================================
// Helper Functions
// ============================================

async function updateDreamStatus(supabase: any, dreamId: string, status: string, progress: number) {
    await supabase
        .from('dreams')
        .update({
            generation_status: status,
            generation_progress: progress,
        })
        .eq('id', dreamId)
}

function buildScenePrompt(scene: DreamScene, title: string): string {
    return `Cinematic dream sequence from "${title}". ${scene.visual_description} Style: surreal, ethereal, dreamlike, slightly uncanny valley. Camera movement: ${scene.camera_movement}. Lighting: ${scene.mood_lighting}. Key elements: ${scene.key_elements?.join(', ')}. High quality, cinematic, 24fps.`
}

async function startLumaGeneration(apiKey: string, prompt: string): Promise<string> {
    const response = await fetch(`${LUMA_API_BASE}/generations`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            prompt,
            aspect_ratio: '16:9',
            loop: false,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        console.error('[Luma] Start generation error:', errorText)
        throw new Error(`Luma API error: ${response.status}`)
    }

    const data = await response.json() as LumaGenerationResponse
    console.log('[Luma] Generation started:', data.id)
    return data.id
}

async function pollLumaGeneration(apiKey: string, generationId: string, maxSeconds: number): Promise<string | null> {
    const startTime = Date.now()
    const pollInterval = 5000 // 5 seconds

    while ((Date.now() - startTime) < maxSeconds * 1000) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))

        const response = await fetch(`${LUMA_API_BASE}/generations/${generationId}`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        })

        if (!response.ok) {
            console.error('[Luma] Poll error:', response.status)
            continue
        }

        const data = await response.json() as LumaGenerationResponse
        console.log('[Luma] Generation status:', data.state)

        if (data.state === 'completed' && data.video?.url) {
            return data.video.url
        }

        if (data.state === 'failed') {
            console.error('[Luma] Generation failed')
            return null
        }
    }

    console.error('[Luma] Generation timed out')
    return null
}
