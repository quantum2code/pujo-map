import { useEffect, useRef, useState } from "react";
import type { IController } from "./controller/types";

// 5 m/s — brisk walking pace
const SPEED_MPS = 5;

const DEG_PER_METRE_LAT = 1 / 111_320;

export interface AvatarPosition {
  longitude: number;
  latitude: number;
}

/**
 * Moves the avatar position via a controller rAF loop.
 *
 * - Avatar position is SEPARATE from camera — panning the map never
 *   changes the avatar location.
 * - Only key presses move the avatar.
 * - `bearing` should come from the camera viewState so movement direction
 *   stays relative to the visual "up" on screen.
 * - Set `enabled = false` (live mode) to pause the controller loop.
 */
export function useMovement(
  controller: IController,
  initial: AvatarPosition,
  bearing: number = 0,
  enabled: boolean = true,
) {
  const [avatarPos, setAvatarPos] = useState<AvatarPosition>(initial);

  // Ref so the rAF callback always reads latest values without re-registering.
  const stateRef = useRef({ avatarPos, bearing, enabled });
  stateRef.current = { avatarPos, bearing, enabled };

  useEffect(() => {
    let rafId: number;
    let lastTime: number | null = null;

    function tick(now: number) {
      rafId = requestAnimationFrame(tick);

      const dt = lastTime === null ? 0 : (now - lastTime) / 1_000;
      lastTime = now;

      const { enabled, bearing, avatarPos } = stateRef.current;
      if (!enabled || dt <= 0) return;

      const input = controller.getInput();
      if (input.x === 0 && input.y === 0) return;

      const { longitude, latitude } = avatarPos;
      const bearingRad = (bearing * Math.PI) / 180;

      // Rotate screen-space vector by bearing so "up" always means screen-up
      const worldX = input.x * Math.cos(bearingRad) + input.y * Math.sin(bearingRad);
      const worldY = -input.x * Math.sin(bearingRad) + input.y * Math.cos(bearingRad);

      const distMetres = SPEED_MPS * dt;
      const degPerMetreLng = DEG_PER_METRE_LAT / Math.cos((latitude * Math.PI) / 180);

      setAvatarPos({
        longitude: longitude + worldX * distMetres * degPerMetreLng,
        latitude: latitude + worldY * distMetres * DEG_PER_METRE_LAT,
      });
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [controller]); // controller identity is stable (useMemo in parent)

  return [avatarPos, setAvatarPos] as const;
}
