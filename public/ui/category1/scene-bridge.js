/**
 * Category 1 UI bridge — Three.js diegetic layer.
 * Does NOT touch game logic. Watches DOM screens from /logic/category1.js
 * and drives DiegeticWorld (room + player4).
 */
import * as THREE from "three";
import { DiegeticWorld } from "../diegetic-framework/src/index.js";

const ASSET_BASE = "/ui/category1/assets/";

const SCREEN_WAYPOINTS = {
  "screen-home": "intro",
  "screen-lobby": "intro",
  "screen-questions": "questions",
  "screen-game": "wheel",
  "screen-finals": "finals",
  "screen-end": "end",
};

function activeScreenId() {
  const el = document.querySelector("#app .screen.active");
  return el?.id || "screen-home";
}

function clickIfPresent(id) {
  const el = document.getElementById(id);
  if (el && !el.disabled && !el.hidden) el.click();
}

async function main() {
  const container = document.getElementById("scene-container");
  if (!container) return;

  const world = new DiegeticWorld({
    container,
    assetBasePath: ASSET_BASE,
    backgroundColor: 0x071018,
    debug: false,
  });

  // Authored PBR look — no toon / outline
  world.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  world.renderer.toneMappingExposure = 1;
  world.renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (world.defaultLights) {
    world.defaultLights.hemi.intensity = 0.9;
    world.defaultLights.dir.intensity = 1.1;
  }

  // Room / props (wheel, buttons, floors)
  await world.loadAsset("room", "GJ_AssetsTest_V004.glb", {
    position: [0, 0, 0],
  });

  // Player character (V005)
  await world.loadAsset("player4", "GJ_AssetsTest_V005_player4.glb", {
    position: [1.4, 0, 0.8],
    scale: 0.85,
  });

  world.addCameraWaypoint("intro", {
    position: [0, 1.7, 5.2],
    lookAt: [0, 0.9, 0],
  });
  world.addCameraWaypoint("questions", {
    position: [-1.2, 1.5, 3.4],
    lookAt: [0.2, 0.8, 0],
  });
  world.addCameraWaypoint("wheel", {
    position: [0.2, 1.55, 3.0],
    lookAt: [0, 0.85, -0.4],
  });
  world.addCameraWaypoint("finals", {
    position: [0, 1.8, 4.2],
    lookAt: [0, 1.0, 0],
  });
  world.addCameraWaypoint("end", {
    position: [1.5, 1.6, 4.0],
    lookAt: [0.4, 0.9, 0],
  });

  const startWp = SCREEN_WAYPOINTS[activeScreenId()] || "intro";
  world.cameraRig.jumpTo(startWp);

  // Hotspots registered for later; canvas stays pointer-events:none so HTML UI always works.
  // Enable canvas hits in CSS when diegetic input is desired.
  const roomRoot = world.getAsset("room");
  if (roomRoot) {
    const byName = {};
    roomRoot.traverse((obj) => {
      if (obj.name) byName[obj.name] = obj;
    });
    const wire = (nodeName, trigger, handler) => {
      const obj = byName[nodeName];
      if (!obj) return;
      world.interactions.register(obj, trigger, {});
      world.on(`interact:${trigger}`, handler);
    };
    wire("GJ_Butom_A_v1_P1_OBJ", "diegetic_answer", () => clickIfPresent("btn-answer"));
    wire("GJ_Butom_B_v1_P1_OBJ", "diegetic_skip", () => clickIfPresent("btn-skip"));
  }

  // All GLB clips in parallel (exclusive play would only leave the last one running)
  world.playAllAnimations("room", { loop: true });
  world.playAllAnimations("player4", { loop: true });

  let lastScreen = activeScreenId();
  const syncCamera = () => {
    const id = activeScreenId();
    if (id === lastScreen) return;
    lastScreen = id;
    const wp = SCREEN_WAYPOINTS[id] || "intro";
    world.moveCameraTo(wp, { duration: 1.0 });
  };

  const app = document.getElementById("app");
  if (app) {
    const mo = new MutationObserver(syncCamera);
    mo.observe(app, {
      attributes: true,
      subtree: true,
      attributeFilter: ["class", "hidden"],
    });
  }

  world.start();
  window.__diegeticWorld = world;
}

main().catch((err) => {
  console.error("[scene-bridge]", err);
});
