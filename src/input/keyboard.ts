// Input controller: keyboard + UI buttons for the velocity command.
//
// Two layers, summed into the final command each frame:
//   - persistent baseline  : adjusted by + / - buttons (and by WASD/QE on
//                            keypress, one bump per press)
//   - momentary keys held  : WASD/QE while held adds a fixed amount on top
//
// Keyboard:
//   W/S    bump baseline vx (one nudge per press) and add max while held
//   A/D    bump baseline vy
//   Q/E    bump baseline wz
//   R      reset sim AND clear baseline
//   Space  pause/resume both workers
//
// Buttons (rendered into #controls in index.html):
//   vx +/-, vy +/-, wz +/-, Stop (zero baseline), Reset (reset sim + baseline)

import type { RemoteSim } from '../sim/remoteSim';
import type { PolicyHandle } from '../policy/policyClient';
import type { ThreeViewer, CameraMode } from '../render/threeViewer';
import { VirtualJoystick } from './joystick';

interface Targets {
  vx: number;
  vy: number;
  wz: number;
}

const STEP_LIN = 0.5;
const STEP_YAW = 0.1;
const HELD_LIN = 1.0;
const HELD_YAW = 1.0;
// Joystick max output (when thumb is at the edge) — should feel similar to
// holding a key down.
const JOY_LIN = 1.0;
const JOY_YAW = 1.0;

export class KeyboardController {
  private keys = new Set<string>();
  private paused = false;
  private baseline: Targets = { vx: 0, vy: 0, wz: 0 };
  // Live joystick contributions, summed on top of baseline + held keys each tick.
  private joyLin: { vx: number; vy: number } = { vx: 0, vy: 0 };
  private joyYaw = 0;

  constructor(
    private sim: RemoteSim,
    private policy: PolicyHandle,
    private viewer: ThreeViewer,
  ) {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', () => this.keys.clear());
    this.buildButtons();
    this.buildJoysticks();
    this.buildTopbar();
  }

  private onDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'r') {
      this.resetAll();
      return;
    }
    if (k === ' ') {
      this.togglePause();
      e.preventDefault();
      return;
    }
    if (k === 'c') {
      this.cycleCamera();
      return;
    }
    // One-shot baseline nudge on press.
    if (k === 'w') this.bump('vx',  STEP_LIN);
    if (k === 's') this.bump('vx', -STEP_LIN);
    if (k === 'a') this.bump('vy',  STEP_LIN);
    if (k === 'd') this.bump('vy', -STEP_LIN);
    if (k === 'q') this.bump('wz',  STEP_YAW);
    if (k === 'e') this.bump('wz', -STEP_YAW);
    this.keys.add(k);
  };

  private onUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };

  /** Push current commanded velocity into SAB. */
  update(): Targets {
    const t: Targets = { ...this.baseline };
    if (this.keys.has('w')) t.vx += HELD_LIN;
    if (this.keys.has('s')) t.vx -= HELD_LIN;
    if (this.keys.has('a')) t.vy += HELD_LIN;
    if (this.keys.has('d')) t.vy -= HELD_LIN;
    if (this.keys.has('q')) t.wz += HELD_YAW;
    if (this.keys.has('e')) t.wz -= HELD_YAW;

    // Joystick contributions are momentary like held keys.
    t.vx += this.joyLin.vx;
    t.vy += this.joyLin.vy;
    t.wz += this.joyYaw;

    this.sim.state.command[0] = t.vx;
    this.sim.state.command[1] = t.vy;
    this.sim.state.command[2] = t.wz;
    return t;
  }

  get isPaused(): boolean { return this.paused; }
  get currentBaseline(): Targets { return { ...this.baseline }; }

  // --- internals ------------------------------------------------------------

  private bump(key: keyof Targets, delta: number): void {
    this.baseline[key] = round2(this.baseline[key] + delta);
  }

  private resetAll(): void {
    this.baseline = { vx: 0, vy: 0, wz: 0 };
    this.sim.reset();
  }

  private togglePause(): void {
    this.paused = !this.paused;
    this.sim.pause(this.paused);
    this.policy.pause(this.paused);
  }

  private buildJoysticks(): void {
    const left = document.getElementById('joy-left');
    const right = document.getElementById('joy-right');
    if (!left || !right) return;

    // Left pad: Y-axis = forward/back (push UP = +vx), X-axis = strafe
    // (push LEFT = +vy in MuJoCo body frame).
    new VirtualJoystick(left, {
      onChange: (x, y) => {
        this.joyLin = { vx: -y * JOY_LIN, vy: -x * JOY_LIN };
      },
    });
    // Right pad: only the X-axis matters; push LEFT = +wz (yaw left).
    new VirtualJoystick(right, {
      onChange: (x, _y) => {
        this.joyYaw = -x * JOY_YAW;
      },
    });
  }

  private camButtons: HTMLButtonElement[] = [];

  private buildTopbar(): void {
    const host = document.getElementById('topbar');
    if (!host) return;
    const mk = (label: string, title: string, onClick: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.textContent = label;
      b.title = title;
      b.setAttribute('aria-label', title);
      b.addEventListener('click', () => { onClick(); b.blur(); });
      return b;
    };
    const camBtn = mk(this.cameraLabel(), 'Cycle camera mode (C)', () => this.cycleCamera());
    this.camButtons.push(camBtn);
    host.replaceChildren(
      camBtn,
      mk('⏯', 'Pause / resume', () => this.togglePause()),
      mk('↻', 'Reset to home pose', () => this.resetAll()),
      mk('■', 'Stop (zero target velocity)', () => { this.baseline = { vx: 0, vy: 0, wz: 0 }; }),
    );
  }

  private cycleCamera(): void {
    this.viewer.cycleCameraMode();
    this.refreshCamLabels();
  }

  private cameraLabel(mode: CameraMode = this.viewer.currentCameraMode): string {
    return mode === 'orbit' ? '📷 Free'
      : mode === 'follow' ? '📷 Follow'
      : '📷 Cinema';
  }

  private refreshCamLabels(): void {
    const label = this.cameraLabel();
    for (const b of this.camButtons) b.textContent = label;
  }

  private buildButtons(): void {
    const host = document.getElementById('controls');
    if (!host) return;
    const mk = (label: string, onClick: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('click', () => { onClick(); b.blur(); });
      return b;
    };
    const camBtn = mk(this.cameraLabel(), () => this.cycleCamera());
    this.camButtons.push(camBtn);
    host.replaceChildren(
      mk('vx -', () => this.bump('vx', -STEP_LIN)),
      mk('vx +', () => this.bump('vx',  STEP_LIN)),
      mk('vy -', () => this.bump('vy', -STEP_LIN)),
      mk('vy +', () => this.bump('vy',  STEP_LIN)),
      mk('wz -', () => this.bump('wz', -STEP_YAW)),
      mk('wz +', () => this.bump('wz',  STEP_YAW)),
      mk('stop', () => { this.baseline = { vx: 0, vy: 0, wz: 0 }; }),
      mk('reset', () => this.resetAll()),
      mk('pause', () => this.togglePause()),
      camBtn,
    );
  }
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
