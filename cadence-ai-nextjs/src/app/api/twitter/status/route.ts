/**
 * GET /api/twitter/status
 * Check Twitter connection status and get user info
 */

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/twitter'

export async function GET() {
    try {
        // Check if credentials are configured
        if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_ACCESS_TOKEN) {
            return NextResponse.json({
                connected: false,
                error: 'Twitter API credentials not configured'
            })
        }

        // Try to get authenticated user
        const result = await getAuthenticatedUser()

        if (!result.success) {
            return NextResponse.json({
                connected: false,
                error: result.error
            })
        }

        return NextResponse.json({
            connected: true,
            user: {
                id: result.user.id,
                username: result.user.username,
                name: result.user.name,
                profileImageUrl: result.user.profile_image_url,
                followers: result.user.public_metrics?.followers_count,
                following: result.user.public_metrics?.following_count
            }
        })

    } catch (error) {
        console.error('Twitter status check error:', error)
        return NextResponse.json({
            connected: false,
            error: 'Failed to check Twitter status'
        })
    }
}
