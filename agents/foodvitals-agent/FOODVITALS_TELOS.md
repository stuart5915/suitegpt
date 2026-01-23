# FoodVitals Telos

This document defines what FoodVitals is, its mission, and the context you need to make good decisions.

---

## What is FoodVitals?

FoodVitals is a **weekly meal tracking and AI nutritional insights app**. It helps users understand their nutrient intake patterns and get personalized recommendations for healthier eating.

### Core Purpose
Help users identify nutrient gaps in their diet and get personalized food and meal suggestions to improve their nutrition.

### How It Works
1. **Meal Logging** - Users log their meals throughout the week (manual entry or photo/label scanning)
2. **Nutrient Analysis** - AI analyzes micro and macro nutrient intake across the week
3. **Gap Detection** - Identifies what nutrients users are missing or getting too much of
4. **Smart Suggestions** - Provides personalized food and meal recommendations to fill gaps

### Platform
- Currently: suite-shell (PWA web app)
- Planned: iOS and Android native apps

### Monetization
- Integrated with SUITE credit system
- Premium features available for credits

---

## Target User

### Primary Persona: "Health-Curious Busy Professional"
- **Age:** 25-45
- **Lifestyle:** Works full-time, limited time for detailed tracking
- **Motivation:** Wants to eat healthier but overwhelmed by nutrition complexity
- **Pain Point:** Knows they should "eat better" but doesn't know what they're actually missing
- **Behavior:** Will track for a week if it's easy, drops off if tedious
- **Value Proposition:** "Know your gaps, not just your calories"

### Secondary Persona: "Fitness Optimizer"
- **Age:** 20-35
- **Lifestyle:** Active, gym-goer, already tracks workouts
- **Motivation:** Optimize performance through nutrition
- **Pain Point:** Macros are easy, micronutrients are confusing
- **Behavior:** Willing to put in effort if results are clear
- **Value Proposition:** "The missing piece of your fitness stack"

### Anti-Persona (NOT our target)
- Calorie-counting obsessives (they use MyFitnessPal and love it)
- People with eating disorders (we don't want to trigger unhealthy behavior)
- Users wanting medical nutrition advice (we're not doctors)

---

## Competitors & Differentiation

### Direct Competitors

| App | Strength | Weakness | Our Advantage |
|-----|----------|----------|---------------|
| **MyFitnessPal** | Huge food database, brand recognition | Focused on calories, micronutrients buried | We surface gaps, not just totals |
| **Cronometer** | Detailed micronutrient tracking | Complex UI, intimidating for beginners | We're simpler, AI does the analysis |
| **Yazio** | Clean UI, meal plans | Generic plans, not personalized to gaps | We analyze YOUR gaps specifically |
| **Noom** | Behavior change focus | Expensive coaching model, $200+/yr | We're affordable via SUITE credits |
| **Lose It!** | Weight loss focus | Single metric (weight), ignores nutrition quality | We focus on nutrient quality |

### Our Unique Position
FoodVitals is **not** a calorie counter. We're a **nutrient gap analyzer**.

- Others: "You ate 2,000 calories today"
- FoodVitals: "You're low on Vitamin D, magnesium, and fiber this week. Here are foods that fix all three."

### Competitive Moat
1. **AI-powered gap analysis** - Not just showing data, interpreting it
2. **Weekly view** - Less obsessive than daily, more actionable than monthly
3. **SUITE ecosystem** - Cross-app benefits competitors can't match
4. **Suggestion engine** - We tell you what to eat, not just what you ate

---

## Current App State

### What Exists Today (v1.0)
- ✅ Manual meal logging (text entry)
- ✅ Basic nutrition database (~50,000 foods)
- ✅ Daily nutrient breakdown view
- ✅ Simple food label scanning (OCR)
- ✅ User profile with basic preferences
- ✅ SUITE credit integration

### What's Partially Built
- 🟡 Weekly dashboard (designed, not implemented)
- 🟡 AI recommendations (prototype, needs refinement)
- 🟡 Barcode scanning (integrated but unreliable)

### What Doesn't Exist Yet
- ❌ Photo-based meal logging
- ❌ Nutrient gap alerts/notifications
- ❌ Meal planning features
- ❌ Social/sharing features
- ❌ Health app integrations (Apple Health, Google Fit)
- ❌ Offline mode
- ❌ Family/household accounts

### Known Technical Debt
- OCR accuracy is ~70% (needs improvement)
- Database missing many store brands
- No caching = slow repeated lookups
- Mobile PWA performance issues on older phones

---

## Technical Context

### Tech Stack
- **Frontend:** React (PWA via suite-shell)
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **AI:** OpenAI API for recommendations
- **OCR:** Google Cloud Vision API
- **Hosting:** Vercel (frontend), Supabase (backend)

### Codebase Location
- Main app: `suite-shell` repository
- FoodVitals module: `/apps/foodvitals/`
- Shared components: `/packages/ui/`

### API Budget Constraints
- OpenAI: ~$50/month current spend, can scale to $200/month
- Google Cloud Vision: ~$20/month, can scale to $100/month
- Total API budget ceiling: $500/month

### Performance Targets
- Meal log: < 3 seconds
- Label scan: < 5 seconds
- AI recommendation: < 10 seconds
- App load: < 2 seconds

### Integration Points
- SUITE auth (shared login)
- SUITE credits (payment)
- Supabase real-time (sync)

---

## What Users Love

Based on positive reviews and feedback:

**Top Praise:**
1. "Finally understand what I'm actually missing" - 34% of positive reviews
2. "So much simpler than MyFitnessPal" - 28% of positive reviews
3. "Love the weekly view, less obsessive" - 19% of positive reviews
4. "AI suggestions are actually helpful" - 12% of positive reviews

**Features to Protect:**
- Simple, clean interface (don't over-complicate)
- Weekly perspective (don't force daily tracking)
- AI-generated suggestions (this is the magic)
- Quick logging flow (don't add friction)

**User Quotes:**
> "I tried every nutrition app and gave up. FoodVitals is the first one that stuck because it doesn't make me feel bad about what I eat - it just tells me what to add."

> "The weekly summary is genius. I don't stress about one bad meal anymore."

> "Finally an app that tells me to eat MORE of something instead of less of everything."

---

## Core Features

### Primary Features (What FoodVitals IS)

**1. Meal Logging & Tracking**
- Log meals throughout the week
- Build weekly eating patterns
- Photo-based meal logging
- Quick-add for common foods

**2. Nutrient Gap Analysis**
- Weekly micro/macro nutrient breakdown
- Visual gap identification
- Trend tracking over time
- Personalized deficiency alerts

**3. AI-Powered Recommendations**
- Personalized food suggestions to fill gaps
- Meal ideas based on preferences
- Alternative food recommendations
- Dietary goal alignment

**4. Editable Profile Goals**
- Personalized nutrition targets
- Dietary preferences (vegan, keto, etc.)
- Allergen exclusions
- Health condition considerations

### Secondary Features (Utilities)

**5. Food Label Scanning**
- Scan labels to quickly log foods
- OCR extraction of nutrition facts
- Barcode lookup fallback
- Ingredient breakdown

**6. Health Scoring**
- Per-food health scores
- Ingredient quality analysis
- Additive warnings

---

## Mission Statement

Grow FoodVitals to **10,000 monthly active users** and establish it as the premier meal tracking and AI nutrition insights app in the SUITE ecosystem. Help users make healthier food choices through personalized nutrient gap analysis and smart recommendations.

---

## Success Metrics

| Metric | Current | Target | Priority |
|--------|---------|--------|----------|
| Monthly Active Users | ~500 | 10,000 | Primary |
| App Store Rating | 4.2 | 4.5+ | High |
| Monthly Revenue | $200 | $5,000 | Medium |
| 30-Day Retention | ~25% | 40% | High |
| Weekly Meals Logged per User | 5 | 15+ | High |
| Premium Conversion | 2% | 8% | Medium |

---

## Strategic Priorities

### Priority 1: Core Meal Tracking Experience
The foundation of FoodVitals - make logging meals fast and valuable.
- Frictionless meal logging (under 30 seconds)
- Smart meal suggestions based on history
- Weekly nutrition dashboard
- Clear visualization of nutrient gaps

### Priority 2: AI Nutrition Insights
The differentiator - personalized intelligence that drives retention.
- Personalized nutrient gap analysis
- AI food recommendations to fill gaps
- Meal planning assistance
- Health trend insights over time

### Priority 3: Profile & Goals
Personalization that makes recommendations relevant.
- Editable nutrition goals
- Dietary preference support
- Allergen management
- Health condition awareness

### Priority 4: Scanning & Quick Entry
Utility features that reduce friction.
- Fast label scanning
- Better OCR accuracy on damaged labels
- Barcode fallback for failed scans
- Offline mode for common products

### Priority 5: Organic Discovery
Create content and features that drive organic growth.
- Shareable nutrition cards
- Educational content about nutrients
- Social features (sharing progress)
- SEO-optimized web presence

### Priority 6: Ecosystem Integration
Build connections with other SUITE apps.
- Cheshbon: Log food purchases from receipts
- OpticRep: Nutrition timing for workouts
- RemCast: Meal prep reminders
- Notebox: Save nutrition insights

### Priority 7: Monetization
Sustainable revenue without compromising core experience.
- Premium features (detailed analysis, export)
- Family/household plans
- API access for developers

---

## Current User Feedback

Based on recent reviews and feedback:

**Top Complaints:**
1. "Scanning is slow on some labels" - 23% of negative feedback
2. "Doesn't recognize store brands" - 18% of negative feedback
3. "Want more detailed breakdown" - 15% of negative feedback
4. "Crashes when scanning multiple items" - 12% of negative feedback

**Top Requests:**
1. Barcode scanning option
2. Save favorite products
3. Compare two products side-by-side
4. Family sharing
5. Integration with health apps (Apple Health, Google Fit)
6. Weekly meal planning feature
7. Better nutrient gap visualization

---

## What You Can Propose

### Approved Categories
- Feature improvements (new features, enhancements)
- Bug fixes (addressing user complaints)
- UX improvements (flow, design, accessibility)
- Content initiatives (articles, social, marketing)
- Integration proposals (other apps, APIs)
- Pricing/monetization changes
- Partnership ideas

### Requires Extra Justification
- Major architectural changes
- Third-party service integrations (cost implications)
- Changes affecting other SUITE apps
- Pricing model changes

### Out of Scope
- Changes to SUITE infrastructure
- Token/crypto related features
- Hiring decisions
- Budget allocation beyond app scope

---

## Learned Patterns

Patterns learned from past proposals:

### Patterns That Lead to Rejection

**Too Broad:**
- Proposals covering multiple unrelated features
- "Complete redesign" or "overhaul" type proposals
- Integrating with many platforms at once

**Wrong Priority:**
- Marketing before core issues are fixed
- Nice-to-have features before must-have ones
- Complex features before simple ones work well

**Missing Justification:**
- Adding features without citing user data
- Changes without explaining expected impact
- Technical proposals without business rationale

**Out of Scope:**
- Changes affecting SUITE infrastructure
- Token/crypto related features
- Other apps in the ecosystem
- Budget or hiring decisions

### Patterns That Lead to Approval

**Focused Scope:**
- Single, specific feature or improvement
- Clear start and end points
- Achievable in one iteration

**Strong Justification:**
- Tied to specific user feedback
- Connected to success metrics
- Clear expected impact

**Practical Approach:**
- Realistic implementation plan
- Builds on existing foundation
- Minimal dependencies

---

## SUITE Ecosystem Context

FoodVitals is part of the SUITE app ecosystem.

### How FoodVitals Fits
- SUITE apps share users through cross-promotion
- Revenue is distributed via the SUITE yield system
- Apps can propose features that benefit the whole ecosystem
- Governance happens through the Factory dashboard

### Cross-App Integrations (Potential)
- **Cheshbon** (expense tracking): Auto-log food purchases from receipts
- **OpticRep** (fitness): Nutrition timing around workouts
- **RemCast** (reminders): Meal prep and logging reminders
- **Notebox** (notes): Save and organize nutrition insights

---

## Remember

- Every proposal should tie back to one of your success metrics
- Small, focused proposals are better than large, vague ones
- Learn from rejection - it's data, not failure
- Your ultimate goal is USER VALUE, metrics follow from that
- Be patient - growth is iterative
- FoodVitals is about **weekly meal tracking + AI insights**, not just label scanning
