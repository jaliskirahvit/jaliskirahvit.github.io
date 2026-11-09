// WebGL giraffe-print: a fragment shader draws drifting Voronoi cells with
// glowing seams. The hero and the stats band both use it and share one field
// (same page coordinates, clock and pointer), so the pattern flows from one
// section into the next. The pointer swells the cells and warms the glow toward
// magenta; scrolling slides the print.
//
// createHeroGL(host, env) resolves to false when WebGL is unavailable, so
// js/fx.js can fall back to the 2D canvas version. Setup waits until the page
// has loaded and the browser is idle, so it never competes with first paint.

(function () {
    const VERT = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";

    const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;      // canvas size in device pixels
uniform float uScale;   // device pixels per CSS pixel for this canvas
uniform vec2 uOrigin;   // canvas top-left in page CSS pixels
uniform float uTime;
uniform vec2 uMouse;    // pointer in page CSS pixels
uniform float uActive;
uniform float uScroll;
uniform float uCell;    // cell size in CSS pixels

vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
}

void main() {
    // page-space position, so neighbouring sections sample the same field
    vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uScale + uOrigin;
    float slide = uScroll * 0.14 / uCell;
    vec2 p = frag / uCell;
    p.y += slide;

    // pointer lens: cells swell around the cursor
    vec2 m = uMouse / uCell;
    m.y += slide;
    vec2 dv = p - m;
    p -= dv * 0.5 * exp(-dot(dv, dv) * 1.1) * uActive;

    vec2 ip = floor(p);
    vec2 fp = fract(p);
    float f1 = 9.0;
    float f2 = 9.0;
    vec2 id = vec2(0.0);
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash2(ip + g);
            o = 0.5 + 0.42 * sin(uTime * 0.32 + 6.2831 * o);
            vec2 r = g + o - fp;
            float d = dot(r, r);
            if (d < f1) { f2 = f1; f1 = d; id = ip + g; }
            else if (d < f2) { f2 = d; }
        }
    }
    float d1 = sqrt(f1);
    float e = sqrt(f2) - d1;

    float line = 1.0 - smoothstep(0.0, 0.085, e);
    float glow = exp(-e * 8.0) * 0.32;
    float h = hash2(id).x;
    float tint = (0.03 + 0.07 * h) * (1.0 - d1);

    vec2 dm = frag - uMouse;
    float g = exp(-dot(dm, dm) / (uCell * uCell * 1.9)) * uActive;
    vec3 amber = vec3(0.94, 0.65, 0.23);
    vec3 magenta = vec3(0.88, 0.15, 0.48);
    vec3 col = mix(amber, magenta, g * 0.85) + vec3(0.30, 0.20, 0.10) * g * line;

    float shimmer = 0.9 + 0.1 * sin(uTime * 0.6 + h * 6.2831);
    float a = clamp((line * 0.8 + glow + tint) * shimmer * (1.0 + g * 0.7), 0.0, 1.0);
    gl_FragColor = vec4(col * a, a);
}`;

    const CELL = 170;                 // CSS px, the same in every section so the field matches
    const OFFSET = Math.random() * 20; // starting phase of the animation, shared by all canvases
    const T0 = performance.now();

    // ---- state shared by every canvas ----
    const shared = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: 0, target: 0, clientY: 0, frame: -1, bound: false };

    function stepShared(now) {
        if (shared.frame === now) return; // advance once per frame, however many canvases draw
        shared.frame = now;
        shared.x += (shared.tx - shared.x) * 0.14;
        shared.y += (shared.ty - shared.y) * 0.14;
        shared.active += (shared.target - shared.active) * 0.08;
    }

    function bindPointer() {
        if (shared.bound) return;
        shared.bound = true;
        document.addEventListener("pointermove", e => {
            shared.clientY = e.clientY;
            shared.tx = e.clientX;
            shared.ty = e.clientY + window.scrollY;
            if (shared.x < -9000) { shared.x = shared.tx; shared.y = shared.ty; }
            shared.target = e.target.closest && e.target.closest(".hero, .statband") ? 1 : 0;
        }, { passive: true });
        document.documentElement.addEventListener("mouseleave", () => { shared.target = 0; });
        // keep the lens under a stationary cursor while the page scrolls
        window.addEventListener("scroll", () => {
            if (shared.target > 0) shared.ty = shared.clientY + window.scrollY;
        }, { passive: true });
    }

    function compile(gl, type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
    }

    function whenIdle() {
        const loaded = document.readyState === "complete"
            ? Promise.resolve()
            : new Promise(r => window.addEventListener("load", r, { once: true }));
        return loaded.then(() => new Promise(r => {
            if ("requestIdleCallback" in window) requestIdleCallback(() => r(), { timeout: 800 });
            else setTimeout(r, 120);
        }));
    }

    function setup(host, env) {
        const reduced = !!env.reduced;
        const canvas = document.createElement("canvas");
        let gl;
        let U = {};
        try {
            gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "low-power" });
            if (!gl) return false;
            const prog = gl.createProgram();
            gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
            gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
            gl.linkProgram(prog);
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
            gl.useProgram(prog);

            // One oversized triangle covers the whole canvas
            gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
            const loc = gl.getAttribLocation(prog, "p");
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.clearColor(0, 0, 0, 0);
            ["uRes", "uScale", "uOrigin", "uTime", "uMouse", "uActive", "uScroll", "uCell"].forEach(n => { U[n] = gl.getUniformLocation(prog, n); });
        } catch (error) {
            console.warn("Shader unavailable, using the canvas fallback:", error.message);
            return false;
        }

        canvas.className = "fx-field fx-field--gl";
        canvas.setAttribute("aria-hidden", "true");
        host.appendChild(canvas);
        host.classList.add("has-field");

        // The glow is soft, so a reduced render resolution is invisible but keeps the GPU cost bounded
        const scale = Math.min(1, 0.75 * (window.devicePixelRatio || 1));
        let width = 0;
        let height = 0;
        let visible = false;
        let running = false;
        let shown = false;

        function resize() {
            const w = host.clientWidth;
            const h = host.clientHeight;
            if (!w || !h || (w === width && h === height)) return; // never reallocate for no change
            width = w;
            height = h;
            canvas.width = Math.round(w * scale);
            canvas.height = Math.round(h * scale);
            gl.viewport(0, 0, canvas.width, canvas.height);
            draw(performance.now());
        }

        function draw(now) {
            stepShared(now);
            const rect = canvas.getBoundingClientRect();
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.uniform2f(U.uRes, canvas.width, canvas.height);
            gl.uniform1f(U.uScale, canvas.width / (rect.width || width));
            gl.uniform2f(U.uOrigin, rect.left + window.scrollX, rect.top + window.scrollY);
            gl.uniform1f(U.uTime, reduced ? OFFSET : OFFSET + (now - T0) / 1000);
            gl.uniform2f(U.uMouse, shared.x, shared.y);
            gl.uniform1f(U.uActive, shared.active);
            gl.uniform1f(U.uScroll, window.scrollY);
            gl.uniform1f(U.uCell, CELL);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            if (!shown) { // fade in once the first frame is on screen
                shown = true;
                requestAnimationFrame(() => canvas.classList.add("is-on"));
            }
        }

        function loop(now) {
            if (!visible || document.hidden) { running = false; return; }
            draw(now);
            requestAnimationFrame(loop);
        }
        function start() {
            if (running || reduced) return;
            running = true;
            requestAnimationFrame(loop);
        }

        new ResizeObserver(resize).observe(host);
        new IntersectionObserver(entries => {
            visible = entries[0].isIntersecting;
            if (visible) start();
        }).observe(host);
        document.addEventListener("visibilitychange", () => { if (!document.hidden) start(); });

        // If the GPU context is lost, drop the canvas; the section still looks fine without it
        canvas.addEventListener("webglcontextlost", e => {
            e.preventDefault();
            running = false;
            canvas.remove();
            host.classList.remove("has-field");
        });

        resize();
        return true;
    }

    window.createHeroGL = function (host, env) {
        env = env || {};
        if (env.finePointer && !env.reduced) bindPointer();
        return whenIdle().then(() => setup(host, env));
    };
})();
