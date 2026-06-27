// TODO: Remove the audio nodes when the traits are removed

import {
  type ConfigurableTrait,
  type ExtractSchema,
  type Trait,
  type TraitValue,
  type World,
  createRemoved,
  trait,
} from 'koota';

export const AudioCtxTrait = trait(() => undefined as unknown as AudioContext);
export const AudioNodeTrait = trait(() => undefined as unknown as AudioNode);

export const AudioSourceTrait = trait({
  buffer: () => undefined as unknown as AudioBufferSourceNode,
});

export interface AudioManager {
  tryResume(): void;
  update(): void;
}

interface InitAudioMaterialContext {
  audioCtx: AudioContext;
}

type InitSharedAudioMaterial<TShared> = (audioCtx: AudioContext) => TShared;
type InitAudioMaterial<TParamsTrait extends Trait, TShared> = (
  ctx: InitAudioMaterialContext,
  shared: TShared,
) => { node: AudioNode; initialParams: TraitValue<ExtractSchema<TParamsTrait>> };

export interface CreateAudioMaterialOptions<TParamsTrait extends Trait, TShared> {
  paramsTrait: TParamsTrait;
  initShared?: InitSharedAudioMaterial<TShared> | undefined;
  init: InitAudioMaterial<TParamsTrait, TShared>;
}

export interface CreateAudioMaterialResult<TParamsTrait extends Trait> {
  Params: TParamsTrait;
  Bundle(): ConfigurableTrait[];
}

const InitAudioMaterialTrait = trait({
  paramsTrait: () => undefined as unknown as Trait,
  initShared: () => undefined as unknown as InitSharedAudioMaterial<unknown>,
  init: () => undefined as unknown as InitAudioMaterial<Trait, never>,
});

export function createAudioMaterial<TParamsTrait extends Trait, TShared>(
  options: CreateAudioMaterialOptions<TParamsTrait, TShared>,
): CreateAudioMaterialResult<TParamsTrait> {
  const { paramsTrait, initShared, init } = options;

  return {
    Params: paramsTrait,
    Bundle: () => [
      InitAudioMaterialTrait({
        initShared,
        init: init as unknown as InitAudioMaterial<Trait, never>,
        paramsTrait,
      }),
    ],
  };
}

export function createAudio(
  world: World,
  AudioContext: typeof globalThis.AudioContext,
): AudioManager {
  const Removed = createRemoved();

  const audioCtx = new AudioContext();
  const masterGainNode = audioCtx.createGain();
  masterGainNode.gain.value = 0.2;
  masterGainNode.connect(audioCtx.destination);

  if (typeof window !== 'undefined' && typeof window.addEventListener !== 'undefined') {
    // Disconnect audio context when the window is blurred
    window.addEventListener('blur', () => {
      masterGainNode.disconnect();
    });

    // Reconnect audio context when the window is focused
    window.addEventListener('focus', () => {
      masterGainNode.connect(audioCtx.destination);
    });
  }

  const sharedMap = new WeakMap();

  return {
    tryResume() {
      audioCtx.resume();
    },
    update() {
      world
        .query(InitAudioMaterialTrait)
        .updateEach(([{ initShared, init, paramsTrait }], entity) => {
          let shared: unknown;
          if (sharedMap.has(initShared)) {
            shared = sharedMap.get(initShared);
          } else {
            shared = initShared(audioCtx);
            sharedMap.set(initShared, shared);
          }
          const { node, initialParams } = init({ audioCtx }, shared as never);

          node.connect(masterGainNode);
          entity.remove(InitAudioMaterialTrait);
          entity.add(paramsTrait(initialParams));
        });

      world.query(Removed(AudioNodeTrait), AudioNodeTrait).updateEach(([audioNode]) => {
        audioNode?.disconnect(masterGainNode);
      });
    },
  };
}
