import type { IController, ControllerInput } from "./types";

type Axis = "x" | "y";

interface KeyBinding {
  axis: Axis;
  sign: 1 | -1;
}

const KEY_MAP: Record<string, KeyBinding> = {
  ArrowUp:    { axis: "y", sign:  1 },
  ArrowDown:  { axis: "y", sign: -1 },
  ArrowLeft:  { axis: "x", sign: -1 },
  ArrowRight: { axis: "x", sign:  1 },
  w: { axis: "y", sign:  1 },
  s: { axis: "y", sign: -1 },
  a: { axis: "x", sign: -1 },
  d: { axis: "x", sign:  1 },
};

export class KeyboardController implements IController {
  private held = new Set<string>();

  constructor() {
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key in KEY_MAP) {
      e.preventDefault(); // stop page scroll on arrow keys
      this.held.add(e.key);
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    this.held.delete(e.key);
  }

  getInput(): ControllerInput {
    let x = 0;
    let y = 0;

    for (const key of this.held) {
      const binding = KEY_MAP[key];
      if (!binding) continue;
      if (binding.axis === "x") x += binding.sign;
      if (binding.axis === "y") y += binding.sign;
    }

    // Clamp to [-1, 1] and normalise diagonals so W+D ≠ faster than W alone
    x = Math.max(-1, Math.min(1, x));
    y = Math.max(-1, Math.min(1, y));

    const len = Math.sqrt(x * x + y * y);
    if (len > 1) {
      x /= len;
      y /= len;
    }

    return { x, y };
  }

  destroy() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.held.clear();
  }
}
