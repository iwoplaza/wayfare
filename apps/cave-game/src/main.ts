import tgpu from 'typegpu';
import { createCaveGame } from './game.ts';
import './styles.css';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const errorPanel = document.getElementById('error-panel') as HTMLElement;

const elementById = (id: string) => document.getElementById(id) as HTMLElement;

function syncAppHeight() {
  const height = `${window.innerHeight}px`;
  document.documentElement.style.setProperty('--app-height', height);
  document.body.style.height = height;
}

function preventTouchScroll(event: TouchEvent) {
  if (event.cancelable) {
    event.preventDefault();
  }
}

function installIosFullscreenWorkaround() {
  syncAppHeight();
  document.addEventListener('touchmove', preventTouchScroll, { passive: false });
  window.addEventListener('pageshow', syncAppHeight);
  window.addEventListener('resize', syncAppHeight);
  window.addEventListener('orientationchange', () => {
    requestAnimationFrame(syncAppHeight);
    window.setTimeout(syncAppHeight, 250);
  });
}

function showError(message: string) {
  errorPanel.textContent = message;
  errorPanel.classList.add('active');
}

async function main() {
  if (!navigator.gpu) {
    showError('WebGPU is required for this prototype.');
    return;
  }

  const context = canvas.getContext('webgpu');
  if (!context) {
    showError('Unable to create a WebGPU canvas context.');
    return;
  }

  const root = await tgpu.init();
  const game = createCaveGame(root, context, {
    canvas,
    leftZone: elementById('left-zone'),
    leftOrigin: elementById('left-origin'),
    leftCurrent: elementById('left-current'),
    rightZone: elementById('right-zone'),
    rightOrigin: elementById('right-origin'),
    rightCurrent: elementById('right-current'),
    reticle: elementById('reticle'),
  });

  const resize = () => {
    syncAppHeight();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(window.innerWidth * ratio));
    const height = Math.max(1, Math.floor(window.innerHeight * ratio));
    canvas.width = width;
    canvas.height = height;
    game.resize(width, height);
  };

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  game.start();
}

installIosFullscreenWorkaround();

main().catch((error: unknown) => {
  showError(error instanceof Error ? error.message : 'Unable to start cave-game.');
});
