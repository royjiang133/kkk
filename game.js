(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const startBtn = document.getElementById("start");
  const scoreEl = document.getElementById("score");
  const comboEl = document.getElementById("combo");
  const bestEl = document.getElementById("best");

  const RINGS = [118, 176, 236];
  const STORAGE_KEY = "aether-loop-best";

  const state = {
    running: false,
    time: 0,
    last: 0,
    score: 0,
    combo: 1,
    comboTimer: 0,
    best: Number(localStorage.getItem(STORAGE_KEY) || 0),
    ring: 1,
    radius: RINGS[1],
    radiusVel: 0,
    angle: -Math.PI / 2,
    dir: 1,
    omega: 1.05,
    speed: 1.05,
    heading: Math.PI / 2,
    shake: 0,
    shakeX: 0,
    shakeY: 0,
    safe: 0,
    glow: [0.16, 0.7, 0.16],
    items: [],
    sparks: [],
    stars: [],
    trail: [],
  };

  bestEl.textContent = String(state.best);

  function damp(current, target, lambda, dt) {
    return current + (target - current) * (1 - Math.exp(-lambda * dt));
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }

  function center() {
    const rect = canvas.getBoundingClientRect();
    return { x: rect.width / 2, y: rect.height / 2 + 8 };
  }

  function seedStars() {
    const rect = canvas.getBoundingClientRect();
    state.stars = Array.from({ length: 110 }, () => ({
      x: Math.random() * rect.width,
      y: Math.random() * rect.height,
      r: Math.random() * 1.5 + 0.25,
      a: Math.random() * 0.55 + 0.12,
      tw: Math.random() * Math.PI * 2,
      depth: Math.random() * 0.6 + 0.2,
    }));
  }

  function angDist(a, b) {
    let d = Math.abs(a - b) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    return d;
  }

  function resetRun() {
    state.score = 0;
    state.combo = 1;
    state.comboTimer = 0;
    state.ring = 1;
    state.radius = RINGS[1];
    state.radiusVel = 0;
    state.angle = -Math.PI / 2;
    state.dir = 1;
    state.speed = 1.05;
    state.omega = 1.05;
    state.heading = Math.PI / 2;
    state.time = 0;
    state.safe = 1.6;
    state.shake = 0;
    state.shakeX = 0;
    state.shakeY = 0;
    state.glow = [0.16, 0.7, 0.16];
    state.items = [];
    state.sparks = [];
    state.trail = [];
    spawnWave(true);
    updateHud();
  }

  function pulseHud(el) {
    el.style.transform = "translateY(-2px)";
    el.style.opacity = "0.72";
    requestAnimationFrame(() => {
      el.style.transform = "translateY(0)";
      el.style.opacity = "1";
    });
  }

  function updateHud() {
    const score = String(Math.floor(state.score));
    if (scoreEl.textContent !== score) {
      scoreEl.textContent = score;
      pulseHud(scoreEl);
    }
    const combo = `x${state.combo}`;
    if (comboEl.textContent !== combo) {
      comboEl.textContent = combo;
      pulseHud(comboEl);
    }
    bestEl.textContent = String(state.best);
  }

  function spawnItem(kind, preferFar) {
    let ring = Math.floor(Math.random() * 3);
    let angle = Math.random() * Math.PI * 2;
    for (let n = 0; n < 8; n += 1) {
      ring = Math.floor(Math.random() * 3);
      angle = Math.random() * Math.PI * 2;
      const tooClose = ring === state.ring && angDist(angle, state.angle) < (preferFar ? 1.35 : 0.85);
      if (!tooClose) break;
    }
    state.items.push({
      kind,
      ring,
      angle,
      spin: (Math.random() - 0.5) * 1.2,
      appear: 0,
    });
  }

  function spawnWave(initial) {
    const count = initial ? 6 : 1;
    for (let i = 0; i < count; i += 1) {
      const kind = Math.random() < 0.64 ? "shard" : "debris";
      spawnItem(kind, initial);
    }
  }

  function playerPos() {
    const c = center();
    return {
      x: c.x + Math.cos(state.angle) * state.radius,
      y: c.y + Math.sin(state.angle) * state.radius,
    };
  }

  function addSparks(x, y, color, n = 12) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 140 + 30;
      state.sparks.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 1,
        size: Math.random() * 2.2 + 1.2,
        color,
      });
    }
  }

  function startGame() {
    overlay.classList.add("hidden");
    resetRun();
    state.running = true;
    state.last = performance.now();
  }

  function gameOver() {
    state.running = false;
    state.best = Math.max(state.best, Math.floor(state.score));
    localStorage.setItem(STORAGE_KEY, String(state.best));
    updateHud();
    overlay.querySelector("h1").textContent = "Orbit collapsed";
    overlay.querySelector(".lede").textContent = `Score ${Math.floor(state.score)} · Best ${state.best}`;
    overlay.querySelector("button").textContent = "Re-enter";
    overlay.classList.remove("hidden");
  }

  function changeRing(delta) {
    if (!state.running) return;
    state.ring = Math.max(0, Math.min(2, state.ring + delta));
  }

  function reverse() {
    if (!state.running) return;
    state.dir *= -1;
    const p = playerPos();
    addSparks(p.x, p.y, "#5ce1ff", 10);
  }

  function collide() {
    if (state.safe > 0) return;
    const p = playerPos();
    const hitR = 14;
    for (let i = state.items.length - 1; i >= 0; i -= 1) {
      const item = state.items[i];
      if (item.appear < 0.55) continue;
      const c = center();
      const r = RINGS[item.ring];
      const x = c.x + Math.cos(item.angle) * r;
      const y = c.y + Math.sin(item.angle) * r;
      const dist = Math.hypot(x - p.x, y - p.y);
      const radius = item.kind === "shard" ? 12 : 14;
      if (dist < hitR + radius) {
        if (item.kind === "shard") {
          state.comboTimer = 2.4;
          state.combo = Math.min(8, state.combo + 1);
          state.score += 80 * state.combo;
          addSparks(x, y, "#ffd56a", 14);
          state.items.splice(i, 1);
        } else {
          addSparks(p.x, p.y, "#ff6ad5", 26);
          state.shake = 10;
          state.shakeX = (p.x - c.x) * 0.04;
          state.shakeY = (p.y - c.y) * 0.04;
          gameOver();
          return;
        }
      }
    }
  }

  function update(dt) {
    state.time += dt;
    state.safe = Math.max(0, state.safe - dt);

    const targetSpeed = 1.05 + Math.min(1.55, state.time * 0.028);
    state.speed = damp(state.speed, targetSpeed, 1.8, dt);
    state.omega = damp(state.omega, state.dir * state.speed, 7.5, dt);
    state.angle += state.omega * dt;
    state.heading = damp(state.heading, state.omega >= 0 ? Math.PI / 2 : -Math.PI / 2, 8.5, dt);

    const targetR = RINGS[state.ring];
    state.radiusVel += (targetR - state.radius) * 22 * dt;
    state.radiusVel *= Math.exp(-9.5 * dt);
    state.radius += state.radiusVel * dt;

    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 1;

    state.shake = Math.max(0, state.shake - dt * 14);
    state.shakeX = damp(state.shakeX, 0, 8, dt);
    state.shakeY = damp(state.shakeY, 0, 8, dt);

    for (let i = 0; i < 3; i += 1) {
      state.glow[i] = damp(state.glow[i], i === state.ring ? 0.72 : 0.16, 7, dt);
    }

    if (Math.random() < 0.58 * dt + state.time * 0.0026 * dt) spawnWave(false);
    if (state.items.length > 22) state.items.splice(0, state.items.length - 22);

    for (const item of state.items) {
      item.angle += item.spin * dt * 0.12;
      item.appear = Math.min(1, item.appear + dt * 2.4);
    }

    for (let i = state.sparks.length - 1; i >= 0; i -= 1) {
      const s = state.sparks[i];
      s.vx *= Math.exp(-1.8 * dt);
      s.vy *= Math.exp(-1.8 * dt);
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt * 1.35;
      if (s.life <= 0) state.sparks.splice(i, 1);
    }

    const p = playerPos();
    state.trail.push({ x: p.x, y: p.y, life: 1 });
    if (state.trail.length > 18) state.trail.shift();
    for (const t of state.trail) t.life -= dt * 3.2;
    state.trail = state.trail.filter((t) => t.life > 0);

    collide();
    updateHud();
  }

  function drawCore(c) {
    const pulse = 18 + Math.sin(state.time * 1.8) * 3.2;
    const g = ctx.createRadialGradient(c.x, c.y, 6, c.x, c.y, 108);
    g.addColorStop(0, "rgba(255, 213, 106, 0.92)");
    g.addColorStop(0.32, "rgba(255, 106, 213, 0.28)");
    g.addColorStop(1, "rgba(92, 225, 255, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 108, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff6d8";
    ctx.beginPath();
    ctx.arc(c.x, c.y, pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRings(c) {
    RINGS.forEach((r, i) => {
      ctx.strokeStyle = `rgba(92, 225, 255, ${state.glow[i]})`;
      ctx.lineWidth = 1.1 + state.glow[i] * 2.4;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  function drawItems(c) {
    for (const item of state.items) {
      const r = RINGS[item.ring];
      const x = c.x + Math.cos(item.angle) * r;
      const y = c.y + Math.sin(item.angle) * r;
      ctx.save();
      ctx.globalAlpha = item.appear;
      ctx.translate(x, y);
      ctx.rotate(item.angle + state.time * 0.7);
      const scale = 0.82 + item.appear * 0.18;
      ctx.scale(scale, scale);
      if (item.kind === "shard") {
        ctx.fillStyle = "#ffd56a";
        ctx.shadowColor = "#ffd56a";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(8, 0);
        ctx.lineTo(0, 11);
        ctx.lineTo(-8, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = "#ff6ad5";
        ctx.shadowColor = "#ff6ad5";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(3, 8);
        ctx.lineTo(-9, 5);
        ctx.lineTo(-7, -6);
        ctx.lineTo(4, -9);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawTrail() {
    for (let i = 0; i < state.trail.length; i += 1) {
      const t = state.trail[i];
      ctx.beginPath();
      ctx.fillStyle = `rgba(92, 225, 255, ${t.life * 0.22})`;
      ctx.arc(t.x, t.y, 2 + t.life * 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawShip() {
    const p = playerPos();
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(state.angle + state.heading);
    ctx.globalAlpha = state.safe > 0 ? 0.62 + Math.sin(state.time * 10) * 0.18 : 1;

    ctx.fillStyle = "rgba(92, 225, 255, 0.28)";
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-8, 5);
    ctx.lineTo(-8, -5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#5ce1ff";
    ctx.shadowColor = "#5ce1ff";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-11, 9);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-11, -9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    const rect = canvas.getBoundingClientRect();
    const c = center();
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.save();
    const sx = state.shakeX + Math.sin(state.time * 28) * state.shake * 0.18;
    const sy = state.shakeY + Math.cos(state.time * 24) * state.shake * 0.18;
    ctx.translate(sx, sy);

    for (const star of state.stars) {
      const drift = state.time * (8 + star.depth * 14);
      const x = (star.x + drift) % rect.width;
      const tw = 0.28 + Math.abs(Math.sin(state.time * 1.15 + star.tw)) * star.a;
      ctx.fillStyle = `rgba(200, 231, 255, ${tw})`;
      ctx.beginPath();
      ctx.arc(x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }

    drawCore(c);
    drawRings(c);
    drawItems(c);
    drawTrail();
    drawShip();

    for (const s of state.sparks) {
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - state.last) / 1000 || 0.016);
    state.last = now;
    if (state.running) update(dt);
    else {
      state.time += dt * 0.35;
      state.omega = damp(state.omega, 0.42, 2.2, dt);
      state.angle += state.omega * dt;
      state.radius = damp(state.radius, RINGS[1], 2.4, dt);
    }
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
    if (!state.running && (e.key === " " || e.key === "Enter")) {
      startGame();
      return;
    }
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") changeRing(-1);
    if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") changeRing(1);
    if (e.key === " ") reverse();
  });

  canvas.addEventListener("pointerdown", (e) => {
    if (!state.running) {
      startGame();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (y < rect.height * 0.28) changeRing(-1);
    else if (y > rect.height * 0.72) changeRing(1);
    else reverse();
  });

  startBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    startGame();
  });

  window.addEventListener("resize", () => {
    resize();
    seedStars();
  });

  resize();
  seedStars();
  requestAnimationFrame(loop);
})();
