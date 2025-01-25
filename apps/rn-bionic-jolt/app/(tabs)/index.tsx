import {
  ActiveCameraTag,
  BlinnPhongMaterial,
  createRectangle,
  Engine,
  MeshTrait,
  PerspectiveCamera,
  Renderer,
  TransformTrait,
} from 'wayfare';
import { useEffect } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import tgpu from 'typegpu/experimental';
import { Canvas, useGPUContext } from 'react-native-wgpu';
import { vec3f } from 'typegpu/data';
import '@/constants/polyfills';
import { trait } from 'koota';

const squareMesh = createRectangle({
  width: vec3f(1, 0, 0),
  height: vec3f(0, 1, 0),
});

const Foo = trait();

function setupGame(canvas: HTMLCanvasElement, context: GPUCanvasContext) {
  let destroyed = false;
  let engine: Engine | undefined;

  (async () => {
    const root = await tgpu.init();

    if (destroyed) {
      return;
    }

    const renderer = new Renderer(root, canvas, context);
    engine = new Engine(root, renderer);
    const world = engine.world;

    let prevCanvasWidth = 0;
    let prevCanvasHeight = 0;

    function updateViewport() {
      prevCanvasWidth = canvas.clientWidth * PixelRatio.get();
      prevCanvasHeight = canvas.clientHeight * PixelRatio.get();
      canvas.width = prevCanvasWidth;
      canvas.height = prevCanvasHeight;
      renderer.updateViewport(prevCanvasWidth, prevCanvasHeight);
    }

    updateViewport();

    // Camera
    world.spawn(
      ActiveCameraTag,
      TransformTrait({}),
      PerspectiveCamera({
        clearColor: [1, 0, 0, 1],
      })
    );

    // Random square
    world.spawn(
      Foo,
      MeshTrait(squareMesh),
      TransformTrait({ position: vec3f(0, 0, -10) }),
      ...BlinnPhongMaterial.Bundle({
        albedo: vec3f(0, 1, 0),
      })
    );

    engine.run(() => {
      // Updating viewport
      const newWidth = canvas.clientWidth * PixelRatio.get();
      const newHeight = canvas.clientHeight * PixelRatio.get();
      if (newWidth !== prevCanvasWidth || newHeight !== prevCanvasHeight) {
        prevCanvasWidth = newWidth;
        prevCanvasHeight = newHeight;
        updateViewport();
      }

      world.query(TransformTrait, Foo).updateEach(([transform]) => {
        transform.position = vec3f(Math.sin(Date.now() * 0.001), 0, -10);
      });
    });
  })();

  return () => {
    destroyed = true;
    if (engine) {
      engine.destroy();
    }
  };
}

export default function HomeScreen() {
  const { ref, context } = useGPUContext();

  useEffect(() => {
    if (!context) {
      return;
    }

    console.log(context);

    const destroy = setupGame(
      context.canvas as unknown as HTMLCanvasElement,
      context
    );

    return () => {
      destroy();
    };
  }, [context]);

  return (
    <View style={styles.container}>
      <Canvas ref={ref} style={styles.webgpu} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webgpu: {
    flex: 1,
  },
});
