'use client'

import {
    SiX,
    SiInstagram,
    SiLinkedin,
    SiTiktok,
    SiYoutube,
    SiFacebook,
    SiPinterest,
    SiThreads,
    SiSnapchat
} from 'react-icons/si'
import { Platform } from '@/lib/supabase/types'

interface PlatformIconProps {
    platform: Platform | string
    size?: number
    className?: string
    colored?: boolean
}

// Platform colors
const PLATFORM_COLORS: Record<string, string> = {
    x: '#000000',
    instagram: '#E4405F',
    linkedin: '#0A66C2',
    tiktok: '#000000',
    youtube: '#FF0000',
    facebook: '#1877F2',
    pinterest: '#BD081C',
    threads: '#000000',
    snapchat: '#FFFC00',
}

export function PlatformIcon({ platform, size = 16, className = '', colored = true }: PlatformIconProps) {
    const color = colored ? PLATFORM_COLORS[platform] : 'currentColor'

    const iconProps = {
        size,
        color,
        className,
    }

    switch (platform) {
        case 'x':
            return <SiX {...iconProps} />
        case 'instagram':
            return <SiInstagram {...iconProps} />
        case 'linkedin':
            return <SiLinkedin {...iconProps} />
        case 'tiktok':
            return <SiTiktok {...iconProps} />
        case 'youtube':
            return <SiYoutube {...iconProps} />
        case 'facebook':
            return <SiFacebook {...iconProps} />
        case 'pinterest':
            return <SiPinterest {...iconProps} />
        case 'threads':
            return <SiThreads {...iconProps} />
        case 'snapchat':
            return <SiSnapchat {...iconProps} />
        default:
            return <span className={className} style={{ fontSize: size }}>📱</span>
    }
}

// Export platform names for display
export const PLATFORM_NAMES: Record<string, string> = {
    x: 'X',
    instagram: 'Instagram',
    linkedin: 'LinkedIn',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    facebook: 'Facebook',
    pinterest: 'Pinterest',
    threads: 'Threads',
    snapchat: 'Snapchat',
}

export { PLATFORM_COLORS }
