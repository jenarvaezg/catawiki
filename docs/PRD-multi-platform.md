# PRD: Multi-Platform Coin Buying Extension

> **Status:** Draft
> **Author:** Jose / Claude
> **Date:** 2026-04-10
> **Version:** 0.1

---

## 1. Problem Statement

Coin collectors and bullion investors who buy on online marketplaces face two recurring problems:

1. **Hidden total costs** — Each platform has a different fee structure (buyer commissions, protection fees, shipping tiers). The real price of a coin is never the listed price, and comparing across platforms requires manual arithmetic.

2. **No market context at the point of purchase** — Sellers set arbitrary prices. Without checking Numista or spot metal prices separately, buyers can't tell if a listing is a bargain or overpriced.

The current extension solves both problems **exclusively for Catawiki**. This PRD extends coverage to **Wallapop** and **Vinted**, the two other major platforms where coins trade in the European market, and introduces **cross-platform comparison** as the differentiating feature.

---

## 2. User Personas

### 2.1 Ana — Casual Collector

- Collects Spanish pesetas and euro commemoratives
- Browses Wallapop daily, Catawiki weekly, Vinted occasionally
- Wants to know: "Is this a good price?" and "What will I actually pay?"
- Non-technical; values simplicity over exhaustive data

### 2.2 Marco — Bullion Stacker

- Buys silver/gold coins primarily for metal content
- Price-sensitive: compares spot price vs listing price across all platforms
- Wants: bullion value overlay, price-per-gram, and alerts when coins dip below spot + premium threshold
- Comfortable with numbers; wants data density

### 2.3 Pedro — Semi-Professional Dealer

- Buys to resell; margins matter
- Needs total acquisition cost (price + fees + shipping) to calculate profit
- Wants cross-platform visibility: "Is this coin cheaper on Wallapop?"
- Values speed and accuracy over aesthetics

---

## 3. Platform Analysis

### 3.1 Catawiki (current — fully supported)

| Aspect | Detail |
|--------|--------|
| Model | Auction (timed bids) |
| Buyer fee | ~9% + €3 (buyer protection) |
| Shipping | Per-lot, set by seller; free shipping common |
| Coin volume | High — dedicated numismatic categories |
| Tech | React SSR, stable `data-testid` attributes |
| URL pattern | `catawiki.com/{locale}/l/{lotId}` |

### 3.2 Wallapop (priority target)

| Aspect | Detail |
|--------|--------|
| Model | Fixed price + offers/negotiation |
| Buyer fee | €0 (seller pays commission) |
| Shipping | Wallapop Envios: €2.50–€5.95 by weight tier; or local pickup (free) |
| Coin volume | High — active "Coleccionismo > Monedas" section in Spain |
| Tech | SPA (Angular/React), dynamic class names; usable REST API at `/api/v3/` |
| URL patterns | Product: `wallapop.com/item/{slug}`, Search: `wallapop.com/app/search?...` |
| Geo | Spain primary, expanding to IT, PT, UK |

**Why Wallapop first:**
- Largest second-hand marketplace in Spain — high coin volume
- Zero buyer fee simplifies initial adapter (total = price + shipping)
- REST API (`/api/v3/items/{id}`) returns structured JSON, reducing DOM fragility
- Same geographic market as Catawiki ES — maximizes cross-platform comparison value

### 3.3 Vinted (second target)

| Aspect | Detail |
|--------|--------|
| Model | Fixed price + offers |
| Buyer fee | ~5% + €0.70 buyer protection (varies by country) |
| Shipping | Platform-integrated; multiple carriers; cost varies by size/weight/country |
| Coin volume | Lower — primarily fashion; coins under "Coleccionismo" |
| Tech | SPA, BEM-style classes, multi-domain (vinted.es, .fr, .de, .co.uk, etc.) |
| URL patterns | Product: `vinted.{tld}/items/{id}-{slug}`, Search: `vinted.{tld}/catalog?search_text=...` |
| Geo | Pan-European (20+ countries) |

---

## 4. Feature Requirements

### Phase 1 — Platform Abstraction Layer (no new features)

**Goal:** Decouple Catawiki-specific logic from generic injection/calculation logic without breaking anything.

| ID | Requirement | Priority |
|----|-------------|----------|
| P1.1 | Define `Platform` interface with methods for: host matching, page type detection, product ID extraction, DOM selectors, card data extraction, detail data extraction, total cost calculation, coin metadata extraction, and UI injection points | Must |
| P1.2 | Implement `CatawikiPlatform` adapter that encapsulates all current Catawiki-specific logic (selectors, URL parsing, bid increments, commission model) | Must |
| P1.3 | Implement `PlatformRegistry` that detects current platform from `window.location` and returns the appropriate adapter | Must |
| P1.4 | Refactor `listing-injector.ts` to accept a `Platform` parameter instead of hardcoded Catawiki selectors and logic | Must |
| P1.5 | Refactor `lot-detail-injector.ts` (rename to `detail-injector.ts`) to accept a `Platform` parameter | Must |
| P1.6 | Refactor `lot-cost-resolver.ts` to delegate shipping/fee extraction to the platform adapter | Must |
| P1.7 | Refactor `main.ts` to use `PlatformRegistry` for initialization | Must |
| P1.8 | Generalize `page-type.ts` into the platform adapter | Must |
| P1.9 | Generalize `lot-url.ts` into a platform-aware `product-url.ts` | Must |
| P1.10 | Ensure all existing tests pass after refactoring | Must |
| P1.11 | Rename Catawiki-specific terminology in generic code: "lot" → "product"/"item", "bid" → "price" where appropriate in shared interfaces | Should |
| P1.12 | Keep `bid-increments.ts` as a Catawiki-only module (auctions are Catawiki-specific) | Must |

**Acceptance criteria:**
- Extension works identically on Catawiki after refactoring
- No Catawiki-specific imports in generic modules (`listing-injector`, `detail-injector`, `main`)
- All existing tests pass
- Bundle size does not increase more than 5%

### Phase 2 — Wallapop Support

**Goal:** Show total costs and market values on Wallapop coin listings.

| ID | Requirement | Priority |
|----|-------------|----------|
| P2.1 | Implement `WallapopPlatform` adapter with host matching for `wallapop.com` and `uk.wallapop.com` | Must |
| P2.2 | Page type detection: search/category pages → `listing`, item pages → `product-detail` | Must |
| P2.3 | Card data extraction: price, title, shipping availability badge, product URL/ID, negotiable flag, sold/reserved status | Must |
| P2.4 | Detail page data extraction: price, full description, shipping cost (Wallapop Envios tiers), seller info | Must |
| P2.5 | Total cost calculation: `price + shipping` (no buyer fee) | Must |
| P2.6 | Inject total cost widget on listing cards (price + estimated shipping) | Must |
| P2.7 | Inject total cost widget on detail page | Must |
| P2.8 | Numista market value lookup from product title/description | Must |
| P2.9 | Bullion value calculator on detail pages | Must |
| P2.10 | Ignore/hide products (reuse existing ignored-lots infrastructure, generalized) | Should |
| P2.11 | Listing filters (max total, max shipping) adapted for fixed-price model | Should |
| P2.12 | Add Wallapop domains to manifest `content_scripts.matches` and `host_permissions` | Must |
| P2.13 | Handle Wallapop's SPA navigation (route changes without full page reload) | Must |
| P2.14 | Wallapop Envios shipping tier estimation (weight-based: 2.50/3.95/5.95 EUR) | Should |
| P2.15 | Consider using Wallapop REST API (`/api/v3/`) as primary data source instead of DOM scraping | Should |

**Acceptance criteria:**
- On Wallapop search pages, each coin listing card shows estimated total cost
- On Wallapop item pages, total cost widget and Numista/bullion widgets are displayed
- Existing Catawiki functionality is unaffected
- Works with Wallapop's SPA navigation (no full page reload needed)

### Phase 3 — Vinted Support

**Goal:** Show total costs (including buyer protection) and market values on Vinted.

| ID | Requirement | Priority |
|----|-------------|----------|
| P3.1 | Implement `VintedPlatform` adapter with host matching for `vinted.{es,fr,de,co.uk,it,nl,be,pt,...}` | Must |
| P3.2 | Page type detection for Vinted URL patterns | Must |
| P3.3 | Card and detail data extraction | Must |
| P3.4 | Buyer protection fee calculation per country (~5% + €0.70, varies) | Must |
| P3.5 | Total cost: `price + buyer_protection + shipping` | Must |
| P3.6 | Inject total cost and market value widgets | Must |
| P3.7 | Add Vinted domains to manifest | Must |
| P3.8 | Handle Vinted SPA navigation | Must |
| P3.9 | Detect locale/country from Vinted TLD for correct fee calculation | Should |

**Acceptance criteria:**
- Same feature parity as Wallapop adapter
- Correct buyer protection fee calculation per country
- Works across all major Vinted country domains

### Phase 4 — Cross-Platform Intelligence

**Goal:** Compare prices across platforms and provide market intelligence.

| ID | Requirement | Priority |
|----|-------------|----------|
| P4.1 | Cross-platform search: when viewing a coin on any platform, search for the same coin on the other two platforms via background script | Must |
| P4.2 | Display cross-platform comparison widget on detail pages showing: other listings found, their total costs, and links | Must |
| P4.3 | Coin matching strategy: use Numista type ID as canonical identifier; fall back to fuzzy title matching (year + denomination + country) | Must |
| P4.4 | Price score indicator: ratio of `numista_market_value / total_cost` displayed as color-coded badge (green/neutral/red) | Should |
| P4.5 | Cache cross-platform search results (TTL: 1 hour for listings, 24h for Numista matches) | Must |
| P4.6 | Background script handlers for Wallapop API search and Vinted search | Must |
| P4.7 | Rate limiting and throttling for cross-platform searches to avoid platform bans | Must |

**Acceptance criteria:**
- Viewing a coin on Catawiki shows if cheaper on Wallapop/Vinted (and vice versa)
- Price score badge visible on listing cards and detail pages
- Cross-platform data loads within 3 seconds
- No platform bans from search traffic

### Phase 5 — Watchlist & Alerts (future)

| ID | Requirement | Priority |
|----|-------------|----------|
| P5.1 | Unified watchlist: save coins by Numista type ID or custom search query | Could |
| P5.2 | Target price per watched coin | Could |
| P5.3 | Background polling: periodically check all platforms for new listings matching watchlist | Could |
| P5.4 | Browser notification when a watched coin appears below target price | Could |
| P5.5 | Price history: track seen prices over time per Numista type | Could |

---

## 5. Architecture Overview

### 5.1 Directory Structure

```
src/
├── platforms/
│   ├── platform.ts              # Platform interface + shared types
│   ├── registry.ts              # detectPlatform(url) → Platform | null
│   ├── catawiki/
│   │   ├── adapter.ts           # CatawikiPlatform implements Platform
│   │   ├── selectors.ts         # Catawiki DOM selectors (from current dom-selectors.ts)
│   │   ├── bid-increments.ts    # Auction-specific bid logic
│   │   ├── commission.ts        # 9% + €3 buyer protection model
│   │   └── url.ts               # Catawiki URL parsing
│   ├── wallapop/
│   │   ├── adapter.ts           # WallapopPlatform implements Platform
│   │   ├── selectors.ts         # Wallapop DOM selectors
│   │   ├── shipping.ts          # Wallapop Envios tier pricing
│   │   └── url.ts               # Wallapop URL parsing
│   └── vinted/
│       ├── adapter.ts           # VintedPlatform implements Platform
│       ├── selectors.ts         # Vinted DOM selectors
│       ├── buyer-protection.ts  # Per-country fee calculation
│       └── url.ts               # Vinted URL parsing (multi-TLD)
│
├── content/
│   ├── main.ts                  # Entry: detect platform → delegate
│   ├── listing-injector.ts      # Generic: uses Platform interface
│   ├── detail-injector.ts       # Generic: uses Platform interface
│   ├── market-injector.ts       # Numista + bullion (already generic)
│   ├── cost-resolver.ts         # Generic: delegates to Platform for extraction
│   ├── cross-platform-widget.ts # Phase 4: comparison UI
│   ├── price-score.ts           # Phase 4: value scoring
│   ├── ignored-products.ts      # Renamed from ignored-lots.ts
│   ├── listing-filters.ts       # Already generic
│   ├── listing-filters-panel.ts # Already generic
│   ├── ignored-products-panel.ts
│   ├── update-notifier.ts       # Already generic
│   ├── currency-parser.ts       # Already generic
│   ├── i18n.ts                  # Extended with Wallapop/Vinted labels
│   ├── mutation-observer.ts     # Already generic
│   ├── styles.ts                # Already generic
│   └── types.ts                 # Extended with Platform-aware types
│
├── background.ts                # Extended: cross-platform search handlers
│
└── shared/
    ├── messages.ts              # Extended: new message types
    ├── numista.ts               # Already generic
    ├── update.ts                # Already generic
    ├── build-info.ts            # Already generic
    └── coin-matcher.ts          # Phase 4: fuzzy coin matching
```

### 5.2 Platform Interface (core contract)

```typescript
interface Platform {
  readonly id: PlatformId;
  readonly name: string;

  // --- Routing ---
  matchesHost(hostname: string): boolean;
  detectPageType(url: string): PageType;
  extractProductId(url: string): string | null;
  getCanonicalProductUrl(url: string): string | null;

  // --- DOM Extraction (listing page) ---
  queryAllCards(root: Element | Document): Element[];
  extractCardData(card: Element, locale: string): CardData | null;
  getCardInjectionTarget(card: Element): Element | null;
  getCardItemContainer(card: Element): HTMLElement;

  // --- DOM Extraction (detail page) ---
  extractDetailData(doc: Document, locale: string): ProductDetailData | null;
  getDetailInjectionTarget(doc: Document): Element | null;

  // --- Pricing ---
  calculateTotalCost(price: number, shipping: number | null): CostBreakdown;
  extractCostFromHtml(html: string): CostDetails;

  // --- Coin metadata ---
  extractCoinHints(card: Element): CoinMetadataHints;
  extractCoinHintsFromDetail(doc: Document): CoinMetadataHints;

  // --- Navigation ---
  observeNavigationChanges(callback: () => void): void;
}

type PlatformId = 'catawiki' | 'wallapop' | 'vinted';
```

### 5.3 Data Flow

```
┌──────────────────────────────────────────────────────────┐
│                    CONTENT SCRIPT                         │
│                                                          │
│  1. main.ts                                              │
│     └─ PlatformRegistry.detect(url) → Platform           │
│     └─ platform.detectPageType(url) → 'listing'|'detail' │
│                                                          │
│  2a. listing-injector.ts (listing pages)                 │
│      └─ platform.queryAllCards(document) → Element[]     │
│      └─ platform.extractCardData(card) → CardData        │
│      └─ platform.calculateTotalCost(price, ship) → Cost  │
│      └─ platform.getCardInjectionTarget(card) → Element  │
│      └─ inject widget after target                       │
│                                                          │
│  2b. detail-injector.ts (detail pages)                   │
│      └─ platform.extractDetailData(doc) → DetailData     │
│      └─ platform.calculateTotalCost(price, ship) → Cost  │
│      └─ inject main widget + market widgets              │
│                                                          │
│  3. market-injector.ts (detail pages)                    │
│      └─ sendMessage('resolve-numista-market', hints)     │
│      └─ sendMessage('resolve-bullion-value', hints)      │
│      └─ inject Numista + bullion widgets                 │
│                                                          │
│  4. cross-platform-widget.ts (Phase 4, detail pages)     │
│      └─ sendMessage('search-cross-platform', coinId)     │
│      └─ inject comparison widget                         │
└──────────────────────────────────────────────────────────┘
          │                    ▲
          │  chrome.runtime    │
          ▼  .sendMessage      │
┌──────────────────────────────────────────────────────────┐
│                 BACKGROUND SERVICE WORKER                  │
│                                                          │
│  Existing handlers:                                      │
│  ├─ resolve-numista-market  (unchanged)                  │
│  ├─ resolve-bullion-value   (unchanged)                  │
│  ├─ fetch-product-html      (renamed from fetch-lot-html)│
│  ├─ set-numista-api-key     (unchanged)                  │
│  └─ check-extension-update  (unchanged)                  │
│                                                          │
│  New handlers (Phase 4):                                 │
│  ├─ search-wallapop         (Wallapop API /api/v3/)      │
│  ├─ search-vinted           (Vinted API)                 │
│  └─ search-cross-platform   (orchestrates both)          │
└──────────────────────────────────────────────────────────┘
```

---

## 6. Technical Constraints

### 6.1 Manifest V3 Limitations
- Service workers have no persistent state — all caching via `chrome.storage`
- Content scripts run in isolated world — DOM access only, no page JS variables
- `host_permissions` must list all target domains explicitly

### 6.2 Platform-Specific Risks

| Platform | Risk | Mitigation |
|----------|------|------------|
| Wallapop | DOM classes are minified/hashed, change on deploys | Primary: use REST API `/api/v3/` where possible. Fallback: text-content matching, structural selectors (`article > div:first-child`) |
| Wallapop | API may require auth headers or rate-limit | Reverse-engineer minimal headers; implement exponential backoff; cache aggressively |
| Vinted | Multi-domain (20+ TLDs) increases manifest size | Use wildcard patterns where possible (`*://*.vinted.*/*` if Chrome allows, else enumerate top 10) |
| Vinted | Buyer protection fee varies by country and changes | Make fee schedule configurable; fetch from a config endpoint or hardcode with version bumps |
| All | SPA navigation means content script must re-run on route changes | `MutationObserver` on `<body>` or platform-specific nav container; debounce re-injection |
| All | Platforms may block extension fetch requests | Fallback to iframe loading (already implemented for Catawiki) |

### 6.3 Performance Budget
- Content script should not add >100ms to page load
- Background API calls should not exceed 4 concurrent requests per platform
- Total extension storage should stay under 10MB
- Bundle size target: <150KB per entry point (content + background)

### 6.4 Compatibility
- Chrome 120+ (Manifest V3)
- Firefox: out of scope for Phase 1-3; architecture should not preclude it
- Mobile browsers: not supported (no extension APIs)

---

## 7. Non-Functional Requirements

### 7.1 Privacy
- No user data sent to external servers (except Numista API for coin lookup, Gold API for spot prices, and GitHub for updates — all existing)
- No tracking, analytics, or telemetry
- All storage is local (`chrome.storage.local`)
- Cross-platform search queries stay within the background service worker

### 7.2 Resilience
- Extension must degrade gracefully if a platform changes its DOM — show nothing rather than broken UI
- If Wallapop/Vinted API is unreachable, skip cross-platform features silently
- Each platform adapter is independent — a bug in one must not crash the others

### 7.3 Maintainability
- Each platform adapter is self-contained in its own directory
- Adding a new platform requires only: implementing `Platform` interface + adding to registry + manifest entry
- Platform-specific code must never leak into generic modules
- Selectors must be centralized per platform (single file to update when DOM changes)

---

## 8. Success Metrics

| Metric | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|--------|---------|---------|---------|---------|
| Catawiki functionality intact | Yes | Yes | Yes | Yes |
| Wallapop total cost shown | — | >90% of coin listings | >90% | >90% |
| Vinted total cost shown | — | — | >90% of coin listings | >90% |
| Numista match rate | Baseline | Same | Same | Same |
| Cross-platform matches found | — | — | — | >50% of coins with Numista ID |
| User-reported DOM breakage | 0 | <3/month | <3/month | <5/month |
| Bundle size | <100KB | <120KB | <140KB | <150KB |

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Wallapop blocks extension API requests | Medium | High | Use DOM scraping as fallback; rotate request patterns; respect rate limits |
| Catawiki DOM changes break during refactor | Low | High | Comprehensive test suite before refactoring; use selectors with fallbacks (already in place) |
| Numista matching quality degrades with non-Catawiki titles | Medium | Medium | Catawiki titles are structured; Wallapop/Vinted titles are free-form. Invest in better NLP: extract year, denomination, country with regex patterns. Tune `scoreTypeMatch` for noisy input |
| Scope creep from Phase 4/5 features | High | Medium | Strict phase gates; Phase 1-3 must ship and stabilize before Phase 4 begins |
| Manifest permission requests deter users | Low | Medium | Clear description of why each permission is needed; minimal permission set per phase |
| Vinted fee structure changes without notice | Medium | Low | Hardcode with version-bumped updates; add a "fee may be approximate" disclaimer |

---

## 10. Open Questions

1. **Should we use Wallapop's API directly or scrape DOM?** The API is undocumented but stable and returns clean JSON. Using it avoids DOM fragility but may break if they add auth. **Recommendation:** API-first with DOM fallback.

2. **How to handle Wallapop local pickup (no shipping)?** Show total as just the price with a "recogida en persona" note? Or estimate shipping as a range? **Recommendation:** Show both: "€35 (recogida) / €39.95 (envio)".

3. **Should cross-platform search be automatic or on-demand?** Automatic adds latency and API load. On-demand requires user action. **Recommendation:** On-demand with a "Compare prices" button, auto for items with a Numista match already cached.

4. **Naming: keep "Catawiki Price Calculator" or rebrand?** Multi-platform support warrants a rename. **Candidates:** "Coin Price Helper", "NumisHelper", "CoinScope". **Decision:** Defer to Phase 2 launch.

5. **Should `lot` terminology be fully replaced?** "Lot" is Catawiki-specific. Generic term: "item" or "product". **Recommendation:** Use "item" in interfaces, keep "lot" only inside `platforms/catawiki/`.

---

## 11. Phase 1 Detailed Scope

Since Phase 1 is the immediate next step, here is the granular task breakdown:

### Files to create
- `src/platforms/platform.ts` — `Platform` interface, `CardData`, `ProductDetailData`, `CostBreakdown`, `CostDetails`, `CoinMetadataHints`, `PlatformId` types
- `src/platforms/registry.ts` — `detectPlatform(url): Platform | null`
- `src/platforms/catawiki/adapter.ts` — `CatawikiPlatform implements Platform`
- `src/platforms/catawiki/selectors.ts` — move from `content/dom-selectors.ts`
- `src/platforms/catawiki/url.ts` — move from `content/lot-url.ts` + `content/page-type.ts`
- `src/platforms/catawiki/commission.ts` — extract from `content/price-calculator.ts`
- `src/platforms/catawiki/bid-increments.ts` — move from `content/bid-increments.ts`

### Files to modify
- `src/content/main.ts` — use `PlatformRegistry` instead of hardcoded `detectPageType`
- `src/content/listing-injector.ts` — accept `Platform` param, delegate card queries/extraction
- `src/content/lot-detail-injector.ts` → rename to `detail-injector.ts`, accept `Platform` param
- `src/content/lot-cost-resolver.ts` → rename to `cost-resolver.ts`, delegate extraction to platform
- `src/content/lot-market-injector.ts` → rename to `market-injector.ts`
- `src/content/types.ts` — add `PlatformId`, extend `PageType`
- `src/shared/messages.ts` — rename `fetch-lot-html` → `fetch-product-html`
- `src/background.ts` — update message handler names

### Files to keep as-is
- `src/content/currency-parser.ts` — already platform-agnostic
- `src/content/i18n.ts` — already platform-agnostic (extend later)
- `src/content/mutation-observer.ts` — already generic
- `src/content/styles.ts` — already generic
- `src/content/ignored-lots.ts` — defer renaming to Phase 2 (storage key migration needed)
- `src/content/listing-filters.ts` — already generic
- `src/shared/numista.ts` — already platform-agnostic
- `src/shared/update.ts` — already generic

### Invariant
After Phase 1, running `npm test` passes and the extension works identically on Catawiki.
