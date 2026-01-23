/**
 * Extension Commands Registry
 * Commands available in the Command Palette
 *
 * Features:
 * - Search extensions by name
 * - Quick actions per extension
 * - Keyboard navigation
 */

import { ExtensionSlug, EXTENSION_REGISTRY, getActiveExtensions } from './types'

export interface ExtensionCommand {
    id: string
    label: string
    description: string
    icon: string
    extensionSlug: ExtensionSlug
    action: 'open' | 'quick-action'
    keywords: string[] // For search
    initialData?: Record<string, unknown>
}

// Generate commands from extension registry
export function getExtensionCommands(): ExtensionCommand[] {
    const commands: ExtensionCommand[] = []

    // Add "open" command for each active extension
    const activeExtensions = getActiveExtensions()

    for (const ext of activeExtensions) {
        commands.push({
            id: `open-${ext.slug}`,
            label: ext.name,
            description: `Open ${ext.name}`,
            icon: ext.icon,
            extensionSlug: ext.slug,
            action: 'open',
            keywords: [
                ext.name.toLowerCase(),
                ext.slug.replace(/-/g, ' '),
                ext.category,
                ...ext.features.map(f => f.toLowerCase())
            ]
        })
    }

    // Add specific quick actions
    const quickActions: ExtensionCommand[] = [
        {
            id: 'quick-generate-image',
            label: 'Generate Image',
            description: 'Create a new AI-generated image',
            icon: '🎨',
            extensionSlug: 'image-generator',
            action: 'quick-action',
            keywords: ['image', 'generate', 'create', 'art', 'design', 'graphic']
        },
        {
            id: 'quick-write-thread',
            label: 'Write Thread',
            description: 'Convert content into a Twitter thread',
            icon: '🧵',
            extensionSlug: 'thread-writer',
            action: 'quick-action',
            keywords: ['thread', 'twitter', 'x', 'write', 'convert']
        },
        {
            id: 'quick-add-hashtags',
            label: 'Add Hashtags',
            description: 'Get AI-suggested hashtags',
            icon: '#️⃣',
            extensionSlug: 'hashtag-optimizer',
            action: 'quick-action',
            keywords: ['hashtag', 'tags', 'optimize', 'suggest']
        },
        {
            id: 'quick-view-analytics',
            label: 'View Analytics',
            description: 'Check your social media performance',
            icon: '📊',
            extensionSlug: 'analytics-dashboard',
            action: 'quick-action',
            keywords: ['analytics', 'stats', 'performance', 'metrics', 'insights']
        },
        {
            id: 'quick-setup-engagement',
            label: 'Setup Auto-Engagement',
            description: 'Configure engagement rules',
            icon: '💬',
            extensionSlug: 'social-engager',
            action: 'quick-action',
            keywords: ['engage', 'auto', 'like', 'reply', 'follow']
        }
    ]

    // Only add quick actions for active extensions
    for (const action of quickActions) {
        const ext = EXTENSION_REGISTRY.find(e => e.slug === action.extensionSlug)
        if (ext?.is_active) {
            commands.push(action)
        }
    }

    return commands
}

// Search commands
export function searchCommands(query: string): ExtensionCommand[] {
    if (!query.trim()) {
        return getExtensionCommands()
    }

    const lowerQuery = query.toLowerCase()
    const commands = getExtensionCommands()

    return commands
        .filter(cmd => {
            // Check label
            if (cmd.label.toLowerCase().includes(lowerQuery)) return true
            // Check description
            if (cmd.description.toLowerCase().includes(lowerQuery)) return true
            // Check keywords
            if (cmd.keywords.some(k => k.includes(lowerQuery))) return true
            return false
        })
        .sort((a, b) => {
            // Prioritize exact label matches
            const aLabelMatch = a.label.toLowerCase().startsWith(lowerQuery)
            const bLabelMatch = b.label.toLowerCase().startsWith(lowerQuery)
            if (aLabelMatch && !bLabelMatch) return -1
            if (!aLabelMatch && bLabelMatch) return 1
            return 0
        })
}
