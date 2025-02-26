import {
  getJoysticks,
  mountJoystickArea,
  type Joystick,
} from '@manapotion/vanilla';

export function createJoystick() {
  const areaEl = document.getElementById('joystick-area') as HTMLElement;
  const currentEl = document.getElementById('joystick-current') as HTMLElement;
  const originEl = document.getElementById('joystick-origin') as HTMLElement;

  const handleJoystickStart = (joystick: Joystick) => {
    currentEl.style.transform = `translate(${joystick.current.x}px, ${-(joystick.current.y ?? 0)}px)`;
    originEl.style.transform = `translate(${joystick.origin.x}px, ${-(joystick.origin.y ?? 0)}px)`;
    currentEl.style.opacity = '1';
    originEl.style.opacity = '1';
  };

  const handleJoystickEnd = () => {
    currentEl.style.opacity = '0';
    originEl.style.opacity = '0';
  };

  const handleJoystickMove = (joystick: Joystick) => {
    currentEl.style.transform = `translate(${joystick.current.x}px, ${-(joystick.current.y ?? 0)}px)`;
    originEl.style.transform = `translate(${joystick.origin.x}px, ${-(joystick.origin.y ?? 0)}px)`;
  };

  mountJoystickArea({
    element: areaEl,
    joystick: getJoysticks().movement,
    mode: 'origin',
    onMove: handleJoystickMove,
    onStart: handleJoystickStart,
    onEnd: handleJoystickEnd,
  });
}
