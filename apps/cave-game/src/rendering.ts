import type { Entity, World } from 'koota';
import tgpu, { d } from 'typegpu';
import { vec3f, vec4f } from 'typegpu/data';
import * as wf from 'wayfare';
import { quat } from 'wgpu-matrix';
import type { GrapplePoint, PlatformDef, PlayerSnapshot } from './physics.ts';

export type RectEntity = {
  entity: Entity;
  width: number;
  height: number;
};

export type RopeEntity = {
  parent: Entity;
  child: Entity;
  thickness: number;
};

const rectangleMesh = wf.createRectangleMesh({
  width: vec3f(1, 0, 0),
  height: vec3f(0, 1, 0),
});

const ColorParamsSchema = d.struct({
  albedo: d.vec3f,
});

const FlatColorMaterial = wf.createMaterial({
  paramsSchema: ColorParamsSchema,
  paramsDefaults: { albedo: d.vec3f(1, 1, 1) },
  vertexLayout: wf.POS_NORMAL_UV,

  createPipeline({ root, format, $$ }) {
    const vertexFn = tgpu.vertexFn({
      in: {
        pos: d.vec3f,
        normal: d.vec3f,
        uv: d.vec2f,
      },
      out: { pos: d.builtin.position },
    })((input) => {
      'use gpu';
      const worldPos = $$.modelMat * d.vec4f(input.pos, 1);
      return { pos: $$.viewProjMat * worldPos };
    });

    const fragmentFn = tgpu.fragmentFn({
      out: d.vec4f,
    })(() => {
      'use gpu';
      return d.vec4f($$.params.albedo, 1);
    });

    return {
      pipeline: root.createRenderPipeline({
        attribs: wf.POS_NORMAL_UV.attrib,
        vertex: vertexFn,
        fragment: fragmentFn,
        targets: { format },
        primitive: { topology: 'triangle-list' },
        depthStencil: {
          depthWriteEnabled: true,
          depthCompare: 'less',
          format: 'depth24plus',
        },
      }),
    };
  },
});

export function createCamera(world: World) {
  return world.spawn(
    wf.ActiveCameraTag,
    wf.OrthographicCamera({
      near: 0.02,
      far: 100,
      left: -8,
      right: 8,
      top: 4.5,
      bottom: -4.5,
      clearColor: [0.018, 0.023, 0.026, 1],
    }),
    wf.TransformTrait({ position: vec3f(0, 0, 18) }),
  );
}

export function spawnRect(
  world: World,
  width: number,
  height: number,
  color: [number, number, number],
): RectEntity {
  const entity = world.spawn(
    wf.TransformTrait({ scale: vec3f(width, height, 1) }),
    wf.MeshTrait(rectangleMesh),
    ...FlatColorMaterial.Bundle({ albedo: vec3f(...color) }),
  );

  return { entity, width, height };
}

export function spawnRope(
  world: World,
  thickness: number,
  color: [number, number, number],
): RopeEntity {
  const parent = world.spawn(wf.TransformTrait());
  const child = world.spawn(
    wf.TransformTrait({ scale: vec3f(0.001, thickness, 1) }),
    wf.MeshTrait(rectangleMesh),
    ...FlatColorMaterial.Bundle({ albedo: vec3f(...color) }),
  );

  wf.connectAsChild(parent, child);
  return { parent, child, thickness };
}

export function setRect(
  rect: RectEntity,
  x: number,
  y: number,
  angle = 0,
  width = rect.width,
  height = rect.height,
) {
  const transform = wf.getOrThrow(rect.entity, wf.TransformTrait);
  transform.position.x = x;
  transform.position.y = y;
  transform.position.z = 0;
  transform.scale.x = width;
  transform.scale.y = height;
  transform.rotation = quat.fromEuler(0, 0, angle, 'xyz', vec4f());
}

export function setColor(rect: RectEntity, color: [number, number, number]) {
  const params = wf.getOrThrow(rect.entity, FlatColorMaterial.Params);
  params.albedo = vec3f(...color);
}

export function createPlatformRects(world: World, platforms: PlatformDef[]) {
  return platforms.map((platform) => {
    const rect = spawnRect(world, platform.width, platform.height, [0.2, 0.82, 0.56]);
    setRect(rect, platform.x, platform.y);
    return rect;
  });
}

export function createGrappleRects(world: World, points: GrapplePoint[]) {
  return new Map(
    points.map((point) => {
      const rect = spawnRect(world, 0.28, 0.28, [1, 0.73, 0.22]);
      setRect(rect, point.x, point.y, Math.PI / 4);
      return [point.id, rect];
    }),
  );
}

export function syncPlayer(rect: RectEntity, player: PlayerSnapshot) {
  setRect(rect, player.x, player.y, player.angle);
  setColor(rect, player.grounded ? [1, 1, 1] : [0.92, 0.98, 1]);
}

export function syncRope(
  rope: RopeEntity,
  player: PlayerSnapshot,
  selected: GrapplePoint | null,
  active: boolean,
) {
  const parentTransform = wf.getOrThrow(rope.parent, wf.TransformTrait);
  const childTransform = wf.getOrThrow(rope.child, wf.TransformTrait);

  if (!selected || !active) {
    parentTransform.position.x = 0;
    parentTransform.position.y = 0;
    parentTransform.position.z = 0;
    parentTransform.rotation = quat.identity(vec4f());
    childTransform.scale.x = 0.001;
    childTransform.scale.y = 0.001;
    return;
  }

  const dx = selected.x - player.x;
  const dy = selected.y - player.y;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  parentTransform.position.x = player.x + dx / 2;
  parentTransform.position.y = player.y + dy / 2;
  parentTransform.position.z = 0;
  parentTransform.rotation = quat.fromEuler(0, 0, angle, 'xyz', vec4f());
  childTransform.scale.x = length;
  childTransform.scale.y = rope.thickness;
}

export function updateCameraBounds(camera: Entity, width: number, height: number) {
  const config = wf.getOrThrow(camera, wf.OrthographicCamera);
  const aspect = width / Math.max(1, height);
  const viewHeight = 8.2;
  config.left = (-viewHeight * aspect) / 2;
  config.right = (viewHeight * aspect) / 2;
  config.bottom = -viewHeight / 2;
  config.top = viewHeight / 2;
}
