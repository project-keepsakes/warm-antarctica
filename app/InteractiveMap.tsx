"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map } from "maplibre-gl";
import { feature } from "topojson-client";
import land from "world-atlas/land-50m.json";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ShelfRegion } from "./journey";
import currentField from "./data/southern-ocean-currents.json";

export type StopId = "antarctica" | "water" | "ocean" | "newyork";
export type StoryLayers = { warm: boolean; ice: boolean; global: boolean };

const views: Record<StopId, maplibregl.FlyToOptions> = {
  antarctica: { center: [0, -63], zoom: 0.85, pitch: 18, bearing: 0, duration: 1800 },
  water: { center: [-104, -72.5], zoom: 3.35, pitch: 48, bearing: -20, duration: 1800 },
  ocean: { center: [-28, -42], zoom: 1.15, pitch: 12, bearing: 0, duration: 1800 },
  newyork: { center: [-74.0, 40.7], zoom: 4.25, pitch: 50, bearing: -18, duration: 1800 },
};

const bellingshausenWaterView: maplibregl.FlyToOptions = { center: [-72, -72], zoom: 3.15, pitch: 46, bearing: 18, duration: 1800 };
const tottenWaterView: maplibregl.FlyToOptions = { center: [120, -66], zoom: 3.15, pitch: 46, bearing: 18, duration: 1800 };

const hotspots = [
  { id: "antarctica", coordinates: [0, -78] },
  { id: "water", coordinates: [-104, -72.5] },
  { id: "ocean", coordinates: [-28, -42] },
  { id: "newyork", coordinates: [-74.0, 40.7] },
];

const amundsenPaths = [
  [[-136, -65], [-126, -67], [-116, -69], [-106, -72], [-101, -75]],
  [[-131, -66], [-122, -68], [-113, -70], [-104, -72.5], [-101, -75]],
  [[-127, -67], [-119, -69], [-111, -71], [-105, -73], [-101, -75]],
] as [number, number][][];

const bellingshausenPaths = [
  [[-95, -65], [-88, -67], [-81, -69], [-75, -71], [-70, -73]],
  [[-91, -66], [-84, -68], [-78, -70], [-73, -72], [-70, -73]],
  [[-87, -67], [-82, -69], [-76, -71], [-72, -72.5], [-70, -73]],
] as [number, number][][];

const tottenPaths = [
  [[135, -61], [129, -63], [124, -65], [120, -67], [117, -68]],
  [[132, -62], [127, -64], [122, -66], [119, -67.5], [117, -68]],
  [[129, -63], [125, -65], [121, -66.5], [118, -67.7], [117, -68]],
] as [number, number][][];

const globalOceanBands = [
  [[-170, -55], [-130, -53], [-90, -55], [-50, -52], [-10, -54], [30, -52], [70, -55], [110, -53], [150, -55]],
  [[-170, -61], [-130, -59], [-90, -61], [-50, -58], [-10, -60], [30, -58], [70, -61], [110, -59], [150, -61]],
  [[-170, -67], [-130, -65], [-90, -67], [-50, -64], [-10, -66], [30, -64], [70, -67], [110, -65], [150, -67]],
] as [number, number][][];

const newYorkWaterLevels = [
  { level: "low", coordinates: [[-82, 27], [-78, 31], [-74.5, 35], [-71, 38.8], [-66, 42]] },
  { level: "middle", coordinates: [[-84, 28.5], [-80, 33], [-76, 37], [-72.5, 40.2], [-68, 43]] },
  { level: "high", coordinates: [[-86, 29], [-82, 34], [-78, 38], [-74, 40.7], [-69, 43.5]] },
] as { level: "low" | "middle" | "high"; coordinates: [number, number][] }[];

const regionalWaterPoints: Record<ShelfRegion, [number, number]> = {
  amundsen: [-104, -72.5],
  bellingshausen: [-72, -72],
  totten: [116, -67],
};

const regionalShelfPoints: Record<ShelfRegion, [number, number]> = {
  amundsen: [-101, -75],
  bellingshausen: [-70, -73],
  totten: [117, -68],
};

const mapLabels = {
  type: "FeatureCollection" as const,
  features: [
    { type: "Feature" as const, properties: { name: "Amundsen Sea", stages: "water,antarctica", region: "amundsen" }, geometry: { type: "Point" as const, coordinates: [-112, -69] } },
    { type: "Feature" as const, properties: { name: "Bellingshausen Sea", stages: "water,antarctica", region: "bellingshausen" }, geometry: { type: "Point" as const, coordinates: [-80, -68] } },
    { type: "Feature" as const, properties: { name: "Totten Glacier", stages: "water,antarctica", region: "totten" }, geometry: { type: "Point" as const, coordinates: [119, -66] } },
    { type: "Feature" as const, properties: { name: "Southern Ocean", stages: "ocean", region: "all" }, geometry: { type: "Point" as const, coordinates: [-28, -47] } },
    { type: "Feature" as const, properties: { name: "New York City", stages: "newyork", region: "all" }, geometry: { type: "Point" as const, coordinates: [-73.7, 41.5] } },
  ],
};

function pointAlongPath(path: [number, number][], progress: number): [number, number] {
  const scaled = progress * (path.length - 1);
  const start = path[Math.floor(scaled)] ?? path[0];
  const end = path[Math.min(Math.ceil(scaled), path.length - 1)] ?? start;
  const amount = scaled - Math.floor(scaled);
  return [start[0] + (end[0] - start[0]) * amount, start[1] + (end[1] - start[1]) * amount];
}

function particleFeatures(paths: [number, number][][], progress: number) {
  return {
    type: "FeatureCollection" as const,
    features: paths.flatMap((path, pathIndex) => [0, 0.45].map((offset) => ({
      type: "Feature" as const,
      properties: {},
      geometry: { type: "Point" as const, coordinates: pointAlongPath(path, (progress + offset + pathIndex * 0.12) % 1) },
    }))),
  };
}

function ringPulseFeatures(paths: [number, number][][], progress: number) {
  return {
    type: "FeatureCollection" as const,
    features: paths.map((coordinates, index) => {
      // The stored bands run outer to inner, so reverse their pulse order.
      const pulseIndex = paths.length - 1 - index;
      const phase = progress * paths.length - pulseIndex;
      const pulse = phase >= 0 && phase < 1 ? Math.sin(Math.PI * phase) : 0;
      return { type: "Feature" as const, properties: { pulse }, geometry: { type: "LineString" as const, coordinates } };
    }),
  };
}

function newYorkWaterLevelFeatures(progress: number) {
  return {
    type: "FeatureCollection" as const,
    features: newYorkWaterLevels.map((waterLevel, index) => {
      const phase = progress * newYorkWaterLevels.length - index;
      const pulse = phase >= 0 && phase < 1 ? Math.sin(Math.PI * phase) : 0;
      return { type: "Feature" as const, properties: { level: waterLevel.level, pulse }, geometry: { type: "LineString" as const, coordinates: waterLevel.coordinates } };
    }),
  };
}

function currentParticleFeatures(progress: number) {
  return {
    type: "FeatureCollection" as const,
    features: currentField.vectors.filter((_, index) => index % 11 === 0).map(([longitude, latitude, eastward, northward], index) => {
      const phase = (progress + index * 0.173) % 1;
      // Each short path follows the sampled daily velocity direction. Its visual pace is intentionally accelerated.
      return { type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: [longitude + eastward * phase * 9, latitude + northward * phase * 9] } };
    }),
  };
}

function currentDirectionFeatures() {
  return {
    type: "FeatureCollection" as const,
    features: currentField.vectors
      .filter(([,, eastward, northward]) => Math.hypot(eastward, northward) > 0.015)
      .filter((_, index) => index % 380 === 0)
      .map(([longitude, latitude, eastward, northward]) => ({
      type: "Feature" as const,
      properties: { rotation: -Math.atan2(northward, eastward) * 180 / Math.PI },
      geometry: { type: "Point" as const, coordinates: [longitude, latitude] },
    })),
  };
}

function setStageVisuals(instance: Map, active: StopId, region: ShelfRegion, layers: StoryLayers, currentsMode: boolean) {
  const showLocalFlow = layers.warm && (active === "water" || active === "antarctica");
  const showAmundsen = showLocalFlow && region === "amundsen";
  const showBellingshausen = showLocalFlow && region === "bellingshausen";
  const showTotten = showLocalFlow && region === "totten";
  instance.setLayoutProperty("amundsen-flow-line", "visibility", showAmundsen ? "visible" : "none");
  instance.setLayoutProperty("amundsen-flow-glow", "visibility", showAmundsen ? "visible" : "none");
  instance.setLayoutProperty("amundsen-particle-glow", "visibility", showAmundsen ? "visible" : "none");
  instance.setLayoutProperty("amundsen-particle-core", "visibility", showAmundsen ? "visible" : "none");
  instance.setLayoutProperty("bellingshausen-flow-line", "visibility", showBellingshausen ? "visible" : "none");
  instance.setLayoutProperty("bellingshausen-flow-glow", "visibility", showBellingshausen ? "visible" : "none");
  instance.setLayoutProperty("bellingshausen-particle-glow", "visibility", showBellingshausen ? "visible" : "none");
  instance.setLayoutProperty("bellingshausen-particle-core", "visibility", showBellingshausen ? "visible" : "none");
  instance.setLayoutProperty("totten-flow-line", "visibility", showTotten ? "visible" : "none");
  instance.setLayoutProperty("totten-flow-glow", "visibility", showTotten ? "visible" : "none");
  instance.setLayoutProperty("totten-particle-glow", "visibility", showTotten ? "visible" : "none");
  instance.setLayoutProperty("totten-particle-core", "visibility", showTotten ? "visible" : "none");
  const showShelfWarmth = layers.ice && active === "antarctica";
  instance.setLayoutProperty("ice-shelf-warm-zone", "visibility", showShelfWarmth ? "visible" : "none");
  instance.setLayoutProperty("ice-shelf-heat-halo", "visibility", showShelfWarmth ? "visible" : "none");
  instance.setLayoutProperty("global-ocean-band-glow", "visibility", !currentsMode && layers.global && active === "ocean" ? "visible" : "none");
  instance.setLayoutProperty("global-ocean-band-core", "visibility", !currentsMode && layers.global && active === "ocean" ? "visible" : "none");
  instance.setLayoutProperty("global-ocean-band-pulse-glow", "visibility", !currentsMode && layers.global && active === "ocean" ? "visible" : "none");
  instance.setLayoutProperty("global-ocean-band-pulse-core", "visibility", !currentsMode && layers.global && active === "ocean" ? "visible" : "none");
  instance.setLayoutProperty("southern-ocean-current-particle-glow", "visibility", currentsMode ? "visible" : "none");
  instance.setLayoutProperty("southern-ocean-current-particle-core", "visibility", currentsMode ? "visible" : "none");
  instance.setLayoutProperty("southern-ocean-current-arrows", "visibility", currentsMode ? "visible" : "none");
  instance.setLayoutProperty("new-york-water-glow", "visibility", layers.global && active === "newyork" ? "visible" : "none");
  instance.setLayoutProperty("new-york-water-line", "visibility", layers.global && active === "newyork" ? "visible" : "none");
  instance.setLayoutProperty("new-york-water-pulse-glow", "visibility", layers.global && active === "newyork" ? "visible" : "none");
  instance.setLayoutProperty("new-york-water-pulse-core", "visibility", layers.global && active === "newyork" ? "visible" : "none");
  const visibleLabels = mapLabels.features.filter((label) => label.properties.stages.split(",").includes(active) && (label.properties.region === "all" || label.properties.region === region));
  instance.setFilter("map-labels", ["any", ...visibleLabels.map((label) => ["==", ["get", "name"], label.properties.name])] as maplibregl.FilterSpecification);
}

export function InteractiveMap({ active, region, layers, storyMode, currentsMode, onSelect, onStoryStep }: { active: StopId; region: ShelfRegion; layers: StoryLayers; storyMode: boolean; currentsMode: boolean; onSelect: (id: StopId) => void; onStoryStep: (direction: -1 | 1) => void }) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const onSelectRef = useRef(onSelect);
  const activeRef = useRef(active);
  const regionRef = useRef(region);
  const layersRef = useRef(layers);
  const storyModeRef = useRef(storyMode);
  const currentsModeRef = useRef(currentsMode);
  const onStoryStepRef = useRef(onStoryStep);
  const reducedMotion = useRef(false);

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { regionRef.current = region; }, [region]);
  useEffect(() => { layersRef.current = layers; }, [layers]);
  useEffect(() => { storyModeRef.current = storyMode; }, [storyMode]);
  useEffect(() => { currentsModeRef.current = currentsMode; }, [currentsMode]);
  useEffect(() => { onStoryStepRef.current = onStoryStep; }, [onStoryStep]);

  useEffect(() => {
    if (!node.current || map.current) return;
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const instance = new maplibregl.Map({
      container: node.current,
      style: { version: 8, glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf", sources: {}, layers: [{ id: "ocean", type: "background", paint: { "background-color": "#061b2b" } }] },
      center: [0, -55],
      zoom: 1.2,
        minZoom: 1,
      maxZoom: 4.8,
      pitch: 16,
      attributionControl: false,
    });
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    instance.on("load", () => {
      instance.setProjection({ type: "globe" });
      const landFeature = feature(land as never, (land as { objects: { land: never } }).objects.land);
      instance.addSource("land", { type: "geojson", data: landFeature });
      instance.addLayer({ id: "land-fill", type: "fill", source: "land", paint: { "fill-color": "#8fc8d5", "fill-opacity": 0.72 } });
      instance.addLayer({ id: "land-line", type: "line", source: "land", paint: { "line-color": "#d5fbff", "line-opacity": 0.38, "line-width": 0.7 } });
      instance.addSource("hotspots", { type: "geojson", data: { type: "FeatureCollection", features: hotspots.map((point) => ({ type: "Feature", properties: { id: point.id }, geometry: { type: "Point", coordinates: point.id === "water" ? regionalWaterPoints[regionRef.current] : point.coordinates } })) } });
      instance.addLayer({ id: "hotspot-halo", type: "circle", source: "hotspots", paint: { "circle-radius": 15, "circle-color": "#7de6f4", "circle-opacity": 0.12, "circle-stroke-color": "#baf9ff", "circle-stroke-width": 1 } });
      instance.addLayer({ id: "hotspot-core", type: "circle", source: "hotspots", paint: { "circle-radius": 4.5, "circle-color": "#efffff", "circle-stroke-color": "#42c6df", "circle-stroke-width": 2 } });
      instance.addSource("map-labels", { type: "geojson", data: mapLabels });
      instance.addLayer({ id: "map-labels", type: "symbol", source: "map-labels", layout: { "text-field": ["get", "name"], "text-font": ["Open Sans Semibold"], "text-size": 13, "text-letter-spacing": 0.04, "text-offset": [0, 1.15], "text-anchor": "top" }, paint: { "text-color": "#e4fbff", "text-halo-color": "#031720", "text-halo-width": 1.5 } });
      instance.addSource("global-ocean-bands", { type: "geojson", data: { type: "FeatureCollection", features: globalOceanBands.map((coordinates) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } })) } });
      instance.addLayer({ id: "global-ocean-band-glow", type: "line", source: "global-ocean-bands", layout: { visibility: "none" }, paint: { "line-color": "#5de0f4", "line-opacity": 0.24, "line-width": 15, "line-blur": 8 } });
      instance.addLayer({ id: "global-ocean-band-core", type: "line", source: "global-ocean-bands", layout: { visibility: "none" }, paint: { "line-color": "#9af5ff", "line-opacity": 0.62, "line-width": 2.2, "line-blur": 1 } });
      // The fixed rings pulse from inner to outer as a visual cue for global connection, not measured currents or a route to New York.
      instance.addSource("global-ocean-band-pulses", { type: "geojson", data: ringPulseFeatures(globalOceanBands, 0) });
      instance.addLayer({ id: "global-ocean-band-pulse-glow", type: "line", source: "global-ocean-band-pulses", layout: { visibility: "none" }, paint: { "line-color": "#65e3f3", "line-opacity": ["get", "pulse"], "line-width": 13, "line-blur": 7 } });
      instance.addLayer({ id: "global-ocean-band-pulse-core", type: "line", source: "global-ocean-band-pulses", layout: { visibility: "none" }, paint: { "line-color": "#e2fdff", "line-opacity": ["get", "pulse"], "line-width": 2.9 } });
      // These particles use a fixed Copernicus daily current field at 15.81 m. They do not show flow below ice shelves.
      instance.addSource("southern-ocean-current-particles", { type: "geojson", data: currentParticleFeatures(0) });
      instance.addLayer({ id: "southern-ocean-current-particle-glow", type: "circle", source: "southern-ocean-current-particles", layout: { visibility: "none" }, paint: { "circle-radius": 7, "circle-color": "#5de0f4", "circle-opacity": 0.34, "circle-blur": 0.75 } });
      instance.addLayer({ id: "southern-ocean-current-particle-core", type: "circle", source: "southern-ocean-current-particles", layout: { visibility: "none" }, paint: { "circle-radius": 1.9, "circle-color": "#d9fcff", "circle-opacity": 0.9 } });
      // Sparse arrowheads clarify the actual sampled direction; particles alone only show that the field is moving.
      instance.addSource("southern-ocean-current-arrows", { type: "geojson", data: currentDirectionFeatures() });
      instance.addLayer({ id: "southern-ocean-current-arrows", type: "symbol", source: "southern-ocean-current-arrows", layout: { visibility: "none", "text-field": ">", "text-font": ["Open Sans Bold"], "text-size": 24, "text-rotate": ["get", "rotation"], "text-keep-upright": false, "text-allow-overlap": true, "text-ignore-placement": true }, paint: { "text-color": "#d9fcff", "text-halo-color": "#0a5265", "text-halo-width": 1.2 } });
      instance.addSource("amundsen-flow", { type: "geojson", data: { type: "FeatureCollection", features: amundsenPaths.map((coordinates) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } })) } });
      instance.addLayer({ id: "amundsen-flow-glow", type: "line", source: "amundsen-flow", layout: { visibility: "none" }, paint: { "line-color": "#ffb85e", "line-opacity": 0.34, "line-width": 7, "line-blur": 3 } });
      instance.addLayer({ id: "amundsen-flow-line", type: "line", source: "amundsen-flow", layout: { visibility: "none" }, paint: { "line-color": "#ffd28c", "line-opacity": 0.9, "line-width": 2.5, "line-dasharray": [1, 1.4] } });
      // These particles explain the sourced local path; they are not live current measurements.
      instance.addSource("amundsen-particles", { type: "geojson", data: particleFeatures(amundsenPaths, 0) });
      instance.addLayer({ id: "amundsen-particle-glow", type: "circle", source: "amundsen-particles", layout: { visibility: "none" }, paint: { "circle-radius": 10, "circle-color": "#ffb85e", "circle-opacity": 0.38, "circle-blur": 0.7 } });
      instance.addLayer({ id: "amundsen-particle-core", type: "circle", source: "amundsen-particles", layout: { visibility: "none" }, paint: { "circle-radius": 2.8, "circle-color": "#fff0c8", "circle-stroke-color": "#ffbd61", "circle-stroke-width": 1, "circle-opacity": 1 } });
      instance.addSource("bellingshausen-flow", { type: "geojson", data: { type: "FeatureCollection", features: bellingshausenPaths.map((coordinates) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } })) } });
      instance.addLayer({ id: "bellingshausen-flow-glow", type: "line", source: "bellingshausen-flow", layout: { visibility: "none" }, paint: { "line-color": "#d9935a", "line-opacity": 0.34, "line-width": 7, "line-blur": 3 } });
      instance.addLayer({ id: "bellingshausen-flow-line", type: "line", source: "bellingshausen-flow", layout: { visibility: "none" }, paint: { "line-color": "#ffe0ad", "line-opacity": 0.9, "line-width": 2.5, "line-dasharray": [1, 1.4] } });
      // This is a local explanatory path for George VI Ice Shelf, not a measured parcel track.
      instance.addSource("bellingshausen-particles", { type: "geojson", data: particleFeatures(bellingshausenPaths, 0) });
      instance.addLayer({ id: "bellingshausen-particle-glow", type: "circle", source: "bellingshausen-particles", layout: { visibility: "none" }, paint: { "circle-radius": 10, "circle-color": "#d9935a", "circle-opacity": 0.38, "circle-blur": 0.7 } });
      instance.addLayer({ id: "bellingshausen-particle-core", type: "circle", source: "bellingshausen-particles", layout: { visibility: "none" }, paint: { "circle-radius": 2.8, "circle-color": "#fff0d5", "circle-stroke-color": "#eab477", "circle-stroke-width": 1, "circle-opacity": 1 } });
      instance.addSource("totten-flow", { type: "geojson", data: { type: "FeatureCollection", features: tottenPaths.map((coordinates) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } })) } });
      instance.addLayer({ id: "totten-flow-glow", type: "line", source: "totten-flow", layout: { visibility: "none" }, paint: { "line-color": "#e0a56d", "line-opacity": 0.34, "line-width": 7, "line-blur": 3 } });
      instance.addLayer({ id: "totten-flow-line", type: "line", source: "totten-flow", layout: { visibility: "none" }, paint: { "line-color": "#ffe0ad", "line-opacity": 0.9, "line-width": 2.5, "line-dasharray": [1, 1.4] } });
      // This is a local explanatory path for Totten Glacier, not a measured parcel track.
      instance.addSource("totten-particles", { type: "geojson", data: particleFeatures(tottenPaths, 0) });
      instance.addLayer({ id: "totten-particle-glow", type: "circle", source: "totten-particles", layout: { visibility: "none" }, paint: { "circle-radius": 10, "circle-color": "#e0a56d", "circle-opacity": 0.38, "circle-blur": 0.7 } });
      instance.addLayer({ id: "totten-particle-core", type: "circle", source: "totten-particles", layout: { visibility: "none" }, paint: { "circle-radius": 2.8, "circle-color": "#fff0d5", "circle-stroke-color": "#eab477", "circle-stroke-width": 1, "circle-opacity": 1 } });
      instance.addSource("ice-shelf-heat", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: regionalShelfPoints[regionRef.current] } } });
      // This local glow marks below-shelf ocean heat. It does not mean the whole continent is warming in the same way.
      instance.addLayer({ id: "ice-shelf-warm-zone", type: "circle", source: "ice-shelf-heat", layout: { visibility: "none" }, paint: { "circle-radius": 38, "circle-color": "#ffb35e", "circle-opacity": 0.3, "circle-blur": 0.82 } });
      instance.addLayer({ id: "ice-shelf-heat-halo", type: "circle", source: "ice-shelf-heat", layout: { visibility: "none" }, paint: { "circle-radius": 13, "circle-color": "#ffb35e", "circle-opacity": 0.72, "circle-stroke-color": "#ffe0a8", "circle-stroke-width": 1 } });
      // These long illustrative lines pulse in sequence as a local water-level cue, not a flood boundary, forecast, or route from Antarctica.
      instance.addSource("new-york-water-cue", { type: "geojson", data: { type: "FeatureCollection", features: newYorkWaterLevels.map((waterLevel) => ({ type: "Feature", properties: { level: waterLevel.level }, geometry: { type: "LineString", coordinates: waterLevel.coordinates } })) } });
      instance.addLayer({ id: "new-york-water-glow", type: "line", source: "new-york-water-cue", layout: { visibility: "none" }, paint: { "line-color": "#62ddec", "line-opacity": 0.24, "line-width": 11, "line-blur": 5 } });
      instance.addLayer({ id: "new-york-water-line", type: "line", source: "new-york-water-cue", layout: { visibility: "none" }, paint: { "line-color": "#c4fbff", "line-opacity": 0.62, "line-width": 2.7 } });
      instance.addSource("new-york-water-pulse", { type: "geojson", data: newYorkWaterLevelFeatures(0) });
      instance.addLayer({ id: "new-york-water-pulse-glow", type: "line", source: "new-york-water-pulse", layout: { visibility: "none" }, paint: { "line-color": "#65e3f3", "line-opacity": ["get", "pulse"], "line-width": 11, "line-blur": 6 } });
      instance.addLayer({ id: "new-york-water-pulse-core", type: "line", source: "new-york-water-pulse", layout: { visibility: "none" }, paint: { "line-color": "#e2fdff", "line-opacity": ["get", "pulse"], "line-width": 3.5 } });
      instance.on("click", "hotspot-core", (event) => { const id = event.features?.[0]?.properties?.id as StopId | undefined; if (id) onSelectRef.current(id); });
      instance.on("mouseenter", "hotspot-core", () => { instance.getCanvas().style.cursor = "pointer"; });
      instance.on("mouseleave", "hotspot-core", () => { instance.getCanvas().style.cursor = ""; });
      setStageVisuals(instance, activeRef.current, regionRef.current, layersRef.current, currentsModeRef.current);
      instance.flyTo({ ...views.water, duration: reducedMotion.current ? 0 : views.water.duration });
    });
    let particleProgress = 0;
    let pulseProgress = 0;
    let newYorkPulseProgress = 0;
    let currentParticleProgress = 0;
    const particleTimer = reducedMotion.current ? undefined : window.setInterval(() => {
      if (activeRef.current !== "water" && activeRef.current !== "antarctica") return;
      particleProgress = (particleProgress + 0.018) % 1;
      const currentRegion = regionRef.current;
      const source = instance.getSource(`${currentRegion}-particles`) as maplibregl.GeoJSONSource | undefined;
      source?.setData(particleFeatures(currentRegion === "amundsen" ? amundsenPaths : currentRegion === "bellingshausen" ? bellingshausenPaths : tottenPaths, particleProgress));
    }, 80);
    const pulseTimer = reducedMotion.current ? undefined : window.setInterval(() => {
      if (activeRef.current !== "ocean" || !layersRef.current.global) return;
      pulseProgress = (pulseProgress + 0.018) % 1;
      (instance.getSource("global-ocean-band-pulses") as maplibregl.GeoJSONSource | undefined)?.setData(ringPulseFeatures(globalOceanBands, pulseProgress));
    }, 80);
    const newYorkPulseTimer = reducedMotion.current ? undefined : window.setInterval(() => {
      if (activeRef.current !== "newyork" || !layersRef.current.global) return;
      newYorkPulseProgress = (newYorkPulseProgress + 0.018) % 1;
      (instance.getSource("new-york-water-pulse") as maplibregl.GeoJSONSource | undefined)?.setData(newYorkWaterLevelFeatures(newYorkPulseProgress));
    }, 80);
    const currentParticleTimer = reducedMotion.current ? undefined : window.setInterval(() => {
      if (!currentsModeRef.current) return;
      currentParticleProgress = (currentParticleProgress + 0.016) % 1;
      (instance.getSource("southern-ocean-current-particles") as maplibregl.GeoJSONSource | undefined)?.setData(currentParticleFeatures(currentParticleProgress));
    }, 80);
    let lastScrollStep = 0;
    const storyWheelOptions = { passive: false, capture: true };
    const handleStoryScroll = (event: WheelEvent) => {
      if (!storyModeRef.current || event.deltaY === 0 || Date.now() - lastScrollStep < 700) return;
      event.preventDefault();
      event.stopPropagation();
      lastScrollStep = Date.now();
      onStoryStepRef.current(event.deltaY > 0 ? 1 : -1);
    };
    // Capture wheel input before MapLibre's canvas handler can zoom in Story mode.
    instance.getContainer().addEventListener("wheel", handleStoryScroll, storyWheelOptions);
    return () => { if (particleTimer) window.clearInterval(particleTimer); if (pulseTimer) window.clearInterval(pulseTimer); if (newYorkPulseTimer) window.clearInterval(newYorkPulseTimer); if (currentParticleTimer) window.clearInterval(currentParticleTimer); instance.getContainer().removeEventListener("wheel", handleStoryScroll, storyWheelOptions); instance.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    if (!map.current?.isStyleLoaded()) return;
    const view = active === "water" ? region === "bellingshausen" ? bellingshausenWaterView : region === "totten" ? tottenWaterView : views.water : views[active];
    map.current.flyTo({ ...view, duration: reducedMotion.current ? 0 : view.duration });
    const hotspotSource = map.current.getSource("hotspots") as maplibregl.GeoJSONSource | undefined;
    hotspotSource?.setData({ type: "FeatureCollection", features: hotspots.map((point) => ({ type: "Feature", properties: { id: point.id }, geometry: { type: "Point", coordinates: point.id === "water" ? regionalWaterPoints[region] : point.coordinates } })) });
    const heatSource = map.current.getSource("ice-shelf-heat") as maplibregl.GeoJSONSource | undefined;
    heatSource?.setData({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: regionalShelfPoints[region] } });
    setStageVisuals(map.current, active, region, layers, currentsMode);
  }, [active, region, layers, currentsMode]);
  useEffect(() => {
    if (!map.current?.isStyleLoaded()) return;
    if (storyMode) map.current.scrollZoom.disable();
    else map.current.scrollZoom.enable();
  }, [storyMode]);
  return <div className="map-canvas" ref={node} aria-label="Interactive globe map with Antarctica, Southern Ocean, Atlantic, and New York hotspots" />;
}
