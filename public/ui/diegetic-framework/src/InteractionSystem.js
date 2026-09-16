/**
 * InteractionSystem.js
 * ---------------------------------------------------------
 * Detecta quan l'usuari toca/clica un asset marcat com
 * interactuable i emet un event "interact:<triggerName>"
 * a l'EventBus.
 *
 * Funciona amb ratolí i tàctil (pointer events unifiquen tots
 * dos). Fa servir raycasting sobre les malles de l'objecte,
 * pujant fins a trobar quin "root" enregistrat correspon.
 * ---------------------------------------------------------
 */

import * as THREE from 'three';

export class InteractionSystem {
  constructor({ camera, renderer, scene, events, debug = false }) {
    this.camera = camera;
    this.renderer = renderer;
    this.scene = scene;
    this.events = events;
    this.debug = debug;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    // object3D (root) -> { triggerName, opts, hoverState }
    this._registry = new Map();

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);

    this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.addEventListener('pointermove', this._onPointerMove);

    this._hovered = null;
  }

  /**
   * @param {THREE.Object3D} object - normalment el root d'un asset carregat
   * @param {string} triggerName - nom que rebrà qui escolti "interact:<triggerName>"
   * @param {Object} [opts]
   * @param {boolean} [opts.cursor=true] - canvia el cursor a pointer quan hi ha hover (només mouse)
   * @param {*} [opts.payload] - dades extra que s'inclouran a l'event
   */
  register(object, triggerName, opts = {}) {
    this._registry.set(object, { triggerName, opts, cursor: opts.cursor ?? true });
  }

  unregister(object) {
    this._registry.delete(object);
  }

  _updatePointer(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _findRegisteredAncestor(object3d) {
    let node = object3d;
    while (node) {
      if (this._registry.has(node)) return node;
      node = node.parent;
    }
    return null;
  }

  _raycast() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    for (const hit of intersects) {
      const registered = this._findRegisteredAncestor(hit.object);
      if (registered) return { root: registered, hit };
    }
    return null;
  }

  _onPointerDown(event) {
    this._updatePointer(event);
    const result = this._raycast();
    if (!result) return;

    const entry = this._registry.get(result.root);
    if (this.debug) {
      console.log(`[InteractionSystem] tap -> interact:${entry.triggerName}`);
    }

    this.events.emit(`interact:${entry.triggerName}`, {
      assetName: result.root.name,
      point: result.hit.point.clone(),
      payload: entry.opts.payload,
    });
  }

  _onPointerMove(event) {
    this._updatePointer(event);
    const result = this._raycast();
    const newHover = result?.root ?? null;

    if (newHover !== this._hovered) {
      // sortim de l'anterior
      if (this._hovered) {
        const prevEntry = this._registry.get(this._hovered);
        this.events.emit(`interact:hoverEnd:${prevEntry.triggerName}`, { assetName: this._hovered.name });
      }
      // entrem al nou
      if (newHover) {
        const entry = this._registry.get(newHover);
        this.events.emit(`interact:hoverStart:${entry.triggerName}`, { assetName: newHover.name });
      }
      this._hovered = newHover;
    }

    const anyCursorTarget = newHover && this._registry.get(newHover).cursor;
    this.renderer.domElement.style.cursor = anyCursorTarget ? 'pointer' : 'default';
  }

  dispose() {
    this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this._onPointerMove);
    this._registry.clear();
  }
}
