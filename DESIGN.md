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
  line: "#E4E4E4"
  ok: "#12784F"
  ok-wash: "#E6F6EF"
  warn: "#8F5409"
  warn-wash: "#FDF3E3"
  bad: "#C8313F"
  bad-wash: "#FCEBEC"
typography:
  headline:
    fontFamily: "Urbanist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  figure:
    fontFamily: "Urbanist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  title:
    fontFamily: "Urbanist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
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
spacing:
  gap: "20px"
  section: "32px"
  panel-pad: "20px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "12px"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "16px"
  icon-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "8px"
    size: "36px"
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

A full-bleed white page with no window frame. The sidebar is pure black, content sits on soft gray tiles, and every action is a black pill. Black, white and gray carry the whole identity, so the only colour on screen is data: green, amber and red outcomes, and the red overdue zone. Colour therefore always means something happened.

The mood is calm and operational: a KPI strip, a chart, a schedule panel and dense tables, all in white bordered panels with big black numerals and tabular figures. Depth is flat; panels separate by a 1px neutral border, never by shadow.

**Key Characteristics:**
- Black, white and grays only; colour is reserved for status.
- Black sidebar and black primary buttons.
- White bordered panels on a full-bleed white page; gray only for table headers, hover and chips.
- Big bold figures in Urbanist with tabular numerals.
- One authored motion moment on load.

## Colors

Strict monochrome plus a status triad.

### Primary
- **Ink** (ink): sidebar, primary buttons, active segmented tab, bars at ≥90% success, the modal header band, the price chart line, and the cadence fill and marker.
- **Ink Hover** (ink-hover): hover state for black buttons.
- **Soft Ink** (ink-soft): secondary text on black (7.9:1).

### Neutral
- **Surface** (surface): page background, panels, modal sheets, icon chips.
- **Tile** (tile): table header rows, row hover, KPI icon chips, segmented track. **Tile Deep** (tile-deep): pressed/hover on tile.
- **Muted Ink / Faint Ink** (ink-muted, ink-faint): secondary and tertiary text; faint ink stays ≥4.5:1 on tile.
- **Hairline** (line): dividers.

### Named Rules
**The Colour Is Data Rule.** Only ok, warn and bad (with their washes) may add hue. Never introduce a brand colour.

## Typography

**Display Font:** Urbanist Variable, self-hosted via @fontsource-variable (with ui-sans-serif fallback)
**Body Font:** Urbanist Variable

**Character:** A rounded geometric sans that is friendly at bold display weights and still crisp at 12 px.

### Hierarchy
- **Headline** (700, 1.5rem, -0.02em): the page title and the schedule headline ("Next run in 1h 22m").
- **Figure** (700, 1.875rem, tnum): KPI values.
- **Title** (700, 1rem): panel titles.
- **Body** (500, 0.875rem): descriptions, capped at 60–65ch.
- **Label** (600, 0.75rem): stat labels, pills, axis labels. Always sentence case, never uppercase.

### Named Rules
**The Tabular Figures Rule.** Every price, count, percentage, and table cell uses tabular numerals.

**The No Eyebrow Rule.** Meta lines (brand · category · id) sit below the title, never above it.

## Layout

The dashboard fills the viewport edge to edge on a white page, with 24px padding at lg (12–20px below). Main column order: header row (title, search) → KPI strip → success-rate chart beside the schedule panel → tracked-variants card grid → catalogue table. Panels are 20px apart. At lg and up it holds three columns: the 76px black sidebar, the main column, and a 320px rail at xl for Latest readings. Below lg, the sidebar becomes a horizontal black bar at the top. Below xl, the readings rail stacks after the content.

## Elevation & Depth

Flat: panels are separated by a 1px neutral-200 border. Shadows appear only on the sidebar, tooltips and modal sheets, and every shadow has an offset.

### Shadow Vocabulary
- **Lift** (`0 2px 4px rgba(10,10,10,.05), 0 18px 36px -14px rgba(10,10,10,.22)`): the sidebar, bubbles, tooltips.
- **Frame** (`0 30px 80px -30px rgba(10,10,10,.25)`): modal sheets.

## Shapes

Softly rounded: panels 16px, controls 12px, icon chips 8px, sidebar 22px, sheets 28px. The page itself is never framed or rounded. Pills are reserved for chips and status. Only the cadence track uses geometric linework.

## Components

### Buttons
- **Shape:** 12px radius.
- **Primary:** Ink with white semibold text and no shadow; hover goes to Ink Hover. Disabled is neutral-300 with muted ink text.
- **Secondary:** tile background with ink text; hover goes to Tile Deep.
- **Icon rail buttons:** 44px squares on the black sidebar with white icons. Hover adds a white/15 fill, and a dark tooltip appears to the right.

### Chips
- **Outcome pill:** wash background, status-coloured text, and a 6px dot.
- **Stock pill:** white for in stock, warn wash for low stock, bad wash for sold out.
- **Tracked badge:** black pill with white text.

### Cards / Containers
- **Panel:** white, 1px neutral-200 (#E5E5E5) border, 16px radius, no shadow. A header row (title + one-line caption left, actions right) sits above a neutral-200 divider. Shared as `panel` / `panelHeader` in `frontend/src/ui.ts`.
- **KPI tile:** panel with label and a tile-gray icon chip on top, a 30px figure, and one caption line. Four across at xl, two below.
- **Variant card:** a panel (p-16px) that turns its border ink on hover: tile icon chip + name + brand · category, a variant chip, a 24px price beside the outcome pill, a success-rate bar, and a footer (scrapes · last read, stock pill) above a divider. Auto-fills at a 250px minimum with 16px gaps.
- **Data tables:** tile-gray header row with 12px semibold faint-ink labels, neutral-200 row dividers, tile hover, tabular numerals. Tables scroll horizontally on small screens instead of reflowing.

### Inputs / Fields
- **Search:** tile, 16px radius, leading search icon. On focus it shows a 2px ink ring with an ink caret; the clear button is forced to black.

### Navigation
- **Segmented control:** a white track (or tile inside white sheets) with a 4px inset. The active tab is Ink.

### Cadence Track (signature)
A 0–3 h rail inside the Scrape schedule panel, drawn on a black/10 track. Ticks mark 2h (due) and 2.5h (overdue), with short numeric labels below. The overdue zone is bad-dot at 25%. The fill and marker are ink, and turn bad-dot when the run is overdue. A black bubble above the marker reads the time since the last run. The fill and marker travel in from zero over 900ms with an expo-out curve, and reduced motion disables this.

## Do's and Don'ts

### Do:
- **Do** show failures as failures: gaps plus red dashed markers in charts, and error codes in logs.
- **Do** keep secondary text on black at Soft Ink or white.
- **Do** put every dashboard block in a `panel` with a header row; show tracked variants as a card grid and reference data (catalogue, logs) as tables.
- **Do** keep motion to the single load moment plus sheet and scrim entrances.

### Don't:
- **Don't** use gradients, glass, or dark mode.
- **Don't** add a brand hue; black, white and gray are the brand.
- **Don't** smooth chart lines (no monotone curves) or carry prices across failures.
- **Don't** fade whole cards to show a state; use a pill.
