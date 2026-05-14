# Implementation Plan: UI Transition Animations

## Overview

Add a cohesive animation layer to the portfolio site via a single JS module (`js/animations.js`) and CSS class definitions in `style.css`. The module orchestrates scroll-triggered entrances, navigation scroll behavior, mobile menu stagger, filter transitions, skeleton loading, and Lenis-integrated anchor scrolling — all respecting `prefers-reduced-motion`.

## Tasks

- [x] 1. Define CSS animation classes and keyframes
  - [x] 1.1 Add new CSS custom properties and entrance animation keyframes to `style.css`
    - Add `--stagger-index`, `--stagger-base`, `--animate-duration` custom properties
    - Add `@keyframes sectionEnter` (opacity 0→1, translateY 30px→0, 500ms)
    - Add `@keyframes shimmer` (background-position -200%→200%, 1.8s linear infinite)
    - Add `.is-visible` class that triggers `sectionEnter` animation on `[data-animate]` elements
    - Add `.is-visible [data-animate-child]` rule using `calc(var(--stagger-index) * var(--stagger-base))` for animation-delay
    - Add `.no-transition` utility class that sets `transition: none !important`
    - _Requirements: 1.1, 1.2, 9.1, 9.3_

  - [x] 1.2 Add navigation compact state and mobile menu stagger CSS to `style.css`
    - Add `.nav-compact` class: padding 10px vertical, background opacity 95%
    - Add `.menu-link-enter` class: opacity 0→1, translateY 8px→0, 200ms transition with stagger delay via `--stagger-index`
    - Ensure transitions use `--ui-transition` timing (180ms cubic-bezier(0.22, 1, 0.36, 1))
    - _Requirements: 2.1, 2.2, 2.3, 3.3_

  - [x] 1.3 Add filter transition and skeleton shimmer CSS to `style.css`
    - Add `.filter-fade-out` class: opacity 1→0, 200ms ease
    - Add `.filter-fade-in` class: opacity 0→1, translateY 8px→0, 400ms with stagger delay
    - Add `.skeleton-shimmer` class: linear-gradient shimmer animation (1.8s cycle)
    - Add `.skeleton-exit` class: opacity 1→0, 200ms
    - Add `.works-card` hover: translateY(-4px) and border-color transition
    - _Requirements: 4.1, 4.2, 5.3, 6.1, 6.2_

  - [x] 1.4 Ensure reduced-motion overrides cover all new animation classes
    - Verify existing `@media (prefers-reduced-motion: reduce)` rule covers new keyframes and classes
    - Add any missing overrides for `.is-visible`, `.filter-fade-in`, `.skeleton-shimmer`, `.menu-link-enter`
    - _Requirements: 1.4, 2.4, 3.5, 4.4, 5.5, 9.4_

- [x] 2. Create the animation module (`js/animations.js`)
  - [x] 2.1 Implement module skeleton with `initAnimations`, `isReducedMotion`, and `computeStaggerDelays`
    - Create `js/animations.js` as ES module
    - Export `initAnimations(lenisInstance)` as the public entry point
    - Implement `isReducedMotion()` using `window.matchMedia('(prefers-reduced-motion: reduce)').matches`
    - Implement `computeStaggerDelays(children, baseDelay, maxCount)` pure function: returns array of delays where index i < maxCount gets `i * baseDelay`, index i >= maxCount gets `(maxCount-1) * baseDelay`
    - If reduced motion, mark all `[data-animate]` elements as `.is-visible` immediately and return early
    - _Requirements: 1.4, 9.2, 9.4_

  - [x]* 2.2 Write property test for stagger delay computation
    - **Property 1: Stagger delay computation correctness**
    - Generate random child counts (0–50), base delays (50–100ms), max counts (1–20)
    - Verify output length equals input length, values follow formula, cap is respected
    - **Validates: Requirements 1.2, 4.2, 6.2, 7.1**

  - [x] 2.3 Implement `initScrollAnimations` function
    - Create single IntersectionObserver with `{ threshold: 0.15, rootMargin: '0px 0px -80px 0px' }`
    - Observe all `[data-animate]` elements
    - On intersection: add `.is-visible`, set `--stagger-index` on `[data-animate-child]` children, then `unobserve()`
    - On page load: elements already in viewport get `.is-visible` with `.no-transition` applied/removed in next frame
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6_

  - [x] 2.4 Implement `initNavScroll` function
    - Listen to scroll events via requestAnimationFrame throttle (or Lenis scroll callback)
    - Add `.nav-compact` to `nav.site-nav` when scrollY > 50
    - Remove `.nav-compact` when scrollY <= 50
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.5 Implement `initMenuStagger` function
    - Detect `.mobile-nav-overlay` open/close via MutationObserver on class attribute
    - When `.open` is added: set `--stagger-index` on each `.mobile-nav-link`, add `.menu-link-enter`
    - When `.open` is removed: remove `.menu-link-enter` from all links
    - Handle interruption: CSS transitions naturally reverse from in-progress state
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.6 Implement `initFilterTransitions` function
    - Wrap existing filter change logic for both `#project-filter` (index) and `#project-filter-works` (works)
    - On filter change: add `.filter-fade-out` to current cards, wait 200ms, re-render, add `.filter-fade-in` with stagger
    - Handle interruption: clear pending timeouts, restart sequence on rapid filter changes
    - Remove animation classes after completion
    - _Requirements: 4.1, 4.2, 4.3_

  - [x]* 2.7 Write property test for filter selection correctness
    - **Property 2: Filter selection correctness**
    - Generate random card sets (1–30) with random types from ["Game", "3D Model", "Web", "Software"]
    - Apply random filter values; verify correct partition into fade-out vs. keep sets
    - **Validates: Requirements 4.1**

  - [x] 2.8 Implement `initSkeletons` function
    - Replace existing "CONNECTING..." loader text with skeleton HTML elements using `.skeleton-shimmer`
    - On data load: add `.skeleton-exit`, wait 200ms, replace with real content using `.filter-fade-in` stagger
    - Set 8-second timeout: remove skeletons and show inline error if content hasn't loaded
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 2.9 Implement `initAnchorScroll` function
    - Intercept clicks on `a[href^="#"]` links on the current page
    - Validate target element exists via `document.getElementById()`
    - Call `lenis.scrollTo(target, { offset: -navHeight, duration: 2.0, easing: exponentialOut })`
    - After scroll completes: trigger entrance animation on target section if not already animated
    - If hash target doesn't exist: no-op
    - User interruption handled natively by Lenis (cancels on wheel/touch)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 3. Checkpoint - Verify core module
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Add HTML data attributes and skeleton markup
  - [x] 4.1 Add `data-animate` and `data-animate-child` attributes to `index.html` sections
    - Add `data-animate` to sections: `#about`, `#stack`, `#experience`, `#logs`, `#projects`, `#contact`
    - Add `data-animate-child` to staggerable children: `.stat-box`, `.stack-card`, `.timeline-item`, `.devlog-card`, `.project-row`
    - Do NOT add `data-animate` to `#hero` (already visible on load)
    - _Requirements: 1.1, 1.2, 1.6_

  - [x] 4.2 Add `data-animate` and `data-animate-child` attributes to `works.html` sections
    - Add `data-animate` to `#works-hero`, `#all-projects`, `#works-cta`
    - Add `data-animate-child` to `.works-card` elements (dynamically rendered)
    - _Requirements: 1.1, 1.2_

  - [x] 4.3 Add skeleton placeholder markup to both HTML pages
    - Replace "CONNECTING TO DATABASE..." text with skeleton HTML elements marked with `data-skeleton`
    - Create skeleton shapes matching project rows, stat boxes, stack cards, timeline items, devlog cards
    - _Requirements: 6.1_

  - [x] 4.4 Import `js/animations.js` module in both `index.html` and `works.html`
    - Add `<script type="module">` import that calls `initAnimations(lenis)` after Lenis initialization
    - Ensure import order: Lenis first, then animations module
    - _Requirements: 9.2, 9.3_

- [x] 5. Integrate with existing systems
  - [x] 5.1 Wire anchor scroll to replace existing `scrollIntoView` calls
    - Remove existing inline anchor scroll logic from both HTML pages (the `scrollIntoView` handlers)
    - Let `initAnchorScroll` handle all same-page hash navigation via Lenis
    - Preserve page-leave transition logic for cross-page navigation
    - _Requirements: 8.1, 8.4, 8.5_

  - [x] 5.2 Wire filter transitions into existing project rendering logic in `script_v3.js`
    - Expose a hook or event that `initFilterTransitions` can intercept before re-render
    - Ensure filter animation plays before DOM replacement occurs
    - Coordinate with expand/collapse logic in `project-expand.js`
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 5.3 Wire skeleton system into Firebase data loading in `script_v3.js`
    - Ensure `initSkeletons` sets up the 8-second timeout on page load
    - When `loadProjects`, `loadTechStack`, `loadExperience`, `loadDevLogs`, `loadStats` complete, trigger skeleton exit
    - _Requirements: 6.1, 6.2, 6.4_

  - [x]* 5.4 Write unit tests for animation module integration points
    - Test IntersectionObserver setup with correct threshold and rootMargin
    - Test nav compact toggle at scrollY boundaries
    - Test menu stagger index assignment
    - Test reduced motion bypass (all elements get `.is-visible` immediately)
    - Test once-only animation (observer unobserves after first intersection)
    - Test skeleton timeout (8s removal and error display)
    - Test invalid hash no-op behavior
    - Test animation class cleanup after view toggle
    - _Requirements: 1.3, 1.4, 1.6, 2.1, 2.4, 3.3, 6.4, 8.3_

- [x] 6. Final checkpoint - Verify complete integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The animation module must stay under 2KB minified (Requirement 9.2)
- All animations use only `transform` and `opacity` for GPU compositing (Requirement 9.1)
- Existing hover/focus micro-interactions (Requirement 5) are already handled by CSS in `style.css` — tasks 1.3 and 1.4 add the missing `.works-card` hover and ensure reduced-motion coverage

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "2.1"] },
    { "id": 1, "tasks": ["1.4", "2.2", "2.3", "2.4", "2.5"] },
    { "id": 2, "tasks": ["2.6", "2.7", "2.8", "2.9"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3", "4.4"] },
    { "id": 4, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 5, "tasks": ["5.4"] }
  ]
}
```
