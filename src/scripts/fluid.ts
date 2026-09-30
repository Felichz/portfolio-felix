/**
 * The cursor ink. Moving the pointer stirs a thin ink of the room's glow colors into the page
 * background, and it curls, drifts and fades like smoke in still air.
 *
 * A small stable-fluids solver (Jos Stam, 1999) on the GPU: velocity lives on a coarse grid, the ink
 * on a finer one, and each frame advects both, adds a little vorticity so the trails curl, and
 * projects the velocity to stay incompressible. Near text the ink thins out, so it never competes with
 * reading.
 *
 * Cheap by construction: WebGL2, half-float textures, the velocity grid ~128 cells on its short side,
 * the ink at half the window's CSS size (it's soft anyway), and the loop runs only while there is ink
 * to draw, then stops and the canvas leaves the compositor. Off on touch screens and under reduced
 * motion. Returns false where WebGL2 with float render targets isn't available, so the caller can
 * fall back to the dot field.
 */
export function initFluid(): boolean {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-fluid]');
  if (!canvas) return false;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  if (!fine.matches || reduce.matches) return false;

  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) return false;
  gl.getExtension('OES_texture_float_linear');

  // ---------- Tuning ----------
  const SIM = 128; // velocity cells on the short side
  const INK_SCALE = 0.5; // ink texels per CSS pixel
  const PRESSURE_STEPS = 20;
  const CURL = 9; // how much the trails curl
  const VELOCITY_FADE = 2.0; // per second; how fast motion dies out, higher feels thicker
  const INK_FADE = 0.9; // per second; ink lingers about five seconds after the last stir
  const PRESSURE_KEEP = 0.8;
  const FORCE = 2300;
  const RADIUS = 0.0030;
  const IDLE_MS = 6000; // stop simulating this long after the last stir

  // ---------- Shaders ----------
  const vertex = `#version 300 es
    precision highp float;
    in vec2 aPosition;
    uniform vec2 texelSize;
    out vec2 vUv, vL, vR, vT, vB;
    void main() {
      vUv = aPosition * 0.5 + 0.5;
      vL = vUv - vec2(texelSize.x, 0.0);
      vR = vUv + vec2(texelSize.x, 0.0);
      vT = vUv + vec2(0.0, texelSize.y);
      vB = vUv - vec2(0.0, texelSize.y);
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }`;
  const frag = (body: string) => `#version 300 es
    precision highp float;
    precision highp sampler2D;
    in vec2 vUv, vL, vR, vT, vB;
    out vec4 outColor;
    ${body}`;

  const shaders = {
    splat: frag(`
      uniform sampler2D uTarget;
      uniform float aspect, radius;
      uniform vec3 color;
      uniform vec2 point;
      void main() {
        vec2 p = vUv - point;
        p.x *= aspect;
        outColor = vec4(texture(uTarget, vUv).xyz + exp(-dot(p, p) / radius) * color, 1.0);
      }`),
    advect: frag(`
      uniform sampler2D uVelocity, uSource;
      uniform vec2 simTexel;
      uniform float dt, fade;
      void main() {
        vec2 from = vUv - dt * texture(uVelocity, vUv).xy * simTexel;
        outColor = texture(uSource, from) / (1.0 + fade * dt);
      }`),
    curl: frag(`
      uniform sampler2D uVelocity;
      void main() {
        float L = texture(uVelocity, vL).y, R = texture(uVelocity, vR).y;
        float T = texture(uVelocity, vT).x, B = texture(uVelocity, vB).x;
        outColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
      }`),
    vorticity: frag(`
      uniform sampler2D uVelocity, uCurl;
      uniform float curl, dt;
      void main() {
        float L = texture(uCurl, vL).x, R = texture(uCurl, vR).x;
        float T = texture(uCurl, vT).x, B = texture(uCurl, vB).x;
        float C = texture(uCurl, vUv).x;
        vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        force = force / (length(force) + 0.0001) * curl * C;
        force.y *= -1.0;
        vec2 v = texture(uVelocity, vUv).xy + force * dt;
        outColor = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
      }`),
    divergence: frag(`
      uniform sampler2D uVelocity;
      void main() {
        float L = texture(uVelocity, vL).x, R = texture(uVelocity, vR).x;
        float T = texture(uVelocity, vT).y, B = texture(uVelocity, vB).y;
        vec2 C = texture(uVelocity, vUv).xy;
        if (vL.x < 0.0) L = -C.x;
        if (vR.x > 1.0) R = -C.x;
        if (vT.y > 1.0) T = -C.y;
        if (vB.y < 0.0) B = -C.y;
        outColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
      }`),
    scale: frag(`
      uniform sampler2D uTexture;
      uniform float value;
      void main() { outColor = value * texture(uTexture, vUv); }`),
    pressure: frag(`
      uniform sampler2D uPressure, uDivergence;
      void main() {
        float L = texture(uPressure, vL).x, R = texture(uPressure, vR).x;
        float T = texture(uPressure, vT).x, B = texture(uPressure, vB).x;
        outColor = vec4((L + R + B + T - texture(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0);
      }`),
    gradient: frag(`
      uniform sampler2D uPressure, uVelocity;
      void main() {
        float L = texture(uPressure, vL).x, R = texture(uPressure, vR).x;
        float T = texture(uPressure, vT).x, B = texture(uPressure, vB).x;
        outColor = vec4(texture(uVelocity, vUv).xy - vec2(R - L, T - B), 0.0, 1.0);
      }`),
    // The ink, lit from above by its own thickness, so the trails read as soft ribbons instead of flat
    // color. Output is premultiplied: the brightest channel is the coverage.
    display: frag(`
      uniform sampler2D uTexture;
      uniform float strength, cover, shade;
      void main() {
        vec3 c = texture(uTexture, vUv).rgb;
        float dx = length(texture(uTexture, vR).rgb) - length(texture(uTexture, vL).rgb);
        float dy = length(texture(uTexture, vT).rgb) - length(texture(uTexture, vB).rgb);
        vec3 n = normalize(vec3(dx, dy, 0.035));
        c *= clamp(n.z + 0.72, 0.72, 1.0);
        c = min(c * strength, vec3(1.0));
        // Never more than a tint: thick ink is capped, so text over it keeps its contrast.
        float a = max(c.r, max(c.g, c.b));
        if (a > cover) c *= cover / a;
        // On the light edition the ink is a deeper tone of the same color, like watercolor on paper.
        outColor = vec4(c * shade, min(a, cover));
      }`),
  };

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  type Program = { use: () => void; u: Record<string, WebGLUniformLocation | null> };
  let programs: Record<keyof typeof shaders, Program>;
  try {
    const vs = compile(gl.VERTEX_SHADER, vertex);
    programs = Object.fromEntries(
      Object.entries(shaders).map(([name, src]) => {
        const p = gl.createProgram()!;
        gl.attachShader(p, vs);
        gl.attachShader(p, compile(gl.FRAGMENT_SHADER, src));
        gl.bindAttribLocation(p, 0, 'aPosition');
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'program');
        const u: Record<string, WebGLUniformLocation | null> = {};
        const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
        for (let i = 0; i < n; i++) {
          const info = gl.getActiveUniform(p, i)!;
          u[info.name] = gl.getUniformLocation(p, info.name);
        }
        return [name, { use: () => gl.useProgram(p), u }];
      }),
    ) as Record<keyof typeof shaders, Program>;
  } catch {
    return false;
  }

  // One full-screen quad for every pass.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  // ---------- Render targets ----------
  type Target = { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number };
  type Double = { read: Target; write: Target; swap: () => void; w: number; h: number };
  const target = (w: number, h: number): Target => {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fbo, w, h };
  };
  const double = (w: number, h: number): Double => {
    const d = { read: target(w, h), write: target(w, h), w, h, swap: () => ([d.read, d.write] = [d.write, d.read]) };
    return d;
  };
  const free = (t: Target) => {
    gl.deleteTexture(t.tex);
    gl.deleteFramebuffer(t.fbo);
  };

  let velocity!: Double, ink!: Double, pressure!: Double, divergence!: Target, curl!: Target;
  let simW = 0, simH = 0, inkW = 0, inkH = 0;

  const size = () => {
    const w = innerWidth, h = innerHeight;
    const aspect = w / h;
    const nSimW = Math.round(aspect >= 1 ? SIM * aspect : SIM);
    const nSimH = Math.round(aspect >= 1 ? SIM : SIM / aspect);
    const nInkW = Math.max(1, Math.round(w * INK_SCALE));
    const nInkH = Math.max(1, Math.round(h * INK_SCALE));
    if (nSimW === simW && nSimH === simH && nInkW === inkW && nInkH === inkH) return;
    if (velocity) [velocity.read, velocity.write, ink.read, ink.write, pressure.read, pressure.write, divergence, curl].forEach(free);
    simW = nSimW; simH = nSimH; inkW = nInkW; inkH = nInkH;
    velocity = double(simW, simH);
    pressure = double(simW, simH);
    divergence = target(simW, simH);
    curl = target(simW, simH);
    ink = double(inkW, inkH);
    canvas.width = inkW;
    canvas.height = inkH;
  };
  size();
  // Canvas and targets exist: make sure this GPU can actually render to half-float targets.
  gl.bindFramebuffer(gl.FRAMEBUFFER, ink.read.fbo);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return false;

  // ---------- Passes ----------
  let unit = 0;
  const bind = (p: Program, name: string, t: Target) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.uniform1i(p.u[name]!, unit++);
  };
  const run = (p: Program, out: Target | null, texel: [number, number], set: () => void) => {
    p.use();
    unit = 0;
    gl.uniform2f(p.u.texelSize!, texel[0], texel[1]);
    set();
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fbo : null);
    gl.viewport(0, 0, out ? out.w : canvas.width, out ? out.h : canvas.height);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  };

  const splat = (x: number, y: number, dx: number, dy: number, color: [number, number, number]) => {
    const aspect = innerWidth / innerHeight;
    const radius = RADIUS * (aspect > 1 ? aspect : 1);
    const s = programs.splat;
    run(s, velocity.write, [1 / simW, 1 / simH], () => {
      bind(s, 'uTarget', velocity.read);
      gl.uniform1f(s.u.aspect!, aspect);
      gl.uniform2f(s.u.point!, x, y);
      gl.uniform3f(s.u.color!, dx, dy, 0);
      gl.uniform1f(s.u.radius!, radius);
    });
    velocity.swap();
    run(s, ink.write, [1 / inkW, 1 / inkH], () => {
      bind(s, 'uTarget', ink.read);
      gl.uniform1f(s.u.aspect!, aspect);
      gl.uniform2f(s.u.point!, x, y);
      gl.uniform3f(s.u.color!, ...color);
      gl.uniform1f(s.u.radius!, radius);
    });
    ink.swap();
  };

  const step = (dt: number) => {
    const texel: [number, number] = [1 / simW, 1 / simH];
    const P = programs;
    run(P.curl, curl, texel, () => bind(P.curl, 'uVelocity', velocity.read));
    run(P.vorticity, velocity.write, texel, () => {
      bind(P.vorticity, 'uVelocity', velocity.read);
      bind(P.vorticity, 'uCurl', curl);
      gl.uniform1f(P.vorticity.u.curl!, CURL);
      gl.uniform1f(P.vorticity.u.dt!, dt);
    });
    velocity.swap();
    run(P.divergence, divergence, texel, () => bind(P.divergence, 'uVelocity', velocity.read));
    run(P.scale, pressure.write, texel, () => {
      bind(P.scale, 'uTexture', pressure.read);
      gl.uniform1f(P.scale.u.value!, PRESSURE_KEEP);
    });
    pressure.swap();
    for (let i = 0; i < PRESSURE_STEPS; i++) {
      run(P.pressure, pressure.write, texel, () => {
        bind(P.pressure, 'uPressure', pressure.read);
        bind(P.pressure, 'uDivergence', divergence);
      });
      pressure.swap();
    }
    run(P.gradient, velocity.write, texel, () => {
      bind(P.gradient, 'uPressure', pressure.read);
      bind(P.gradient, 'uVelocity', velocity.read);
    });
    velocity.swap();
    run(P.advect, velocity.write, texel, () => {
      bind(P.advect, 'uVelocity', velocity.read);
      bind(P.advect, 'uSource', velocity.read);
      gl.uniform2f(P.advect.u.simTexel!, texel[0], texel[1]);
      gl.uniform1f(P.advect.u.dt!, dt);
      gl.uniform1f(P.advect.u.fade!, VELOCITY_FADE);
    });
    velocity.swap();
    run(P.advect, ink.write, [1 / inkW, 1 / inkH], () => {
      bind(P.advect, 'uVelocity', velocity.read);
      bind(P.advect, 'uSource', ink.read);
      gl.uniform2f(P.advect.u.simTexel!, texel[0], texel[1]);
      gl.uniform1f(P.advect.u.dt!, dt);
      gl.uniform1f(P.advect.u.fade!, INK_FADE);
    });
    ink.swap();
  };

  const draw = () => {
    const P = programs.display;
    run(P, null, [1 / inkW, 1 / inkH], () => {
      bind(P, 'uTexture', ink.read);
      gl.uniform1f(P.u.strength!, dark ? 1.05 : 1);
      gl.uniform1f(P.u.cover!, dark ? 0.3 : 0.4);
      gl.uniform1f(P.u.shade!, dark ? 1 : 0.52);
    });
  };

  // ---------- The room's colors ----------
  const root = document.documentElement;
  const probe = document.createElement('canvas').getContext('2d')!;
  const rgb = (css: string): [number, number, number] => {
    probe.fillStyle = '#000';
    probe.fillStyle = css;
    const v = probe.fillStyle;
    if (v.startsWith('#')) return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16) / 255) as [number, number, number];
    const m = v.match(/[\d.]+/g) ?? ['0', '0', '0'];
    return [0, 1, 2].map((i) => Number(m[i]) / 255) as [number, number, number];
  };
  let glow: [number, number, number] = [0.25, 0.75, 0.6];
  let glow2: [number, number, number] = [0.94, 0.72, 0.55];
  let dark = false;
  const readColors = () => {
    const s = getComputedStyle(root);
    glow = rgb(s.getPropertyValue('--glow').trim() || '#3fbf9a');
    glow2 = rgb(s.getPropertyValue('--glow-2').trim() || '#f0b98c');
    dark = root.dataset.theme === 'dark';
  };

  // ---------- Near text, the ink thins out ----------
  const TEXT = 'p, h1, h2, h3, h4, li, dt, dd, figcaption, blockquote, label, time, a, button, summary, .chip';
  const nearText = (x: number, y: number) =>
    [[0, 0], [44, 0], [-44, 0], [0, 44], [0, -44]].some(([dx, dy]) => {
      const el = document.elementFromPoint(x + dx!, y + dy!);
      return !!el && el !== canvas && !!el.closest(TEXT);
    });

  // ---------- Loop ----------
  const pointer = { x: 0, y: 0, px: 0, py: 0, moved: false, fresh: true };
  let quiet = 0, wantQuiet = 0, sampledAt = 0, lastStir = -1e9, last = 0, raf = 0, on = false;

  const show = (v: boolean) => {
    if (on === v) return;
    on = v;
    canvas.classList.toggle('on', v);
  };

  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    if (pointer.moved) {
      pointer.moved = false;
      if (now - sampledAt > 90) {
        sampledAt = now;
        wantQuiet = nearText(pointer.x, pointer.y) ? 1 : 0;
      }
      const w = innerWidth, h = innerHeight;
      const dx = (pointer.x - pointer.px) / w;
      const dy = (pointer.y - pointer.py) / h;
      pointer.px = pointer.x;
      pointer.py = pointer.y;
      if (dx || dy) {
        // Drift between the two room colors, and put down more ink the faster the stroke.
        const k = 0.5 + 0.5 * Math.sin(now / 1400);
        const speed = Math.min(1, Math.hypot(dx, dy) * 40);
        const amount = (dark ? 0.12 : 0.3) * (0.35 + 0.65 * speed) * (1 - 0.9 * quiet);
        const c = glow.map((g, i) => (g * (1 - k) + glow2[i]! * k) * amount) as [number, number, number];
        splat(pointer.x / w, 1 - pointer.y / h, dx * FORCE, -dy * FORCE, c);
      }
    }
    quiet += (wantQuiet - quiet) * 0.14;
    step(dt);
    draw();
    if (now - lastStir < IDLE_MS && !document.hidden) raf = requestAnimationFrame(frame);
    else {
      raf = 0;
      show(false);
    }
  };

  addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse' || reduce.matches) return;
      if (pointer.fresh || !raf) {
        pointer.px = e.clientX;
        pointer.py = e.clientY;
        pointer.fresh = false;
      }
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.moved = true;
      lastStir = performance.now();
      if (!raf) {
        show(true);
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    },
    { passive: true },
  );

  let resizing = 0;
  addEventListener('resize', () => {
    clearTimeout(resizing);
    resizing = window.setTimeout(size, 150);
  });
  document.addEventListener('deck:refresh', readColors);
  document.addEventListener('deck:change', () => setTimeout(readColors, 0));
  new MutationObserver(readColors).observe(root, { attributes: true, attributeFilter: ['data-theme', 'style'] });
  readColors();

  root.classList.add('has-fluid');
  return true;
}
