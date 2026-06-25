# GameLead Radar Design System

This document describes the design system currently implemented in the codebase. Its primary purpose is to let a new project reproduce a UI that feels consistent with GameLead Radar.

Use this as a build contract, not inspiration. A new project should copy the tokens, Tailwind setup, layout primitives, component classes, and interaction patterns below before creating new screens. Do not redesign the application, introduce a new palette, invent a new spacing scale, or replace the operational dashboard style with a marketing or landing-page style.

Source of truth inspected:

- `src/app/globals.css`
- `postcss.config.mjs`
- `src/app/layout.tsx`
- `src/components/shell.tsx`
- `src/components/sidebar-nav.tsx`
- UI-heavy pages and components in `src/app/**` and `src/components/**`
- Inline component styling used by Material UI checkboxes and a few localized layout overrides

## 0. New Project Bootstrap

For a new project, implement this design system in this order.

1. Install Tailwind CSS v4 with PostCSS.

```bash
npm install -D tailwindcss @tailwindcss/postcss postcss autoprefixer
```

2. Add `postcss.config.mjs`.

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {}
  }
};

export default config;
```

3. Create a global stylesheet that imports Tailwind, defines the exact theme tokens, and uses Tailwind layers.

```css
@import "tailwindcss";

@theme {
  --color-bg: #f6f7f9;
  --color-panel: #ffffff;
  --color-ink: #0f172a;
  --color-muted: #667085;
  --color-line: #d7dce3;
  --color-accent: #0f766e;
  --color-accent-dark: #115e59;
  --color-warn: #b45309;
  --color-danger: #b91c1c;
  --color-ok: #15803d;
  --font-sans: var(--font-inter, "Inter"), sans-serif;
  --shadow-paper-edge: 0 5px 22px rgba(0, 0, 0, 0.04),
    0 0 0 1px rgba(0, 0, 0, 0.06);
}

@layer base {
  :root {
    --bg: #f6f7f9;
    --panel: #ffffff;
    --ink: #0f172a;
    --muted: #667085;
    --line: #d7dce3;
    --accent: #0f766e;
    --accent-dark: #115e59;
    --warn: #b45309;
    --danger: #b91c1c;
    --ok: #15803d;
    --paper-edge: 0 5px 22px rgba(0, 0, 0, 0.04),
      0 0 0 1px rgba(0, 0, 0, 0.06);
    --font-family: var(--font-inter, "Inter"), sans-serif;
  }

  * {
    @apply box-border;
  }

  body {
    @apply m-0 bg-bg text-[14px] text-ink;
    font-family: var(--font-family);
  }

  a {
    @apply text-inherit;
  }

  button,
  input,
  select,
  textarea {
    font: inherit;
  }
}
```

4. Add the shared component classes from this document in `@layer components` before building screens. The minimum required classes for a consistent new project are:

- Shell and navigation: `.app-shell`, `.sidebar`, `.brand`, `.nav`, `.nav-group`, `.nav-group-label`, `.main`, `.topbar`
- Surfaces: `.panel`, `.card`, `.stat`, `.table-wrap`, `.table-scroll`
- Actions: `.button`, `.button.secondary`, `.button.danger`, `.icon-button`, `.actions`
- Forms: global `label`, `input`, `select`, `textarea`, `.form-grid`, `.form-actions`, `.field-group`, `.field-note`
- Tables: base `table`, `th`, `td`, sticky table headers, `.table-subheader-row`, `.table-subheader-cell`, `.selected-row`, `.clickable-row`, `.truncate-cell`
- Feedback: `.badge`, `.notice`, `.notice.warning`, `.snackbar`, `.loading-backdrop`, `.loading-modal`, `.loading-spinner`
- Modals: `.modal-backdrop`, `.modal`, `.modal-header`, `.modal-body`, `.modal-footer`, `.modal-scroll`

5. Build the first screen as an operational app screen, not a landing page. Use a left sidebar, a compact topbar title/subtitle, white work surfaces, dense tables, and functional action buttons.

### New Project Fidelity Checklist

A new project matches this design when these checks are true:

- The first viewport shows an app workspace, not a marketing hero.
- The page background is `#f6f7f9`; work surfaces are white.
- Primary actions are teal `#0f766e`; destructive actions are red `#b91c1c`.
- Text uses Inter, `14px` body copy, `24px` page titles, and `18px` to `20px` section/modal titles.
- Rectangular controls and surfaces use `8px` radius.
- Raised surfaces use `shadow-paper-edge` / `--paper-edge`.
- Desktop layout uses a `264px` left sidebar and `32px 24px` main padding.
- Dense data tables use white framed scroll containers, sticky headers, muted `13px` header text, `14px 16px` cell padding, and pale teal hover/selected rows.
- Modals use the documented backdrop, widths, sticky header, and `#f8fafc` footer.
- Responsive behavior collapses the sidebar and multi-column layouts at `920px`.

## 1. Design Overview

GameLead Radar uses a restrained operational dashboard style. The UI is dense, practical, table-forward, and focused on repeated administrative work: collecting leads, reviewing articles, managing sources, composing emails, and changing automation settings.

The dominant visual characteristics are:

- Light gray application background with white raised work surfaces.
- Persistent left sidebar navigation on desktop.
- Compact typography using Inter.
- Teal primary actions and teal-tinted success or active states.
- Neutral gray borders and muted helper text.
- Dense tables with sticky headers, selected-row states, and compact action bars.
- Modals for focused workflows such as filters, confirmations, previews, and email compose.
- Minimal decoration. Icons are used functionally through `lucide-react`.

The inferred design philosophy is operational clarity: surfaces should be scannable, actions should be obvious, and pages should prioritize the working interface over marketing-style presentation.

Tailwind CSS is now the styling system going forward. The app keeps its existing semantic class names for stability, but those styles are organized inside Tailwind layers in `src/app/globals.css`. New UI should prefer Tailwind utility classes and shared component classes from `@layer components` instead of adding unrelated vanilla CSS.

Current Tailwind entry:

```css
@import "tailwindcss";

@theme {
  --color-bg: #f6f7f9;
  --color-panel: #ffffff;
  --color-ink: #0f172a;
  --color-muted: #667085;
  --color-line: #d7dce3;
  --color-accent: #0f766e;
  --color-accent-dark: #115e59;
  --color-warn: #b45309;
  --color-danger: #b91c1c;
  --color-ok: #15803d;
  --font-sans: var(--font-inter, "Inter"), sans-serif;
  --shadow-paper-edge: 0 5px 22px rgba(0, 0, 0, 0.04),
    0 0 0 1px rgba(0, 0, 0, 0.06);
}
```

## 2. Color System

### Tailwind Theme Tokens And CSS Variables

Color tokens are defined twice for compatibility:

- Tailwind v4 theme tokens in `@theme`, which generate utilities such as `bg-bg`, `text-ink`, `border-line`, `bg-accent`, and `shadow-paper-edge`.
- Legacy CSS variables in `:root`, which keep existing semantic component classes working.

| Variable | Value | Usage |
| --- | --- | --- |
| `--bg` | `#f6f7f9` | Body/page background |
| `--panel` | `#ffffff` | Panels, cards, loading modal background |
| `--ink` | `#0f172a` | Primary text, icon buttons, form text |
| `--muted` | `#667085` | Secondary text, labels, table headers, helper text |
| `--line` | `#d7dce3` | Borders, table dividers, form control borders |
| `--accent` | `#0f766e` | Primary buttons, active tabs, selected checkbox color, switch enabled state |
| `--accent-dark` | `#115e59` | Teal text on pale teal backgrounds |
| `--warn` | `#b45309` | Warning badges, warning notices, blocked automation state |
| `--danger` | `#b91c1c` | Danger buttons, failed badges, error text |
| `--ok` | `#15803d` | Success badges and completed states |

### Core Colors

| Color | Usage examples | Components |
| --- | --- | --- |
| `#f6f7f9` | Application background | `body` |
| `#ffffff`, `#fff` | Raised surfaces, sidebar, tables, inputs, modals, secondary buttons | `.panel`, `.card`, `.table-wrap`, `.modal`, `.button.secondary`, inputs |
| `#0f172a` | Primary text | `body`, detail values, buttons with secondary variant |
| `#667085` | Muted text | Labels, helper copy, table headers, secondary metadata |
| `#d7dce3` | Standard border | Inputs, tables, modals, segmented tabs |
| `#0f766e` | Primary action teal | `.button`, active segmented tab, MUI checkbox checked state |
| `#115e59` | Dark teal foreground | `.badge`, row links, automation bar text |

### Navigation Colors

| Color | Usage examples | Components |
| --- | --- | --- |
| `#E3E3E5` | Sidebar right border | `.sidebar` |
| `#4E4E4E` | Sidebar labels and nav text | `.nav-group-label`, `.nav a` |
| `#F2F2F2` | Nav item hover | `.nav a:hover` |
| `#EBEBEB` | Active nav item | `.nav a.active` |

### Teal And Selection Colors

| Color | Usage examples | Components |
| --- | --- | --- |
| `#99d8ca` | Teal borders | automation bar, placeholder tokens, package chips |
| `#e6f6f2` | Pale teal background | automation status, package chips, recipient pills |
| `#def1f0` | Stat icon background | `.stat-icon` |
| `#edf7f4` | Table row hover and selected row | `.clickable-row:hover`, `.selected-row`, export menu hover |
| `#e7f3ef` | Default badge background | `.badge` |
| `#effaf7` | Notice background | `.notice` |
| `#a7e3d6` | Notice border | `.notice` |
| `#075f55` | Notice text | `.notice` |
| `#f8fbf9` | Template preview and placeholder list background | `.template-preview`, `.settings-placeholder-list` |

### Status Colors

| Color | Usage examples | Components |
| --- | --- | --- |
| `#dcfce7` | Grade A, success, completed background | `.badge.grade-a`, `.badge.status-ok`, `.badge.status-completed` |
| `#bbf7d0` | Grade A score chip border | `.grade-score-chip.grade-a` |
| `#e0f2fe` | Grade B background | `.badge.grade-b` |
| `#bae6fd` | Grade B score chip border | `.grade-score-chip.grade-b` |
| `#0369a1` | Grade B text | `.badge.grade-b` |
| `#fef3c7` | Grade C, warning, processing background | `.badge.grade-c`, `.badge.status-warning`, `.badge.status-processing` |
| `#fde68a` | Grade C score chip border | `.grade-score-chip.grade-c` |
| `#fee2e2` | Grade D, danger, failed background | `.badge.grade-d`, `.badge.status-failed`, `.snackbar-error` |
| `#fecaca` | Error border | `.operation-error-card`, `.loading-error`, danger status chips |
| `#FED7AA` | Blocked automation border | `.automation-status-bar.status-blocked` |
| `#FFF7ED` | Blocked automation background | `.automation-status-bar.status-blocked` |
| `#fff7e6` | Blocked automation summary icon background | `.automation-summary-success-icon.status-blocked` |
| `#fff8eb` | Warning notice background | `.notice.warning` |
| `#f6c56f` | Warning notice border | `.notice.warning` |
| `#fff7f7` | Operation error card background | `.operation-error-card` |
| `#7f1d1d` | Operation error card text | `.operation-error-card` |
| `#991b1b` | Snackbar error text, danger hover | `.snackbar-error`, `.button.danger:hover` |

### Neutral And Utility Colors

| Color | Usage examples | Components |
| --- | --- | --- |
| `#536275` | Topbar subtitle and select chevron stroke | `.topbar p`, `select` background SVG |
| `#f8fafc` | Table headers, modal footers, form panels, secondary hover | `th`, `.modal-footer`, `.settings-panel-footer`, `.button.secondary:hover` |
| `#cbd5e1` | Switch off state, secondary button hover border | `.switch-track`, `.button.secondary:hover` |
| `#8a8f98` | Custom scrollbar thumb | template and compose textareas |
| `#eef2f6` | Neutral contact value pill | `.contact-value-pill.neutral` |
| `#e5e7eb` | Attachment remove hover | `.attachment-pill button:hover` |
| `#17201a` | Source article button | `.source-article-button` |
| `#1e1e1e` | Success snackbar background | `.snackbar-success` |
| `#000000` | Success snackbar border | `.snackbar-success` |
| `#ffffff` | Success snackbar text | `.snackbar-success` |

### Transparent / Shadow Colors

| Value | Usage |
| --- | --- |
| `rgba(0, 0, 0, 0.04)` | Part of `--paper-edge` |
| `rgba(0, 0, 0, 0.06)` | Part of `--paper-edge`, modal ring |
| `rgba(15, 23, 42, 0.08)` | Stat and summary icon shadows |
| `rgba(15, 23, 42, 0.12)` | Export menu shadow |
| `rgba(15, 23, 42, 0.18)` | Snackbar and loading modal shadow |
| `rgba(15, 23, 42, 0.22)` | Switch thumb shadow |
| `rgba(16, 35, 31, 0.42)` | Standard modal backdrop |
| `rgba(16, 35, 31, 0.5)` | Loading backdrop |
| `rgba(16, 35, 31, 0.22)` | Modal shadow |
| `rgba(255, 255, 255, 0.55)` | Commented automation button hover |

Implementation note: `.snackbar` references `var(--surface)` and `var(--text)`, but these variables are not defined in `:root`. The active snackbar variants override them with concrete colors. Do not use `--surface` or `--text` as design tokens unless they are defined.

## 3. Typography

### Font Family

Inter is loaded through Next font in `src/app/layout.tsx`.

```tsx
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});
```

The global font token is:

```css
--font-family: var(--font-inter, "Inter"), sans-serif;
```

All `button`, `input`, `select`, and `textarea` elements inherit the page font.

### Font Sizes

| Size | Usage |
| --- | --- |
| `42px` | Dashboard stat values |
| `30px` | Automation summary card values |
| `24px` | Page title in `.topbar h1` |
| `20px` | Modal headers, loading modal title, settings section heading |
| `18px` | Panel headings, compose modal headings, settings panel headings |
| `16px` | Brand, stat labels |
| `14px` | Body default, table body, buttons, panel subtitles, form values, notices |
| `13px` | Table headers, labels, helper text, segmented tabs, automation bar, field notes |
| `12px` | Badges, nav group labels, compact metadata |

### Font Weights

| Weight | Usage |
| --- | --- |
| `700` | Brand, page title, table headers, badges, section chips |
| `600` | Some metadata and pills |
| `500` | Buttons, segmented tabs, stat values, detail emphasis |
| `400` | Nav items, standard body, detail values, settings list labels |

### Line Heights

Common line heights:

- `1`: dashboard stat values and summary values.
- `1.2`: buttons and recipient pills.
- `1.25`: compact metadata, pills, source URLs.
- `1.35`: detail list rows and field notes.
- `1.4`: snackbar text.
- `1.45`: panel subtitles, notices, settings copy.
- `1.5`: long detail text and evidence rows.
- `1.55`: email template previews and email body previews.
- `1.6`: operation error text.

### Heading Styles

| Element / class | Style |
| --- | --- |
| `.topbar h1` | `24px`, `700`, margin `0` |
| `.panel h2` | `18px`, margin `0 0 16px` |
| `.settings-section-heading h2` | `20px`, margin `0` |
| `.modal-header h2` | `20px`, margin `0` |
| `.compose-modal-header h2` | `18px`, margin `0 0 4px` |
| `.loading-modal-body h2` | `20px`, centered, margin `4px 0 0` |

## 4. Spacing System

The codebase does not define custom spacing tokens. Tailwind's arbitrary value utilities and default spacing scale are used going forward, while the existing semantic component classes preserve exact implemented measurements. The dominant scale is compact and mostly follows 4px increments.

### Most Common Spacing Values

| Value | Usage examples |
| --- | --- |
| `0` | Reset margins, panel variants, hidden inputs |
| `1px` | Hidden checkbox/file inputs |
| `3px` | Nav group internal gap, switch thumb offset |
| `4px` | Topbar subtitle margin, compact token padding, mobile detail label split |
| `5px` | Spinner border, summary value margin |
| `6px` | Label gap, placeholder list gap, small chip padding |
| `8px` | General action gaps, field groups, badge gaps, table checkbox hit area support |
| `9px` | Recipient/package chip horizontal padding |
| `10px` | Button/nav gaps, form action gaps, filter gaps, input padding top/bottom |
| `11px` | Settings detail list vertical padding |
| `12px` | Nav gap, table cell variants, modal footers, settings gaps, scrollbar width |
| `13px` | Notice horizontal padding |
| `14px` | Form grid gap, operation panels, snackbar gap, automation summary card gap |
| `16px` | Main content horizontal padding, grid gaps, panel heading margin, table cell horizontal padding, form grids |
| `18px` | Topbar gap, stat main gap, compose modal padding, modal preview margins |
| `20px` | Sidebar top/bottom padding, modal body top/bottom, modal header padding |
| `22px` | Panel padding, stat footer horizontal padding |
| `24px` | Main content horizontal padding, modal backdrop padding, modal body/footer horizontal padding, settings panel body |
| `26px` | Stat main vertical padding |
| `28px` | Stat main horizontal padding, loading modal body top padding, table subheader horizontal padding |
| `32px` | Main content top/bottom padding |

### Spacing Patterns

- Page content: `.main` uses `padding: 32px 24px`.
- Sidebar: `.sidebar` uses `padding: 20px 16px`.
- Panels: `.panel` uses `padding: 22px`.
- Settings panels: `.settings-panel-body` uses `padding: 24px`.
- Modal body: `.modal-body` uses `padding: 20px 24px`.
- Modal footer: `.modal-footer` uses `padding: 12px 24px`.
- Table cells: default `th, td` use `padding: 14px 16px`; sources table body cells use `12px 16px`.
- Button padding: `.button` uses `padding: 0 16px`.
- Common layout gap: `16px` for `.grid`, `.detail-layout`, `.email-log-page`, settings body, and table wrappers.

Conflicting pattern: several pages use inline `style={{ marginTop: 16 }}` and `style={{ marginBottom: 16 }}`. The dominant standard is still 16px for adjacent page sections and action spacing.

## 5. Layout Standards

### Application Shell

```css
.app-shell {
  display: grid;
  grid-template-columns: 264px minmax(0, 1fr);
  min-height: 100vh;
}
```

- Desktop shell uses a fixed `264px` sidebar.
- Main work area fills the remaining width with `minmax(0, 1fr)`.
- `.main` has `padding: 32px 24px` and `min-width: 0`.

### Sidebar

```css
.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  background: white;
  padding: 20px 16px;
  border-right: 1px solid #E3E3E5;
}
```

- Brand minimum height: `42px`.
- Nav items minimum height: `40px`.
- Nav item padding: `10px 12px`.
- Nav item radius: `8px`.
- Nav group gap: `3px`; nav section gap: `12px`.

### Page Header

`.topbar` uses flex layout:

- `justify-content: space-between`
- `align-items: center`
- `gap: 18px`
- `margin-bottom: 18px`

The current shell renders only the title/subtitle block; action slots are not part of the component.

### Grids

| Class | Layout |
| --- | --- |
| `.grid` | `display: grid; gap: 16px` |
| `.stats` | `repeat(3, minmax(180px, 1fr))` |
| `.form-grid` | `repeat(2, minmax(0, 1fr)); gap: 14px` |
| `.detail-layout` | `minmax(0, 1.1fr) minmax(320px, 0.9fr); gap: 16px` |
| `.operations-limit-row` | `repeat(3, minmax(220px, 1fr)); gap: 14px` |
| `.automation-schedule-row` | `repeat(2, minmax(160px, 1fr)); gap: 14px; max-width: 560px` |
| `.filters-modal-body` | `repeat(3, minmax(180px, 1fr)); gap: 18px 20px` |
| `.automation-summary-body` | `repeat(2, minmax(0, 1fr)); gap: 12px` |

### Content Widths

There is no global max-width wrapper. Pages use full available width inside `.main`, with component-specific constraints.

Important widths:

- Standard modal: `width: min(760px, 100%)`
- Compose modal: `width: min(720px, 100%)`
- Filters modal: `width: min(1120px, calc(100vw - 48px))`
- Email log modal: `width: min(920px, 100%)`
- Template preview modal: `width: min(900px, 100%)`
- Automation summary modal: `width: min(700px, 100%)`
- Loading modal: `width: min(420px, calc(100vw - 32px))`
- Snackbar: `width: min(320px, calc(100vw - 32px))`

### Table Widths And Scroll Areas

- `.table-wrap` frames tables with `overflow: hidden`, radius, white background, and shadow.
- `.table-scroll` provides `overflow: auto` and `scrollbar-gutter: stable`.
- Lead table min width: `1040px`.
- Dashboard recent leads table min width: `820px`.
- Lead table max scroll height: `480px`.
- Dashboard recent leads table max scroll height: `420px`.
- Email log table wrap max height: `480px`.
- Article review table wrap max height: `720px`.

Column widths:

| Column class | Width |
| --- | --- |
| `.lead-select-column` | `52px` |
| `.lead-grade-column` | `96px` |
| `.lead-company-column` | `220px` |
| `.lead-email-column` | `230px` |
| `.lead-country-column` | `120px` |
| `.lead-game-column` | `320px` |
| `.lead-action-column` | `110px` |
| `.email-log-select-column` | `52px` |
| Email log sent column | `180px` |
| Email log company column | `30%` |
| Email log status column | `120px` |
| `.article-select-column` | `52px` |
| `.article-title-column` | `48%` |
| `.article-source-column` | `18%` |
| `.article-published-column` | `12%` |
| `.article-processed-column`, `.article-result-column` | `11%` |

## 6. Border Radius Standards

The dominant radius is `8px`.

| Element | Radius |
| --- | --- |
| Panels, cards, stats | `8px` |
| Table wrappers | `8px` |
| Buttons | `8px` |
| Inputs, selects, textareas | `8px` |
| Icon buttons | `8px` |
| Standard modals and compose modals | `8px` |
| Loading modal | `14px` |
| Snackbar | `4px` |
| Badges, chips, switches, pills | `999px` |
| Spinner | `50%` |

Preferred standard: use `8px` for rectangular controls and surfaces unless matching an existing special component such as snackbar (`4px`) or loading modal (`14px`).

## 7. Shadow & Elevation System

### Shared Surface Shadow

```css
--paper-edge: 0 5px 22px rgba(0, 0, 0, 0.04),
  0 0 0 1px rgba(0, 0, 0, 0.06);
```

Used by:

- `.stat`
- `.panel`
- `.card`
- `.table-wrap`
- `.settings-config-panel`
- `.automation-toggle-panel`
- `.settings-detail-list`
- `.contact-detail-list`
- `.evidence-detail-list`
- `.email-log-detail-list`
- `.email-log-preview-block p/pre`

### Component Shadows

| Component | Shadow |
| --- | --- |
| Stat icon / summary icons | `0 12px 28px rgba(15, 23, 42, 0.08)` |
| Export menu | `0 12px 34px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)` |
| Snackbar | `0 18px 45px rgba(15, 23, 42, 0.18)` |
| Standard modal / compose modal | `0 18px 60px rgba(16, 35, 31, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)` |
| Loading modal | `0 16px 40px rgba(15, 23, 42, 0.18)` |
| Switch thumb | `0 1px 4px rgba(15, 23, 42, 0.22)` |
| Table header divider | `inset 0 -1px 0 var(--line)` |

Hover effects are mostly color changes rather than elevation changes.

## 8. Component Library

### Buttons

Base button:

```css
.button {
  @apply inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-accent bg-accent px-4 text-white no-underline font-medium;
  line-height: 1.2;
}
```

Variants:

| Variant | Class | Style |
| --- | --- | --- |
| Primary | `.button` | Teal background and border, white text |
| Secondary | `.button.secondary` | White background, `var(--line)` border, `var(--ink)` text |
| Secondary hover | `.button.secondary:hover` | `#f8fafc` background, `#cbd5e1` border |
| Danger | `.button.danger` | `var(--danger)` background and border, white text |
| Danger hover | `.button.danger:hover` | `#991b1b` background and border |
| Compact | `.compact-button` | Adds `font-size: 14px`, `font-weight: 500`, same `8px` radius, `padding: 0 16px` |
| Help | `.help-button` | `min-height: 40px`, `padding: 0 16px` |
| Icon only | `.icon-button` | `40px` square, white background, line border |
| Source article | `.source-article-button` | `#17201a` background/border, white text |

Disabled state:

```css
.button:disabled {
  cursor: not-allowed;
  opacity: 0.68;
}
```

The project commonly uses `lucide-react` icons at `16px` in text buttons and `18px` in close/icon buttons.

### Inputs, Selects, Textareas

Base controls:

```css
input,
select,
textarea {
  @apply min-h-10 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-ink;
}
```

Labels:

```css
label {
  display: grid;
  gap: 6px;
  color: var(--muted);
  font-size: 13px;
}
```

Selects:

- `appearance: none`
- Padding: `10px 44px 10px 16px`
- Custom chevron SVG, stroke `#536275`
- Background icon size: `16px 16px`
- Background icon position: `right 16px center`

Textareas:

- Base minimum height: `120px`
- Resize: vertical
- Settings template textarea: `min-height: 260px`, `line-height: 1.45`
- Compose textarea: `min-height: 220px`
- Custom scrollbar width/height: `12px`; thumb color `#8a8f98`

Focus state:

- No custom focus styles are defined in `globals.css`.
- Browser defaults currently apply.

Error state:

- Inputs do not have a dedicated error class.
- Errors are communicated through `.notice.warning`, `.loading-error`, `.operation-error-card`, and snackbar errors.

Switches:

- `.switch-field`: grid columns `46px minmax(0, 1fr)`, gap `10px`.
- `.switch-track`: `46px` by `26px`, radius `999px`, background `#cbd5e1`.
- Checked track background: `var(--accent)`.
- `.switch-thumb`: `20px` square, offset `3px`, translates `20px` when checked.

### Cards And Panels

Shared panel/card/stat surface:

```css
.stat,
.panel,
.card {
  @apply rounded-lg bg-panel shadow-paper-edge;
}
```

Panel:

- Padding: `22px`
- Heading: `18px`
- Adjacent top-level panels: `.main > .panel + .panel { margin-top: 20px; }`
- Settings page panel spacing commonly uses `16px`.

Dashboard stat card:

- Minimum height: `164px`
- Main grid: `74px minmax(0, 1fr)`
- Main padding: `26px 28px`
- Icon: `58px` circle
- Value: `42px`, weight `500`
- Footer: `min-height: 52px`, padding `12px 22px`

Settings config panel:

- Display grid
- `border-radius: 8px`
- `box-shadow: var(--paper-edge)`
- Body padding `24px`
- Footer padding `12px 24px`
- Footer background `#f8fafc`

### Modals

Standard modal structure:

```html
<div className="modal-backdrop">
  <div className="modal">
    <div className="modal-header">...</div>
    <div className="modal-scroll">
      <div className="modal-body">...</div>
    </div>
    <div className="modal-footer">...</div>
  </div>
</div>
```

Backdrop:

- Standard: `rgba(16, 35, 31, 0.42)`
- Loading: `rgba(16, 35, 31, 0.5)`
- Padding: `24px`
- Centered with CSS grid

Standard modal:

- Width: `min(760px, 100%)`
- Max height: `min(760px, 86vh)`
- Radius: `8px`
- White background
- Shadow: `0 18px 60px rgba(16, 35, 31, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)`

Header:

- Sticky top
- Padding: `20px 24px`
- Gap: `12px`
- Title: `20px`
- Subtitle: `14px`, muted

Footer:

- Flex end
- Gap: `10px`
- Padding: `12px 24px`
- Top border: `1px solid var(--line)`
- Background: `#f8fafc`

Modal variants:

| Variant | Width / layout |
| --- | --- |
| `.compose-modal` | `min(720px, 100%)`, custom `18px` header/body padding |
| `.filters-modal` | `min(1120px, calc(100vw - 48px))` |
| `.email-log-modal` | `min(920px, 100%)` |
| `.template-preview-modal` | `min(900px, 100%)` |
| `.automation-summary-modal` | `min(700px, 100%)` |
| `.loading-modal` | `min(420px, calc(100vw - 32px))`, radius `14px` |

Animation behavior:

- Only the loading spinner animates via `@keyframes rotation`.
- Modal open/close transitions are not defined.

Implementation note: several components render `.loading-modal-header`, but no CSS rule currently styles `.loading-modal-header`. The styled and most consistent loading pattern is `.loading-modal-body` plus `.loading-modal-actions`.

### Tables

Base table:

```css
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  table-layout: auto;
}

th,
td {
  text-align: left;
  padding: 14px 16px;
  border-bottom: 1px solid var(--line);
  vertical-align: top;
}
```

Header:

- Background: `#f8fafc`
- Text: `var(--muted)`
- Font size: `13px`
- Font weight: `700`
- Sticky for lead, article, and email log tables:

```css
.lead-list-table thead,
.article-review-table thead,
.email-log-table thead {
  position: sticky;
  top: 0;
  z-index: 1;
}
```

Subheader row:

- Uses `.table-subheader-row` and `.table-subheader-cell`.
- Cell height: `40px`
- Padding: `0 28px`
- Background: `#f8fafc`
- Text: muted, `13px`, weight `500`
- Used for counts like `100 leads &bull; 0 selected`.

Rows:

- Clickable rows use `cursor: pointer`.
- Hover background: `#edf7f4`.
- Selected row background: `#edf7f4`.
- Empty states are table rows with full-width `colSpan`.

Selection:

- Selection column width: `52px`.
- MUI Checkbox is used with custom `sx`:

```tsx
const checkboxSx = {
  color: "#667085",
  "&.Mui-checked": { color: "#0f766e" },
  "&.MuiCheckbox-indeterminate": { color: "#0f766e" }
};
```

Pagination:

- `.table-pagination`: flex, wraps, gap `16px`, muted `13px`.
- `.table-pagination-actions`: flex, gap `10px`.
- Rows selector width: `92px`, min height `40px`.

## 9. Responsive Design

There is one global media query:

```css
@media (max-width: 920px) { ... }
```

At `920px` and below:

- `.app-shell` changes from `264px minmax(0, 1fr)` to `1fr`.
- `.sidebar` becomes static and auto height instead of sticky/full height.
- `.nav` gap increases from `12px` to `14px`.
- `.stats`, `.form-grid`, `.detail-layout`, `.operations-settings-form`, `.operations-limit-row`, `.filter-row`, `.help-row`, `.contact-detail-list`, `.settings-detail-list`, `.evidence-detail-list li`, and `.automation-summary-body` collapse to one column.
- Operations form buttons and daily limit inputs become full width.
- `.filter-row` removes horizontal overflow and becomes a single-column grid.
- Definition/detail lists split label and value vertically:
  - label padding `12px 16px 4px`
  - value padding `0 16px 12px`
  - values align left instead of right

No separate tablet and mobile breakpoints are defined. The existing responsive model is desktop above `920px` and compact/mobile at `920px` and below.

Tables keep their intrinsic/min widths and scroll horizontally through `.table-scroll` rather than collapsing columns.

## 10. Tailwind And CSS Architecture

### Files

Styling is centered on one Tailwind entry file:

- `src/app/globals.css`
- `postcss.config.mjs`

`globals.css` is imported once from `src/app/layout.tsx`.

PostCSS is configured with Tailwind v4:

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {}
  }
};

export default config;
```

### Organization Strategy

The stylesheet is global and component-class based, but now runs through Tailwind. It begins with `@import "tailwindcss"`, then defines app tokens in `@theme`, base resets in `@layer base`, and existing semantic app classes in `@layer components`.

No CSS Modules are used. Tailwind utilities should be preferred for new localized layout and spacing. Shared app patterns should remain semantic classes in `@layer components`.

Current layer strategy:

```css
@layer base {
  :root { ... }
  body { ... }
}

@layer components {
  .button { ... }
  .panel { ... }
  .table-wrap { ... }
  .modal { ... }
}
```

### Naming Conventions

The code uses descriptive kebab-case class names:

- Component blocks: `.app-shell`, `.sidebar`, `.panel`, `.modal`, `.button`
- Feature scopes: `.lead-list-table`, `.email-log-table`, `.settings-config-panel`
- Element-like suffixes: `-header`, `-body`, `-footer`, `-actions`, `-row`, `-cell`
- State classes: `.active`, `.selected-row`, `.warning`, `.danger`, `.status-*`, `.grade-*`

### Utility-Like Classes

| Class | Purpose |
| --- | --- |
| `.grid` | Generic grid with `16px` gap |
| `.actions` | Flex row with wrapping and `8px` gap |
| `.inline-muted` | Muted inline metadata, `13px` |
| `.full-span` | Grid item spans all columns |
| `.one-line-cell`, `.truncate-cell` | Single-line truncation |
| `.muted-link`, `.cell-subtle`, `.source-note` | Muted secondary text |
| `.mono` | Pre-wrapped text using the app font at `13px` |

### Inline Styling

Inline styles are rare and localized:

- Dashboard grid: `gridTemplateColumns: "minmax(0, 1fr)", marginTop: 16`
- Some page sections: `marginTop: 16`
- Some detail page action areas: `marginBottom: 16`
- Draft cards: `padding: 14, marginBottom: 12`
- MUI checkbox colors are set through component `sx`

Prefer Tailwind utilities or existing semantic classes before adding inline styles.

### Tailwind Usage Guidance

- Use Tailwind theme utilities for tokenized colors: `bg-bg`, `bg-panel`, `text-ink`, `text-muted`, `border-line`, `bg-accent`, `text-accent-dark`, `text-danger`, `text-ok`.
- Use `shadow-paper-edge` for the standard raised surface shadow.
- Use Tailwind utilities for one-off layout needs, for example `mt-4`, `grid`, `gap-4`, `flex`, `items-center`, and `justify-end`.
- Keep widely reused app patterns as semantic classes in `@layer components`, especially `.button`, `.panel`, `.table-wrap`, `.modal`, `.badge`, `.notice`, and table-specific classes.
- Do not add new standalone vanilla CSS files for app UI. Extend `globals.css` layers or use Tailwind utilities in JSX.

## 11. Reusable Patterns

### Page Shell Pattern

Pages render inside `<Shell title subtitle>`, which provides:

- Desktop sidebar
- Automation status bar
- Topbar title/subtitle
- Main content padding

### Panel Sections

Most work areas use:

```tsx
<section className="panel">
  <div className="section-heading">
    <h2>...</h2>
    ...
  </div>
  ...
</section>
```

Settings pages often use `.settings-config-panel` or `.panel.settings-action-panel` with `.settings-panel-body` and `.settings-panel-footer`.

### Table Workflow Pattern

Lead, article, and email log tables follow the same pattern:

- Optional action bar above the table.
- `.table-wrap`
- `.table-scroll`
- Feature-specific table class.
- First column for selection checkbox.
- Sticky header.
- Second header row for count and selected count.
- Clickable rows.
- Row hover and selected background `#edf7f4`.
- Confirmation modal for deletion.

### Modal Pattern

Most modals use:

- `.modal-backdrop`
- `.modal` or feature-specific modal
- `.modal-header`
- optional `.modal-scroll`
- `.modal-body` or feature body
- `.modal-footer`
- `.icon-button` close control

Filter modals reuse `.filters-modal` and `.filters-modal-body`.

Compose modals reuse `.compose-modal`, `.compose-modal-header`, `.compose-modal-body`, `.compose-modal-actions`, recipient pills, placeholder buttons, file upload controls, and attachment pills.

### Form Pattern

Forms use native labels wrapping controls:

```tsx
<label>
  Field label
  <input name="..." />
</label>
```

Multi-column forms use `.form-grid`. Settings forms use `.settings-panel-body` and footer submit buttons.

### Empty States

Empty states are simple text, usually inside the current surface:

- Tables render a full-width row such as `No email logs yet.`
- Dashboard operation card uses `.operation-empty-log`.

### Loading States

Loading for form submissions uses `LoadingForm`, which shows:

- `.loading-backdrop`
- `.loading-modal`
- `.loading-modal-body`
- `.loading-spinner`
- `.loading-modal-actions`

Spinner:

- `48px` by `48px`
- Border `5px solid #dce2dd`
- Bottom border `var(--accent)`
- Rotation animation `0.8s linear infinite`

### Notifications

Inline notices:

- `.notice`: teal-tinted persistent feedback.
- `.notice.warning`: warning feedback.

Snackbars:

- Fixed bottom-right.
- Width `min(320px, calc(100vw - 32px))`.
- Success: black background and white text.
- Error: pale red background and dark red text.
- Auto dismisses after `4200ms`.

### Badges And Pills

`.badge` is the standard compact status shape:

- Inline-flex
- `min-height: 24px`
- `padding: 3px 8px`
- Radius `999px`
- `12px`, weight `700`

Other pill patterns:

- `.grade-score-chip`: `min-height: 32px`, gap `8px`, pill radius.
- `.contact-value-pill`: `min-height: 28px`, `padding: 4px 10px`.
- `.package-chip`: `min-height: 28px`, `padding: 5px 9px`.
- `.recipient-pill`: `min-height: 28px`, `padding: 4px 9px`.
- `.attachment-pill`: `padding: 6px 8px 6px 10px`.

## 12. Design Rules for Future Development

- Use `Shell` for app pages so navigation, topbar spacing, automation status, and main padding remain consistent.
- Use `Inter` through `var(--font-family)`; do not introduce a second app font.
- Use Tailwind theme tokens for core colors: `bg-bg`, `bg-panel`, `text-ink`, `text-muted`, `border-line`, `bg-accent`, `text-accent-dark`, `text-warn`, `text-danger`, and `text-ok`. Existing `:root` variables remain for component classes.
- Use `.button`, `.button.secondary`, `.button.danger`, and `.icon-button` for actions.
- Use `8px` radius for rectangular controls, panels, table wrappers, and standard modals.
- Use pill radius `999px` for badges, chips, switches, and compact value tokens.
- Use `var(--paper-edge)` for normal raised white surfaces.
- Keep operational pages compact: body/table text should stay around `14px`; helper text and labels should use `12px` or `13px`.
- Use `.panel` for standard grouped work areas and `.settings-config-panel` or `.settings-panel-body` for settings flows.
- Use `.table-wrap` plus `.table-scroll` for tables. Preserve sticky headers and table subheader count rows for selectable tables.
- Put selection checkboxes in the first table column and use the existing MUI checkbox color pattern.
- Use `.notice` and `.notice.warning` for persistent inline feedback; use snackbars for short completion/error feedback.
- Use `.modal-backdrop`, `.modal`, `.modal-header`, `.modal-body`, and `.modal-footer` for new standard modals.
- Use `.filters-modal` for filter forms that need multi-column modal layout.
- Use `.compose-modal` patterns for email composition or similar multi-field workflow modals.
- Use the existing `920px` breakpoint behavior when adding responsive CSS unless the component already has a more specific implemented need.
- Preserve horizontal table scrolling for dense operational tables instead of collapsing columns.
- Prefer Tailwind utilities or existing classes over inline styles. If a repeated inline spacing pattern appears, promote it to a shared class in `@layer components`.
- When inconsistencies exist, follow the dominant implementation: `8px` radius, `16px` section/action rhythm, `14px` body text, teal primary actions, white raised surfaces, and compact table-first layouts.
