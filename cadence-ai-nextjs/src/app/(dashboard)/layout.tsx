import Sidebar from '@/components/dashboard/Sidebar'

export default function DashboardRootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <Sidebar>{children}</Sidebar>
}
