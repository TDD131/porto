/**
 * FuzzyText - Vanilla JS Port
 * Based on @react-bits/FuzzyText-JS-CSS
 */

export class FuzzyText {
    constructor(element, options = {}) {
        this.element = element;
        this.options = {
            fontSize: options.fontSize || 'inherit',
            fontWeight: options.fontWeight || 900,
            fontFamily: options.fontFamily || 'inherit',
            color: options.color || '#fff',
            enableHover: options.enableHover !== undefined ? options.enableHover : true,
            baseIntensity: options.baseIntensity || 0.18,
            hoverIntensity: options.hoverIntensity || 0.5,
            fuzzRange: options.fuzzRange || 30,
            fps: options.fps || 60,
            direction: options.direction || 'horizontal',
            transitionDuration: options.transitionDuration || 0,
            clickEffect: options.clickEffect || false,
            glitchMode: options.glitchMode || false,
            glitchInterval: options.glitchInterval || 2000,
            glitchDuration: options.glitchDuration || 200,
            gradient: options.gradient || null,
            letterSpacing: options.letterSpacing || 0
        };

        this.text = element.getAttribute("data-text") || element.innerText;
        this.canvas = document.createElement('canvas');
        this.canvas.className = "fuzzy-text-canvas";
        
        // Replace content with canvas but keep container size if possible, 
        // or just append canvas. ideally we want to replace the text rendering.
        this.element.innerHTML = '';
        this.element.appendChild(this.canvas);
        
        this.state = {
            isHovering: false,
            isClicking: false,
            isGlitching: false,
            currentIntensity: this.options.baseIntensity,
            isCancelled: false
        };

        this.init();
    }

    async init() {
        const ctx = this.canvas.getContext('2d');
        if (!ctx) return;

        const computedStyle = window.getComputedStyle(this.element);
        const computedFontFamily = this.options.fontFamily === 'inherit' 
            ? computedStyle.fontFamily 
            : this.options.fontFamily;

        // Resolve Font Size
        let numericFontSize;
        let fontSizeStr;
        
        if (this.options.fontSize === 'inherit') {
            numericFontSize = parseFloat(computedStyle.fontSize);
            fontSizeStr = computedStyle.fontSize;
        } else if (typeof this.options.fontSize === 'number') {
            numericFontSize = this.options.fontSize;
            fontSizeStr = `${this.options.fontSize}px`;
        } else {
            // Parse string like "10rem"
            const temp = document.createElement('span');
            temp.style.fontSize = this.options.fontSize;
            document.body.appendChild(temp);
            numericFontSize = parseFloat(window.getComputedStyle(temp).fontSize);
            fontSizeStr = window.getComputedStyle(temp).fontSize; // Use compiled px
            document.body.removeChild(temp);
        }

        const fontString = `${this.options.fontWeight} ${fontSizeStr} ${computedFontFamily}`;
        
        // Wait for font
        try {
           await document.fonts.load(fontString);
        } catch (e) {
           console.warn("Font loading skipped", e);
        }

        // Offscreen Canvas
        const offscreen = document.createElement('canvas');
        const offCtx = offscreen.getContext('2d');

        offCtx.font = fontString;
        offCtx.textBaseline = 'alphabetic';

        // Measure Text
        let totalWidth = 0;
        if (this.options.letterSpacing !== 0) {
            for (const char of this.text) {
                totalWidth += offCtx.measureText(char).width + this.options.letterSpacing;
            }
            totalWidth -= this.options.letterSpacing;
        } else {
            totalWidth = offCtx.measureText(this.text).width;
        }

        const metrics = offCtx.measureText(this.text);
        const actualAscent = metrics.actualBoundingBoxAscent || numericFontSize;
        const actualDescent = metrics.actualBoundingBoxDescent || numericFontSize * 0.2;
        
        const tightHeight = Math.ceil(actualAscent + actualDescent);
        const extraWidthBuffer = 10;
        const offscreenWidth = Math.ceil(totalWidth + extraWidthBuffer);

        offscreen.width = offscreenWidth;
        offscreen.height = tightHeight;

        const xOffset = extraWidthBuffer / 2;
        
        // Redraw on offscreen
        offCtx.font = fontString;
        offCtx.textBaseline = 'alphabetic';
        
        if (this.options.gradient && Array.isArray(this.options.gradient)) {
            const grad = offCtx.createLinearGradient(0, 0, offscreenWidth, 0);
            this.options.gradient.forEach((c, i) => grad.addColorStop(i / (this.options.gradient.length - 1), c));
            offCtx.fillStyle = grad;
        } else {
            offCtx.fillStyle = this.options.color;
        }

        if (this.options.letterSpacing !== 0) {
            let xPos = xOffset;
            for (const char of this.text) {
                offCtx.fillText(char, xPos, actualAscent);
                xPos += offCtx.measureText(char).width + this.options.letterSpacing;
            }
        } else {
            offCtx.fillText(this.text, xOffset, actualAscent);
        }

        // Setup Main Canvas
        const horizontalMargin = this.options.fuzzRange + 20;
        const verticalMargin = 0;
        this.canvas.width = offscreenWidth + horizontalMargin * 2;
        this.canvas.height = tightHeight + verticalMargin * 2;
        
        // Center it in the parent if needed, or just let CSS handle it
        this.canvas.style.transform = `translate(-${horizontalMargin}px, -${verticalMargin}px)`;
        // this.element.style.width = `${offscreenWidth}px`;
        // this.element.style.height = `${tightHeight}px`;

        ctx.translate(horizontalMargin, verticalMargin);

        // Interactive Area
        const interactiveLeft = horizontalMargin + xOffset;
        const interactiveTop = verticalMargin;
        const interactiveRight = interactiveLeft + totalWidth;
        const interactiveBottom = interactiveTop + tightHeight;

        const isInside = (x, y) => {
            return x >= interactiveLeft && x <= interactiveRight && y >= interactiveTop && y <= interactiveBottom;
        };

        // Events
        if (this.options.enableHover) {
            this.canvas.addEventListener('mousemove', (e) => {
                const rect = this.canvas.getBoundingClientRect();
                this.state.isHovering = isInside(e.clientX - rect.left, e.clientY - rect.top);
            });
            this.canvas.addEventListener('mouseleave', () => this.state.isHovering = false);
        }

        // Animation Loop
        let lastFrameTime = 0;
        const frameDuration = 1000 / this.options.fps;

        const loop = (timestamp) => {
            if (this.state.isCancelled) return;
            
            if (timestamp - lastFrameTime >= frameDuration) {
                lastFrameTime = timestamp;
                this.renderFrame(ctx, offscreen, offscreenWidth, tightHeight);
            }
            
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    renderFrame(ctx, offscreen, w, h) {
        const { fuzzRange, direction, baseIntensity, hoverIntensity } = this.options;
        
        // Clear padding area
        ctx.clearRect(-fuzzRange - 20, -10, w + 2*(fuzzRange + 20), h + 20);

        // Determine Intensity
        let targetIntensity = baseIntensity;
        if (this.state.isHovering) targetIntensity = hoverIntensity;

        // Simple smooth transition could be added here
        this.state.currentIntensity = targetIntensity; // Direct for now

        const intensity = this.state.currentIntensity;

        if (direction === 'horizontal') {
            for (let j = 0; j < h; j++) {
                const dx = Math.floor(intensity * (Math.random() - 0.5) * fuzzRange);
                ctx.drawImage(offscreen, 0, j, w, 1, dx, j, w, 1);
            }
        } else {
             // Fallback or other modes (simplified for this port)
             for (let j = 0; j < h; j++) {
                const dx = Math.floor(intensity * (Math.random() - 0.5) * fuzzRange);
                ctx.drawImage(offscreen, 0, j, w, 1, dx, j, w, 1);
            }
        }
    }
}
