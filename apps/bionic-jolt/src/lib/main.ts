import tgpu from 'typegpu';

// These imports are preloading the necessary assets
// TODO: Hopefully the VM is smart enough to parallelize these, but
//       better to test this anyway.
import { BionicJolt } from 'bionic-jolt-common';
import { createJoystick } from './joystick.js';

const loadingScreen = document.getElementById('loading-screen') as HTMLElement;
const mainMenu = document.getElementById('main-menu') as HTMLElement;
const fallBtn = document.getElementById('fall-btn') as HTMLElement;

if (loadingScreen) {
  loadingScreen.style.display = 'none';
  mainMenu.style.display = 'flex';
}

export async function main(canvas: HTMLCanvasElement) {
  const root = await tgpu.init();
  const bj = BionicJolt(
    root,
    canvas,
    canvas.getContext('webgpu') as GPUCanvasContext,
  );

  // Listen to changes in window size and resize the canvas
  const handleResize = () => {
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    const devicePixelRatio = window.devicePixelRatio;
    const width = window.innerWidth * devicePixelRatio;
    const height = window.innerHeight * devicePixelRatio;
    canvas.width = width;
    canvas.height = height;
    bj.renderer.updateViewport(width, height);
  };
  handleResize();
  window.addEventListener('resize', handleResize);

  createJoystick();

  fallBtn.addEventListener('click', () => {
    mainMenu.style.display = 'none';

    bj.start();
  });

  bj.loop();
}
