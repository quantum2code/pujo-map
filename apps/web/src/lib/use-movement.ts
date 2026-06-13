import { useEffect, useRef, useState } from "react";
import type { IController } from "./controller/types";

const SPEED_MPS = 5;
const DEG_PER_METRE_LAT = 1 / 111_320;

export interface AvatarPosition {
  longitude: number;
  latitude: number;
}

/**
 * Moves the avatar position via a controller rAF loop.
 *
 * autoRotate = false (default / free-look):
 *   input.x + input.y drive 2D movement, both rotated by bearing.
 *   A/D strafe left/right relative to camera.
 *
 * autoRotate = true (heading-lock):
 *   Only input.y drives movement — forward/backward along the current bearing.
 *   input.x is ignored here; the caller uses it to turn (change bearing).
 *   No bearing-rotation applied so W always means "go the way you face".
 */
export function useMovement(
  controller: IController,
  initial: AvatarPosition,
  bearing: number = 0,
  enabled: boolean = true,
  autoRotate: boolean = false,
) {
  const [avatarPos, setAvatarPos] = useState<AvatarPosition>(initial);

  const stateRef = useRef({ avatarPos, bearing, enabled, autoRotate });
  stateRef.current = { avatarPos, bearing, enabled, autoRotate };

  useEffect(() => {
    let rafId: number;
    let lastTime: number | null = null;

    function tick(now: number) {
      rafId = requestAnimationFrame(tick);

      const dt = lastTime === null ? 0 : (now - lastTime) / 1_000;
      lastTime = now;

      const { enabled, bearing, avatarPos, autoRotate } = stateRef.current;
      if (!enabled || dt <= 0) return;

      const input = controller.getInput();
      const { longitude, latitude } = avatarPos;
      const bearingRad = (bearing * Math.PI) / 180;
      const degPerMetreLng = DEG_PER_METRE_LAT / Math.cos((latitude * Math.PI) / 180);
      const distMetres = SPEED_MPS * dt;

      if (autoRotate) {
        // Forward/backward only — project y component onto current bearing direction.
        // W (y=+1) always moves in the direction the map is facing.
        // A/D are handled externally as turning; ignore input.x here.
        if (input.y === 0) return;

        const worldX = input.y * Math.sin(bearingRad);
        const worldY = input.y * Math.cos(bearingRad);

        setAvatarPos({
          longitude: longitude + worldX * distMetres * degPerMetreLng,
          latitude: latitude + worldY * distMetres * DEG_PER_METRE_LAT,
        });
      } else {
        // Free-look: full 2D movement rotated by bearing so screen-up = forward.
        if (input.x === 0 && input.y === 0) return;

        const worldX = input.x * Math.cos(bearingRad) + input.y * Math.sin(bearingRad);
        const worldY = -input.x * Math.sin(bearingRad) + input.y * Math.cos(bearingRad);

        setAvatarPos({
          longitude: longitude + worldX * distMetres * degPerMetreLng,
          latitude: latitude + worldY * distMetres * DEG_PER_METRE_LAT,
        });
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [controller]);

  return [avatarPos, setAvatarPos] as const;
}
