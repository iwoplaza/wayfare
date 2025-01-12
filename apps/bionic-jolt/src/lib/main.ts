import tgpu from 'typegpu/experimental';
import { Engine, Renderer } from 'wayfare';

// These imports are preloading the necessary assets
// TODO: Hopefully the VM is smart enough to parallelize these, but
//       better to test this anyway.
import { createAirParticles } from './air-particles';
import { createDudes } from './dude';
import { createGameCamera } from './game-camera';
import { createMap } from './map';
import { createPlayers } from './player';
import { createJoystick } from './joystick';

const loadingScreen = document.getElementById('loading-screen');

if (loadingScreen) {
  loadingScreen.style.display = 'none';
}

export async function main(canvas: HTMLCanvasElement) {
  const root = await tgpu.init();
  const renderer = new Renderer(root, canvas);
  const engine = new Engine(root, renderer);
  const world = engine.world;

  createJoystick();

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
