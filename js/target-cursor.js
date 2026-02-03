export class TargetCursor {
    constructor(options = {}) {
        this.options = {
            targetSelector: options.targetSelector || 'a, button, input, .clickable, .hero-title',
            spinDuration: options.spinDuration || 3,
            borderWidth: 3,
            cornerSize: 12,
            hoverDuration: 0.3
        };

        this.isMobile = this.checkMobile();
        if (this.isMobile) return;

        this.init();
    }

    checkMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    }

    init() {
        // Create DOM Elements
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'target-cursor-wrapper';
        
        this.dot = document.createElement('div');
        this.dot.className = 'target-cursor-dot';
        
        this.corners = [];
        ['tl', 'tr', 'br', 'bl'].forEach(pos => {
            const el = document.createElement('div');
            el.className = `target-cursor-corner corner-${pos}`;
            this.wrapper.appendChild(el);
            this.corners.push(el);
        });

        this.wrapper.appendChild(this.dot);
        document.body.appendChild(this.wrapper);
        this.wrapper.style.display = 'block';

        // GSAP Refs
        this.cursorX = window.innerWidth / 2;
        this.cursorY = window.innerHeight / 2;
        
        // Initial Position
        gsap.set(this.wrapper, { x: this.cursorX, y: this.cursorY });

        // Spin Timeline
        this.spinTl = gsap.timeline({ repeat: -1 })
            .to(this.wrapper, { rotation: 360, duration: this.options.spinDuration, ease: 'none' });

        // State
        this.activeStrength = 0;
        this.isActive = false;
        this.activeTarget = null;
        this.targetCornerPositions = null;

        // Bindings
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseHover = this.onMouseHover.bind(this);
        this.updateParams = this.updateParams.bind(this); // For GSAP ticker

        // Listeners
        window.addEventListener('mousemove', this.onMouseMove);
        // Using event delegation for hover to catch all targets
        document.addEventListener('mouseover', this.onMouseHover);
        
        // Add Ticker
        gsap.ticker.add(this.updateParams);
    }

    onMouseMove(e) {
        this.cursorX = e.clientX;
        this.cursorY = e.clientY;
        
        gsap.to(this.wrapper, {
            x: this.cursorX,
            y: this.cursorY,
            duration: 0.1,
            ease: 'power3.out'
        });
    }

    onMouseHover(e) {
        const target = e.target.closest(this.options.targetSelector);
        
        // If we moved into a target
        if (target && target !== this.activeTarget) {
            this.enterTarget(target);
        } 
        // If we moved out of a target (and didn't move into another valid one)
        else if (!target && this.activeTarget) {
            this.leaveTarget();
        }
    }

    enterTarget(target) {
        this.activeTarget = target;
        this.isActive = true;

        // Stop Spin
        this.spinTl.pause();
        gsap.to(this.wrapper, { rotation: 0, duration: 0.3, ease: 'power2.out' });

        // Start expanded state
        gsap.to(this, {
            activeStrength: 1,
            duration: this.options.hoverDuration,
            ease: 'power2.out'
        });

        // Listen for leave specifically on this element to be safe
        target.addEventListener('mouseleave', () => this.leaveTarget(), { once: true });
    }

    leaveTarget() {
        if(!this.activeTarget) return;

        this.activeTarget = null;
        this.isActive = false;

        // Resume Spin
        this.spinTl.resume();
        
        // Return to normal
        gsap.to(this, {
            activeStrength: 0,
            duration: 0.3,
            ease: 'power2.out'
        });

        // Reset corners to default positions
        const cs = this.options.cornerSize;
        const positions = [
            { x: -15, y: -15 }, // tl
            { x: 3, y: -15 },  // tr
            { x: 3, y: 3 },   // br
            { x: -15, y: 3 }   // bl
        ];

        this.corners.forEach((corner, i) => {
            gsap.to(corner, {
                x: positions[i].x, // Relative to wrapper (0,0 is center?) Wait.
                // In CSS: top/left are used. GSAP 'x' is translate.
                // The CSS positions place them around the center.
                // So default x/y translate should be 0.
                x: 0,
                y: 0,
                duration: 0.3,
                ease: 'power2.out'
            });
        });
    }

    updateParams() {
        if (!this.isActive || !this.activeTarget) return;

        const strength = this.activeStrength;
        const rect = this.activeTarget.getBoundingClientRect();
        const bw = this.options.borderWidth;
        const cs = this.options.cornerSize; // 12

        // Calculate target positions relative to the CURSOR center (which is moving)
        // logic: TargetPos(Page) - CursorPos(Page) = Offset
        
        // We want corners to land on the corners of the RECT.
        // Corner TL (0) -> Rect Top Left
        // Corner TR (1) -> Rect Top Right
        
        // CSS offsets: TL is at -15,-15. To move it to a specific point P relative to cursor C:
        // FinalX = (Rect.Left - C.x) - (CSS_OffsetX)
        // Actually simplest is to calculate where they SHOULD be relative to C.
        
        // Current Cursor Pos
        const cx = this.cursorX;
        const cy = this.cursorY;

        // Target positions relative to viewport
        const targetPos = [
            { x: rect.left - bw, y: rect.top - bw }, // TL
            { x: rect.right + bw - cs, y: rect.top - bw }, // TR
            { x: rect.right + bw - cs, y: rect.bottom + bw - cs }, // BR
            { x: rect.left - bw, y: rect.bottom + bw - cs } // BL
        ];

        // The corners are children of .wrapper. Wrapper is at cx, cy.
        // So a child at x:0, y:0 is at cx, cy.
        // But the child has default CSS offsets (top: -15, left: -15).
        // Let's assume we animate 'x' and 'y' (transform).
        // TargetTransformX = (TargetPos.x - cx) - (InitialCSSOffset.x)
        
        // My CSS offsets:
        // TL: -15, -15
        // TR: 3, -15
        // BR: 3, 3
        // BL: -15, 3
        
        const cssOffsets = [
            { x: -15, y: -15 },
            { x: 3, y: -15 },
            { x: 3, y: 3 },
            { x: -15, y: 3 }
        ];

        this.corners.forEach((corner, i) => {
            const tx = targetPos[i].x - cx;  // Offset from center
            const ty = targetPos[i].y - cy;
            
            // We want to lerp activeStrength. 
            // If strength 0 -> x=0 (return to css default)
            // If strength 1 -> x = tx - cssOffsets[i].x
            
            const finalX = (tx - cssOffsets[i].x) * strength;
            const finalY = (ty - cssOffsets[i].y) * strength;

            // Apply immediately for snappiness or use GSAP inside ticker?
            // React code used GSAP inside ticker. Let's do set for performance or quick to
            gsap.set(corner, { x: finalX, y: finalY });
        });
    }
}
