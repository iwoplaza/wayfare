import type { TgpuRoot } from 'typegpu';
import * as wayfare from 'wayfare';
import { createAudio } from './audio.js';
import { createMap } from './map.js';
import { createAirParticles } from './air-particles.js';
import { createDudes } from './dude.js';
import { createPlayers } from './player.js';
import { createGameCamera } from './game-camera.js';

export { createAirParticles } from './air-particles.js';
export { createAudio } from './audio.js';
export { Dude, DudeBundle, createDudes } from './dude.js';
export { createGameCamera } from './game-camera.js';
export { Player, createPlayers } from './player.js';
export { createMap } from './map.js';

export function BionicJolt(
  root: TgpuRoot,
  canvas: HTMLCanvasElement,
  context: GPUCanvasContext,
) {
  const renderer = new wayfare.Renderer(root, canvas, context);
  const engine = new wayfare.Engine(root, renderer);
  const world = engine.world;

  const Audio = createAudio(world);
  const MapStuff = createMap(world);
  const AirParticles = createAirParticles(world, root);
  const Dudes = createDudes(world);
  const Players = createPlayers(world);
  const GameCamera = createGameCamera(world);

  return {
    renderer,
    engine,

    start() {
      Audio.tryResume();
      Players.init();
    },

    loop() {
      engine.run(() => {
        Audio.update();
        Dudes.update();
        Players.update();
        MapStuff.update();
        AirParticles.update();
        GameCamera.update();
      });
    },
  };
}
