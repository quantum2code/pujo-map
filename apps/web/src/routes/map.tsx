import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import MapGL, { Marker } from "react-map-gl/maplibre";
import type { MapRef, ViewState } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

import { KeyboardController } from "@/lib/controller";
import { useMovement } from "@/lib/use-movement";

// ─── constants ────────────────────────────────────────────────────────────────

const INITIAL_AVATAR = { longitude: 88.3639, latitude: 22.5726 };

// Lens = all camera properties stored from onMove.
interface Lens {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

const INITIAL_LENS: Lens = {
  longitude: INITIAL_AVATAR.longitude,
  latitude: INITIAL_AVATAR.latitude,
  zoom: 16,
  bearing: 0,
  pitch: 0,
};

// ─── types ────────────────────────────────────────────────────────────────────

type ControlMode = "test" | "live";

// ─── route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/map")({
  component: MapPage,
  head: () => ({
    meta: [{ title: "Map | pujo-map" }],
  }),
});

// ─── component ────────────────────────────────────────────────────────────────

function MapPage() {
  const [mode, setMode] = useState<ControlMode>("test");
  const [is3D, setIs3D] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);

  const mapRef = useRef<MapRef>(null);

  const [lens, setLens] = useState<Lens>(INITIAL_LENS);

  const controller = useMemo(() => new KeyboardController(), []);
  const [avatar, setAvatar] = useMovement(
    controller,
    INITIAL_AVATAR,
    lens.bearing,
    mode === "test",
    autoRotate,
  );

  // Rotate bearing when autoRotate is on and turning keys are pressed
  useEffect(() => {
    if (mode !== "test" || !autoRotate) return;

    let rafId: number;
    let lastTime: number | null = null;
    const TURN_SPEED = 90; // degrees per second

    function tick(now: number) {
      rafId = requestAnimationFrame(tick);
      const dt = lastTime === null ? 0 : (now - lastTime) / 1000;
      lastTime = now;

      if (dt <= 0) return;

      const input = controller.getInput();
      if (input.x !== 0) {
        setLens((prev) => {
          const newBearing = (prev.bearing + input.x * TURN_SPEED * dt) % 360;
          return {
            ...prev,
            bearing: newBearing < 0 ? newBearing + 360 : newBearing,
          };
        });
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [mode, autoRotate, controller]);

  // ── actions ─────────────────────────────────────────────────────────────────

  function switchMode(next: ControlMode) {
    setMode(next);
    if (next === "live") {
      setAutoRotate(false);
    }
    // Always recenter on avatar when switching modes
    mapRef.current?.easeTo({
      center: [avatar.longitude, avatar.latitude],
      duration: 500,
    });
  }

  function toggle3D() {
    const next = !is3D;
    setIs3D(next);
    mapRef.current?.easeTo({
      pitch: next ? 65 : 0,
      zoom: next ? 18 : 16,
      duration: 700,
    });
  }

  function resetNorth() {
    mapRef.current?.easeTo({ bearing: 0, duration: 400 });
  }

  // ── viewState ────────────────────────────────────────────────────────────────

  // test mode — longitude/latitude locked to avatar (snap-back on drag)
  // live mode — longitude/latitude free from lens (full pan)
  const viewState: ViewState = {
    longitude: mode === "test" ? avatar.longitude : lens.longitude,
    latitude: mode === "test" ? avatar.latitude : lens.latitude,
    zoom: lens.zoom,
    bearing: lens.bearing,
    pitch: lens.pitch,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
  };

  // Compass needle rotates opposite to bearing so N always points true north
  const compassRotation = -lens.bearing;
  const isNorth = Math.abs(lens.bearing) < 0.5;

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50">

      {/* ── Mode badges (top-left) ── */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button
          id="mode-test"
          onClick={() => switchMode("test")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            mode === "test"
              ? "bg-blue-500 text-white shadow-lg"
              : "bg-black/50 text-white/60 hover:text-white backdrop-blur-sm"
          }`}
        >
          TEST
        </button>
        <button
          id="mode-live"
          onClick={() => switchMode("live")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            mode === "live"
              ? "bg-emerald-500 text-white shadow-lg"
              : "bg-black/50 text-white/60 hover:text-white backdrop-blur-sm"
          }`}
        >
          LIVE
        </button>
      </div>

      {/* ── Controls (top-right): compass + 3D + auto-rotate ── */}
      <div className="absolute top-4 right-4 z-10 flex gap-2 items-center">
        {/* AUTO toggle */}
        {mode === "test" && (
          <button
            id="toggle-auto"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              autoRotate
                ? "bg-blue-500 text-white shadow-lg"
                : "bg-black/50 text-white/60 hover:text-white backdrop-blur-sm"
            }`}
          >
            AUTO
          </button>
        )}

        {/* Compass — rotates to show current bearing, click resets to north */}
        <button
          id="compass"
          onClick={resetNorth}
          title="Reset to north"
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
            isNorth
              ? "bg-black/50 text-white/40 backdrop-blur-sm cursor-default"
              : "bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm shadow-lg"
          }`}
        >
          {/* SVG compass needle — red tip = north, white tip = south */}
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            style={{
              transform: `rotate(${compassRotation}deg)`,
              transition: "transform 0.1s linear",
            }}
          >
            {/* North needle (red) */}
            <polygon points="9,1 6.5,9 9,8 11.5,9" fill="#ef4444" />
            {/* South needle (white/dim) */}
            <polygon points="9,17 6.5,9 9,10 11.5,9" fill="rgba(255,255,255,0.4)" />
            {/* Center dot */}
            <circle cx="9" cy="9" r="1.5" fill="white" />
          </svg>
        </button>

        {/* 3D toggle */}
        <button
          id="toggle-3d"
          onClick={toggle3D}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            is3D
              ? "bg-orange-500 text-white shadow-lg"
              : "bg-black/50 text-white/60 hover:text-white backdrop-blur-sm"
          }`}
        >
          3D
        </button>
      </div>

      {/* ── Key hint HUD (bottom-center, test mode only) ── */}
      {mode === "test" && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="flex gap-2 items-center bg-black/60 text-white text-xs px-4 py-2 rounded-full backdrop-blur-sm select-none">
            {autoRotate ? (
              <>
                <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">W</kbd>
                <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">S</kbd>
                <span className="ml-1 opacity-70">to move,</span>
                <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">A</kbd>
                <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">D</kbd>
                <span className="ml-1 opacity-70">to turn</span>
              </>
            ) : (
              <>
                {["W", "A", "S", "D"].map((k) => (
                  <kbd key={k} className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">{k}</kbd>
                ))}
                <span className="mx-1 opacity-50">or</span>
                {["↑", "↓", "←", "→"].map((k) => (
                  <kbd key={k} className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">{k}</kbd>
                ))}
                <span className="ml-2 opacity-70">to move marker</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Map ── */}
      <MapGL
        ref={mapRef}
        {...viewState}
        onMove={(e) =>
          setLens({
            longitude: e.viewState.longitude,
            latitude: e.viewState.latitude,
            zoom: e.viewState.zoom,
            bearing: e.viewState.bearing,
            pitch: e.viewState.pitch,
          })
        }
        style={{ width: "100%", height: "100%" }}
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
      >
        {/* Avatar — pinned to its own lat/lng, independent of camera */}
        <Marker
          longitude={avatar.longitude}
          latitude={avatar.latitude}
          anchor="center"
        >
          <div
            className={`w-4 h-4 rounded-full ring-2 ring-white shadow-lg transition-colors ${
              mode === "live" ? "bg-emerald-500" : "bg-blue-500"
            }`}
          />
        </Marker>
      </MapGL>
    </div>
  );
}
