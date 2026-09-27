---
name: INE Price Tracker
description: Monochrome ink-on-paper operations dashboard for honest mock-store price and stock history.
colors:
  ink: "#0A0A0A"
  ink-hover: "#262626"
  ink-muted: "#4A4A4A"
  ink-faint: "#6B6B6B"
  ink-soft: "#A3A3A3"
  surface: "#FFFFFF"
  tile: "#F4F4F4"
  tile-deep: "#EAEAEA"
  canvas: "#EBEBEB"
  line: "#E4E4E4"
  ok: "#12784F"
  ok-wash: "#E6F6EF"
  warn: "#8F5409"
  warn-wash: "#FDF3E3"
  bad: "#C8313F"
  bad-wash: "#FCEBEC"
typography:
  display:
    fontFamily: "Urbanist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 3.2vw, 2.5rem)"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Urbanist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 2.6vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  figure:
    fontFamily: "Urbanist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  title:
    fontFamily: "Urbanist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Urbanist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Urbanist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.33
rounded:
  pill: "9999px"
  control: "16px"
  panel: "22px"
  sheet: "28px"
  frame: "32px"
spacing:
  gap: "20px"
  section: "32px"
  panel-pad: "20px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
  panel-hero:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  panel-accent:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "20px"
  card:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "48px 20px 20px"
  medallion:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    size: "56px"
  segmented-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "12px"
  input-search:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "56px"
---

# Design System: INE Price Tracker

## Overview

**Creative North Star: "The Ink Ledger"**

A white app frame on a pale gray canvas. The sidebar is pure black, content sits on soft gray tiles, and every action is a black pill. Black, white and gray carry the whole identity, so the only colour on screen is data: green, amber and red outcomes, and the red overdue zone. Colour therefore always means something happened.

The mood is calm, editorial and confident: big black numerals, bold titles, generous tiles. Depth is almost flat. Tiles are distinguished by tone, not shadow, and only white medallions and lifted cards cast a soft shadow.

**Key Characteristics:**
- Black, white and grays only; colour is reserved for status.
- Black sidebar, black primary buttons, one black accent block per cluster.
- Gray tiles on a white frame, with white medallions and chips on the tiles.
- Big bold figures in Urbanist with tabular numerals.
- One authored motion moment on load.

## Colors

Strict monochrome plus a status triad.

### Primary
- **Ink** (ink): sidebar, primary buttons, active segmented tab, the raised middle stat cell, the "Read in last run" block, the modal header band, the chart line, and the cadence fill and marker.
- **Ink Hover** (ink-hover): hover state for black buttons.
- **Soft Ink** (ink-soft): secondary text on black (7.9:1).

### Neutral
- **Surface** (surface): app frame, modal sheets, medallions, chips on tiles.
- **Tile** (tile): cards, hero panel, rail, fields. **Tile Deep** (tile-deep): the stat band and tile hover.
- **Canvas** (canvas): page background outside the frame.
- **Muted Ink / Faint Ink** (ink-muted, ink-faint): secondary and tertiary text; faint ink stays ≥4.5:1 on tile.
- **Hairline** (line): dividers.

### Named Rules
**The Colour Is Data Rule.** Only ok, warn and bad (with their washes) may add hue. Never introduce a brand colour.

**The One Black Block Rule.** Within a cluster, one black block anchors it (the raised stat cell, the last-run card). Everything else stays gray or white.

## Typography

**Display Font:** Urbanist Variable, self-hosted via @fontsource-variable (with ui-sans-serif fallback)
**Body Font:** Urbanist Variable

**Character:** A rounded geometric sans that is friendly at bold display weights and still crisp at 12 px.

### Hierarchy
- **Display** (700, clamp 1.75–2.5rem, -0.02em): the hero schedule headline ("Next run in 1h 22m").
- **Headline** (700, clamp 1.75–2.25rem, -0.025em): the page title.
- **Figure** (700, 1.875rem, tnum): prices and stat values.
- **Title** (700, 1.125rem): card titles and section headings (section headings use 1.25rem).
- **Body** (500, 0.875rem): descriptions, capped at 60–65ch.
- **Label** (600, 0.75rem): stat labels, pills, axis labels. Always sentence case, never uppercase.

### Named Rules
**The Tabular Figures Rule.** Every price, count, percentage, and table cell uses tabular numerals.

**The No Eyebrow Rule.** Meta lines (brand · category · id) sit below the title, never above it.

## Layout

At lg and up, the frame (max 1640px, 24px inset, 32px radius) holds three columns: the 76px black sidebar, the main column, and a 320px rail at xl for Latest readings. Below lg, the rail becomes a horizontal black bar at the top. Below xl, the readings rail stacks after the content. The hero splits 1.75fr / 1fr at xl. Variant cards auto-fill at a 260px minimum, with a 20px column gap and a 24px row gap (plus the 28px medallion overhang). Sections are separated by 32px, and panels are 20px apart.

## Elevation & Depth

Nearly flat: tiles separate from the white frame by tone alone. Shadows appear only on white medallions, hovered cards, the tooltip and the frame, and every shadow has an offset.

### Shadow Vocabulary
- **Card** (`0 1px 2px rgba(10,10,10,.04), 0 6px 18px -8px rgba(10,10,10,.12)`): white medallions and icon chips on tiles.
- **Lift** (`0 2px 4px rgba(10,10,10,.05), 0 18px 36px -14px rgba(10,10,10,.22)`): hovered cards (which also turn white), the sidebar, bubbles.
- **Frame** (`0 30px 80px -30px rgba(10,10,10,.25)`): the app frame and modal sheets.

## Shapes

Generously rounded. Panels and cards use 22px, controls and medallions 16px, sheets 28px, and the frame 32px. Pills are reserved for chips and status. Only the cadence track uses geometric linework.

## Components

### Buttons
- **Shape:** 16px radius.
- **Primary:** Ink with white semibold text and no shadow; hover goes to Ink Hover. Disabled is neutral-300 with muted ink text.
- **Secondary:** tile background with ink text; hover goes to Tile Deep.
- **Icon rail buttons:** 44px squares on the black sidebar with white icons. Hover adds a white/15 fill, and a dark tooltip appears to the right.

### Chips
- **Outcome pill:** wash background, status-coloured text, and a 6px dot.
- **Stock pill:** white for in stock, warn wash for low stock, bad wash for sold out.
- **Tracked badge:** black pill with white text.

### Cards / Containers
- **Variant card:** tile, 22px radius, no shadow at rest. On hover it turns white, lifts 2px and gains the Lift shadow. A 56px white medallion with a black icon overlaps the top edge by 28px. Below come the price figure, a 6px success-rate bar (ink at ≥90%, warn at ≥60%, bad below that, on a black/10 track), and the stock pill.

### Inputs / Fields
- **Search:** tile, 16px radius, leading search icon. On focus it shows a 2px ink ring with an ink caret; the clear button is forced to black.

### Navigation
- **Segmented control:** a white track (or tile inside white sheets) with a 4px inset. The active tab is Ink.

### Cadence Track (signature)
A 0–3 h rail on the gray hero, drawn on a black/10 track. Ticks mark due at 2h and overdue at 2.5h, with their labels 12px below. The overdue zone is bad-dot at 25%. The fill and marker are ink, and turn bad-dot when the run is overdue. A black bubble above the marker reads the time since the last run. The fill and marker travel in from zero over 900ms with an expo-out curve, and reduced motion disables this.

## Do's and Don'ts

### Do:
- **Do** show failures as failures: gaps plus red dashed markers in charts, and error codes in logs.
- **Do** keep secondary text on black at Soft Ink or white.
- **Do** keep motion to the single load moment plus sheet and scrim entrances.

### Don't:
- **Don't** use gradients, glass, or dark mode.
- **Don't** add a brand hue; black, white and gray are the brand.
- **Don't** smooth chart lines (no monotone curves) or carry prices across failures.
- **Don't** fade whole cards to show a state; use a pill.
