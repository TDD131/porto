# Requirements Document

## Introduction

This feature adds cohesive transition animations to all UI navigation elements and moving UI components across the portfolio website. The site already has page fade transitions, a theme toggle circular wipe (view-transition API), and Lenis smooth scroll. This spec covers the remaining gaps: scroll-triggered entrance animations for sections and content blocks, navigation state transitions (mobile menu, hamburger icon), interactive element micro-animations, filter/sort transitions for project cards, and loading state animations — all unified under the existing brutalist/cyber-interface aesthetic and respecting `prefers-reduced-motion`.

## Glossary

- **Animation_Engine**: The CSS and JavaScript system responsible for orchestrating transition animations across the site
- **Section**: A top-level content block on a page (hero, about, stack, experience, logs, projects, contact)
- **Card**: A discrete UI component representing a project, stat, stack item, or dev log entry
- **Navigation_Bar**: The fixed top navigation bar (`nav.site-nav`) including logo, links, theme toggle, and hamburger
- **Mobile_Menu**: The overlay navigation panel shown on screens 1024px and below
- **Hamburger_Button**: The three-line toggle button that opens/closes the Mobile_Menu
- **Filter_System**: The select dropdown and view toggle that control which project Cards are displayed and in what layout
- **Scroll_Observer**: An IntersectionObserver-based system that triggers entrance animations when elements scroll into the viewport
- **Stagger_Delay**: A sequential timing offset applied to sibling elements so they animate in one after another
- **Reduced_Motion_Mode**: The state when `prefers-reduced-motion: reduce` is active, disabling or minimizing animations

## Requirements

### Requirement 1: Scroll-Triggered Section Entrance Animations

**User Story:** As a visitor, I want page sections to animate into view as I scroll, so that the browsing experience feels dynamic and polished.

#### Acceptance Criteria

1. WHEN a Section crosses the IntersectionObserver threshold of 15% visibility, THE Animation_Engine SHALL animate the Section from opacity 0 and translateY of 30px to opacity 1 and translateY of 0px using a CSS transition with a duration between 400ms and 600ms and an ease-out timing function
2. WHEN a Section entrance animation is triggered, THE Animation_Engine SHALL apply a Stagger_Delay of 60ms to 100ms between sibling child elements within that Section (such as Cards in a grid or timeline items), up to a maximum of 10 staggered children
3. THE Animation_Engine SHALL trigger each Section entrance animation only once per page load
4. WHILE the operating system preference `prefers-reduced-motion: reduce` is active, THE Animation_Engine SHALL display all Sections at full opacity and default position immediately without entrance animations or stagger delays
5. THE Scroll_Observer SHALL configure IntersectionObserver with a rootMargin of 0px 0px between -50px and -100px 0px so that animations trigger before elements are fully centered in the viewport
6. WHEN the page initially loads, THE Animation_Engine SHALL immediately display any Sections already within the viewport at full opacity and default position without playing an entrance animation

### Requirement 2: Navigation Bar Scroll Behavior Animation

**User Story:** As a visitor, I want the navigation bar to visually respond to my scroll position, so that it feels integrated with the page content.

#### Acceptance Criteria

1. WHEN the page is scrolled beyond 50px from the top, THE Navigation_Bar SHALL transition to a compact visual state with padding reduced from 18px to 10px (vertical) and background opacity increased from 82% to 95% of `--bg-color`, over a duration matching the existing `--ui-transition` timing (180ms cubic-bezier(0.22, 1, 0.36, 1))
2. WHEN the page is scrolled back to 50px or less from the top, THE Navigation_Bar SHALL transition back to the default state (18px vertical padding, 82% background opacity) over the same `--ui-transition` duration
3. THE Navigation_Bar SHALL use CSS transitions on the `padding` and `background-color` properties and SHALL NOT cause reflow of content below the navigation bar (the body top-padding SHALL remain constant regardless of nav compact state)
4. WHILE the user has `prefers-reduced-motion: reduce` enabled, THE Navigation_Bar SHALL apply the compact and default states instantly (transition-duration of 0.01ms or less) instead of animating over 180ms

### Requirement 3: Mobile Menu Open/Close Transition

**User Story:** As a mobile visitor, I want the navigation menu to open and close with a smooth animation, so that the interaction feels responsive.

#### Acceptance Criteria

1. WHEN the Hamburger_Button is activated, THE Mobile_Menu SHALL transition from hidden (opacity 0, translateY -8px, scale 0.98) to visible (opacity 1, translateY 0, scale 1) over a duration matching `--ui-transition-slow` (320ms) using the cubic-bezier(0.22, 1, 0.36, 1) easing defined in that variable
2. WHEN the Hamburger_Button is deactivated, THE Mobile_Menu SHALL transition from visible (opacity 1, translateY 0, scale 1) to hidden (opacity 0, translateY -8px, scale 0.98) over the same 320ms duration and easing
3. WHEN the Mobile_Menu open transition completes, THE Mobile_Menu SHALL animate each navigation link into view sequentially with a Stagger_Delay of 50ms between each link, using an opacity fade from 0 to 1 and translateY from 8px to 0 over 200ms per link
4. IF the Hamburger_Button is activated while the Mobile_Menu is still animating closed (or vice versa), THEN THE Mobile_Menu SHALL reverse the current animation from its in-progress state without waiting for the previous transition to complete
5. WHILE Reduced_Motion_Mode is active, THE Mobile_Menu SHALL appear and disappear instantly without transition animations or stagger delays, applying visibility and opacity changes in 0.01ms

### Requirement 4: Project Card Filter Transition

**User Story:** As a visitor, I want project cards to animate smoothly when I change the filter category, so that the content change feels intentional rather than abrupt.

#### Acceptance Criteria

1. WHEN the Filter_System category value changes, THE Animation_Engine SHALL fade out non-matching Cards by transitioning opacity from 1 to 0 over 200ms, and SHALL begin rendering the filtered set only after the fade-out completes
2. WHEN filtered Cards are rendered, THE Animation_Engine SHALL animate each Card into view with a fade-up transform (opacity 0 to 1, translateY 8px to 0) over 400ms with a Stagger_Delay of 50ms between Cards
3. IF the Filter_System category value changes while a fade-out or fade-in animation is in progress, THEN THE Animation_Engine SHALL cancel the in-progress animation and restart the transition sequence for the newly selected filter
4. WHILE Reduced_Motion_Mode is active, THE Animation_Engine SHALL update the Card display immediately within a single animation frame without fade, transform, or stagger animations

### Requirement 5: Interactive Element Hover and Focus Micro-Animations

**User Story:** As a visitor, I want buttons, links, and interactive elements to respond with subtle motion feedback, so that the interface feels alive and clickable.

#### Acceptance Criteria

1. THE Animation_Engine SHALL apply a translateY(-1px) on hover for all button elements (`.btn-brutal`, `.btn-access`, `.theme-toggle`, `.view-toggle-btn`) using the existing `--ui-transition` timing (180ms cubic-bezier(0.22, 1, 0.36, 1))
2. WHEN a Card element (`.project-row`, `.stat-box`, `.stack-card`, `.devlog-card`) is hovered, THE Animation_Engine SHALL apply a translateY(-2px) lift and transition the border-color to `color-mix(in srgb, var(--text-primary) 22%, transparent)` using the `--ui-transition` timing
3. WHEN a `.works-card` is hovered, THE Animation_Engine SHALL apply a translateY(-4px) lift and transition the border-color to `color-mix(in srgb, var(--text-primary) 22%, transparent)` using the `--ui-transition` timing
4. WHEN a focusable interactive element (buttons, links, inputs, selects) receives keyboard focus via `:focus-visible`, THE Animation_Engine SHALL display a 2px solid outline in `color-mix(in srgb, var(--text-primary) 28%, transparent)` with an outline-offset of 4px, fading in over 150ms using an opacity transition on a pseudo-element or box-shadow approach
5. WHILE Reduced_Motion_Mode is active (`prefers-reduced-motion: reduce`), THE Animation_Engine SHALL suppress all transform and animation properties (setting transition-duration to 0.01ms) while preserving instantaneous color and background-color hover state changes

### Requirement 6: Loading State Skeleton Animation

**User Story:** As a visitor, I want loading placeholders to have a subtle shimmer animation, so that I know content is being fetched.

#### Acceptance Criteria

1. WHILE content is loading from Firebase for any dynamically-populated Section (projects, experience, stats, dev logs, tech stack), THE Animation_Engine SHALL display skeleton placeholder elements with a horizontal shimmer gradient animation cycling every 1.5s to 2s
2. WHEN content finishes loading, THE Animation_Engine SHALL fade out skeleton elements over 200ms and fade in the real content over 300ms with a Stagger_Delay of 60ms between sibling elements
3. WHILE Reduced_Motion_Mode is active, THE Animation_Engine SHALL display static placeholder elements without shimmer animation and reveal loaded content immediately without fade or stagger
4. IF a Firebase content load does not complete within 8 seconds, THEN THE Animation_Engine SHALL remove the skeleton placeholders and display an inline error message indicating the content could not be loaded

### Requirement 7: View Toggle Layout Transition

**User Story:** As a visitor on the works page, I want the grid/list view switch to animate the layout change, so that the reorganization feels smooth.

#### Acceptance Criteria

1. WHEN the view toggle button is activated, THE Animation_Engine SHALL apply the `viewFadeIn` keyframe (opacity 0→1, blur 4px→0, translateY 8px→0) to each Card over 400ms with easing cubic-bezier(0.16, 1, 0.3, 1) and a successive Stagger_Delay of 50ms per Card
2. WHEN the view toggle animation completes, THE Animation_Engine SHALL remove all animation classes and inline animation-delay styles from the Cards within 100ms after the last Card finishes animating
3. THE Animation_Engine SHALL NOT play the view transition animation on initial page load; the animation SHALL only trigger in response to a user-initiated view toggle activation
4. WHILE Reduced_Motion_Mode is active (prefers-reduced-motion: reduce), THE Animation_Engine SHALL apply the layout change with no visible animation by setting animation-duration to 0.01ms or less

### Requirement 8: Scroll-to-Section Smooth Navigation

**User Story:** As a visitor, I want clicking a navigation link to smoothly scroll to the target section with a visible easing curve, so that I maintain spatial awareness of the page.

#### Acceptance Criteria

1. WHEN a same-page anchor link (an `<a>` element whose `href` begins with `#` and targets a section on the current page) is clicked, THE Animation_Engine SHALL delegate scrolling to the Lenis smooth scroll instance with a duration of 2.0 seconds, an exponential-out easing curve, and a vertical offset that accounts for the fixed navigation bar height so the target section is not obscured
2. WHEN the Lenis scroll-to operation completes (the scroll position reaches the target offset and velocity returns to zero), THE Animation_Engine SHALL trigger the entrance animation for the target Section if the Section has not been previously animated
3. IF the anchor link references a hash that does not match any element's `id` on the current page, THEN THE Animation_Engine SHALL take no scrolling action and leave the viewport position unchanged
4. IF the user initiates a manual scroll gesture (wheel, touch, or keyboard) while a programmatic Lenis scroll-to is in progress, THEN THE Animation_Engine SHALL cancel the programmatic scroll and yield control to the user's input
5. WHILE Reduced_Motion_Mode is active, THE Animation_Engine SHALL jump to the target Section immediately with no smooth interpolation and no transition duration

### Requirement 9: Performance and Accessibility Constraints

**User Story:** As a developer, I want all animations to be performant and accessible, so that the site remains fast and usable for all visitors.

#### Acceptance Criteria

1. THE Animation_Engine SHALL use only `transform` and `opacity` properties for animations to ensure GPU-composited rendering without triggering layout recalculations
2. THE Animation_Engine SHALL not add more than 2KB of minified JavaScript for the scroll observation and animation orchestration logic
3. THE Animation_Engine SHALL implement all animations using CSS classes toggled by JavaScript, keeping animation definitions in `style.css`
4. IF a visitor has `prefers-reduced-motion: reduce` enabled, THEN THE Animation_Engine SHALL disable all transform-based animations and reduce transition durations to 0.01ms
5. THE Animation_Engine SHALL not block the main thread for more than 16ms during any animation frame
