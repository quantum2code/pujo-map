export interface ControllerInput {
  /** -1 (west) → +1 (east) */
  x: number;
  /** -1 (south) → +1 (north) */
  y: number;
}

export interface IController {
  /** Poll-based: called every rAF frame by the movement engine. */
  getInput(): ControllerInput;
  /** Release event listeners / any held resources. */
  destroy(): void;
}
