// The HUD: health, money, wanted stars, the minimap, the mission objective and
// the messages. Everything is drawn on the same canvas as the world, in logical
// 1280x720 coordinates, so the screenshots carry the whole interface.
import { FONT, PALETTE, VIEW, WANTED_MAX, WORLD } from './config.js';

const MAP_SIZE = 184;
const MAP_X = VIEW.width - MAP_SIZE - 16;
const MAP_Y = 16;

export function createHud() {
  const fonts = new Map();
  function text(ctx, value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    ctx.font = fonts.get(size);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = baseline || 'top';
    ctx.fillText(value, x, y);
  }

  function panel(ctx, x, y, w, h) {
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.fillRect(x, y, w, h);
  }

  function drawStars(ctx, wanted, x, y) {
    for (let i = 0; i < WANTED_MAX; i += 1) {
      ctx.fillStyle = i < wanted ? PALETTE.hudGold : 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      const cx = x + i * 26;
      const cy = y + 11;
      for (let p = 0; p < 10; p += 1) {
        const r = p % 2 === 0 ? 11 : 4.5;
        const a = -Math.PI / 2 + (p * Math.PI) / 5;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (p === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawMinimap(ctx, game, time) {
    panel(ctx, MAP_X - 6, MAP_Y - 6, MAP_SIZE + 12, MAP_SIZE + 12);
    const scale = MAP_SIZE / Math.max(WORLD.width, WORLD.height);
    const ox = MAP_X;
    const oy = MAP_Y;
    // Ground and water, bright enough to read at a glance in the corner.
    ctx.fillStyle = '#3d6b3f';
    ctx.fillRect(ox, oy, MAP_SIZE, MAP_SIZE * (WORLD.height / WORLD.width));
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(ox, oy + (2320 - 0) * scale, MAP_SIZE, MAP_SIZE * 0.05);
    ctx.fillRect(ox + 3040 * scale, oy, MAP_SIZE * 0.05, MAP_SIZE);
    // Roads.
    ctx.fillStyle = '#7a7268';
    for (const r of game.city.roads) {
      ctx.fillRect(ox + r.x * scale, oy + r.y * scale, Math.max(1, r.w * scale), Math.max(1, r.h * scale));
    }
    // Buildings.
    ctx.fillStyle = '#b5a88f';
    for (const b of game.city.buildings) {
      if (b.park) continue;
      ctx.fillRect(ox + b.x * scale, oy + b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
    }
    // Mission marker, pulsing.
    const marker = game.missions.marker();
    if (marker) {
      const pulse = 3 + Math.sin(time * 4) * 1.5;
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.arc(ox + marker.x * scale, oy + marker.y * scale, pulse + 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(ox + marker.x * scale, oy + marker.y * scale, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police cars.
    for (const car of game.police.cars) {
      ctx.fillStyle = car.flashing > 0.4 ? PALETTE.policeLightRed : PALETTE.policeLightBlue;
      ctx.beginPath();
      ctx.arc(ox + car.x * scale, oy + car.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // The player, as a white arrow.
    const px = ox + game.player.state.x * scale;
    const py = oy + game.player.state.y * scale;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(game.player.state.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -4.5);
    ctx.lineTo(-5, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    text(ctx, game.player.district(), MAP_X, MAP_Y + MAP_SIZE + 12, 16, PALETTE.hudText, 'left');
  }

  return {
    /** Draw the whole HUD over the world frame. */
    draw(ctx, game, time) {
      const p = game.player.state;
      // Top-left: health, money, wanted.
      panel(ctx, 16, 16, 300, 96);
      text(ctx, 'HEALTH', 28, 26, 14, '#9fb3c8', 'left');
      ctx.fillStyle = '#3a2020';
      ctx.fillRect(28, 46, 180, 14);
      ctx.fillStyle = p.health > 30 ? PALETTE.hudGreen : PALETTE.hudRed;
      ctx.fillRect(28, 46, Math.max(0, 180 * (p.health / 100)), 14);
      text(ctx, '$' + p.money.toLocaleString('en-US'), 28, 66, 26, PALETTE.hudGold, 'left');
      text(ctx, 'AMMO ' + p.ammo, 216, 70, 16, PALETTE.hudText, 'left');
      drawStars(ctx, p.wanted, 28, 88 - 16 + 26);
      // Wanted label.
      if (p.wanted > 0) text(ctx, 'WANTED', 168, 92, 14, PALETTE.hudRed, 'left');
      // Minimap.
      drawMinimap(ctx, game, time);
      // Mission objective, bottom centre. When the player is wanted and no
      // mission is running, the job is to lose the cops.
      let objective = game.missions.objective();
      if (game.player.state.wanted > 0 && !game.missions.active) objective = 'Lose the cops!';
      const marker = game.missions.marker();
      let line = objective;
      if (marker) {
        const dist = Math.round(Math.hypot(marker.x - p.x, marker.y - p.y));
        line += '  —  ' + dist + 'm';
      }
      ctx.textAlign = 'center';
      const w = ctx.measureText(line).width + 36;
      panel(ctx, (VIEW.width - w) / 2, VIEW.height - 52, w, 36);
      text(ctx, line, VIEW.width / 2, VIEW.height - 43, 18, PALETTE.missionText, 'center');
      // Toast message. Measure with the toast's own font, so the panel fits it.
      if (game.missions.messageTimer > 0 && game.missions.message) {
        const msg = game.missions.message;
        ctx.font = `18px ${FONT}`;
        const mw = Math.min(VIEW.width - 32, ctx.measureText(msg).width + 36);
        panel(ctx, (VIEW.width - mw) / 2, 128, mw, 40);
        text(ctx, msg, VIEW.width / 2, 138, 18, PALETTE.hudText, 'center');
      }
      // Context hint, bottom left.
      if (game.hint) {
        text(ctx, game.hint, 16, VIEW.height - 30, 17, PALETTE.hudText, 'left');
      }
      // Speed, bottom right, when driving.
      if (p.inCar) {
        const kmh = Math.round(Math.abs(p.inCar.speed) * 0.36);
        text(ctx, kmh + ' km/h', VIEW.width - 16, VIEW.height - 30, 20, PALETTE.hudText, 'right');
      }
    },
  };
}
