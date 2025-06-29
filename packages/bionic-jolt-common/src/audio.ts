import {
  type ConfigurableTrait,
  type World,
  createAdded,
  createRemoved,
  trait,
} from 'koota';

const Added = createAdded();
const Removed = createRemoved();

const audioCtx = new AudioContext();
const masterGainNode = audioCtx.createGain();
masterGainNode.gain.value = 0.2;
masterGainNode.connect(audioCtx.destination);

if (
  typeof window !== 'undefined' &&
  typeof window.addEventListener !== 'undefined'
) {
  // Disconnect audio context when the window is blurred
  window.addEventListener('blur', () => {
    masterGainNode.disconnect();
  });

  // Reconnect audio context when the window is focused
  window.addEventListener('focus', () => {
    masterGainNode.connect(audioCtx.destination);
  });
}

export const AudioNodeTrait = trait({
  node: () => undefined as unknown as AudioNode,
});

interface AudioManager {
  tryResume(): void;
  update(): void;
}

function createWhiteNoiseSource(audioCtx: AudioContext) {
  const bufferSize = 2 * audioCtx.sampleRate;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }

  const whiteNoise = audioCtx.createBufferSource();
  whiteNoise.buffer = noiseBuffer;
  whiteNoise.loop = true;
  whiteNoise.start(0);

  return whiteNoise;
}

const whiteNoiseSource = createWhiteNoiseSource(audioCtx);

export const WindAudio = (() => {
  const Params = trait({
    gainNode: () => undefined as unknown as GainNode,
    highPass: () => undefined as unknown as BiquadFilterNode,
  });

  return {
    Params,
    Bundle(): ConfigurableTrait[] {
      const lowPass = audioCtx.createBiquadFilter();
      lowPass.type = 'lowpass';
      lowPass.frequency.value = 1000;
      lowPass.Q.value = 1;

      const highPass = audioCtx.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.value = 1000;

      const gainNode = audioCtx.createGain();

      whiteNoiseSource.connect(lowPass).connect(highPass).connect(gainNode);

      return [
        AudioNodeTrait({ node: gainNode }),
        Params({ gainNode, highPass }),
      ];
    },
  };
})();

export function createAudio(world: World): AudioManager {
  return {
    tryResume() {
      audioCtx.resume();
    },
    update() {
      world.query(Added(AudioNodeTrait)).updateEach(([audioNode]) => {
        audioNode.node.connect(masterGainNode);
      });

      world.query(Removed(AudioNodeTrait)).updateEach(([audioNode]) => {
        audioNode.node.disconnect(masterGainNode);
      });
    },
  };
}
