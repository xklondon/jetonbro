# Poker racetrack geometry audit (Part 1)

Starting HEAD: `b80dc6737e0c99adb22714cbf625800eccff7d7a`  
Authority: `design/reference/tabletop/approved/poker-premium-racetrack.png`  
Audited from live DOM/CSS on `b80dc67` before any rebuild edits.  
Failing reference capture: `docs/screenshots/tabletop/poker-racetrack-composition/04-players-preflop-owner-390x844.png`

## Computed geometry model (current)

| Element | Positioning | Key rules |
|---|---|---|
| `.tt-poker-table` | `flex: 1; width: 100%; overflow: hidden` | Fills leftover viewport between header and dock — typically **wide and short** |
| `.tt-poker-racetrack` | `inset: 2% 3% 4%` | Stretches to that wide/short box |
| `.tt-poker-wood` / leather / felt | `border-radius: 50% / 46%` | Ellipse follows container aspect → **landscape oval** when box is landscape |
| Seats | `left/top %` via `pokerSeatPosition` + `translate(-50%,-50%)` | Radii ~32–40% of **table box**, not of a portrait felt |
| Seat size | `width: min(28vw, 100px)` | Viewport-relative; independent of table rectangle |
| Table name | `top: 28%` absolute | No reserved centre column |
| Pot | `top: 42%` absolute; chips+POT+amount+TO CALL in one stack | No vertical zone slots |
| Phase track | `top: 68%; width: min(78%, 280px)` | Crosses lower felt / viewer seat |
| Viewer seat (4p) | ~`left:50%; top:87%` | Extends upward into track; clipped by `overflow: hidden` |

## Specific failure answers

### 1. Why the table became a wide landscape oval
The racetrack has **no portrait aspect-ratio**. It fills leftover height after header + owner dock + tray. On 390×844 that leftover is roughly ~390×(380–420) → aspect ≈ 1:1 or wider. `border-radius: 50% / 46%` then renders a **broad horizontal ellipse**, unlike the authority’s tall portrait racetrack.

### 2. Why the top seat overlaps the table name and pot
Top seat centre ≈ `top: 13%` (4p: `50 − 37`). Seat medal+ledger extend ~70–90px downward into `top: 28%` name and `top: 42%` pot. There is **no centre safe zone** and seats are placed as % of the full table box, so medallions sit *on* the felt interior instead of on the rail.

### 3. Why the viewer seat overlaps the phase track and is clipped
Viewer centre ≈ `top: 87%`. Track at `top: 68%` with padding. Seat medal/ledger span upward into the track band. Table `overflow: hidden` clips the bottom of the viewer seat against the dock.

### 4. Why POT, chips and TO CALL collide
One absolute `.tt-pot` at `42%` stacks ChipStack + `POT` + amount + `TO CALL` with only `gap: 2px`. Name at `28%` also competes. No reserved sub-zones.

### 5. Why the phase sequence crosses seats and blind markers
Track is a wide absolute band (`width: min(78%, 280px)` at `68%`) with no exclusion of perimeter seat radii. Side/bottom seats and their D/SB/BB markers share that Y-range.

### 6. Which selectors / media queries created this geometry
Primary: `.tt-poker-table`, `.tt-poker-racetrack`, `.tt-poker-wood|leather|felt-disk`, `.tt-poker-felt-name`, `.tt-pot`, `.tt-streets`, `.tt-seat`, `pokerSeatPosition` / `pokerWagerPosition`.  
Media `@media (max-width: 360px)` only shrinks seat/medal/track font — **does not fix coordinate system**.

### 7. Old selectors still active?
Obsolete `.tt-poker-oval` / `.tt-poker-rim` removed. Failure is **not** leftover oval overrides — it is the new racetrack CSS still using a **viewport leftover box + independent %/vw placement** instead of one contained portrait coordinate system.

## Required rebuild (coordinate contract)

- One relatively positioned portrait stage with `--poker-w`, `--poker-h`, `--poker-seat`, `--poker-safe-*`
- Aspect-ratio locked to portrait racetrack (~0.68–0.78 W/H)
- Seats on perimeter anchors outside centre safe zone
- Centre: name / chips / pot / to-call / track as stacked reserved zones
- Dock + tray compact below stage; no document scroll

## After rebuild (implementation notes)

| Item | After |
|---|---|
| Stage | `.tt-poker-stage` `aspect-ratio: 66/100`, `width: min(100%, 21.5rem)` |
| Centre | `.tt-poker-centre` grid with `data-poker-zone` name/pot/track |
| Seats | Perimeter % of stage + `data-seat-edge` north/south transform hang |
| Pot | Sub-zones chips / amount / call |
| Obsolete | No `.tt-poker-oval` / `.tt-poker-rim`; absolute pot/track % removed |

### Honest MATCH status

**Not a literal MATCH** to the authority PNG. Portrait coordinate system and non-overlap geometry are fixed vs the landscape fail; materials, track label density, dock chrome, and HU vertical packing still lag the photographic authority.
