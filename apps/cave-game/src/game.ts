import type { TgpuRoot } from 'typegpu';
import * as wf from 'wayfare';
import { Engine, Renderer } from 'wayfare';
import { InputController, type Vec2 } from './input.ts';
import { PhysicsWorld, type GrapplePoint } from './physics.ts';
import {
  createCamera,
  createGrappleRects,
  createPlatformRects,
  setColor,
  spawnRect,
  spawnRope,
  syncPlayer,
  syncRope,
  updateCameraBounds,
} from './rendering.ts';

type GameElements = {
  canvas: HTMLCanvasElement;
  leftZone: HTMLElement;
  leftOrigin: HTMLElement;
  leftCurrent: HTMLElement;
  rightZone: HTMLElement;
  rightOrigin: HTMLElement;
  rightCurrent: HTMLElement;
  reticle: HTMLElement;
};

const maxGrappleRange = 12.6;

export function createCaveGame(root: TgpuRoot, context: GPUCanvasContext, elements: GameElements) {
  const renderer = new Renderer(root, elements.canvas, context);
  const engine = new Engine(root, renderer);
  const physics = new PhysicsWorld();
  const input = new InputController(
    { zone: elements.leftZone, origin: elements.leftOrigin, current: elements.leftCurrent },
    { zone: elements.rightZone, origin: elements.rightOrigin, current: elements.rightCurrent },
  );

  const world = engine.world;
  const camera = createCamera(world);
  const playerRect = spawnRect(world, 0.55, 0.9, [1, 1, 1]);
  const ropeRect = spawnRope(world, 0.045, [1, 0.92, 0.28]);
  const grappleRects = createGrappleRects(world, physics.grapplePoints);

  createPlatformRects(
    world,
    physics.platforms.map((body) => ({
      x: body.position.x,
      y: -body.position.y,
      width: body.bounds.max.x - body.bounds.min.x,
      height: body.bounds.max.y - body.bounds.min.y,
    })),
  );

  let selected: GrapplePoint | null = null;
  let lastLook: Vec2 = { x: 1, y: 0 };

  return {
    resize(width: number, height: number) {
      renderer.updateViewport(width, height);
      updateCameraBounds(camera, width, height);
    },

    start() {
      engine.run((deltaSeconds) => {
        input.update();
        const playerBefore = physics.getPlayerSnapshot();
        lastLook = normalizedLook(input.look, lastLook);
        selected = selectGrapplePoint(physics.grapplePoints, playerBefore, lastLook);

        if (input.isGrappleHeld()) {
          physics.holdGrapple(selected);
        } else {
          physics.releaseGrapple();
        }

        physics.step(deltaSeconds, input.movement, input.consumeActions());

        const player = physics.getPlayerSnapshot();
        const displayedGrapple = physics.activeGrapplePoint ?? selected;
        syncPlayer(playerRect, player);
        syncRope(ropeRect, player, displayedGrapple, physics.activeGrapple !== null);
        updateGrappleHighlights(grappleRects, displayedGrapple);
        updateCamera(camera, player, lastLook, deltaSeconds);
        updateReticle(elements.reticle, renderer.canvas, camera, displayedGrapple);
      });
    },

    destroy() {
      input.destroy();
      engine.destroy();
    },
  };
}

function normalizedLook(candidate: Vec2, fallback: Vec2): Vec2 {
  const magnitude = Math.hypot(candidate.x, candidate.y);
  if (magnitude < 0.18) return fallback;
  return { x: candidate.x / magnitude, y: candidate.y / magnitude };
}

function selectGrapplePoint(
  points: GrapplePoint[],
  player: { x: number; y: number },
  look: Vec2,
): GrapplePoint | null {
  let best: { point: GrapplePoint; score: number } | null = null;

  for (const point of points) {
    const dx = point.x - player.x;
    const dy = point.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance > maxGrappleRange || distance < 0.8) continue;

    const dot = (dx * look.x + dy * look.y) / distance;
    if (dot < 0.18) continue;

    const perpendicular = Math.abs(dx * look.y - dy * look.x) / distance;
    const score = distance + perpendicular * 3.4 - dot * 0.85;

    if (!best || score < best.score) {
      best = { point, score };
    }
  }

  return best?.point ?? null;
}

function updateGrappleHighlights(
  rects: Map<string, ReturnType<typeof spawnRect>>,
  selected: GrapplePoint | null,
) {
  for (const [id, rect] of rects) {
    setColor(rect, id === selected?.id ? [1, 0.97, 0.22] : [1, 0.58, 0.12]);
  }
}

function updateCamera(
  camera: ReturnType<typeof createCamera>,
  player: { x: number; y: number; velocity: Vec2 },
  look: Vec2,
  deltaSeconds: number,
) {
  const transform = wf.getOrThrow(camera, wf.TransformTrait);
  const targetX = player.x + look.x * 1.9 + player.velocity.x * 0.12;
  const targetY = player.y + look.y * 1.15 + 0.35;

  transform.position.x = wf.encroach(transform.position.x, targetX, 0.0007, deltaSeconds);
  transform.position.y = wf.encroach(transform.position.y, targetY, 0.0007, deltaSeconds);
  transform.position.z = 18;
}

function updateReticle(
  reticle: HTMLElement,
  canvas: HTMLCanvasElement,
  camera: ReturnType<typeof createCamera>,
  selected: GrapplePoint | null,
) {
  if (!selected) {
    reticle.classList.remove('active');
    return;
  }

  const transform = wf.getOrThrow(camera, wf.TransformTrait);
  const config = wf.getOrThrow(camera, wf.OrthographicCamera);
  const left = transform.position.x + config.left;
  const top = transform.position.y + config.top;
  const x = ((selected.x - left) / (config.right - config.left)) * canvas.clientWidth;
  const y = ((top - selected.y) / (config.top - config.bottom)) * canvas.clientHeight;

  reticle.style.transform = `translate(${x}px, ${y}px)`;
  reticle.classList.add('active');
}
