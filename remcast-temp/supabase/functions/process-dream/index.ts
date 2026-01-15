// REMcast Dream Processing Edge Function
// Transcribes audio with Whisper and extracts scenes with Gemini

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

interface GeminiResponse {
    dream_title: string
    overall_mood: string
    scenes: DreamScene[]
}

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

        console.log('[process-dream] Processing dream:', dreamId)

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Get dream record
        const { data: dream, error: dreamError } = await supabase
            .from('dreams')
            .select('*')
            .eq('id', dreamId)
            .single()

        if (dreamError || !dream) {
            throw new Error(`Dream not found: ${dreamError?.message}`)
        }

        if (!dream.audio_url) {
            throw new Error('Dream has no audio URL')
        }

        console.log('[process-dream] Found dream with audio:', dream.audio_url)

        // Update status to processing
        await supabase
            .from('dreams')
            .update({ processing_status: 'transcribing' })
            .eq('id', dreamId)

        // ============================================
        // STEP 1: Transcribe with Gemini (FREE!)
        // ============================================
        const geminiKey = Deno.env.get('GEMINI_API_KEY')
        if (!geminiKey) {
            throw new Error('GEMINI_API_KEY not configured')
        }

        // Download audio file
        // Extract storage path from the audio URL
        // URL format: https://xxx.supabase.co/storage/v1/object/public/dream-audio/user-id/timestamp.m4a
        const audioUrl = dream.audio_url
        const pathMatch = audioUrl.match(/\/dream-audio\/(.+)$/)
        if (!pathMatch) {
            throw new Error(`Invalid audio URL format: ${audioUrl}`)
        }
        const storagePath = pathMatch[1]

        console.log('[process-dream] Downloading audio from storage path:', storagePath)

        // Use Supabase Storage API with service role key (bypasses RLS)
        const { data: audioData, error: downloadError } = await supabase.storage
            .from('dream-audio')
            .download(storagePath)

        if (downloadError || !audioData) {
            console.error('[process-dream] Storage download error:', downloadError)
            throw new Error(`Failed to download audio: ${downloadError?.message || 'Unknown error'}`)
        }

        const audioBlob = audioData
        console.log('[process-dream] Audio file size:', audioBlob.size, 'bytes')

        // Check audio duration (minimum ~3 seconds)
        // ~128kbps = 16KB/sec, so 3 seconds = ~48KB minimum
        // Lowered to 10KB to be more lenient
        if (audioBlob.size < 10000) {
            throw new Error(`AUDIO_TOO_SHORT: File size ${audioBlob.size} bytes is too small (min 10KB)`)
        }

        console.log('[process-dream] Sending to Gemini for transcription...')

        // Convert audio to base64 for Gemini (chunked to avoid stack overflow)
        const audioArrayBuffer = await audioBlob.arrayBuffer()
        const bytes = new Uint8Array(audioArrayBuffer)
        let binaryString = ''
        const chunkSize = 8192 // Process in 8KB chunks
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
            binaryString += String.fromCharCode.apply(null, Array.from(chunk))
        }
        const audioBase64 = btoa(binaryString)

        // Use Gemini to transcribe audio
        const transcriptionResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                inline_data: {
                                    mime_type: 'audio/m4a',
                                    data: audioBase64
                                }
                            },
                            {
                                text: 'Transcribe this audio recording of someone describing their dream. Return ONLY the transcription text, nothing else. If the audio is unclear, do your best to transcribe what you can hear.'
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 2000,
                    }
                })
            }
        )

        if (!transcriptionResponse.ok) {
            const errorText = await transcriptionResponse.text()
            console.error('[process-dream] Gemini transcription error:', errorText)
            throw new Error(`Gemini transcription failed: ${transcriptionResponse.status}`)
        }

        const transcriptionResult = await transcriptionResponse.json()
        const transcript = transcriptionResult.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

        if (!transcript) {
            throw new Error('No transcription returned from Gemini')
        }

        console.log('[process-dream] Transcript:', transcript.substring(0, 100) + '...')

        // Update with transcript
        await supabase
            .from('dreams')
            .update({
                transcript,
                processing_status: 'analyzing'
            })
            .eq('id', dreamId)


        // ============================================
        // STEP 2: Extract scenes with Gemini
        // ============================================
        // geminiKey already declared above

        const geminiPrompt = `You are a dream cinematographer. Given this dream transcript, extract exactly 3 visual scenes that could be turned into a short cinematic video (15-30 seconds total).

For each scene, provide:
- scene_number (1, 2, or 3)
- duration_seconds (5-10 each)
- visual_description (detailed, cinematic, 2-3 sentences)
- camera_movement (e.g., "slow zoom in", "pan left", "static wide shot")
- mood_lighting (e.g., "ethereal blue fog", "harsh red shadows")
- key_elements (array of 3-5 important objects/characters)

Also provide:
- dream_title (creative, evocative, 3-5 words)
- overall_mood (one of: peaceful, chaotic, surreal, prophetic, nightmare, lucid, nostalgic, adventurous)

Return ONLY valid JSON, no markdown or extra text.

Dream transcript:
"""
${transcript}
"""`

        console.log('[process-dream] Sending to Gemini API...')

        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: geminiPrompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2000,
                    }
                })
            }
        )

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text()
            console.error('[process-dream] Gemini error:', errorText)
            throw new Error(`Gemini API failed: ${geminiResponse.status}`)
        }

        const geminiResult = await geminiResponse.json()
        const geminiText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text

        if (!geminiText) {
            throw new Error('No response from Gemini')
        }

        console.log('[process-dream] Gemini response:', geminiText.substring(0, 200))

        // Parse JSON from Gemini response (handle potential markdown code blocks)
        let cleanJson = geminiText.trim()
        if (cleanJson.startsWith('```json')) {
            cleanJson = cleanJson.slice(7)
        }
        if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.slice(3)
        }
        if (cleanJson.endsWith('```')) {
            cleanJson = cleanJson.slice(0, -3)
        }
        cleanJson = cleanJson.trim()

        const sceneData: GeminiResponse = JSON.parse(cleanJson)

        console.log('[process-dream] Parsed scenes:', sceneData.dream_title, sceneData.scenes.length)

        // ============================================
        // STEP 3: Update dream record with results
        // ============================================
        const { error: updateError } = await supabase
            .from('dreams')
            .update({
                transcript,
                title: sceneData.dream_title,
                mood: sceneData.overall_mood,
                scenes: sceneData.scenes,
                processing_status: 'complete',
                processed_at: new Date().toISOString(),
            })
            .eq('id', dreamId)

        if (updateError) {
            throw new Error(`Failed to update dream: ${updateError.message}`)
        }

        console.log('[process-dream] Successfully processed dream:', dreamId)

        return new Response(
            JSON.stringify({
                success: true,
                dreamId,
                title: sceneData.dream_title,
                mood: sceneData.overall_mood,
                scenesCount: sceneData.scenes.length,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error) {
        console.error('[process-dream] Error:', error.message)

        // Try to update dream with error status
        try {
            const { dreamId } = await req.json().catch(() => ({}))
            if (dreamId) {
                const supabaseUrl = Deno.env.get('SUPABASE_URL')!
                const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
                const supabase = createClient(supabaseUrl, supabaseServiceKey)

                await supabase
                    .from('dreams')
                    .update({
                        processing_status: 'error',
                        processing_error: error.message,
                    })
                    .eq('id', dreamId)
            }
        } catch (e) {
            // Ignore update errors
        }

        return new Response(
            JSON.stringify({
                success: false,
                error: error.message,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: error.message === 'AUDIO_TOO_SHORT' ? 400 : 500,
            }
        )
    }
})
