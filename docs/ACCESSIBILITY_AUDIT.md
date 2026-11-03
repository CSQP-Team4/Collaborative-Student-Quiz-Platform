# Accessibility Audit — WCAG 2.1 AA (CSQP-33 / CSQP-NF-004)

**Story:** CSQP-33 · **Requirement:** CSQP-NF-004 · **Test case:** TC-UX-01
**Owner:** Harshith R Reddy · **Date:** 30 Oct 2026, re-audited 3 Nov 2026 after the frontend redesign (section 10)

## 1. Result

| Acceptance criterion (SRS CSQP-NF-004) | Result |
| --- | --- |
| Web UI responsive on desktop and mobile viewports | **Pass**: no horizontal scrolling at 1280 × 900 or 390 × 844, on every screen |
| Core flows (login, attempt quiz, view dashboard) keyboard-navigable | **Pass**: full keyboard-only walkthrough (section 5) |
| Sufficient contrast | **Pass**: every text/background pair is at least 5.2:1 (AA needs 4.5:1) in the dark theme (section 10) |
| Chrome Lighthouse accessibility audit passes on core flows | **Pass**: **100 / 100** on all 9 core pages, desktop and mobile |

## 2. Lighthouse accessibility scores (after fixes)

Lighthouse 12.2, Chromium, accessibility category only. Signed-in pages were audited with a
real session (the final URL was checked, so no score is from a redirect to the login page).

| Page | Role | Desktop | Mobile |
| --- | --- | --- | --- |
| `/login` | — | 100 | 100 |
| `/register` | — | 100 | 100 |
| `/student` (dashboard) | Student | 100 | 100 |
| `/student/progress` (My progress) | Student | 100 | 100 |
| `/leaderboard` | Student | 100 | 100 |
| `/student/settings` | Student | 100 | 100 |
| `/quiz/:id` (attempt quiz) | Student | 100 | 100 |
| `/instructor/analytics` | Instructor | 100 | 100 |
| `/admin/uptime` | Admin | 100 | 100 |

## 3. axe-core (WCAG 2.1 A + AA rules) in a real browser

14 screens × 2 viewports × light/dark mode = 56 runs: **0 violations**.
Screens: login, register, verify email, forgot password, 404, student dashboard, My progress,
leaderboard, profile settings, quiz attempt, instructor dashboard, class analytics, admin
dashboard, uptime report.

## 4. Issues found and fixed

Automated tools reported nothing on the quiz page, but checking it by hand found these:

| # | Screen | Problem | WCAG | Fix |
| --- | --- | --- | --- | --- |
| 1 | Quiz attempt | Answer radio group pointed to `id="question-text"`, which did not exist, so screen readers announced an unnamed group | 1.3.1, 4.1.2 | Question heading now has that id; group is announced with the question text |
| 2 | Quiz attempt | No `<h1>` (quiz title was `<h2>`, question `<h3>`) | 1.3.1, 2.4.6 | Title is `<h1>`, question is `<h2>` |
| 3 | Quiz attempt | Countdown used `aria-label` on a plain `<div>` (ignored by screen readers); no warning before time runs out | 4.1.2, 2.2.1 | `role="timer"` with an accessible name; "5 minutes / 1 minute / 10 seconds remaining" announced via a live region |
| 4 | Quiz attempt | Previous/Next/Submit had no base `btn` class: unstyled 20 px tall buttons, hard to tap | 2.5.5 (AAA, best practice) | Proper buttons, at least 44 px tall |
| 5 | Quiz attempt | Emoji (⏱ ⚠️) read aloud as "stopwatch", "warning sign" | 1.1.1 | Marked `aria-hidden` |
| 6 | All dashboards | No way to skip the header with the keyboard | 2.4.1 | "Skip to main content" link as the first Tab stop |
| 7 | All pages | Reloading any page logged the user out in development (two refresh requests raced; token-reuse protection ended the session) | — (usability) | Session restore sends a single refresh request |
| 8 | All pages | Animations ignored the OS "reduce motion" setting | 2.3.3 (AAA, best practice) | `prefers-reduced-motion` respected |

## 5. Keyboard-only walkthrough (scripted with Playwright, repeatable)

1. `/login`: **Tab** → email, **Tab** → password, **Enter** → signed in to `/student`. ✅
2. First **Tab** on the dashboard → "Skip to main content". ✅
3. **Tab** to the "My progress" tile link → **Enter** opens the page. ✅
4. Quiz: **Tab** into the answers, **↑/↓** moves between answers and selects them, with a visible focus ring around the answer. ✅
5. **Tab** → Next / Submit buttons (Previous is skipped while disabled). ✅
6. Focus is always visible: a 3 px outline (`:focus-visible`) on every interactive element. ✅

## 6. Colour contrast (design tokens in `client/src/index.css`)

| Pair | Light | Dark | AA needs |
| --- | --- | --- | --- |
| Body text | 10.1:1 | 10.2:1 | 4.5:1 |
| Headings | 18.6:1 | 14.8:1 | 4.5:1 |
| Muted text | 5.6:1 | 7.6:1 | 4.5:1 |
| Links / accent | 7.4:1 | 6.4:1 | 4.5:1 |
| Primary button text | 7.4:1 | 7.4:1 | 4.5:1 |
| Error message | 5.7:1 | 6.6:1 | 4.5:1 |
| Success message | 5.8:1 | 7.9:1 | 4.5:1 |
| Accent badge | 6.2:1 | 5.4:1 | 4.5:1 |

## 7. Automated checks in CI

`client/src/pages/Accessibility.test.jsx` (18 tests, run on every PR by GitHub Actions):

- axe-core WCAG 2.1 A/AA rules on all 13 core screens (colour contrast is measured in the
  browser instead, because jsdom has no layout)
- exactly one `<h1>` per screen
- keyboard-only login, skip link, arrow-key radio group with an accessible name, quiz timer role

These tests fail on the code from before this story (4 failures on the quiz page), so they
would catch the same problems coming back.

## 8. Notes and limits

- **Timed quizzes (WCAG 2.2.1):** quiz time limits are an essential part of an exam, which
  2.2.1 allows. Users are warned at 5 minutes, 1 minute and 10 seconds.
- Not done: testing with a real screen reader (NVDA / VoiceOver). Recommended before release.
- Out of scope: pages that do not exist yet (materials upload, question bank, quiz builder).
  The same checks should be added when they are built.

## 9. How to re-run

- **Lighthouse:** open a page in Chrome → DevTools → *Lighthouse* → tick *Accessibility* →
  *Analyze page load* (once for *Desktop*, once for *Mobile*).
- **Automated tests:** `cd client && npm test`

## 10. Re-audit after the frontend redesign (3 Nov 2026)

The team lead's redesign (dark theme, top bar, sidebar navigation, card dashboard, new Quizzes
page) was merged into the existing pages and audited again.

**As delivered, the redesign failed WCAG 2.1 AA** (about 70 colour-contrast failures):

| Colour | Delivered | Contrast | Used now | Contrast |
| --- | --- | --- | --- | --- |
| Muted text | `#6b6b6b` | 3.0–3.6:1 (fail) | `#959595` | 5.3–6.4:1 |
| Secondary text | `#8a8a8a` | 4.6–5.6:1 | `#a3a3a3` | 6.3–7.7:1 |
| Links / active items | `#3b82f6` | 4.3–5.3:1 (fails on hover rows) | `#60a5fa` | 6.3–7.6:1 |
| Filled buttons (white text) | `#3b82f6` | 3.7:1 (fail) | `#2563eb` | 5.2:1 |

Ranges are across the four background levels (`#0e0e0e`, `#161616`, `#1c1c1c`, `#222222`).
Other changes: sidebar links read their plain names (not "… (sidebar)"), each dashboard card is
one link and one Tab stop, links in running text stay underlined (WCAG 1.4.1), and the skip link
and screen-reader-only text from section 4 were kept.

**Results after the fixes**

| Check | Result |
| --- | --- |
| Lighthouse accessibility | 100 / 100 on 10 core pages (the 9 above plus `/quizzes`), desktop and mobile |
| axe-core WCAG 2.1 A/AA in a real browser | 0 violations on 11 screens × desktop and mobile (incl. login error state) |
| Horizontal scrolling at 390 px | None (the sidebar turns into a wrapping row on phones) |
| Automated tests | Quizzes page added to the axe test list (14 screens); 98 client tests pass |

The theme is now dark only, so the light-mode figures in section 6 no longer apply; the table
above replaces them.
