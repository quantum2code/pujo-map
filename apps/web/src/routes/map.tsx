import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import MapGL, { Marker, Source, Layer } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";

import { KeyboardController } from "@/lib/controller";
import { useMovement, type AvatarPosition } from "@/lib/use-movement";
import { getWebSocketUrl } from "@/lib/server-url";

// ─── constants ────────────────────────────────────────────────────────────────

const INITIAL_AVATAR = { longitude: 88.3639, latitude: 22.5726 };

const INITIAL_LENS = {
  longitude: INITIAL_AVATAR.longitude,
  latitude: INITIAL_AVATAR.latitude,
  zoom: 16,
  bearing: 0,
  pitch: 0,
};

// Configurable parameters for auto-rotate mode
const AUTO_ROTATE_SENSITIVITY = 1.0;    // Multiplier for turning/rotation speed of the camera/map (A/D keys)
const AUTO_ROTATE_MOVEMENT_RATIO = 5.0;  // Ratio of rotation and strafing (lateral distance in meters per radian of rotation)

const ROUTE_PAINT = {
  "line-color": "#f97316", // orange-500
  "line-width": 5,
  "line-opacity": 0.75,
};

const ROUTE_LAYOUT = {
  "line-join": "round" as const,
  "line-cap": "round" as const,
};

const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

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

  const [destination, setDestination] = useState<{ longitude: number; latitude: number } | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const mapRef = useRef<MapRef>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  // Refs for websocket tracking
  const destRef = useRef(destination);
  destRef.current = destination;

  const lastSentRef = useRef<{
    longitude: number;
    latitude: number;
    destination: { longitude: number; latitude: number } | null;
    timestamp: number;
  } | null>(null);

  const sendLocationUpdate = (
    avatarPos: AvatarPosition,
    force = false
  ) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    const now = Date.now();
    const lastSent = lastSentRef.current;
    const currentDest = destRef.current;

    let shouldSend = force || !lastSent;

    if (lastSent && !shouldSend) {
      const hasDestChanged = JSON.stringify(lastSent.destination) !== JSON.stringify(currentDest);
      const hasAvatarMoved = lastSent.longitude !== avatarPos.longitude || lastSent.latitude !== avatarPos.latitude;
      const timeElapsed = now - lastSent.timestamp >= 2000;

      shouldSend = hasDestChanged || (hasAvatarMoved && timeElapsed);
    }

    if (shouldSend) {
      const payload = {
        type: "location_update",
        data: {
          longitude: avatarPos.longitude,
          latitude: avatarPos.latitude,
          destination: currentDest || undefined,
        },
      };
      console.log("[ws-relay] sending location update:", payload);
      socket.send(JSON.stringify(payload));

      lastSentRef.current = {
        longitude: avatarPos.longitude,
        latitude: avatarPos.latitude,
        destination: currentDest,
        timestamp: now,
      };
    }
  };

  const controller = useMemo(() => new KeyboardController(), []);
  const avatarPosRef = useMovement(
    controller,
    INITIAL_AVATAR,
    () => mapRef.current?.getBearing() ?? 0,
    mode === "test",
    autoRotate,
    AUTO_ROTATE_MOVEMENT_RATIO,
    AUTO_ROTATE_SENSITIVITY,
    (pos) => {
      if (markerRef.current) {
        markerRef.current.setLngLat([pos.longitude, pos.latitude]);
      }
      if (mode === "test") {
        const map = mapRef.current;
        if (map) {
          map.jumpTo({
            center: [pos.longitude, pos.latitude],
          });
        }
      }
      sendLocationUpdate(pos);
    }
  );

  // Initialize WebSocket
  useEffect(() => {
    console.log("[ws] Initializing connection to", getWebSocketUrl().toString());
    const ws = new WebSocket(getWebSocketUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[ws] connected successfully");
      sendLocationUpdate(avatarPosRef.current, true);
    };

    ws.onerror = (err) => {
      console.error("[ws] connection error:", err);
    };

    ws.onclose = (event) => {
      console.warn("[ws] connection closed:", event.code, event.reason);
    };

    ws.onmessage = (event) => {
      console.log("[ws] message received:", event.data);
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "route_update") {
          console.log("[ws] setting route geometry:", msg.data.route);
          setRouteGeometry(msg.data.route);
        }
      } catch (err) {
        console.error("[ws] failed to parse message", err);
      }
    };

    return () => {
      console.log("[ws] cleaning up connection");
      ws.close();
      wsRef.current = null;
    };
  }, []);

  // Send update immediately if destination changes
  useEffect(() => {
    sendLocationUpdate(avatarPosRef.current, true);
  }, [destination]);

  // Rotate bearing when autoRotate is on and turning keys are pressed
  useEffect(() => {
    if (mode !== "test" || !autoRotate) return;

    let rafId: number;
    let lastTime: number | null = null;
    const TURN_SPEED = 90; // base degrees per second

    function tick(now: number) {
      rafId = requestAnimationFrame(tick);
      const dt = lastTime === null ? 0 : (now - lastTime) / 1000;
      lastTime = now;

      if (dt <= 0) return;

      const input = controller.getInput();
      if (input.x !== 0) {
        const map = mapRef.current;
        if (map) {
          const currentBearing = map.getBearing();
          const newBearing = (currentBearing + input.x * TURN_SPEED * AUTO_ROTATE_SENSITIVITY * dt) % 360;
          map.setBearing(newBearing < 0 ? newBearing + 360 : newBearing);
        }
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [mode, autoRotate, controller]);

  // Clean up native avatar marker on unmount
  useEffect(() => {
    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, []);

  // ── actions ─────────────────────────────────────────────────────────────────

  function switchMode(next: ControlMode) {
    setMode(next);
    if (next === "live") {
      setAutoRotate(false);
    }
    // Update marker styling imperatively
    const el = document.getElementById("avatar-marker");
    if (el) {
      el.className = `w-4 h-4 rounded-full ring-2 ring-white shadow-lg transition-colors ${
        next === "live" ? "bg-emerald-500" : "bg-blue-500"
      }`;
    }
    // Always recenter on avatar when switching modes
    mapRef.current?.easeTo({
      center: [avatarPosRef.current.longitude, avatarPosRef.current.latitude],
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

  // Memoize route GeoJSON data to prevent resetting/parsing the GeoJSON source on every render/frame
  const routeGeoJSON = useMemo(() => {
    if (!routeGeometry) return null;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: routeGeometry,
    };
  }, [routeGeometry]);

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50">

      {/* ── Route info banner (top-center) ── */}
      {destination && (
        <div className="absolute top-16 left-4 z-10 bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-xs flex gap-3 items-center shadow-lg pointer-events-auto">
          <span>Route Active</span>
          <button
            onClick={() => {
              setDestination(null);
              setRouteGeometry(null);
            }}
            className="px-2 py-1 bg-red-500 hover:bg-red-600 rounded text-white font-semibold text-[10px]"
          >
            CLEAR
          </button>
        </div>
      )}

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
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all bg-black/50 text-white/40 backdrop-blur-sm cursor-default"
        >
          {/* SVG compass needle — red tip = north, white tip = south */}
          <svg
            id="compass-needle"
            width="18"
            height="18"
            viewBox="0 0 18 18"
            style={{
              transform: "rotate(0deg)",
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
        initialViewState={INITIAL_LENS}
        onLoad={(e) => {
          e.target.setPixelRatio(1);

          // Clean up old avatar marker if any
          if (markerRef.current) {
            markerRef.current.remove();
          }

          // Create native avatar marker
          const el = document.createElement("div");
          el.id = "avatar-marker";
          el.className = `w-4 h-4 rounded-full ring-2 ring-white shadow-lg transition-colors ${
            mode === "live" ? "bg-emerald-500" : "bg-blue-500"
          }`;

          markerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
            .setLngLat([avatarPosRef.current.longitude, avatarPosRef.current.latitude])
            .addTo(e.target);
        }}
        onMove={(e) => {
          const bearing = e.viewState.bearing;
          const needle = document.getElementById("compass-needle");
          if (needle) {
            needle.style.transform = `rotate(${-bearing}deg)`;
          }
          const compassBtn = document.getElementById("compass");
          if (compassBtn) {
            const isNorth = Math.abs(bearing) < 0.5;
            if (isNorth) {
              compassBtn.className = "w-9 h-9 rounded-full flex items-center justify-center transition-all bg-black/50 text-white/40 backdrop-blur-sm cursor-default";
            } else {
              compassBtn.className = "w-9 h-9 rounded-full flex items-center justify-center transition-all bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm shadow-lg";
            }
          }
        }}
        onClick={(e) => {
          if (mode === "test") {
            setDestination({ longitude: e.lngLat.lng, latitude: e.lngLat.lat });
          }
        }}
        style={MAP_CONTAINER_STYLE}
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
      >
        {/* Route Line */}
        {routeGeoJSON && (
          <Source
            id="route-source"
            type="geojson"
            data={routeGeoJSON}
          >
            <Layer
              id="route-layer"
              type="line"
              paint={ROUTE_PAINT}
              layout={ROUTE_LAYOUT}
            />
          </Source>
        )}

        {/* Destination Pin */}
        {destination && (
          <Marker
            longitude={destination.longitude}
            latitude={destination.latitude}
            anchor="bottom"
          >
            <div className="w-6 h-6 flex items-center justify-center bg-red-500 rounded-full border-2 border-white shadow-lg text-white font-bold text-xs select-none">
              📍
            </div>
          </Marker>
        )}
      </MapGL>
    </div>
  );
}
