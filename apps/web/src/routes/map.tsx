import * as React from "react";
import { Layer, Map as MapReact, Source } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css"; // See notes below
import { authClient } from "@/lib/auth-client";
import { getServerUrl } from "@/lib/server-url";
import { createFileRoute, redirect } from "@tanstack/react-router";

type PlaceMarker = {
  id: string;
  name: string | null;
  amenity: string | null;
  latitude: number;
  longitude: number;
};

const layerStyle = {
  id: "places-layer",
  type: "circle",
  paint: {
    "circle-radius": 5,
    "circle-color": "#f43f5e",
    "circle-stroke-width": 1,
    "circle-stroke-color": "#ffffff",
  },
} as const;

export const Route = createFileRoute("/map")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({
        to: "/login",
        throw: true,
      });
    }
    return { session };
  },
});

function RouteComponent() {
  const [viewState, setViewState] = React.useState({
    longitude: -100,
    latitude: 40,
    zoom: 8,
  });
  const [places, setPlaces] = React.useState<PlaceMarker[]>([]);

  const geojson = React.useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: places.map((place) => ({
        type: "Feature" as const,
        properties: {
          id: place.id,
          name: place.name,
          amenity: place.amenity,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [place.longitude, place.latitude],
        },
      })),
    }),
    [places],
  );

  React.useEffect(() => {
    const getCoords = () => {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
          const { latitude, longitude } = position.coords;
          setViewState((prev) => ({
            ...prev,
            latitude,
            longitude,
            zoom: 15,
          }));
        });
      }
    };
    getCoords();
  }, []);

  React.useEffect(() => {
    let mounted = true;

    const loadPlaces = async () => {
      const res = await fetch(`${getServerUrl()}api/place`, {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to load places");
      }

      const data = (await res.json()) as PlaceMarker[];
      if (mounted) setPlaces(data);
    };

    loadPlaces().catch((error) => {
      console.error(error);
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div>
      <MapReact
        {...viewState}
        onMove={(e) => setViewState(e.viewState)}
        style={{ width: "100%", height: "100%" }}
        mapStyle="https://tiles.openfreemap.org/styles/bright"
      >
        <Source id="my-data" type="geojson" data={geojson}>
          <Layer {...layerStyle} />
        </Source>
      </MapReact>
    </div>
  );
}
