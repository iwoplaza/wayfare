<div align="center">

<picture>
<source srcset="./media/wayfare-logo-dark.svg" media="(prefers-color-scheme: dark)" />
<img src="./media/wayfare-logo-light.svg" />
</picture>

🚧 **Under Construction** 🚧

</div>

A modular game engine built on top of [TypeGPU](https://typegpu.com) & [Koota](https://github.com/pmndrs/koota), pushing the capabilities of JavaScript/TypeScript in graphics and general-purpose GPU compute for game development.

## Fundamentals

### Creating custom materials

```ts
import tgpu from 'typegpu';
import * as d from 'typegpu/data';
import * as std from 'typegpu/std';
import * as wayfare from 'wayfare';

const ParamsSchema = d.struct({
  progress: d.f32,
});

export const ExploreMaterial = wayfare.createMaterial({
  paramsSchema: ParamsSchema,
  paramsDefaults: { progress: 0 },
  vertexLayout: wayfare.POS_NORMAL_UV,

  createPipeline({ root, format, $$ }) {
    const Varying = {
      normal: vec3f,
      uv: vec2f,
    };

    const vertexFn = tgpu.vertexFn({
      in: {
        idx: builtin.vertexIndex,
        pos: vec3f,
        normal: vec3f,
        uv: vec2f,
      },
      out: { ...Varying, pos: builtin.position },
    })((input) => {
      const displacedPos = input.pos.add(
        input.normal.mul($$.params.progress),
      );

      return {
        pos: $$.viewProjMat.mul($$.modelMat).mul(d.vec4f(displacedPos, 1)),
        normal: $$.normalModelMat.mul(vec4f(input.normal, 0)).xyz,
        uv: input.uv,
      };
    });

    const sunDir = std.normalize(d.vec3f(-0.5, 2, -0.5));

    const fragmentFn = tgpu.fragmentFn({
      in: Varying,
      out: d.vec4f,
    })((input) => {
      const normal = std.normalize(input.normal);

      const diffuse = d.vec3f(1.0, 0.9, 0.7);
      const ambient = d.vec3f(0.1, 0.15, 0.2);
      const att = std.max(0, std.dot(normal, sunDir));

      const finalColor = std.mix(
        std.add(ambient, att.mul(diffuse)),
        d.vec3f(1, 0.2, 0.1),
        $$.params.progress,
      );
      return d.vec4f(finalColor, 1.0);
    });

    return {
      pipeline: root
        .withVertex(vertexFn, wayfare.POS_NORMAL_UV.attrib)
        .withFragment(fragmentFn, { format })
        .withPrimitive({ topology: "triangle-list", cullMode: "back" })
        .withDepthStencil({
          depthWriteEnabled: true,
          depthCompare: "less",
          format: "depth24plus",
        })
        .createPipeline(),
    };
  },
});

```

## Packages
- [wayfare](/packages/wayfare) - the engine itself.
- [Bionic Jolt (common)](/packages/bionic-jolt-common) - a game project that drives the initial set of features that *wayfare* should have (3D primitives, collision detection, cameras, etc...).

## Apps
- [Bionic Jolt (web)](/apps/bionic-jolt) - a web embedding of the Bionic Jolt game.
- [Bionic Jolt (react native)](/apps/rn-bionic-jolt) - a mobile embedding of the Bionic Jolt game.

## Quotes

> ⛵️ "We asked ourselves if shaders could be written in JavaScript... instead of asking if they should"<br>
\- made-up quote

> ⛵️ "The web has intruded f#%*!ng shaders"<br>
\- reddit in general
