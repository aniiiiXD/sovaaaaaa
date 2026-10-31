# Sova — Design System

Dark cinematic identity: near-black ground, near-white ink, monochrome liquid-glass surfaces, and vermilion reserved strictly as a live/attention signal.

## Tokens (globals.css)
| Token | Value | Use |
|---|---|---|
| `--paper` | `#0A0A0C` | page ground |
| `--paper-2` | `#141417` | raised panels, grid cells, table |
| `--paper-3` | `#0F0F12` | wells / insets |
| `--ink` | `#F5F4F2` | primary text (16.7–18:1 on dark) |
| `--muted` | `#A6A6AE` | secondary text (7.6–8.2:1) |
| `--faint` | `#86868F` | captions, small mono meta (5.1–5.5:1 — ≥4.5:1 on **every** dark surface) |
| `--pine` | `#ECECEE` | near-white accent; **background of the featured Build card** (dark `--paper-2` foreground stays legible: 15.6:1) |
| `--pine-ink` | `#CDCDD3` | labels / leads on dark |
| `--signal` | `#FF5C2E` | vermilion. Small orange text ≥5.9:1 on dark panels; bright on the hero headline |

## Type
- **Instrument Serif** — display headlines (`.display`), card titles.
- **Geist** — body/UI.
- **Roboto Mono** — eyebrows, tags, table headers, meta (`.mono`).

## Signature elements
- Liquid-glass cards/wells/chips/tags with masked gradient border (`.card`, `.well`, `.chip`, `.tag`).
- Faint hairline grid (`.grid-bg`) behind the contact panel only.
- Signal dot (`.signal-dot`) = "live" semantics only.
- Featured engagement card: solid light `--pine` background, dark text — the one light surface.
- Hero: Mumbai photo, preserved; gradient bands darken only top/bottom where copy sits. Copy never sits on busy midtone image areas.

## Accessibility floors (AA, normal daylight)
- All text ≥ 4.5:1 on its surface; large display ≥ 3:1. Measured values above.
- Interactive targets ≥ 44px min-height (`.btn`); labels wrap instead of overflowing at 320px.
- Focus: 2px `--signal` outline, 2px offset, globally on `:focus-visible`.
- `prefers-reduced-motion`: reveal/scan/signal animations off, transitions collapsed, hover lifts disabled.

## Buttons
- `.btn-primary`: white fill, near-black text (19.8:1). `.btn-ghost`: solid dark translucent fill + 1px light outline + blur — reliably readable **over the hero image**, not bare glass.
- Hover lifts −1px; `:active` returns to 0. No color-only state (outline/bg shift + lift).

## Anti-reference (never do)
- Dim gray text below 4.5:1; busy photo behind body copy; cramped sub-44px CTAs.
- New glass variants or giant solid panels; decorative gradients competing with vermilion.

## Fluid hero system (responsive composition)
Purpose-sized content on large desktop/ultrawide without a blanket zoom, and without stretching infinitely at 4K. Implemented as semantic classes in `globals.css` (inside `@layer components`, after `.btn` so overrides win by source order).

### Container — `.container-hero`
- Fluid width, hard cap **1800px**, gutters `clamp(20px, 4vw, 64px)`.
- Shared by **nav, hero, and proof strip only** — all three align to the same edges. Body sections intentionally remain on `.container-x` (1180px).
- Result: ~1672px of content at 2560; capped at 1800px on 3440+ (no 4K stretch).

### Scales (all `clamp(min, fluid, max)`)
| Element | Class / rule | 390 phone | 768 tablet | 1440 laptop | 2560 desktop | 3440 ultrawide |
|---|---|---|---|---|---|---|
| Hero headline | `.hero-display` = `clamp(2.375rem, 1.05rem + 4.11vw, 8rem)` | 38px | ~48px | ~76px | ~122px | 128px (cap) |
| Headline measure | `max-w-[20ch]` on the `h1` | fits | ~2 lines | ~2 lines | ~2 lines | ~2 lines |
| Hero caption | `.hero-caption` font `clamp(1.125rem, 0.55rem + 1.2vw, 1.75rem)` | 18px | ~19px | ~26px | 28px (cap) | 28px (cap) |
| Caption width | `clamp(22rem, 34vw, 30rem)` incl. padding | 352px | 352px | 480px (cap) | 480px | 480px |
| CTAs (hero + nav) | `.hero-cta`: height `clamp(2.75rem, 2.4rem + 0.9vw, 3.5rem)`, label `clamp(0.95rem, 0.78rem + 0.45vw, 1.25rem)` | 44px / 15.2px | ~47px | ~51px / 19px | 56px / 20px (cap) | 56px / 20px |
| Nav | `h-16`, `2xl:h-[4.75rem]`; links `text-sm`, `2xl:text-base`; logo `1.2rem` → `2xl:1.4rem` | 64px | 64px | 64px | 76px | 76px |
| Proof/utility | `text-sm`, `2xl:text-base` (≥14px everywhere — no microscopic labels) | 14px | 14px | 14px | 16px | 16px |

### Hero vertical extent
- Below `lg`: content-driven (no forced viewport height); `md:min-h-[560px]` floor.
- `lg`+: `min-h-[min(90svh, 900px)]` — cinematic stage that **caps at 900px** on tall/wide screens so `justify-between` yields deliberate skyline breathing space, never an endless empty middle. (1460×800 → 720px, balanced; 2560×1440 / 3440×1440 → 900px.)

### Caption contrast rule (locked)
- `.hero-caption` = pure **#FFFFFF** on fully opaque **`--paper` #0A0A0C** → **19.8:1**, independent of photo brightness and of any scrim percentage. 1px `--line` border, 0.65rem radius (matches `.btn`), 16–24px padding, left-aligned, stacks below the CTA group below `lg`.

### Invariants
- No blanket browser-style zoom; body sections keep their approved scale.
- Mobile 320/390 unchanged: content-driven heights, full-width stacked CTAs, ≥44px targets, no overflow.
- Mumbai photo, copy, fonts, scrim strategy, and section order untouched.
