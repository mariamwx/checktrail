/**
 * DiegeticWorld.js
 * ---------------------------------------------------------
 * Nucli del framework. Orquestra l'escena three.js, la càmera,
 * els assets carregats i el sistema d'events (triggers).
 *
 * No sap RES de la lògica del joc (preguntes, puntuació...).
 * Només exposa una API perquè el codi del joc li pugui parlar,
 * i emet events perquè el joc pugui escoltar-lo.
 * ---------------------------------------------------------
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EventBus } from './EventBus.js';
import { CameraRig } from './CameraRig.js';
import { AssetManager } from './AssetManager.js';
import { InteractionSystem } from './InteractionSystem.js';
import { ShaderLibrary } from './shaders/ShaderLibrary.js';

export class DiegeticWorld {
  /**
   * @param {Object} opts
   * @param {HTMLElement} opts.container - element on es munta el canvas
   * @param {string} [opts.assetBasePath] - path base per carregar .glb (local o CDN)
   * @param {boolean} [opts.debug] - mostra helpers (eixos, waypoints) i logs
   */
  constructor(opts = {}) {
    this.container = opts.container;
    if (!this.container) {
      throw new Error('[DiegeticWorld] Cal passar un container (HTMLElement).');
    }

    this.debug = !!opts.debug;
    this.events = new EventBus({ debug: this.debug });

    // ---- Escena base ----
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(opts.backgroundColor ?? 0x0a0a0a);

    this.clock = new THREE.Clock();

    // ---- Renderer ----
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    // ---- Càmera ----
    this.camera = new THREE.PerspectiveCamera(
      opts.fov ?? 45,
      1,
      opts.near ?? 0.1,
      opts.far ?? 100
    );
    this.cameraRig = new CameraRig(this.camera, { debug: this.debug, scene: this.scene });

    // ---- Llum bàsica (els programadors la poden substituir/ampliar) ----
    this._setupDefaultLighting();

    // ---- Subsistemes ----
    this.shaderLibrary = new ShaderLibrary();
    this.assets = new AssetManager({
      basePath: opts.assetBasePath ?? '/assets/models/',
      loader: new GLTFLoader(),
      scene: this.scene,
      shaderLibrary: this.shaderLibrary,
      debug: this.debug,
    });
    this.interactions = new InteractionSystem({
      camera: this.camera,
      renderer: this.renderer,
      scene: this.scene,
      events: this.events,
      debug: this.debug,
    });

    // ---- Resize ----
    this._resizeObserver = new ResizeObserver(() => this._onResize());
    this._resizeObserver.observe(this.container);
    this._onResize();

    // ---- Loop ----
    this._running = false;
    this._animate = this._animate.bind(this);
  }

  _setupDefaultLighting() {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x1a1a1a, 1.1);
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(4, 8, 5);
    this.scene.add(hemi, dir);
    this.defaultLights = { hemi, dir };
  }

  _onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  /**
   * Carrega un .glb i el registra amb un nom lògic.
   * Retorna una Promise<Object3D>.
   *
   * @param {string} name - identificador lògic (ex: "lamp", "shelf_02")
   * @param {string} file - nom del fitxer dins assetBasePath (ex: "lamp.glb")
   * @param {Object} [opts] - { position, rotation, scale, toon (bool), outline (bool) }
   */
  async loadAsset(name, file, opts = {}) {
    return this.assets.load(name, file, opts);
  }

  /** Recupera un asset ja carregat pel seu nom lògic. */
  getAsset(name) {
    return this.assets.get(name);
  }

  /** Reprodueix un clip d'animació d'un asset ja carregat. Veure AssetManager.playAnimation. */
  playAnimation(assetName, clipName, opts = {}) {
    return this.assets.playAnimation(assetName, clipName, opts);
  }

  /** Reprodueix tots els clips d'un asset en paral·lel (sense exclusive fade). */
  playAllAnimations(assetName, opts = {}) {
    return this.assets.playAllAnimations(assetName, opts);
  }

  /** Registra un punt de vista de càmera (waypoint). Veure CameraRig.addWaypoint. */
  addCameraWaypoint(name, { position, lookAt, fov } = {}) {
    this.cameraRig.addWaypoint(name, { position, lookAt, fov });
  }

  /** Mou la càmera a un waypoint registrat. Veure CameraRig.moveTo. */
  moveCameraTo(waypointName, opts = {}) {
    return this.cameraRig.moveTo(waypointName, opts);
  }

  /**
   * Marca un objecte com "interactuable": rebrà events de tap/click.
   * El triggerName és el que rebrà qui escolti events.on('interact:<triggerName>').
   */
  makeInteractive(assetName, triggerName, opts = {}) {
    const obj = this.assets.get(assetName);
    if (!obj) {
      console.warn(`[DiegeticWorld] makeInteractive: asset "${assetName}" no trobat.`);
      return;
    }
    this.interactions.register(obj, triggerName, opts);
  }

  /** Atalls per escoltar/emetre events del joc <-> escena. */
  on(eventName, callback) {
    this.events.on(eventName, callback);
    return this;
  }
  off(eventName, callback) {
    this.events.off(eventName, callback);
    return this;
  }
  emit(eventName, payload) {
    this.events.emit(eventName, payload);
    return this;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this.clock.start();
    this._animate();
  }

  stop() {
    this._running = false;
  }

  _animate() {
    if (!this._running) return;
    requestAnimationFrame(this._animate);

    const dt = this.clock.getDelta();
    this.assets.update(dt);
    this.cameraRig.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.stop();
    this._resizeObserver.disconnect();
    this.interactions.dispose();
    this.assets.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
