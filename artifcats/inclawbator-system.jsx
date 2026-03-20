import { useState } from "react";

const TABS = [
  "System Overview",
  "Token Launch",
  "Auto-Staking",
  "Fee Architecture",
  "Example Numbers",
  "Migration Path",
  "NFT Endgame",
  "Flywheel",
  "Discovery Layer",
];

const C = {
  bg: "#0a0a0f",
  card: "#12121a",
  cardHover: "#1a1a25",
  border: "#1e1e2e",
  borderActive: "#e84545",
  red: "#e84545",
  redDim: "#e8454533",
  gold: "#d4a017",
  goldDim: "#d4a01733",
  green: "#2ecc71",
  greenDim: "#2ecc7133",
  blue: "#3498db",
  blueDim: "#3498db33",
  purple: "#9b59b6",
  purpleDim: "#9b59b633",
  orange: "#e67e22",
  orangeDim: "#e67e2233",
  cyan: "#00d2ff",
  cyanDim: "#00d2ff33",
  white: "#f0f0f0",
  grey: "#888899",
  darkGrey: "#555566",
  textDim: "#666677",
};

const fonts = {
  heading: "'DM Mono', 'Courier New', monospace",
  body: "'DM Sans', 'Segoe UI', sans-serif",
  mono: "'DM Mono', 'Courier New', monospace",
};

function Tag({ color, children }) {
  const bg = color + "22";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: "4px",
        fontSize: "11px",
        fontFamily: fonts.mono,
        fontWeight: 600,
        color: color,
        background: bg,
        border: `1px solid ${color}44`,
        letterSpacing: "0.5px",
      }}
    >
      {children}
    </span>
  );
}

function FlowArrow({ label, color = C.grey, direction = "down", style: customStyle = {} }) {
  const arrow = direction === "down" ? "↓" : direction === "right" ? "→" : "↓";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: direction === "right" ? "row" : "column",
        alignItems: "center",
        gap: "4px",
        padding: direction === "right" ? "0 8px" : "8px 0",
        ...customStyle,
      }}
    >
      {label && (
        <span style={{ fontSize: "10px", fontFamily: fonts.mono, color: C.textDim, letterSpacing: "0.5px" }}>
          {label}
        </span>
      )}
      <span style={{ fontSize: "18px", color, lineHeight: 1 }}>{arrow}</span>
    </div>
  );
}

function Box({ title, items, color, icon, accent, footer, style: customStyle = {} }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${color}44`,
        borderLeft: `3px solid ${color}`,
        borderRadius: "8px",
        padding: "16px",
        ...customStyle,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: items || footer ? "12px" : 0 }}>
        {icon && <span style={{ fontSize: "18px" }}>{icon}</span>}
        <span
          style={{
            fontFamily: fonts.heading,
            fontSize: "13px",
            fontWeight: 700,
            color: color,
            letterSpacing: "0.5px",
          }}
        >
          {title}
        </span>
        {accent && (
          <Tag color={color}>{accent}</Tag>
        )}
      </div>
      {items && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                fontSize: "12px",
                fontFamily: fonts.body,
                color: C.white,
                paddingLeft: "12px",
                borderLeft: `1px solid ${color}33`,
                lineHeight: 1.5,
              }}
            >
              {item}
            </div>
          ))}
        </div>
      )}
      {footer && (
        <div
          style={{
            marginTop: "12px",
            paddingTop: "10px",
            borderTop: `1px solid ${color}22`,
            fontSize: "11px",
            fontFamily: fonts.mono,
            color: C.textDim,
            lineHeight: 1.5,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div
      style={{
        background: color + "11",
        border: `1px solid ${color}33`,
        borderRadius: "8px",
        padding: "14px 18px",
        textAlign: "center",
        flex: 1,
        minWidth: "140px",
      }}
    >
      <div style={{ fontSize: "22px", fontFamily: fonts.heading, fontWeight: 700, color, marginBottom: "4px" }}>
        {value}
      </div>
      <div style={{ fontSize: "11px", fontFamily: fonts.mono, color: C.textDim, letterSpacing: "0.5px" }}>
        {label}
      </div>
    </div>
  );
}

function SectionTitle({ children, color = C.white }) {
  return (
    <div
      style={{
        fontFamily: fonts.heading,
        fontSize: "16px",
        fontWeight: 700,
        color,
        marginBottom: "16px",
        paddingBottom: "8px",
        borderBottom: `1px solid ${C.border}`,
        letterSpacing: "0.5px",
      }}
    >
      {children}
    </div>
  );
}

function Callout({ text, color = C.gold, icon = "💡" }) {
  return (
    <div
      style={{
        background: color + "11",
        border: `1px solid ${color}33`,
        borderRadius: "8px",
        padding: "14px 18px",
        display: "flex",
        gap: "10px",
        alignItems: "flex-start",
      }}
    >
      <span style={{ fontSize: "16px" }}>{icon}</span>
      <span style={{ fontSize: "12px", fontFamily: fonts.body, color: C.white, lineHeight: 1.6 }}>{text}</span>
    </div>
  );
}

function FlowStep({ number, title, desc, color }) {
  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
      <div
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "50%",
          background: color + "22",
          border: `2px solid ${color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: fonts.mono,
          fontSize: "12px",
          fontWeight: 700,
          color,
          flexShrink: 0,
        }}
      >
        {number}
      </div>
      <div>
        <div style={{ fontFamily: fonts.heading, fontSize: "13px", fontWeight: 700, color, marginBottom: "4px" }}>
          {title}
        </div>
        <div style={{ fontSize: "12px", fontFamily: fonts.body, color: C.grey, lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
}

// ======================== TAB CONTENT ========================

function SystemOverview() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ fontSize: "13px", fontFamily: fonts.body, color: C.grey, lineHeight: 1.7 }}>
        Inclawbator is a permissionless launchpad that automates what Inclawbate does manually. Anyone can launch a token, attach it to a business or app, and receive full staking infrastructure with yield from day one. Every token launched feeds $INCLAW through automated fee routing.
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
        <StatBox label="FEE ON TRADES" value="1%" color={C.red} />
        <StatBox label="MIN TO $INCLAW" value="20%" color={C.gold} />
        <StatBox label="MAX TO CREATOR" value="80%" color={C.green} />
        <StatBox label="CREATOR CHOOSES" value="20-100%" color={C.cyan} />
      </div>

      <SectionTitle>Core Architecture</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Box
          title="INCLAWBATOR"
          icon="🚀"
          color={C.red}
          accent="LAUNCHPAD"
          items={[
            "1-click token launch",
            "Human or AI agent operated",
            "Auto-staking infrastructure",
            "Creator chooses fee split (min 20%)",
            "Category-based discovery",
          ]}
        />
        <Box
          title="$INCLAW"
          icon="🔴"
          color={C.gold}
          accent="PLATFORM TOKEN"
          items={[
            "Launched on Clanker Direct",
            "100% fee capture on own trading",
            "UBI reward token for all pools",
            "Buy pressure from every launched token",
            "Burns into NFTs at endgame",
          ]}
        />
        <Box
          title="AUTO-STAKING"
          icon="🔒"
          color={C.green}
          accent="INFRASTRUCTURE"
          items={[
            "Every launched token gets staking",
            "Stakers earn $INCLAW rewards",
            "Rewards activate at first $1 traded",
            "No setup required from project",
            "Scalable to 500+ pools",
          ]}
        />
        <Box
          title="NFT ENDGAME"
          icon="🖼️"
          color={C.purple}
          accent="OWNERSHIP LAYER"
          items={[
            "Fixed supply NFT collection",
            "Minted by burning $INCLAW",
            "Earns ETH from platform revenue",
            "True store of value",
            "Zero fee leak to anyone",
          ]}
        />
      </div>

      <Callout
        text="Every token launched feeds $INCLAW — minimum 20% of all trading fees, up to 100% if the creator chooses maximum community alignment. Inclawbate earns by holding $INCLAW and deploying treasury into yield strategies. The platform's revenue is the store of value itself."
        color={C.red}
        icon="🦞"
      />
    </div>
  );
}

function TokenLaunch() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SectionTitle>1-Click Token Launch Flow</SectionTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <FlowStep
          number="1"
          title="Creator Arrives"
          desc="Human or AI agent with a business idea, app, or project. Connects wallet to inclawbator.com."
          color={C.blue}
        />
        <FlowStep
          number="2"
          title="Define Token"
          desc="Name, ticker, description, category. Optionally connect existing app/business URL or define new concept."
          color={C.blue}
        />
        <FlowStep
          number="3"
          title="Choose Fee Split"
          desc="Creator decides how much of the 1% trading fee goes to $INCLAW stakers vs their own treasury. Minimum 20% to stakers. Can go up to 100% for maximum community alignment. Set at launch."
          color={C.gold}
        />
        <FlowStep
          number="4"
          title="Launch"
          desc="Token deploys on Base. 1% buy/sell fee auto-configured with chosen split. LP auto-deployed. Staking pool auto-created. Creator can stake their own token immediately."
          color={C.green}
        />
        <FlowStep
          number="5"
          title="Fees Activate"
          desc="As soon as >$1 is traded on the token, fee routing goes live. Chosen % buys $INCLAW and distributes to stakers over 30-day rolling period. Creator earns by staking their own bag."
          color={C.red}
        />
        <FlowStep
          number="6"
          title="Ecosystem Connected"
          desc="Token appears on discovery page. Staking pool visible to all users. Project joins the Inclawbator ecosystem automatically."
          color={C.blue}
        />
      </div>

      <SectionTitle>What the Creator Gets</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Box
          title="AUTOMATIC"
          color={C.green}
          icon="⚡"
          items={[
            "Token deployed on Base",
            "LP auto-provisioned",
            "1% fee router with chosen split",
            "Staking pool created",
            "$INCLAW reward allocation",
            "Discovery page listing",
          ]}
          footer="Zero infrastructure work required"
        />
        <Box
          title="CREATOR EARNS BY"
          color={C.blue}
          icon="💰"
          items={[
            "Staking their own token (earn $INCLAW)",
            "Keeping remainder of fee split (if <100%)",
            "Product/service revenue (subscriptions, etc)",
            "Being biggest staker = biggest $INCLAW earner",
            "Token appreciation from ecosystem growth",
            "$INCLAW appreciation from platform growth",
          ]}
          footer="Aligned incentives — creators must believe in their own token"
        />
      </div>

      <SectionTitle>Who Launches?</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
        <Box
          title="HUMAN BUILDERS"
          color={C.green}
          icon="👤"
          items={["Apps & SaaS", "Content creators", "Service businesses", "Communities"]}
        />
        <Box
          title="AI AGENTS"
          color={C.purple}
          icon="🤖"
          items={["App owners (70+ ready)", "Marketing agents", "Trading agents", "Autonomous businesses"]}
        />
        <Box
          title="INCUBATED PROJECTS"
          color={C.gold}
          icon="🦞"
          items={["MirrorMind", "Fight Farm", "Basis", "Vestine", "S4H"]}
        />
      </div>
    </div>
  );
}

function AutoStaking() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SectionTitle>Every Token Gets Staking — Automatically</SectionTitle>

      <div style={{ fontSize: "13px", fontFamily: fonts.body, color: C.grey, lineHeight: 1.7 }}>
        This is the core differentiator from pump.fun, Clanker, or any other launchpad. On those platforms you launch a token and... that's it. Pray people buy it. On Inclawbator, every token has staking infrastructure from day one with real yield in $INCLAW. There's immediately a reason to hold beyond speculation.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Box
          title="HOW IT WORKS"
          color={C.green}
          icon="🔒"
          items={[
            "Token launches → staking pool auto-deploys",
            "Creator chooses fee split: 20-100% to stakers",
            "Stakers earn $INCLAW as UBI rewards",
            "Rewards begin when token has >$1 in volume",
            "Creator earns by staking their own bag",
            "Pool appears on categorized staking page",
          ]}
        />
        <Box
          title="vs COMPETITORS"
          color={C.red}
          icon="⚔️"
          items={[
            "pump.fun: launch token, no utility, pure speculation",
            "Clanker: launch token, LP fees only, no staking",
            "Inclawbator: launch + staking + UBI + configurable split",
            "Immediate reason to hold, not just trade",
            "Staking creates price stability (locked supply)",
            "Every pool feeds $INCLAW demand",
          ]}
        />
      </div>

      <SectionTitle>Staking Mechanics</SectionTitle>

      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "8px",
          padding: "20px",
          fontFamily: fonts.mono,
          fontSize: "12px",
          lineHeight: 1.8,
          color: C.grey,
        }}
      >
        <div><span style={{ color: C.green }}>POOL TYPE:</span> UBI Pool (every launched token)</div>
        <div><span style={{ color: C.green }}>STAKE:</span> Project's token (e.g. $MIND, $FIGHT, $BASIS)</div>
        <div><span style={{ color: C.green }}>EARN:</span> $INCLAW (platform token)</div>
        <div><span style={{ color: C.green }}>ACTIVATION:</span> {">"} $1 traded on token</div>
        <div><span style={{ color: C.green }}>FEE SPLIT:</span> Creator chooses 20-100% to $INCLAW stakers at launch</div>
        <div><span style={{ color: C.green }}>REWARD SOURCE:</span> Chosen % of fees → buys $INCLAW → distributes over 30 days</div>
        <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${C.border}` }}>
          <span style={{ color: C.gold }}>CREATOR REVENUE:</span> Remaining % of fees (e.g. 80% if they chose 20% to stakers)
        </div>
        <div><span style={{ color: C.gold }}>ALIGNMENT:</span> Creator stakes own token → earns $INCLAW too → aligned with community</div>
        <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${C.border}` }}>
          <span style={{ color: C.cyan }}>SPLIT EXAMPLES:</span>
        </div>
        <div>Meme coin: 20% to stakers / 80% to creator (minimum)</div>
        <div>Serious builder: 50/50 (balanced)</div>
        <div>Max alignment: 100% to stakers / 0% to creator (earns by staking own bag)</div>
      </div>

      <SectionTitle>Scale Visualization</SectionTitle>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {Array.from({ length: 40 }, (_, i) => (
          <div
            key={i}
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "6px",
              background: i < 5 ? C.gold + "33" : i < 15 ? C.green + "22" : C.card,
              border: `1px solid ${i < 5 ? C.gold + "66" : i < 15 ? C.green + "44" : C.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
              fontFamily: fonts.mono,
              color: i < 5 ? C.gold : i < 15 ? C.green : C.darkGrey,
            }}
          >
            {i < 5 ? ["S4H", "MIR", "FGT", "BAS", "VST"][i] : i < 15 ? `P${i - 4}` : `P${i - 4}`}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "16px", fontSize: "11px", fontFamily: fonts.mono }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: C.gold + "33", border: `1px solid ${C.gold}66` }} />
          <span style={{ color: C.gold }}>Incubated Spokes</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: C.green + "22", border: `1px solid ${C.green}44` }} />
          <span style={{ color: C.green }}>Self-Serve Launches</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: C.card, border: `1px solid ${C.border}` }} />
          <span style={{ color: C.darkGrey }}>Future Capacity</span>
        </div>
      </div>

      <Callout
        text="Every square is a staking pool. Every pool buys $INCLAW. Every launch strengthens the entire ecosystem. Creators who choose higher staker splits get higher APY displays, attracting more capital. Generosity is the optimal strategy."
        color={C.green}
        icon="📈"
      />
    </div>
  );
}

function FeeArchitecture() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SectionTitle>Fee Flow Architecture</SectionTitle>

      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "12px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "4px",
        }}
      >
        <div
          style={{
            background: C.blue + "22",
            border: `2px solid ${C.blue}`,
            borderRadius: "8px",
            padding: "12px 24px",
            fontFamily: fonts.heading,
            fontSize: "14px",
            fontWeight: 700,
            color: C.blue,
            textAlign: "center",
          }}
        >
          👤 Someone trades a launched token
        </div>

        <FlowArrow label="1% fee on every buy/sell" color={C.red} />

        <div
          style={{
            background: C.red + "22",
            border: `2px solid ${C.red}`,
            borderRadius: "8px",
            padding: "12px 24px",
            fontFamily: fonts.heading,
            fontSize: "14px",
            fontWeight: 700,
            color: C.red,
            textAlign: "center",
          }}
        >
          🦞 FEE ROUTER (1%)
        </div>

        <div style={{ display: "flex", gap: "40px", alignItems: "flex-start", marginTop: "4px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <FlowArrow label="0-80% (creator chooses)" color={C.green} />
            <div
              style={{
                background: C.green + "22",
                border: `2px solid ${C.green}`,
                borderRadius: "8px",
                padding: "12px 20px",
                fontFamily: fonts.heading,
                fontSize: "13px",
                fontWeight: 700,
                color: C.green,
                textAlign: "center",
              }}
            >
              Creator Treasury
            </div>
            <div style={{ fontSize: "10px", fontFamily: fonts.mono, color: C.textDim, marginTop: "6px", textAlign: "center" }}>
              Optional — creator can<br />send 100% to stakers
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <FlowArrow label="20-100% (min 20%)" color={C.gold} />
            <div
              style={{
                background: C.gold + "22",
                border: `2px solid ${C.gold}`,
                borderRadius: "8px",
                padding: "12px 20px",
                fontFamily: fonts.heading,
                fontSize: "13px",
                fontWeight: 700,
                color: C.gold,
                textAlign: "center",
              }}
            >
              Buys $INCLAW
            </div>
            <FlowArrow label="30-day rolling drip" color={C.gold} />
            <div
              style={{
                background: C.gold + "11",
                border: `1px solid ${C.gold}44`,
                borderRadius: "8px",
                padding: "10px 16px",
                fontFamily: fonts.heading,
                fontSize: "12px",
                fontWeight: 700,
                color: C.gold,
                textAlign: "center",
              }}
            >
              Token Stakers Earn $INCLAW
            </div>
            <div style={{ fontSize: "10px", fontFamily: fonts.mono, color: C.textDim, marginTop: "6px", textAlign: "center" }}>
              Creator earns too<br />by staking own bag
            </div>
          </div>
        </div>
      </div>

      <SectionTitle>Inclawbate Revenue Model</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Box
          title="NOT FEE EXTRACTION"
          color={C.darkGrey}
          icon="✕"
          items={[
            "Inclawbate does NOT take a direct cut",
            "No team wallet receiving % of fees",
            "No hidden tax on creators",
            "All fees go to stakers or creator",
            "Platform doesn't extract — it accumulates",
          ]}
          footer="This is why people trust it"
        />
        <Box
          title="TREASURY = STORE OF VALUE"
          color={C.cyan}
          icon="✓"
          items={[
            "Inclawbate holds significant $INCLAW position",
            "500+ projects buying $INCLAW = appreciation",
            "Treasury deployed into ETH yield strategies",
            "Yield sustains operations + development",
            "Debit card draws from yield, never sells principal",
          ]}
          footer="Revenue is the store of value itself"
        />
      </div>

      <SectionTitle>Why Clanker Direct for $INCLAW?</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Box
          title="INCLAWNCH (OLD)"
          color={C.darkGrey}
          icon="⚠️"
          items={[
            "Launched on Clawnch",
            "80% fee capture (20% to Clawnch)",
            "Permanent tax on every trade",
            "Scales with your success — against you",
            "Building a skyscraper on rented land",
          ]}
          footer="20% fee leak compounds forever"
        />
        <Box
          title="$INCLAW (NEW)"
          color={C.cyan}
          icon="✅"
          items={[
            "Launched on Clanker Direct",
            "100% fee capture on own trading",
            "Zero permanent leakage",
            "Your success = your revenue",
            "Clean foundation for the launchpad",
          ]}
          footer="100% of $INCLAW trading fees stay in ecosystem"
        />
      </div>

      <SectionTitle>Revenue at Scale</SectionTitle>

      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "8px",
          padding: "20px",
          fontFamily: fonts.mono,
          fontSize: "12px",
          lineHeight: 2,
          color: C.grey,
        }}
      >
        <div style={{ color: C.white, fontWeight: 700, marginBottom: "8px" }}>SCENARIO: 100 projects, avg $10K daily volume each</div>
        <div>Total daily volume: <span style={{ color: C.cyan }}>$1,000,000</span></div>
        <div>1% fee collected: <span style={{ color: C.red }}>$10,000 / day</span></div>
        <div style={{ marginTop: "8px", color: C.white, fontWeight: 700 }}>IF AVERAGE SPLIT IS 50% TO STAKERS:</div>
        <div>50% to stakers (buys $INCLAW): <span style={{ color: C.gold }}>$5,000 / day</span></div>
        <div>50% to creators: <span style={{ color: C.green }}>$5,000 / day</span></div>
        <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: `1px solid ${C.border}` }}>
          Annual $INCLAW buy pressure: <span style={{ color: C.gold, fontWeight: 700 }}>~$1,825,000</span>
        </div>
        <div style={{ marginTop: "8px", color: C.white, fontWeight: 700 }}>IF AVERAGE SPLIT IS 100% TO STAKERS:</div>
        <div>$INCLAW buy pressure: <span style={{ color: C.gold }}>$10,000 / day</span></div>
        <div>Annual: <span style={{ color: C.gold, fontWeight: 700 }}>~$3,650,000</span></div>
        <div style={{ marginTop: "12px", color: C.textDim }}>
          Even at minimum 20% floor: $2,000/day = $730K/year in guaranteed $INCLAW buy pressure.
          <br />Inclawbate earns by holding $INCLAW + deploying treasury into yield. <span style={{ color: C.green }}>No extraction needed.</span>
        </div>
      </div>
    </div>
  );
}

function MigrationPath() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SectionTitle>INCLAWNCH → $INCLAW Transition</SectionTitle>

      <Callout
        text="No forced migration. No deadlines. No rugs. Both pools exist side by side. The market decides the timeline."
        color={C.green}
        icon="🤝"
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <FlowStep
          number="1"
          title="$INCLAW Launches"
          desc="New token deployed on Clanker Direct. Stuart buys a significant bag from the open market. New staking pool goes live alongside existing INCLAWNCH pool."
          color={C.cyan}
        />
        <FlowStep
          number="2"
          title="Both Pools Coexist"
          desc="INCLAWNCH UBI pool still running, still earning. $INCLAW UBI pool right next to it, also earning. Same staking page, same categories. Users see both yields and choose."
          color={C.green}
        />
        <FlowStep
          number="3"
          title="Optional Conversion"
          desc="INCLAWNCH holders can convert to $INCLAW whenever they choose. Stuart airdrops $INCLAW proportionally from his own wallet based on INCLAWNCH holdings. Gift, not migration."
          color={C.gold}
        />
        <FlowStep
          number="4"
          title="Organic Migration"
          desc="As launchpad grows, more fee revenue flows through $INCLAW. That pool's yield becomes more attractive. INCLAWNCH yield gradually decreases as activity shifts. People follow the yield naturally."
          color={C.red}
        />
        <FlowStep
          number="5"
          title="INCLAWNCH Sunsets"
          desc="Not killed — fades naturally as volume migrates. No announcements, no deadlines, no drama. Community voted with their wallets. Free market dynamics."
          color={C.purple}
        />
      </div>

      <SectionTitle>The Framing</SectionTitle>

      <div
        style={{
          background: C.card,
          border: `1px solid ${C.gold}44`,
          borderLeft: `3px solid ${C.gold}`,
          borderRadius: "8px",
          padding: "20px",
          fontFamily: fonts.body,
          fontSize: "13px",
          color: C.white,
          lineHeight: 1.7,
          fontStyle: "italic",
        }}
      >
        "Inclawbate has always been about options. We don't force anything. Here's the new platform token. Here's the staking pool. Convert if you want, when you want. Both pools earn. You decide."
      </div>

      <SectionTitle>What Existing Holders Get</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Box
          title="INCLAWNCH HOLDERS"
          color={C.gold}
          icon="🦞"
          items={[
            "Keep earning in INCLAWNCH pool",
            "Optional $INCLAW airdrop from Stuart's wallet",
            "Can convert whenever they choose",
            "No forced timeline or deadline",
            "Early believers become genesis $INCLAW holders",
          ]}
          footer="Nobody gets rugged. Everyone gets upgraded."
        />
        <Box
          title="EXISTING SPOKES"
          color={C.green}
          icon="🔗"
          items={[
            "MirrorMind, Fight Farm, Basis, Vestine, S4H",
            "Transition UBI pools to $INCLAW over time",
            "Same 80/20 fee structure",
            "Same staking mechanics",
            "Better platform token underneath",
          ]}
          footer="Same model, cleaner foundation."
        />
      </div>
    </div>
  );
}

function NFTEndgame() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SectionTitle>The Endgame: NFT Ownership Layer</SectionTitle>

      <div style={{ fontSize: "13px", fontFamily: fonts.body, color: C.grey, lineHeight: 1.7 }}>
        $INCLAW is the circulation layer — the utility token that moves through the system. The NFT collection is the ownership layer — fixed supply, ETH yield, true store of value. The token is the funnel. The NFT is the destination. The burn is the bridge.
      </div>

      <SectionTitle>Two Layers, Two Jobs</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Box
          title="$INCLAW TOKEN"
          color={C.gold}
          icon="🪙"
          accent="CIRCULATION"
          items={[
            "How people interact with the platform",
            "How fees are generated",
            "How staking works",
            "Currency inside the economy",
            "Divisible — anyone can buy $5 worth",
            "Volume generates fees",
          ]}
          footer="Like USD — it moves through the system"
        />
        <Box
          title="NFT COLLECTION"
          color={C.purple}
          icon="🖼️"
          accent="OWNERSHIP"
          items={[
            "Fixed supply (e.g. 500 NFTs)",
            "Represents ownership of Inclawbate",
            "Earns ETH from platform revenue",
            "Zero fee leak to anyone",
            "Minted by BURNING $INCLAW",
            "Appreciates with platform growth",
          ]}
          footer="Like stock — you own the business"
        />
      </div>

      <SectionTitle>Burn-to-Mint Mechanics</SectionTitle>

      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "12px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "4px",
        }}
      >
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
          <div
            style={{
              background: C.red + "22",
              border: `2px solid ${C.red}`,
              borderRadius: "8px",
              padding: "12px 20px",
              textAlign: "center",
            }}
          >
            <div style={{ fontFamily: fonts.heading, fontSize: "13px", fontWeight: 700, color: C.red }}>
              📢 NFT MINT ANNOUNCED
            </div>
            <div style={{ fontSize: "10px", fontFamily: fonts.mono, color: C.textDim, marginTop: "4px" }}>
              at 500K $INCLAW mcap
            </div>
          </div>
        </div>

        <FlowArrow label="everyone races to accumulate $INCLAW" color={C.gold} />

        <div
          style={{
            background: C.gold + "22",
            border: `2px solid ${C.gold}`,
            borderRadius: "8px",
            padding: "12px 20px",
            textAlign: "center",
          }}
        >
          <div style={{ fontFamily: fonts.heading, fontSize: "13px", fontWeight: 700, color: C.gold }}>
            💰 MASSIVE BUY PRESSURE
          </div>
          <div style={{ fontSize: "10px", fontFamily: fonts.mono, color: C.textDim, marginTop: "4px" }}>
            token price spikes INTO the transition
          </div>
        </div>

        <FlowArrow label="burn X amount of $INCLAW per NFT" color={C.red} />

        <div
          style={{
            background: C.purple + "22",
            border: `2px solid ${C.purple}`,
            borderRadius: "8px",
            padding: "12px 20px",
            textAlign: "center",
          }}
        >
          <div style={{ fontFamily: fonts.heading, fontSize: "13px", fontWeight: 700, color: C.purple }}>
            🖼️ NFT MINTED
          </div>
          <div style={{ fontSize: "10px", fontFamily: fonts.mono, color: C.textDim, marginTop: "4px" }}>
            fixed supply ownership asset
          </div>
        </div>

        <FlowArrow label="$INCLAW supply cratered" color={C.green} />

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center" }}>
          <div
            style={{
              background: C.green + "22",
              border: `1px solid ${C.green}44`,
              borderRadius: "8px",
              padding: "10px 16px",
              textAlign: "center",
            }}
          >
            <div style={{ fontFamily: fonts.heading, fontSize: "11px", color: C.green }}>NFT holders</div>
            <div style={{ fontSize: "10px", fontFamily: fonts.mono, color: C.textDim }}>earn ETH yield</div>
          </div>
          <div
            style={{
              background: C.cyan + "22",
              border: `1px solid ${C.cyan}44`,
              borderRadius: "8px",
              padding: "10px 16px",
              textAlign: "center",
            }}
          >
            <div style={{ fontFamily: fonts.heading, fontSize: "11px", color: C.cyan }}>Token holders</div>
            <div style={{ fontSize: "10px", fontFamily: fonts.mono, color: C.textDim }}>scarcer $INCLAW</div>
          </div>
          <div
            style={{
              background: C.gold + "22",
              border: `1px solid ${C.gold}44`,
              borderRadius: "8px",
              padding: "10px 16px",
              textAlign: "center",
            }}
          >
            <div style={{ fontFamily: fonts.heading, fontSize: "11px", color: C.gold }}>$INCLAW still circulates</div>
            <div style={{ fontSize: "10px", fontFamily: fonts.mono, color: C.textDim }}>utility continues</div>
          </div>
        </div>
      </div>

      <Callout
        text="Nobody gets left behind. Holders either burn into the NFT (ownership upgrade) or hold a scarcer token (better tokenomics). The token IS the price of admission. The burn IS the bridge."
        color={C.purple}
        icon="🔥"
      />
    </div>
  );
}

function Flywheel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SectionTitle>The Compounding Flywheel</SectionTitle>

      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "12px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2px",
        }}
      >
        {[
          { text: "New project launches on Inclawbator", color: C.blue, icon: "🚀" },
          { text: "Token gets staking pool + fee routing", color: C.green, icon: "🔒" },
          { text: "Community buys + stakes token", color: C.cyan, icon: "👥" },
          { text: "Trading volume generates 1% fees", color: C.red, icon: "💱" },
          { text: "Creator's chosen % buys $INCLAW (min 20%)", color: C.gold, icon: "🔴" },
          { text: "$INCLAW distributed to stakers as UBI", color: C.gold, icon: "💰" },
          { text: "$INCLAW demand increases → price appreciates", color: C.green, icon: "📈" },
          { text: "Higher $INCLAW yield → more attractive to stake", color: C.cyan, icon: "🧲" },
          { text: "More stakers → more visibility → more projects launch", color: C.blue, icon: "🔄" },
        ].map((step, i) => (
          <div key={i}>
            <div
              style={{
                background: step.color + "15",
                border: `1px solid ${step.color}44`,
                borderRadius: "8px",
                padding: "10px 20px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                minWidth: "380px",
              }}
            >
              <span style={{ fontSize: "16px" }}>{step.icon}</span>
              <span style={{ fontFamily: fonts.body, fontSize: "12px", color: C.white }}>{step.text}</span>
            </div>
            {i < 8 && <div style={{ textAlign: "center", color: step.color, fontSize: "14px", padding: "2px 0" }}>↓</div>}
          </div>
        ))}
        <div style={{ textAlign: "center", marginTop: "8px" }}>
          <div style={{ fontSize: "20px", color: C.red }}>↻</div>
          <div style={{ fontFamily: fonts.mono, fontSize: "11px", color: C.red, fontWeight: 700, letterSpacing: "1px" }}>
            REPEAT × 500
          </div>
        </div>
      </div>

      <SectionTitle>Compounding Effect</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
        <Box
          title="10 PROJECTS"
          color={C.blue}
          icon="🌱"
          items={[
            "10 fee streams",
            "10 staking pools",
            "Small but real buy pressure",
            "Early ecosystem",
          ]}
          footer="Foundation phase"
        />
        <Box
          title="100 PROJECTS"
          color={C.green}
          icon="🌿"
          items={[
            "100 fee streams",
            "100 staking pools",
            "Significant daily buy pressure",
            "Discovery page matters",
          ]}
          footer="Growth phase"
        />
        <Box
          title="500 PROJECTS"
          color={C.gold}
          icon="🌳"
          items={[
            "500 simultaneous fee streams",
            "500 staking pools",
            "Massive constant buy pressure",
            "Self-sustaining ecosystem",
          ]}
          footer="Maturity → NFT endgame"
        />
      </div>

      <SectionTitle>Why This Wins</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Callout
          text="Each new project doesn't just add to the ecosystem — it multiplies. Project A's volume creates $INCLAW yield that attracts stakers to Project B, whose volume creates more yield for Project C. Network effects compound."
          color={C.green}
          icon="🔗"
        />
        <Callout
          text="No single project failure can kill the ecosystem. If 50 projects die, 450 are still generating fees. Diversified revenue across hundreds of streams is antifragile. The launchpad gets stronger as it grows."
          color={C.red}
          icon="🛡️"
        />
      </div>
    </div>
  );
}

function DiscoveryLayer() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SectionTitle>Discovery & Categorization</SectionTitle>

      <div style={{ fontSize: "13px", fontFamily: fonts.body, color: C.grey, lineHeight: 1.7 }}>
        The staking page becomes a DeFi app store. Browse by category, sort by yield, TVL, or launch date. Every project that launches on Inclawbator is automatically categorized and visible to the entire ecosystem.
      </div>

      <SectionTitle>Category Grid</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
        {[
          { name: "DeFi", icon: "💰", count: "12 projects", color: C.green },
          { name: "Gaming", icon: "🎮", count: "8 projects", color: C.red },
          { name: "Wellness", icon: "🧘", count: "5 projects", color: C.purple },
          { name: "Content", icon: "📱", count: "15 projects", color: C.blue },
          { name: "AI Agents", icon: "🤖", count: "22 projects", color: C.cyan },
          { name: "Food & Lifestyle", icon: "🍽️", count: "7 projects", color: C.orange },
          { name: "Faith", icon: "✝️", count: "3 projects", color: C.gold },
          { name: "Services", icon: "🔧", count: "11 projects", color: C.grey },
          { name: "Community", icon: "👥", count: "9 projects", color: C.green },
        ].map((cat, i) => (
          <div
            key={i}
            style={{
              background: C.card,
              border: `1px solid ${cat.color}33`,
              borderRadius: "8px",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ fontSize: "24px" }}>{cat.icon}</span>
            <span style={{ fontFamily: fonts.heading, fontSize: "12px", fontWeight: 700, color: cat.color }}>{cat.name}</span>
            <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: C.textDim }}>{cat.count}</span>
          </div>
        ))}
      </div>

      <SectionTitle>Project Card (Example)</SectionTitle>

      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "12px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: C.purple + "33",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
              }}
            >
              🪞
            </div>
            <div>
              <div style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: 700, color: C.white }}>MirrorMind</div>
              <div style={{ fontFamily: fonts.mono, fontSize: "11px", color: C.textDim }}>$MIND · Wellness</div>
            </div>
          </div>
          <Tag color={C.green}>LIVE</Tag>
        </div>

        <div style={{ fontSize: "12px", fontFamily: fonts.body, color: C.grey }}>
          AI-powered wellness platform. Voice cloning, guided reflections, journaling, meditation.
        </div>

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          {[
            { label: "TVL", value: "$1.2K", color: C.green },
            { label: "APY", value: "340%", color: C.gold },
            { label: "Stakers", value: "12", color: C.cyan },
            { label: "24h Vol", value: "$820", color: C.red },
            { label: "Split", value: "80%", color: C.purple },
          ].map((stat, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: 700, color: stat.color }}>{stat.value}</div>
              <div style={{ fontFamily: fonts.mono, fontSize: "9px", color: C.textDim }}>{stat.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <div
            style={{
              flex: 1,
              background: C.green + "22",
              border: `1px solid ${C.green}44`,
              borderRadius: "6px",
              padding: "8px",
              textAlign: "center",
              fontFamily: fonts.heading,
              fontSize: "12px",
              color: C.green,
              fontWeight: 700,
            }}
          >
            STAKE $MIND → EARN $INCLAW
          </div>
          <div
            style={{
              flex: 1,
              background: C.blue + "22",
              border: `1px solid ${C.blue}44`,
              borderRadius: "6px",
              padding: "8px",
              textAlign: "center",
              fontFamily: fonts.heading,
              fontSize: "12px",
              color: C.blue,
              fontWeight: 700,
            }}
          >
            BUY $MIND
          </div>
        </div>
      </div>

      <SectionTitle>Sort & Filter</SectionTitle>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {["Highest APY", "Most Stakers", "Highest TVL", "Highest Split %", "Newest", "Trending", "Most Volume", "Verified", "AI Agents Only"].map((f, i) => (
          <div
            key={i}
            style={{
              padding: "6px 14px",
              borderRadius: "20px",
              background: i === 0 ? C.red + "22" : C.card,
              border: `1px solid ${i === 0 ? C.red + "66" : C.border}`,
              fontFamily: fonts.mono,
              fontSize: "11px",
              color: i === 0 ? C.red : C.grey,
            }}
          >
            {f}
          </div>
        ))}
      </div>

      <SectionTitle>Two Tiers</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Box
          title="INCLAWBATE"
          color={C.gold}
          icon="🦞"
          accent="FULL SERVICE"
          items={[
            "Hand-crafted incubation",
            "Custom partnership agreement",
            "Brand strategy + consultation",
            "Website hosting + development",
            "Smart contract audit",
            "Featured placement on discovery",
            "Verified badge",
          ]}
          footer="What you do now — MirrorMind, Fight Farm, Basis, etc."
        />
        <Box
          title="INCLAWBATOR"
          color={C.cyan}
          icon="🚀"
          accent="SELF-SERVE"
          items={[
            "1-click launch, no approval needed",
            "Auto staking + fee routing",
            "Standard discovery listing",
            "Community-driven growth",
            "Can upgrade to full incubation later",
            "Light curation (INCLAW bond?)",
            "Open to anyone",
          ]}
          footer="The permissionless launchpad at scale"
        />
      </div>

      <Callout
        text="Inclawbate (full service) and Inclawbator (self-serve) are two tiers of the same ecosystem. Both feed $INCLAW. Creators choose their own fee split — minimum 20% to stakers, up to 100%. The split is visible on every project card so stakers can reward generous creators with their capital."
        color={C.gold}
        icon="🏗️"
      />
    </div>
  );
}

function ExampleNumbers() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SectionTitle>Concrete Numbers: How Fees Flow to Stakers</SectionTitle>

      <div style={{ fontSize: "13px", fontFamily: fonts.body, color: C.grey, lineHeight: 1.7 }}>
        Creators choose their fee split at launch (minimum 20% to stakers). The chosen percentage of all trading fees buys $INCLAW on the open market and distributes it to that token's stakers over a 30-day rolling period. Creator earns by staking their own bag alongside everyone else.
      </div>

      {/* Scenario A */}
      <div style={{ background: C.card, border: `1px solid ${C.green}33`, borderRadius: "12px", padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <span style={{ fontSize: "20px" }}>🌱</span>
          <div>
            <div style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: 700, color: C.green }}>
              Scenario A: Micro Scale (Day 1 Reality)
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: "11px", color: C.textDim }}>Creator launches, buys $100 of their own token, stakes it</div>
          </div>
        </div>

        <div style={{ fontFamily: fonts.mono, fontSize: "12px", lineHeight: 2.2, color: C.grey }}>
          <div style={{ color: C.white, fontWeight: 700, marginBottom: "4px" }}>INPUTS</div>
          <div>Creator's fee split: <span style={{ color: C.cyan }}>100% to stakers (max alignment)</span></div>
          <div>Creator buys $100 of their token (single trade)</div>
          <div>$INCLAW price: <span style={{ color: C.gold }}>$0.001</span></div>
          <div>Only staker: Creator themselves</div>

          <div style={{ height: "1px", background: C.border, margin: "12px 0" }} />

          <div style={{ color: C.white, fontWeight: 700, marginBottom: "4px" }}>THAT SINGLE $100 TRADE</div>
          <div>1% fee on $100: <span style={{ color: C.red }}>$1.00</span></div>
          <div>100% to stakers: <span style={{ color: C.gold }}>$1.00 → buys $INCLAW</span></div>
          <div>At $0.001 per $INCLAW: <span style={{ color: C.gold }}>1,000 $INCLAW tokens</span></div>
          <div>Dripped to creator (only staker) over 30 days: <span style={{ color: C.gold }}>~33 $INCLAW / day</span></div>

          <div style={{ height: "1px", background: C.border, margin: "12px 0" }} />

          <div style={{ color: C.white, fontWeight: 700, marginBottom: "4px" }}>WHAT IF 5 MORE PEOPLE BUY $50 EACH?</div>
          <div>5 trades × $50 = $250 additional volume</div>
          <div>1% fee: <span style={{ color: C.red }}>$2.50</span></div>
          <div>$INCLAW bought: <span style={{ color: C.gold }}>2,500 $INCLAW</span></div>
          <div>Total pool: <span style={{ color: C.gold }}>3,500 $INCLAW over 30 days</span></div>
          <div>If all 6 people stake (total ~$350 staked):</div>
          <div>Each staker earns proportional to their stake</div>
          <div>Creator (29% of pool): <span style={{ color: C.gold }}>~1,015 $INCLAW / month</span></div>

          <div style={{ height: "1px", background: C.border, margin: "12px 0" }} />

          <div style={{ color: C.white, fontWeight: 700, marginBottom: "4px" }}>THE POINT</div>
          <div style={{ color: C.green }}>It's tiny in dollar terms. But $INCLAW is accumulating.</div>
          <div style={{ color: C.green }}>Agents see yield. They don't have a minimum threshold.</div>
          <div style={{ color: C.green }}>If $INCLAW 10x's later, those 1,000 tokens = $10 from a $100 trade.</div>
        </div>
      </div>

      {/* Scenario B */}
      <div style={{ background: C.card, border: `1px solid ${C.blue}33`, borderRadius: "12px", padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <span style={{ fontSize: "20px" }}>⚖️</span>
          <div>
            <div style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: 700, color: C.blue }}>
              Scenario B: Same Volume, Different Splits
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: "11px", color: C.textDim }}>How the creator's choice affects staker yield</div>
          </div>
        </div>

        <div style={{ fontFamily: fonts.mono, fontSize: "12px", lineHeight: 2.2, color: C.grey }}>
          <div style={{ color: C.white, fontWeight: 700, marginBottom: "4px" }}>SAME SETUP FOR ALL THREE</div>
          <div>Daily volume: <span style={{ color: C.cyan }}>$1,000</span></div>
          <div>Daily 1% fee: <span style={{ color: C.red }}>$10.00</span></div>
          <div>$INCLAW price: <span style={{ color: C.gold }}>$0.001</span></div>
          <div>Total staked: <span style={{ color: C.blue }}>$500 across 10 stakers</span></div>

          <div style={{ height: "1px", background: C.border, margin: "16px 0" }} />

          <div style={{ color: C.red, fontWeight: 700, marginBottom: "8px" }}>SPLIT: 20% TO STAKERS (minimum — meme coin play)</div>
          <div>$INCLAW bought daily: <span style={{ color: C.gold }}>$2.00 → 2,000 $INCLAW</span></div>
          <div>Creator keeps: <span style={{ color: C.green }}>$8.00 / day ($240/month)</span></div>
          <div>Monthly $INCLAW to stakers: <span style={{ color: C.gold }}>60,000 $INCLAW ($60)</span></div>
          <div>APY: <span style={{ color: C.green, fontWeight: 700 }}>~144%</span></div>

          <div style={{ height: "1px", background: C.border, margin: "16px 0" }} />

          <div style={{ color: C.gold, fontWeight: 700, marginBottom: "8px" }}>SPLIT: 50% TO STAKERS (balanced)</div>
          <div>$INCLAW bought daily: <span style={{ color: C.gold }}>$5.00 → 5,000 $INCLAW</span></div>
          <div>Creator keeps: <span style={{ color: C.green }}>$5.00 / day ($150/month)</span></div>
          <div>Monthly $INCLAW to stakers: <span style={{ color: C.gold }}>150,000 $INCLAW ($150)</span></div>
          <div>APY: <span style={{ color: C.green, fontWeight: 700 }}>~360%</span></div>

          <div style={{ height: "1px", background: C.border, margin: "16px 0" }} />

          <div style={{ color: C.cyan, fontWeight: 700, marginBottom: "8px" }}>SPLIT: 100% TO STAKERS (max alignment)</div>
          <div>$INCLAW bought daily: <span style={{ color: C.gold }}>$10.00 → 10,000 $INCLAW</span></div>
          <div>Creator keeps: <span style={{ color: C.green }}>$0.00 (earns by staking own bag)</span></div>
          <div>Monthly $INCLAW to stakers: <span style={{ color: C.gold }}>300,000 $INCLAW ($300)</span></div>
          <div>APY: <span style={{ color: C.green, fontWeight: 700 }}>~720%</span></div>
          <div style={{ color: C.textDim, marginTop: "4px" }}>Creator staking $100 (20% of pool) earns 60,000 $INCLAW/mo</div>
        </div>

        <Callout
          text="Higher split to stakers = higher displayed APY = more attractive pool = more people buy the token to stake = more volume = more fees. The generous creator often earns MORE long-term by choosing a higher staker split because it grows the pie faster."
          color={C.blue}
          icon="🧠"
        />
      </div>

      {/* Scenario C */}
      <div style={{ background: C.card, border: `1px solid ${C.gold}33`, borderRadius: "12px", padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <span style={{ fontSize: "20px" }}>🌳</span>
          <div>
            <div style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: 700, color: C.gold }}>
              Scenario C: Platform Scale (100 Projects)
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: "11px", color: C.textDim }}>The compound effect across the ecosystem</div>
          </div>
        </div>

        <div style={{ fontFamily: fonts.mono, fontSize: "12px", lineHeight: 2.2, color: C.grey }}>
          <div style={{ color: C.white, fontWeight: 700, marginBottom: "4px" }}>AGGREGATE INPUTS</div>
          <div>Active projects on Inclawbator: <span style={{ color: C.gold }}>100</span></div>
          <div>Average daily volume per project: <span style={{ color: C.cyan }}>$1,000</span></div>
          <div>Total daily platform volume: <span style={{ color: C.cyan }}>$100,000</span></div>
          <div>Average fee split to stakers: <span style={{ color: C.gold }}>~60% (mix of splits)</span></div>
          <div>$INCLAW price (appreciated from demand): <span style={{ color: C.gold }}>$0.005</span></div>
          <div>Total staked across all pools (value): <span style={{ color: C.gold }}>$50,000</span></div>

          <div style={{ height: "1px", background: C.border, margin: "12px 0" }} />

          <div style={{ color: C.white, fontWeight: 700, marginBottom: "4px" }}>DAILY PLATFORM FEES</div>
          <div>1% fee on $100,000: <span style={{ color: C.red }}>$1,000 / day</span></div>
          <div>→ ~60% avg to stakers (buys $INCLAW): <span style={{ color: C.gold }}>$600 / day</span></div>
          <div>→ ~40% avg to creators: <span style={{ color: C.green }}>$400 / day</span></div>

          <div style={{ height: "1px", background: C.border, margin: "12px 0" }} />

          <div style={{ color: C.white, fontWeight: 700, marginBottom: "4px" }}>30-DAY PLATFORM TOTALS</div>
          <div>Total $INCLAW purchased: <span style={{ color: C.gold }}>$18,000</span></div>
          <div>At $0.005 per $INCLAW: <span style={{ color: C.gold }}>3,600,000 $INCLAW tokens</span></div>
          <div>Daily buy pressure on $INCLAW: <span style={{ color: C.gold }}>$600 / day — every single day</span></div>

          <div style={{ height: "1px", background: C.border, margin: "12px 0" }} />

          <div style={{ color: C.white, fontWeight: 700, marginBottom: "4px" }}>STAKER RETURNS (AVERAGE)</div>
          <div>Average pool TVL: <span style={{ color: C.cyan }}>$500 per project</span></div>
          <div>Average monthly rewards per pool: <span style={{ color: C.gold }}>$180</span></div>
          <div>Average monthly return: <span style={{ color: C.green }}>36%</span></div>
          <div style={{ fontSize: "14px", marginTop: "8px" }}>
            Average APY across platform: <span style={{ color: C.green, fontWeight: 700, fontSize: "16px" }}>~432%</span>
          </div>
          <div style={{ marginTop: "4px", color: C.textDim }}>
            Even at modest $1K/day volume per project. Real numbers. Not inflated fantasy.
          </div>
        </div>

        <div style={{ marginTop: "16px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <StatBox label="MONTHLY REVENUE" value="$30K" color={C.green} />
          <StatBox label="MONTHLY $INCLAW BOUGHT" value="$18K" color={C.gold} />
          <StatBox label="ANNUAL BUY PRESSURE" value="$219K" color={C.red} />
        </div>
      </div>

      {/* APY dynamics explanation */}
      <SectionTitle>How APY Self-Balances</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Box
          title="APY TOO HIGH"
          color={C.green}
          icon="📈"
          items={[
            "More people see the yield",
            "More people buy token to stake",
            "TVL increases",
            "Same rewards ÷ more stakers = lower APY",
            "Also: buy pressure raises token price",
          ]}
          footer="APY drops naturally as capital enters"
        />
        <Box
          title="APY TOO LOW"
          color={C.red}
          icon="📉"
          items={[
            "Some stakers unstake and leave",
            "TVL decreases",
            "Same rewards ÷ fewer stakers = higher APY",
            "Higher APY attracts new capital back",
            "Equilibrium finds itself",
          ]}
          footer="APY rises naturally as capital exits"
        />
      </div>

      <Callout
        text="APY is self-correcting. High yields attract capital until yields normalize. Low yields shed capital until yields recover. The market finds equilibrium without you managing anything. You just set up the pool and let it run."
        color={C.gold}
        icon="⚖️"
      />

      {/* Key insight */}
      <SectionTitle>The Multiplier Nobody Sees</SectionTitle>

      <div style={{ background: C.card, border: `1px solid ${C.red}44`, borderLeft: `3px solid ${C.red}`, borderRadius: "8px", padding: "20px" }}>
        <div style={{ fontFamily: fonts.mono, fontSize: "12px", lineHeight: 2, color: C.grey }}>
          <div style={{ color: C.white, fontWeight: 700, marginBottom: "8px", fontFamily: fonts.heading, fontSize: "14px" }}>
            🔴 The hidden compounding effect on $INCLAW price:
          </div>
          <div>Each project's staker allocation → buys $INCLAW on open market</div>
          <div>This buying raises $INCLAW price</div>
          <div>Higher $INCLAW price → staker rewards worth MORE in dollar terms</div>
          <div>Higher dollar APY → more people want to stake</div>
          <div>More stakers → need to buy project tokens first</div>
          <div>More project token buying → more volume → more fees → more $INCLAW bought</div>
          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${C.border}` }}>
            <span style={{ color: C.cyan, fontWeight: 700 }}>AND: Creators choosing higher splits get higher displayed APY</span>
          </div>
          <div>Higher APY display → more stakers → more volume → creator's bag appreciates</div>
          <div>Generosity is economically rational. The system rewards alignment.</div>
          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${C.border}`, color: C.red, fontWeight: 700 }}>
            This is a reflexive loop. $INCLAW price appreciation INCREASES the yield,
            which INCREASES demand, which INCREASES the price further.
          </div>
          <div style={{ marginTop: "8px", color: C.textDim }}>
            This works in reverse too — price drops lower the APY which can cause exits.
            That's why diversification across 100+ projects matters. No single project
            can collapse the whole system.
          </div>
        </div>
      </div>

      {/* Distribution timeline */}
      <SectionTitle>30-Day Rolling Distribution</SectionTitle>

      <Box
        title="HOW REWARDS DRIP"
        color={C.cyan}
        icon="💧"
        items={[
          "Day 1: $10 in fees collected → buys $INCLAW → added to 30-day reward pool",
          "Day 2: Another $10 → pool grows. Day 1 rewards begin dripping to stakers",
          "Day 3-30: Fees compound daily. Each day's purchase drips over the next 30 days",
          "Day 31+: Rolling window — day 1's rewards fully distributed, day 31's fees enter pool",
          "Result: Smooth, predictable daily rewards. No lumpy distributions or claim rushes",
        ]}
        footer="Stakers see rewards accumulate in real-time. Can claim anytime. No lock on rewards — only on the staked token if you choose to unstake."
      />
    </div>
  );
}

// ======================== MAIN APP ========================

export default function InclawbatorSystem() {
  const [activeTab, setActiveTab] = useState(0);

  const tabContent = [
    <SystemOverview />,
    <TokenLaunch />,
    <AutoStaking />,
    <FeeArchitecture />,
    <ExampleNumbers />,
    <MigrationPath />,
    <NFTEndgame />,
    <Flywheel />,
    <DiscoveryLayer />,
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.white,
        fontFamily: fonts.body,
        padding: "0",
      }}
    >
      {/* Grain overlay */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "900px", margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <span style={{ fontSize: "28px" }}>🦞</span>
            <div>
              <h1
                style={{
                  fontFamily: fonts.heading,
                  fontSize: "28px",
                  fontWeight: 700,
                  color: C.white,
                  margin: 0,
                  letterSpacing: "-0.5px",
                }}
              >
                INCLAWBATOR
              </h1>
              <div style={{ fontFamily: fonts.mono, fontSize: "12px", color: C.textDim, letterSpacing: "2px", marginTop: "2px" }}>
                PERMISSIONLESS LAUNCHPAD + AUTO-STAKING
              </div>
            </div>
          </div>
          <div
            style={{
              height: "2px",
              background: `linear-gradient(90deg, ${C.red}, ${C.gold}, transparent)`,
              marginTop: "16px",
            }}
          />
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
            marginBottom: "24px",
            padding: "4px",
            background: C.card,
            borderRadius: "10px",
            border: `1px solid ${C.border}`,
          }}
        >
          {TABS.map((tab, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                fontFamily: fonts.mono,
                fontSize: "11px",
                fontWeight: activeTab === i ? 700 : 400,
                color: activeTab === i ? C.white : C.textDim,
                background: activeTab === i ? C.red + "33" : "transparent",
                transition: "all 0.2s",
                letterSpacing: "0.3px",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div
          style={{
            background: C.card + "80",
            border: `1px solid ${C.border}`,
            borderRadius: "12px",
            padding: "24px",
          }}
        >
          {tabContent[activeTab]}
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: "24px",
            textAlign: "center",
            fontFamily: fonts.mono,
            fontSize: "11px",
            color: C.textDim,
          }}
        >
          Incubated by Inclawbate · inclawbate.app · Min 20% of all fees buy $INCLAW · Treasury earns yield · All value flows back
        </div>
      </div>
    </div>
  );
}
