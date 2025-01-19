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
import { StyleSheet, View } from 'react-native';
import tgpu from 'typegpu/experimental';
import { Canvas, useCanvasEffect } from 'react-native-wgpu';
import { vec3f } from 'typegpu/data';
import '@/constants/polyfills';

const squareMesh = createRectangle({
  width: vec3f(1, 0, 0),
  height: vec3f(0, 1, 0),
});

const hello = globalThis.structuredClone([1, 2, 3]);
console.log(hello);

async function setupGame(canvas: HTMLCanvasElement) {
  const root = await tgpu.init();

  const renderer = new Renderer(root, canvas);
  console.log('CANVAS EFFECT bruh');
  const engine = new Engine(root, renderer);
  console.log('Engine created...');
  const world = engine.world;

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
    MeshTrait(squareMesh),
    TransformTrait({ position: vec3f(0, 0, 0) }),
    ...BlinnPhongMaterial.Bundle({
      albedo: vec3f(0, 1, 0),
    })
  );

  engine.run((deltaSeconds) => {
    console.log(`${deltaSeconds}`);
  });
}

export default function HomeScreen() {
  const ref = useCanvasEffect(async () => {
    setupGame(ref.current as unknown as HTMLCanvasElement);
  });

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
    width: 512,
    height: 512,
  },
});
