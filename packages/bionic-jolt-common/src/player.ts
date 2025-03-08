import { type World, trait } from 'koota';
import { vec3f } from 'typegpu/data';
import { length, normalize } from 'typegpu/std';
import { TransformTrait, Velocity } from 'wayfare';

import { Dude, DudeBundle } from './dude.js';
import { MapProgressMarker, WindListener } from './map.js';
import { inputMap } from './input.js';

export const Player = trait({
  upKey: 'KeyW',
  downKey: 'KeyS',
  leftKey: 'KeyA',
  rightKey: 'KeyD',
});

function controlPlayerSystem(world: World) {
  world.query(Player, Dude).updateEach(([player, dude]) => {
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

export function createPlayers(world: World) {
  return {
    init() {
      this.cleanup();

      world.spawn(
        Player,
        ...DudeBundle(),
        MapProgressMarker,
        WindListener,
        TransformTrait({
          position: vec3f(0, 0, 0),
          scale: vec3f(0.1),
        }),
        Velocity(vec3f(0, -5, 0)),
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
