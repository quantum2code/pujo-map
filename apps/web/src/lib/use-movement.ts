import { useEffect, useRef, useState } from "react";
import type { IController } from "./controller/types";

// 5 m/s — brisk walking pace
const SPEED_MPS = 5;

// Earth radius in metres — used for accurate lng delta scaling
const DEG_PER_METRE_LAT = 1 / 111_320;

export interface MovementViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
}

/**
 * Drives a MapGL viewState via a controller using a requestAnimationFrame loop.
 *
 * - Camera position IS the avatar position (follow-cam).
 * - Map bearing is fixed north-up (bearing not rotated on movement).
 * - Speed is constant in real-world metres regardless of zoom.
 * - The returned `setViewState` can also be passed to MapGL's `onMove` so
 *   mouse / touch pan and zoom continue to work normally.
 */
export function useMovement(
  controller: IController,
  initial: MovementViewState,
) {
  const [viewState, setViewState] = useState<MovementViewState>(initial);

  // Keep a ref so the rAF callback always reads the latest viewState
  // without needing to re-register the effect.
  const viewStateRef = useRef(viewState);
  viewStateRef.current = viewState;

  useEffect(() => {
    let rafId: number;
    let lastTime: number | null = null;

    function tick(now: number) {
      const dt = lastTime === null ? 0 : (now - lastTime) / 1_000; // seconds
      lastTime = now;

      const input = controller.getInput();

      if (dt > 0 && (input.x !== 0 || input.y !== 0)) {
        const { longitude, latitude, bearing = 0 } = viewStateRef.current;

        const bearingRad = (bearing * Math.PI) / 180;

        // Rotate screen-space input vector by map bearing so movement is
        // always relative to the visual "up" direction on screen.
        const worldX =
          input.x * Math.cos(bearingRad) + input.y * Math.sin(bearingRad);
        const worldY =
          -input.x * Math.sin(bearingRad) + input.y * Math.cos(bearingRad);

        const distMetres = SPEED_MPS * dt;

        // Longitude degrees shrink near the poles
        const degPerMetreLng =
          DEG_PER_METRE_LAT / Math.cos((latitude * Math.PI) / 180);

        const newLng = longitude + worldX * distMetres * degPerMetreLng;
        const newLat = latitude + worldY * distMetres * DEG_PER_METRE_LAT;

        setViewState((prev) => ({
          ...prev,
          longitude: newLng,
          latitude: newLat,
        }));
      }

      // rafId = requestAnimationFrame(tick);
    }

    // rafId = requestAnimationFrame(tick);
    // return () => cancelAnimationFrame(rafId);
  }, [controller]);

  return [viewState, setViewState] as const;
}
