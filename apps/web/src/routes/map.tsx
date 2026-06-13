import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import MapGL, { Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

import { KeyboardController } from "@/lib/controller";
import { useMovement } from "@/lib/use-movement";

const INITIAL_VIEW = {
  longitude: 88.3639,
  latitude: 22.5726,
  zoom: 16,
  bearing: 0,
  pitch: 0,
};

export const Route = createFileRoute("/map")({
  component: MapPage,
  head: () => ({
    meta: [{ title: "Map | pujo-map" }],
  }),
});

function MapPage() {
  const controller = useMemo(() => new KeyboardController(), []);
  const [viewState, setViewState] = useMovement(controller, INITIAL_VIEW);

  return (
    <div className="fixed inset-0 z-50">
      {/* HUD */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="flex gap-2 items-center bg-black/60 text-white text-xs px-4 py-2 rounded-full backdrop-blur-sm select-none">
          <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">W</kbd>
          <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">A</kbd>
          <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">S</kbd>
          <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">D</kbd>
          <span className="mx-1 opacity-50">or</span>
          <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">↑</kbd>
          <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">↓</kbd>
          <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">←</kbd>
          <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">→</kbd>
          <span className="ml-2 opacity-70">to walk</span>
        </div>
      </div>

      <MapGL
        {...viewState}
        onMove={(e) => setViewState(e.viewState)}
        style={{ width: "100%", height: "100%" }}
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
      >
        {/* Avatar marker */}
        <Marker
          longitude={viewState.longitude}
          latitude={viewState.latitude}
          anchor="center"
        >
          <div className="w-4 h-4 rounded-full bg-blue-500 ring-2 ring-white shadow-lg" />
        </Marker>
      </MapGL>
    </div>
  );
}
