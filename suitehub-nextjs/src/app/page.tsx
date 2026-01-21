import Link from 'next/link'
import Image from 'next/image'
import { Monitor, Zap, Layout, Smartphone, Wifi, Clock } from 'lucide-react'

const FEATURES = [
    {
        icon: Layout,
        title: 'Customizable Widgets',
        description: 'Clock, weather, calendar, todos, photos, and more. Drag and drop to make it yours.',
    },
    {
        icon: Monitor,
        title: 'Any Screen, Anywhere',
        description: 'Works on tablets, old phones, smart displays, or any device with a browser.',
    },
    {
        icon: Zap,
        title: 'Always On Display',
        description: 'Perfect for wall-mounted displays, kitchen counters, or bedside tables.',
    },
    {
        icon: Wifi,
        title: 'Real-Time Updates',
        description: 'Weather, calendar, and data sync automatically. Always current.',
    },
    {
        icon: Smartphone,
        title: 'Add to Home Screen',
        description: 'Install as an app on any device. No app store required.',
    },
    {
        icon: Clock,
        title: 'Kiosk Mode',
        description: 'Full-screen, distraction-free display mode for dedicated screens.',
    },
]

const HARDWARE_OPTIONS = [
    {
        name: 'Budget Pick',
        device: 'Amazon Fire 7',
        price: '$49',
        salePrice: '$35 on sale',
        note: 'Great starter option',
    },
    {
        name: 'Best Value',
        device: 'Amazon Fire HD 8',
        price: '$79',
        salePrice: '$55 on sale',
        note: 'Recommended for most',
        featured: true,
    },
    {
        name: 'Premium',
        device: 'Amazon Fire HD 10',
        price: '$139',
        salePrice: '$99 on sale',
        note: 'Big, beautiful display',
    },
]

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[var(--background)]">
            {/* Nav */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--background)]/80 backdrop-blur-lg border-b border-[var(--surface-border)]">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Image
                            src="/suitehub-icon.jpg"
                            alt="SUITEHub"
                            width={36}
                            height={36}
                            className="rounded-lg"
                        />
                        <span className="font-bold text-xl">SUITEHub</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link href="/login" className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                            Sign In
                        </Link>
                        <Link href="/signup" className="btn btn-primary">
                            Get Started
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="pt-32 pb-20 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
                        Your Personal <span className="gradient-text">Smart Display</span>
                    </h1>
                    <p className="text-xl text-[var(--foreground-muted)] mb-8 max-w-2xl mx-auto">
                        Turn any tablet or screen into a beautiful, customizable dashboard.
                        Weather, calendar, todos, photos, and more — all in one glance.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link href="/signup" className="btn btn-primary text-lg px-8 py-3">
                            Start Free
                        </Link>
                        <Link href="/demo" className="btn btn-secondary text-lg px-8 py-3">
                            Try Demo
                        </Link>
                    </div>
                    <p className="text-sm text-[var(--foreground-subtle)] mt-4">
                        No credit card required
                    </p>
                </div>
            </section>

            {/* Preview */}
            <section className="pb-20 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="relative bg-[var(--surface)] rounded-2xl border border-[var(--surface-border)] p-4 shadow-2xl">
                        <div className="aspect-video bg-[var(--background)] rounded-lg flex items-center justify-center">
                            <div className="grid grid-cols-3 gap-4 p-8 w-full max-w-3xl">
                                {/* Mini widget previews */}
                                <div className="col-span-2 bg-[var(--surface)] rounded-xl p-6 border border-[var(--surface-border)]">
                                    <div className="text-4xl font-bold gradient-text">10:30 AM</div>
                                    <div className="text-[var(--foreground-muted)]">Tuesday, January 21</div>
                                </div>
                                <div className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--surface-border)] text-center">
                                    <div className="text-3xl font-bold">72°</div>
                                    <div className="text-sm text-[var(--foreground-muted)]">Sunny</div>
                                </div>
                                <div className="col-span-2 bg-[var(--surface)] rounded-xl p-4 border border-[var(--surface-border)]">
                                    <div className="text-sm text-[var(--foreground-muted)] mb-2">Today's Tasks</div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm">
                                            <div className="w-4 h-4 rounded border border-[var(--primary)]"></div>
                                            <span>Review project proposal</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <div className="w-4 h-4 rounded bg-[var(--primary)]"></div>
                                            <span className="line-through text-[var(--foreground-muted)]">Morning workout</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--surface-border)]">
                                    <div className="text-xs text-[var(--foreground-muted)] mb-2">Next Event</div>
                                    <div className="text-sm font-medium">Team Standup</div>
                                    <div className="text-xs text-[var(--primary)]">11:00 AM</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="py-20 px-6 bg-[var(--surface)]">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl font-bold text-center mb-12">
                        Everything you need in <span className="gradient-text">one display</span>
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {FEATURES.map((feature) => (
                            <div key={feature.title} className="p-6 bg-[var(--background)] rounded-xl border border-[var(--surface-border)] hover:border-[var(--primary)] transition-colors">
                                <feature.icon className="w-10 h-10 text-[var(--primary)] mb-4" />
                                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                                <p className="text-[var(--foreground-muted)]">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Hardware */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-3xl font-bold text-center mb-4">
                        Recommended Hardware
                    </h2>
                    <p className="text-center text-[var(--foreground-muted)] mb-12 max-w-2xl mx-auto">
                        SUITEHub works on any device with a browser. Here are our top picks for dedicated displays:
                    </p>
                    <div className="grid md:grid-cols-3 gap-6">
                        {HARDWARE_OPTIONS.map((option) => (
                            <div
                                key={option.device}
                                className={`p-6 rounded-xl border transition-all ${
                                    option.featured
                                        ? 'bg-[var(--surface)] border-[var(--primary)] shadow-lg shadow-[var(--primary)]/10'
                                        : 'bg-[var(--surface)] border-[var(--surface-border)]'
                                }`}
                            >
                                {option.featured && (
                                    <div className="text-xs font-semibold text-[var(--primary)] mb-2">RECOMMENDED</div>
                                )}
                                <div className="text-sm text-[var(--foreground-muted)] mb-1">{option.name}</div>
                                <div className="text-xl font-bold mb-2">{option.device}</div>
                                <div className="flex items-baseline gap-2 mb-2">
                                    <span className="text-2xl font-bold gradient-text">{option.salePrice.split(' ')[0]}</span>
                                    <span className="text-sm text-[var(--foreground-muted)] line-through">{option.price}</span>
                                </div>
                                <div className="text-sm text-[var(--foreground-muted)] mb-4">{option.note}</div>
                                <a
                                    href="#"
                                    className="btn btn-secondary w-full text-sm"
                                >
                                    View on Amazon
                                </a>
                            </div>
                        ))}
                    </div>
                    <p className="text-center text-sm text-[var(--foreground-subtle)] mt-8">
                        Already have a tablet or old phone? <Link href="/signup" className="text-[var(--primary)] hover:underline">Get started free</Link> — no new hardware needed.
                    </p>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 px-6 bg-[var(--surface)]">
                <div className="max-w-2xl mx-auto text-center">
                    <h2 className="text-3xl font-bold mb-4">
                        Ready to build your dashboard?
                    </h2>
                    <p className="text-[var(--foreground-muted)] mb-8">
                        Start free, upgrade when you need more. No credit card required.
                    </p>
                    <Link href="/signup" className="btn btn-primary text-lg px-8 py-3">
                        Get Started Free
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 px-6 border-t border-[var(--surface-border)]">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Image
                            src="/suitehub-icon.jpg"
                            alt="SUITEHub"
                            width={24}
                            height={24}
                            className="rounded"
                        />
                        <span className="text-sm text-[var(--foreground-muted)]">© 2025 SUITEHub</span>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-[var(--foreground-muted)]">
                        <Link href="/privacy" className="hover:text-[var(--foreground)]">Privacy</Link>
                        <Link href="/terms" className="hover:text-[var(--foreground)]">Terms</Link>
                        <Link href="/support" className="hover:text-[var(--foreground)]">Support</Link>
                    </div>
                </div>
            </footer>
        </div>
    )
}
