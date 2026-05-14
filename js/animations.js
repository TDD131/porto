/**
 * Animation orchestration module for the portfolio site.
 * Handles scroll-triggered entrances, navigation scroll behavior,
 * mobile menu stagger, filter transitions, skeleton loading,
 * and Lenis-integrated anchor scrolling.
 *
 * All animations respect prefers-reduced-motion: reduce.
 * Must stay under 2KB minified total.
 */

/**
 * Returns true if the user prefers reduced motion.
 * @returns {boolean}
 */
export function isReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Pure function that computes stagger delays for an array of children.
 * Children at index i < maxCount get delay = i * baseDelay.
 * Children at index i >= maxCount get delay = (maxCount - 1) * baseDelay.
 *
 * @param {Element[]} children - Array of child elements
 * @param {number} baseDelay - Base delay in ms between staggered items
 * @param {number} maxCount - Maximum number of uniquely staggered items
 * @returns {number[]} Array of delay values in ms
 */
export function computeStaggerDelays(children, baseDelay, maxCount) {
  const cap = (maxCount - 1) * baseDelay;
  return children.map((_, i) => (i < maxCount ? i * baseDelay : cap));
}

// --- Internal sub-system functions (placeholders) ---

/** Sets up IntersectionObserver for scroll-triggered section entrances. */
function initScrollAnimations() {
  const elements = document.querySelectorAll('[data-animate]');
  if (!elements.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        revealElement(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -80px 0px' }
  );

  elements.forEach((el) => {
    observer.observe(el);
  });

  // Elements already in viewport on page load: show immediately without transition
  requestAnimationFrame(() => {
    elements.forEach((el) => {
      if (el.classList.contains('is-visible')) return;
      const rect = el.getBoundingClientRect();
      const inViewport =
        rect.top < window.innerHeight && rect.bottom > 0;
      if (inViewport) {
        el.classList.add('no-transition');
        revealElement(el);
        observer.unobserve(el);
        requestAnimationFrame(() => {
          el.classList.remove('no-transition');
        });
      }
    });
  });
}

/**
 * Reveals an element by adding .is-visible and setting stagger indices on children.
 * @param {Element} el - The [data-animate] element to reveal
 */
function revealElement(el) {
  el.classList.add('is-visible');
  const children = Array.from(el.querySelectorAll('[data-animate-child]'));
  if (children.length) {
    const delays = computeStaggerDelays(children, 80, 10);
    children.forEach((child, i) => {
      child.style.setProperty('--stagger-index', i < 10 ? i : 9);
    });
  }
}

/** Adds/removes .nav-compact based on scroll position. */
function initNavScroll() {
  const nav = document.querySelector('nav.site-nav');
  if (!nav) return;

  let ticking = false;

  function updateNav() {
    if (window.scrollY > 50) {
      nav.classList.add('nav-compact');
    } else {
      nav.classList.remove('nav-compact');
    }
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateNav);
      ticking = true;
    }
  }, { passive: true });

  // Apply correct state on init (in case page loads scrolled)
  updateNav();
}

/** Staggers mobile menu link entrances on open/close. */
function initMenuStagger() {
  const overlay = document.querySelector('.mobile-nav-overlay');
  if (!overlay) return;

  const links = overlay.querySelectorAll('.mobile-nav-link');

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName !== 'class') continue;

      const isOpen = overlay.classList.contains('open');

      if (isOpen) {
        // Set stagger index and add initial state class
        links.forEach((link, i) => {
          link.style.setProperty('--stagger-index', i);
          link.classList.add('menu-link-enter');
        });
        // Allow initial state to paint, then trigger transition
        requestAnimationFrame(() => {
          links.forEach((link) => {
            link.classList.add('is-entered');
          });
        });
      } else {
        // Menu closing — remove animation classes
        links.forEach((link) => {
          link.classList.remove('menu-link-enter', 'is-entered');
        });
      }
    }
  });

  observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
}

/** Orchestrates fade-out/fade-in when project filter changes. */
function initFilterTransitions() {
  // Track pending timeouts for interruption handling
  let pendingTimeouts = [];

  function clearPending() {
    pendingTimeouts.forEach((id) => clearTimeout(id));
    pendingTimeouts = [];
  }

  function animateFilterChange(filterEl, cardSelector, container) {
    if (!filterEl || !container) return;

    filterEl.addEventListener('change', () => {
      // Interruption: clear any in-progress animation sequence
      clearPending();

      // Remove any leftover animation classes from previous interrupted sequences
      container.querySelectorAll(cardSelector).forEach((card) => {
        card.classList.remove('filter-fade-out', 'filter-fade-in');
        card.style.removeProperty('--stagger-index');
      });

      const currentCards = container.querySelectorAll(cardSelector);

      // Step 1: Fade out current cards
      currentCards.forEach((card) => {
        card.classList.add('filter-fade-out');
      });

      // Step 2: After 200ms, dispatch event to trigger re-render
      const fadeOutTimeout = setTimeout(() => {
        // Dispatch custom event so main script can re-render
        filterEl.dispatchEvent(new CustomEvent('filter-animate-done', { bubbles: true }));

        // Step 3: After re-render (next frame), fade in new cards with stagger
        requestAnimationFrame(() => {
          const newCards = Array.from(container.querySelectorAll(cardSelector));
          const delays = computeStaggerDelays(newCards, 50, 10);

          newCards.forEach((card, i) => {
            card.style.setProperty('--stagger-index', delays[i] / 50);
            card.classList.add('filter-fade-in');
          });

          // Step 4: Remove animation classes after longest animation completes
          // 400ms base + stagger for last card
          const longestDelay = newCards.length > 0 ? delays[delays.length - 1] : 0;
          const cleanupTimeout = setTimeout(() => {
            newCards.forEach((card) => {
              card.classList.remove('filter-fade-in');
              card.style.removeProperty('--stagger-index');
            });
          }, 400 + longestDelay);

          pendingTimeouts.push(cleanupTimeout);
        });
      }, 200);

      pendingTimeouts.push(fadeOutTimeout);
    });
  }

  // Index page: #project-filter with .project-row cards
  const indexFilter = document.getElementById('project-filter');
  const indexContainer = document.getElementById('projects-container');
  animateFilterChange(indexFilter, '.project-row', indexContainer);

  // Works page: #project-filter-works with .works-card cards
  const worksFilter = document.getElementById('project-filter-works');
  const worksContainer = document.getElementById('works-container');
  animateFilterChange(worksFilter, '.works-card', worksContainer);
}

/**
 * Triggers the skeleton exit animation for a section element.
 * Adds `.skeleton-exit` to skeleton elements, waits 200ms, then replaces
 * with real content using `.filter-fade-in` stagger treatment.
 *
 * @param {Element} sectionEl - The section or container element holding `[data-skeleton]` children
 */
export function triggerSkeletonExit(sectionEl) {
  if (!sectionEl) return;

  const skeletons = Array.from(sectionEl.querySelectorAll('[data-skeleton]'));
  if (!skeletons.length) return;

  // Mark this section as loaded so the timeout won't fire
  sectionEl.dataset.skeletonLoaded = 'true';

  // Add exit animation class to all skeletons
  skeletons.forEach((sk) => sk.classList.add('skeleton-exit'));

  // After 200ms fade-out, remove skeletons from DOM
  setTimeout(() => {
    skeletons.forEach((sk) => sk.remove());

    // Apply stagger fade-in to the real content that remains
    const realChildren = Array.from(
      sectionEl.querySelectorAll('[data-animate-child]')
    );
    if (realChildren.length) {
      const delays = computeStaggerDelays(realChildren, 60, 10);
      realChildren.forEach((child, i) => {
        child.style.setProperty('--stagger-index', i < 10 ? i : 9);
        child.classList.add('filter-fade-in');
      });

      // Clean up animation classes after transitions complete
      const maxDelay = delays[delays.length - 1] || 0;
      setTimeout(() => {
        realChildren.forEach((child) => {
          child.classList.remove('filter-fade-in');
        });
      }, maxDelay + 500);
    }
  }, 200);
}

/** Manages skeleton shimmer placeholders and timeout. */
function initSkeletons() {
  const skeletonEls = document.querySelectorAll('[data-skeleton]');
  if (!skeletonEls.length) return;

  // Ensure all skeleton elements have the shimmer class
  skeletonEls.forEach((el) => el.classList.add('skeleton-shimmer'));

  // Collect unique parent sections that contain skeletons
  const sections = new Set();
  skeletonEls.forEach((el) => {
    const section = el.closest('section') || el.parentElement;
    if (section) sections.add(section);
  });

  // Listen for the custom event that signals data has loaded for a section
  document.addEventListener('skeleton-content-loaded', (e) => {
    const sectionId = e.detail && e.detail.section;
    if (!sectionId) return;

    const sectionEl = document.getElementById(sectionId) ||
      document.querySelector(`[data-skeleton-section="${sectionId}"]`);
    if (sectionEl) {
      triggerSkeletonExit(sectionEl);
    }
  });

  // 8-second timeout: remove skeletons and show error if content hasn't loaded
  setTimeout(() => {
    sections.forEach((section) => {
      if (section.dataset.skeletonLoaded === 'true') return;

      const remaining = section.querySelectorAll('[data-skeleton]');
      if (!remaining.length) return;

      // Remove skeleton elements
      remaining.forEach((sk) => sk.remove());

      // Insert inline error message
      const errorEl = document.createElement('div');
      errorEl.className = 'skeleton-error';
      errorEl.setAttribute('role', 'alert');
      errorEl.textContent = 'Content could not be loaded. Please refresh the page.';

      // Find the container where skeletons lived
      const container =
        section.querySelector('.project-list') ||
        section.querySelector('.stack-grid') ||
        section.querySelector('.timeline') ||
        section.querySelector('.devlog-grid') ||
        section.querySelector('.stats-grid') ||
        section;

      container.appendChild(errorEl);
    });
  }, 8000);
}

/** Intercepts anchor clicks and delegates to Lenis smooth scroll. */
function initAnchorScroll(lenis) {
  if (!lenis) return;

  const exponentialOut = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[href^="#"]');
    if (!anchor) return;

    const hash = anchor.getAttribute('href');
    if (!hash || hash === '#') return;

    const targetId = hash.slice(1);
    const target = document.getElementById(targetId);
    if (!target) return;

    e.preventDefault();

    const nav = document.querySelector('nav.site-nav');
    const navHeight = nav ? nav.offsetHeight : 80;

    lenis.scrollTo(target, {
      offset: -navHeight,
      duration: 2.0,
      easing: exponentialOut,
      onComplete: () => {
        // Trigger entrance animation on target section if not already animated
        if (target.hasAttribute('data-animate') && !target.classList.contains('is-visible')) {
          revealElement(target);
        }
      }
    });
  });
}

/**
 * Public entry point — called once after Lenis initialization.
 * If reduced motion is active, marks all [data-animate] elements
 * as visible immediately and skips all observer/listener setup.
 *
 * @param {object} lenisInstance - The Lenis smooth scroll instance
 */
export function initAnimations(lenisInstance) {
  if (isReducedMotion()) {
    document.querySelectorAll('[data-animate]').forEach((el) => {
      el.classList.add('is-visible');
    });
    return;
  }

  initScrollAnimations();
  initNavScroll();
  initMenuStagger();
  initFilterTransitions();
  initSkeletons();
  initAnchorScroll(lenisInstance);
}
