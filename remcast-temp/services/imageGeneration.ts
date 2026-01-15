/**
 * Image Generation Service
 * Uses Gemini Imagen to generate dream visualization images
 */
import Constants from 'expo-constants';
import { supabase } from './supabase';

const GEMINI_API_KEY = Constants.expoConfig?.extra?.EXPO_PUBLIC_GEMINI_API_KEY ||
    process.env.EXPO_PUBLIC_GEMINI_API_KEY;

export interface ImageGenerationResult {
    success: boolean;
    imageUrl?: string;
    error?: string;
}

/**
 * Generate a dream visualization image using Gemini
 * Uses the Gemini API to create a surreal dream image based on the transcript
 */
export async function generateDreamImage(
    dreamId: string,
    transcript: string,
    mood?: string | null
): Promise<ImageGenerationResult> {
    try {
        if (!GEMINI_API_KEY) {
            console.error('[ImageGen] No Gemini API key found');
            return { success: false, error: 'API key not configured' };
        }

        console.log('[ImageGen] Generating dream image...');

        // Create a rich prompt for the dream visualization
        const moodDesc = mood ? `The overall mood is ${mood}.` : '';
        const prompt = `Create a surreal, dreamlike visualization of this dream: "${transcript}". ${moodDesc} 
Style: ethereal, soft lighting, dreamy atmosphere, painterly quality, magical realism. 
The image should evoke the feeling of being inside a dream - slightly otherworldly and emotionally resonant.
Do not include any text or words in the image.`;

        // Use Gemini's image generation endpoint (Imagen 3)
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Generate an image: ${prompt}`,
                        }]
                    }],
                    generationConfig: {
                        responseModalities: ['TEXT', 'IMAGE'],
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[ImageGen] API error:', errorText);

            // Fallback: If Imagen isn't available, use a placeholder approach
            // We'll create a text-based visualization request
            return await generateImageFallback(dreamId, transcript, mood);
        }

        const result = await response.json();

        // Extract image from response
        const parts = result.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));

        if (imagePart?.inlineData?.data) {
            // Upload the base64 image to Supabase storage
            const base64Data = imagePart.inlineData.data;
            const mimeType = imagePart.inlineData.mimeType || 'image/png';

            const imageUrl = await uploadImageToStorage(dreamId, base64Data, mimeType);

            if (imageUrl) {
                // Update the dream record with the image URL
                await supabase
                    .from('dreams')
                    .update({ dream_image_url: imageUrl })
                    .eq('id', dreamId);

                return { success: true, imageUrl };
            }
        }

        // If no image in response, use fallback
        return await generateImageFallback(dreamId, transcript, mood);

    } catch (error: any) {
        console.error('[ImageGen] Error generating image:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Fallback image generation - returns a placeholder or gradient
 * In a production app, you'd use a dedicated image API like DALL-E or Replicate
 */
async function generateImageFallback(
    dreamId: string,
    transcript: string,
    mood?: string | null
): Promise<ImageGenerationResult> {
    console.log('[ImageGen] Using fallback - Imagen not available');

    // For now, we'll use a gradient placeholder based on mood
    // In production, integrate with DALL-E, Replicate, or another image API
    const moodColors: Record<string, string[]> = {
        peaceful: ['#667eea', '#764ba2'],
        chaotic: ['#f093fb', '#f5576c'],
        surreal: ['#4facfe', '#00f2fe'],
        prophetic: ['#fa709a', '#fee140'],
        nightmare: ['#434343', '#000000'],
        lucid: ['#11998e', '#38ef7d'],
        nostalgic: ['#ee9ca7', '#ffdde1'],
        adventurous: ['#ff9a9e', '#fad0c4'],
    };

    // Return a helpful message
    return {
        success: false,
        error: 'Image generation requires Imagen access. Enable it in your Google AI Studio.'
    };
}

/**
 * Upload base64 image to Supabase Storage
 * Uses Uint8Array directly - React Native doesn't support Blob from ArrayBuffer
 */
async function uploadImageToStorage(
    dreamId: string,
    base64Data: string,
    mimeType: string
): Promise<string | null> {
    try {
        // Get current user for RLS - folder must be user_id
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error('[ImageGen] No authenticated user');
            return null;
        }

        // Convert base64 to Uint8Array (React Native compatible)
        const byteCharacters = atob(base64Data);
        const byteArray = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteArray[i] = byteCharacters.charCodeAt(i);
        }

        // Determine file extension
        const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
        // Use user_id as folder (required by RLS policy), dreamId in filename
        const filename = `${user.id}/${dreamId}_${Date.now()}.${extension}`;

        console.log('[ImageGen] Uploading image, size:', byteArray.length, 'bytes');

        // Upload to dream-reels bucket using Uint8Array directly
        const { data, error } = await supabase.storage
            .from('dream-reels')
            .upload(filename, byteArray, {
                contentType: mimeType,
                upsert: true,
            });

        if (error) {
            console.error('[ImageGen] Upload error:', error);
            return null;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('dream-reels')
            .getPublicUrl(filename);

        console.log('[ImageGen] Image uploaded:', urlData.publicUrl);
        return urlData.publicUrl;

    } catch (error) {
        console.error('[ImageGen] Error uploading image:', error);
        return null;
    }
}
