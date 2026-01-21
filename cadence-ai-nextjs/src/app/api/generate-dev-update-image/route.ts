import { NextRequest, NextResponse } from 'next/server'

// Dev update image generation is temporarily disabled on serverless
// This would require converting to @vercel/og like generate-fleet-image

export async function POST(req: NextRequest) {
    console.log('=== generate-dev-update-image API called (placeholder) ===')

    // Return a placeholder response
    // TODO: Convert to @vercel/og for serverless compatibility
    return NextResponse.json({
        imageUrl: null,
        success: false,
        message: 'Dev update image generation temporarily disabled on serverless. Use generate-fleet-image instead.'
    })
}
