// Giraffe-neck scroll progress: a spotted neck grows out from under the header
// as you scroll, with the head at its tip. Springy, and it looks down at the
// footer when you reach the end. Purely decorative (aria-hidden, no pointer events).

(function () {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const header = document.querySelector("header");

    const root = document.createElement("div");
    root.className = "neck";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
        <div class="neck__body"></div>
        <svg class="neck__head" viewBox="0 0 64 58" width="46" height="42" focusable="false">
            <g class="neck__nod">
                <path d="M30 12 C39 5 54 8 56 21 C57 31 52 39 41 41 C35 42 31 45 21 47 C12 49 6 45 8 38 C9 33 14 32 17 28 C21 24 22 17 30 12Z" fill="#e9a54a" stroke="#7a3a14" stroke-width="1.6" stroke-linejoin="round"/>
                <ellipse cx="14" cy="38" rx="7" ry="5" fill="#f6d9a8" transform="rotate(-14 14 38)"/>
                <circle cx="11" cy="40" r="1.3" fill="#7a3a14"/>
                <path d="M39 9 L35 1.5" stroke="#7a3a14" stroke-width="3" stroke-linecap="round"/>
                <circle cx="34.6" cy="1.6" r="2.6" fill="#7a3a14"/>
                <path d="M47 11 L51 3" stroke="#7a3a14" stroke-width="3" stroke-linecap="round"/>
                <circle cx="51.4" cy="2.8" r="2.6" fill="#7a3a14"/>
                <ellipse cx="53" cy="17" rx="5" ry="3" fill="#c97d2f" stroke="#7a3a14" stroke-width="1.2" transform="rotate(35 53 17)"/>
                <path d="M31 19 l4 -2 l3 3 l-1 4 l-5 0 z M43 28 l5 -1 l2 4 l-3 3 l-4 -2 z M24 30 l3 -1 l2 3 l-3 2 z" fill="#8a4a1c" opacity=".75"/>
                <circle cx="35" cy="26" r="2.6" fill="#2a1408"/>
                <circle cx="35.8" cy="25.2" r=".9" fill="#fff"/>
            </g>
        </svg>`;
    document.body.appendChild(root);

    let cur = 0;      // current neck length in px
    let vel = 0;      // spring velocity, also drives the head's nod
    let target = 0;
    let running = false;
    let atEnd = false;

    function measure() {
        const doc = document.documentElement;
        const scrollable = doc.scrollHeight - window.innerHeight;
        root.hidden = scrollable < 240;
        if (root.hidden) return;
        const top = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
        const p = Math.min(1, Math.max(0, window.scrollY / scrollable));
        atEnd = p > 0.985;
        // the head stays visible below the header; the full range is the viewport height
        target = top + 6 + p * (window.innerHeight - top - 64);
    }

    function paint() {
        root.style.setProperty("--neck", `${cur.toFixed(1)}px`);
        const nod = atEnd ? 30 : Math.max(-16, Math.min(16, vel * 2.2));
        root.style.setProperty("--nod", `${nod.toFixed(1)}deg`);
    }

    function tick() {
        if (reduced) {
            cur = target;
            vel = 0;
        } else {
            vel += (target - cur) * 0.11; // spring toward the target length
            vel *= 0.76;                  // damping, leaves a little overshoot
            cur += vel;
        }
        paint();
        if (Math.abs(target - cur) > 0.4 || Math.abs(vel) > 0.1) requestAnimationFrame(tick);
        else {
            cur = target;
            vel = 0;
            paint();
            running = false;
        }
    }

    function update() {
        measure();
        if (!running) {
            running = true;
            requestAnimationFrame(tick);
        }
    }

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    // Content such as tables and the gallery arrives after load and changes the page height
    new ResizeObserver(update).observe(document.body);
    measure();
    cur = target;
    paint();
})();
