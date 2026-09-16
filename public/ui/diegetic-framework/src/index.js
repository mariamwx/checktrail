/**
 * index.js — Punt d'entrada del framework.
 *
 * Ús típic per un programador del joc:
 *
 *   import { DiegeticWorld } from './diegetic-framework/src/index.js';
 *
 *   const world = new DiegeticWorld({ container: document.getElementById('scene') });
 *   await world.loadAsset('lamp', 'lamp.glb', { toon: true, outline: true });
 *   world.addCameraWaypoint('intro', { position: [0,1.6,4], lookAt: [0,1,0] });
 *   world.moveCameraTo('intro');
 *   world.makeInteractive('lamp', 'lamp_switch');
 *   world.on('interact:lamp_switch', () => world.playAnimation('lamp', 'Flicker'));
 *   world.start();
 */

export { DiegeticWorld } from './DiegeticWorld.js';
export { EventBus } from './EventBus.js';
export { CameraRig } from './CameraRig.js';
export { AssetManager } from './AssetManager.js';
export { InteractionSystem } from './InteractionSystem.js';
export { ShaderLibrary } from './shaders/ShaderLibrary.js';
export { ToonShaderDef } from './shaders/ToonShader.js';
export { OutlineShaderDef } from './shaders/OutlineShader.js';
