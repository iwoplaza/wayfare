import tgpu from 'typegpu/experimental';
import { Engine, Renderer } from 'wayfare';

// Locking the zoom behavior on mobile.
document.addEventListener(
  'touchmove',
  (event) => {
    event.preventDefault();
  },
  { passive: false },
);

// These imports are preloading the necessary assets
// TODO: Hopefully the VM is smart enough to parallelize these, but
//       better to test this anyway.
import { createAirParticles } from './air-particles';
import { createDudes } from './dude';
import { createGameCamera } from './game-camera';
import { createMap } from './map';
import { createPlayers } from './player';

const loadingScreen = document.getElementById('loading-screen');

if (loadingScreen) {
  loadingScreen.style.display = 'none';
}

export async function main(canvas: HTMLCanvasElement) {
  const root = await tgpu.init();
  const renderer = new Renderer(root, canvas);
  const engine = new Engine(root, renderer);
  const world = engine.world;

  const MapStuff = createMap(world);
  const AirParticles = createAirParticles(world, root);
  const Dudes = createDudes(world);
  const Players = createPlayers(world);
  const GameCamera = createGameCamera(world);

  engine.run(() => {
    Dudes.update();
    Players.update();
    MapStuff.update();
    AirParticles.update();
    GameCamera.update();
  });
}
