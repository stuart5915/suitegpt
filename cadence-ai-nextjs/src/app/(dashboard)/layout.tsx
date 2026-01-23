import Sidebar from '@/components/dashboard/Sidebar'
import { ExtensionPanelProvider } from '@/contexts/ExtensionPanelContext'
import ExtensionPanelManager from '@/components/extensions/ExtensionPanelManager'
import CommandPalette from '@/components/extensions/CommandPalette'

export default function DashboardRootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <ExtensionPanelProvider>
            <Sidebar>{children}</Sidebar>
            <ExtensionPanelManager />
            <CommandPalette />
        </ExtensionPanelProvider>
    )
}
