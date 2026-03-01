--- Seite 1 ---
# Cosmo-Local Credit (CLC) DAO

White Paper

A Network for Routing Credit, Settling Commitments, and Financing a Healthy Cosmo-Local Economy

Version: 0.6

Authors: William O. Ruddick, Mohamed Sohail &amp; contributors

Contact: info@grassecon.org

Intended audience: Pool builders/stewards, protocol engineers/auditors, impact-liquidity providers and mandate funders, governance designers, and legal/compliance reviewers.

# Abstract

The Cosmo-Local Credit (CLC) DAO is a network clearing house and governance layer for Commitment Pooling Protocol (CPP) curation markets. Commitment Pools (CPs) coordinate redeemable commitments (vouchers) using four pooling functions: Curation (Commitment Registry), Valuation (Value Index Registry), Limitation (Swap Limiter), and Exchange (Vault/Fee Registry: fee policy + custody/settlement). CLC routes liquidity across pools, funds insurance, collects a network rake on pool usage with auditable governance.

Cosmo-local means we share open standards and software globally, while keeping issuance, redemption, governance, and real-world accountability local.

CPP curation markets: independent CPs list ("curate") which vouchers they accept, publish their own value indices, limits, fees, and guarantee structures (reserves, guarantors, and redemption SLAs). CLC DAO provides network routing, shared standards, and insurance layers - but does not automatically guarantee any specific pool or voucher unless explicitly stated by that pool's terms and the DAO's published policies.

# Pool Sovereignty &amp; Forkability.

Commitment Pools are sovereign: each pool's steward(s) can change their own listings, limits, fees, guarantees, and routing preferences, and can exit the CLC canonical registries at any time. "Canonical" registries and routers are a convenience layer for discovery and shared standards - not a monopoly.

The CLC technical stack is intentionally forkable: all contracts and SDKs are open-source and reproducible; registries are mirrored; and there is a documented "fork &amp; migrate" procedure (see §11.5)

--- Seite 2 ---
so communities and operators can credibly exit if governance is captured or drifts from shared values.

## Key Concepts:

- **Confederation note**: CLC is designed so that many independent CPP networks can coexist (each with its own registry roots, compliance policies, and insurance scope) while still routing to one another through multi-profile discovery. Canonical registries/routers are a convenience layer, not a monopoly; credible exit is preserved by fork-and-repoint (see §§5.2a, 8.1, and 11.5).
- A “profile” is a named bundle of registry roots + routing policies (and optional compliance/insurance scope) that a community can choose as its discovery and safety baseline.

- **Cosmo-Local**: Cosmopolitan-localism links local communities through shared global infrastructures while keeping production, redemption, and governance local. In practice: we share “light” resources globally (standards, software, knowledge, registries), while keeping “heavy” realities local (relationships, fulfillment, ecology, material production, and legal accountability). This aligns with “Small, Local, Open and Connected” (SLOC) and “design global, manufacture local” (DGML): share what’s light; keep what’s heavy local. See Cosmopolitan_localism

- **Cosmo-Local Credit (CLC)**: CLC applies this to obligations: commitments are issued, guaranteed, and redeemed locally, but can be discovered and routed globally across trusted pools using common registries, auditable receipts, and safety constraints (limits/reserves).
- Example: a clinic voucher remains a local promise, but it can be swapped into food or transport credits by routing through trusted pools, with receipts showing what happened and why.

- **Cosmo-Local Economy**: A cosmo-local economy is a federation of local markets that interoperate and clear obligations without a central monopoly. Communities can choose their routers/registries, publish their own policies, and retain credible exit (forkability) if governance is captured.

- The digital layer is a shared memory + coordination tool, not a replacement for in-person relationships or local accountability. We explicitly design against techno-solutionism and capture risks by prioritizing: credible exit/forkability, local sovereignty, transparent receipts, timelocks/quorums, bounded limits/reserves, and low-tech access (assisted flows). Where proof matters, vouchers may require simple evidence (signatures/photos/device proofs) governed locally.

- **Producer Credit (repay-by-delivery)**: CLC also enables working-capital lending where lenders can accept curated vouchers as exchangeable collateral. A lender (or LP program) can provide stablecoins into a pool or credit facility and receive the borrower’s vouchers; as those vouchers are bought, routed, and redeemed in trusted markets, the borrower repays in-kind, and the system can route receipts so repayment happens faster than waiting for cash collection.

--- Seite 3 ---
# Quick Facts

1. What this is: CLC DAO is a clearing network for redeemable commitments (think: tokens, digital gift-cards / service credits / delivery claims) that can be exchanged across curated markets.
a. Not 1-to-1 barter: barter is usually a direct trade between two people. A Commitment Pool enables multi-party exchange - you can contribute value to the pool and later redeem from the pool's shared inventory. It's multilateral barter through a shared intermediary (the pool) - CLC expands that by routing between a network of pools..

2. Values:
a. Care for People – collaboration and vision driven care for oneself and others' well-being and happiness
b. Care for the Environment - support environmental protection and regeneration, minimize use of finite resources for economic activity, ecosystem management approach to farming and business development.
c. Fairness - fair and secure access to Instruments, land, resources, knowledge &amp; care for members from different backgrounds, age, gender and religion.
d. Reciprocity – mutual sharing of risk, cost and surplus
e. Non-Dominance - no person or association to have dominant rights over another person or association's resources eg. data, finances, intellect, materials and freedom.
f. Resilience - capacity to prepare for, address and adapt to economic, political, climate and other events in order to ensure sustainable community based systems/commons.

3. How we reach sustainability / How fees are generated: Fees come from settlement activity (people swapping, redeeming, and fulfilling goods/services), not price speculation. A small rake on routed swaps/settlements across all CPs. The network rake is a percentage of the fees set by pool stewards (curators) (post waterfall).
a. Opt-in, not extraction: the network rake applies only to pools that opt into CLC's canonical discovery/standards layer. Pools remain sovereign and can exit canonical registries/routers at any time while continuing to operate locally.
b. Not trickle-down: pooled fees are allocated by a published Waterfall - insurance targets, core operations, and liquidity/off-ramp mandates come first. Only after those priorities are met can a capped "fee-access budget" be published.

4. How Liquidity Providers participate:
a. Provide liquidity by seeding designated Commitment Pools (receive policy-gated swap access to pooled fees) under published limits and may become eligible for CLC governance tokens via the Impact Seeding program (§7.2.3).
b. Support liquidity mandates (policy-directed endowments; reporting-heavy; impact-first).
c. Lock (stake/escrow) CLC to receive stCLC (voting power).
d. Each epoch, the protocol may also mint sCLC (epoch authorization / incentives) under published caps. sCLC can be used to exercise capped swap access into designated fee-holding pools after the Waterfall. No dividends. No profit-share. No residual rights.

5. What you fund: You provide liquidity endowments (e.g., stable cash-equivalents) so real-world vouchers can be exchanged and redeemed smoothly.

--- Seite 4 ---
6. Downside controls: Losses are bounded by limits + inventory checks + disclosed guarantees + an insurance waterfall + timelocked governance + credible exit (forkability).

7. What you receive: Public dashboards and receipts: volume, settlement rate, redemption SLA performance, reserves, incidents, fee flows, and governance changes (timelocked and logged), plus the KPI list used for mandates and insurance targets.

8. What moves? Redeemable commitments (vouchers).

9. What's the goal? Increase velocity of settlement of real-world obligations - while maintaining the CLC values.

a. We treat the digital layer as shared memory and coordination (not as a substitute for human relationships) and design explicitly against capture (timelocks, transparency, limits, and credible exit).

10. Who guarantees what? Issuers guarantee their own vouchers. Each Commitment Pool (CP) curates listings and is responsible for its own guarantees (reserves/guarantors/SLA). The CLC DAO provides routing + standards + governance and may offer optional insurance policy layers; it does not automatically guarantee every pool. This avoids "free-riding": routing and insurance are granted under explicit, published requirements (limits, reserves, disclosure, reporting), and routers can degrade/deny routes to pools that don't meet them. The CLC DAO is not a universal guarantor unless explicitly stated in DAO policy and pool terms.

11. Benefits? Where enabled by policy, staked CLC participants may receive time-bounded swap access (via sCLC) to a defined portion of pooled fees, under caps/windows; governance may set this access to zero in any epoch.

12. Safety? Each CP has per-voucher/window limits, reserve policies, guarantor bonds, insurance waterfall, circuit breakers.

Reader Map (where to look)

- If you care about confederation &amp; interoperability: see §5.2a, §8.1, and §11.5.
- If you care about guarantees / insurance boundaries: see §11.3.
- If you care about LP economics and fee flow: see §7.4, §9, and §12.
- If you care about risk controls: see §6 and §10.
- If you care about forkability and credible exit: see §8.2 and §11.5.

Executive Summary

--- Seite 5 ---
Modern financial systems excel at trading volatile assets but struggle to finance real production, community resilience, and long-term commitments. The Commitment Pooling Protocol (CPP) offers an alternative: a simple, extensible protocol for issuing, routing, and settling redeemable commitments (claims on future goods, services, and labor) within and across communities. Issuers guarantee their vouchers; pools may add disclosed guarantees; the CLC DAO is not a universal guarantor unless explicitly stated in DAO policy and pool terms.

CPP is already live in pilot on Sarafu.Network, coordinating community vouchers, savings groups, mutual aid systems, and production commitments.

Current Traction (Sarafu.Network, since Jul 5 2023 on Celo; as of Jul 20 2025):

Via Dune Analytics: https://dune.com/grassrootseconomics/sarafu-network

- 26,367 users
- 285,197 peer-to-peer exchanges
- 188 unique active commitment pools
- 745 unique active vouchers
- $320,692 pool swap volume
- 899 impact reports published (https://sarafu.network/reports)

What the existing CPP systems on Sarafu Network currently lack is a liquidity and governance layer that can:

1. Inject liquidity across pools,
2. Decentralize decision-making as the network scales,
3. Underwrite settlement risk via shared insurance policies and incident runbooks,
4. Provide bounded, policy-gated fee-credit (ex-post swap access to a defined portion of pooled fees) for those who underwrite risk and coordination.

The Cosmo-Local Credit (CLC) DAO is proposed to fulfill this role.

CLC is designed as a win-win routing layer across curated commitment markets:

1. Pool stewards curate voucher listings and publish guarantees; their reputation becomes discoverable and comparable.
2. Lenders and liquidity providers can finance real production while holding collateral that is redeemable (vouchers) and can be routed across trusted pools.
3. Producers/borrowers get working capital now and can repay in-kind by fulfilling their vouchers - broadening their market instead of shrinking it.
4. Consumers can browse curated markets they trust and choose purchases that directly reduce someone's outstanding obligations.

--- Seite 6 ---
5. CLC stakers govern where liquidity is injected to increase settlement velocity and receive swap access to protocol fees as defined by on-chain policy.

CLC introduces a network governance and liquidity token (CLC) that aligns liquidity providers, pool creators, communities, and stewards around one shared goal:

Increase the velocity of settlement of real-world commitments while preserving care, fairness, and resilience.

A worst-case governance scenario: A hostile actor accumulates CLC voting power (e.g., via public markets) and attempts to redirect fee flows, weaken curation standards, or force liquidity mandates that harm communities.

This DAO therefore treats anti-capture and credible exit (forkability) as first-class safety properties: (i) time-locked and multi-threshold governance for critical parameters, (ii) voting power that requires lockups (no instant governance via spot purchases), (iii) transparent delegation and conflict-of-interest rules, and (iv) a documented fork-and-migrate process so pools and communities can exit if governance is captured (see §11.X).

# 1. Commitment Pooling Protocol (CPP): The Core Primitive

Mental model: A Commitment Pool is like a small, governed clearing house for community “gift cards” (vouchers). People deposit vouchers or reserve assets, exchange them under published rules, and redeem them for real goods/services. The software enforces limits and keeps receipts so disputes and guarantees can be handled transparently. CLC connects many pools so vouchers can find redemption paths beyond a single community.

CPP is a protocol for coordinating value using commitments. Commitments are the economy; CLC makes them open and routable. CPP is described in the book, Grassroots Economics: Reflection and Practice.

# 1.1 What is a Commitment?

A commitment is a clearly defined promise of future delivery - e.g., maize, transport services, labor hours, storage, or currency redemption. These commitments are represented as vouchers, which function economically like pre-paid delivery claims (similar to gift cards / service credits). (further defined in the section of voucher schemas).

# 1.2 What is a Commitment Pool?

--- Seite 7 ---
Roles:

- Pool steward: decides listings, values, fees, limits, guarantees, and pauses for a specific pool.
- DAO (CLC): governs shared network services- standards/registries, routing policies, monitoring, liquidity/off-ramps, and optional insurance.
- Router/operator: finds and executes paths across pools; can prefer safer profiles and degrade toxic routes.
- Guarantor (optional): backs specific vouchers/pools with an explicit remedy if commitments fail.

A Commitment Pool is a stewarded contract suite that implements four interfaces:

- **Curation**: Registers acceptable vouchers (Commitment (token) Registry),
- **Valuation**: Maintains a value index (Value Index Registry),
- The Value Index is the pool’s price list: a reference that says how much each voucher is worth relative to a common unit (often local currency), so swaps can be quoted consistently. Pools can use different valuation methods and still interoperate, as long as each pool can quote and enforce its own rules on each hop.
- **Limitation**: Enforces credit/swap limits (Swap Limiter),
- **Exchange (Vault/Fee Registry)**: Configures fees and custodies assets; executes seed/swap only if listed, valued by the pool index, within limits, and in stock; emits receipts for every action.

Each pool behaves like a mini clearinghouse inside a cooperative, governed locally by those who depend on it.

**Big idea**: We are already doing commitment pooling all the time: wages, rent, invoices, loans, warranties, memberships, and mutual aid are all promises that get trusted, netted, and settled. Today that pooling is mostly closed, opaque, and permissioned (inside institutions and platforms) so commitments can’t easily connect or route beyond their enclosures. CLC DAO proposes to make the underlying protocol open and interoperable, so commitments can be published, pooled, and routed across communities and markets - by anyone.

**Why this matters**: pools can be compared and risk-rated because their listings, limits, fees, reserves, and guarantees are explicitly published.

Minimal Swap Logic (canonical)

1. Listed?: Input and output vouchers must be listed in the Commitment Registry.
2. Price?: Compute input→output via the Value Index (with fee preview).
3. Limits?: Enforce Swap Limiter windows/caps for each voucher (and account/global if configured).
4. Exchange:
a. (fees): Apply Vault/Fee Registry fee rules (pair-specific OK); preview and emit on receipt.
b. (inventory): Verify Vault inventory for the outgoing voucher.

--- Seite 8 ---
5. Transfer &amp; Log: Move in/out, update registries, and emit immutable receipt (quoteld→receiptld).
6. Multi-hop?: Repeat hop-by-hop; atomic if supported, else HTLC/escrow with explicit abort paths.

In other words: a pool only lets people exchange vouchers that are (a) approved, (b) priced by the pool's published index, (c) within safety caps, and (d) actually in stock - then it issues a receipt.

## 1.3 Why CPP is Different from Traditional Crypto Decentralized Exchanges (DEXs)

Most decentralized exchanges (automated trading pools) rely on bilateral token pairs, continuous curves, and volatility-driven fees. CPP supports those use cases and enables low-frequency, high-impact coordination:

- Community savings (VSLAs),
- Production financing,
- Mutual credit and mutual aid,
- Insurance and guarantees,
- Lending against real output,
- Settlement of personal and institutional debts.
- Portfolio-directed liquidity (e.g. curated pools for ecosystem services, humanitarian support, and health &amp; wellness)

CPP is optimized for fulfillment and auditable receipts, not speculative churn.

## 2. The Accounting Shift: From Assets to Trust

Traditional finance begins with Assets – Liabilities = Equity. CPP reframes this for a commitment economy:

- Credit Access: How much the network is still willing to accept from you.
- Outstanding Commitments (Debt): Your unfulfilled promises held by others.
- Backing Capacity: Your real ability to honor those promises.

## Commitment–Capacity Identity:

Credit – Debt = Backing Capacity

This identity governs risk, limits, and safety across pools: unlimited issuance does not imply unlimited power - only accepted commitments matter.

--- Seite 9 ---
Example: A transporter issues "100 rides" in vouchers. The network only accepts 40 rides worth at a time (credit access). If 15 rides are currently outstanding (debt), then backing capacity = 40 - 15 = 25 rides worth of additional safe acceptance.

## 3. Velocity of Settlement: Why Liquidity Providers Should Care

We reframe "velocity of money" as velocity of settlement: how quickly outstanding promises move from owed to fulfilled.

For a given voucher type j across a network of CPs, define:

1.  D_j = total outstanding debt (unsettled vouchers) valued in a common index
2.  S_j = total value of settlements (redemptions routed through CPs) per period

Then the network settlement velocity of voucher j is:

$$
V_j \text{ (network)} = S_j / D_j
$$

This is a flow/stock ratio: how many units of settlement flow pass through the network per unit of outstanding debt. We will expand this below to a federation of CPs.

**Key insight:** swaps do not change total value in a pool or the network; only settlement (redemption) reduces debt of the voucher issuer. Liquidity that increases routing capacity increases settlement velocity, which drives economically grounded fee volume.

**Plain language:** If vouchers get redeemed quickly, more real trade flows through the network. More flow → more fee events → more sustainable fee pooling.

## What This Is / Isn't

- Not an AMM for speculative pairs. CPP values and limits are policyful and capacity-aware.
- Not a bank deposit scheme. Vouchers are redeemable claims with explicit SLAs and fallback guarantors.
- Not uncollateralized credit expansion. Limits and inventory checks bound issuance and routing.
- Is a clearing network for redeemable commitments with auditable receipts and recourse.
- Is a producer-credit &amp; clearing rail: vouchers can function as exchangeable collateral, enabling working capital that can be repaid through in-kind fulfillment as vouchers are purchased and redeemed.

--- Seite 10 ---
4. Reusable Forward-Style Collateral

When debt is collateralized by fungible, tradable vouchers (reusable gift cards or production forwards):

- Collateral becomes liquid and discoverable across pools,
- Obligations are absorbed by those best placed to fulfill them,
- Default risk decreases as redemption paths multiply,
- Throughput (and fee generation) increases for LPs without raising leverage.

4.1 Producer Credit Loop (Loan Repayment via Curated Vouchers)

CLC enables a form of producer credit where a loan can be repaid through real-world delivery:

1. A producer (or service provider) issues a voucher: a redeemable claim on their future output (e.g., “10 taxi rides,” “50kg maize,” “10 labor-hours”).
2. A pool steward lists (“curates”) that voucher, publishes limits, fees, valuation policy, and the guarantee structure (e.g., reserve policy and/or guarantor bond and an SLA).
3. A lender (or LP program) provides stablecoins into the pool or into a designated credit facility, receiving the producer’s curated vouchers as collateral (or as the primary repayment instrument).

a. Note: the lender is not stuck holding a private IOU. They hold vouchers that other people actually want (because they’re redeemable), and those vouchers can be swapped/routed across curated pools - so collateral is more liquid. Meanwhile, the borrower can repay by delivering what they produce, and every redemption reduces their outstanding obligation.

b.

4. Consumers purchase or accept those vouchers within curated markets they trust. When consumers redeem (or when vouchers are routed and settled), the producer fulfills in-kind.
5. Critically: voucher settlement reduces the producer’s outstanding obligations. The system can route proceeds/receipts so that settlement activity accelerates the producer’s debt payoff—meaning “anyone” who buys/redeems the voucher helps retire the producer’s debt faster (with pool fees funding the curation + routing infrastructure).

--- Seite 11 ---
6. Redemptions reduce outstanding obligations of voucher issuers; receipts reference voucher class, SLA, and any applicable guarantee.

This turns repayment from “wait for cash” into “get fulfilled by real delivery,” while preserving clear limits, inventories, receipts, and recourse.

Mini example: A producer receives $1,000 working capital. They issue $1,000 worth of “maize vouchers.” As those vouchers are bought and redeemed, the producer’s outstanding obligation falls - so end-user purchases directly retire the loan. As demand for the vouchers increases (more people swapping into them), more redemptions occur - so the loan amortizes through real customer usage, not only through cash repayments.

5. From Isolated Pools to a Federated Network

CPs interoperate when they list the same vouchers. Routers move value across pools, respecting each hop’s value index, limits, fees, and inventory. As pools proliferate:

- Routing paths multiply,
- Settlement velocity increases,
- Fee volume grows,
- The network becomes more valuable than any single pool.

Routing story: A school accepts “maize vouchers” but needs “transport vouchers.” A router finds a path across pools that accept both. The swap clears only if each hop is within limits and inventory ... so the voucher reaches someone who can actually redeem it.

5.1 Velocity Multiplier

When pools operate in isolation, each voucher can only settle within the small local circle that recognizes it. As pools are federated via a common protocol:

1. More routes appear: a voucher can cross several pools to reach someone who can redeem it.
2. Credit is aggregated: multiple pools’ acceptance capacity can support the same voucher type.
3. Netting surfaces: multi-lateral swaps reduce the need for bilateral matching.

The result is a higher Sj for a given D~j: the same stock of obligations can find fulfillment faster. Formally, if we index pools by k:

--- Seite 12 ---
$$
S _ {j} = \sum_ {k} S _ {j} ^ {(k)}, \quad D _ {j} = \sum_ {k} D _ {j} ^ {(k)}
$$

Connectivity increases the $\{S_j(k)\}$ terms without necessarily increasing $\{D_j(k)\}$.

Thus The Velocity for (j) across the network rises as routing improves.

## 5.2 Routing as a Service: Pathfinding + Rebalancing (Liquidity-Saving)

In CLC Network, "routing" is not only a user-facing convenience ("swap voucher A for voucher B"). It is also a network liquidity service that increases settlement velocity by improving how inventory is distributed across pools and by surfacing multilateral netting opportunities.

Two routing modes:

1) End-user routing (on-demand)

Given (token_in, token_out, amount, constraints), the router discovers a multi-hop path across CPs. A route is valid only if each hop clears: (i) listing/registry checks, (ii) value index pricing, (iii) swap limiter windows/caps, (iv) fee rules, and (v) outgoing inventory availability. Execution is atomic where possible; otherwise HTLC/escrow is used with explicit abort paths.

2) Pool rebalancing / batch netting (scheduled or threshold-triggered)

Pools may opt-in to publish "rebalance intents" (or standing constraints): target inventory bands by voucher class, maximum deviation vs. the pool's value index, per-epoch caps, and allow/deny routing preferences. Routers/clearing agents then search for multilateral cycles and chains that:

(i) satisfy every hop's limits and inventories,

(ii) reduce inventory imbalance across pools, and

(iii) maximize total off-set value subject to policy constraints.

--- Seite 13 ---
These cycles are executed as batch routes, producing receipts per hop (quote → receipt mapping).

## Why this works

Obligation networks contain cycles. When cycles are processed simultaneously, obligations can be discharged faster and, in some cases, with less external liquidity than sequential bilateral processing. This “cycle surfacing” effect is what CPP routing unlocks across Commitment Pools—subject to each pool’s published value, limit, fee, and inventory constraints.

## Opt-in &amp; sovereignty note

Rebalancing is never forced. A pool can be routable for end-users while disabling outbound rebalancing, or can enable only specific voucher classes, caps, and counterparties.

As routing and netting improve, the network can produce more fee events from real settlement activity; this can expand (policy-permitting) the fee-credit budget that defines sCLC swap-access capacity - without turning sCLC into an equity or profit instrument.

## 5.2a Confederation &amp; Interoperability

CLC is designed as a confederation protocol: many independent networks can run their own registries, routers, and policy layers, while still routing to one another when they share compatible vouchers and standards. This is not a hub-and-spoke monopoly; it is a mesh of overlapping curations.

### Interoperability incentive (why open source + forks help everyone):

- Any fork/network that remains CPP-compatible can route to CLC pools (and CLC routers can route to theirs), increasing settlement paths, inventory reach, and real-world fulfillment velocity for all parties.
- More interoperable networks → more routable paths → higher throughput and fee volume from real settlement activity (not speculation), benefiting LP programs and routing services across the confederation.
- Open-source “forkability” reduces systemic risk: if any canonical registry/router becomes captured or degraded, communities can re-point or fork without bricking local economies.

--- Seite 14 ---
# Confederation mechanics (how it works):

1) Multi-profile discovery and explicit user/pool choice of registry roots ("network profiles") (see §8.1).
2) Reciprocal routing: confederated networks can publish mutual allowlists (registry roots / bridge adapters) with risk parameters (caps, escrow requirements, health-score thresholds).
3) Policy separation: each profile defines its own fee norms, insurance scope, and compliance hooks; routing across profiles must satisfy each hop's stated constraints and inventory.

# 5.3. From Settlement Velocity to Fee Volume

Every routed swap or settlement can carry a small fee, analogous to an interchange fee in card networks.

Let:

1.  $\tau =$  average fee rate (e.g.  $0.2\%$  per routed value unit)
2.  $D_{\text{tot}} =$  "how many promises exist" (total outstanding redeemable obligations across vouchers, valued in the common index)
3.  $V(\text{settlement}) =$  aggregate settlement velocity across all vouchers

Then approximate total fee revenue per period as:

$$
F \approx \tau \cdot V _ {\text {s e t t l e}} \cdot D _ {\text {t o t}}
$$

1.  $D(\text{tot}) =$  "how many promises exist," (Total Value locked via swaps)
2.  $V(\text{settlement}) =$  "how fast they move,"
3.  $\tau =$  "how much the network skims per unit of routed value." Note that this is a percentage of the fees that pool stewards charge.

Rake-on-rake clarification (pool fees  $\rightarrow$  DAO rake). Pool stewards set a per-pool usage fee f_p (as % of value routed through that pool). The CLC DAO sets a rake share r_p (as % of that pool's collected fees). The effective network fee rate contributed by that pool is:

$$
\tau_ {p} = f _ {p} \cdot r _ {p}
$$

The network-wide  $\tau$  is the routed-value-weighted average across pools and routes (plus any router fees when applicable).

Convertibility constraint (cash-eligible vs. in-kind fees). Fees are collected in the same asset that moves through pools. If fees arrive as clinic credits or service vouchers, they can't directly pay for auditors, incident response, or insurance unless they are settled in-network or converted under policy.

Some fee assets are cash-equivalent/convertible (stables, major liquid tokens), while others are not

--- Seite 15 ---
(non-fiat-redeemable vouchers). Let  $\chi$  be the share of total fee inflows that are cash-eligible/convertible after slippage and policy constraints. Define cash-usable fee revenue as:

$$
F _ {\text {c a s h}} \approx \chi \cdot F
$$

Eligibility &amp; conversion note: Fee inflows may include both cash-eligible assets (stables / major liquid tokens) and in-kind voucher assets. The protocol may convert allowlisted cash-eligible assets into stables/fiat when needed to meet insurance payouts, maintain off-ramp liquidity, and fund core operations - while prioritizing in-network settlement and using liquidity mandates/CLC Pool inventories to reduce settlement latency.

Break-even and any non-zero sCLC fee-access budgets must be evaluated on F_cash, not gross F.

## Break-even &amp; Self-Sustaining Scenarios (illustrative, update quarterly):

Publish a 3-row table each quarter:

- Conservative: D_tot, V_settle, T → F; compare to Core Ops budget B_core.
- Base: same.
- Expansion: same.

"Operational break-even" is when F_cash (cash-usable fee revenue) covers (Insurance top-ups + B_core + required liquidity mandates) for 3 consecutive months under conservative assumptions. If  $\chi$  is low (many fees arrive as non-convertible vouchers), break-even requires proportionally higher routed value and/or explicit conversion/subsidy policies. Therefore sCLC fee-access budgets (F_epoch) may remain zero for extended periods until safety and operating targets are sustainably met.

As pools federate:

- D(tot) tends to grow (more participants, more commitments), and
- V(settlement) tends to rise (better routing, more netting, faster fulfillment).

Both forces push fee volume F upward.

Downstream of fees: Waterfall → policy budgets → (optional) sCLC access

Higher F increases the resources available to the Waterfall (insurance targets, core ops, liquidity mandates).

--- Seite 16 ---
Downstream of fees: Waterfall → policy budgets → (optional) sCLC budget-exit

Only after safety and operations priorities are satisfied (insurance targets, core ops, liquidity mandates), the protocol may publish an epoch fee-credit budget F_epoch that bounds sCLC budget-exit windows/caps into designated fee-holding pools. This makes the post-waterfall budget contestable: stakers can directly reallocate a bounded portion of pooled fee assets by exercising sCLC (e.g., injecting liquidity into specific pools), providing a “vote with your feet” accountability mechanism. sCLC is downstream of real settlement throughput (fulfilled commitments), not speculation, and F_epoch may be set to zero.

Fee Flow (summary): Gross fees (in many assets)

→ Waterfall (1) Insurance targets → (2) Core ops → (3) Liquidity/off-ramp mandates
→ Optional: publish capped fee-credit budget F_epoch (may be zero)
→ sCLC “budget-exit” lets stakers direct a bounded portion of fee assets

# 5.4. Fee Pooling

Liquidity providers (LPs) stake assets/vouchers into pools so that swaps and settlements can clear smoothly. They take on inventory and routing risk; service fees are the natural way to pay them.

# LP risks &amp; protections (plain language)

1. Risks:

a. Inventory risk: you may hold assets/vouchers that are slower to redeem or rebalance.
b. Convertibility risk: some fees arrive as non-cash vouchers; cash-usable revenue depends on  $\chi$ .
c. Incident risk: in extreme failures, remedies follow the disclosed loss waterfall (issuer/guarantor  $\rightarrow$  reserves  $\rightarrow$  optional insurance  $\rightarrow$  capped haircuts).
d. Governance/lock risk: participation may require lockups; changes are timelocked.

2. Protections:

a. Limits + reserves cap the speed and size of drains/runs.
b. Receipts + dashboards make issuer performance and incidents visible.
c. Policy-gated fee-access is downstream of safety/ops and may be zero—preventing "promised yield" dynamics.
d. Credible exit/forkability: communities can re-point/fork if governance is captured (see §11.5).

Let:

--- Seite 17 ---
1.  $\phi =$  fraction of total fees allocated to LPs (the rest can fund software, governance, guarantees, etc.)
2.  $K =$  total value of liquidity staked by LPs into the network

LP fee-access ex-post metrics (FeeFlow)... (measured from realized settlement fees; not promised returns) per period is roughly:

$$
\mathbf {F e e F l o w} _ {L P} \approx \frac {\phi \cdot F}{K} = \frac {\phi \cdot \tau \cdot V _ {\text {s e t t l e}} \cdot D ^ {t o t}}{K}
$$

This formula makes the incentive structure explicit:

1. Higher settlement velocity  $V(\text{settle}) \rightarrow$  more routed value  $\rightarrow$  more fees  $\rightarrow$  higher fee pooling.
2. More productive debt D(tot) (claims on real output, not speculation)  $\rightarrow$  larger base on which fees are pooled.
3. Reasonable fee rate  $\tau$  and LP share  $\phi$  sustain both the infrastructure and the risk-takers.

As the network scales, LPs are effectively distributed sCLC (access to the fee pool) based on how well the system coordinates and settles real obligations, not on how much it speculates.

# 6. The Missing Piece: Network-Level Liquidity &amp; Governance

CPP on Sarafu.Network today enables interoperability but lacks:

1. a mechanism for LPs to inject liquidity across pools and access sCLC, and
2. decentralized decision-making as the network scales.

CLC DAO addresses both by introducing a network clearing house (the CLC Pool) and a governance token (CLC).

# 6.1 Participation Mechanics: Downside Protection vs. Upside Pull

Downside protection is built in at three levels: trade limits, inventory enforcement, and an explicit loss/insurance waterfall. CPP implemented via the CLC DAO makes risk explicit and bounded at the protocol level: swaps enforce per-voucher windows/caps and inventory checks (cannot swap what the vault does not hold) and emit immutable receipts for every action.

--- Seite 18 ---
Network policy adds circuit breakers, timelocks, and an insurance runbook with a transparent loss waterfall (issuer/guarantor bonds → pool reserves → network insurance → policy-capped haircuts → clawbacks for fraud).

Governance enforcement is narrow and reviewable: registry actions (list/suspend/delist) are timelocked where possible, include notice-to-cure and appeal paths, and emergency actions require incident reporting and automatic review/sunset.

Upside Pull (why participation is attractive): CPP implemented via CLC DAO increases access and optionality by allowing real production and service vouchers to function as collateral and as repayment instruments, so settlement by end-users can accelerate debt payoff ("repayment via delivery"), while keeping limits, inventories, receipts, and recourse.

Confederation and routing multiply fulfillment paths across pools (more routes, more netting surfaces), implementing a better matching mechanism - raising settlement velocity and fee volume - so liquidity providers and operators benefit from real settlement activity rather than speculative churn.

Participation remains permissioned only by published limits and health policies (not discretionary gatekeepers), with human-readable failure codes and auditable logs to reduce friction and increase user agency.

## 7. The CLC DAO and the CLC Token

### 7.1 Purpose

The CLC DAO exists to:

- Govern the CPP network,
- Allocate liquidity across pools,
- Underwrite settlement risk via an insurance fund,
- Maintain core infrastructure and registries,
- Appreciate the risk of liquidity providers,
- Preserve decentralization and auditability as the network scales.

### 7.2 CLC Token Overview

CLC is the base governance asset. Locking (staking/escrowing) CLC mints stCLC (vote-escrow governance power) and qualifies the holder for epoch-scoped sCLC under policy.

--- Seite 19 ---
1. stCLC - a non-transferable vote-escrow receipt that represents governance voting power (and can be delegated).
2. sCLC - an epoch-scoped authorization / incentives token minted each epoch under policy and allocated to (a) stCLC holders (fee-credit authorization after the Safety Waterfall) and/or (b) approved gauges (incentives to productive liquidity and routing operators). Either allocation may be set to zero in any epoch.

Neither stCLC nor sCLC is equity, a dividend instrument, or a guaranteed return. Policy may set sCLC issuance and/or fee-credit access to zero in any epoch.

CLC is not a community voucher and is not intended to be used as a general medium of exchange; it exists to coordinate governance and policy-gated access to network resources.

**Governance Lockups (Anti-Capture; vote-escrow).** Voting power is represented by stCLC, minted only when CLC is locked under a minimum lock period and exit cooldown (timelocked governance parameters). Spot-held CLC does not vote. This makes hostile takeovers slower, visible, and contestable.

sCLC Properties (Anti-Speculation). sCLC is epoch-scoped (expires or is burned at epoch end) and functions as an authorization / incentives token under caps — not a tradable claim on profits. sCLC is minted according to an epoch policy (including emissions to approved gauges and/or voter incentives), and may be set to zero in any epoch

**Total CLC Supply:** 500,000,000 - Minted to a CLC Vault (Multisig-wallet held by Grassroots Economics Foundation)

At launch, the CLC Vault is a multisig with published signers and rotation policy; over time it transitions to DAO-controlled timelocked contracts as governance hardening milestones are met (2 independent audits, monitoring, incident runbooks, and tested pause/fork procedures). Public trading venues are OPTIONAL and must be approved as a safety decision.

**CLC Allocations:**

- 15% Grassroots Economics Foundation (GEF): Permanently staked; non-transferable; soul-bound to the GEF multisig. Receives governance voting &amp; swap-window access per policy, but underlying CLC can not be unstaked.
- 15% Core Team &amp; Early Partners: Staked during vesting; soul-bound until vesting ends. Cliff/linear vesting over 24 months (policy-set). Voting via CLC during vesting; transfers disabled until vesting completes.
- 30% Endowments (Private): Recognition and governance for early LPs providing network liquidity. 24-month vesting (policy-set).
- 40% Public Liquidity (DEX venue): Unvested, used for public endowment liquidity bootstrapping.

--- Seite 20 ---
○ 40% Public Liquidity Reserve (venue-agnostic): Held in a timelocked vault and released in tranches.
Max Active Deployment: ≤ 10% of total supply at any time across all venues.
Each deployment expires (sunsets) after 90 days unless renewed by governance.
○ LP positions are DAO owned; LP tokens are timelocked; public venues are optional.
Any CLC used for liquidity does NOT vote unless staked under the same lockup rules as all other voters.

(All parameters timelocked and on-chain; edits require governance quorum.)

## 7.2.2 CLC Availability Stages

Endowment Contribution Tiers (reference valuation): Early endowments may be accepted in staged tiers using a published reference valuation for intake and budgeting purposes. This reference valuation is a governance parameter, timelocked and disclosed on-chain, and is not a promise of market price or future appreciation. Public liquidity, if provided on third-party venues, is for accessibility and discovery; the DAO does not target a price and may add/withdraw liquidity subject to inventory constraints and risk policy.

Endowment Covenant (Seeder Responsibility): Endowments are treated as a stewarded endowment to increase settlement capacity, not to extract yield. Large endowments may be capped in voting influence via conviction caps and/or delegated-community veto (policy-defined) to preserve non-dominance. All endowment deployments must publish: purpose, expected network benefit, risks, and exit conditions.

## 7.2.3 Impact Seeding Program (CLC Eligibility for Seeding Commitment Pools)

The DAO may allocate portions of the CLC Vault to recognize contributors who seed liquidity directly into designated Commitment Pools when that liquidity measurably increases network settlement (fulfilled redemptions), not speculative churn.

### Eligibility (example policy, finalized by governance):

1. Seed into an approved pool (or set of pools) for a minimum duration (rolling lockup).
2. Liquidity must be “productive” as measured by receipts: it supports routed swaps that culminate in redemption/settlement within published SLAs.

--- Seite 21 ---
3. Rewards are based on marginal settlement contribution, not TVL alone (e.g., net increase in successful settlement volume attributable to the added inventory and routing capacity).

Approved pools for seeding may be expressed as gauges, so stCLC voters can transparently direct incentives toward productive settlement capacity rather than TVL.

**Anti-gaming rules:**

- Exclude self-wash loops (same beneficial owner cycling value) and routes flagged by the router deny-list.
- Apply per-entity caps and diminishing returns to reduce whale capture.
- Use an observation window and delayed finalization (timelocked) to allow dispute/appeal of manipulated metrics.

## 7.3 Vote-Escrow (stCLC) + Epoch Incentives (sCLC) + Pooled Fees

Locking CLC mints stCLC (voting power) and enables participation in epoch incentive decisions. Each epoch, stCLC holders vote on “gauges” (approved pools / mandates) that direct how any sCLC incentives are distributed to productive liquidity and routing operators.

Separately, after the Safety Waterfall funds Insurance, Core Ops, and Liquidity Mandates, the DAO may publish a fee-credit budget (F_epoch). When enabled, sCLC can be used to exercise capped swap access from designated fee-holding pools, under published windows and inventory constraints.

Design rationale ("vote with your feet"): sCLC makes post-waterfall fee budgets contestable. If stakers disagree with routing policy, treasury allocations, or perceive governance capture, they can directly reallocate a bounded portion of pooled fee assets by exercising their fee-credit (e.g., injecting liquidity into specific pools, supporting local voucher inventories, purchasing coverage collateral, or other self-directed deployments). This is an accountability and anti-capture mechanism, not a promise of yield.

## stCLC Gauge Voting (Directing sCLC Incentives)

To avoid discretionary allocation and to keep incentives tied to real settlement, the DAO uses a gauge system (a curated list of eligible pools/mandates).

Each epoch:

1. stCLC holders vote on gauges (eligible pools / portfolios / routing mandates).
2. The protocol computes vote weights per gauge (with caps / anti-whale rules).

--- Seite 22 ---
If enabled, the protocol mints a bounded amount of sCLC incentives and distributes them to productive liquidity providers and routing operators in proportion to the votes their gauge received — only when their activity leads to measurable settlement (redemptions) within SLA windows.

Key difference from speculation-driven AMMs: votes do not target token price or "APY." They target settlement capacity (inventory availability, routing reliability, off-ramps), measured by receipts and fulfillment outcomes.

## Waterfall Usage of Fees (policy-bound).

Fees first fund Insurance Reserve Targets and Core Ops, then Liquidity Mandates. Only thereafter (and only if enabled for that epoch) the protocol publishes a fee-credit budget F_epoch that bounds sCLC budget-exit swap access. Values, caps, and windows are published in advance and may be tightened or set to zero during incidents. This ordering ensures essential safety and operations are funded before any optional budget-exit is enabled. (See Section 7.4 Waterfall.)

## Why stake CLC?

Staking/escrowing CLC is how participants direct network policy and enforce accountability. In addition to voting rights, staking/escrowing makes participants eligible to receive epoch-scoped sCLC, which can be used to exercise a capped, epoch-bound budget-exit from the post-waterfall fee budget. This lets stakers "vote with their feet" by directly reallocating a bounded portion of fee assets (e.g., injecting liquidity into specific pools or supporting inventories they believe improve settlement) rather than relying solely on proposals and committees. This is access to a governed resource under caps, not a claim on profits or dividends.

## Mandatory Fee Enforcement

(a) Factory Gating. Official CPP pools are deployed via a PoolFactory that wires a FeeHook into the Vault/Fee Registry; fees auto-route to the CLC Pool via the Waterfall per policy. Pools missing the FeeHook cannot register.
(b) Registry Gating. Only pools in the canonical Pool Registry (timelocked governance edits) are discoverable by official routers and SDKs. Non-compliant forks fail discovery.
(c) Router Policy. Official routers refuse routes that touch unregistered pools or pools with invalid FeeHook. (SDK invariant checks enforce this.)
(d) Programmatic Attestations. Liquidity mandates and LP programs require FeeHook compliance; non-compliant forks lose routing and liquidity support.

Result: "Mandatory" equals unroutable (on the CLC DAO network) if non-paying - not a social norm.

Fork/Exit Note. This "mandatory" enforcement applies only to official discovery (canonical registries, SDK invariants, and official routers). Pools remain free to operate outside these registries, and independent routers/registries may exist. This preserves credible exit if governance

--- Seite 23 ---
is captured: a fork can deploy alternative registries/routers and pools can re-register there without changing the underlying CPP primitives.

Users/pools can always select alternative profiles/registries in compatible clients. Canonical enforcement must not "brick" local economies. Fee policies must be surfaced in UI before swap/seed

## sCLC Emission &amp; Budget-Exit Windows

Each epoch, after the Waterfall funds Insurance, Core Ops, and Liquidity Mandates, the protocol may publish a fee-credit budget F_epoch (USD value; may be zero). sCLC confers a pro-rata user limit based on stCLC voting power:

$$
\text{limit\_user\_epoch} = F_{\text{epoch}} \times (\text{stCLC\_user} / \text{stCLC\_total})
$$

Within published windows/caps (and subject to inventory), sCLC can be exercised to swap fee assets out of designated fee-holding pools and into listed assets/vouchers. This is a bounded budget-exit mechanism (accountability / anti-capture), not passive income; governance may set F_epoch = 0 and may tighten, pause, or geofence access per compliance and incident policy.

DEX Float Reduction (optional, non-speculative): If measured CLC DEX float exceeds a policy cap, the DAO MAY execute a capped, TWAP-limited repurchase solely to reduce external float and governance-attack surface. Acquired CLC is retired to avoid custody risk. This program has no price target, may be set to zero, and must halt automatically during incidents or when insurance buffers are below target.

## Guardrails (policy parameters; on-chain):

- Trigger-based: only if DEX float &gt; X% for Y days
- Cap: max Z% of monthly fees and/or max W% of DEX daily volume
- Execution: TWAP + random time delays + no announcement of exact timing
- Emergency stop: automatic stop if insurance ratio &lt; threshold
- Disclosure: "Not intended to support price; settlement does not depend on DEX price"

Treasury Liquidity Cache (non-distributive): A portion of fees MAY be used to maintain protocol-owned liquidity positions needed for network functioning (e.g., off-ramp buffers, rebalancing inventories), under policy caps and timelocks.

7.3.1 Portfolio Pools: Direct Seeding, Voted Allocations, and sCLC-Directed Liquidity (Examples)

--- Seite 24 ---
Commitment Pools can be curated as "portfolio pools": pools that list redeemable commitments aligned to a mission domain (e.g., ecosystem support services, humanitarian support, health &amp; wellness). Portfolio pools make it easy for liquidity providers to target real-world outcomes without requiring a single central issuer.

# There are three complementary ways to support a specific portfolio pool:

A) Seed directly into the pool: deposit accepted assets/vouchers into the pool's Vault, increasing inventory and routing capacity (subject to listings, limits, and reserve policy).
B) Vote allocations into the pool: propose and approve Liquidity Mandates (Waterfall allocations) that seed or backstop designated portfolio pools with time-bounded mandates and sunset/review.
C) Stake CLC and direct sCLC swaps: when enabled for an epoch, stakers can exercise sCLC budget-exit swaps to reallocate a bounded portion of post-waterfall fee assets into specific portfolio pools (e.g., by swapping fee assets into the pool's inventories or accepted liquidity assets), strengthening the pools they believe most improve settlement and mission outcomes. This is an accountability mechanism under caps/windows—not a claim on profits.

Note: Portfolio pools remain sovereign. They can be canonical (discoverable via official registries/routers) or independent (discoverable via independent registries/routers), without changing the underlying CPP primitives.

# 7.3.2 Curating Portfolio Pools (Including Certifications)

Any steward (individual, cooperative, multisig, or DAO) can curate a portfolio pool: define a listing policy, publish a Value Index method, configure limiters, and require clear redemption proofs and fallback remedies. Portfolio pools can be specialized (ecosystem, humanitarian, health) or mixed.

Certifications can be used to improve trust and reduce risk, but should be modeled as attestations that affect eligibility and risk treatment—not as profit tokens. Two safe patterns:

A) Attestation Certificates (non-transferable or registry-bound): a verifier issues an attestation that a voucher issuer/project meets stated criteria (methodology, safeguards, monitoring). The pool uses attestations to whitelist listings, adjust haircuts, widen/narrow limits, or qualify for insurance participation.
B) Audit/Verification Service Vouchers (redeemable commitments): a token represents a redeemable verification service (who will verify what, by when, under what standard). Pools/projects can purchase these vouchers to fund monitoring and strengthen integrity.

In both cases, the economic claim remains the underlying redeemable commitment; certifications modify risk and eligibility rather than creating entitlement to fees, profits, or residual assets.

# 7.4 Waterfall Policy &amp; Budgets

--- Seite 25 ---
Fee inflows (pool usage fees, routing fees, network rake) are allocated by a deterministic waterfall and adjustable by DAO vote.

Fee Asset Eligibility &amp; Conversion (cash vs. in-kind). Fee inflows arrive in mixed assets because fees are collected in the same asset that moves through pools. The Waterfall distinguishes:

(i) Cash-eligible fee assets (E_cash): allowlisted stablecoins/cash-equivalents and (optionally) major liquid tokens that may be converted to fund fiat-denominated insurance payouts and core operating costs; and
(ii) In-kind fee assets (E_kind): non-fiat-redeemable vouchers and other non-convertible assets that may be redeployed for in-network settlement support, local mandates, or in-kind operating needs, but do not count toward fiat-denominated insurance/ops obligations.

The DAO maintains a Conversion Policy (allowlists, caps, slippage limits, TWAP windows, and reporting) for fungible assets only. Voucher pricing remains governed by pool Value Indices and Swap Limiters; conversion is for treasury/operations reliability, not voucher valuation.

## Waterfall Priorities:

1. Insurance Reserve Target – Fund to a policy target (risk-weighted by pool class, fulfillment rate, issuer concentration, and limit utilization).
2. Core Operations – Legal, advocacy, IEC, infra, audits, observability.
3. Liquidity Mandates – Endowments into target pools/routers to improve settlement velocity, including (optionally) interoperability mandates: bridge/adaptor maintenance, confederation routing pilots, and cross-network liquidity backstops under published caps and sunset reviews.
4. DEX Float Reduction (optional, non-speculative): If measured CLC DEX float exceeds a policy cap, the DAO MAY execute a capped, TWAP-limited repurchase solely to reduce external float and governance-attack surface. Acquired CLC is retired (or placed in a non-voting sink) to avoid custody risk. This program has no price target, may be set to zero, and must halt automatically during incidents or when insurance buffers are below target.
5. CLC Pool Fee-Access Budget: Allocate remaining eligible fee assets to the CLC Pool (cash-eligible E_cash by default; E_kind only if explicitly allowlisted per program) and publish the epoch fee-access budget F_epoch (may be zero), which bounds sCLC swap-access windows/caps as defined in §7.4.

KPI-Linked Budgets. Advisory data to adjust the waterfall parameters via on-chain policy keyed to pool-health KPIs: fulfillment rate, reserve adequacy, limit utilization, routing pass/fail, guarantor performance, and redemption latency. All edits are timelocked and logged on-chain.

--- Seite 26 ---
![img-0.jpeg](https://ragtempproject.blob.core.windows.net/knowledgescout/7911fdb9-8608-4b24-908b-022a4015cbca/books/s25vd0hvdyatierva3vtzw50zs9hcmfzc3jvb3rzievjb25vbwljcyatifdpbgw/eee0b1212820f9c7.jpeg)

The Contributor Flow diagram above shows:

1. Liquidity Providers supporting endowments - stable coins going to CLC Vault and receiving CLC tokens (as DAO Members).
2. CLC holders can stake them to receive stCLC DAO voting rights (and sCLC ... step 4)
3. Pools in the CLC Registry send (automatically) a % of their fees to the Waterfall Contract. The waterfall contract pushes these fees into:

a. Insurance &amp; Ops Vault: funded primarily by cash-eligible fee assets (E_cash) and/or conversions under policy; in-kind fees (E_kind) do not count toward fiat-denominated obligations.
b. Back into the CPs based on voting
c. Used for DEX Float Reduction (capped repurchase + retirement / non-voting sink) only when trigger conditions are met; otherwise set to zero.
d. Into the CLC Pool (Fee Budget Vault): holds post-waterfall eligible fee assets; sCLC provides capped, epoch-bound swap access only to allowlisted assets/programs and may be zero.

4. After the Safety Waterfall, the protocol may mint sCLC under epoch policy and allocate it to: (a) stCLC holders as fee-credit authorization (pro-rata; may be zero) and/or (b) approved gauges as incentives to productive liquidity providers and routing operators (may be zero).
5. CLC Fee Budget Vault (CLC Pool) - Holds post-waterfall pooled fee assets. When enabled, sCLC provides capped, epoch-bound fee-credit spend authority (pro-rata to staked/escrowed CLC) to execute allowlisted deployments (e.g., seed specified CP inventories, purchase coverage

--- Seite 27 ---
collateral) by swapping from designated fee-holding vaults within published windows/caps. This is not a claim on vault ownership.

# 8. Technical Scope &amp; Growth

Priorities:

- Routing protocols across Sarafu.Network pools; SDKs and index/limit discovery APIs.
- Bridges to external DEX registries; Time-locked contract/escrow for cross-domain settlement.
- Support for the long tail of micro-pools (including personal pools UX).
- Auditable registries for vouchers, pools, limits, values, and fee policies.
- Fiat/stable on/off-ramp connectors: a partner/rail registry (by jurisdiction), checkout/invoice flows, and UI “network profiles” that can geofence features and require attestations for cash-equivalent redemptions.
- Bridges to external liquidity venues (DEXs and other registries) for fungible assets (e.g., stable cash-equivalents and major liquid tokens), using time-locked escrow/HTLC where cross-domain atomicity is unavailable. Purpose: rebalancing, on/off-ramp liquidity, and risk-managed settlement support - not pricing of redeemable vouchers by speculative curves.
- Treasury conversion &amp; settlement acceleration: policy-capped conversion of cash-eligible fee assets (E_cash) held in the CLC Pool into stables/fiat when needed for insurance/ops and to maintain off-ramp liquidity—while prioritizing in-network settlement and using liquidity mandates/rebalancing to reduce settlement latency.

DEX Interop Boundary: DEX adapters are for fungible liquidity management (stables, rebalancing, exit ramps), not for defining the value index of redeemable commitments. Voucher pricing remains governed by each pool's Value Index + limits + inventories; DEX prices may be used only as an auxiliary reference for fungible assets and must be guarded against manipulation (caps, TWAP/medianization, deny-lists, and incident pauses).

# 8.1 Router &amp; SDK Norms

Public Discovery. Routers must query public registries of voucher listings, value indices, limits, fees, and inventories; cache with freshness bounds.

Multi-Profile Discovery (Confederation). Routers/SDKs MAY support multiple registry roots ("network profiles") and must surface to users/pools which profile a route uses (registry root, policy constraints, bridge adapters). Cross-profile routes must satisfy the strictest applicable caps/escrow requirements and must be auditable hop-by-hop (quote  $\rightarrow$  receipt mapping).

--- Seite 28 ---
Path Policies. Deny-list toxic routes (known bad bridges/pools) and enforce per-route caps and minimum health scores (reserve adequacy, SLA adherence).

Fees &amp; Caps. Routing fees expressed per-hop; routers may add a small discoverability fee within policy bounds; hard caps apply under stress (utilization spikes).

Atomicity &amp; Escrow. Prefer atomic multi-hop where possible; otherwise use HTLC/escrow with conservative timeouts and explicit abort paths.

Batch Netting &amp; Rebalancing. Routers may also perform batch netting runs across opted-in pools by collecting rebalance intents and searching for multilateral cycles/chains that satisfy each pool's constraints. Norms:

(i) publish a machine-readable "rebalance receipt" summary (cycles executed, total off-set value, fees charged),
(ii) enforce conservative per-epoch caps and health-score gating,
(iii) reject any route that violates a pool's allow/deny policies or exceeds limiter windows/caps,
(iv) keep batch execution auditable (deterministic inputs  $\rightarrow$  receipts) to support dispute resolution.

SDK Guarantees. Provide (i) deterministic quote  $\rightarrow$  receipt mapping, (ii) invariant checks per hop, (iii) human-readable failure codes, (iv) audit-friendly logs.

# 8.1.1 Minimum Confederation Compatibility Contract (MCC)

To be routable across profiles (and thus across confederated networks), a pool ecosystem MUST publish the following in a machine-readable way:

1) Registry roots: canonical addresses for voucher registry, pool registry, value index registry, limiter registry, and fee policy registry (or a single root that deterministically resolves these).
2) Receipt standard: every hop MUST emit/return a receipt that references (a) registry root/profile used, (b) voucher/token in/out, (c) value index version or timestamp, (d) limiter window/cap snapshot, (e) fees charged, and (f) inventory check result.
3) Health endpoints: per-pool signals required for routing policies—reserve adequacy, SLA adherence, limiter utilization, and incident state—plus freshness bounds.
4) Policy constraints: explicit allow/deny policies (bridges, counterparties, voucher classes) and required escrow/HTLC requirements for non-atomic hops.

--- Seite 29 ---
5) Failure codes: human-readable, deterministic failure codes so clients can explain why a route was refused (limits, inventory, policy, escrow, incident pause).

Networks MAY implement additional features (insurance overlays, compliance hooks, arbitration modules), but these MUST remain profile-scoped and MUST NOT be required for basic CPP compatibility.

## 8.2 Licensing &amp; Transparency

All contracts are EVM-compatible, open-source under AGPL-3.0, with reproducible builds, published ABIs, and audit reports. Canonical addresses and registries are timelocked and mirrored for independent verification. Community contributions are welcomed under the same license.

**Fork Kit (Required Deliverable).** The project will maintain a “fork kit” that includes:

(i) deterministic deployment scripts; (ii) registry snapshot/export tooling; (iii) a documented procedure to re-point routers/SDKs to a new registry root; and (iv) a pool steward checklist for exiting canonical registries safely (including fee-hook redirection options where supported).

**Example: Minimum Exit Checklist (publish + test annually):**

1. How to export registry snapshots + receipts.
2. How to repoint routers/SDKs to a new root.
3. How to migrate insurance scope (or explicitly terminate it).
4. How to honor outstanding vouchers during migration (notice-to-redeem + remedy options).

**Why AGPL + Fork Kit:** Confederation rewards compatibility. Networks that fork and improve routers, registry tooling, bridge adapters, or observability can still route with CLC if they remain CPP-compatible - expanding settlement paths and strengthening the whole mesh. AGPL ensures improvements to the shared plumbing remain shareable across the confederation, reducing systemic risk and duplication.

## 9. Economics for LPs

### 9.1 Revenue Streams

1. Network Fee Rake → Policy Pools. A portion of per-pool fees is routed to the CLC Pool via the Waterfall contract which starts with Insurance, Core Ops, Liquidity Mandates, and (if, when, and to the extent enabled) sCLC swap windows.
2. Policy-gated fee-credit (ex-post)
3. Routing Fees: Fees from multi-hop routes discovered by routers.

--- Seite 30 ---
a. Rebalancing / Netting Fees (optional): Fees earned for executing batch netting cycles and inventory rebalancing routes that reduce imbalance and increase successful settlement throughput (ex-post, policy-bound).

4. Curation &amp; Validation Fees: pools may allocate a disclosed portion of fees to listing/verification/monitoring roles (curators, auditors, claims modules) under published mandates.

## 9.2 Illustrative Fee Math (Example Only)

- Per-pool usage fee: 30–500 bps depending on voucher class and risk tier.
- Network rake: 10–30% of per-pool fees -&gt; Waterfall -&gt; CLC Pool.
- Worked example (“2% fee” case). If a pool charges f_p = 2.00% and the DAO rake share is r_p = 20% of that pool’s fees, then the effective network fee rate on routed value is:
- r_p = f_p · r_p = 2.00% · 20% = 0.40% = 40 bps.
- Convertibility matters. If only χ = 25% of fee inflows are cash-eligible/convertible (E_cash), then cash-usable effective revenue is ~10 bps (40 bps × 0.25). Therefore, meaningful sCLC fee-access budgets (F_epoch) require both high settlement throughput and sufficient χ; otherwise F_epoch may remain zero for long periods.
- Routing fee: 5–20 bps across hops.
- Distribution to Waterfall (policy-bound)
- Net LP Credit Access drivers: local swap usage, routing volume, DAO-deployed liquidity credit access, less losses/insurance haircuts.

**Accounting only:** Any annualized figures are ex-post metrics of policy-gated swap access to pooled fees (not promised returns) and may be zero or negative after losses/haircuts.

## Downside Examples (ex-post):

- Inventory Loss Case: losses from defaults/redemption delays reduce fee-credit access by X (haircut).
- Run-Protection Case: limiter-triggered throttling reduces settlement flow, lowering F temporarily.
- Policy Case: governance sets fee-credit budget F_epoch = 0 (no sCLC exit) during incidents or rebuild phases.

Numerical schedules are governance parameters and will be finalized via on-chain proposals and timelocks.

--- Seite 31 ---
# 10. Comprehensive Risk Framework

We classify risk into ten categories. For each we list Threats, Indicators, and Controls (Preventive/Detective/Corrective), plus Stress Tests and a Risk Appetite statement.

# 10.1 Protocol &amp; Smart Contract Risk

- Threats: Contract bugs, upgrade errors, misconfigured limits/fees.
- Indicators: Audit findings, unexplained vault movements, reverts/spikes.
- Controls:

- Preventive: Independent audits, formal verification where critical, minimal privileged roles, least-privilege vaults.
- Detective: On-chain monitors, invariant checks, receipt reconciliation.
- Corrective: Timelocked upgrades, emergency pause with public criteria, fork/migration path.

- Stress Tests: Simulate paused oracles, inventory shortfalls, routed burst traffic.
- Risk Appetite: Low; require audits before scaling network exposure (outstanding obligations and routed volume).

# 10.2 Economic/Market Risk (Liquidity, Runs, Oracle)

- Threats: Thin inventory, bank-run dynamics, oracle manipulation/latency.
- Indicators: Limit utilization &gt;80%, widening spreads, frequent limit rejections.
- Controls:

- Preventive: Swap Limiter windows/caps; tiered limits; minimum reserve ratios; medianized oracles with failover constants.
- Detective: Utilization &amp; spread dashboards; variance alarms on value index updates.
- Corrective: Widen margins; tighten caps; route-around policies; temporary fee surcharges to dampen flow.

- Stress Tests: Price shocks (±50%), redemption surges (5–10× baseline), oracle outages.
- Risk Appetite: Moderate, bounded by policy thresholds.

# 10.3 Credit/Voucher Issuance Risk

- Threats: Over-issuance vs. capacity; issuer default; mis-specified redemption windows.
- Indicators: Fulfillment rate ↓, aging vouchers ↑, guarantor exposures ↑.
- Controls:

- Preventive: Issuer due diligence; pool operator guarantor/bond requirements; issuance quotas; clarity-first voucher terms.
- Detective: Cohort aging reports; fulfillment SLA tracking; guarantor performance logs.
- Corrective: Tighten issuance, require top-ups, delist/route-around, trigger insurance.

- Stress Tests: Issuer insolvency; regional shock to production.

--- Seite 32 ---
- Risk Appetite: Moderate for diversified issuers; low for concentrated exposure.

## 10.4 Redemption/Operations Risk

- Threats: Inability to honor redemptions due to logistics, supply chain, or custody failures.
- Indicators: Redemption latency &gt; SLA; stockouts; ticket backlogs.
- Controls: Redemption buffers; emergency backstops; off-chain attestation flows; multi-venue redemption options.
- Stress Tests: 2–4× redemption spikes; facility outages.
- Risk Appetite: Low; protect end-users.

## 10.5 Governance Risk

- Threats: Steward capture; rushed parameter edits; conflicts of interest.
- Indicators: Concentrated voting power; frequent emergency actions; policy churn.
- Controls: Quorums; timelocks; delegated voting with transparency; conflict disclosures; veto/appeal mechanisms; forkability.
- Risk Appetite: Low; emphasize transparency and recourse.
- Stress Tests: Adversarial proposals; bribery attempts.

- Additional Stress Test: Hostile Voting Capture (Public Market Accumulation).
Scenario: An external actor accumulates a large fraction of CLC, delegates votes to a small set of accounts, and proposes to (i) redirect Waterfall allocations, (ii) weaken listing/delisting standards, (iii) drain insurance via permissive claims, or (iv) force liquidity mandates into self-serving pools.

- Controls (must all be true):
- Governance requires lockups (no instant voting power from spot purchases).
- Timelocks on all critical actions, with public alerts and a defined response window.
- Supermajority + higher quorum tiers for Waterfall, registry root, insurance policy, and emergency powers.
- Transparent delegation + concentration monitoring triggers (automatic escalation to higher thresholds).
- Appeal + incident process and an explicit fork-and-migrate procedure if values drift or capture occurs.

## 10.6 Legal &amp; Compliance Risk

- Threats: Vouchers deemed regulated instruments; KYC/AML obligations; cross-border restrictions.
- Indicators: Jurisdictional flags; regulator inquiries.

--- Seite 33 ---
- Controls: Modular compliance hooks (allow/deny lists, attestations); geofenced UIs; legal reviews per class; disclosures.
- Stress Tests: Jurisdictional bans; counterparty de-listings.
- Risk Appetite: Low; comply or geofence.

## 10.6.1 Legal Positioning &amp; Token Treatment (Summary)

1. Open-source infra. All smart contracts are EVM, open-source AGPL-3.0, and auditable.
2. Token posture. CLC is a governance and access token. Staking may mint sCLC tokens that confers policy-gated swap rights into fee-holding pools under published caps/windows. No dividends. No profit-share. No residual rights.
3. Representations. The DAO and contributors do not market CLC/sCLC with profit expectations; materials avoid financial return language.
4. Jurisdiction strategy. (i) Geofenced UIs and RPCs; (ii) attestation gates for restricted classes; (iii) no promotions in restricted jurisdictions; (iv) per-voucher class legal reviews; (v) programmatic kill-switches to disable sCLC swap windows under policy.
5. Endowment notice. Based on DAO vote - access based on staked CLC may be disabled or reduced for compliance, operational, or risk reasons with no compensation. See §17.3 for plain-language instrument definitions.

## 10.7 Routing &amp; Cross-Domain Risk

- Threats: Partial fills, stuck hops, bridge exploits, MEV (router perspective): artificially inflate route hops, front-running value index (if timelocked).
- Indicators: HTLC expiries; escrow backlogs.
- Controls: Atomicity where possible; escrow/HTLC with conservative timeouts; deny risky bridges; per-route fees and caps slash router stake; implement path efficiency score (including retroactively, see OP style challenge games), capping fees.
- Stress Tests: Bridge halt; chain reorgs.
- Risk Appetite: Low to moderate; whitelist bridges.

## 10.8 Custody &amp; Key Management Risk

- Threats: Key loss/compromise; signer collusion.
- Indicators: Anomalous signer behavior; threshold changes.
- Controls: Multisig/threshold schemes; hardware security; signer rotation; monitoring; withdrawal rate limits.
- Risk Appetite: Low.

## 10.9 Reputation &amp; Social Risk

--- Seite 34 ---
- Threats: Misaligned incentives harming communities; poor redemption experiences, insurance gamification.
- Indicators: Community feedback; complaint ratios; social sentiment.
- Controls: NVC-aligned evaluation; grievance redressal; transparent reporting.
- Risk Appetite: Low; prioritize care and fairness.
- Mis-selling controls: standardized consumer disclosures in-UI; mis-selling incident log; sanctions ladder for violators (warnings → suspensions → delistings).

## 10.10 Concentration &amp; Fragmentation Risk

- Threats: Dependence on a few issuers/pools; incompatible forks.
- Indicators: HHI by issuer/pool; routing failures across clusters.
- Controls: Diversification targets; publish registries/indices/limits; maintain routing bridges; encourage standard adherence.

## 11. Governance Mechanics

- Constitutional Values: Care for People, Care for the Environment, Fairness, Reciprocity, Non-Dominance, Resilience.
- Proposal Types: Fee/limit/index edits; liquidity mandates; pool listings/delistings; insurance payouts; parameter guardrails.
- Process: Intake → Evaluation (template) → Risk review → On-chain vote (staked CLC) → Timelock → Execution.
- Quorum &amp; Thresholds: Parameterized per class (e.g., higher for value-index edits and emergency pauses).
- Delegation: Optional delegate system with public mandates and recall.
- Circuit Breakers: Emergency pause with criteria; automatic resume conditions; post-mortems required.
- Transparency: All edits/flows logged; dashboards for fulfillment, reserves, utilization, routing, guarantors.

Registry Governance (Listing / Suspension / Delisting). The CLC DAO maintains the canonical discovery registries for vouchers, tokens, and pools. By on-chain vote (staked CLC) and timelocked execution (except for narrowly-scoped emergency actions) the DAO may add, update, suspend, or remove ("delist") registry entries. Voucher, token, and pool issuers acknowledge that registry status is conditional: repeated non-fulfillment of published Redemption SLAs, fraud/misrepresentation, unsafe contract behavior, or persistent violation of CLC constitutional values/principles may result in suspension or delisting (and official routers may route-around delisted entries by default). Where feasible, delisting follows notice to cure (remedy) period to decision, with an appeal path; emergency delisting requires a public incident report and automatic review/sunset.

--- Seite 35 ---
Prohibited Listings (non-negotiable):

1. Instruments that directly fund or incentivize ecological destruction beyond agreed boundaries, violence/weaponization, coercive extraction, or systemic abuse.
2. Any voucher class lacking clear redemption terms, accountability, and remedy pathways.

The prohibited list is versioned, publicly auditable, and requires Q3 + T3 to change.

11.1 Index &amp; Limit Governance

Timelocked Edits. All Value Index and Swap Limiter parameter edits execute after a public timelock. Emergency changes must meet stricter quorum and include automatic sunset or review.

Quorum &amp; Thresholds. Higher quorum/threshold for (a) Value Index base changes and (b) global Limit Tier changes; medium for per-pool third party; standard for fee tweaks.

Publish Feeds. For each pool: publish on-chain index variables, oracle sources/medians, update cadence, limit windows/caps, and failure modes (safe constants).

Emergency Pause Criteria. Pre-declare conditions (eg, oracle outage, ≥80% limit utilization with redemption SLA breaches, invariant failure) and automated resume checks, with mandatory post-mortems.

Ex. Public Index Feed (per pool, per voucher)

- Symbol: e.g., Maize_50kg@IssuerY
- Reference Unit: "Index Unit" (IUX)
- Valuation: 30.000 IUX
- Source: Median(Oracles: local market survey, ministry bulletin, CLC baseline)
- Update Cadence: daily at 18:00 EAT; Timelock: 24h
- Failure Mode: freeze at last-good, widen limiter bands by +20%, pause at 72h outage
- Rationale: published notes + diff from prior update

--- Seite 36 ---
- Signers: multisig addresses; quorum threshold

## 11.2 Insurance Fund Runbook

Triggers. (i) Issuer default/non-fulfillment; (ii) Pool insolvency (reserve shortfall vs. bonds); (iii) Bridge/escrow loss impacting redeemability.

Assessment. Convene risk committee; reconcile receipts, vault balances, guarantor bonds, and redemption tickets; publish incident ledger.

Loss Waterfall. (1) Offending issuer bonds/guarantor stakes → (2) Pool-level reserves → (3) Network Insurance Fund → (4) Temporary haircuts on affected vouchers (policy-capped) → (5) Clawbacks in case of fraud/abuse.

Haircuts &amp; Make-Whole. Define per-class haircut caps and time-boxed make-whole plans (from future fees/rakes) with transparent accounting.

Clawbacks. Mandatory for proven fraud/abuse; governance-ratified claims; legal follow-up as required.

Reporting. Publish public post-mortem, remediation timeline, and parameter changes (limits, fees, routes).

Important: Insurance coverage is limited. Some incidents receive no payout after caps are reached; see the Loss Waterfall and exclusions below.

## When the DAO Will Not Make You Whole.

The Insurance Fund does not cover: (a) redemptions outside the published SLA/venues; (b) haircuts beyond policy caps; (c) losses from using delisted/denied routes; (d) fraudulent claims or missing evidence; (e) jurisdictions where payout is restricted. Payouts, if any, follow the waterfall and may be zero after caps are reached.

## Make-Whole Schedule (policy-bound, published on-chain):

1) Claims are paid in this order: (a) issuer/guarantor bonds → (b) pool reserves → (c) network insurance.

2) If residual shortfall remains: apply haircut ≤ H_cap per incident (see Appendix D).

3) Haircut recovery plan:

- 25% of recovered value applied monthly until made whole OR
- 12-month maximum make-whole horizon; remainder becomes a recorded loss with public postmortem.

--- Seite 37 ---
4) Every claim produces a receipt: incident_id, affected vouchers, haircut %, recovery plan, and appeal window.

## 11.3 Guarantor Framework

This section clarifies who guarantees what (issuer vs. pool vs. third-party guarantors), define the collateral/bonding instruments behind those guarantees, and standardize triggers + payout paths. This is the backbone of the curation market: pools compete on trust, terms, and guarantees - without implying that the network automatically guarantees every voucher.

### Baseline Guarantee: Issuer Responsibility (Gift-Card Analogy)

- Each voucher is first and foremost guaranteed by its issuer: the issuer commits to deliver the specified good/service (or declared cash-equivalent) within the voucher’s Redemption SLA.
- Issuers must publish clear terms (who/what/where/when/proof) and disclose limits, venues, and dispute hooks in voucher metadata.
- If an issuer fails to fulfill, they are the primary party in default; pool or network protections (if any) are secondary layers.

### Pool-Level Guarantees (Optional, Competitive, Disclosed)

A pool may choose to add extra guarantees to vouchers it lists. These are not automatic; they must be explicitly declared in pool metadata and surfaced in receipts.

### Common guarantee types:

1) Cash-Back Guarantee (Make-Whole in Stable/Reserve Asset)

- If the issuer defaults or breaches SLA, the pool pays out a defined amount in a designated reserve asset (e.g., stablecoin) up to a policy-capped limit.
- Funding source: pool-level reserve buffers and/or posted guarantor bonds.

2) Swap-Back Guarantee (Reversal / Exit Window)

- If a voucher cannot be redeemed under declared terms, the pool offers a time-boxed swap-back path (e.g., swap back into the prior asset, or into an approved reserve asset), subject to caps and inventory.
- This is a liquidity protection, not a promise that every swap is always reversible: it is limited by published caps, windows, and reserve ratios.

3) Alternative-Fulfillment Guarantee (Multi-Venue / Substitute Delivery)

--- Seite 38 ---
- The pool guarantees fulfillment by routing redemption to an alternative approved provider (e.g., another vetted taxi operator) when the original issuer fails, within a capped quantity/value.
- This is especially useful for essential services (food/transport) where continuity matters.

4) Price/Index Band Guarantee (Optional)

- For selected voucher classes, the pool may commit to keep swap-out value within a published band vs. its Value Index. If the band is broken, predefined haircuts or swap-back rules apply.

Guarantors &amp; Bonds (Who can guarantee).

- Issuer Bond: collateral posted by the issuer (or locked reserve) that can be drawn down upon verified default.
- Pool Reserve: pool-owned buffers funded by a portion of pool fees, used for payouts under the pool's advertised guarantees.
- Third-Party Guarantor Bond: collateral posted by external guarantors (individuals, institutions, insurers, community orgs) that back specific issuers, voucher classes, or the pool as a whole.
- Note: Guarantor participation is governed by published eligibility criteria, bond sizing, concentration limits, and slashing rules.

Triggers (When a guarantee can be claimed).

Claims must be based on explicit, auditable triggers, such as:

- Redemption SLA breach (target/max exceeded) with proof of attempted redemption;
- Verified issuer non-fulfillment or insolvency (as defined by pool policy);
- Bridge/escrow failure impacting redeemability (when applicable);
- Governance-declared incident state (emergency pause / run conditions).

Claim Process (Human-readable and auditable).

- Ticket: user opens a redemption/claim ticket referencing the voucher + proof (QR receipt, ticket #, required ID type).
- Verification: pool (or delegated claims module) checks voucher terms, redemption attempt evidence, and issuer response window.
- Decision: approve/deny within a published dispute window; all outcomes logged.
- Payout: execute per the published payout path (below), with receipts referencing guarantee type and cap.

Payout Path &amp; Recovery (Aligned to the loss (insurance) waterfall).

Guarantee payouts follow a transparent waterfall:

(1) Offending issuer bond / guarantor stakes → (2) Pool-level reserves → (3) Network Insurance Fund (if covered by DAO policy) → (4) Policy-capped temporary haircuts → (5) Clawbacks for proven fraud/abuse.

Recovery proceeds (from issuer settlement, arbitration awards, or legal enforcement) refill bonds/reserves per policy before CLC Pool swap access.

--- Seite 39 ---
# Parameterization (What must be declared).

For every pool and voucher class, publish:

- Guarantor Requirement: None / Recommended / Required.
- Bond sizing: minimum bond, scaling rule (e.g., % of issuance or exposure), concentration caps.
- Guarantee catalog: which guarantee types apply, caps, windows, eligible assets (cash-back asset; swap-back asset).
- SLA: target/max and claim windows.
- Disclosures: plain-language “who is guaranteeing what”, and what is explicitly not guaranteed.

# Curation Market Principle.

Pools are responsible for the guarantees they advertise. The CLC DAO provides standards, registries, and optional shared insurance policies—but does not automatically guarantee vouchers or pools unless explicitly stated in DAO policy and the pool's published terms.

# 11.4 Anti-Capture Guardrails

The following actions are classified as Critical and require the highest quorum/threshold tiers plus a long timelock:

1. Waterfall structure changes (adding/removing destinations; changing insurance/core ops priority),
2. Registry root changes (canonical voucher/pool registries),
3. Insurance policy scope, haircut caps, and claims authority changes,
4. Emergency pause scope expansions,
5. Any change that weakens forkability, transparency, or pool sovereignty guarantees stated in this paper.

# 11.5 Fork &amp; Exit Procedure (Credible Exit for Communities and Operators)

If governance is captured or values drift materially, communities, pool stewards, and operators can exit by forking the network governance layer while preserving underlying Commitment Pools and vouchers.

# Procedure:

1. Snapshot: Export canonical registries (pools, vouchers, indices, limits, fee policies) and publish a signed snapshot hash.
2. Redeploy: Deploy new registry roots, router endpoints, and (if needed) a new Waterfall + Insurance policy contract set under a new governance process.
3. Re-register: Pool stewards opt-in by registering their pool addresses under the new registry root (no need to migrate user-held vouchers).

--- Seite 40 ---
4. Client Re-point: SDKs/UIs add the new registry root as a selectable network profile; default routing can shift via published governance decisions.

5. Bridge Period: Maintain routing bridges where safe to reduce fragmentation; deny-list toxic routes.

Key guarantee: Exiting canonical registries must not brick local economies. Pools continue operating locally; federation is an opt-in discovery layer.

## 12. LP Term Sheet (Non-Binding Outline)

- Eligible Contributions: Stablecoins, reserve tokens, approved community vouchers.
- Placement: Into designated CPP pools or the CLC Pool per DAO mandate.
- Lock-up / Exit: Program-specific (e.g., rolling 30–90 days; gates under stress).
- Policy-gated fee-credit (ex-post), under published caps/windows.
- Risk Sharing: Insurance haircuts; loss waterfalls; clawbacks in fraud/abuse.
- Reporting: Monthly dashboards; quarterly attestation of pool health and insurance reserves.
- Covenants: Use-of-proceeds constraints; oracle hygiene; limit tiers.
- CLC Eligibility (Impact Seeding): LPs who seed designated pools may become eligible for vested CLC grants based on measured increases in successful network settlement (see §7.2.3), subject to anti-gaming rules and policy caps.

## 13. Jargon → Plain Language (Glossary)

- CPP: A set of contracts that list vouchers, set values, limit swaps, charge fees, and safely hold assets.
- Voucher: A digital claim for a specific good/service/cash-equivalent.
- Seed (Deposit): Add vouchers/tokens into a pool.
- Swap: Exchange one voucher/asset for another if values and limits allow and inventory exists.
- Value Index: The pool's pricing table for vouchers vs. a reference unit (may use oracles or governance updates).
- Swap Limiter: Caps on how much can be swapped over time to prevent runs/arbitrage.
- Router: Software/contract that finds multi-pool paths for a desired exchange.
- Inventory: What the vault currently holds and can pay out.
- Guarantor: A party that stakes collateral to back a voucher/pool against default.

--- Seite 41 ---
- Redemption SLA: Expected time to receive the good/service/cash when redeeming a voucher.
- Clearing House (CLC Pool): Network account that collects fees, holds reserves, funds LP programs, and pays insurance.
- Fee-credit (budget-exit): A time-bounded, policy-capped authorization (typically via sCLC) to swap fee assets out of designated fee-holding vaults after the Waterfall. It may be set to zero and is not a dividend, yield, or profit-share.
- Rebalancing / Netting Run: A batch process that executes multilateral cycles/chains across opted-in pools to reduce inventory imbalances and increase successful settlement throughput, subject to published caps and policies.
- On/Off-Ramp: A regulated service that converts fiat ↔ approved stable cash-equivalents used to seed or exit pools (e.g., bank transfer, e-money/payment institutions, card-based cash-out), subject to jurisdictional compliance.

# 14. KPIs &amp; Health Indicators

- Fulfillment Rate &amp; Redemption Latency (SLA adherence).
- Reserve Adequacy by voucher and pool.
- Limit Utilization &amp; run-incident avoidance.
- Routing Pass/Fail &amp; average hop count.
- Guarantor Performance &amp; recovery percentages.
- Protocol Revenue: pool fees, routing, network rake.
- Net Fee Outcome (annualized sCLC fee-access, ex-post)
- Governance Responsiveness: time-to-alarm, time-to-pause, timelock adherence.
- Consumer Protection: Mis-selling complaints per 1,000 redemptions; median time-to-remedy; delisting decisions per quarter (with public reasons).
- Inventory Skew Index: per voucher class, dispersion of inventory across pools vs. target bands.
- Rebalance Success Rate: executed rebalance cycles / attempted cycles; median time-to-rebalance.
- Netting Yield: (gross routed value – net external liquidity injected) / gross routed value, computed over rebalance windows (method published and timelocked).
- Well-being Outcomes (profolio program-scoped):
- Basic-needs coverage proxy (food/transport/health voucher redemption success in target communities).
- Household resilience proxy (repeat redemption without increased delinquency).
- Planetary Regeneration:
- Verified ecological outcomes per voucher class (method + auditor published).
- "Do-no-harm" exceptions count (attempted listings rejected by prohibited-list policy).

--- Seite 42 ---
# 15. Roadmap (Indicative)

- v1: CLC token launch; CLC Pool; fee adapters; governance MVP (quorum + timelocks).
- v1.1: Router SDK &amp; registry APIs; health dashboards; Insurance Fund policy v1; opt-in rebalance intents + batch netting (cycle-finding) MVP.
- v1.2: Cross-domain routing via HTLC/escrow; guarantor module; tiered limit presets.
- v2: Retail on/off-ramps (via regulated partners), personal micro-pools; compliance plugin marketplace; third-party audits of voucher classes.
- On-ramps: convert fiat → approved stable cash-equivalents that can seed designated pools.
- Off-ramps: convert approved cash-equivalent stables → fiat via an approved off-ramp list (bank transfer, e-money issuers, and card-issuing/payment processors on major card rails), with jurisdictional KYC/attestation and geofencing where required.
- Principle: the DAO and CPP pools do not operate fiat rails; ramps are provided by licensed third parties under local regulation.

# 16. Values &amp; Evaluation Template (for Listings/Liquidity Mandates)

## Listing / Mandate Evaluation Rubric (required fields):

1) Observation: objective facts (issuer history, redemption terms, reserve plan, guarantors, limits).
2) Valuation: what matters (care, risk, capacity, non-dominance) + who is affected.
3) Needs/Boundaries: ecological + social + trust constraints (including prohibited list screening).
4) Request: concrete next step with owner + deadline (approve / revise / reject / human review).

Output must include: risk tier, reserve floor, limiter caps, remedy pathway, and review date.

**Guardrails**: Timelocked index edits; quorum limit changes; emergency pause criteria; auditable logs; forkability.

**Health Indicators**: fulfillment rate; reserve alarms; limit utilization; routing pass/fail; guarantor payout performance.

--- Seite 43 ---
# 17. Legal &amp; Compliance Note

CPP coordinates redeemable commitments. Some vouchers may fall under financial or consumer-protection rules depending on jurisdiction. Deployments should include local legal review, disclosures, and—where required—geofenced interfaces and attestation/KYC hooks for off-ledger redemptions.

Where fiat on/off-ramps are offered, they are provided by regulated third-party partners (e.g., banks, licensed e-money/payment institutions, or card-issuing/payment processors); the DAO does not itself custody fiat or operate money-transmission rails.

# 17.1 Voucher Class Matrix (Policy)

This matrix standardizes how voucher classes are listed, monitored, and governed across pools. Each class must be declared in pool metadata and surfaced in receipts.

|  Field | Options / Policy  |
| --- | --- |
|  Class Name | (eg, Staple Food, Transport Service, Labor Hour, Storage, Cash-Equivalent Stable, Community Stable, Tool/Equipment Use)  |
|  Legal Stance | Redeemable commitment / service credit. If cash-equivalent (eg, stablecoin redemption), treat as payment instrument exposure with additional attestations/geofencing as required.  |
|  Redemption SLA | Target and max (eg, Target ≤ 24h; Max ≤ 72h). Include redemption venues/contacts and fallback guarantee.  |
|  KYC / Attestation | None / Light Attestation / Full KYC (as required by jurisdiction, especially for cash-equivalent or high-value redemptions).  |
|  Fee Tier | Low (30–50 bps), Medium (50–80 bps), High (80–100 bps) depending on operational/credit risk.  |

--- Seite 44 ---
Certification / Attestation Policy
If used: accepted attestation issuers, certificate scope + expiry + revocation rules, whether certificates are non-transferable/registry-bound, and how attestations affect listing eligibility, haircuts, limits, and insurance qualification.

Index Source
Static schedule / Medianized oracle / Governance-updated feed. Publish source, cadence, and failure mode (safe default).

Limit Tier
Tier 1 (tight), Tier 2 (moderate), Tier 3 (expanded). Limits apply per voucher, optionally per-account and globally, over rolling windows.

Guarantor Requirement
None / Recommended / Required. Specify bond size, triggers, and payout path.

Off-Ramp Policy
For cash-equivalent stables: approved stable list + approved off-ramp provider list (by jurisdiction), required attestations/KYC tier, timelocks on changes, dispute window, and incident pause criteria. Off-ramp providers may include banks, licensed e-money/payment institutions, and card-issuing/payment processors (on major card rails). For non-cash vouchers: multi-venue redemption options and local contacts..

Disclosures
Plain-language “who/what/where/when” + fallback, embedded in voucher metadata and displayed in all receipts.

Pools must (i) declare the class used; (ii) enforce matching Fee/Limit/Index settings; (iii) publish any exceptions with justification and timelock.

17.2 Voucher Metadata Schema (minimum)

- who: issuer legal name + contact
- what: claim description (plain language), unit, quantity
- where: redemption venues / geofence

--- Seite 45 ---
- when: SLA target &amp; max window
- proof: acceptable evidence at redemption (QR receipt, ticket #, ID type)
- fallback: guarantor / payout path if not fulfilled
- class: matches declared Voucher Class Matrix entry
- fees: applicable pool/network fees shown to user
- limits: per-account/global windows (human-readable)
- disclosures: legal stance, risks, dispute hooks

# 17.3 Vouchers and Pools as Legal Instruments (Plain-Language)

Voucher: A voucher is a redeemable commitment—a defined claim on future delivery of a good/service (and in some classes, redemption into a cash-equivalent). It functions like a service credit or gift-card style claim with an explicit redemption SLA, venues, and fallback/recourse terms.

Not a Bank Deposit / Not E-Money. Vouchers and pool receipts are redeemable commitments (service/goods claims) and not bank deposits or e-money. No interest is paid; no guarantee of principal. Redemption is governed by published SLAs/venues and any disclosed guarantees.

Pool: A Commitment Pool is not merely software; it is a stewarded contract suite with published market terms: what vouchers are accepted (curation), how they are valued (index policy), how flows are limited (limit windows/caps), what fees apply, what inventory/reserve policy exists, and what guarantee/guarantee framework backs the listings. The pool steward is responsible for these published terms and any guarantees they advertise.

Restricted Jurisdictions. Access to certain voucher classes and/or UI features may be restricted or geofenced; additional attestations/KYC may be required for cash-equivalents. The DAO may programmatically disable sCLC swap windows or certain routes to comply with policy.

CLC DAO: The CLC DAO provides network governance, routing standards, and optional shared insurance policies. It is not automatically a guarantor of any pool or voucher unless explicitly stated in the relevant pool terms and DAO policy.

# 18. Conclusion

--- Seite 46 ---
CLC aligns mission-driven liquidity with durable, auditable settlement flows and explicit guardrails. By connecting local production, mutual aid, and lending through interoperable commitment pools (each with clear registries, value indices, swap limits, and accountable stewardship) CLC helps route real redeemable commitments at community scale without relying on opaque leverage. Participants can engage through governance and, where enabled by policy, sCLC provides time-bounded swap access to a defined portion of pooled fees, strengthening resilience through transparency, limits, and shared infrastructure.

# Appendix

## A. Math Box - Settlement, Fees, Fee Pooling

Definitions (per voucher j, per period):

D_j := outstanding debt (unsettled vouchers) valued in the network index

S_j := value of redemptions (settlements) routed through pools

V_j := settlement velocity for voucher j

Pool- and Network-Level:

D_j = ∑_k D_{j,k}

S_j = ∑_k S_{j,k}

V_j = S_j / D_j \quad (if D_j = 0, define V_j = 0)

Aggregate across all vouchers:

D_tot = ∑_j D_j

V_settle = (∑_j S_j) / D_tot = (settlement flow) / (outstanding stock)

Fee volume per period:

--- Seite 47 ---
F\approx T\cdot V\_settle\cdot D\_tot

Cash-usable fee revenue (convertibility constraint). Let  $\chi \in [0,1]$  be the fraction of fee inflows that are cash-eligible/convertible (E_cash) after slippage and policy constraints. Define:

F_cash  $\approx \chi \cdot F$

Operational break-even and any non-zero sCLC fee-access budget must be evaluated on F_cash.

LP fee ex-post metrics (per period, rough):

Ex-Post-Metrics_LP ≈ (φ · F) / K

where  $\tau =$  average network fee rate;  $\phi =$  fee share to LPs;  $K =$  LP capital staked.

# B. Fee Waterfall (executed monthly, on-chain)

Let  $F_{-}$  in be all fees collected across pools/routers during the epoch.

Eligibility &amp; conversion note. F_in may include both cash-eligible fee assets (E_cash) and in-kind fee assets (E_kind). The protocol may convert allowlisted fungible assets (E_cash) into stables/fiat when needed to meet insurance payouts, maintain off-ramp liquidity, and fund core operations—while prioritizing in-network settlement and using liquidity mandates/CLC Pool inventories to reduce settlement latency.

1. Insurance Reserve Target (IRT): top-up InsuranceFund to Target =  $\Sigma_{\mathsf{p}}$  (RW_p · D_p),

a. where D_p is the pool's outstanding obligations stock (valued in the network index),
b. with RW_p (risk weight) = f(fulfillment_rate, issuer_concentration, limit Utilization, SLA latency).
c. Allocation = min(IRT - InsuranceFund, MaxTopUp).

2. Core Operations: fixed budget B_core (timelocked;  $\pm 20\%$  with quorum Q2).

3. Liquidity Mandates: allocate L to approved pools/routers per mandate schedule.

4. Pooled Fees — allocation of remaining F_in -  $(1 + 2 + 3)$ :

a. Protocol Operations/Insurance (non-distributive):  $\alpha$
b. Liquidity Programs (incentives/rebates):  $\beta$
c. Insurance Buffer (overflow reserve):  $\gamma$

subject to  $\alpha +\beta +\gamma = 1$  , policy bounds, and per-budget caps.

--- Seite 48 ---
Guardrail: Waterfall allocations are for (i) insurance adequacy, (ii) operations, and (iii) liquidity needed for settlement. They MUST NOT be framed or executed as price-support operations.

Any CLC acquired via DEX Float Reduction is retired (burned) to avoid custody and governance-risk; it is not distributed to stakers.

## C. KPI Definitions

- Fulfillment Rate (pool p, period t): FR_{p,t} = Settlements_{p,t} / RedemptionsRequested_{p,t}
- Redemption Latency (SLA): median time(issue→redeem) with 90th percentile cap
- Reserve Adequacy (voucher v): RA_{v} = Vault_{v} / RequiredReserves_{v} (policy function)
- Limit Utilization (voucher v): LU_{v,t} = Usage_{v,t} / Cap_{v,t}
- Routing Pass Rate: RPR_t = SuccessfulRoutes_t / AttemptedRoutes_t
- Avg Hop Count: H_t = (Σ routes hop_count) / routes
- Guarantor Recovery: GR_t = RecoveredFromBonds_t / ClaimsPaid_t
- Protocol Revenue: PR_t = PoolFees_t + RoutingFees_t + NetworkRake_t
- Net LP Credit Access (program x): CA_x = (FeesToLP_x - InsuranceHaircuts_x) / AvgStake_x (annualized)
- Governance Timeliness: TTA = median(time→alarm), TTP = median(time→pause), TLK = timelock adherence %

## D. Launch Parameters

All values set on-chain by DAO vote at deployment and enforced by DAO-owned contracts

- Quorum Tiers (of staked voting power):
- Q1 (Routine): ≥ 4% quorum, &gt;50% approval.
- Q2 (Sensitive): ≥ 10% quorum, ≥60% approval.
- Q3 (Critical): ≥ 20% quorum, ≥66.7% approval.
- Timelocks (minimum delay before execution):
- T1: 48 hours (Q1 actions)

--- Seite 49 ---
T2: 7 days (Q2 actions)
T3: 30 days (Q3 actions)

- Epoch Cadence: default 7 days (policy-set). Each epoch includes:
- (i) gauge voting window,
- (ii) emissions calculation,
- (iii) publication of F_epoch (may be zero),
- (iv) sCLC swap windows (if enabled).

- Gauges: canonical list of eligible pools/mandates for incentive direction; edits are timelocked and require Q2 quorum or higher.
- Emissions Budget (sCLC): a bounded, policy-set maximum per epoch; may be zero; cannot override Waterfall priorities.
- Anti-gaming: wash-loop exclusion, beneficial-owner clustering, per-entity caps, delayed finalization, and dispute/appeal windows for manipulated metrics.
- Emergency Pause: immediate (multisig/DAO emergency role), auto-sunsets in 72 hours unless ratified by Q2.
Network Fee T: 20-60 bps (default 30 bps) on routed value
- Pool Fee Range (steward-set):  $0\% - 20\%$  depending on voucher class and risk tier (disclosed on-chain per pool).
Network Rake Share r: DAO takes  $r\%$  of each pool's collected fees (default  $20\%$ ; policy-bounded per pool class).
Effective network fee rate per pool:  $\tau_{-}p = f_{-}p\cdot r_{-}p$  (rake-on-rake).
Fee Asset Eligibility Sets:
E_cash (cash-eligible): allowlisted stables/cash-equivalents and (optionally) major liquid tokens.
E_kind (in-kind): non-fiat-redeemable vouchers and other non-convertible fee assets.

- Conversion Policy (fungible assets only): venue allowlists, TWAP windows, max slippage, and monthly caps; quarterly reporting of  $\chi$  (cash-eligible share).
- F_epoch enablement rule: publish F_epoch only if (i) InsuranceFund ≥ Target and (ii) B_core is fully funded for the epoch; otherwise F_epoch = 0.
- Router Fee Cap: ≤ 20 bps per route
- Reserve Floors by Class: Cash-Equivalent Stable ≥ 100% off-ramp attestations
- Segregated Risk Lanes:
- Cash-Equivalent lanes do not cross-subsidize goods/services voucher losses.
No routing from Cash-Equivalent to higher-risk classes unless explicitly opted-in per account/pool.

- Default router policy: "safe-by-default" (deny cross-class risk unless allowlisted).
- Insurance Haircut Cap (per incident):  $\leq 10\%$  of affected voucher balance, with make-whole schedule
DEX Float Reduction Parameters (if enabled):
- DEX float definition: sum of CLC balances in allowlisted external liquidity venues (list on-chain), measured by oracle/indexer method M.
- Trigger: activate only if DEX float &gt; X% for Y consecutive days.

--- Seite 50 ---
- Spend/volume caps: ≤ Z% of trailing-month fee inflows and/or ≤ W% of trailing-day DEX volume (use the stricter cap).
- Execution controls: TWAP window T; max slippage S; randomized delay range R; no publication of exact timing beyond the standing policy.
- Emergency stop: auto-disable if InsuranceFund / Target &lt; I_min or if any Reserve Floor is breached.
- Disclosure requirement: "Not intended to support price; settlement does not depend on DEX price."
- Receipt transparency: all executions emit on-chain receipts and are summarized in the epoch report.

## F. Worked Example - Rake-on-Rake, Convertibility (χ), and Break-Even Runway

Fees are collected in the asset that moves through pools. Some fee assets are cash-eligible/convertible (E_cash), others are in-kind (E_kind). Define $\chi$ as the trailing-month share of fee inflows that are cash-eligible/convertible after slippage and policy constraints.

Example A.

Assume:

- Average pool usage fee $f = 2.00\%$
- Network rake share $r = 20\%$ of pool fees
- Effective network fee rate $T = f \cdot r = 0.40\% = 40$ bps
- Monthly cash-denominated requirement B_cash = Core Ops + required Insurance Top-ups (USD)
- Cash-eligible share $\chi$ (0 to 1)

Then required monthly routed value (in USD-indexed terms) to reach cash break-even is approximately:

R_required ≈ B_cash / (T · χ)

Illustration (T = 40 bps):

--- Seite 51 ---
- If B_cash = $150,000/month and χ = 25% → R_required ≈ $150,000 / (0.004 · 0.25) ≈ $150,000,000 / month
- If B_cash = $150,000/month and χ = 50% → R_required ≈ $75,000,000 / month
- If B_cash = $150,000/month and χ = 100% → R_required ≈ $37,500,000 / month

Runway to non-zero sCLC budgets.

Because sCLC fee-access budgets (F_epoch) are downstream of: (1) Insurance targets, (2) Core Ops, and (3) Liquidity Mandates, F_epoch may remain zero until R_monthly consistently exceeds R_required under conservative χ. This is a long time-frame commitment.

Time-to-target worksheet (update quarterly).

Let R_0 be current monthly routed value and g be monthly growth rate (e.g., 5% or 10%).

Time (months) to reach R_required is approximately:

t ≈ log(R_required / R_0) / log(1 + g)

The DAO will publish quarterly updates of: R_0, χ, B_cash, τ (effective), and the implied t under conservative/base scenarios.

## F. Dataroom Checklist

1. Sarafu.Network traction: monthly swap volumes, redemption rates, incident history, settlement velocity, aging vouchers, fulfillment SLAs.
a. Dune Analytics: https://dune.com/grassrootseconomics/sarafu-network
b. Pilot Site: https://sarafu.network

2. Fee enforcement proof (MUST-HAVE INVARIANT): FeeHook contract and registry gating integrated into settlement execution path (not UI-only).
a. Router rejects any hop whose receipt does not prove fees were collected per policy.
b. Published test vectors + failure cases + list of compliant pools (signed by registry root).
c. (segregated cash-equivalent lanes)
d. Software Description: https://software.grassecon.org

3. Guarantor Framework pack: eligibility, collateral, premiums, triggers, dispute/appeal examples; 2–3 sample vouchers showing issuer vs. pool guarantee vs. DAO insurance.

--- Seite 52 ---
a. Sarafu.Network: https://sarafu.network/reports
b. A year in review - operations in Kenya: https://youtu.be/5yGaP31bvs0?si=fZ-AMTEXsmVR8Ulv

4. Legal memo: jurisdiction strategy, voucher classes, cash-equivalent policies, KYC/attestation options, geofencing, and mis-selling avoidance language.
5. Governance hardening: COI template, recusal mechanism, sanctions ladder, delisting due-process templates, and examples of time-locked index/limit edits.
a. Licences for Vouchers and Pools: https://docs.grassecon.org/commons/
b. Terms and Conditions for Sarafu.Network: https://grassecon.org/pages/terms-and-conditions

6. Open-source/audit pack: AGPL-3.0 repos, audit reports, invariants, and monitoring dashboards.
a. GitHub: http://github.com/grassrootseconomics

This document is for discussion and does not constitute an offer to sell or a solicitation to buy any security or financial instrument.