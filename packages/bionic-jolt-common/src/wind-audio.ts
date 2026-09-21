import { trait } from 'koota';
import { createAudioMaterial } from './audio.ts';

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

export const WindAudioMaterial = createAudioMaterial({
  paramsTrait: trait({
    gainNode: () => undefined as unknown as GainNode,
    highPass: () => undefined as unknown as BiquadFilterNode,
  }),
  initShared(audioCtx: AudioContext) {
    return {
      whiteNoiseSource: createWhiteNoiseSource(audioCtx),
    };
  },
  init({ audioCtx }, shared) {
    const lowPass = audioCtx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.value = 1000;
    lowPass.Q.value = 1;

    const highPass = audioCtx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = 1000;

    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0;

    shared.whiteNoiseSource.connect(lowPass).connect(highPass).connect(gainNode);

    return {
      node: gainNode,
      initialParams: {
        gainNode,
        highPass,
      },
    };
  },
});
