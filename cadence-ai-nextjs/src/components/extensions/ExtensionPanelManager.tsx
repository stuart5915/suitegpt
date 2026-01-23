'use client'

/**
 * Extension Panel Manager
 * Renders all open extension panels using ExtensionSlideOver
 *
 * Features:
 * - Renders all panels from context
 * - Lazy loads panel content components
 * - Handles stacking order
 * - Manages panel lifecycle
 */

import { Suspense, lazy } from 'react'
import { useExtensionPanel } from '@/contexts/ExtensionPanelContext'
import ExtensionSlideOver from './ExtensionSlideOver'
import { ExtensionSlug } from '@/lib/extensions/types'
import { Loader2 } from 'lucide-react'

// Lazy load panel components
const panelComponents: Record<ExtensionSlug, React.LazyExoticComponent<React.ComponentType<PanelContentProps>>> = {
    'social-engager': lazy(() => import('./panels/SocialEngagerPanel')),
    'image-generator': lazy(() => import('./panels/ImageGeneratorPanel')),
    'thread-writer': lazy(() => import('./panels/ThreadWriterPanel')),
    'analytics-dashboard': lazy(() => import('./panels/AnalyticsDashboardPanel')),
    'hashtag-optimizer': lazy(() => import('./panels/HashtagOptimizerPanel')),
    'comment-responder': lazy(() => import('./panels/CommentResponderPanel')),
    'trend-surfer': lazy(() => import('./panels/TrendSurferPanel')),
    'link-in-bio': lazy(() => import('./panels/LinkInBioPanel')),
    'dm-sequence-builder': lazy(() => import('./panels/DMSequenceBuilderPanel'))
}

export interface PanelContentProps {
    mode: 'page' | 'panel'
    initialData?: Record<string, unknown>
    onComplete?: (result: unknown) => void
}

function PanelLoadingFallback() {
    return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
        </div>
    )
}

export default function ExtensionPanelManager() {
    const {
        panels,
        closePanel,
        minimizePanel,
        restorePanel,
        bringToFront
    } = useExtensionPanel()

    // Get open panels sorted by position
    const openPanels = panels
        .filter(p => p.state === 'open')
        .sort((a, b) => a.position - b.position)

    return (
        <>
            {openPanels.map((panel, index) => {
                const PanelContent = panelComponents[panel.extensionSlug]

                return (
                    <ExtensionSlideOver
                        key={panel.id}
                        id={panel.id}
                        extensionSlug={panel.extensionSlug}
                        isOpen={true}
                        isMinimized={false}
                        stackPosition={index}
                        onClose={() => closePanel(panel.id)}
                        onMinimize={() => minimizePanel(panel.id)}
                        onBringToFront={() => bringToFront(panel.id)}
                    >
                        <Suspense fallback={<PanelLoadingFallback />}>
                            <PanelContent
                                mode="panel"
                                initialData={panel.initialData}
                                onComplete={panel.onComplete}
                            />
                        </Suspense>
                    </ExtensionSlideOver>
                )
            })}
        </>
    )
}
