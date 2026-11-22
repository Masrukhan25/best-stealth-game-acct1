// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x800 playfield is scaled to fit the window and centred: the map fills the
// top 720 pixels and the HUD strip fills the bottom 80. Night first, then warm
// lamp pools, then a darkness mask with holes cut at every light, then cones,
// people and the HUD. Flat shapes and canvas text only — no images, no network.
import { FIELD, FONT, FONT_UI, LEVEL_COUNT, PALETTE } from './config.js';
import { conePoints } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_RESULTS = 'results';
export const SCREEN_FAILED = 'failed';

const HUD_Y = FIELD.mapHeight;

function hash(col, row) {
  const s = Math.sin(col * 127.1 + row * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function createRenderer(canvas, world) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const dark = document.createElement('canvas');
  dark.width = FIELD.width;
  dark.height = FIELD.mapHeight;
  const darkCtx = dark.getContext('2d');
  const fonts = new Map();
  const serif = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function font(size, serifFont) {
    const map = serifFont ? serif : fonts;
    if (!map.has(size)) map.set(size, `${serifFont ? 'italic ' : ''}${size}px ${serifFont ? FONT : FONT_UI}`);
    return map.get(size);
  }

  function text(value, x, y, size, color, align = 'left', serifFont = false, baseline = 'alphabetic') {
    context.font = font(size, serifFont);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  function tileRect(col, row) {
    return { x: col * FIELD.tile, y: row * FIELD.tile, w: FIELD.tile, h: FIELD.tile };
  }

  function drawFloor(state) {
    const grid = state.grid;
    for (let row = 0; row < FIELD.rows; row += 1) {
      for (let col = 0; col < FIELD.cols; col += 1) {
        const r = tileRect(col, row);
        const ch = grid[row][col];
        const alt = (col + row) % 2 === 0;
        if (ch === '#') {
          context.fillStyle = PALETTE.wall;
          context.fillRect(r.x, r.y, r.w, r.h);
          context.fillStyle = PALETTE.wallTop;
          context.fillRect(r.x, r.y, r.w, 4);
          continue;
        }
        context.fillStyle = alt ? PALETTE.floor : PALETTE.floorAlt;
        context.fillRect(r.x, r.y, r.w, r.h);
        // Speckles so the floor reads as stone, not plastic.
        const h = hash(col, row);
        if (h > 0.6) {
          context.fillStyle = 'rgba(255,255,255,0.03)';
          context.fillRect(r.x + 8 + h * 16, r.y + 8 + (1 - h) * 16, 3, 3);
        }
        if (ch === '~') {
          context.fillStyle = PALETTE.water;
          context.fillRect(r.x, r.y, r.w, r.h);
          context.fillStyle = PALETTE.waterEdge;
          context.fillRect(r.x, r.y + 6 + Math.sin((state.elapsed * 2 + col) * 1.3) * 3, r.w, 2);
        } else if (ch === ',') {
          context.fillStyle = PALETTE.grass;
          context.fillRect(r.x, r.y, r.w, r.h);
          context.strokeStyle = PALETTE.grassDark;
          context.lineWidth = 2;
          for (let t = 0; t < 4; t += 1) {
            const tx = r.x + 6 + t * 9 + hash(col + t, row) * 4;
            context.beginPath();
            context.moveTo(tx, r.y + r.h - 6);
            context.lineTo(tx + 2, r.y + 12 + hash(col, row + t) * 8);
            context.stroke();
          }
        }
      }
    }
  }

  function drawCover(state) {
    const grid = state.grid;
    for (let row = 0; row < FIELD.rows; row += 1) {
      for (let col = 0; col < FIELD.cols; col += 1) {
        const r = tileRect(col, row);
        const ch = grid[row][col];
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        if (ch === 'C') {
          context.fillStyle = PALETTE.crate;
          context.fillRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8);
          context.strokeStyle = PALETTE.crateEdge;
          context.lineWidth = 2;
          context.strokeRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8);
          context.beginPath();
          context.moveTo(r.x + 4, r.y + 4);
          context.lineTo(r.x + r.w - 4, r.y + r.h - 4);
          context.moveTo(r.x + r.w - 4, r.y + 4);
          context.lineTo(r.x + 4, r.y + r.h - 4);
          context.stroke();
        } else if (ch === 'P') {
          context.fillStyle = PALETTE.pillar;
          context.beginPath();
          context.arc(cx, cy, 15, 0, Math.PI * 2);
          context.fill();
          context.strokeStyle = PALETTE.pillarEdge;
          context.lineWidth = 2;
          context.stroke();
          context.fillStyle = PALETTE.pillarEdge;
          context.beginPath();
          context.arc(cx, cy, 6, 0, Math.PI * 2);
          context.fill();
        } else if (ch === 'T') {
          context.fillStyle = PALETTE.planter;
          context.fillRect(r.x + 5, r.y + 8, r.w - 10, r.h - 14);
          context.strokeStyle = PALETTE.planterEdge;
          context.lineWidth = 2;
          context.strokeRect(r.x + 5, r.y + 8, r.w - 10, r.h - 14);
          context.fillStyle = '#5d9b52';
          for (let t = 0; t < 5; t += 1) {
            context.beginPath();
            context.arc(r.x + 9 + t * 6, r.y + 10 + (t % 2) * 5, 5, 0, Math.PI * 2);
            context.fill();
          }
        } else if (ch === 'S') {
          context.fillStyle = PALETTE.shelf;
          context.fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
          context.strokeStyle = PALETTE.shelfEdge;
          context.lineWidth = 2;
          context.strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
          context.fillStyle = '#8a6b45';
          context.fillRect(r.x + 7, r.y + 9, r.w - 14, 4);
          context.fillRect(r.x + 7, r.y + 22, r.w - 14, 4);
        } else if (ch === 'L') {
          // The lamp post; its glow is painted in the light pass.
          context.fillStyle = '#3a3f4a';
          context.fillRect(cx - 2, cy - 14, 4, 28);
          context.fillStyle = PALETTE.lampHot;
          context.beginPath();
          context.arc(cx, cy - 14, 6, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
  }

  function drawLightPools(state) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    for (const lamp of state.lamps) {
      if (!lamp.on) continue;
      const grad = context.createRadialGradient(lamp.x, lamp.y, 8, lamp.x, lamp.y, lamp.radius);
      grad.addColorStop(0, 'rgba(255, 210, 122, 0.30)');
      grad.addColorStop(0.6, 'rgba(255, 190, 90, 0.12)');
      grad.addColorStop(1, 'rgba(255, 190, 90, 0)');
      context.fillStyle = grad;
      context.fillRect(lamp.x - lamp.radius, lamp.y - lamp.radius, lamp.radius * 2, lamp.radius * 2);
    }
    context.restore();
  }

  function drawDarkness(state) {
    darkCtx.setTransform(1, 0, 0, 1, 0, 0);
    darkCtx.clearRect(0, 0, FIELD.width, FIELD.mapHeight);
    darkCtx.fillStyle = 'rgba(5, 7, 12, 0.48)';
    darkCtx.fillRect(0, 0, FIELD.width, FIELD.mapHeight);
    darkCtx.globalCompositeOperation = 'destination-out';
    function hole(x, y, radius, strength) {
      const grad = darkCtx.createRadialGradient(x, y, 4, x, y, radius);
      grad.addColorStop(0, `rgba(0,0,0,${strength})`);
      grad.addColorStop(0.7, `rgba(0,0,0,${strength * 0.6})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      darkCtx.fillStyle = grad;
      darkCtx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    for (const lamp of state.lamps) if (lamp.on) hole(lamp.x, lamp.y, lamp.radius + 45, 0.95);
    for (const guard of world.guards.guards) hole(guard.x, guard.y, 84, 0.85);
    hole(state.player.x, state.player.y, 52, 0.7);
    darkCtx.globalCompositeOperation = 'source-over';
    context.drawImage(dark, 0, 0);
  }

  function drawCones(state) {
    const cones = world.guards.conePolygons(state);
    for (const cone of cones) {
      let fill = PALETTE.conePatrol;
      if (cone.state === 'alerted') fill = PALETTE.coneAlert;
      else if (cone.state === 'search' || cone.state === 'investigate') fill = PALETTE.coneSearch;
      else if (cone.state === 'suspicious') fill = PALETTE.coneSuspicious;
      else if (cone.state === 'camera') fill = 'rgba(232, 177, 60, 0.20)';
      context.fillStyle = fill;
      context.beginPath();
      context.moveTo(cone.points[0].x, cone.points[0].y);
      for (let i = 1; i < cone.points.length; i += 1) context.lineTo(cone.points[i].x, cone.points[i].y);
      context.closePath();
      context.fill();
      // The cone's rim, so its edge reads at a glance even shrunk.
      context.strokeStyle = fill.replace(/0\.\d+\)/, '0.55)');
      context.lineWidth = 1.5;
      context.stroke();
    }
  }

  function drawItems(state) {
    // The green hatch: locked chains, or open and glowing once the prize is taken.
    const exit = state.exit;
    context.save();
    context.translate(exit.x, exit.y);
    context.fillStyle = state.exit.open ? PALETTE.exit : PALETTE.exitDark;
    context.beginPath();
    context.arc(0, 0, 18, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#0d3d24';
    context.lineWidth = 2;
    context.stroke();
    context.strokeStyle = state.exit.open ? '#d8ffe9' : '#9fb8a8';
    context.beginPath();
    context.moveTo(-10, -4);
    context.lineTo(10, -4);
    context.moveTo(-10, 4);
    context.lineTo(10, 4);
    context.stroke();
    if (!state.exit.open) {
      context.strokeStyle = '#c8ccd4';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(-12, -12);
      context.lineTo(12, 12);
      context.moveTo(12, -12);
      context.lineTo(-12, 12);
      context.stroke();
    } else {
      const pulse = 0.5 + Math.sin(state.elapsed * 4) * 0.3;
      context.fillStyle = `rgba(57, 217, 138, ${0.25 + pulse * 0.2})`;
      context.beginPath();
      context.arc(0, 0, 24 + pulse * 4, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    text('EXIT', exit.x, exit.y - 26, 12, state.exit.open ? PALETTE.exit : PALETTE.muted, 'center');

    // Loot: small gold coins that glint.
    for (const loot of state.loot) {
      if (loot.taken) continue;
      const glint = 0.7 + Math.sin(state.elapsed * 3 + loot.x) * 0.3;
      context.fillStyle = PALETTE.loot;
      context.globalAlpha = glint;
      context.beginPath();
      context.arc(loot.x, loot.y, 7, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      context.fillStyle = '#7a5b12';
      context.beginPath();
      context.arc(loot.x, loot.y, 3, 0, Math.PI * 2);
      context.fill();
    }

    // The prize: a glowing gem the whole heist is about.
    if (!state.prize.taken) {
      const pulse = 0.6 + Math.sin(state.elapsed * 3) * 0.4;
      context.save();
      context.translate(state.prize.x, state.prize.y);
      context.rotate(Math.PI / 4);
      context.fillStyle = `rgba(255, 209, 102, ${0.25 + pulse * 0.2})`;
      context.fillRect(-18, -18, 36, 36);
      context.fillStyle = PALETTE.prize;
      context.fillRect(-10, -10, 20, 20);
      context.fillStyle = '#fff3c4';
      context.fillRect(-5, -5, 10, 10);
      context.restore();
      text(state.level.prize.toUpperCase(), state.prize.x, state.prize.y - 26, 12, PALETTE.prize, 'center');
    }

    // Thrown coins lie where they landed, still glinting.
    for (const coin of state.coins) {
      context.fillStyle = PALETTE.loot;
      context.beginPath();
      context.arc(coin.x, coin.y, 5, 0, Math.PI * 2);
      context.fill();
      if (!coin.landed) {
        context.strokeStyle = 'rgba(255, 209, 102, 0.5)';
        context.beginPath();
        context.moveTo(coin.x - coin.vx * 0.05, coin.y - coin.vy * 0.05);
        context.lineTo(coin.x, coin.y);
        context.stroke();
      }
    }
    // Smoke hangs grey and thick; the cricket ticks along, chirping.
    for (const smoke of state.smokes) {
      context.fillStyle = `rgba(180, 185, 195, ${Math.min(0.55, smoke.ttl / 6 + 0.2)})`;
      context.beginPath();
      context.arc(smoke.x, smoke.y, smoke.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(220, 224, 230, 0.25)';
      context.beginPath();
      context.arc(smoke.x - 20, smoke.y - 12, smoke.radius * 0.5, 0, Math.PI * 2);
      context.fill();
    }
    for (const cricket of state.crickets) {
      context.fillStyle = '#c9a227';
      context.beginPath();
      context.arc(cricket.x, cricket.y, 6, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#7a5b12';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(cricket.x, cricket.y - 6);
      context.lineTo(cricket.x + 8, cricket.y - 12);
      context.stroke();
    }
  }

  function drawPeople(state) {
    const player = state.player;
    // A soft teal glow under the thief so they read at a glance, even shrunk.
    const glow = context.createRadialGradient(player.x, player.y, 2, player.x, player.y, 34);
    glow.addColorStop(0, 'rgba(111, 240, 221, 0.35)');
    glow.addColorStop(1, 'rgba(111, 240, 221, 0)');
    context.fillStyle = glow;
    context.fillRect(player.x - 34, player.y - 34, 68, 68);
    // The thief: a teal hood, crouched small when sneaking, half-lost in tall grass.
    context.save();
    if (player.inGrass) context.globalAlpha = 0.55;
    context.translate(player.x, player.y);
    context.rotate(player.facing);
    const crouch = player.gait === 'sneak' ? 0.8 : 1;
    context.fillStyle = PALETTE.playerDark;
    context.beginPath();
    context.moveTo(14 * crouch, 0);
    context.lineTo(-10, -11 * crouch);
    context.lineTo(-10, 11 * crouch);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(0, 0, 10 * crouch, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#0d3d38';
    context.beginPath();
    context.arc(4, 0, 4, 0, Math.PI * 2);
    context.fill();
    context.restore();

    for (const guard of world.guards.guards) {
      context.save();
      context.translate(guard.x, guard.y);
      // The lantern each guard carries: a warm dot that moves with them.
      const glow = context.createRadialGradient(0, 0, 2, 0, 0, 30);
      glow.addColorStop(0, 'rgba(255, 210, 122, 0.5)');
      glow.addColorStop(1, 'rgba(255, 210, 122, 0)');
      context.fillStyle = glow;
      context.fillRect(-30, -30, 60, 60);
      context.rotate(guard.facing);
      context.fillStyle = PALETTE.guardDark;
      context.beginPath();
      context.moveTo(16, 0);
      context.lineTo(-11, -12);
      context.lineTo(-11, 12);
      context.closePath();
      context.fill();
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(0, 0, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffd27a';
      context.beginPath();
      context.arc(12, 0, 3.5, 0, Math.PI * 2);
      context.fill();
      context.restore();
      // Suspicion arc over the head: the meter the player reads.
      if (guard.suspicion > 2) {
        const frac = guard.suspicion / 100;
        context.strokeStyle = 'rgba(0,0,0,0.6)';
        context.lineWidth = 5;
        context.beginPath();
        context.arc(guard.x, guard.y - 22, 9, -Math.PI / 2, Math.PI * 1.5);
        context.stroke();
        context.strokeStyle = guard.state === 'alerted' ? PALETTE.red : PALETTE.gold;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(guard.x, guard.y - 22, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
        context.stroke();
      }
      if (guard.state !== 'patrol') {
        text(`${guard.name} — ${guard.state.toUpperCase()}`, guard.x, guard.y - 34, 11, guard.state === 'alerted' ? PALETTE.red : PALETTE.gold, 'center');
      }
    }

    for (const camera of world.guards.cameras) {
      context.fillStyle = PALETTE.camera;
      context.beginPath();
      context.arc(camera.x, camera.y, 8, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#3a2f10';
      context.beginPath();
      context.arc(camera.x + Math.cos(camera.angle) * 5, camera.y + Math.sin(camera.angle) * 5, 3, 0, Math.PI * 2);
      context.fill();
    }
    for (const laser of world.guards.lasers) {
      const on = laser.tripTimer > 0;
      context.strokeStyle = on ? '#ff2d55' : PALETTE.laser;
      context.globalAlpha = on ? 1 : 0.75 + Math.sin(state.elapsed * 5) * 0.2;
      context.lineWidth = LASER_WIDTH;
      context.beginPath();
      context.moveTo(laser.x1, laser.y1);
      context.lineTo(laser.x2, laser.y2);
      context.stroke();
      context.globalAlpha = 1;
    }
  }

  function drawHud(state, ui) {
    context.fillStyle = PALETTE.panel;
    context.fillRect(0, HUD_Y, FIELD.width, FIELD.height - HUD_Y);
    context.fillStyle = PALETTE.panelEdge;
    context.fillRect(0, HUD_Y, FIELD.width, 2);

    // Left: the job and its objective.
    text(`${state.level.name.toUpperCase()}  ·  HEIST ${state.levelIndex + 1} OF ${LEVEL_COUNT}`, 20, HUD_Y + 28, 15, PALETTE.text, 'left', false, 'alphabetic');
    text(state.hint, 20, HUD_Y + 56, 13, PALETTE.muted, 'left', false, 'alphabetic');

    // Middle: alert state and the eye — how seen you are right now.
    const seen = ui.seen ?? 0;
    const alertLabel = state.alarm === 0 ? 'UNSEEN' : state.alarm === 1 ? 'ALARM I' : state.alarm === 2 ? 'ALARM II' : 'ALARM III';
    const alertColor = state.alarm === 0 ? PALETTE.exit : state.alarm === 1 ? PALETTE.gold : PALETTE.red;
    text(alertLabel, FIELD.width / 2 - 130, HUD_Y + 30, 15, alertColor, 'left');
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(FIELD.width / 2 - 130, HUD_Y + 40, 180, 8);
    context.fillStyle = seen > 0.66 ? PALETTE.red : seen > 0.33 ? PALETTE.gold : PALETTE.exit;
    context.fillRect(FIELD.width / 2 - 130, HUD_Y + 40, 180 * seen, 8);
    text(seen > 0.66 ? 'SEEN!' : seen > 0.05 ? 'GLIMPSED' : 'HIDDEN', FIELD.width / 2 + 60, HUD_Y + 48, 12, PALETTE.muted, 'left');

    // Right: clock, loot, gadgets, gait.
    const mins = Math.floor(state.timeLeft / 60);
    const secs = Math.floor(state.timeLeft % 60);
    const clock = `${mins}:${String(secs).padStart(2, '0')}`;
    const inv = world.guards.inventory;
    text(`${clock}   $${state.lootValue + (state.prize.taken ? state.level.prizeValue : 0)}  ·  ${state.lootTaken}/${state.loot.length} loot`, FIELD.width - 20, HUD_Y + 28, 15, state.timeLeft < 30 ? PALETTE.red : PALETTE.text, 'right');
    text(`Q coin ×${inv.coin}   F smoke ×${inv.smoke}   R douse ×${inv.douse}   G cricket ×${inv.cricket}   ·   gait ${state.player.gait.toUpperCase()} (C)   ·   ${ui.muted ? 'MUTED (M)' : 'sound on (M)'}`, FIELD.width - 20, HUD_Y + 56, 13, PALETTE.muted, 'right');
  }

  function drawAnnotations(state) {
    if (!state.annotations) return;
    for (const note of state.annotations) {
      context.strokeStyle = 'rgba(255, 233, 168, 0.9)';
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(note.labelX, note.labelY + 8);
      context.lineTo(note.x, note.y);
      context.stroke();
      context.fillStyle = 'rgba(20, 16, 8, 0.88)';
      const w = note.w ?? 220;
      context.fillRect(note.labelX - 8, note.labelY - 14, w, 26);
      context.strokeStyle = 'rgba(255, 233, 168, 0.6)';
      context.strokeRect(note.labelX - 8, note.labelY - 14, w, 26);
      text(note.text, note.labelX, note.labelY + 4, 13, '#ffe9a8', 'left', true);
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 32;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(10, 12, 18, 0.82)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent ?? PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    text(title, FIELD.width / 2, y + 64, 40, PALETTE.text, 'center', true);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 112 + i * 32, 18, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 30, 16, PALETTE.gold, 'center');
  }

  /** Paint one frame: the map, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, ui) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.save();
    context.beginPath();
    context.rect(0, 0, FIELD.width, FIELD.mapHeight);
    context.clip();
    drawFloor(state);
    drawCover(state);
    drawLightPools(state);
    drawItems(state);
    drawDarkness(state);
    drawCones(state);
    drawPeople(state);
    context.restore();
    drawAnnotations(state);
    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(8, 10, 16, 0.72)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      text('THE EMBER LEDGER', FIELD.width / 2, 150, 64, PALETTE.text, 'center', true);
      text('Five quiet heists across the canal city of Emberwick. Steal the prize,', FIELD.width / 2, 196, 19, PALETTE.muted, 'center', true);
      text('slip out through the green hatch — and never let them see you.', FIELD.width / 2, 224, 19, PALETTE.muted, 'center', true);
      text('5 HEISTS  ·  18 GUARDS  ·  33 TREASURES  ·  4 GADGETS', FIELD.width / 2, 268, 18, PALETTE.gold, 'center');
      // Level select: one line per heist, unlocked ones in gold, locked in grey.
      const unlocked = ui.unlocked ?? 1;
      for (let i = 0; i < LEVEL_COUNT; i += 1) {
        const level = state.level && i === 0 ? state.level : null;
        const y = 320 + i * 34;
        const name = ['The Salt Wharf', "The Inkbinders' Bindery", 'The Chimeworks', 'The Ember Exchange', 'The Grand Archive'][i];
        const prize = ['Brass Tide-Seal', 'Gilded Quill', "Bellmaster's Cog", "Coal-Duke's Ruby", 'The Starless Ledger'][i];
        const open = i < unlocked;
        const sel = i === (ui.selected ?? 0);
        if (sel) {
          context.fillStyle = 'rgba(255, 209, 102, 0.12)';
          context.fillRect(FIELD.width / 2 - 300, y - 22, 600, 30);
        }
        text(`${open ? '◆' : '◇'}  ${i + 1}. ${name} — ${prize}${ui.best && ui.best[i] ? `   ·   best ${ui.best[i]}` : ''}`, FIELD.width / 2, y, 17, open ? (sel ? PALETTE.gold : PALETTE.text) : PALETTE.dim, 'center');
      }
      text('Move WASD / arrows  ·  1/2/3 or C gait (sneak / walk / sprint)  ·  Q coin  F smoke  R douse  G cricket  ·  M mute  ·  P pause', FIELD.width / 2, 560, 15, PALETTE.muted, 'center');
      text('↑ ↓ choose a heist — press SPACE or click to begin', FIELD.width / 2, 596, 18, PALETTE.gold, 'center');
      return;
    }
    drawHud(state, ui);
    if (state.alarm > 0) {
      text(state.alarm === 3 ? '!!! THE HOUSE IS AWAKE — ALARM III !!!' : `ALARM LEVEL ${state.alarm} — guards are searching`, FIELD.width / 2, 30, 18, PALETTE.red, 'center', true);
    }
    if (ui.toast) {
      context.fillStyle = 'rgba(10, 12, 18, 0.85)';
      const w = 420;
      context.fillRect(FIELD.width / 2 - w / 2, 52, w, 40);
      context.strokeStyle = PALETTE.gold;
      context.strokeRect(FIELD.width / 2 - w / 2, 52, w, 40);
      text(ui.toast, FIELD.width / 2, 78, 17, PALETTE.gold, 'center', true);
    }
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards wait. The lamps burn.'], 'Press P to resume', PALETTE.gold);
    } else if (screen === SCREEN_RESULTS && state.result) {
      const r = state.result;
      const lines = [
        `Prize taken: ${r.prize}  ($${r.prizeValue})`,
        `Loot: ${r.lootTaken}/${r.lootTotal}  ($${r.lootValue})`,
        `Time ${Math.floor(r.elapsed / 60)}:${String(Math.floor(r.elapsed % 60)).padStart(2, '0')}  (par ${Math.floor(r.par / 60)}:${String(r.par % 60).padStart(2, '0')})   ·   time bonus $${r.timeBonus}`,
        r.ghost ? `GHOST BONUS +$${r.ghostBonus} — never once spotted` : `Spotted ${r.spotted} time${r.spotted === 1 ? '' : 's'} — no ghost bonus`,
        `Campaign score: $${r.campaignScore}`,
      ];
      drawPanel(`${r.rank} — ${r.levelName} CLEAR`, lines, state.levelIndex + 1 < LEVEL_COUNT ? 'Press SPACE for the next heist' : 'Press SPACE to return to the title', PALETTE.exit);
    } else if (screen === SCREEN_FAILED && state.result) {
      drawPanel('CAUGHT OUT', [state.result.reason, `Campaign score: $${state.result.campaignScore}`], 'Press SPACE to try this heist again', PALETTE.red);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}

const LASER_WIDTH = 4;
