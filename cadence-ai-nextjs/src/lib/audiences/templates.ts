import { Audience } from '@/lib/supabase/types'

// Pre-defined audience templates for SUITE Users loop
export const SUITE_AUDIENCES: Audience[] = [
    {
        id: 'entrepreneurs',
        name: 'Entrepreneurs',
        emoji: '🚀',
        description: 'Founders who want white-label apps to launch their own branded products',
        painPoints: [
            'Building apps from scratch is expensive and slow',
            'No dev team or technical co-founder',
            'Need to own their product, not just resell',
            'Wary of platforms that can shut them down'
        ],
        desires: [
            'Launch fast with minimal upfront cost',
            'Own their user base and data',
            'Generate recurring revenue',
            'Build equity in a real product'
        ],
        messagingAngles: [
            'Launch your own app business. White-label any SUITE app with your branding. Keep 100% of your users and revenue.',
            'Skip the dev team. Deploy AI apps under your brand in minutes. Your customers, your revenue, your data.',
            'From idea to revenue in hours, not months. Pre-built AI apps ready to customize and launch.',
            'Stop renting software. Own the product, own the customers, keep 100% of the profits.'
        ],
        cta: 'Start your app business today',
        referenceLinks: [
            {
                url: 'https://suite.dev/apps',
                title: 'SUITE App Marketplace',
                notes: 'Browse all white-label ready apps'
            }
        ]
    },
    {
        id: 'contributors',
        name: 'Contributors',
        emoji: '🔨',
        description: 'Builders who help develop apps and participate in graduation rewards',
        painPoints: [
            'Hard to find projects worth contributing to',
            'Open source rarely pays',
            'Want ownership stake, not just bounties',
            'No clear path from contributor to co-owner'
        ],
        desires: [
            'Earn real equity in apps they help build',
            'Work on interesting AI products',
            'Get paid for contributions',
            'Be part of something bigger'
        ],
        messagingAngles: [
            'Earn equity by building. Contribute code, feedback, or refinements. When an app graduates, contributors share in the rewards.',
            'Your PRs = your ownership stake. Build features, fix bugs, improve UX. Graduate with the app and earn.',
            'Open source with upside. Every contribution is tracked. When apps succeed, builders get paid.',
            'The app co-op for builders. Ship code, get equity. No more working for exposure.'
        ],
        cta: 'Start contributing and earning'
    },
    {
        id: 'passive-users',
        name: 'Passive Users',
        emoji: '💰',
        description: 'Users who enjoy apps and spend yield without building',
        painPoints: [
            'Tired of paying subscriptions that drain money',
            'Want premium features but hate recurring bills',
            'Love trying new AI tools',
            'Overwhelmed by too many apps to manage'
        ],
        desires: [
            'Access premium features without spending principal',
            'Discover cool new AI apps',
            'Simple, frictionless experience',
            'Feel like money is working for them'
        ],
        messagingAngles: [
            'Use apps for free with your yield. Deposit once, access premium features forever. Your principal stays untouched.',
            'Your deposits work while you sleep. Yield pays for premium AI apps. Principal never leaves your wallet.',
            'One deposit. Unlimited apps. Spend only the yield, keep your stack intact forever.',
            'Netflix model, but you keep your money. Deposit once, yield covers all subscriptions.'
        ],
        cta: 'Start using apps with yield'
    },
    {
        id: 'influencers',
        name: 'Influencers',
        emoji: '📣',
        description: 'Partners who want early access and share graduating apps with their audience',
        painPoints: [
            'Hard to find unique products to promote',
            'Tired of affiliate programs with low payouts',
            'Want to be first, not promoting what everyone else has',
            'Need products their audience will actually love'
        ],
        desires: [
            'Early access to trending products',
            'Exclusive partnership opportunities',
            'Products that solve real problems',
            'Be known as the source for cool new tools'
        ],
        messagingAngles: [
            'Get early access to graduating apps. Be first to share breakout AI products with your audience. Exclusive influencer program.',
            'Your audience wants new AI tools. We ship them daily. Get them first, before anyone else.',
            'Curated AI drops for your community. Early access, exclusive deals. Be the source.',
            'Partner with the AI Fleet. Preview graduating apps, get creator perks, grow your tech cred.'
        ],
        cta: 'Join the early access waitlist',
        emailCapture: true
    }
]

// Helper to get audience by ID
export function getAudienceById(audiences: Audience[], id: string): Audience | undefined {
    return audiences.find(a => a.id === id)
}

// Helper to import SUITE template audiences into a loop
export function importSuiteAudiences(): Audience[] {
    return SUITE_AUDIENCES.map(audience => ({
        ...audience,
        id: crypto.randomUUID() // Generate new IDs for each import
    }))
}
