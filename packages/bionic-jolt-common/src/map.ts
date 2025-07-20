import { type ExtractSchema, Not, type World, trait } from 'koota';
import * as d from 'typegpu/data';
import * as wf from 'wayfare';
import { quat } from 'wgpu-matrix';

import pentagonFile from './assets/pentagon.js';
import { WindAudio } from './audio.ts';
import { GameState } from './player.ts';

const pentagonMesh = wf.meshAsset({ src: pentagonFile });

/**
 * Settings given to a world.
 */
export const MapSettings = trait({
  farDistance: 100,
  deSpawnThreshold: 100,
});

/**
 * The entity who's position is used to determine the progress of the map.
 * Typically the player.
 */
export const MapProgressMarker = trait();

export const WindListener = trait();

export type MapChunk = ExtractSchema<typeof MapChunk>;
export const MapChunk = trait({
  length: 1,
  passed: false,
});

/**
 * The chunk that's at end of the currently generated map.
 * Used to know where to append new chunks.
 */
export const MapTail = trait();

const WindAudioSource = trait();

function clamp01(x: number) {
  return Math.max(0, Math.min(x, 1));
}

export function createMap(world: World) {
  function updateMapSystem() {
    const settings = wf.getOrAdd(world, MapSettings);
    const progressMarker = world.queryFirst(MapProgressMarker);
    const progressMarkerPos = progressMarker?.get(wf.TransformTrait)?.position;

    if (!progressMarkerPos) return;

    world
      .query(MapChunk, wf.TransformTrait, Not(MapTail))
      .updateEach(([chunk, transform], entity) => {
        // Is well above the marker?
        if (
          transform.position.y - chunk.length >
          progressMarkerPos.y + settings.deSpawnThreshold
        ) {
          entity.destroy();
        }

        // Check if player is passing this chunk for the first time
        if (!chunk.passed && progressMarkerPos.y <= transform.position.y) {
          chunk.passed = true;

          // Check if player missed the chunk when passing it
          const sqDistanceXZ =
            (transform.position.x - progressMarkerPos.x) ** 2 +
            (transform.position.z - progressMarkerPos.z) ** 2;

          if (sqDistanceXZ > 1.5) {
            world.set(GameState, { isGameOver: true });
          }
        }
      });

    // Handle highlighting when new the marker
    world
      .query(MapChunk, wf.BlinnPhongMaterial.Params)
      .updateEach(([chunk, material]) => {
        if (chunk.passed) {
          material.albedo = d.vec3f(1, 1, 0);
        } else {
          material.albedo = d.vec3f(1, 0.5, 0);
        }
      });

    // Add new chunks
    let limit = 10;
    do {
      const tail = world.queryFirst(MapTail);
      const tailPosition = tail?.get(wf.TransformTrait)?.position;
      const tailChunk = tail?.get(MapChunk);

      if (
        !tail ||
        !tailPosition ||
        tailPosition.y > progressMarkerPos.y - settings.farDistance
      ) {
        const xPos = (tailPosition?.x ?? 0) + (Math.random() * 2 - 1) * 0.4;
        const yPos = (tailPosition?.y ?? -10) - (tailChunk?.length ?? 0);
        const zPos = (tailPosition?.z ?? 0) + (Math.random() * 2 - 1) * 0.4;

        world.spawn(
          MapChunk({ length: 1 + Math.random() * 5, passed: false }),
          wf.TransformTrait({
            position: d.vec3f(xPos, yPos, zPos),
            rotation: quat.fromEuler(
              0,
              Math.random() * Math.PI,
              0,
              'xyz',
              d.vec4f(),
            ),
          }),
          wf.MeshTrait(pentagonMesh),
          MapTail,
          ...wf.BlinnPhongMaterial.Bundle(),
        );
        tail?.remove(MapTail);
      } else {
        break;
      }

      limit--;
    } while (limit > 0);
  }

  function updateWindAudioSystem() {
    if (!world.queryFirst(WindAudioSource)) {
      world.spawn(WindAudioSource, ...WindAudio.Bundle());
    }

    const windListener = world.queryFirst(WindListener)?.get(wf.TransformTrait);

    if (!windListener) {
      return;
    }

    const listenerY = windListener.position.y;

    const minDist = world.query(MapChunk).reduce((acc, chunk) => {
      const chunkY = wf.getOrThrow(chunk, wf.TransformTrait).position.y;
      return Math.min(acc, Math.abs(chunkY - listenerY));
    }, Number.POSITIVE_INFINITY);

    if (minDist < Number.POSITIVE_INFINITY) {
      world.query(WindAudio.Params, WindAudioSource).updateEach(([params]) => {
        const clamped1 = clamp01(1 - minDist * 0.5);

        params.gainNode.gain.value = clamped1 ** 3;
        params.highPass.frequency.value = 1000 - clamped1 ** 0.5 * 1000;
      });
    }
  }

  return {
    update() {
      updateMapSystem();
      updateWindAudioSystem();
    },
  };
}
