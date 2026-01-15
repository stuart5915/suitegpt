// Edification Content - Static data for apologetics and philosophical content

export type EdificationCategory = 'insights' | 'apologetics' | 'philosophy' | 'comparative' | 'ancient';

export interface EdificationTopic {
    id: string;
    category: EdificationCategory;
    title: string;
    subtitle: string;
    icon: string;
    challenge: string;       // The critique/objection
    response: string;        // Christian response
    scriptures: string[];    // e.g., ["John 1:1", "Romans 8:28"]
    sources?: string[];      // Attribution
}

export interface EdificationCategoryInfo {
    id: EdificationCategory;
    name: string;
    icon: string;
    description: string;
}

export const CATEGORIES: EdificationCategoryInfo[] = [
    {
        id: 'insights',
        name: 'My Insights',
        icon: '✨',
        description: 'Chat with your past self',
    },
    {
        id: 'apologetics',
        name: 'Apologetics',
        icon: '🛡️',
        description: 'Answers to common objections',
    },
    {
        id: 'philosophy',
        name: 'Philosophy',
        icon: '💭',
        description: 'Engaging with great thinkers',
    },
    {
        id: 'comparative',
        name: 'Comparative Religion',
        icon: '🌍',
        description: 'Understanding other worldviews',
    },
    {
        id: 'ancient',
        name: 'Ancient Wisdom',
        icon: '📜',
        description: 'Timeless philosophical insights',
    },
];

export const TOPICS: EdificationTopic[] = [
    // ============================================
    // APOLOGETICS
    // ============================================
    {
        id: 'contradictions',
        category: 'apologetics',
        title: "Bible Contradictions",
        subtitle: "Isn't the Bible full of errors?",
        icon: '📖',
        challenge: `Critics point to apparent contradictions in the Bible—different accounts of the same event, numerical discrepancies, and seemingly conflicting teachings. How can a book with errors be the Word of God?`,
        response: `Many alleged contradictions dissolve under closer examination:

**1. Different Perspectives, Not Errors**
The Gospels give complementary accounts—like eyewitnesses describing a car accident from different angles. Matthew, Mark, Luke, and John each emphasize different details for different audiences.

**2. Copyist Variations**
Minor numerical differences (like troop counts) often stem from ancient copying practices, not original errors. The core message remains unchanged across 5,800+ Greek manuscripts.

**3. Literary Genres**
The Bible contains poetry, prophecy, history, and wisdom literature. Reading Psalms as scientific textbooks or Revelation as literal journalism misunderstands the genre.

**4. Progressive Revelation**
God revealed truth gradually. Old Testament laws prepared Israel for Christ's fuller revelation—not contradiction, but completion.

The remarkable consistency across 40+ authors over 1,500 years points to divine authorship, not human error.`,
        scriptures: ['2 Timothy 3:16-17', 'Matthew 5:17-18', 'Psalm 119:160'],
    },
    {
        id: 'suffering',
        category: 'apologetics',
        title: "Problem of Evil",
        subtitle: "Why does God allow suffering?",
        icon: '💔',
        challenge: `If God is all-powerful and all-good, why does He allow earthquakes, cancer, child abuse, and genocide? Either He can't stop evil (not all-powerful), doesn't want to (not all-good), or doesn't exist.`,
        response: `This is perhaps the hardest question—but Christianity offers a unique answer:

**1. Free Will's Price**
God created beings capable of genuine love, which requires freedom. Freedom allows rebellion. Much evil flows from human choices, not God's design.

**2. A Fallen World**
Creation itself groans under the weight of sin (Romans 8:22). Natural disasters reflect a world broken by the Fall, awaiting restoration.

**3. God Enters the Suffering**
Unlike distant deities, the Christian God became human and suffered the worst evil—unjust torture and death. Jesus doesn't observe suffering from afar; He experienced it fully.

**4. Redemption Through Pain**
God specializes in bringing good from evil (Genesis 50:20). The worst event in history—the crucifixion—became the source of salvation for millions.

**5. Not the End**
This life is not the whole story. Eternal joy awaits that will make present suffering seem "light and momentary" (2 Corinthians 4:17).`,
        scriptures: ['Romans 8:18-28', 'Genesis 50:20', '2 Corinthians 4:16-18', 'Revelation 21:4'],
    },
    {
        id: 'pagan-myths',
        category: 'apologetics',
        title: "Pagan Parallels",
        subtitle: "Was Jesus copied from myths?",
        icon: '🏛️',
        challenge: `Critics claim Christianity borrowed from earlier pagan myths—dying and rising gods like Osiris, Mithras, and Dionysus. Was Jesus just another recycled solar deity?`,
        response: `This claim, popular on the internet, doesn't hold up to scholarly scrutiny:

**1. Post-Christian "Parallels"**
Many alleged similarities come from mystery religions that post-date Christianity. Mithras' "resurrection" appears in sources from the 2nd-4th century AD—after the Gospels.

**2. Surface-Level Comparisons**
"Dying and rising" is where similarities end. Osiris remained in the underworld. Mithras was born from a rock. The details differ radically from Jesus' historical, bodily resurrection.

**3. Jewish Context**
Christianity emerged from Judaism, not paganism. The disciples were monotheistic Jews who would never adopt pagan mythology. Jesus fulfilled Jewish prophecy, not Greek myths.

**4. Historical Grounding**
Unlike myths set "once upon a time," the Gospels name real rulers (Pontius Pilate, Herod), real places, and real dates. Jesus was executed publicly under Roman law.

**5. C.S. Lewis' Insight**
Lewis noted that if myths contain echoes of resurrection, perhaps God planted "good dreams" in human hearts that Christ fulfilled in history—the Myth became Fact.`,
        scriptures: ['1 Corinthians 15:3-8', 'Luke 1:1-4', '2 Peter 1:16'],
    },
    {
        id: 'hell',
        category: 'apologetics',
        title: "The Justice of Hell",
        subtitle: "How can a loving God send people to hell?",
        icon: '🔥',
        challenge: `A good God wouldn't torture people forever for finite sins. Hell seems like cosmic overkill—infinite punishment for temporal wrongdoing. Isn't this divine cruelty?`,
        response: `Hell is deeply misunderstood. Consider:

**1. Hell as Chosen Separation**
C.S. Lewis wrote: "The doors of hell are locked from the inside." Hell is the ultimate respect for human choice—God allows those who reject Him to have their wish.

**2. Sin Against an Infinite God**
The severity of an offense relates to the one offended. Crimes against infinite holiness have infinite weight. We underestimate sin because we underestimate God.

**3. Jesus Spoke Most About Hell**
The loving Jesus warned about hell more than anyone in Scripture. If He is love incarnate, then hell must be real and avoidable.

**4. Heaven Would Be Hell**
For those who hate God, His eternal presence would be torment. Hell is mercy—giving people the existence they chose.

**5. The Cross Shows the Stakes**
If hell weren't real, why would God become human and die? The cross only makes sense if the alternative was truly terrible.

God doesn't send anyone to hell—He rescues everyone who asks.`,
        scriptures: ['Matthew 25:41', 'Romans 6:23', '2 Peter 3:9', 'John 3:16-18'],
    },
    {
        id: 'exclusivity',
        category: 'apologetics',
        title: "Religious Exclusivity",
        subtitle: "What makes Christianity unique?",
        icon: '✝️',
        challenge: `All religions teach similar morals. Aren't they all paths up the same mountain? Claiming Jesus is the only way seems arrogant and narrow-minded.`,
        response: `This view, while popular, misunderstands what religions actually teach:

**1. Religions Contradict**
Islam says Jesus wasn't crucified; Christianity says He was. Buddhism denies a creator God; Judaism affirms one. Hinduism teaches reincarnation; Christianity teaches resurrection. They can't all be true.

**2. The Grace Distinction**
Every other religion says: "Do these things and maybe earn salvation." Christianity alone says: "Done. Receive the gift." This is a fundamental difference, not a surface variation.

**3. Jesus Made the Claim**
The exclusivity claim comes from Jesus Himself: "I am the way, the truth, and the life. No one comes to the Father except through me" (John 14:6). Either He was wrong, lying, or telling the truth.

**4. Narrow Can Be Right**
Math is exclusive—2+2 only equals 4. Medicine is exclusive—only certain treatments cure cancer. Truth is by nature exclusive. The question is whether Christianity is true.

**5. Inclusive in Invitation**
While the door is narrow, it's open to everyone. "Whoever believes" (John 3:16)—no restrictions by race, gender, class, or past. Exclusive in truth, inclusive in invitation.`,
        scriptures: ['John 14:6', 'Acts 4:12', 'John 3:16', '1 Timothy 2:5'],
    },
    {
        id: 'science-faith',
        category: 'apologetics',
        title: "Science vs. Faith",
        subtitle: "Aren't they incompatible?",
        icon: '🔬',
        challenge: `Science deals with facts; religion deals with feelings. As we learn more through science, we need God less. Faith is for people who can't handle reality.`,
        response: `This "warfare" narrative is historically false:

**1. Christianity Birthed Modern Science**
The scientific revolution happened in Christian Europe, not by accident. Belief in a rational Creator who made an orderly universe gave scientists confidence that nature could be studied.

**2. Giants of Science Were Believers**
Galileo, Newton, Faraday, Maxwell, Pasteur, Lemaitre (who proposed the Big Bang)—devout Christians all. Francis Collins, who led the Human Genome Project, is an outspoken believer.

**3. Different Questions**
Science asks "how"; faith asks "why." Physics explains combustion; it can't tell you whether to use fire to cook dinner or commit arson. Both insights are needed.

**4. Science Has Limits**
Science can't prove logic, mathematics, or its own assumptions (like the uniformity of nature). It can't answer moral questions, aesthetic questions, or questions of meaning.

**5. Fine-Tuning Points Beyond**
The universe's precise calibration for life—gravity, electromagnetic force, expansion rate—suggests a Mind behind the math. Many physicists find this deeply suggestive.`,
        scriptures: ['Psalm 19:1-2', 'Romans 1:20', 'Proverbs 25:2', 'Colossians 1:16-17'],
    },
    {
        id: 'resurrection-evidence',
        category: 'apologetics',
        title: "Resurrection Evidence",
        subtitle: "Did Jesus really rise from the dead?",
        icon: '⬆️',
        challenge: `Dead people don't come back to life. The resurrection is either a legend that grew over time, a hallucination by grieving disciples, or a deliberate hoax. There must be a natural explanation.`,
        response: `Historians recognize several facts that need explanation:

**1. The Empty Tomb**
Even hostile sources admitted the tomb was empty. The Jewish authorities claimed the disciples stole the body—conceding it was gone. If the body remained, they would have produced it.

**2. The Eyewitness Appearances**
Paul lists over 500 witnesses, most still alive when he wrote (1 Corinthians 15:6). This isn't legend—it's a checkable claim. Mass hallucinations don't work; people don't share hallucinations.

**3. The Transformed Disciples**
These men went from hiding in fear to dying for their testimony. People die for what they believe is true, not what they know is a lie. Something happened to transform them.

**4. James and Paul**
Jesus' skeptical brother James became a leader of the church. Saul the persecutor became Paul the apostle. What convinced them? They said: the risen Jesus appeared to them.

**5. The Church's Existence**
Christianity exploded in the very city where Jesus was executed, weeks after his death. If it were false, Jerusalem was the worst place to start—witnesses were everywhere.

The resurrection is the best explanation of the historical data.`,
        scriptures: ['1 Corinthians 15:3-8', 'Acts 2:32', 'Romans 1:4', 'Matthew 28:11-15'],
    },
    {
        id: 'trinity',
        category: 'apologetics',
        title: "The Trinity Explained",
        subtitle: "How can God be three and one?",
        icon: '🔺',
        challenge: `The Trinity makes no sense. 1+1+1=3, not 1. Christians claim monotheism but worship three Gods. This is either polytheism in disguise or logical nonsense.`,
        response: `The Trinity is complex but not contradictory:

**1. What It's Not**
Not three Gods (tritheism). Not one God wearing three masks (modalism). Not one God with two lesser beings (Arianism). These heresies misunderstand the doctrine.

**2. What It Is**
One God existing eternally as three distinct Persons—Father, Son, and Spirit—each fully God, yet one Being. The "what" (essence) is one; the "who" (persons) is three.

**3. Biblical Foundation**
Jesus claims divine names and receives worship. The Spirit is called God and has personal attributes. Yet there is only one God (Deuteronomy 6:4). The Trinity resolves these texts.

**4. Relational Love**
If God is love eternally (before creation), He must have someone to love. The Trinity shows God as eternally relational—love flowing between Persons before anything was made.

**5. Beyond Our Categories**
We have no analogy that perfectly captures it—not water (ice/liquid/steam), not an egg (shell/white/yolk). God's nature transcends human experience. Mystery isn't irrationality.

Mathematical objections fail because persons aren't additive units. 1x1x1=1 is closer—interpenetrating unity.`,
        scriptures: ['Matthew 28:19', 'John 1:1-3', '2 Corinthians 13:14', 'Deuteronomy 6:4'],
    },
    {
        id: 'ot-violence',
        category: 'apologetics',
        title: "Old Testament Violence",
        subtitle: "Why did God command genocide?",
        icon: '⚔️',
        challenge: `The God of the Old Testament commanded the slaughter of entire cities—men, women, and children. The Canaanite conquest was genocide. How can this God be good?`,
        response: `This is one of the hardest questions. Several factors need consideration:

**1. The Severity of Canaanite Sin**
Archaeological evidence confirms extreme practices: child sacrifice (Molech worship), ritual prostitution, and systemic violence. God waited 400 years for their iniquity to reach "full measure" (Genesis 15:16).

**2. Judgment, Not Racism**
This wasn't ethnic cleansing—Israel faced the same judgment for the same sins later. Exile to Babylon came because Israel adopted Canaanite practices. The standard was behavior, not bloodline.

**3. Hyperbolic Language**
Ancient Near Eastern conquest accounts used rhetorical exaggeration ("utterly destroyed") while later texts show survivors (Judges shows ongoing Canaanite presence). This was conventional war language.

**4. God's Prerogative Over Life**
As the Author of life, God has rights over life we don't have. Divine judgment differs from human murder. This doesn't justify human violence—it explains divine judgment.

**5. The Cross as Key**
God ultimately dealt with evil not by destroying sinners but by absorbing the penalty Himself. The violence of the Old Testament points forward to the cross—where wrath and mercy meet.

We wrestle with this honestly, not explaining it away—but trusting the full biblical picture.`,
        scriptures: ['Genesis 15:16', 'Deuteronomy 9:4-5', 'Romans 9:22-23', 'Nahum 1:3'],
    },

    // ============================================
    // PHILOSOPHY
    // ============================================
    {
        id: 'nietzsche',
        category: 'philosophy',
        title: "Nietzsche's Critique",
        subtitle: "Slave morality and the will to power",
        icon: '⚡',
        challenge: `Nietzsche argued that Christianity promotes "slave morality"—a value system created by the weak to restrain the strong. He saw Christian virtues like humility and meekness as resentment dressed up as virtue.`,
        response: `Nietzsche raises a profound challenge that deserves careful response:

**1. He Got the History Right**
Christianity did elevate the poor, weak, and marginalized. That's not a bug—it's the point. Jesus intentionally inverted worldly power structures.

**2. But Misread the Motive**
Christian humility isn't resentment; it's response to grace. We serve not from weakness but from strength—the security of being loved unconditionally.

**3. The Superman Failed**
Nietzsche's alternative—the Übermensch creating his own values—led to horrific 20th century ideologies. Without transcendent morality, might makes right.

**4. Jesus Wasn't Weak**
The same Jesus who said "turn the other cheek" also cleared the temple with a whip. Biblical meekness is strength under control, not weakness.

**5. Nietzsche's Honest Warning**
He correctly predicted that without God, nihilism follows. He wrote: "God is dead... and we have killed him." His madness at life's end illustrated his own philosophy's endpoint.`,
        scriptures: ['Matthew 5:5', 'Philippians 2:5-11', 'Matthew 20:25-28'],
    },
    {
        id: 'existentialism',
        category: 'philosophy',
        title: "Existentialism",
        subtitle: "Creating meaning in an absurd world",
        icon: '🎭',
        challenge: `Sartre declared that existence precedes essence—we're not born with purpose but must create our own meaning. Camus saw life as absurd: we crave meaning in a universe that offers none. Isn't this honest atheism preferable to religious consolation?`,
        response: `Existentialism captures genuine insights but reaches despairing conclusions:

**1. The Problem Is Real**
Existentialists rightly sensed that without God, objective meaning is impossible. Sartre was honest: atheism means we're "condemned to be free"—burdened with creating meaning from nothing.

**2. Created Meaning Isn't Enough**
If I decide my life means something, but the universe says otherwise, who's right? Self-created meaning is just sophisticated wishful thinking. It doesn't answer the absurd—it ignores it.

**3. Camus' Honest Struggle**
Camus opened "The Myth of Sisyphus" asking why we shouldn't commit suicide. He answered: revolt against absurdity. But rebellion assumes the absurd shouldn't be—which implies meaning.

**4. Christianity Agrees (Partly)**
Yes, without God, life is absurd. Ecclesiastes 1:2 says exactly that: "Meaningless, meaningless... everything is meaningless." But it doesn't stop there—meaning exists because God does.

**5. Kierkegaard's Alternative**
The father of existentialism was a Christian. He saw the "leap of faith" not as escapism but as passionate commitment to the God who gives existence its essence.

The hunger for meaning points to the meal.`,
        scriptures: ['Ecclesiastes 1:2-3', 'Ecclesiastes 12:13-14', 'Colossians 1:16-17', 'Acts 17:28'],
    },
    {
        id: 'new-atheism',
        category: 'philosophy',
        title: "The New Atheists",
        subtitle: "Dawkins, Harris, and Hitchens",
        icon: '🧬',
        challenge: `Richard Dawkins calls faith a delusion. Sam Harris says religion poisons everything. Christopher Hitchens argued that "religion poisons everything." Haven't they demolished the intellectual case for God?`,
        response: `The New Atheists are rhetorically powerful but philosophically shallow:

**1. Attacking Strawmen**
Dawkins' arguments in "The God Delusion" were critiqued even by atheist philosophers as amateurish. He argues against a god most theologians don't believe in.

**2. The Science Overreach**
Science can't disprove God because God isn't a scientific hypothesis—He's the ground of all reality. It's like using a metal detector to prove love doesn't exist.

**3. Morality's Foundation**
Harris wants objective morality without God but can't ground it. Why should we maximize wellbeing? "Because I say so" isn't an argument. Hitchens admitted he couldn't solve this.

**4. Historical Blindness**
The "religion poisons everything" claim ignores that Christianity built hospitals, universities, abolished slavery, and inspired human rights. Atheist regimes (Soviet, Maoist) killed more than all religious wars.

**5. Meaning After God**
Dawkins admits the universe has "no design, no purpose, no evil, no good, nothing but pitiless indifference." Then why should we care about anything? The New Atheists can't live their own conclusions.

Their objections reveal emotional rejection more than philosophical rigor.`,
        scriptures: ['Psalm 14:1', 'Romans 1:18-22', 'Proverbs 9:10', '1 Corinthians 1:20-25'],
    },
    {
        id: 'postmodernism',
        category: 'philosophy',
        title: "Postmodern Skepticism",
        subtitle: "Is truth just a power play?",
        icon: '🎲',
        challenge: `Foucault and Derrida taught that "truth" claims are really power claims—the powerful define what's "true" to control others. All narratives are equally valid constructions. Christianity is just another cultural story.`,
        response: `Postmodernism contains valid warnings but self-destructs:

**1. The Self-Refutation**
"There is no objective truth" is presented as... objective truth. "All narratives are power plays" is itself a narrative claiming power. It saws off the branch it sits on.

**2. Valid Concerns**
Postmodernism rightly warned against arrogant claims to total knowledge and exposed how power can masquerade as truth. Christians should humbly agree—we see through a glass darkly.

**3. But Truth Remains**
That powerful people have misused truth claims doesn't mean truth doesn't exist. Exposing counterfeit money proves real money exists. Calling out hypocrisy assumes truth matters.

**4. Christianity's Counterclaim**
Jesus said "I am the truth"—not "I have a perspective." He spoke with authority to powerful and powerless alike. His resurrection wasn't a "narrative"—it either happened or didn't.

**5. Lived Impossibility**
Nobody lives postmodernism. Postmodernists still expect accurate change at the store and true statements from doctors. They're selective skeptics—doubting Christianity while trusting science.

If everything is interpretation, then so is postmodernism—and why believe it?`,
        scriptures: ['John 14:6', 'John 18:37-38', '2 Timothy 3:7', 'Proverbs 23:23'],
    },
    {
        id: 'moral-relativism',
        category: 'philosophy',
        title: "Moral Relativism",
        subtitle: "Who are you to judge?",
        icon: '⚖️',
        challenge: `Morality is subjective—what's wrong for you might be right for someone else. Different cultures have different values. Who are we to impose our moral standards on others? Judging is the only real sin.`,
        response: `Moral relativism sounds tolerant but fails on examination:

**1. Self-Defeating**
"You shouldn't judge" is a judgment. "Imposing morality is wrong" imposes a moral view. Relativists can't state their position without violating it.

**2. No One Believes It**
Relativists still call things evil—racism, genocide, child abuse. They don't say "that's just your culture." When wronged, everyone appeals to a standard beyond preference.

**3. Tolerance Requires Absolutes**
Why should we tolerate different views? That itself is a moral absolute. Relativism can't explain why tolerance is better than intolerance.

**4. Cultural Differences Exaggerated**
C.S. Lewis noted all cultures condemn murder, theft, and lying—though definitions vary. The moral law exists; people disagree about applications.

**5. The Moral Argument**
If objective morality exists—and deep down we know it does—then something grounds it. That ground is what we call God. Morality is evidence, not embarrassment.

"Who are you to judge?" Really means: "Don't apply moral truths to me." But that's not relativism—that's evasion.`,
        scriptures: ['Romans 2:14-15', 'Micah 6:8', 'Romans 1:32', 'Jeremiah 31:33'],
    },

    // ============================================
    // COMPARATIVE RELIGION
    // ============================================
    {
        id: 'islam',
        category: 'comparative',
        title: "Islam & Christianity",
        subtitle: "Same God, different prophets?",
        icon: '☪️',
        challenge: `Muslims honor Jesus as a prophet and worship the same God as Christians. Aren't the differences just theological details? Both faiths share Abraham, monotheism, and moral teaching.`,
        response: `The similarities are real but the differences are foundational:

**1. Who Is Jesus?**
Christianity: Jesus is God incarnate who died for sins and rose again.
Islam: Jesus (Isa) was a prophet, wasn't crucified, wasn't divine, and didn't rise.
This isn't a detail—it's the core.

**2. How Are We Saved?**
Christianity: Grace alone through faith—Jesus did what we couldn't.
Islam: Judgment based on deeds—hope you've been good enough, but no certainty.
These are opposite directions.

**3. God's Nature**
Christian God is Trinity—eternally relational love.
Islamic Allah is absolute unity—unknowable essence, 99 names but no relationship.
The Christian says "Abba, Father"; Islam considers this blasphemous.

**4. Scripture's History**
The Bible: Preserved manuscripts from antiquity, textual tradition traceable.
The Quran: Claims previous scriptures were "corrupted" but offers no evidence, while claiming to supersede them.

**5. Muhammad vs. Jesus**
Jesus: Celibate, nonviolent, died forgiving enemies, rose.
Muhammad: Military leader, multiple wives, ruled by sword.
Both can't be ultimate models for humanity.

We can respect Muslims as people while honestly noting these differences.`,
        scriptures: ['John 1:1', 'John 14:9', '1 John 4:10', 'Galatians 1:8-9'],
    },
    {
        id: 'buddhism',
        category: 'comparative',
        title: "Buddhism & Christianity",
        subtitle: "Enlightenment or salvation?",
        icon: '☸️',
        challenge: `Buddhism offers peace through detachment and mindfulness without needing God. It's practical spirituality—no dogma, no judgment, just technique. Isn't this healthier than sin-focused Christianity?`,
        response: `Buddhism and Christianity diagnose the problem differently—and offer opposite cures:

**1. The Problem**
Buddhism: Suffering comes from desire and attachment.
Christianity: Suffering comes from sin—rebellion against God.
Buddhism sees desire as the enemy; Christianity sees disordered desire as symptomatic.

**2. The Self**
Buddhism: The self is an illusion to be dissolved (anatta).
Christianity: The self is real and eternally significant—worth God dying for.
One eliminates the self; the other redeems it.

**3. The Goal**
Buddhism: Nirvana—the extinguishing of individual existence.
Christianity: Eternal life—perfected relationship with God and others.
Opposite destinies.

**4. The Method**
Buddhism: Self-effort through the Eightfold Path.
Christianity: Received grace through Jesus' completed work.
Earn it yourself vs. accept the gift.

**5. God**
Original Buddhism is agnostic or atheistic—no creator, no savior.
Christianity is thoroughly theistic—personal God who acts in history.

Buddhism offers techniques; Christianity offers a Savior. Mindfulness can reduce stress; it can't forgive sins or conquer death.`,
        scriptures: ['John 10:10', 'Matthew 11:28-30', 'Ephesians 2:8-9', 'Romans 8:1'],
    },
    {
        id: 'hinduism',
        category: 'comparative',
        title: "Hinduism & Christianity",
        subtitle: "Many paths or one truth?",
        icon: '🕉️',
        challenge: `Hinduism teaches that all religions are different paths up the same mountain. It's inclusive and tolerant—accepting Jesus as one avatar among many. Isn't this more enlightened than Christian exclusivism?`,
        response: `Hinduism's inclusivism has its own exclusions:

**1. Contradictory Inclusion**
Saying "all paths are equal" contradicts Christianity (which says they're not). To include Christianity, Hinduism must exclude Christianity's claims. That's not tolerant—it's another exclusive position.

**2. Karma vs. Grace**
Hinduism: You're working off karmic debt through countless reincarnations.
Christianity: One life, followed by judgment—but grace breaks the cycle.
Jesus came not to teach escape but to accomplish rescue.

**3. Identity of God**
Hinduism: Brahman is impersonal ultimate reality; gods are manifestations.
Christianity: God is personal—Three Persons in eternal relationship.
Pantheism and theism are incompatible.

**4. The Problem of Evil**
In Hinduism, suffering is earned karma—even children's suffering.
Christianity: Suffering is a result of the Fall that God enters to heal.
Jesus wept at Lazarus' tomb; karma shrugs.

**5. Jesus' Uniqueness**
Jesus isn't an avatar—a temporary appearance of divinity.
He is God permanently incarnate, bodily risen, and returning.
He didn't teach escape from the material—He redeems it.

The mountain analogy fails because the religions describe different mountains, different peaks, and different paths.`,
        scriptures: ['John 14:6', '1 Timothy 2:5', 'Acts 4:12', 'Hebrews 9:27'],
    },
    {
        id: 'judaism',
        category: 'comparative',
        title: "Judaism & Christianity",
        subtitle: "How did they diverge?",
        icon: '✡️',
        challenge: `Christianity emerged from Judaism but Jews reject Jesus. If God's chosen people don't recognize their Messiah, maybe Jesus wasn't Him? Why should we trust a movement that Judaism itself rejects?`,
        response: `The relationship is deep but the divergence is crucial:

**1. Christianity is Jewish**
Jesus, the apostles, and earliest believers were observant Jews. The New Testament was written by Jews (except possibly Luke). Christianity isn't a departure but a fulfillment.

**2. Messianic Expectations**
First-century Jews expected a conquering king, not a suffering servant. Jesus fulfilled the servant prophecies first (Isaiah 53); His return fulfills the king prophecies.

**3. Why Rejection?**
Not all Jews rejected Jesus—thousands believed (Acts 2:41, 21:20). The leadership that rejected Him had political and religious reasons. Rejection doesn't disprove identity—prophets were often rejected.

**4. Continuity and Completion**
Christians affirm the Hebrew Scriptures as God's Word. We don't replace Israel—we're grafted in (Romans 11). The story continues, not contradicts.

**5. The Temple's End**
In 70 AD, the Temple was destroyed—ending the sacrificial system. If Jesus wasn't the final sacrifice, what now? Judaism adapted; Christianity explained.

We honor Judaism as our root while proclaiming Jesus as Judaism's intended goal.`,
        scriptures: ['Romans 9:4-5', 'Romans 11:17-24', 'Matthew 5:17', 'Hebrews 8:13'],
    },
    {
        id: 'new-age',
        category: 'comparative',
        title: "New Age Spirituality",
        subtitle: "We are all divine?",
        icon: '🔮',
        challenge: `New Age teaches that divinity is within us—we just need to awaken to our true nature. It's spirituality without religion's baggage: no guilt, no exclusivity, just personal growth and cosmic consciousness.`,
        response: `New Age draws from ancient ideas that Christianity has long answered:

**1. Ancient Lie, Modern Package**
"You will be like God" was the serpent's promise in Eden. New Age repackages humanity's oldest temptation—self-deification—in contemporary language.

**2. No Sin, No Savior**
If we're already divine, we don't need salvation—just awakening. But this ignores our actual moral condition. We don't need education; we need transformation.

**3. Impersonal "God"**
New Age "source" or "universe" can't love you—it's an energy, not a Person. Christianity offers relationship with a God who knows your name and counts your hairs.

**4. Moral Confusion**
If all is one and we're all divine, evil becomes illusory or necessary. New Age can't account for real evil that demands real justice.

**5. Jesus Reshaped**
New Age accepts Jesus as "enlightened master" while rejecting His actual claims. The historical Jesus claimed unique deity, demanded exclusive allegiance, and spoke of judgment.

You have a divine spark... implanted by the Creator who remains distinct from creation. Being made in God's image isn't the same as being God.`,
        scriptures: ['Genesis 3:5', 'Isaiah 14:12-15', 'Romans 1:22-23', 'Colossians 1:15-17'],
    },

    // ============================================
    // ANCIENT WISDOM
    // ============================================
    {
        id: 'stoicism',
        category: 'ancient',
        title: "Stoic Philosophy",
        subtitle: "Virtue without God?",
        icon: '🏛️',
        challenge: `Stoicism teaches inner peace through accepting what we can't control and focusing on virtue. Marcus Aurelius, Seneca, and Epictetus offer practical wisdom that works regardless of faith. Isn't this sufficient for the good life?`,
        response: `Stoicism contains much to admire—Paul quotes Stoic insights—but it falls short:

**1. Genuine Wisdom**
Control what you can (character), accept what you can't (circumstances). This echoes Serenity Prayer wisdom. Self-discipline, duty, and virtue are genuinely good.

**2. But Why Be Virtuous?**
Christianity grounds virtue in God's character and commands.
Stoicism struggles to explain why the "Logos" is good or why we should align with it. Without God, virtue is arbitrary preference.

**3. Emotional Suppression**
Stoics aimed for apatheia—freedom from passion. Christianity sanctifies emotions. Jesus wept, felt compassion, experienced righteous anger. We're to feel rightly, not feel nothing.

**4. Cold Comfort**
Stoicism says: accept fate, because that's reality.
Christianity says: grieve, then hope—because resurrection is coming.
One offers resignation; the other, transformation.

**5. No Salvation**
Stoicism is a self-help program—excellent for managing, useless for saving. It can't forgive sin, give eternal life, or reconcile us to God.

Take the practical wisdom; anchor it in Christian truth. The toolkit is useful; it needs the right foundation.`,
        scriptures: ['Acts 17:28', 'Philippians 4:11-13', 'Romans 8:28', 'James 1:2-4'],
    },
    {
        id: 'plato',
        category: 'ancient',
        title: "Platonic Philosophy",
        subtitle: "The world of Forms",
        icon: '📐',
        challenge: `Plato taught that the physical world is just shadows of eternal Forms—perfect ideals of Beauty, Justice, and Goodness. Many Christian ideas seem borrowed from Plato. Was Christianity just Platonism for the masses?`,
        response: `Plato prepared the way but Christianity transforms his insights:

**1. Early Church Engagement**
Christians did use Platonic language—not borrowing but baptizing. Justin Martyr said whatever truth pagans found was Christ's truth scattered abroad.

**2. Key Differences**
Plato: The physical world is bad, to be escaped.
Christianity: The physical world is good, to be redeemed.
God made matter and called it "very good" (Genesis 1:31).

**3. The Form Becomes Flesh**
Plato's Forms are abstract, impersonal ideals you contemplate.
Christianity's Logos became a person you can know.
The Good isn't a concept—it's Jesus.

**4. Resurrection vs. Escape**
Plato: The soul escapes the body at death.
Christianity: The body is raised and glorified.
Radically different hopes.

**5. What Plato Lacked**
Plato could describe the Good but couldn't get us there.
His philosophy illuminates but doesn't save.
Christ bridges the gap Plato could only observe.

Plato saw reflections; Christ is the Reality. The cave hints at what Incarnation reveals.`,
        scriptures: ['John 1:14', 'Colossians 2:8-9', 'Genesis 1:31', 'Romans 8:23'],
    },
    {
        id: 'aristotle',
        category: 'ancient',
        title: "Aristotelian Ethics",
        subtitle: "The golden mean and virtue",
        icon: '⚖️',
        challenge: `Aristotle taught that virtue lies in the mean between extremes—courage between cowardice and recklessness. Happiness comes from excellence of character, not divine intervention. Isn't this practical ethics superior to divine command?`,
        response: `Aristotle's ethics are profound—and point beyond themselves:

**1. Virtue Ethics' Value**
Character matters more than rule-following. Christianity agrees: Jesus emphasized heart over legalism. We become good, not just do good.

**2. The Mean Isn't Always Right**
Sometimes extremes are appropriate. Radical forgiveness, total sacrifice, complete devotion—Jesus models "excessive" love. The cross isn't moderate.

**3. Telos (Purpose)**
Aristotle rightly saw humans have purpose (telos) for which we're designed.
Christianity fills this in: glorifying God and enjoying Him forever.
Without God, human purpose is arbitrary.

**4. Limited Vision**
Aristotle's ethics were for Greek gentlemen with slaves.
Christianity offers ethics for all—slave and free, male and female.
Aristotle couldn't conceive of universal human dignity.

**5. Power to Change**
Aristotle assumed people could become virtuous through practice.
Christianity acknowledges we need grace—moral education fails without heart transformation.
We need regeneration, not just information.

Aristotle mapped the mountain; Christ provides the power to climb it.`,
        scriptures: ['Matthew 22:37-39', 'Galatians 5:22-23', 'Romans 7:18-25', 'Ezekiel 36:26'],
    },
    {
        id: 'ecclesiastes',
        category: 'ancient',
        title: "Solomonic Wisdom",
        subtitle: "Meaninglessness and meaning",
        icon: '👑',
        challenge: `Ecclesiastes seems surprisingly cynical: "Everything is meaningless." The Preacher tried pleasure, wealth, wisdom, and work—all vanity. Is this book depressing realism or ultimate wisdom?`,
        response: `Ecclesiastes is the Bible's philosophy book—and it's meant to disorient:

**1. Honest Starting Point**
The Preacher conducts an experiment: what has meaning "under the sun"—in this world alone? Answer: nothing that lasts. This is honest atheism's conclusion.

**2. The Refrain's Wisdom**
"Meaningless, meaningless" (hebel) can mean vapor, breath, fleeting. Life is brief and puzzling—apart from God. The book isn't denying meaning; it's searching for it.

**3. Failed Substitutes**
Pleasure? Numbs briefly but leaves empty.
Wealth? Can't take it with you.
Work? Someone else inherits.
Even wisdom? The wise die like fools.
Every idol disappoints.

**4. Eat, Drink, Enjoy**
The Preacher's recurring advice: enjoy simple gifts as God's blessings. Don't postpone living while chasing vapor. This isn't hedonism—it's gratitude.

**5. The Conclusion**
"Fear God and keep His commandments, for this is the whole duty of man" (12:13).
After exhausting alternatives, the Preacher lands on faith.
Meaning exists—but only in relationship to God.

Ecclesiastes is an arrow pointing up—you're meant to feel the despair that drives you to the answer.`,
        scriptures: ['Ecclesiastes 1:2', 'Ecclesiastes 2:24-25', 'Ecclesiastes 12:13-14', 'Ecclesiastes 3:11'],
    },
    {
        id: 'proverbs-wisdom',
        category: 'ancient',
        title: "Proverbial Living",
        subtitle: "Practical wisdom for daily life",
        icon: '📖',
        challenge: `Proverbs offers practical life advice—work hard, control your tongue, choose friends wisely. But is this just common sense dressed in religious language? What makes biblical wisdom unique?`,
        response: `Proverbs is intensely practical—and deeply theological:

**1. Wisdom's Foundation**
"The fear of the Lord is the beginning of wisdom" (1:7).
Not ending, not ornament—beginning. All true wisdom starts with rightly relating to God.
Secular wisdom is cut flowers—beautiful but dying.

**2. Wisdom as Person**
Lady Wisdom isn't just abstraction—she was with God "before the beginning" (8:22-31).
The New Testament reveals: Christ is "the wisdom of God" (1 Corinthians 1:24).
We don't just learn principles; we follow a Person.

**3. Two Ways**
Wisdom vs. Folly. Life vs. Death. Light vs. Darkness.
Proverbs insists choices matter eternally.
The wise path isn't always obvious—it requires discernment.

**4. Designed Living**
Proverbs assumes reality has structure—do life God's way and flourish; violate design and suffer.
This isn't legalism; it's wisdom about how creation works.

**5. Limited but True**
Proverbs are generalizations, not promises. Hard work usually prospers (not always). The righteous usually prevail (not always in this life).
Ecclesiastes and Job balance Proverbs' optimism.

Living skillfully requires the Skill-Giver. Technique without relationship is incomplete.`,
        scriptures: ['Proverbs 1:7', 'Proverbs 9:10', 'Proverbs 8:22-31', '1 Corinthians 1:24'],
    },
    {
        id: 'job-suffering',
        category: 'ancient',
        title: "Job's Theodicy",
        subtitle: "When the righteous suffer",
        icon: '🌪️',
        challenge: `Job was blameless, yet lost everything—children, wealth, health. His friends said he must have sinned. God never explained why. Does Job teach that suffering is random and God owes us no answers?`,
        response: `Job is the Bible's deepest exploration of innocent suffering:

**1. Rejecting Simple Answers**
Job's friends represent bad theology—suffering always means sin. Job rightly rejects this (and God later rebukes the friends). The prosperity gospel is ancient error.

**2. The Hidden Battle**
Chapters 1-2 reveal what Job never learns: a cosmic context. Satan challenged whether anyone loves God "for nothing." Job's faithfulness proved genuine love exists.

**3. The Sufferer's Rights**
Job demands an audience with God—and gets it. He doesn't sin by questioning. Lament is biblical; demanding explanation is human. Wrestling with God is relationship, not rebellion.

**4. God's Answer**
God never explains "why." Instead, He reveals "who"—displaying His wisdom in creation. The answer to suffering isn't information but presence. "I had heard of you... now I see you" (42:5).

**5. Restoration with Questions**
Job receives double restoration—but his first children are still dead. The book doesn't resolve everything. It teaches that trusting God doesn't require understanding God.

Job's faith was vindicated without his questions being answered. Sometimes presence is the answer.`,
        scriptures: ['Job 1:21', 'Job 42:5-6', 'Job 38:1-4', 'James 5:11'],
    },
    {
        id: 'psalms-prayer',
        category: 'ancient',
        title: "Psalmic Prayer",
        subtitle: "The full range of human emotion",
        icon: '🎵',
        challenge: `The Psalms are full of violence, vengeance, and despair. "Happy is he who dashes your infants against rocks" (137:9)? How can such prayers be inspired Scripture?`,
        response: `The Psalms teach us to pray honestly—not politely:

**1. Brutal Honesty**
The Psalms give us permission to bring our ugly emotions to God. Rage, despair, vindictiveness—all laid before the throne. Suppressing emotions isn't spirituality.

**2. Imprecatory Context**
Prayers for enemies' destruction must be read in context: the wicked were oppressing the innocent. Calling for God's justice isn't personal revenge—it's trusting God to judge.

**3. Voicing, Not Commanding**
To pray "let my enemies perish" is to voice a feeling to God, not to take action ourselves. Handing vengeance to God is the opposite of taking it ourselves (Romans 12:19).

**4. The Full Range**
Praise, thanksgiving, lament, confession, trust, anger, doubt—the Psalms cover every human experience. Real relationship with God involves all of who we are.

**5. Jesus' Prayerbook**
Jesus prayed Psalms—including Psalm 22 on the cross. The early church sang the Psalms. They're not embarrassments to be hidden but models to be followed.

Bring your real self to God—He can handle it. Fake piety isn't worship.`,
        scriptures: ['Psalm 137:9', 'Psalm 22:1', 'Psalm 23:1', 'Romans 12:19'],
    },
    {
        id: 'prophetic-voice',
        category: 'ancient',
        title: "Prophetic Tradition",
        subtitle: "Speaking truth to power",
        icon: '📢',
        challenge: `The prophets denounced injustice, challenged kings, and predicted doom. Were they just political agitators using religious language? What distinguishes true prophecy from opinion?`,
        response: `The prophets stand unique in religious history:

**1. Not Fortune-Telling**
Biblical prophecy was primarily forth-telling (proclaiming God's word), not foretelling. Less than 5% deals with end times. The core message: return to covenant faithfulness.

**2. Social Justice Roots**
The prophets championed the poor, condemned exploitation, and denounced religious hypocrisy. Amos, Micah, and Isaiah thundered against those who "trample the needy" while offering sacrifices.

**3. Against Their Interest**
True prophets often delivered messages that made them unpopular, persecuted, and killed. They gained nothing materially. False prophets told kings what they wanted to hear.

**4. Predictive Accuracy**
Where prophets did predict—exile to Babylon, return after 70 years, Messiah's birth in Bethlehem—they were vindicated. The track record distinguishes genuine prophecy.

**5. Fulfilled in Christ**
All prophets pointed toward someone greater. Jesus is the Prophet (Deuteronomy 18:15) who doesn't just speak God's word but IS the Word.

The prophetic tradition reminds us: God cares about justice, not just personal piety.`,
        scriptures: ['Amos 5:21-24', 'Micah 6:8', 'Isaiah 1:11-17', 'Hebrews 1:1-2'],
    },
    {
        id: 'torah-law',
        category: 'ancient',
        title: "Torah's Purpose",
        subtitle: "Law before grace?",
        icon: '📜',
        challenge: `The Law of Moses seems harsh and outdated—stoning adulterers, not eating shellfish, elaborate rituals. Christians claim to follow the Bible but ignore most of these laws. Isn't this inconsistent?`,
        response: `Understanding Torah requires understanding its purpose:

**1. Categories Matter**
Theologians distinguish moral law (Ten Commandments), civil law (Israel's constitution), and ceremonial law (sacrificial system). Christians believe civil and ceremonial laws fulfilled their purpose.

**2. Pedagogue Function**
Paul calls the Law a "guardian" (Galatians 3:24) leading to Christ. It revealed sin, demonstrated holiness, and created longing for grace. The Law wasn't the destination—it was the road.

**3. Fulfilled, Not Abolished**
Jesus said He came to fulfill the Law (Matthew 5:17). Sacrificial laws pointed to His sacrifice. Purity laws pointed to His holiness. He doesn't destroy but completes.

**4. Moral Core Remains**
The Ten Commandments (except Sabbath details) are reaffirmed throughout the New Testament. Love God, love neighbor—Jesus summarized all 613 laws in two commands.

**5. Reading Wisdom**
Some laws (like goring ox regulations) were case law showing principles—in this case, responsibility for dangerous property. We apply principles, not always specifics.

The Law was never meant to save—only to reveal need. Grace was always the plan.`,
        scriptures: ['Galatians 3:24-25', 'Matthew 5:17', 'Romans 3:20', 'Matthew 22:37-40'],
    },
    {
        id: 'augustine',
        category: 'ancient',
        title: "Augustine's Insights",
        subtitle: "The restless heart",
        icon: '❤️',
        challenge: `Augustine shaped Western Christianity—original sin, predestination, just war. Was he a theological genius or did he introduce foreign philosophy (especially Plato and Manicheism) that distorted Jesus' simple message?`,
        response: `Augustine remains Christianity's most influential theologian outside Scripture:

**1. Personal Testimony**
Augustine's "Confessions" pioneered autobiography as spiritual reflection. His honest journey through philosophy, heresy, and sensuality resonates still. "Our hearts are restless until they rest in You."

**2. Sin's Depth**
Augustine understood human bondage from experience. His analysis of the will—we're free but inclined toward evil—underlies all Western theology, Protestant and Catholic.

**3. Philosophy Baptized**
Yes, Augustine used Platonic concepts. But he transformed them. Where Plato had abstract Forms, Augustine pointed to a personal Creator. Philosophy served theology, not the reverse.

**4. Critiques Acknowledged**
His views on sexuality, predestination, and church-state relations sparked controversy then and now. Even admirers question whether his pessimism about human nature went too far.

**5. Grace Centered**
Against Pelagius (who taught humans could achieve righteousness), Augustine insisted on absolute grace. Salvation is God's work, not ours. This became Protestant foundation.

Read Augustine critically—but read him. Few have thought more deeply about what it means to be human before God.`,
        scriptures: ['Romans 7:15-25', 'Ephesians 2:8-9', 'John 15:5', 'Psalm 51:5'],
    },

    // ============================================
    // ADDITIONAL APOLOGETICS (to reach 10)
    // ============================================
    {
        id: 'miracles',
        category: 'apologetics',
        title: "The Question of Miracles",
        subtitle: "Can supernatural events occur?",
        icon: '✨',
        challenge: `Science has shown that nature operates by fixed laws. Miracles violate these laws and belong to pre-scientific superstition. Educated people don't believe in supernatural intervention anymore.`,
        response: `The case against miracles is weaker than often assumed:

**1. Hume's Circular Argument**
David Hume argued we should never believe miracle reports because our uniform experience is against them. But this assumes no miracles occur—the very question at issue.

**2. Laws Describe, Not Prescribe**
Natural laws describe how nature normally behaves—they don't say what's possible. If God exists outside nature, He can act within it. Laws are habits, not handcuffs.

**3. Science Presupposes Regularity**
Miracles are only meaningful against a backdrop of regular natural order. Christians invented science precisely because they believed God made an orderly universe. Miracles are exceptions, not chaos.

**4. Historical Question**
Did Jesus rise from the dead? This isn't a science question—it's a history question. We examine evidence, not repeat experiments. Science can't rule out one-time events.

**5. Worldview Bias**
Naturalism (only matter exists) rules out miracles by definition—not discovery. But naturalism is a philosophy, not a scientific conclusion. If God exists, miracles are possible.

The question isn't "do miracles violate science?" but "does God exist?" If so, miracles follow naturally.`,
        scriptures: ['John 3:2', 'Acts 2:22', 'John 10:37-38', 'Hebrews 2:3-4'],
    },

    // ============================================
    // ADDITIONAL PHILOSOPHY (to reach 10)
    // ============================================
    {
        id: 'kant',
        category: 'philosophy',
        title: "Kant's Religion",
        subtitle: "Morality without miracles",
        icon: '🎓',
        challenge: `Immanuel Kant argued that religion should be reduced to morality. We can't know God through reason—only through moral experience. Religion "within the limits of reason alone" means no supernatural beliefs.`,
        response: `Kant revolutionized philosophy—but his view of religion has limits:

**1. Valid Caution**
Kant rightly warned against treating God as an object we can study like other objects. God transcends our categories. Christian theology agrees: God is ultimately mysterious.

**2. But Too Reductive**
Reducing religion to morality strips it of its core. Christianity isn't primarily ethical instruction—it's news about what God has done. The Gospel is announcement, not just advice.

**3. Reason's Limits**
Kant showed that pure reason has boundaries. But he assumed nothing could be known beyond those boundaries. What about revelation—God showing us what reason can't reach?

**4. The Moral Argument**
Ironically, Kant's own moral philosophy points to God. He argued that morality requires the postulates of immortality and God to make sense. His practical reason needs what his theoretical reason denied.

**5. Christ the Paradox**
Kant treated Jesus as a moral example. But Jesus' actual claims—forgiving sins, accepting worship, conquering death—burst Kant's categories. Jesus isn't just teacher; He's Savior.

Kant defined the playing field of modern philosophy. But the Gospel exceeds his boundaries.`,
        scriptures: ['1 Corinthians 1:21-25', 'Romans 1:19-20', 'Romans 2:14-15', 'Hebrews 11:6'],
    },
    {
        id: 'marx',
        category: 'philosophy',
        title: "Marxist Critique",
        subtitle: "Religion as opium?",
        icon: '⚒️',
        challenge: `Marx called religion "the opium of the people"—a drug that numbs the oppressed with promises of heaven while elites exploit them on earth. Religion supports the status quo and must be abolished for true liberation.`,
        response: `Marx's critique reveals half-truths that deserve response:

**1. Legitimate Grievance**
Religion has been misused to justify oppression—from divine right of kings to slaveholder Christianity. Marx rightly condemned such distortions. Christians should too.

**2. But Misread the Drug**
Marx's full quote is more nuanced: religion is "the sigh of the oppressed creature, the heart of a heartless world." Religion expresses genuine pain, not just suppresses it.

**3. Christianity as Liberation**
The Exodus narrative inspired countless liberation movements. Abolitionists were mostly Christians. The Civil Rights movement emerged from Black churches. Faith mobilizes justice.

**4. Marxism's Religious Function**
Marxism itself became a religion—with prophets (Marx), scriptures (Das Kapital), eschatology (classless society), and martyrs. It promised more than it delivered.

**5. Eternity Matters**
If heaven is real, it's not escapism—it's the completion of justice. When wicked prosper and righteous suffer, eternal judgment isn't opium; it's vindication. Marx's materialism can't account for meaning.

The question isn't whether religion can be misused (it can) but whether it's true (it is).`,
        scriptures: ['Luke 4:18-19', 'Amos 5:24', 'Matthew 25:31-46', 'Revelation 6:10'],
    },
    {
        id: 'freud',
        category: 'philosophy',
        title: "Freudian Critique",
        subtitle: "God as wish fulfillment?",
        icon: '🧠',
        challenge: `Freud explained religion as wish fulfillment—the cosmic father figure we invent to comfort ourselves against life's terrors. God is a projection of infantile need for protection. Mature people outgrow religious illusions.`,
        response: `Freud's analysis cuts both ways:

**1. The Genetic Fallacy**
Explaining how a belief arose doesn't show it's false. Even if we wish for a father, that doesn't prove He doesn't exist. Many things we wish for are real.

**2. Atheism as Wish Fulfillment**
Perhaps atheism is wish fulfillment—wishing for no accountability, no judgment, no Authority. Freud himself noted that we might reject God for the same psychological reasons we might invent Him.

**3. Not What We'd Invent**
The Christian God isn't what needy children would create—He's demanding, holy, and judges sin. We'd invent a permissive grandfather, not the God of Abraham, Isaac, and Jacob.

**4. Freud's Own Father Issues**
Freud had a troubled relationship with his own father. Perhaps his atheism was projection? This isn't an argument—just showing the sword cuts both ways.

**5. Truth Claims Remain**
Christianity doesn't primarily claim to meet felt needs (though it does) but to be true. Jesus rose or He didn't. This is a historical question, not a psychological one.

Freud gave us tools for self-examination—we should use them on all our beliefs, including atheism.`,
        scriptures: ['Psalm 14:1', 'Romans 1:18', 'Ecclesiastes 3:11', 'John 14:6'],
    },
    {
        id: 'hume',
        category: 'philosophy',
        title: "Humean Skepticism",
        subtitle: "Can we know anything?",
        icon: '🔍',
        challenge: `David Hume showed that we can't prove causation, induction, or the existence of the external world. All knowledge rests on custom and habit, not reason. Religious knowledge is even more dubious.`,
        response: `Hume's skepticism is powerful—and self-defeating:

**1. Consistent Skepticism Is Impossible**
Hume admitted he couldn't live his skepticism. He played backgammon and dined with friends—activities assuming the reality he questioned. All skeptics smuggle certainty back in.

**2. Reason Trusts Reason**
Hume used reason to undermine reason. But if reason is untrustworthy, why trust his arguments? Skepticism about reason is self-defeating—it uses the tool it attacks.

**3. The Causal Argument Works**
Hume questioned causation—but science, and life, assume it. The cosmological argument for God's existence relies on causation. If causation fails, so does all knowledge.

**4. Religious Experience**
Hume limited knowledge to impressions and ideas. But religious experience provides impressions—millions report God's presence. Hume can't dismiss this without special pleading.

**5. Faith and Reason**
Christianity never claimed reason alone was sufficient. We need revelation because reason has limits. Hume confirmed what theology always said—reason needs help.

Hume helpfully showed reason's boundaries. But the solution isn't less knowledge—it's revelation through Christ.`,
        scriptures: ['Hebrews 11:1', '1 Corinthians 2:14', 'Proverbs 3:5-6', 'John 20:29'],
    },
    {
        id: 'naturalism',
        category: 'philosophy',
        title: "Philosophical Naturalism",
        subtitle: "Is matter all there is?",
        icon: '🌌',
        challenge: `Naturalism holds that only matter and energy exist—no souls, no spirits, no God. Science operates on naturalistic assumptions and has explained everything from lightning to life without invoking the supernatural.`,
        response: `Naturalism is a philosophy, not a scientific discovery:

**1. Science vs. Scientism**
Science is a method for studying the material world. Naturalism is the belief that nothing else exists. You can't use science to prove that only science gives knowledge—that's a philosophical claim.

**2. Consciousness Problem**
Naturalism struggles with consciousness. How does unconscious matter produce subjective experience? Why does anything "feel like" something? Matter and energy don't explain qualia.

**3. Reason's Grounding**
If our brains are just matter following physical laws, why trust our thoughts? Darwin himself worried: "Would anyone trust the convictions of a monkey's mind?" Naturalism undercuts reason.

**4. Moral Reality**
On naturalism, morality is just evolutionary adaptation—not true, just useful. But we all believe some things are really wrong. Naturalism can't account for objective moral facts.

**5. Fine-Tuning Evidence**
The universe's physical constants are precisely calibrated for life. This suggests Mind, not accident. Naturalism can only shrug and say "we got lucky."

Naturalism is a faith commitment—believing only matter exists without being able to prove it.`,
        scriptures: ['Romans 1:20', 'Psalm 19:1', 'Colossians 1:16-17', 'Acts 17:28'],
    },

    // ============================================
    // ADDITIONAL COMPARATIVE (to reach 10)
    // ============================================
    {
        id: 'mormonism',
        category: 'comparative',
        title: "Mormonism & Christianity",
        subtitle: "Another testament?",
        icon: '📕',
        challenge: `Latter-day Saints claim the Book of Mormon as additional scripture and see themselves as restoring Christ's true church. They honor Jesus and the Bible. Aren't they just another denomination?`,
        response: `Despite similar vocabulary, Mormon theology differs radically:

**1. Different God**
Mormonism teaches God was once a man who became divine. Humans can become gods too. This polytheistic progression contradicts biblical monotheism entirely (Isaiah 43:10).

**2. Different Jesus**
In LDS theology, Jesus is the spirit-brother of Lucifer, a separate god from the Father. Biblical Christianity teaches Jesus is eternally God, not a created or exalted being.

**3. Different Salvation**
Exaltation in Mormonism requires temple ceremonies, secret rituals, and ongoing obedience. The grace-alone message of Scripture is supplemented with works requirements.

**4. Different Scripture**
The Bible, Book of Mormon, Doctrine and Covenants, and Pearl of Great Price are all considered scripture. Yet the Book of Mormon lacks archaeological support and contradicts itself historically.

**5. Different Testimony**
Mormonism relies on a subjective "burning in the bosom" feeling. Scripture asks for investigation, evidence, and prophetic accuracy—not just feelings.

Words like "Jesus," "salvation," and "God" mean different things. It's not a denomination—it's a different religion using Christian terminology.`,
        scriptures: ['Isaiah 43:10', 'Isaiah 44:6', 'Galatians 1:8-9', 'John 1:1'],
    },
    {
        id: 'jehovahs-witnesses',
        category: 'comparative',
        title: "Jehovah's Witnesses",
        subtitle: "Who is the faithful organization?",
        icon: '🏠',
        challenge: `Witnesses claim to be the only true Christians, restored by the Watchtower organization. They use the Bible, emphasize God's name, and avoid pagan practices. Why dismiss them as non-Christian?`,
        response: `Jehovah's Witnesses differ from Christianity on core doctrines:

**1. Jesus' Divinity Denied**
JW theology teaches Jesus was Michael the Archangel—a created being. Their New World Translation deliberately mistranslates John 1:1. Yet early Christians worshiped Jesus as God.

**2. No Spirit Person**
The Holy Spirit is reduced to God's "active force"—like electricity—not a Person. This denies the Trinity and contradicts passages where the Spirit speaks, grieves, and decides.

**3. No Hell, No Soul**
JWs teach soul sleep and annihilation. Eternal punishment is denied. This contradicts Jesus' own warnings about "eternal fire" and "weeping and gnashing of teeth."

**4. Organizational Authority**
The Governing Body in Brooklyn claims to be God's sole channel of truth. Members cannot question interpretations. This creates a closed system resistant to correction.

**5. Failed Prophecies**
1914, 1925, 1975—repeatedly predicted dates for Armageddon passed without fulfillment. Deuteronomy 18:22 says failed predictions identify false prophets.

Sincere people follow JW teachings—but sincerity doesn't make something true. Core doctrines contradict Scripture.`,
        scriptures: ['John 1:1', 'John 20:28', 'Matthew 25:46', 'Deuteronomy 18:22'],
    },
    {
        id: 'secular-humanism',
        category: 'comparative',
        title: "Secular Humanism",
        subtitle: "Morality without God?",
        icon: '🧍',
        challenge: `Secular humanism offers ethics based on human flourishing without supernatural beliefs. We don't need God to be good. Humanists often live more ethically than religious people. Isn't this sufficient?`,
        response: `Humanism borrows from Christianity while denying the loan:

**1. Borrowed Capital**
Human dignity, equality, and rights emerged from Christian theology—all humans made in God's image. Secular humanism inherits these values without their foundation.

**2. No Grounding**
Why should we value human flourishing? Evolution says: survive and reproduce. Any behavior achieving that is "natural." Humanism assumes moral truths it can't justify.

**3. Human Record**
The 20th century's most destructive regimes were explicitly secular—Soviet Russia, Maoist China, Nazi Germany. Removing God didn't produce utopia but horror.

**4. What Humans?**
Whose flourishing? Humanism can't resolve conflicts without appeal to something beyond human opinion. Slave owners also claimed to be benefiting humanity.

**5. Death's Veto**
On humanism, death ends everything. All human achievement dissolves into cosmic heat death. This makes all striving ultimately meaningless—a thought humanists rarely face.

Humanists can live morally—they're made in God's image. But their philosophy can't explain why they should.`,
        scriptures: ['Romans 2:14-15', 'Psalm 14:1', 'Jeremiah 17:9', 'Genesis 1:27'],
    },
    {
        id: 'atheism-worldview',
        category: 'comparative',
        title: "Atheism as Worldview",
        subtitle: "Life without God",
        icon: '⭕',
        challenge: `Atheism simply lacks belief in God—no more, no less. It's not a religion or worldview, just absence of one particular belief. Atheists can believe anything else and live however they want.`,
        response: `Atheism has more implications than often admitted:

**1. Not Neutral**
Saying "there is no God" is a claim—requiring justification. Agnosticism admits uncertainty; atheism makes a knowledge claim. Both have burden of proof.

**2. Worldview Consequences**
If no God: no objective meaning (we create our own, or none exists), no objective morality (societies construct values), no afterlife (death is final), no cosmic justice.

**3. Living Consistently**
Few atheists live these conclusions. They love, create, fight injustice—all assuming meaning and morality. The head denies what the heart knows.

**4. Faith Required**
Atheism requires faith that the universe is self-explanatory, consciousness emerged from matter, moral intuitions are trustworthy despite evolutionary origins, and meaning can come from meaninglessness.

**5. Existential Costs**
Albert Camus asked the right question: why not suicide? If life is absurd, what justifies continued existence? Atheists often live beautiful lives—but struggle to justify them philosophically.

Christianity says: your sense of meaning, morality, and significance is accurate. Reality matches your deepest intuitions.`,
        scriptures: ['Romans 1:20', 'Ecclesiastes 3:11', 'Acts 17:27-28', 'Psalm 19:1'],
    },
    {
        id: 'mysticism',
        category: 'comparative',
        title: "Mystical Traditions",
        subtitle: "Experience beyond doctrine",
        icon: '🌟',
        challenge: `Mystics across all religions describe similar experiences—union with the divine, ego dissolution, ineffable bliss. Doesn't this suggest all religions access the same reality? Doctrine divides; experience unites.`,
        response: `Mystical experience raises important questions:

**1. Similar Experiences, Different Interpretations**
A Buddhist's "emptiness" and a Christian's "union with God" may feel similar but mean opposite things. The experience is filtered through interpretation. Context matters.

**2. Experience Can Deceive**
Not all experiences are trustworthy. Brain states can be induced chemically. Subjective experiences require testing against revealed truth. Scripture warns about deceiving spirits.

**3. Christian Mysticism Distinct**
Christian mystics (Teresa of Avila, John of the Cross) emphasized that experience must align with Scripture and church teaching. They described relationship, not dissolution.

**4. Content Matters**
Jesus made historical claims—crucifixion, resurrection, return. These aren't mystical experiences but events in space and time. Christianity is faith about facts, not just feelings.

**5. Dangers of Experience Focus**
Seeking experience can become its own idolatry—valuing the feeling over the God who gives it. True spirituality is faithfulness, not feelings.

Experience without doctrine is blind; doctrine without experience is dead. We need both—rightly ordered.`,
        scriptures: ['1 John 4:1', '2 Corinthians 11:14', 'Colossians 2:18-19', 'John 4:24'],
    },
];

// Helper to get topics by category
export function getTopicsByCategory(category: EdificationCategory): EdificationTopic[] {
    return TOPICS.filter(t => t.category === category);
}

// Helper to get topic by ID
export function getTopicById(id: string): EdificationTopic | undefined {
    return TOPICS.find(t => t.id === id);
}
