// Mobile menu: the button toggles .is-open on the header. Without JavaScript
// the links simply stay visible (the collapsing styles only apply under html.js).

(function () {
    const header = document.querySelector("header");
    const toggle = header && header.querySelector(".header__toggle");
    const menu = header && header.querySelector(".header__menu");
    if (!toggle || !menu) return;

    const mobile = window.matchMedia("(max-width: 640px)");

    function setOpen(open) {
        header.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Sulje valikko" : "Avaa valikko");
    }

    toggle.addEventListener("click", () => setOpen(!header.classList.contains("is-open")));
    menu.addEventListener("click", e => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && header.classList.contains("is-open")) {
            setOpen(false);
            toggle.focus();
        }
    });
    document.addEventListener("click", e => {
        if (header.classList.contains("is-open") && !header.contains(e.target)) setOpen(false);
    });
    mobile.addEventListener("change", () => setOpen(false));

    // Desktop: a glowing bar glides between menu items (hover/focus), resting on the current page
    const glide = document.createElement("span");
    glide.className = "header__glide";
    glide.setAttribute("aria-hidden", "true");
    menu.appendChild(glide);
    const links = Array.from(menu.querySelectorAll("a"));
    const current = menu.querySelector('a[aria-current="page"]');

    function moveTo(link, animate) {
        if (!link || mobile.matches) { glide.classList.remove("is-ready"); return; }
        if (!animate) glide.style.transition = "none";
        glide.style.setProperty("--x", `${link.offsetLeft}px`);
        glide.style.setProperty("--w", `${link.offsetWidth}px`);
        glide.style.setProperty("--y", `${link.offsetTop + link.offsetHeight - 3}px`);
        glide.classList.add("is-ready");
        if (!animate) {
            void glide.offsetWidth; // apply without a transition, then restore it
            glide.style.transition = "";
        }
    }
    function rest() { current ? moveTo(current, true) : glide.classList.remove("is-ready"); }

    links.forEach(a => {
        a.addEventListener("mouseenter", () => moveTo(a, glide.classList.contains("is-ready")));
        a.addEventListener("focus", () => moveTo(a, glide.classList.contains("is-ready")));
    });
    menu.addEventListener("mouseleave", rest);
    menu.addEventListener("focusout", e => { if (!menu.contains(e.relatedTarget)) rest(); });
    window.addEventListener("resize", () => moveTo(current, false));
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => moveTo(current, false));
    mobile.addEventListener("change", () => (mobile.matches ? glide.classList.remove("is-ready") : moveTo(current, false)));
})();
