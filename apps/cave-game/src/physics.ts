import Matter from 'matter-js';
import type { Action, Vec2 } from './input.ts';

export type PlatformDef = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GrapplePoint = {
  id: string;
  x: number;
  y: number;
};

export type PlayerSnapshot = {
  x: number;
  y: number;
  angle: number;
  velocity: Vec2;
  grounded: boolean;
  dashSquash: number;
};

export const playerSize = { width: 0.55, height: 0.9 };
const movementSpeedScale = 0.8;
const maxFreeRunSpeed = 0.21 * movementSpeedScale;
const maxGrappleRunSpeed = 0.165 * movementSpeedScale;
const maxSafeVelocity = { x: 0.5, y: 0.45 };
const maxPhysicsStepMs = 1000 / 30;
const jumpLockoutSeconds = 0.14;
const dashGravityCancelSeconds = 0.18;

export class PhysicsWorld {
  readonly engine = Matter.Engine.create();
  readonly player: Matter.Body;
  readonly platforms: Matter.Body[] = [];
  readonly grapplePoints: GrapplePoint[] = [];

  #grappleConstraint: Matter.Constraint | null = null;
  #activeGrapplePoint: GrapplePoint | null = null;
  #grounded = false;
  #airDashAvailable = true;
  #jumpLockoutSeconds = 0;
  #dashGravityCancelSeconds = 0;

  constructor() {
    this.engine.positionIterations = 8;
    this.engine.velocityIterations = 6;
    this.engine.constraintIterations = 3;
    this.engine.gravity.x = 0;
    this.engine.gravity.y = 1;
    this.engine.gravity.scale = 0.0000982;

    this.player = Matter.Bodies.rectangle(-5.8, 2.2, playerSize.width, playerSize.height, {
      friction: 0,
      frictionAir: 0.018,
      frictionStatic: 0,
      restitution: 0,
    });
    Matter.Body.setInertia(this.player, Number.POSITIVE_INFINITY);
    Matter.Composite.add(this.engine.world, this.player);

    for (const platform of levelPlatforms) {
      this.addPlatform(platform);
    }

    this.grapplePoints.push(...levelGrapplePoints);
  }

  addPlatform(platform: PlatformDef) {
    const body = Matter.Bodies.rectangle(platform.x, -platform.y, platform.width, platform.height, {
      isStatic: true,
      friction: 0,
      frictionStatic: 0,
    });
    this.platforms.push(body);
    Matter.Composite.add(this.engine.world, body);
  }

  step(deltaSeconds: number, movement: Vec2, actions: Action[]) {
    this.#jumpLockoutSeconds = Math.max(0, this.#jumpLockoutSeconds - deltaSeconds);
    this.#dashGravityCancelSeconds = Math.max(0, this.#dashGravityCancelSeconds - deltaSeconds);
    this.#applyMovement(movement);

    for (const action of actions) {
      this.#applyAction(action);
    }

    this.#clampPlayerVelocity();
    this.#cancelDashGravity();
    this.#stepMatter(deltaSeconds);
    this.#clampPlayerVelocity();
    this.#grounded = this.#computeGrounded();
    if (this.#grounded) {
      this.#airDashAvailable = true;
    }

    if (this.player.position.y > 16) {
      Matter.Body.setPosition(this.player, { x: -5.8, y: 2.2 });
      Matter.Body.setVelocity(this.player, { x: 0, y: 0 });
      this.#airDashAvailable = true;
      this.releaseGrapple();
    }
  }

  holdGrapple(selected: GrapplePoint | null) {
    if (!selected || this.#grappleConstraint) return;

    const anchor = { x: selected.x, y: -selected.y };
    const length = Matter.Vector.magnitude(Matter.Vector.sub(this.player.position, anchor));

    this.#grappleConstraint = Matter.Constraint.create({
      bodyA: this.player,
      pointB: anchor,
      length: Math.max(1.1, length),
      stiffness: 0.018,
      damping: 0.045,
    });
    Matter.Composite.add(this.engine.world, this.#grappleConstraint);
    this.#activeGrapplePoint = selected;
  }

  releaseGrapple() {
    if (!this.#grappleConstraint) return;
    Matter.Composite.remove(this.engine.world, this.#grappleConstraint);
    this.#grappleConstraint = null;
    this.#activeGrapplePoint = null;
  }

  get activeGrapple() {
    return this.#grappleConstraint;
  }

  get activeGrapplePoint() {
    return this.#activeGrapplePoint;
  }

  getPlayerSnapshot(): PlayerSnapshot {
    return {
      x: this.player.position.x,
      y: -this.player.position.y,
      angle: -this.player.angle,
      velocity: { x: this.player.velocity.x, y: -this.player.velocity.y },
      grounded: this.#grounded,
      dashSquash: this.#dashGravityCancelSeconds / dashGravityCancelSeconds,
    };
  }

  #applyMovement(movement: Vec2) {
    const maxSpeed = this.#grappleConstraint ? maxGrappleRunSpeed : maxFreeRunSpeed;
    const targetX = movement.x * maxSpeed;
    const blend = this.#grounded ? 0.14 : 0.055;
    const nextX = this.player.velocity.x + (targetX - this.player.velocity.x) * blend;

    Matter.Body.setVelocity(this.player, {
      x: nextX,
      y: this.player.velocity.y,
    });
  }

  #applyAction(action: Action) {
    if (action === 'jump' && this.#grounded) {
      this.#grounded = false;
      this.#jumpLockoutSeconds = jumpLockoutSeconds;
      Matter.Body.translate(this.player, { x: 0, y: -0.08 });
      Matter.Body.setVelocity(this.player, { x: this.player.velocity.x, y: -0.68 });
    }

    if (action === 'dash-left' || action === 'dash-right') {
      if (!this.#grounded) {
        if (!this.#airDashAvailable) return;
        this.#airDashAvailable = false;
      }

      this.#dashGravityCancelSeconds = dashGravityCancelSeconds;
      Matter.Body.setVelocity(this.player, {
        x: action === 'dash-left' ? -0.26 : 0.26,
        y: 0,
      });
    }

    if (action === 'slam' && !this.#grounded) {
      Matter.Body.setVelocity(this.player, { x: this.player.velocity.x * 0.3, y: 0.52 });
    }
  }

  #cancelDashGravity() {
    if (this.#dashGravityCancelSeconds <= 0) return;

    Matter.Body.applyForce(this.player, this.player.position, {
      x: -this.engine.gravity.x * this.engine.gravity.scale * this.player.mass,
      y: -this.engine.gravity.y * this.engine.gravity.scale * this.player.mass,
    });
  }

  #stepMatter(deltaSeconds: number) {
    Matter.Engine.update(this.engine, Math.min(deltaSeconds * 1000, maxPhysicsStepMs));
  }

  #clampPlayerVelocity() {
    const velocity = this.player.velocity;
    const x = Math.max(-maxSafeVelocity.x, Math.min(maxSafeVelocity.x, velocity.x));
    const y = Math.max(-maxSafeVelocity.y, Math.min(maxSafeVelocity.y, velocity.y));

    if (x !== velocity.x || y !== velocity.y) {
      Matter.Body.setVelocity(this.player, { x, y });
    }
  }

  #computeGrounded() {
    if (this.#jumpLockoutSeconds > 0) {
      return false;
    }

    const playerBottom = this.player.position.y + playerSize.height / 2;
    const playerLeft = this.player.position.x - playerSize.width / 2;
    const playerRight = this.player.position.x + playerSize.width / 2;

    return this.platforms.some((platform) => {
      const bounds = platform.bounds;
      const overlapsX = playerRight > bounds.min.x + 0.04 && playerLeft < bounds.max.x - 0.04;
      const nearTop = playerBottom >= bounds.min.y - 0.16 && playerBottom <= bounds.min.y + 0.34;
      return overlapsX && nearTop && this.player.velocity.y >= -0.2;
    });
  }
}

export const levelPlatforms: PlatformDef[] = [
  { x: 0, y: -4, width: 40, height: 0.7 },
  { x: -11, y: -1.4, width: 2.8, height: 0.38 },
  { x: -4.4, y: 0.6, width: 2.5, height: 0.38 },
  { x: 3.2, y: -0.6, width: 3.1, height: 0.38 },
  { x: 9.8, y: 1.45, width: 2.8, height: 0.38 },
  { x: 16.8, y: -0.35, width: 3.4, height: 0.38 },
  { x: -16.4, y: 1.55, width: 0.55, height: 11.8 },
  { x: 22.4, y: 1.55, width: 0.55, height: 11.8 },
  { x: 1.6, y: 7.1, width: 40, height: 0.55 },
];

export const levelGrapplePoints: GrapplePoint[] = [
  { id: 'point-1', x: -8.2, y: 5.1 },
  { id: 'point-2', x: -1.4, y: 6.25 },
  { id: 'point-3', x: 5.2, y: 5.5 },
  { id: 'point-4', x: 11.6, y: 6.55 },
  { id: 'point-5', x: 17.6, y: 5.7 },
];
