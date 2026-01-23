// DeFi Knowledge Courses Database
// Complete course content with modules, lessons, and quizzes

export interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
}

export interface Lesson {
    id: string;
    title: string;
    duration: string; // e.g. "5 min"
    content: string; // Markdown with [[linked terms]]
    imagePrompt?: string; // For generating lesson images
}

export interface Module {
    id: string;
    title: string;
    emoji: string;
    lessons: Lesson[];
    quiz: QuizQuestion[];
}

export interface Course {
    id: string;
    title: string;
    emoji: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    duration: string; // Total estimated time
    description: string;
    modules: Module[];
}

// Helper functions
export function getCourseById(courseId: string): Course | undefined {
    return COURSES.find(c => c.id === courseId);
}

export function getCoursesByDifficulty(difficulty: Course['difficulty']): Course[] {
    return COURSES.filter(c => c.difficulty === difficulty);
}

export function getTotalLessons(course: Course): number {
    return course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
}

export function getLessonById(courseId: string, lessonId: string): Lesson | undefined {
    const course = getCourseById(courseId);
    if (!course) return undefined;

    for (const module of course.modules) {
        const lesson = module.lessons.find(l => l.id === lessonId);
        if (lesson) return lesson;
    }
    return undefined;
}

// =============================================================================
// COURSE CONTENT
// =============================================================================

export const COURSES: Course[] = [
    // =========================================================================
    // BEGINNER COURSES
    // =========================================================================
    {
        id: 'defi-101',
        title: 'DeFi 101: Understanding the Basics',
        emoji: '🎓',
        difficulty: 'beginner',
        duration: '45 min',
        description: 'Start your DeFi journey here! Learn the fundamental concepts of cryptocurrency, blockchain, and decentralized finance.',
        modules: [
            {
                id: 'defi-101-m1',
                title: 'Crypto Foundations',
                emoji: '🪙',
                lessons: [
                    {
                        id: 'defi-101-m1-l1',
                        title: 'What is Cryptocurrency?',
                        duration: '5 min',
                        content: `# What is Cryptocurrency?

[[Cryptocurrency]] is digital money that exists on the internet. Unlike the dollars or euros in your bank account, crypto isn't controlled by any government or company.

## Key Characteristics

**Digital & Global**
Crypto exists only as computer code. You can send it to anyone in the world, 24/7, without needing a bank.

**[[Decentralized]]**
No single company or government controls crypto. It's maintained by thousands of computers worldwide working together.

**Secured by Math**
[[Cryptography]] (advanced mathematics) keeps your crypto safe. Each transaction is verified and recorded permanently.

## Why Does This Matter?

Traditional money requires trusting banks and governments. Crypto lets you be your own bank - you control your money directly.

> 💡 Think of crypto like digital gold: scarce, valuable, and controlled by no one.`,
                        imagePrompt: 'Clean minimalist illustration of cryptocurrency concept showing Bitcoin and Ethereum coins floating above a globe with digital connection lines, dark gradient background, modern fintech style',
                    },
                    {
                        id: 'defi-101-m1-l2',
                        title: 'Understanding Blockchain',
                        duration: '5 min',
                        content: `# Understanding Blockchain

[[Blockchain]] is the technology that makes [[cryptocurrency]] possible. It's a special type of database that stores information in a unique way.

## How Does It Work?

Imagine a notebook that:
- Everyone in the world has a copy of
- New pages can only be added, never removed
- Everyone's copy updates automatically when pages are added

That's essentially what a blockchain is - a shared record that can't be faked or changed.

## Blocks and Chains

**[[Block]]s** are groups of [[transaction]]s bundled together. Each block:
- Contains many transactions
- Has a unique fingerprint (hash)
- Links to the previous block

This creates a **chain** of blocks - hence "blockchain"!

## Why Is This Revolutionary?

Before blockchain, digital things could be copied infinitely. Blockchain solved this by creating digital scarcity - each [[Bitcoin]] or [[token]] is unique and can't be duplicated.

> 🔗 The first blockchain was [[Bitcoin]], created in 2009 by the mysterious Satoshi Nakamoto.`,
                        imagePrompt: 'Minimalist illustration of blockchain concept showing connected blocks in a chain with transaction data inside each block, glowing purple and blue accents on dark background',
                    },
                    {
                        id: 'defi-101-m1-l3',
                        title: 'Bitcoin vs Ethereum',
                        duration: '5 min',
                        content: `# Bitcoin vs Ethereum

[[Bitcoin]] and [[Ethereum]] are the two largest [[cryptocurrency|cryptocurrencies]], but they serve very different purposes.

## Bitcoin: Digital Gold 🥇

Bitcoin was the first crypto, created in 2009. Think of it as digital gold:
- Store of value
- Limited supply (only 21 million will ever exist)
- Simple purpose: send and receive money
- Uses [[Proof of Work]] for security

## Ethereum: The World Computer 💻

[[Ethereum]] was created in 2015 to do much more:
- Runs [[smart contract]]s (programmable money)
- Hosts [[dApp]]s (decentralized apps)
- Powers most of [[DeFi]]
- Uses [[Proof of Stake]] (more energy efficient)

## Key Differences

| Feature | Bitcoin | Ethereum |
|---------|---------|----------|
| Purpose | Store of value | Platform for apps |
| Currency | BTC | [[ETH]] |
| Smart Contracts | No | Yes |
| DeFi Apps | Limited | Thousands |

## Which Is Better?

Neither! They serve different purposes. Many people own both:
- Bitcoin for long-term savings
- Ethereum for using [[DeFi]] apps

> 💡 Bitcoin is like digital gold. Ethereum is like a programmable financial system.`,
                        imagePrompt: 'Split illustration comparing Bitcoin and Ethereum, left side shows golden Bitcoin coin with traditional vault imagery, right side shows Ethereum diamond logo with connected smart contract nodes, modern dark theme',
                    },
                ],
                quiz: [
                    {
                        id: 'defi-101-m1-q1',
                        question: 'What makes cryptocurrency "decentralized"?',
                        options: [
                            'It\'s controlled by a single company',
                            'It\'s maintained by thousands of computers worldwide',
                            'It only works in certain countries',
                            'It requires a bank account'
                        ],
                        correctIndex: 1,
                    },
                    {
                        id: 'defi-101-m1-q2',
                        question: 'What is a blockchain?',
                        options: [
                            'A type of cryptocurrency',
                            'A shared record of transactions that can\'t be changed',
                            'A password for your wallet',
                            'A crypto exchange'
                        ],
                        correctIndex: 1,
                    },
                    {
                        id: 'defi-101-m1-q3',
                        question: 'Which cryptocurrency is known for smart contracts and DeFi?',
                        options: [
                            'Bitcoin',
                            'Dogecoin',
                            'Ethereum',
                            'Litecoin'
                        ],
                        correctIndex: 2,
                    },
                ],
            },
            {
                id: 'defi-101-m2',
                title: 'Wallet Essentials',
                emoji: '👛',
                lessons: [
                    {
                        id: 'defi-101-m2-l1',
                        title: 'Hot vs Cold Wallets',
                        duration: '5 min',
                        content: `# Hot vs Cold Wallets

A [[wallet]] stores your [[cryptocurrency]]. But not all wallets are created equal. Understanding the difference between hot and cold wallets is essential for security.

## Hot Wallets 🔥

A [[hot wallet]] is connected to the internet:
- Browser extensions like [[MetaMask]]
- Mobile apps like [[Trust Wallet]]
- Exchange accounts like [[Coinbase]]

**Pros:**
- Convenient for daily use
- Easy to access anytime
- Great for small amounts

**Cons:**
- More vulnerable to hacks
- Connected to internet = more risk

## Cold Wallets ❄️

A [[cold wallet]] is NOT connected to the internet:
- Hardware devices like [[Ledger]] and [[Trezor]]
- Paper wallets (not recommended)

**Pros:**
- Maximum security
- Impossible to hack remotely
- Perfect for large holdings

**Cons:**
- Less convenient
- Costs money ($50-150)
- Can be lost or damaged

## The Golden Rule

> 🔐 Keep small amounts in hot wallets for daily use. Store the majority in cold wallets for security.

Think of it like cash: you keep some in your pocket (hot wallet) and the rest in a safe (cold wallet).`,
                        imagePrompt: 'Split illustration showing hot wallet on left as glowing smartphone with fire accents, cold wallet on right as secure hardware device with ice/snow accents, dark modern background',
                    },
                    {
                        id: 'defi-101-m2-l2',
                        title: 'Setting Up MetaMask',
                        duration: '5 min',
                        content: `# Setting Up MetaMask

[[MetaMask]] is the most popular [[hot wallet]] for [[Ethereum]] and [[DeFi]]. Let's understand how to set it up safely.

## What You'll Need

1. A web browser (Chrome, Firefox, or Brave)
2. The official MetaMask extension (metamask.io)
3. A safe place to write down your [[seed phrase]]

## Setup Steps

**Step 1: Install**
Go to metamask.io (verify the URL!) and install the browser extension.

**Step 2: Create Wallet**
Click "Create a Wallet" and set a strong password.

**Step 3: Save Your Seed Phrase**
MetaMask will show you 12 words - your [[seed phrase]].

⚠️ **CRITICAL:** Write these words on paper. Never:
- Screenshot them
- Save them digitally
- Share them with anyone

**Step 4: Verify**
Confirm your seed phrase by selecting the words in order.

## Security Best Practices

- Only download from metamask.io
- Never share your seed phrase
- Use a unique password
- Enable browser security features

> 🦊 Your seed phrase IS your wallet. Anyone who has it controls your funds.`,
                        imagePrompt: 'Clean illustration of MetaMask fox logo with a shield and security lock, showing step-by-step setup flow with checkmarks, purple and orange accents on dark background',
                    },
                    {
                        id: 'defi-101-m2-l3',
                        title: 'Protecting Your Keys',
                        duration: '5 min',
                        content: `# Protecting Your Keys

"Not your keys, not your coins" is the most important saying in crypto. Let's understand why.

## What Are Keys?

**[[Private Key]]**
A secret code (long string of numbers/letters) that controls your crypto. Think of it as your master password.

**[[Public Key]]**
Your wallet address that you can share. Others use this to send you crypto.

**[[Seed Phrase]]**
12-24 words that generate all your private keys. This is the master backup for your entire wallet.

## The #1 Rule

> 🚨 NEVER share your private key or seed phrase with ANYONE. EVER.

Real support teams will NEVER ask for these. If someone does, it's a [[scam]].

## How to Store Safely

✅ **Do:**
- Write on paper and store in a safe
- Use multiple copies in different locations
- Consider a metal backup (fire/water resistant)

❌ **Don't:**
- Take screenshots
- Store in notes app or cloud
- Email or text to yourself
- Share with "support" agents

## What If Someone Gets Your Keys?

They can steal ALL your crypto instantly. There's no customer support to call, no way to reverse it. [[Self-custody]] is powerful but comes with responsibility.

> 💡 Treat your seed phrase like a pile of cash. Would you photograph that and upload it?`,
                        imagePrompt: 'Security-focused illustration showing a seed phrase written on paper inside a safe, with warning symbols around dangerous actions like phones and emails, dark theme with red accents for warnings',
                    },
                ],
                quiz: [
                    {
                        id: 'defi-101-m2-q1',
                        question: 'Which type of wallet is more secure for large amounts?',
                        options: [
                            'Hot wallet (like MetaMask)',
                            'Cold wallet (like Ledger)',
                            'Exchange wallet',
                            'They\'re all equally secure'
                        ],
                        correctIndex: 1,
                    },
                    {
                        id: 'defi-101-m2-q2',
                        question: 'What should you NEVER do with your seed phrase?',
                        options: [
                            'Write it on paper',
                            'Store it in a safe',
                            'Share it with customer support',
                            'Make multiple copies'
                        ],
                        correctIndex: 2,
                    },
                    {
                        id: 'defi-101-m2-q3',
                        question: 'Why is it called "self-custody"?',
                        options: [
                            'A company holds your keys for you',
                            'You control your own private keys',
                            'The bank protects your crypto',
                            'Your keys are stored in the cloud'
                        ],
                        correctIndex: 1,
                    },
                ],
            },
            {
                id: 'defi-101-m3',
                title: 'First Steps in DeFi',
                emoji: '🚀',
                lessons: [
                    {
                        id: 'defi-101-m3-l1',
                        title: 'What is DeFi?',
                        duration: '5 min',
                        content: `# What is DeFi?

[[DeFi]] stands for Decentralized Finance. It's a new financial system built on [[blockchain]] technology.

## Traditional Finance vs DeFi

**Banks (Traditional):**
- Open 9-5, closed weekends
- Need permission/approval
- Can freeze your account
- Hidden fees, slow transfers

**DeFi:**
- Open 24/7, 365 days
- Permissionless - anyone can use it
- Only YOU control your funds
- Transparent fees, instant transfers

## What Can You Do in DeFi?

Everything you do at a bank, but [[decentralized]]:

- 💱 **Trade**: [[Swap]] tokens on a [[DEX]]
- 💰 **Save**: Earn yield through [[staking]]
- 🏦 **Borrow**: Get [[lending protocol|loans]] without credit checks
- 🌾 **Invest**: [[Yield farming]] for returns

## The Power of Smart Contracts

DeFi runs on [[smart contract]]s - code that automatically executes agreements. No middlemen needed!

Example: You can get a loan instantly because the [[smart contract]] handles everything - no loan officer, no paperwork, no waiting.

> 🏦 DeFi is like having a bank in your pocket that never closes and never asks for permission.`,
                        imagePrompt: 'Modern illustration comparing traditional bank building crumbling vs futuristic DeFi interface glowing with connected financial icons, showing 24/7 accessibility, dark purple gradient background',
                    },
                    {
                        id: 'defi-101-m3-l2',
                        title: 'DEX vs CEX',
                        duration: '5 min',
                        content: `# DEX vs CEX: Know the Difference

When trading crypto, you have two main options: centralized exchanges (CEX) and decentralized exchanges (DEX).

## Centralized Exchanges (CEX) 🏢

A [[CEX]] is a company that operates a trading platform:
- [[Coinbase]], [[Binance]], [[Kraken]]
- You create an account with email/password
- They hold your crypto for you
- Requires [[KYC]] (identity verification)

**Pros:**
- Easy for beginners
- Can buy with credit card/bank
- Customer support available

**Cons:**
- They control your funds
- Can freeze your account
- Exchange hacks are possible

## Decentralized Exchanges (DEX) 🔄

A [[DEX]] runs on [[smart contract]]s with no company in control:
- [[Uniswap]], SushiSwap, Curve
- Connect your [[wallet]] directly
- You keep your own keys
- No account or KYC needed

**Pros:**
- Full control of your funds
- Privacy preserved
- Can't be shut down

**Cons:**
- More complex for beginners
- [[Gas]] fees on each trade
- No customer support

## Which Should You Use?

| Use Case | Best Option |
|----------|-------------|
| Buying crypto with $ | CEX |
| Trading & DeFi | DEX |
| Long-term holding | Your own wallet |

> 💡 Many people use both: buy on a CEX, then transfer to their wallet for DeFi.`,
                        imagePrompt: 'Split comparison illustration showing centralized exchange as corporate building with middlemen vs DEX as peer-to-peer network of connected wallets, modern dark fintech style',
                    },
                    {
                        id: 'defi-101-m3-l3',
                        title: 'Your First Swap',
                        duration: '5 min',
                        content: `# Your First Swap

A [[swap]] is the most basic DeFi action - trading one [[token]] for another. Here's how it works on a [[DEX]] like [[Uniswap]].

## Before You Start

You'll need:
1. A [[wallet]] like [[MetaMask]] with some [[ETH]]
2. Extra ETH for [[gas]] fees
3. The token you want to swap

## How Swapping Works

1. **Connect Wallet**: Click "Connect Wallet" on the DEX
2. **Select Tokens**: Choose what you have → what you want
3. **Enter Amount**: How much to swap
4. **Review**: Check the rate and [[slippage]]
5. **Approve & Swap**: Confirm in your wallet

## Understanding the Costs

**Gas Fees**
Every [[Ethereum]] [[transaction]] costs [[gas]], paid in [[ETH]]. Fees vary based on network congestion.

**Slippage**
The price might change slightly between when you submit and when it executes. Set [[slippage]] tolerance (usually 0.5-1%) to protect yourself.

**LP Fees**
A small fee (usually 0.3%) goes to [[liquidity provider]]s who make trading possible.

## Tips for Your First Swap

- Start small to learn
- Check gas fees before trading
- Verify the token addresses
- Never rush - review everything

> 🔄 Swapping on a DEX means you stay in control. No account needed, no permission required.`,
                        imagePrompt: 'Step-by-step swap interface illustration showing tokens being exchanged with arrows, gas fee indicator, and confirmation checkmark, Uniswap-style purple gradient on dark background',
                    },
                ],
                quiz: [
                    {
                        id: 'defi-101-m3-q1',
                        question: 'What does "DeFi" stand for?',
                        options: [
                            'Digital Finance',
                            'Decentralized Finance',
                            'Definite Finance',
                            'Derivative Finance'
                        ],
                        correctIndex: 1,
                    },
                    {
                        id: 'defi-101-m3-q2',
                        question: 'What\'s the main advantage of a DEX over a CEX?',
                        options: [
                            'Lower fees',
                            'Better customer support',
                            'You control your own funds',
                            'Faster trading'
                        ],
                        correctIndex: 2,
                    },
                    {
                        id: 'defi-101-m3-q3',
                        question: 'What are "gas fees" used for?',
                        options: [
                            'Paying the DEX company',
                            'Processing transactions on the blockchain',
                            'Insuring your trades',
                            'Marketing costs'
                        ],
                        correctIndex: 1,
                    },
                ],
            },
        ],
    },

    {
        id: 'wallets-explained',
        title: 'Crypto Wallets Explained',
        emoji: '👛',
        difficulty: 'beginner',
        duration: '30 min',
        description: 'Master the art of storing and managing your crypto safely. From hot wallets to hardware security.',
        modules: [
            {
                id: 'wallets-m1',
                title: 'Wallet Fundamentals',
                emoji: '📚',
                lessons: [
                    {
                        id: 'wallets-m1-l1',
                        title: 'What is a Crypto Wallet?',
                        duration: '5 min',
                        content: `# What is a Crypto Wallet?

A [[wallet]] doesn't actually "store" your [[cryptocurrency]] - it stores the keys that prove you own it.

## The Key Concept

Your crypto lives on the [[blockchain]], not in your wallet. Your wallet holds:
- Your [[private key]] (secret, controls funds)
- Your [[public key]] (shareable, your address)

Think of it like email:
- Public key = your email address (share it!)
- Private key = your password (never share!)

## Wallet Types

**Software Wallets (Hot)**
- [[MetaMask]] (browser extension)
- [[Trust Wallet]] (mobile app)
- [[Coinbase]] Wallet (mobile app)

**Hardware Wallets (Cold)**
- [[Ledger]] Nano (USB device)
- [[Trezor]] (USB device)

## Why Wallets Matter

With a wallet, YOU are your own bank. That means:
- ✅ No one can freeze your funds
- ✅ No bank fees or restrictions
- ⚠️ No "forgot password" recovery
- ⚠️ Full responsibility for security

> 🔑 Your keys, your crypto. Not your keys, not your crypto.`,
                        imagePrompt: 'Educational illustration of wallet concept showing digital keys unlocking blockchain coins, with public key as visible address and private key protected behind shield, dark modern style',
                    },
                    {
                        id: 'wallets-m1-l2',
                        title: 'Seed Phrases Explained',
                        duration: '5 min',
                        content: `# Seed Phrases Explained

Your [[seed phrase]] (also called recovery phrase) is the master key to your entire crypto portfolio.

## What Is It?

A seed phrase is typically 12 or 24 random words like:

\`\`\`
apple banana cherry dog elephant frog
grape horse igloo jump kite lemon
\`\`\`

These words mathematically generate ALL your [[private key]]s.

## Why It Matters

**One phrase = infinite wallets**
Your seed phrase can recreate every account, every token, every chain in your wallet.

**Lose it = lose everything**
If you lose your seed phrase AND your device, your crypto is gone forever. No recovery possible.

**Share it = stolen instantly**
Anyone with your seed phrase has complete access to your funds. They don't need your password.

## Storage Best Practices

✅ **Do:**
- Write on paper (or metal plate)
- Store in a fireproof safe
- Keep copies in separate secure locations
- Consider a bank safe deposit box

❌ **Never:**
- Save on your phone or computer
- Take a screenshot
- Email or text it to yourself
- Store in cloud services
- Tell anyone - not even family

> 📝 A seed phrase is like the deed to your house. Protect it the same way.`,
                        imagePrompt: 'Secure seed phrase storage illustration showing 12 words written on paper inside a fireproof safe, with crossed-out phone and cloud icons showing what not to do, dark security theme',
                    },
                ],
                quiz: [
                    {
                        id: 'wallets-m1-q1',
                        question: 'Where is your cryptocurrency actually stored?',
                        options: [
                            'In your wallet app',
                            'On the blockchain',
                            'On your phone',
                            'At the exchange'
                        ],
                        correctIndex: 1,
                    },
                    {
                        id: 'wallets-m1-q2',
                        question: 'What can someone do if they have your seed phrase?',
                        options: [
                            'View your balance only',
                            'Send you crypto',
                            'Control all your funds completely',
                            'Nothing without your password'
                        ],
                        correctIndex: 2,
                    },
                ],
            },
        ],
    },

    // =========================================================================
    // INTERMEDIATE COURSES
    // =========================================================================
    {
        id: 'staking-yield',
        title: 'Staking & Yield Farming',
        emoji: '🌾',
        difficulty: 'intermediate',
        duration: '50 min',
        description: 'Learn how to put your crypto to work. Understand staking, liquidity pools, and yield farming strategies.',
        modules: [
            {
                id: 'staking-m1',
                title: 'Staking Fundamentals',
                emoji: '🥩',
                lessons: [
                    {
                        id: 'staking-m1-l1',
                        title: 'What is Staking?',
                        duration: '6 min',
                        content: `# What is Staking?

[[Staking]] is like earning interest on your [[cryptocurrency]] - but with blockchain security built in.

## How It Works

On [[Proof of Stake]] blockchains like [[Ethereum]], the network needs [[validator]]s to:
- Verify [[transaction]]s are valid
- Add new [[block]]s to the chain
- Keep the network secure

Validators must "stake" (lock up) crypto as collateral. If they act honestly, they earn rewards. If they cheat, they lose their stake ([[slashing]]).

## Types of Staking

**Native Staking**
Lock your tokens directly with the network:
- ETH staking on Ethereum (requires 32 ETH)
- Solana staking on [[Solana]]

**Delegated Staking**
Stake through a [[validator]] without running a node:
- Pool your tokens with others
- Share the rewards proportionally

**Liquid Staking**
Stake and get a tradeable token in return:
- Stake ETH → receive stETH
- Use stETH in [[DeFi]] while earning rewards

## What to Expect

| Network | Typical APY |
|---------|-------------|
| Ethereum | 3-5% |
| Solana | 5-8% |
| Cosmos | 15-20% |

> 🥩 Staking is one of the safest ways to earn yield in crypto. You're helping secure the network and getting paid for it.`,
                        imagePrompt: 'Illustration of staking concept showing coins being locked in a validator node with yield percentage growing upward, network nodes connected in background, purple gradient dark theme',
                    },
                    {
                        id: 'staking-m1-l2',
                        title: 'Staking Risks & Rewards',
                        duration: '5 min',
                        content: `# Staking Risks & Rewards

[[Staking]] isn't risk-free. Let's understand what you're signing up for.

## The Rewards

**Yield (%)**
You earn a percentage return, typically paid in the same token you staked:
- Ethereum: ~4% APY
- Smaller chains: Higher APY but higher risk

**Compound Growth**
Most staking rewards can be restaked, creating compound interest over time.

## The Risks

**Lock-up Periods**
Your tokens may be locked for days or weeks:
- Ethereum: ~days to unstake
- Some protocols: 21-day unbonding

**Price Volatility**
If the token drops 50%, your 10% yield doesn't help much. You're still down.

**[[Slashing]] Risk**
If your validator misbehaves, you might lose some staked funds. Choose reputable validators!

**Smart Contract Risk**
Liquid staking protocols (like Lido) have [[smart contract]] risk. Audits help but don't eliminate risk.

## Is Staking Worth It?

✅ Great for: Long-term holders who believe in the project
❌ Bad for: Short-term traders who need liquidity

> ⚖️ The best stake is one you'd hold anyway. Don't stake just for yield if you don't believe in the token.`,
                        imagePrompt: 'Risk vs reward balance scale illustration with staking rewards on one side and risks like lock periods and volatility on the other, financial chart style on dark background',
                    },
                ],
                quiz: [
                    {
                        id: 'staking-m1-q1',
                        question: 'What do validators need to do to earn staking rewards?',
                        options: [
                            'Complete complex puzzles',
                            'Verify transactions and secure the network',
                            'Hold tokens in a CEX',
                            'Trade frequently'
                        ],
                        correctIndex: 1,
                    },
                    {
                        id: 'staking-m1-q2',
                        question: 'What is "slashing" in proof of stake?',
                        options: [
                            'Earning bonus rewards',
                            'Losing staked funds for misbehavior',
                            'Cutting transaction fees',
                            'Reducing lock-up time'
                        ],
                        correctIndex: 1,
                    },
                ],
            },
            {
                id: 'staking-m2',
                title: 'Yield Farming',
                emoji: '🌾',
                lessons: [
                    {
                        id: 'staking-m2-l1',
                        title: 'Introduction to Yield Farming',
                        duration: '6 min',
                        content: `# Introduction to Yield Farming

[[Yield farming]] takes crypto investing to the next level. It's how DeFi power users maximize returns.

## What Is Yield Farming?

Yield farming means moving your crypto between [[DeFi]] protocols to earn the highest yields. You're essentially lending your capital to protocols in exchange for rewards.

## The Main Strategies

**1. Liquidity Providing**
Deposit tokens into a [[liquidity pool]] to enable trading on [[DEX]]es:
- Earn trading fees (typically 0.3% per trade)
- Often earn bonus token rewards
- Risk: [[Impermanent loss]]

**2. Lending**
Deposit into [[lending protocol]]s like [[Aave]] or [[Compound]]:
- Earn interest from borrowers
- Lower risk than LPing
- Can use deposits as [[collateral]]

**3. LP Token Staking**
Take your [[LP token]]s from providing liquidity and stake them:
- Earn farm tokens on top of trading fees
- Higher yields, more complexity

## Typical Yields

| Strategy | Risk | APY Range |
|----------|------|-----------|
| Stablecoin lending | Low | 2-8% |
| Blue chip LPing | Medium | 5-15% |
| New farm tokens | High | 50-500%+ |

> 🌾 High APY = high risk. If it seems too good to be true, it probably is.`,
                        imagePrompt: 'Yield farming concept showing seeds growing into money trees with percentage yields floating above, DeFi protocol logos as soil nutrients, green growth on dark gradient',
                    },
                ],
                quiz: [
                    {
                        id: 'staking-m2-q1',
                        question: 'What is the main risk of providing liquidity to a pool?',
                        options: [
                            'Gas fees',
                            'Impermanent loss',
                            'Slow transactions',
                            'High minimums'
                        ],
                        correctIndex: 1,
                    },
                ],
            },
        ],
    },

    // =========================================================================
    // ADVANCED COURSES
    // =========================================================================
    {
        id: 'liquidity-deep-dive',
        title: 'Liquidity Pools Deep Dive',
        emoji: '🌊',
        difficulty: 'advanced',
        duration: '60 min',
        description: 'Master the mechanics of AMMs, understand impermanent loss, and learn professional LP strategies.',
        modules: [
            {
                id: 'lp-m1',
                title: 'AMM Mechanics',
                emoji: '⚙️',
                lessons: [
                    {
                        id: 'lp-m1-l1',
                        title: 'How AMMs Work',
                        duration: '8 min',
                        content: `# How AMMs Work

[[AMM]] (Automated Market Maker) is the engine that powers [[DEX]]es like [[Uniswap]]. Understanding AMMs is crucial for advanced DeFi usage.

## The Constant Product Formula

Most AMMs use a simple formula:

**x × y = k**

Where:
- x = quantity of Token A in pool
- y = quantity of Token B in pool
- k = constant that never changes

## How Trading Works

When you [[swap]], you add tokens to one side and remove from the other - but k must stay constant.

**Example:**
Pool has 1000 ETH × 1,000,000 USDC = 1,000,000,000 (k)

You want to buy ETH with 10,000 USDC:
1. USDC in pool: 1,000,000 + 10,000 = 1,010,000
2. Solve for new ETH: 1,000,000,000 ÷ 1,010,000 = 990.1
3. ETH you receive: 1000 - 990.1 = 9.9 ETH

## Price Impact & Slippage

Larger trades move the price more. This is [[slippage]]:
- Small trades: minimal slippage
- Large trades: significant slippage

This is why [[liquidity]] matters - more liquidity = less slippage for traders.

## [[Impermanent Loss]] Preview

The math that makes AMMs work also causes impermanent loss for liquidity providers. We'll cover this in depth next.

> ⚙️ Understanding x×y=k is the key to understanding all of DeFi.`,
                        imagePrompt: 'Technical illustration of AMM formula x*y=k showing curved trading line with pool balance visualization, mathematical formulas floating in space, dark theme with blue accents',
                    },
                ],
                quiz: [
                    {
                        id: 'lp-m1-q1',
                        question: 'In the constant product formula x×y=k, what does k represent?',
                        options: [
                            'The price of the token',
                            'A value that never changes during swaps',
                            'The trading fee',
                            'The number of LPs'
                        ],
                        correctIndex: 1,
                    },
                ],
            },
        ],
    },

    {
        id: 'smart-contract-security',
        title: 'Smart Contract Security',
        emoji: '🔐',
        difficulty: 'advanced',
        duration: '45 min',
        description: 'Learn to evaluate DeFi protocols, read audits, and protect yourself from scams and exploits.',
        modules: [
            {
                id: 'security-m1',
                title: 'Evaluating DeFi Safety',
                emoji: '🛡️',
                lessons: [
                    {
                        id: 'security-m1-l1',
                        title: 'Red Flags & Green Flags',
                        duration: '6 min',
                        content: `# Red Flags & Green Flags

Before aping into any DeFi protocol, learn to spot the warning signs.

## 🚩 Red Flags

**Anonymous Team**
While some legit projects have anon teams, it's a risk factor. No accountability if things go wrong.

**Unaudited Contracts**
No [[audit]] = unknown vulnerabilities. Many hacks target unaudited protocols.

**Unrealistic APY**
Yields of 10,000%+ are mathematically unsustainable. Where does the yield come from?

**Copy-Paste Code**
Forks of forks with no innovation often have hidden backdoors.

**No Timelock**
Developers who can make instant changes can [[rug pull]] at any moment.

## 🟢 Green Flags

**Doxxed, experienced team**
Real identities, verifiable backgrounds, reputation at stake.

**Multiple audits**
Audits from reputable firms (Trail of Bits, OpenZeppelin, Certik).

**Long track record**
Protocols with years of uptime (Aave, Compound, Uniswap).

**Open source code**
Anyone can verify what the code does.

**Governance & DAO**
Community control, not single-owner power.

## Your Checklist

Before depositing:
1. ✅ Search "[protocol name] + audit"
2. ✅ Check TVL on DefiLlama
3. ✅ Read the risks section in docs
4. ✅ Start with a small test amount

> 🔍 [[DYOR]] isn't just a meme. It's survival in DeFi.`,
                        imagePrompt: 'Checklist illustration with red flags and green flags for DeFi safety evaluation, warning signs vs trust indicators, security badge and magnifying glass, dark investigative theme',
                    },
                ],
                quiz: [
                    {
                        id: 'security-m1-q1',
                        question: 'Which is a GREEN flag when evaluating a DeFi protocol?',
                        options: [
                            'Anonymous team',
                            'No smart contract audit',
                            '10,000% APY',
                            'Multiple audits from reputable firms'
                        ],
                        correctIndex: 3,
                    },
                ],
            },
        ],
    },
];
