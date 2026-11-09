// Scroll-reveal and count-up numbers. Everything here is cosmetic: the classes
// are added by this script, so without JavaScript (or with reduced motion) the
// page simply shows its final state.

(function () {
    if (!("IntersectionObserver" in window)) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const REVEAL = [
        ".section-heading", ".results", ".table__container", ".recap",
        ".gallery__item", ".squad-intro__stats .stat-tile", ".statband__stat",
        ".roster__group", ".hero__match", ".progress"
    ].join(",");

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-in");
            revealObserver.unobserve(entry.target);
        });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    // Stagger siblings that arrive together (gallery tiles, stat tiles)
    const seen = new WeakSet();
    function register(root) {
        root.querySelectorAll(REVEAL).forEach(el => {
            if (seen.has(el) || el.closest("header")) return;
            seen.add(el);
            const index = Array.prototype.indexOf.call(el.parentNode.children, el);
            el.style.setProperty("--reveal-delay", `${Math.min(index, 6) * 70}ms`);
            el.classList.add("reveal");
            revealObserver.observe(el);
        });
    }

    function countUp(el) {
        const text = el.textContent;
        const parts = text.split(/(\d+)/);
        const targets = parts.map(p => (/^\d+$/.test(p) ? Number(p) : null));
        if (targets.every(t => t === null)) return;
        const start = performance.now();
        const duration = 1100;
        (function frame(now) {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            el.textContent = parts.map((p, i) => (targets[i] === null ? p : Math.round(targets[i] * eased))).join("");
            if (t < 1) requestAnimationFrame(frame);
            else el.textContent = text;
        })(start);
    }

    const countObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            countObserver.unobserve(entry.target);
            countUp(entry.target);
        });
    }, { threshold: 0.6 });

    const counted = new WeakSet();
    function registerCounters(root) {
        root.querySelectorAll(".statband__value, .squad-intro__stats .stat-tile__value").forEach(el => {
            if (counted.has(el)) return;
            // Only plain numbers and scores such as 11-0-4; dates like 15.11. stay as they are
            if (!/^[\d.–-]+$/.test(el.textContent.trim()) || /\d\.\d/.test(el.textContent)) return;
            counted.add(el);
            countObserver.observe(el);
        });
    }

    function scan(root) {
        register(root);
        registerCounters(root);
    }

    scan(document);
    // Cards and tables are rendered after their JSON arrives
    new MutationObserver(() => scan(document)).observe(document.querySelector("main") || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
})();
