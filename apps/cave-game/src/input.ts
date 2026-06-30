export type Vec2 = {
  x: number;
  y: number;
};

export type Action = 'jump' | 'dash-left' | 'dash-right' | 'slam';

type StickElements = {
  zone: HTMLElement;
  origin: HTMLElement;
  current: HTMLElement;
};

type PointerStick = {
  pointerId: number | null;
  origin: Vec2;
  current: Vec2;
};

type KeyboardCode = 'KeyW' | 'KeyA' | 'KeyS' | 'KeyD' | 'ShiftLeft' | 'ShiftRight' | 'Space';

const zero = (): Vec2 => ({ x: 0, y: 0 });
const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const movementCodes = new Set<KeyboardCode>(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
const actionCodes = new Set<KeyboardCode>(['Space', 'ShiftLeft', 'ShiftRight']);
const handledCodes = new Set<KeyboardCode>([...movementCodes, ...actionCodes]);

export class InputController {
  readonly movement: Vec2 = zero();
  readonly look: Vec2 = { x: 1, y: 0 };

  #actions: Action[] = [];
  #left: PointerStick = { pointerId: null, origin: zero(), current: zero() };
  #right: PointerStick = { pointerId: null, origin: zero(), current: zero() };
  #rightStartedAt = 0;
  #rightConsumedSwipe = false;
  #rightHoldReady = false;
  #pressedKeys = new Set<KeyboardCode>();

  constructor(
    private readonly leftElements: StickElements,
    private readonly rightElements: StickElements,
  ) {
    this.#bindLeftStick();
    this.#bindRightStick();
    this.#bindKeyboard();
  }

  consumeActions(): Action[] {
    const actions = this.#actions;
    this.#actions = [];
    return actions;
  }

  isGrappleHeld() {
    return this.#right.pointerId !== null && this.#rightHoldReady && !this.#rightConsumedSwipe;
  }

  update() {
    this.#updateKeyboardMovement();

    if (this.#right.pointerId === null || this.#rightConsumedSwipe) return;

    const elapsed = performance.now() - this.#rightStartedAt;
    const moved = distance(this.#right.origin, this.#right.current);

    if (elapsed > 170 && moved < 22) {
      this.#rightHoldReady = true;
    }
  }

  destroy() {
    window.removeEventListener('keydown', this.#handleKeyDown);
    window.removeEventListener('keyup', this.#handleKeyUp);
    window.removeEventListener('blur', this.#handleBlur);
    this.leftElements.zone.replaceWith(this.leftElements.zone.cloneNode(true));
    this.rightElements.zone.replaceWith(this.rightElements.zone.cloneNode(true));
  }

  #bindKeyboard() {
    window.addEventListener('keydown', this.#handleKeyDown);
    window.addEventListener('keyup', this.#handleKeyUp);
    window.addEventListener('blur', this.#handleBlur);
  }

  #bindLeftStick() {
    this.leftElements.zone.addEventListener('pointerdown', (event) => {
      if (this.#left.pointerId !== null) return;
      this.#startStick(event, this.#left, this.leftElements);
    });

    this.leftElements.zone.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.#left.pointerId) return;
      this.#moveStick(event, this.#left, this.leftElements);
      this.#updateMovement();
    });

    this.leftElements.zone.addEventListener('pointerup', (event) => this.#endLeft(event));
    this.leftElements.zone.addEventListener('pointercancel', (event) => this.#endLeft(event));
  }

  #bindRightStick() {
    this.rightElements.zone.addEventListener('pointerdown', (event) => {
      if (this.#right.pointerId !== null) return;
      this.#rightStartedAt = performance.now();
      this.#rightConsumedSwipe = false;
      this.#rightHoldReady = false;
      this.#startStick(event, this.#right, this.rightElements);
    });

    this.rightElements.zone.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.#right.pointerId) return;
      this.#moveStick(event, this.#right, this.rightElements);
      this.#tryConsumeSwipe();
    });

    this.rightElements.zone.addEventListener('pointerup', (event) => this.#endRight(event));
    this.rightElements.zone.addEventListener('pointercancel', (event) => this.#endRight(event));
  }

  #startStick(event: PointerEvent, stick: PointerStick, elements: StickElements) {
    stick.pointerId = event.pointerId;
    stick.origin = { x: event.clientX, y: event.clientY };
    stick.current = { x: event.clientX, y: event.clientY };
    elements.zone.setPointerCapture(event.pointerId);
    elements.zone.classList.add('active');
    this.#positionStick(elements, stick);
  }

  #moveStick(event: PointerEvent, stick: PointerStick, elements: StickElements) {
    stick.current = { x: event.clientX, y: event.clientY };
    this.#positionStick(elements, stick);
  }

  #positionStick(elements: StickElements, stick: PointerStick) {
    elements.origin.style.transform = `translate(${stick.origin.x}px, ${stick.origin.y}px)`;
    elements.current.style.transform = `translate(${stick.current.x}px, ${stick.current.y}px)`;
  }

  #endLeft(event: PointerEvent) {
    if (event.pointerId !== this.#left.pointerId) return;
    this.#left.pointerId = null;
    this.movement.x = 0;
    this.movement.y = 0;
    this.leftElements.zone.classList.remove('active');
  }

  #endRight(event: PointerEvent) {
    if (event.pointerId !== this.#right.pointerId) return;
    this.#right.pointerId = null;
    this.#rightHoldReady = false;
    this.rightElements.zone.classList.remove('active');
  }

  #updateMovement() {
    const vector = {
      x: (this.#left.current.x - this.#left.origin.x) / 72,
      y: -(this.#left.current.y - this.#left.origin.y) / 72,
    };
    this.#setMovement(vector);
  }

  #tryConsumeSwipe() {
    if (this.#rightConsumedSwipe || this.#rightHoldReady) return;

    const dx = this.#right.current.x - this.#right.origin.x;
    const dy = this.#right.current.y - this.#right.origin.y;
    if (Math.hypot(dx, dy) < 58) return;

    this.#rightConsumedSwipe = true;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.#actions.push(dx > 0 ? 'dash-right' : 'dash-left');
      return;
    }

    this.#actions.push(dy < 0 ? 'jump' : 'slam');
  }

  #handleKeyDown = (event: KeyboardEvent) => {
    const code = event.code as KeyboardCode;
    if (!handledCodes.has(code)) return;

    event.preventDefault();
    const wasPressed = this.#pressedKeys.has(code);
    this.#pressedKeys.add(code);

    if (wasPressed || event.repeat) return;

    if (code === 'Space') {
      this.#actions.push('jump');
      return;
    }

    if (this.#isShiftPressed()) {
      if (code === 'KeyA' || (this.#pressedKeys.has('KeyA') && this.#isShiftCode(code))) {
        this.#actions.push('dash-left');
      }
      if (code === 'KeyD' || (this.#pressedKeys.has('KeyD') && this.#isShiftCode(code))) {
        this.#actions.push('dash-right');
      }
      if (code === 'KeyS' || (this.#pressedKeys.has('KeyS') && this.#isShiftCode(code))) {
        this.#actions.push('slam');
      }
    }
  };

  #handleKeyUp = (event: KeyboardEvent) => {
    const code = event.code as KeyboardCode;
    if (!handledCodes.has(code)) return;

    event.preventDefault();
    this.#pressedKeys.delete(code);
  };

  #handleBlur = () => {
    this.#pressedKeys.clear();
  };

  #updateKeyboardMovement() {
    if (this.#left.pointerId !== null) return;

    const vector = {
      x: Number(this.#pressedKeys.has('KeyD')) - Number(this.#pressedKeys.has('KeyA')),
      y: Number(this.#pressedKeys.has('KeyW')) - Number(this.#pressedKeys.has('KeyS')),
    };

    this.#setMovement(vector);
  }

  #setMovement(vector: Vec2) {
    const magnitude = Math.hypot(vector.x, vector.y);
    const scale = magnitude > 1 ? 1 / magnitude : 1;

    this.movement.x = vector.x * scale;
    this.movement.y = vector.y * scale;

    if (magnitude > 0.18) {
      this.look.x = this.movement.x;
      this.look.y = this.movement.y;
    }
  }

  #isShiftPressed() {
    return this.#pressedKeys.has('ShiftLeft') || this.#pressedKeys.has('ShiftRight');
  }

  #isShiftCode(code: KeyboardCode) {
    return code === 'ShiftLeft' || code === 'ShiftRight';
  }
}
