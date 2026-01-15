'use client'

import { useState, useEffect } from 'react'
import { X, Smartphone } from 'lucide-react'

export default function MobileOptimizedBanner() {
    const [show, setShow] = useState(false)
    const [isIOS, setIsIOS] = useState(false)
    const [isAndroid, setIsAndroid] = useState(false)

    useEffect(() => {
        // Check if already dismissed
        const dismissed = localStorage.getItem('mobileOptimizedBannerDismissed')
        if (dismissed) return

        // Check if on desktop (screen width > 768px)
        const isDesktop = window.innerWidth > 768

        // Detect device type for install instructions
        const ua = navigator.userAgent
        setIsIOS(/iPhone|iPad|iPod/.test(ua))
        setIsAndroid(/Android/.test(ua))

        // Only show on desktop
        if (isDesktop) {
            setShow(true)
        }
    }, [])

    const dismiss = () => {
        setShow(false)
        localStorage.setItem('mobileOptimizedBannerDismissed', 'true')
    }

    if (!show) return null

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl p-4 shadow-lg z-50">
            <button
                onClick={dismiss}
                className="absolute top-2 right-2 p-1 text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                aria-label="Dismiss"
            >
                <X className="w-4 h-4" />
            </button>

            <div className="flex gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-[var(--primary)]/20 rounded-lg flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-[var(--primary)]" />
                </div>
                <div className="flex-1 pr-4">
                    <h3 className="font-semibold text-[var(--foreground)] text-sm">
                        Optimized for Mobile
                    </h3>
                    <p className="text-xs text-[var(--foreground-muted)] mt-1">
                        This app works best on your phone. Scan the QR code or visit on mobile and tap "Add to Home Screen" for the full experience.
                    </p>
                </div>
            </div>
        </div>
    )
}
