# $SUITE LP Investment Analysis
## Expected Returns with $20K vs $40K Initial LP

---

## Assumptions
- **Total Supply**: 10,000,000 $SUITE
- **LP Allocation**: 70% (7,000,000 tokens)
- **Monthly Emission**: 83,333 $SUITE (for 24 months)
- **Subscriber Behavior**: 100% sell (worst case)
- **No buybacks modeled** (conservative)

---

## Scenario 1: $20K LP Seed

**Setup:**
- LP: $20,000 USDC + 7,000,000 $SUITE
- Initial price: $0.00286/token
- Constant product: k = 140,000,000,000

**Monthly Sell Pressure (if 100% sell):**

| Month | Tokens Sold | USDC Extracted | USDC Remaining | Price |
|-------|-------------|----------------|----------------|-------|
| 1 | 83,333 | $235 | $19,765 | $0.00279 |
| 6 | 500,000 | $1,380 | $18,620 | $0.00253 |
| 12 | 1,000,000 | $2,680 | $17,320 | $0.00229 |
| 24 | 2,000,000 | **$4,444** | **$15,556** | $0.00173 |

**After 24 months:**
- **USDC lost**: ~$4,444 (22% of initial)
- **USDC remaining**: ~$15,556
- **You still own**: 9,000,000 $SUITE in LP (worth $15,556)
- **Total value**: ~$31,112 (tokens + USDC)

⚠️ **You didn't "lose" $4,444** — it went to subscribers as rewards. The tokens are still in LP.

---

## Scenario 2: $40K LP Seed

**Setup:**
- LP: $40,000 USDC + 7,000,000 $SUITE
- Initial price: $0.00571/token
- Constant product: k = 280,000,000,000

**Monthly Sell Pressure:**

| Month | Tokens Sold | USDC Extracted | USDC Remaining | Price |
|-------|-------------|----------------|----------------|-------|
| 1 | 83,333 | $470 | $39,530 | $0.00556 |
| 6 | 500,000 | $2,750 | $37,250 | $0.00506 |
| 12 | 1,000,000 | $5,300 | $34,700 | $0.00459 |
| 24 | 2,000,000 | **$8,750** | **$31,250** | $0.00347 |

**After 24 months:**
- **USDC lost**: ~$8,750 (22% of initial)
- **USDC remaining**: ~$31,250
- **Total LP value**: ~$62,500

---

## Key Insights

### ❌ You Won't Lose All Your Money
The AMM's constant product formula means **each sell has diminishing impact**. The more they sell, the worse the price gets, so extraction slows down.

### Maximum Extractable (Theoretical)
Even if everyone sold everything forever:
- **$20K LP**: Max ~$4,400 extractable by subscribers (22%)
- **$40K LP**: Max ~$8,800 extractable by subscribers (22%)

### With Buybacks (More Realistic)
If you have **50+ subscribers** at $20/mo:
- 30% buyback = $300/month buying $SUITE
- This **offsets** most sell pressure
- LP could actually **grow** over time

| Scenario | Net Monthly USDC Flow |
|----------|----------------------|
| 100% sell, 0 subs | -$235/mo |
| 100% sell, 50 subs | +$65/mo ✅ |
| 50% sell, 100 subs | +$515/mo ✅✅ |

---

## Conclusion

| LP Seed | Max Loss (24mo) | Realistic Loss (with buybacks) |
|---------|-----------------|-------------------------------|
| $20K | ~$4,400 (22%) | Likely $0 or positive |
| $40K | ~$8,800 (22%) | Likely $0 or positive |

**Bottom line**: With the buyback mechanism and real subscribers, you should break even or profit. The "loss" only happens if you have zero subscribers and 100% sell pressure — which would mean a failed project anyway.

---

*Analysis assumes AMM constant product formula. Actual results vary with trading volume, speculator activity, and subscriber behavior.*
