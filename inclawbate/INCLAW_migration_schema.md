# $INCLAWNCH → $INCLAW Token Migration — Technical Schema

## Context for Agent

You are helping design and build the smart contract architecture for a token migration from $INCLAWNCH to $INCLAW. This is a collaborative design process — think critically about edge cases, suggest improvements, and flag risks. Don't just execute blindly.

The ecosystem is on Base (Clanker-launched tokens). The community is ~111 members. The founder (Stuart) controls the protocol treasury and admin functions.

---

## High-Level Migration Flow

### Phase 1 — Snapshot + Launch
- Take a snapshot of ALL $INCLAWNCH holders and stakers (wallet addresses + balances)
- Launch $INCLAW on Clanker
- Stuart buys initial bag with personal ETH to establish price floor

### Phase 2 — 1:1 Airdrop
- Airdrop $INCLAW to every wallet from the snapshot at a 1:1 ratio
- Holders and stakers both receive — no one is excluded
- Goal: seamless UX — people just see the new token in their wallet
- A new staking pool for $INCLAW goes live with the same APY structure

### Phase 3 — INCLAWNCH Collection + Angel NFT
- Post-airdrop, holders still have their old $INCLAWNCH (it's now essentially "bonus" value)
- Offer: send your INCLAWNCH to a designated contract/wallet → receive an Angel NFT
- Only wallets from the original snapshot are eligible (prevents gaming)
- 1 Angel NFT per wallet — must send full INCLAWNCH balance (amount at snapshot)
- Alternative: holders can just sell their INCLAWNCH on the open market instead

### Phase 4 — Liquidity Bootstrapping
- Stuart sells all collected INCLAWNCH for ETH
- Uses that ETH to buy INCLAW
- Distributes purchased INCLAW to stakers as bonus rewards over a 1-week launch period
- After week 1, rewards normalize to sustainable 20-50% APY range

---

## Angel NFT Mechanics

### Core Design
- **Supply:** Capped by snapshot count. If 80 wallets qualify, max 80 Angel NFTs can ever exist. Likely fewer since some will just sell INCLAWNCH instead.
- **Eligibility:** Snapshot wallets only. No outside buyers can participate.
- **Cost:** Send back 100% of your INCLAWNCH balance (as recorded at snapshot) to mint.
- **Tradeable:** Yes, on secondary market.

### Staking Weight Bonus
- The Angel NFT grants a **flat +1 weight bonus** on INCLAW staking
- Base staking weight = 1
- With Angel NFT = weight of 2
- This is a FLAT bonus, NOT a multiplier on stake size
- A whale staking 10,000 INCLAW gets the same +1 as someone staking 100
- Design intent: "we value being early over being rich"

### Reward Distribution Formula
```
user_reward = (user_weight / total_weight) * daily_reward_pool

where:
  user_weight = 1 (base) + 1 (if holds Angel NFT) = 1 or 2
  total_weight = sum of all staker weights
  daily_reward_pool = variable, targeting 20-50% APY
```

### Example
- 10 stakers with Angel NFT (weight 2 each) = 20
- 5 stakers without (weight 1 each) = 5
- Total weight = 25
- $100 daily pool:
  - NFT holder: (2/25) × $100 = $8/day
  - Non-NFT holder: (1/25) × $100 = $4/day

---

## Reward Schedule

| Period | Source | Rate |
|--------|--------|------|
| Week 1 (launch) | ETH from INCLAWNCH sales → buy INCLAW → distribute | One-time bonus pool |
| Week 2+ | Protocol fees + treasury | 20% APY minimum, up to 50% APY |

---

## Future: OG NFT (Not Part of This Build)

- Separate NFT collection planned for when INCLAW hits 500k-1m market cap
- Different from Angel NFT — this is a milestone reward, not a migration mechanic
- Details TBD — just noting it exists in the roadmap so architecture doesn't conflict

---

## Open Questions to Think Through Together

1. **Snapshot mechanics:** How do we capture staked balances? Are they readable directly from the staking contract? Or do we need to account for staked + wallet balances separately?

2. **Airdrop execution:** Batch transfer vs claim contract? Batch is better UX (tokens just appear) but costs more gas on Stuart's end. Claim contract is cheaper but worse UX.

3. **INCLAWNCH collection contract:** Does this need to be a full contract, or can it be a simple admin wallet with off-chain tracking? Contract is trustless but more complex. Admin wallet is simpler but requires trust.

4. **Angel NFT contract:** ERC-721 on Base. The staking contract needs to check if a staker holds the NFT to apply the weight bonus. How should this lookup work — direct balanceOf check on-chain, or a registry?

5. **Edge cases:**
   - What if someone sends partial INCLAWNCH (not their full snapshot balance)?
   - What if someone bought more INCLAWNCH after snapshot — do we only accept the snapshot amount?
   - What if someone transfers their Angel NFT but is still staking — does the weight update immediately?
   - What happens to INCLAWNCH LP providers? Are they included in snapshot?

6. **Timing:** What's the gap between snapshot and airdrop? Too short and people can game it. Too long and the community gets anxious.

7. **The staking contract for INCLAW:** Is this a new deployment or modifying existing INCLAWNCH staking? Needs to support the weight system natively.

---

## Tech Stack Assumptions (Verify/Adjust)

- Chain: Base
- Token standard: ERC-20 (INCLAW via Clanker)
- NFT standard: ERC-721 (Angel NFT)
- DEX: Uniswap V3/V4 on Base
- Staking: Custom contract with weight-based reward distribution
- Language: Solidity

---

## Priority Order

1. Snapshot tooling (capture all holders + stakers)
2. INCLAW token launch (via Clanker)
3. Airdrop execution
4. Angel NFT contract
5. New staking contract with weight system
6. INCLAWNCH collection mechanism
