/**
 * AssetManager.js
 * ---------------------------------------------------------
 * Carrega fitxers .glb, els registra per nom lògic, gestiona
 * els seus AnimationMixer i permet aplicar-hi shaders
 * (toon/outline) definits a ShaderLibrary.
 * ---------------------------------------------------------
 */

import * as THREE from 'three';

export class AssetManager {
  /**
   * @param {Object} opts
   * @param {string} opts.basePath
   * @param {import('three/addons/loaders/GLTFLoader.js').GLTFLoader} opts.loader
   * @param {THREE.Scene} opts.scene
   * @param {import('./shaders/ShaderLibrary.js').ShaderLibrary} opts.shaderLibrary
   */
  constructor({ basePath, loader, scene, shaderLibrary, debug = false }) {
    this.basePath = basePath;
    this.loader = loader;
    this.scene = scene;
    this.shaderLibrary = shaderLibrary;
    this.debug = debug;

    // name -> { root, gltf, mixer, actions: Map<clipName, AnimationAction>, outlineMesh }
    this._assets = new Map();
  }

  /**
   * @param {string} name - identificador lògic
   * @param {string} file - nom de fitxer relatiu a basePath
   * @param {Object} [opts]
   * @param {[x,y,z]} [opts.position]
   * @param {[x,y,z]} [opts.rotation] - en radians
   * @param {[x,y,z]|number} [opts.scale]
   * @param {boolean} [opts.toon=false] - aplica el toon shader per defecte
   * @param {boolean} [opts.outline=false] - afegeix outline (requereix toon o material compatible)
   * @param {Object} [opts.toonOptions] - veure ShaderLibrary.applyToon
   */
  load(name, file, opts = {}) {
    if (this._assets.has(name)) {
      console.warn(`[AssetManager] Ja existeix un asset amb el nom "${name}". Es sobreescriurà.`);
    }

    const url = this.basePath + file;

    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const root = gltf.scene;
          root.name = name;

          if (opts.position) root.position.set(...opts.position);
          if (opts.rotation) root.rotation.set(...opts.rotation);
          if (opts.scale) {
            Array.isArray(opts.scale) ? root.scale.set(...opts.scale) : root.scale.setScalar(opts.scale);
          }

          root.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          const entry = {
            root,
            gltf,
            mixer: gltf.animations.length ? new THREE.AnimationMixer(root) : null,
            actions: new Map(),
            outlineMesh: null,
          };

          gltf.animations.forEach((clip) => {
            entry.actions.set(clip.name, entry.mixer.clipAction(clip));
          });

          this._assets.set(name, entry);
          this.scene.add(root);

          if (opts.toon) {
            this.applyToonShader(name, opts.toonOptions ?? {});
          }
          if (opts.outline) {
            this.applyOutline(name, opts.outlineOptions ?? {});
          }

          if (this.debug) {
            console.log(`[AssetManager] Carregat "${name}" (${file})`, {
              clips: gltf.animations.map((c) => c.name),
            });
          }

          resolve(root);
        },
        undefined,
        (err) => {
          console.error(`[AssetManager] Error carregant "${url}":`, err);
          reject(err);
        }
      );
    });
  }

  get(name) {
    return this._assets.get(name)?.root ?? null;
  }

  getEntry(name) {
    return this._assets.get(name) ?? null;
  }

  /** Llista els noms de clips d'animació disponibles per un asset. */
  listAnimations(name) {
    const entry = this._assets.get(name);
    return entry ? Array.from(entry.actions.keys()) : [];
  }

  /**
   * Reprodueix un clip d'animació.
   * @param {string} name - nom de l'asset
   * @param {string} clipName - nom del clip (tal com surt de Blender/glTF)
   * @param {Object} [opts]
   * @param {boolean} [opts.loop=false]
   * @param {number} [opts.crossfade=0.3] - segons de transició des de l'acció anterior
   * @param {number} [opts.timeScale=1]
   * @param {boolean} [opts.exclusive=true] - si true, fade-out dels altres clips del mateix asset
   * @returns {THREE.AnimationAction|null}
   */
  playAnimation(name, clipName, { loop = false, crossfade = 0.3, timeScale = 1, exclusive = true } = {}) {
    const entry = this._assets.get(name);
    if (!entry) {
      console.warn(`[AssetManager] playAnimation: asset "${name}" no trobat.`);
      return null;
    }
    const action = entry.actions.get(clipName);
    if (!action) {
      console.warn(
        `[AssetManager] playAnimation: clip "${clipName}" no existeix a "${name}". Disponibles: ${this.listAnimations(name).join(', ')}`
      );
      return null;
    }

    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    action.timeScale = timeScale;
    action.enabled = true;
    action.setEffectiveWeight(1);
    if (crossfade > 0) action.fadeIn(crossfade);
    action.play();

    // Aturem (amb fade) les altres accions actives d'aquest asset
    if (exclusive) {
      entry.actions.forEach((otherAction, otherName) => {
        if (otherName !== clipName && otherAction.isRunning()) {
          otherAction.fadeOut(crossfade);
        }
      });
    }

    return action;
  }

  /**
   * Reprodueix tots els clips d'un asset alhora (tal com venen al GLB).
   * No fa exclusive fade — els clips poden córrer en paral·lel.
   */
  playAllAnimations(name, { loop = true, timeScale = 1 } = {}) {
    const entry = this._assets.get(name);
    if (!entry) return [];
    const playing = [];
    entry.actions.forEach((action, clipName) => {
      action.reset();
      action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      action.clampWhenFinished = !loop;
      action.timeScale = timeScale;
      action.enabled = true;
      action.setEffectiveWeight(1);
      action.play();
      playing.push(clipName);
    });
    return playing;
  }

  stopAnimation(name, clipName) {
    const action = this._assets.get(name)?.actions.get(clipName);
    action?.stop();
  }

  /**
   * Aplica el toon shader a totes les malles d'un asset.
   * Veure ShaderLibrary.applyToon per les opcions.
   */
  applyToonShader(name, options = {}) {
    const entry = this._assets.get(name);
    if (!entry) return;
    this.shaderLibrary.applyToon(entry.root, options);
  }

  /**
   * Afegeix un outline (contorn) a un asset.
   * Veure ShaderLibrary.applyOutline per les opcions.
   */
  applyOutline(name, options = {}) {
    const entry = this._assets.get(name);
    if (!entry) return;
    entry.outlineMesh = this.shaderLibrary.applyOutline(entry.root, options);
  }

  removeOutline(name) {
    const entry = this._assets.get(name);
    if (!entry?.outlineMesh) return;
    entry.root.remove(entry.outlineMesh);
    entry.outlineMesh = null;
  }

  update(dt) {
    this._assets.forEach((entry) => {
      entry.mixer?.update(dt);
    });
  }

  dispose() {
    this._assets.forEach((entry) => {
      this.scene.remove(entry.root);
      entry.root.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });
    });
    this._assets.clear();
  }
}
