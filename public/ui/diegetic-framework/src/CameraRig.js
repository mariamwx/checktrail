/**
 * CameraRig.js
 * ---------------------------------------------------------
 * Gestiona la càmera com un conjunt de "waypoints" (punts de
 * vista predefinits) entre els quals es pot moure de forma
 * suau. Aquest és el patró recomanat per a UI diegètica:
 * la càmera MAI es mou lliure per l'espai, salta/interpola
 * entre posicions dissenyades a propòsit.
 *
 * Si en algun moment cal càmera lliure (orbit/fly), es pot
 * afegir com a mode alternatiu sense tocar la resta del
 * framework — veure enableFreeLook().
 * ---------------------------------------------------------
 */

import * as THREE from 'three';

export class CameraRig {
  constructor(camera, { debug = false, scene = null } = {}) {
    this.camera = camera;
    this.debug = debug;
    this.scene = scene;

    this.waypoints = new Map();
    this._current = null; // nom del waypoint actiu
    this._transition = null; // transició en curs, si n'hi ha
    this._onArrive = null;

    this._freeLook = null; // OrbitControls si s'activa (opcional)
  }

  /**
   * Registra un punt de vista.
   * @param {string} name
   * @param {Object} cfg
   * @param {THREE.Vector3|[x,y,z]} cfg.position
   * @param {THREE.Vector3|[x,y,z]} cfg.lookAt
   * @param {number} [cfg.fov]
   */
  addWaypoint(name, { position, lookAt, fov } = {}) {
    if (!position || !lookAt) {
      console.warn(`[CameraRig] Waypoint "${name}" necessita position i lookAt.`);
      return;
    }
    this.waypoints.set(name, {
      position: Array.isArray(position) ? new THREE.Vector3(...position) : position.clone(),
      lookAt: Array.isArray(lookAt) ? new THREE.Vector3(...lookAt) : lookAt.clone(),
      fov: fov ?? this.camera.fov,
    });

    if (this.debug && this.scene) {
      this._addDebugMarker(name, this.waypoints.get(name));
    }
  }

  _addDebugMarker(name, wp) {
    const geo = new THREE.SphereGeometry(0.08, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true });
    const marker = new THREE.Mesh(geo, mat);
    marker.position.copy(wp.position);
    marker.name = `__debug_waypoint_${name}`;
    this.scene.add(marker);
  }

  /**
   * Mou la càmera cap a un waypoint registrat, interpolant
   * posició, lookAt i fov.
   * @param {string} name
   * @param {Object} [opts]
   * @param {number} [opts.duration=1.2] segons
   * @param {string} [opts.easing='easeInOutCubic']
   * @returns {Promise<void>} es resol quan arriba
   */
  moveTo(name, { duration = 1.2, easing = 'easeInOutCubic' } = {}) {
    const target = this.waypoints.get(name);
    if (!target) {
      console.warn(`[CameraRig] Waypoint "${name}" no existeix.`);
      return Promise.resolve();
    }

    const startPos = this.camera.position.clone();
    const startFov = this.camera.fov;

    // Calculem el "lookAt" actual aproximat a partir de la direcció de la càmera
    const startDir = new THREE.Vector3();
    this.camera.getWorldDirection(startDir);
    const startLookAt = startPos.clone().add(startDir.multiplyScalar(5));

    this._transition = {
      t: 0,
      duration,
      easing: EASINGS[easing] ?? EASINGS.easeInOutCubic,
      startPos,
      startLookAt,
      startFov,
      target,
      name,
    };

    return new Promise((resolve) => {
      this._onArrive = () => resolve();
    });
  }

  /** Salta instantàniament (sense interpolació) a un waypoint. Útil per l'estat inicial. */
  jumpTo(name) {
    const target = this.waypoints.get(name);
    if (!target) {
      console.warn(`[CameraRig] Waypoint "${name}" no existeix.`);
      return;
    }
    this.camera.position.copy(target.position);
    this.camera.fov = target.fov;
    this.camera.lookAt(target.lookAt);
    this.camera.updateProjectionMatrix();
    this._current = name;
  }

  update(dt) {
    if (this._freeLook) {
      this._freeLook.update();
      return;
    }

    if (!this._transition) return;

    const tr = this._transition;
    tr.t += dt / tr.duration;
    const clamped = Math.min(tr.t, 1);
    const eased = tr.easing(clamped);

    this.camera.position.lerpVectors(tr.startPos, tr.target.position, eased);
    const lookAt = new THREE.Vector3().lerpVectors(tr.startLookAt, tr.target.lookAt, eased);
    this.camera.fov = THREE.MathUtils.lerp(tr.startFov, tr.target.fov, eased);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(lookAt);

    if (clamped >= 1) {
      this._current = tr.name;
      this._transition = null;
      this._onArrive?.();
      this._onArrive = null;
    }
  }

  /**
   * Mode opcional de càmera lliure (orbit) per a debug o per a
   * seccions del joc on interessi deixar mirar a l'usuari.
   * Requereix haver importat OrbitControls al projecte del programador
   * i passar-lo aquí ja instanciat, per no forçar la dependència
   * dins del framework base.
   */
  enableFreeLook(orbitControlsInstance) {
    this._freeLook = orbitControlsInstance;
  }

  disableFreeLook() {
    this._freeLook = null;
  }

  get currentWaypoint() {
    return this._current;
  }
}

const EASINGS = {
  linear: (t) => t,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};
