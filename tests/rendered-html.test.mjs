import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fetchWorker } from "./worker-runtime.mjs";

async function render() {
  return fetchWorker();
}

test("server-renders Warm Antarctica and its first journey step", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Warm Antarctica<\/title>/i);
  assert.match(html, /Warm water reaches the Amundsen Sea shelf/i);
  assert.match(html, /Play journey/i);
  assert.match(html, /Interactive climate learning map/i);
  assert.match(html, /Start journey/i);
  assert.match(html, /Explore on my own/i);
  assert.match(html, /NASA: Pine Island Glacier/i);
  assert.doesNotMatch(html, /Your site is taking shape|SkeletonPreview/i);
});

test("journey data keeps one source per stage and a shared duration", async () => {
  const [journey, map] = await Promise.all([
    readFile(new URL("../app/journey.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/InteractiveMap.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(journey, /export const STAGE_DURATION = 5000/);
  assert.match(journey, /export const SHELF_STAGE_DURATION = 3000/);
  assert.match(journey, /guidedJourneyStages/);
  assert.match(journey, /label: "Amundsen Sea", duration: SHELF_STAGE_DURATION, region: "amundsen"/);
  assert.match(journey, /label: "George VI Ice Shelf", duration: SHELF_STAGE_DURATION, region: "bellingshausen"/);
  assert.match(journey, /label: "Totten Glacier", duration: SHELF_STAGE_DURATION, region: "totten"/);
  assert.ok((journey.match(/sourceUrl: "https/g) ?? []).length >= 5);
  assert.match(journey, /id: "water"[\s\S]*id: "antarctica"[\s\S]*id: "ocean"[\s\S]*id: "newyork"/);
  assert.match(journey, /Warm deep water reaches George VI Ice Shelf/);
  assert.match(journey, /BAS: George VI Ice Shelf/);
  assert.match(journey, /Deep channels can reach Totten Glacier/);
  assert.match(journey, /NASA: Totten Glacier troughs/);
  assert.match(map, /const onSelectRef = useRef\(onSelect\)/);
  assert.match(map, /onSelectRef\.current\(id\)/);
  assert.match(map, /\}, \[\]\);/);
  assert.match(map, /prefers-reduced-motion: reduce/);
  assert.match(map, /new-york-water-cue/);
  assert.match(map, /new-york-water-pulse/);
  assert.match(map, /newYorkWaterLevelFeatures/);
  assert.match(map, /long illustrative lines pulse in sequence as a local water-level cue, not a flood boundary, forecast, or route from Antarctica/);
  assert.match(map, /minZoom: 1/);
  assert.match(map, /maxZoom: 4\.8/);
  assert.match(map, /ice-shelf-warm-zone/);
  assert.match(map, /not mean the whole continent is warming in the same way/);
  assert.match(map, /global-ocean-band-pulses/);
  assert.match(map, /ringPulseFeatures/);
  assert.match(map, /pulse from inner to outer/);
  assert.match(map, /const pulseIndex = paths\.length - 1 - index/);
  assert.match(map, /not measured currents or a route to New York/);
  assert.match(map, /southern-ocean-current-particles/);
  assert.match(map, /currentParticleFeatures/);
  assert.match(map, /southern-ocean-current-arrows/);
  assert.match(map, /currentDirectionFeatures/);
  assert.match(map, /They do not show flow below ice shelves/);
  assert.match(map, /handleStoryScroll/);
  assert.match(map, /map-labels/);
  assert.match(map, /Amundsen Sea/);
  assert.match(map, /New York City/);
  assert.match(map, /not a flood boundary, forecast, or route from Antarctica/);
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /journeyElapsed/);
  assert.match(page, /storyStageIndex/);
  assert.match(page, /guidedJourneyStages\.length - 1/);
  assert.match(page, /GUIDED_JOURNEY_DURATION/);
  assert.match(page, /journeyStageIndex/);
  assert.match(page, /Resume journey/);
  assert.match(page, /Restart journey/);
  assert.match(page, /window\.setInterval/);
  assert.match(page, /aria-current=\{active === stop\.id \? "step" : undefined\}/);
  assert.match(page, /Map display note/);
  assert.match(page, /intro-modal/);
  assert.match(page, /role="dialog"/);
  assert.match(page, /globe-map rendering limit/);
  assert.doesNotMatch(page, /render-note/);
  assert.match(page, /What directly adds water to the global ocean/);
  assert.match(page, /Grounded ice moving into the sea/);
  assert.match(page, /Quick check/);
  assert.match(page, /Story mode/);
  assert.match(page, /Southern Ocean currents/);
  assert.match(page, /Arrows show modeled direction/);
  assert.match(page, /July 20, 2026/);
  assert.match(page, /Hide currents/);
  assert.match(page, /active === "ocean" && <button className="currents-toggle"/);
  assert.match(page, /setCheckOpen\(true\)/);
  assert.match(page, /active === "water" && <section className="shelf-compare"/);
});

test("guided Amundsen particles stay local and respect reduced motion", async () => {
  const map = await readFile(new URL("../app/InteractiveMap.tsx", import.meta.url), "utf8");
  assert.match(map, /amundsen-particles/);
  assert.match(map, /activeRef\.current !== "water" && activeRef\.current !== "antarctica"/);
  assert.match(map, /reducedMotion\.current \? undefined : window\.setInterval/);
  assert.match(map, /These particles explain the sourced local path; they are not live current measurements/);
  assert.match(map, /totten-particles/);
  assert.match(map, /layers\.warm/);
  assert.match(map, /layers\.ice/);
  assert.match(map, /layers\.global/);
  assert.match(map, /pulseProgress = \(pulseProgress \+ 0\.018\) % 1/);
});

test("Story mode captures wheel input before MapLibre can zoom", async () => {
  const map = await readFile(new URL("../app/InteractiveMap.tsx", import.meta.url), "utf8");
  assert.match(map, /const storyWheelOptions = \{ passive: false, capture: true \}/);
  assert.match(map, /event\.preventDefault\(\);\s*event\.stopPropagation\(\);/);
  assert.match(map, /instance\.getContainer\(\)\.addEventListener\("wheel", handleStoryScroll, storyWheelOptions\)/);
  assert.match(map, /instance\.getContainer\(\)\.removeEventListener\("wheel", handleStoryScroll, storyWheelOptions\)/);
  assert.match(map, /onStoryStepRef\.current\(event\.deltaY > 0 \? 1 : -1\)/);
  assert.match(map, /if \(storyMode\) map\.current\.scrollZoom\.disable\(\);\s*else map\.current\.scrollZoom\.enable\(\);/);
});

test("serves the compiled assets required for hydration", async () => {
  const html = await (await fetchWorker()).text();
  const assets = [...new Set([...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]))]
    .filter(asset => asset.startsWith("/_next/static/") && /\.(?:js|css)(?:\?|$)/.test(asset));
  assert.ok(assets.length >= 2, "Expected compiled client assets");
  for (const asset of assets.slice(0, 6)) {
    const response = await fetchWorker(asset);
    assert.equal(response.status, 200, asset);
    assert.doesNotMatch(response.headers.get("content-type") ?? "", /^text\/html/);
    await response.arrayBuffer();
  }
});
