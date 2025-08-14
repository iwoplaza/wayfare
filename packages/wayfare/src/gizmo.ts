import type { TgpuRoot } from 'typegpu';
import tgpu from 'typegpu';
import * as d from 'typegpu/data';
import * as std from 'typegpu/std';

const Shape = d.struct({
  color: d.vec3f,
  dist: d.f32,
});

const MAX_GIZMOS = 1024;

// Struct types for each gizmo
export const SphereGizmo = d.struct({
  // common
  color: d.vec3f,
  stroke: d.f32,
  // ---
  center: d.vec3f,
  radius: d.f32,
});

export const BoxGizmo = d.struct({
  // common
  color: d.vec3f,
  stroke: d.f32,
  // ---
  min: d.vec3f,
  max: d.vec3f,
});

export const ArrowGizmo = d.struct({
  // common
  color: d.vec3f,
  stroke: d.f32,
  // ---
  start: d.vec3f,
  end: d.vec3f,
});

export interface GizmoState {
  enable(): void;
  disable(): void;
  draw(view: GPUTextureView): void;
}

interface InternalGizmoState extends GizmoState {
  color: d.v3f;
  stroke: number;
  addSphere(center: d.v3f, radius: number): void;
  addBox(min: d.v3f, max: d.v3f): void;
  addArrow(start: d.v3f, end: d.v3f): void;
}

let GLOBAL_STATE: InternalGizmoState | undefined;
const defaultColor = d.vec3f(1, 0, 1);
const defaultStroke = 0.02;

const sdSphere = tgpu.fn(
  [d.vec3f, d.vec3f, d.f32],
  d.f32,
)((p, center, radius) => {
  return std.length(std.sub(p, center)) - radius;
});

const sdBox = tgpu.fn(
  [d.vec3f, d.vec3f, d.vec3f],
  d.f32,
)((p, minBound, maxBound) => {
  const q = std.sub(
    std.abs(
      std.sub(p, std.add(minBound, std.mul(std.sub(maxBound, minBound), 0.5))),
    ),
    std.mul(std.sub(maxBound, minBound), 0.5),
  );
  return (
    std.length(std.max(q, d.vec3f(0))) +
    std.min(std.max(q.x, std.max(q.y, q.z)), 0)
  );
});

const sdArrow = tgpu.fn(
  [d.vec3f, d.vec3f, d.vec3f],
  d.f32,
)((p, start, end) => {
  const dir = std.normalize(std.sub(end, start));
  const q = std.sub(p, start);
  const h = std.length(std.sub(end, start));
  const d = std.length(
    std.sub(q, std.mul(dir, std.clamp(std.dot(q, dir), 0, h))),
  );
  return d;
});

export const Gizmo = {
  sphere(center: d.v3f, radius: number): void {
    if (!GLOBAL_STATE) return;
    GLOBAL_STATE.addSphere(center, radius);
  },

  box(min: d.v3f, max: d.v3f): void {
    if (!GLOBAL_STATE) return;
    GLOBAL_STATE.addBox(min, max);
  },

  arrow(start: d.v3f, end: d.v3f): void {
    if (!GLOBAL_STATE) return;
    GLOBAL_STATE.addArrow(start, end);
  },

  color(rgb: d.v3f): void {
    if (!GLOBAL_STATE) return;
    GLOBAL_STATE.color = d.vec3f(rgb); // copy
  },

  stroke(t: number): void {
    if (!GLOBAL_STATE) return;
    GLOBAL_STATE.stroke = t;
  },
};

export function createGizmoState(
  root: TgpuRoot,
  pov: { $: { invView: d.m4x4f; invViewProj: d.m4x4f } },
): GizmoState {
  const preferredFormat = navigator.gpu.getPreferredCanvasFormat();
  const spheres = Array.from({ length: MAX_GIZMOS }, () =>
    // TODO: Simplify when default constructor is available in TypeGPU
    SphereGizmo({
      center: d.vec3f(),
      radius: d.f32(),
      color: d.vec3f(),
      stroke: d.f32(),
    }),
  );

  const boxes = Array.from({ length: MAX_GIZMOS }, () =>
    // TODO: Simplify when default constructor is available in TypeGPU
    BoxGizmo({
      min: d.vec3f(),
      max: d.vec3f(),
      color: d.vec3f(),
      stroke: d.f32(),
    }),
  );

  const arrows = Array.from({ length: MAX_GIZMOS }, () =>
    // TODO: Simplify when default constructor is available in TypeGPU
    ArrowGizmo({
      start: d.vec3f(),
      end: d.vec3f(),
      color: d.vec3f(),
      stroke: d.f32(),
    }),
  );

  // Create buffers for each gizmo type
  const sphereAmount = root.createUniform(d.u32);
  const sphereData = root.createUniform(d.arrayOf(SphereGizmo, MAX_GIZMOS));

  const boxAmount = root.createUniform(d.u32);
  const boxData = root.createUniform(d.arrayOf(BoxGizmo, MAX_GIZMOS));

  const arrowAmount = root.createUniform(d.u32);
  const arrowData = root.createUniform(d.arrayOf(ArrowGizmo, MAX_GIZMOS));

  let sphereCount = 0;
  let boxCount = 0;
  let arrowCount = 0;

  const vertexMain = tgpu['~unstable'].vertexFn({
    in: { idx: d.builtin.vertexIndex },
    out: { pos: d.builtin.position, uv: d.vec2f },
  })(({ idx }) => {
    const pos = [d.vec2f(-1, -1), d.vec2f(3, -1), d.vec2f(-1, 3)];
    const uv = [d.vec2f(0, 0), d.vec2f(2, 0), d.vec2f(0, 2)];

    return {
      pos: d.vec4f(pos[idx], 0.0, 1.0),
      uv: uv[idx],
    };
  });

  const getGizmoDist = tgpu.fn(
    [d.vec3f],
    Shape,
  )((p) => {
    let minDist = d.f32(1000);
    let color = d.vec3f(1, 1, 1);

    // Check spheres
    for (let i = d.u32(0); i < sphereAmount.$; i++) {
      const sphere = sphereData.$[i];
      const dist = sdSphere(p, sphere.center, sphere.radius);
      if (dist < minDist) {
        minDist = dist;
        color = sphere.color;
      }
    }

    // Check boxes
    for (let i = d.u32(0); i < boxAmount.$; i++) {
      const box = boxData.$[i];
      const dist = sdBox(p, box.min, box.max);
      if (dist < minDist) {
        minDist = dist;
        color = box.color;
      }
    }

    // Check arrows
    for (let i = d.u32(0); i < arrowAmount.$; i++) {
      const arrow = arrowData.$[i];
      const dist = sdArrow(p, arrow.start, arrow.end) - arrow.stroke;
      if (dist < minDist) {
        minDist = dist;
        color = arrow.color;
      }
    }

    return Shape({
      dist: minDist,
      color,
    });
  });

  const rayMarch = tgpu.fn(
    [d.vec3f, d.vec3f],
    Shape,
  )((ro, rd) => {
    let dO = d.f32(0);
    const result = Shape({
      dist: d.f32(100),
      color: d.vec3f(0, 0, 0),
    });

    for (let i = 0; i < 100; i++) {
      const p = std.add(ro, std.mul(rd, dO));
      const scene = getGizmoDist(p);

      if (scene.dist < 0.01) {
        result.dist = dO;
        result.color = scene.color;
        return result;
      }

      dO += scene.dist;
      if (dO > 100) {
        result.dist = 100;
        return result;
      }
    }

    result.dist = 100;
    return result;
  });

  const fragmentMain = tgpu['~unstable'].fragmentFn({
    in: { uv: d.vec2f },
    out: d.vec4f,
  })((input) => {
    const uv = std.sub(std.mul(input.uv, 2), 1);

    // Ray origin and direction using camera matrices
    const ro = std.mul(pov.$.invView, d.vec4f(0, 0, 0, 1)).xyz;
    const rd = std.normalize(
      std.mul(pov.$.invViewProj, d.vec4f(uv.x, uv.y, 1, 0)).xyz,
    );

    const march = rayMarch(ro, rd);

    if (march.dist >= 100) {
      std.discard();
    }

    return d.vec4f(march.color, 1);
  });

  const renderPipeline = root['~unstable']
    .withVertex(vertexMain, {})
    .withFragment(fragmentMain, {
      format: preferredFormat,
      blend: {
        color: {
          srcFactor: 'src-alpha',
          dstFactor: 'one-minus-src-alpha',
        },
        alpha: {
          srcFactor: 'one',
          dstFactor: 'one-minus-src-alpha',
        },
      },
    })
    .createPipeline();

  const gizmoState: InternalGizmoState = {
    color: defaultColor,
    stroke: defaultStroke,

    enable() {
      GLOBAL_STATE = this;
    },

    disable() {
      if (GLOBAL_STATE !== this) {
        return;
      }

      GLOBAL_STATE.color = defaultColor;
      GLOBAL_STATE.stroke = defaultStroke;

      // Reset counters and buffers
      sphereCount = 0;
      boxCount = 0;
      arrowCount = 0;
      sphereAmount.write(0);
      boxAmount.write(0);
      arrowAmount.write(0);
    },

    addSphere(center: d.v3f, radius: number) {
      if (sphereCount >= MAX_GIZMOS) return;

      spheres[sphereCount++] = SphereGizmo({
        center,
        radius: d.f32(radius),
        color: d.vec3f(gizmoState.color),
        stroke: gizmoState.stroke,
      });
    },

    addBox(min: d.v3f, max: d.v3f) {
      if (boxCount >= MAX_GIZMOS) return;

      boxes[boxCount++] = BoxGizmo({
        min,
        max,
        color: d.vec3f(gizmoState.color),
        stroke: gizmoState.stroke,
      });
    },

    addArrow(start: d.v3f, end: d.v3f) {
      if (arrowCount >= MAX_GIZMOS) return;

      arrows[arrowCount++] = ArrowGizmo({
        start,
        end,
        color: d.vec3f(gizmoState.color),
        stroke: gizmoState.stroke,
      });
    },

    draw(view: GPUTextureView) {
      sphereData.write(spheres);
      sphereAmount.write(sphereCount);
      boxData.write(boxes);
      boxAmount.write(boxCount);
      arrowData.write(arrows);
      arrowAmount.write(arrowCount);

      renderPipeline
        .withColorAttachment({
          view,
          loadOp: 'load',
          storeOp: 'store',
        })
        .draw(3);
    },
  };

  return gizmoState;
}
