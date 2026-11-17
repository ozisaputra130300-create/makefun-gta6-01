// Combat: the pistol, the punch, the enemies who shoot back, and the pickups
// (health, ammo, cash) scattered around Solmar. Bullets are simple points with a
// direction; enemies are guards who hold a spot and fire when the player is near.
import { PLAYER } from './config.js';

const BULLET_SPEED = 900;
const BULLET_RANGE = 520;

export function createCombat(random) {
  const bullets = [];
  const enemies = [];
  const pickups = [];

  function addEnemy(x, y, health) {
    const enemy = { x, y, angle: 0, health: health || 60, shootTimer: 1, alive: true };
    enemies.push(enemy);
    return enemy;
  }

  function addPickup(kind, x, y, amount) {
    pickups.push({ kind, x, y, amount, bob: random() * Math.PI * 2 });
  }

  function fireBullet(x, y, angle, fromPlayer) {
    bullets.push({ x, y, angle, fromPlayer, travelled: 0 });
  }

  function hitBuilding(city, x, y) {
    for (const b of city.buildings) {
      if (b.park) continue;
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
    }
    return false;
  }

  return {
    bullets,
    enemies,
    pickups,
    addEnemy,
    addPickup,
    fireBullet,
    /** The punch: hurt the nearest pedestrian or enemy in front of the player. */
    punch(player, traffic, onHit) {
      const px = player.state.x + Math.cos(player.state.angle) * 20;
      const py = player.state.y + Math.sin(player.state.angle) * 20;
      const ped = traffic.pedNear(px, py, PLAYER.punchRange);
      if (ped) {
        ped.down = 2.5;
        ped.panic = 2;
        onHit('ped');
        return true;
      }
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        if (Math.hypot(enemy.x - px, enemy.y - py) < PLAYER.punchRange + 14) {
          enemy.health -= PLAYER.punchDamage;
          if (enemy.health <= 0) enemy.alive = false;
          onHit('enemy');
          return true;
        }
      }
      return false;
    },
    /** One fixed step: move bullets, resolve hits, run enemies, collect pickups. */
    step(dt, city, player, traffic, police, onPlayerShot) {
      for (let i = bullets.length - 1; i >= 0; i -= 1) {
        const b = bullets[i];
        b.x += Math.cos(b.angle) * BULLET_SPEED * dt;
        b.y += Math.sin(b.angle) * BULLET_SPEED * dt;
        b.travelled += BULLET_SPEED * dt;
        let dead = b.travelled > BULLET_RANGE || hitBuilding(city, b.x, b.y);
        if (!dead) {
          if (b.fromPlayer) {
            for (const enemy of enemies) {
              if (!enemy.alive) continue;
              if (Math.hypot(enemy.x - b.x, enemy.y - b.y) < 18) {
                enemy.health -= 34;
                if (enemy.health <= 0) enemy.alive = false;
                dead = true;
                break;
              }
            }
            if (!dead) {
              for (const cop of police.cops) {
                if (Math.hypot(cop.x - b.x, cop.y - b.y) < 16) { dead = true; break; }
              }
            }
            if (!dead) {
              const ped = traffic.pedNear(b.x, b.y, 14);
              if (ped) { ped.down = 3; ped.panic = 2; dead = true; }
            }
          } else if (Math.hypot(player.state.x - b.x, player.state.y - b.y) < PLAYER.radius + 4) {
            if (player.hurt(9)) onPlayerShot();
            dead = true;
          }
        }
        if (dead) bullets.splice(i, 1);
      }
      // Enemies hold their spot and fire at the player when he is close.
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const d = Math.hypot(player.state.x - enemy.x, player.state.y - enemy.y);
        if (d < 460) {
          enemy.angle = Math.atan2(player.state.y - enemy.y, player.state.x - enemy.x);
          enemy.shootTimer -= dt;
          if (enemy.shootTimer <= 0) {
            enemy.shootTimer = 0.9 + random() * 0.5;
            fireBullet(enemy.x, enemy.y, enemy.angle, false);
          }
        }
      }
      // Pickups bob and are collected on touch.
      for (let i = pickups.length - 1; i >= 0; i -= 1) {
        const p = pickups[i];
        p.bob += dt * 3;
        if (Math.hypot(player.state.x - p.x, player.state.y - p.y) < 30) {
          if (p.kind === 'health') player.heal(p.amount);
          else if (p.kind === 'ammo') player.addAmmo(p.amount);
          else if (p.kind === 'cash') player.earn(p.amount);
          pickups.splice(i, 1);
        }
      }
    },
    clearEnemies() {
      enemies.length = 0;
    },
  };
}
