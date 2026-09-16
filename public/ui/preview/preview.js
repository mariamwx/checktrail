/**
 * Standalone preview — room + player4 with original GLB materials & animations.
 * Drag to orbit · scroll to zoom.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DiegeticWorld } from "../diegetic-framework/src/index.js";

const ASSET_BASE = "/ui/category1/assets/";

async function main() {
  const world = new DiegeticWorld({
    container: document.getElementById("scene-container"),
    assetBasePath: ASSET_BASE,
    backgroundColor: 0x0a1018,
    debug: false,
  });

  // Authored PBR look — no toon / outline
  world.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  world.renderer.toneMappingExposure = 1;
  world.renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Soft default lights so baked/authored materials read closer to Blender
  if (world.defaultLights) {
    world.defaultLights.hemi.intensity = 0.9;
    world.defaultLights.dir.intensity = 1.1;
  }

  await world.loadAsset("room", "GJ_AssetsTest_V004.glb", {
    position: [0, 0, 0],
  });
  await world.loadAsset("player4", "GJ_AssetsTest_V005_player4.glb", {
    position: [0, 0, 1.2],
  });

  const room = world.getAsset("room");
  const player = world.getAsset("player4");

  const box = new THREE.Box3();
  if (room) box.expandByObject(room);
  if (player) box.expandByObject(player);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const dist = Math.max(size.x, size.y, size.z, 1) * 1.8;

  world.addCameraWaypoint("preview", {
    position: [center.x, center.y + size.y * 0.25, center.z + dist],
    lookAt: [center.x, center.y, center.z],
  });
  world.cameraRig.jumpTo("preview");

  const controls = new OrbitControls(world.camera, world.renderer.domElement);
  controls.target.copy(center);
  controls.enableDamping = true;
  controls.update();
  world.cameraRig.enableFreeLook(controls);

  // All GLB clips together (not exclusive — last clip must not kill the rest)
  world.playAllAnimations("room", { loop: true });
  world.playAllAnimations("player4", { loop: true });

  world.start();
  window.__world = world;
}

main().catch(console.error);
