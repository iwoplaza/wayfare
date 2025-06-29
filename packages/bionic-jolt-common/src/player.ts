import { type World, trait } from 'koota';
import { vec3f } from 'typegpu/data';
import { length, normalize } from 'typegpu/std';
import * as wf from 'wayfare';
import { Dude, DudeBundle } from './dude.ts';
import { inputMap } from './input.ts';
import { MapProgressMarker, WindListener } from './map.ts';

export const GameState = trait({
  isGameOver: false,
});

export const Player = trait();

function controlPlayerSystem(world: World) {
  const gameState = wf.getOrAdd(world, GameState);

  if (gameState.isGameOver) {
    if (inputMap.shoot.isActive) {
      world.set(GameState, { isGameOver: false });
      return;
    }
  } else {
    world.query(Dude, Player).updateEach(([dude]) => {
      let dir = vec3f(inputMap.movement.value.x, 0, -inputMap.movement.value.y);

      if (length(dir) > 1) {
        dir = normalize(dir);
      }

      // Encroaching the movement direction
      dude.movementDir.x = dir.x;
      dude.movementDir.y = dir.y;
      dude.movementDir.z = dir.z;
    });
  }
}

export function createPlayers(world: World) {
  return {
    init() {
      this.cleanup();

      world.spawn(
        Player,
        ...DudeBundle(),
        MapProgressMarker,
        WindListener,
        wf.TransformTrait({
          position: vec3f(0, 0, 0),
          scale: vec3f(0.1),
        }),
        wf.Velocity(vec3f(0, -5, 0)),
      );
    },

    cleanup() {
      world.query(Player).updateEach((_, entity) => {
        entity.destroy();
      });
    },

    update() {
      controlPlayerSystem(world);
    },
  };
}
