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
})();
