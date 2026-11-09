// Headline "decode": letters resolve from scrambled characters. Short and
// skipped for reduced motion; the final text is always exactly the original.

(function () {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const GLYPHS = "ABCDEFGHJKLMNOPRSTUVXYZ0123456789#%&*+<>/";
    const done = new WeakSet();

    function decode(el) {
        if (done.has(el)) return;
        done.add(el);
        const text = el.textContent;
        const chars = Array.from(text);
        if (chars.every(c => c.trim() === "")) return;

        const settleAt = chars.map((c, i) => 120 + (i / chars.length) * 620 + Math.random() * 160);
        const start = performance.now();
        el.setAttribute("aria-label", text.trim());
        el.style.minHeight = `${el.offsetHeight}px`;

        (function frame(now) {
            const t = now - start;
            let out = "";
            let finished = true;
            for (let i = 0; i < chars.length; i++) {
                if (chars[i].trim() === "" || t >= settleAt[i]) out += chars[i];
                else {
                    finished = false;
                    out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
                }
            }
            el.textContent = out;
            if (!finished) requestAnimationFrame(frame);
            else {
                el.textContent = text;
                el.removeAttribute("aria-label");
                el.style.minHeight = "";
            }
        })(start);
    }

    // Only section headings decode, as they scroll into view. Page titles stay still:
    // scrambling them changed the hero's height on every frame.
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (!e.isIntersecting) return;
            io.unobserve(e.target);
            decode(e.target);
        });
    }, { threshold: 0.6 });
    document.querySelectorAll(".section-heading h2").forEach(h => io.observe(h));
})();
