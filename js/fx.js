// Visual effects: live giraffe print, spotlight, magnetic buttons, card tilt.
// Everything is optional polish. Reduced motion draws the print once and skips
// the pointer effects; touch devices skip the hover-only ones.

(function () {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    // ---------- Live giraffe print: a drifting Voronoi diagram ----------

    // Cells are found per pixel on a small buffer; the thin band between the two
    // nearest seeds is drawn as the glowing "spots" outline.
    class Field {
        constructor(host, options) {
            this.host = host;
            this.opts = Object.assign({ cell: 150, scale: 5, edge: 2.3, alpha: 0.75 }, options);
            this.canvas = document.createElement("canvas");
            this.canvas.className = "fx-field";
            this.canvas.setAttribute("aria-hidden", "true");
            this.ctx = this.canvas.getContext("2d");
            host.appendChild(this.canvas);
            host.classList.add("has-field");
            this.cursor = { x: -9999, y: -9999 };
            this.visible = false;
            this.last = 0;
            this.t = Math.random() * 100;

            new ResizeObserver(() => this.resize()).observe(host);
            new IntersectionObserver(entries => {
                this.visible = entries[0].isIntersecting;
                if (this.visible) this.start();
            }).observe(host);
            document.addEventListener("visibilitychange", () => { if (!document.hidden) this.start(); });

            if (finePointer && !reduced) {
                host.addEventListener("pointermove", e => {
                    const r = host.getBoundingClientRect();
                    this.cursor.x = (e.clientX - r.left) / this.opts.scale;
                    this.cursor.y = (e.clientY - r.top) / this.opts.scale;
                });
                host.addEventListener("pointerleave", () => { this.cursor.x = this.cursor.y = -9999; });
            }
        }

        resize() {
            const w = this.host.clientWidth;
            const h = this.host.clientHeight;
            if (!w || !h) return;
            const s = this.opts.scale;
            this.w = Math.max(40, Math.ceil(w / s));
            this.h = Math.max(24, Math.ceil(h / s));
            this.canvas.width = this.w;
            this.canvas.height = this.h;
            this.img = this.ctx.createImageData(this.w, this.h);
            const count = Math.max(8, Math.round((w * h) / (this.opts.cell * this.opts.cell)));
            this.seeds = Array.from({ length: count }, () => ({
                x: Math.random() * this.w,
                y: Math.random() * this.h,
                vx: (Math.random() - 0.5) * 0.05,
                vy: (Math.random() - 0.5) * 0.05,
            }));
            this.draw(0);
        }

        start() {
            if (this.running || reduced || !this.seeds) return;
            this.running = true;
            requestAnimationFrame(now => this.loop(now));
        }

        loop(now) {
            if (!this.visible || document.hidden) {
                this.running = false;
                return;
            }
            if (now - this.last > 33) { // about 30 fps is plenty for a slow drift
                this.last = now;
                this.step();
                this.draw(now);
            }
            requestAnimationFrame(t => this.loop(t));
        }

        step() {
            for (const s of this.seeds) {
                s.x += s.vx;
                s.y += s.vy;
                if (s.x < 0 || s.x > this.w) s.vx *= -1;
                if (s.y < 0 || s.y > this.h) s.vy *= -1;
            }
        }

        draw(now) {
            const { w, h, seeds, img } = this;
            const data = img.data;
            const edge = this.opts.edge;
            const cx = this.cursor.x;
            const cy = this.cursor.y;
            const hasCursor = cx > -9000;
            const pts = hasCursor ? seeds.concat([{ x: cx, y: cy }]) : seeds;
            const pulse = 0.85 + 0.15 * Math.sin(now / 1800 + this.t);
            const glowR2 = 32 * 32;

            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    let d1 = Infinity;
                    let d2 = Infinity;
                    for (let i = 0; i < pts.length; i++) {
                        const dx = pts[i].x - x;
                        const dy = pts[i].y - y;
                        const d = dx * dx + dy * dy;
                        if (d < d1) { d2 = d1; d1 = d; }
                        else if (d < d2) d2 = d;
                    }
                    const gap = Math.sqrt(d2) - Math.sqrt(d1);
                    let a = 1 - gap / edge;
                    a = a <= 0 ? 0 : a * a * (3 - 2 * a); // smoothstep falloff
                    const o = (y * w + x) * 4;
                    if (a === 0) { data[o + 3] = 0; continue; }

                    // amber lines, shifting to magenta close to the pointer
                    let g = 0;
                    if (hasCursor) {
                        const dx = cx - x;
                        const dy = cy - y;
                        g = Math.exp(-(dx * dx + dy * dy) / glowR2);
                    }
                    data[o] = 240 - 16 * g;
                    data[o + 1] = 167 - 128 * g;
                    data[o + 2] = 58 + 64 * g;
                    data[o + 3] = Math.min(255, 255 * a * this.opts.alpha * pulse * (1 + g * 0.6));
                }
            }
            this.ctx.putImageData(img, 0, 0);
        }
    }

    function initFields() {
        const hero = document.querySelector(".hero");
        if (hero) new Field(hero, { cell: 170, alpha: 0.55 });

        // The stats band is revealed after its data arrives, so wait for it
        const band = document.querySelector(".statband");
        if (band) {
            const make = () => new Field(band, { cell: 120, alpha: 0.8 });
            if (!band.hidden) make();
            else new MutationObserver((_, obs) => {
                if (!band.hidden) { obs.disconnect(); make(); }
            }).observe(band, { attributes: true, attributeFilter: ["hidden"] });
        }
    }

    // ---------- Pointer effects ----------

    function initPointerEffects() {
        if (!finePointer || reduced) return;

        // Spotlight that follows the pointer over the hero
        const hero = document.querySelector(".hero");
        if (hero) {
            hero.addEventListener("pointermove", e => {
                const r = hero.getBoundingClientRect();
                hero.style.setProperty("--mx", `${e.clientX - r.left}px`);
                hero.style.setProperty("--my", `${e.clientY - r.top}px`);
            });
        }

        // Buttons lean toward the pointer
        document.addEventListener("pointermove", e => {
            const btn = e.target.closest && e.target.closest(".btn");
            if (!btn) return;
            const r = btn.getBoundingClientRect();
            const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
            const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
            btn.style.setProperty("--tx", `${(dx * 6).toFixed(1)}px`);
            btn.style.setProperty("--ty", `${(dy * 4).toFixed(1)}px`);
        });
        document.addEventListener("pointerout", e => {
            const btn = e.target.closest && e.target.closest(".btn");
            if (!btn || btn.contains(e.relatedTarget)) return;
            btn.style.removeProperty("--tx");
            btn.style.removeProperty("--ty");
        });

        // Player cards tilt like trading cards; the foil sheen follows the pointer
        document.addEventListener("pointermove", e => {
            if (e.pointerType === "touch") return;
            const card = e.target.closest && e.target.closest(".roster .player-card");
            if (!card) return;
            const r = card.getBoundingClientRect();
            const px = (e.clientX - r.left) / r.width;
            const py = (e.clientY - r.top) / r.height;
            card.style.setProperty("--ry", `${((px - 0.5) * 12).toFixed(2)}deg`);
            card.style.setProperty("--rx", `${((0.5 - py) * 12).toFixed(2)}deg`);
            card.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
            card.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
        });
        document.addEventListener("pointerout", e => {
            const card = e.target.closest && e.target.closest(".roster .player-card");
            if (!card || card.contains(e.relatedTarget)) return;
            ["--rx", "--ry", "--mx", "--my"].forEach(p => card.style.removeProperty(p));
        });
    }

    initFields();
    initPointerEffects();
})();
