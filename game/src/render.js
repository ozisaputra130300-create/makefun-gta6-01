// Drawing only: the city, its cars and people, the player, the effects — pixels
// out. The camera follows the player across the 3200x2400 world and shows a
// 1280x720 logical view scaled to the window. Flat shapes and canvas text, in a
// warm sun-soaked palette: this is the look the screenshots carry.
import { BEACH_Y, CAR, FONT, PALETTE, ROAD_WIDTH, VIEW, WATER_X, WATER_Y, WORLD } from './config.js';
import { onRoad } from './city.js';

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  // Size the backing store to the window (times the device pixel ratio) now and
  // whenever the window changes, so the logical 1280x720 view is never upscaled
  // from the 300x150 default canvas.
  resize();
  window.addEventListener('resize', resize);

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function camera(game) {
    const p = game.player.state;
    const cx = Math.max(VIEW.width / 2, Math.min(WORLD.width - VIEW.width / 2, p.x));
    const cy = Math.max(VIEW.height / 2, Math.min(WORLD.height - VIEW.height / 2, p.y));
    return { x: cx - VIEW.width / 2, y: cy - VIEW.height / 2 };
  }

  function drawGround(cam) {
    // Grass base.
    context.fillStyle = PALETTE.grass;
    context.fillRect(cam.x, cam.y, VIEW.width, VIEW.height);
    // Beach sand, then the sea.
    context.fillStyle = PALETTE.sand;
    context.fillRect(cam.x, Math.max(BEACH_Y, cam.y), VIEW.width, VIEW.height);
    context.fillStyle = PALETTE.water;
    context.fillRect(cam.x, Math.max(WATER_Y, cam.y), VIEW.width, VIEW.height);
    context.fillRect(Math.max(WATER_X, cam.x), cam.y, VIEW.width, VIEW.height);
    // Water shading lines.
    context.strokeStyle = PALETTE.waterDeep;
    context.lineWidth = 2;
    for (let y = WATER_Y + 24; y < WORLD.height; y += 48) {
      if (y < cam.y || y > cam.y + VIEW.height) continue;
      context.beginPath();
      context.moveTo(cam.x, y);
      context.lineTo(cam.x + VIEW.width, y);
      context.stroke();
    }
  }

  function drawRoads(cam, city) {
    for (const r of city.roads) {
      // Sidewalk border.
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12);
      context.fillStyle = PALETTE.asphalt;
      context.fillRect(r.x, r.y, r.w, r.h);
    }
    // Lane dashes.
    context.fillStyle = PALETTE.laneDash;
    for (const rx of [400, 1000, 1600, 2200, 2800]) {
      for (let y = Math.floor(cam.y / 48) * 48; y < cam.y + VIEW.height; y += 48) {
        context.fillRect(rx - 2, y, 4, 24);
      }
    }
    for (const ry of [400, 900, 1400, 1900]) {
      for (let x = Math.floor(cam.x / 48) * 48; x < cam.x + VIEW.width; x += 48) {
        context.fillRect(x, ry - 2, 24, 4);
      }
    }
  }

  function drawBuildings(cam, city) {
    for (const b of city.buildings) {
      if (b.x > cam.x + VIEW.width || b.x + b.w < cam.x || b.y > cam.y + VIEW.height || b.y + b.h < cam.y) continue;
      if (b.park) {
        context.fillStyle = PALETTE.park;
        context.fillRect(b.x, b.y, b.w, b.h);
        continue;
      }
      // Drop shadow, then the roof with a lighter inner slab for height.
      context.fillStyle = 'rgba(0,0,0,0.28)';
      context.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = 'rgba(255,255,255,0.14)';
      context.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      context.strokeStyle = PALETTE.buildingEdge;
      context.lineWidth = 2;
      context.strokeRect(b.x, b.y, b.w, b.h);
      if (b.tall) {
        context.fillStyle = 'rgba(255,255,255,0.22)';
        context.fillRect(b.x + b.w / 2 - 8, b.y + b.h / 2 - 8, 16, 16);
      }
    }
    // Trees.
    for (const t of city.trees) {
      if (t.x < cam.x || t.x > cam.x + VIEW.width || t.y < cam.y || t.y > cam.y + VIEW.height) continue;
      context.fillStyle = PALETTE.parkTree;
      context.beginPath();
      context.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.18)';
      context.beginPath();
      context.arc(t.x - 3, t.y - 3, t.r * 0.45, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawMarker(cam, game, time) {
    const marker = game.missions.marker();
    if (!marker) return;
    const pulse = 1 + Math.sin(time * 4) * 0.15;
    const r = 26 * pulse;
    context.strokeStyle = PALETTE.marker;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(marker.x, marker.y, r, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.markerPulse;
    context.beginPath();
    context.arc(marker.x, marker.y, r + 10, 0, Math.PI * 2);
    context.fill();
    // A diamond above the marker.
    const bob = Math.sin(time * 3) * 4;
    context.fillStyle = PALETTE.marker;
    context.beginPath();
    context.moveTo(marker.x, marker.y - 34 + bob);
    context.lineTo(marker.x + 9, marker.y - 24 + bob);
    context.lineTo(marker.x, marker.y - 14 + bob);
    context.lineTo(marker.x - 9, marker.y - 24 + bob);
    context.closePath();
    context.fill();
  }

  function drawPickups(cam, game, time) {
    for (const p of game.combat.pickups) {
      const bob = Math.sin(p.bob) * 2;
      if (p.kind === 'health') {
        context.fillStyle = '#ffffff';
        context.fillRect(p.x - 11, p.y - 11 + bob, 22, 22);
        context.fillStyle = '#e63946';
        context.fillRect(p.x - 3, p.y - 8 + bob, 6, 16);
        context.fillRect(p.x - 8, p.y - 3 + bob, 16, 6);
      } else if (p.kind === 'ammo') {
        context.fillStyle = '#ffd34d';
        context.fillRect(p.x - 10, p.y - 8 + bob, 20, 16);
        context.fillStyle = '#1a1a1a';
        context.fillRect(p.x - 6, p.y - 4 + bob, 4, 8);
        context.fillRect(p.x, p.y - 4 + bob, 4, 8);
        context.fillRect(p.x + 6, p.y - 4 + bob, 4, 8);
      } else {
        context.fillStyle = '#2f9e44';
        context.beginPath();
        context.arc(p.x, p.y + bob, 11, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#ffffff';
        text('$', p.x, p.y - 7 + bob, 15, '#ffffff', 'center');
      }
    }
  }

  function drawPerson(x, y, angle, color, walkPhase, down) {
    context.save();
    context.translate(x, y);
    if (down > 0) {
      context.rotate(Math.PI / 2);
      context.fillStyle = color;
      context.fillRect(-12, -7, 24, 14);
      context.restore();
      return;
    }
    const bob = Math.sin(walkPhase) * 2;
    context.rotate(angle);
    // Body and head, walking bob.
    context.fillStyle = color;
    context.beginPath();
    context.arc(0, 0, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8c39a';
    context.beginPath();
    context.arc(4 + bob * 0.4, 0, 5.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawCar(car, isPlayer) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    const hl = CAR.length / 2;
    const hw = CAR.width / 2;
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.fillRect(-hl + 3, -hw + 4, CAR.length, CAR.width);
    // Body.
    context.fillStyle = car.color;
    context.beginPath();
    context.roundRect(-hl, -hw, CAR.length, CAR.width, 8);
    context.fill();
    // Roof and windshield.
    context.fillStyle = 'rgba(255,255,255,0.22)';
    context.beginPath();
    context.roundRect(-hl * 0.35, -hw + 4, hl * 0.6, CAR.width - 8, 5);
    context.fill();
    context.fillStyle = '#1d2733';
    context.fillRect(hl - 16, -hw + 4, 10, CAR.width - 8);
    context.fillRect(-hl + 4, -hw + 4, 8, CAR.width - 8);
    // Headlights.
    context.fillStyle = '#fff8c0';
    context.fillRect(hl - 2, -hw + 3, 3, 6);
    context.fillRect(hl - 2, hw - 9, 3, 6);
    // Police light bar, flashing.
    if (car.kind === 'police') {
      const phase = Math.floor(car.flashing * 6) % 2 === 0;
      context.fillStyle = phase ? PALETTE.policeLightRed : PALETTE.policeLightBlue;
      context.fillRect(-4, -hw + 2, 8, 8);
      context.fillStyle = phase ? PALETTE.policeLightBlue : PALETTE.policeLightRed;
      context.fillRect(-4, hw - 10, 8, 8);
    }
    if (isPlayer) {
      context.strokeStyle = '#ffffff';
      context.lineWidth = 2;
      context.beginPath();
      context.roundRect(-hl - 3, -hw - 3, CAR.length + 6, CAR.width + 6, 10);
      context.stroke();
    }
    context.restore();
  }

  function drawParticles(game, dt) {
    for (let i = game.particles.length - 1; i >= 0; i -= 1) {
      const p = game.particles[i];
      p.life -= dt;
      if (p.life <= 0) { game.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
  }

  function drawBullets(game) {
    context.fillStyle = '#ffe08a';
    for (const b of game.combat.bullets) {
      context.fillRect(b.x - 3, b.y - 1.5, 6, 3);
    }
  }

  return {
    /** Set the transform so the next drawing uses logical 1280x720 coordinates. */
    hudTransform() {
      context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
      return context;
    },
    /** Paint one frame of the world (not the HUD). tint is 'day' | 'dusk' | 'night'. */
    draw(game, time, tint) {
      const cam = camera(game);
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = '#0c1018';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.setTransform(view.scale, 0, 0, view.scale, view.x - cam.x * view.scale, view.y - cam.y * view.scale);
      drawGround(cam);
      drawRoads(cam, game.city);
      drawBuildings(cam, game.city);
      drawMarker(cam, game, time);
      drawPickups(cam, game, time);
      // Pedestrians.
      for (const ped of game.traffic.peds) {
        if (ped.x < cam.x - 40 || ped.x > cam.x + VIEW.width + 40 || ped.y < cam.y - 40 || ped.y > cam.y + VIEW.height + 40) continue;
        drawPerson(ped.x, ped.y, ped.angle, ped.color, ped.walkPhase, ped.down);
      }
      // Officers on foot.
      for (const cop of game.police.cops) {
        drawPerson(cop.x, cop.y, cop.angle, '#1d4ed8', time * 8, 0);
      }
      // Enemies.
      for (const enemy of game.combat.enemies) {
        if (!enemy.alive) continue;
        drawPerson(enemy.x, enemy.y, enemy.angle, '#c0392b', time * 6, 0);
      }
      // Traffic cars, then police cars, then the player's car.
      for (const car of game.traffic.cars) drawCar(car, false);
      for (const car of game.police.cars) drawCar(car, false);
      const playerCar = game.player.state.inCar;
      if (playerCar) drawCar(playerCar, true);
      // The player on foot, with a white ring so he reads against the street.
      if (!playerCar) {
        const p = game.player.state;
        const blink = p.invulnerable > 0 && Math.floor(time * 12) % 2 === 0;
        if (!blink) {
          drawPerson(p.x, p.y, p.angle, PALETTE.player, time * 8, 0);
          context.strokeStyle = '#ffffff';
          context.lineWidth = 2;
          context.beginPath();
          context.arc(p.x, p.y, 15, 0, Math.PI * 2);
          context.stroke();
        }
      }
      drawBullets(game);
      drawParticles(game, 1 / 60);
      // Time-of-day tint for the staged screenshots.
      context.setTransform(1, 0, 0, 1, 0, 0);
      if (tint === 'dusk') {
        context.fillStyle = PALETTE.duskTint;
        context.fillRect(0, 0, canvas.width, canvas.height);
      } else if (tint === 'night') {
        context.fillStyle = PALETTE.nightTint;
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
    },
  };
}
