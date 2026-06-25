I have everything I need. Let me compile the findings. The analysis is complete — I've reviewed all the custom interactive components (Sheet, TabBar, Tour, Toast, WelcomeModal, TourFloat, HelpDrawer, NotificationSheet, NewBookingSheet, BookingSheet, ScreenHeader), the color tokens, the input/button utilities, and confirmed there is no global focus-visible style.

# Accessibility (WCAG) Review — yozuv Dashboard + Booking UI

Scope: `frontend/src/components/yz/*` and `frontend/src/app/dashboard/*`. Mobile-first Telegram Mini App, Radix Dialog + custom components. Findings are ordered by real-world impact.

---

## P0 — Blockers

### 1. The spotlight Tour is invisible and unusable for screen readers and keyboard users
`Tour.tsx:123-238`

This is the single biggest a11y hole. The Tour is a fully custom overlay that traps the user's attention visually but gives assistive tech almost nothing, and several steps **require a mouse click** to advance.

- **No role / no focus management.** The root is a bare `<div className="fixed inset-0 z-[3000]" aria-live="polite">` (`Tour.tsx:124`). It is not a `role="dialog"`, has no `aria-modal`, and focus is never moved into it when it opens. A keyboard/screen-reader user gets no announcement that a modal tour took over, and Tab keeps moving through the dimmed page behind the 60% black scrim.
- **`aria-live="polite"` on the whole overlay is wrong.** It's on the container, not on the changing tooltip text, so step transitions are announced inconsistently (the live region also wraps non-text decorative dimming divs). The step title/body (`Tour.tsx:195`, `207`) should live in a labelled dialog (`aria-labelledby` → title, `aria-describedby` → body), not a polite region wrapping the entire screen.
- **`mode: "action"` steps cannot be completed without a real mouse click.** Advancement is gated on a `click` MouseEvent whose `target.closest(step.targetSelector)` matches (`Tour.tsx:83-91`). There is no keyboard equivalent and no Next button in action mode — the footer just shows a static "Yorqin tugmani bosing" label (`Tour.tsx:231-236`). A keyboard-only user is stuck; their only escape is the X. The onboarding chain (`page.tsx:162-172`, `finishDashboardTour`) launches this for first-time owners, so a keyboard user's first experience is a dead end.
- **No Escape handler.** Radix dialogs close on Esc for free; this hand-rolled overlay does not. Esc does nothing.
- **The pulsing pointer** (`Tour.tsx:164-172`) is `aria-hidden` — fine — but it's the *only* affordance telling the user what to do, so there's no text equivalent of "click the highlighted element."

**Fix:** Wrap the tooltip card in a real dialog: `role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}`, move focus to it on open (and to the Next/close button per step), add a `keydown` listener for Escape → `onClose`. For `action` steps, add a keyboard path — e.g. an explicit "Davom etish" button alongside the click affordance, or focus the target element and advance on its activation. Drop `aria-live` from the container; if you want polite announcements, put a dedicated visually-hidden live region that updates with `${idx+1}/${steps.length} ${title}`.

---

### 2. Custom modals bypass Radix entirely — no focus trap, no Escape, no dialog semantics
`WelcomeModal.tsx:27-104` and `HelpDrawer.tsx:89-183`

Unlike the Sheets (which correctly use Radix `Dialog`), `WelcomeModal` and `HelpDrawer` are plain `fixed inset-0` divs.

- **WelcomeModal**: no `role="dialog"`, no `aria-modal`, no focus trap, no Escape, focus not moved in. It's the *first thing a new owner sees* (`page.tsx:516-521`), and a keyboard user can Tab straight past it into the page behind. The backdrop also has no dismiss-on-click and no labelled heading association.
- **HelpDrawer**: same missing dialog semantics. It *does* close on backdrop click (`HelpDrawer.tsx:92`) but that click handler is on a `<div>` with no keyboard equivalent, and there's no Escape handler or focus trap. The FAQ accordion buttons (`HelpDrawer.tsx:128`) lack `aria-expanded`/`aria-controls`, so a screen-reader user doesn't know an item is collapsible or open.

**Fix:** Re-implement both on top of the existing Radix `DialogPrimitive` (you already wrap it in `Sheet.tsx` — reuse `SheetRoot`/`SheetContent` or a Radix `Dialog.Content`). That gets focus trap, Escape, `aria-modal`, and scroll-lock for free. For the HelpDrawer accordion, add `aria-expanded={isOpen}` and `aria-controls` to each trigger button.

---

### 3. Toasts are not announced to screen readers
`Toast.tsx:34-46`

The toast container has `pointer-events-none ... z-[100]` but **no `role` and no `aria-live`**. Toast messages confirm the result of primary actions — "Yozilish qo'shildi ✓" after creating a booking (`NewBookingSheet.tsx:125`), "Tasdiqlandi", "Bekor qilindi", and error strings like `(e as Error).message` (`BookingSheet.tsx:102-171`). A screen-reader user gets zero feedback that their booking succeeded or that an error occurred. Combined with the 2400ms auto-dismiss (`Toast.tsx:20`), even a sighted low-vision user may miss it.

**Fix:** Add `role="status" aria-live="polite" aria-atomic="true"` to the container `<div>` at `Toast.tsx:34`. For error toasts specifically, consider `role="alert"` (assertive). Because errors and successes share one channel, at minimum make the container an `aria-live="polite"` region. Note the 2.4s timeout is also a WCAG 2.2.1 concern for users who read slowly — consider a longer duration or a dismissible affordance.

---

## P1 — Serious

### 4. No global focus-visible style; `outline-none` strips the indicator on the most-used control
`globals.css:204` (`.yz-input`), `Sheet.tsx:28`, and the absence of any `:focus-visible` rule in `globals.css`

I grepped the entire stylesheet: there is **no `:focus-visible` rule anywhere**. The `.tap` utility (`globals.css:157`) — applied to nearly every button, tile, and link in the app — provides only an `active:scale` press animation, no focus ring. Browsers' default outline is the only thing left, and:

- `.yz-input` sets `outline-none` and replaces it with `focus:ring` (`globals.css:204`) — good, inputs are covered.
- But Radix `DialogPrimitive.Content` is given `focus:outline-none` (`Sheet.tsx:28`) with no replacement, so when a sheet opens and Radix moves focus to the content, there's no visible focus.
- Every `.tap` button (TabBar items, quick tiles, booking cards, sheet action buttons) relies on UA default outline, which is inconsistent and often invisible against the colored/gradient backgrounds.

**Fix:** Add a global fallback in `globals.css`, e.g. `*:focus-visible { outline: 2px solid theme(colors.indigo.500); outline-offset: 2px; border-radius: inherit; }` and audit the explicit `focus:outline-none` / `outline-none` usages to ensure each has a visible replacement.

### 5. Color contrast failures on secondary text and disabled states
Token values from `tailwind.config.ts:24-33`

Measured against WCAG AA (4.5:1 normal text, 3:1 large/UI):

- **`text-ink-300` (#B9BECD) on white = ~1.9:1.** Used as `<ChevronRight className="... text-ink-300">` in the "Yana" menu (`TabBar.tsx:162`) — that's a decorative-ish chevron so borderline, but `text-ink-300` is also the disabled time-slot text in the booking flow (`NewBookingSheet.tsx:286`, `text-ink-300 line-through` on `bg-ink-100`) → busy slots are essentially unreadable. Even disabled controls should stay legible.
- **`text-ink-400` (#878DA6) on white = ~3.0:1.** Fails AA for normal-size body text. It's used pervasively for meaningful content: client phone numbers (`NewBookingSheet.tsx:194`), service price/duration (`NewBookingSheet.tsx:235`), empty-state messages (`NewBookingSheet.tsx:172`, `page.tsx:454`), `.eyebrow` labels (`globals.css:199`), the date subtitle (`page.tsx:311`), QuickTile subtitles (`page.tsx:595`). This is 125 occurrences across 32 files. At the small sizes used (11–13px), 3:1 is a clear fail.
- **`text-white/70` / `text-white/75` on the indigo gradient** — the bot-link mono URL (`page.tsx:492`) and revenue card subtext (`page.tsx:327, 338`). White at 70% over `#4853F5`–`#7C5CFF` lands around 3:1–3.4:1; the 12–13px text fails AA.

**Fix:** Darken the workhorse secondary token — `ink-400` should be ~`#6B7186` or darker (the existing `ink-500` #5A6078 ≈ 5.0:1 passes). Reserve `ink-300` for non-text borders only, not for disabled text. On gradient surfaces, bump muted text to `text-white/85` or higher.

### 6. TabBar "+" launches a sheet but is just a `<button>` with no expanded state, and active nav isn't programmatically conveyed
`TabBar.tsx:94-135`, `198-216`

- The bottom `<nav>` has no `aria-label` to distinguish it (there are multiple navs/landmarks). Add `aria-label="Asosiy navigatsiya"`.
- Active tab state is conveyed **only by color** (`indigo-600` vs `ink-400`, `TabItem` `active` prop) — no `aria-current="page"`. A screen-reader user can't tell which page they're on. Add `aria-current={active ? "page" : undefined}` to the `<Link>` at `TabBar.tsx:198`.
- The "Yana" button opens a Sheet but has no `aria-expanded`/`aria-haspopup` (`TabBar.tsx:112`). The Radix sheet handles its own a11y once open, so this is minor, but `aria-haspopup="dialog"` would help.

### 7. Notification rows and other tappable rows are reachable, but the Sheet drag-handle and headers aren't labelled as a dialog title for custom `<h2>`
`NotificationSheet.tsx:54-65`, `Sheet.tsx:53`

`Sheet.tsx` uses Radix `DialogPrimitive.Content`, which requires an accessible name. `SheetHeader` renders the title as a plain `<h2>` (`Sheet.tsx:53`) **not** wrapped in `DialogPrimitive.Title`, and `NotificationSheet` does the same (`NotificationSheet.tsx:55`). Radix will emit a console warning ("`DialogContent` requires a `DialogTitle`") and, more importantly, the dialog has **no accessible name** — screen readers announce an unlabelled dialog. The `NewBookingSheet` (`NewBookingSheet.tsx:138`) and `BookingSheet` (`BookingSheet.tsx:176`, which passes *no* title at all) have the same gap.

**Fix:** In `SheetHeader`, render the title via `<DialogPrimitive.Title asChild><h2>…</h2></DialogPrimitive.Title>`. For sheets with no visible title (BookingSheet), add a visually-hidden `DialogPrimitive.Title` (e.g. `<VisuallyHidden><Dialog.Title>Yozilish tafsilotlari</Dialog.Title></VisuallyHidden>`). Likewise add a `Dialog.Description` or `aria-describedby`.

---

## P2 — Should fix

### 8. Touch targets below 44×44px
- TabBar "Yana"/tab labels: the inner icon chip is `h-9 w-9` (36px) (`TabBar.tsx:119`, `201`); the tap target is the full flex column so likely OK, but verify the row height reaches 44px.
- Sheet close button: `h-9 w-9` = 36px (`Sheet.tsx:63`, `NotificationSheet.tsx:60`, `Tour.tsx:202`). Below the WCAG 2.5.5 / 2.5.8 (24px min AA, 44px AAA) comfortable target. On a mobile-first app this matters.
- Onboarding-chip dismiss X: `h-5 w-5` = 20px (`TourFloat.tsx:83`) — below even the 24px AA minimum.
- HelpDrawer close: `h-9 w-9` (`HelpDrawer.tsx:111`).

**Fix:** Bump icon-only controls to `h-11 w-11` (44px) or add invisible padding to extend the hit area.

### 9. Status conveyed by color + Uzbek label is fine, but the unread badge and "busy" slot rely on color/strikethrough
- The notification unread count badge (`page.tsx:299-303`) is a coral dot with a number — fine, it has text.
- Busy time slots (`NewBookingSheet.tsx:285-287`) use `line-through` + faded color only. `disabled` is set (good — conveys state to AT), but the visual cue is contrast-failing (see #5). Add a small "band" text or `aria-label="14:00, band"` so the reason is explicit.
- `StatusBadge` (`StatusBadge.tsx`) correctly pairs color with a text label — good, no change needed.

### 10. Decorative emoji and icons mostly OK, but verify a couple
- The scissors emoji used as a service icon (`NewBookingSheet.tsx:229`, literal `✂️`) will be read aloud as "scissors" by screen readers inside the button, adding noise before the service name. Wrap in `<span aria-hidden="true">`.
- `Avatar` initials (`Avatar.tsx:42`) render the initials as text inside a colored span with no role — acceptable since the name is also shown adjacent, but in contexts where the avatar stands alone, consider `aria-label={name}`.

---

## Summary of priorities

| # | Severity | Component:line | One-line fix |
|---|----------|----------------|--------------|
| 1 | P0 | `Tour.tsx:123-238` | Make tour a real `role=dialog`, trap focus, add Esc + keyboard advance for `action` steps |
| 2 | P0 | `WelcomeModal.tsx:27`, `HelpDrawer.tsx:89` | Rebuild on Radix Dialog (focus trap, Esc, aria-modal); add `aria-expanded` to FAQ |
| 3 | P0 | `Toast.tsx:34` | Add `role="status" aria-live="polite"` (alert for errors) |
| 4 | P1 | `globals.css` (missing `:focus-visible`), `Sheet.tsx:28` | Add global focus-visible ring; replace stripped outlines |
| 5 | P1 | `tailwind.config.ts:30-31` | Darken `ink-400`/`ink-300`; raise muted text on gradients to /85 |
| 6 | P1 | `TabBar.tsx:198` | Add `aria-current="page"` + `aria-label` on nav |
| 7 | P1 | `Sheet.tsx:53`, `BookingSheet.tsx:176` | Wrap title in `Dialog.Title` (visually-hidden where no title) |
| 8 | P2 | `Sheet.tsx:63`, `TourFloat.tsx:83` | Icon buttons to 44×44 |
| 9 | P2 | `NewBookingSheet.tsx:285` | Add textual "band" cue to busy slots |
| 10 | P2 | `NewBookingSheet.tsx:229` | `aria-hidden` the decorative emoji |

The good news: the Sheet system is built on Radix, so the four Sheet-based modals already get focus trap, Escape, and scroll-lock — they only need accessible **names** (#7). The real blockers are the three hand-rolled overlays (Tour, WelcomeModal, HelpDrawer) and the silent Toast, all of which sidestep Radix and therefore have no a11y story at all.