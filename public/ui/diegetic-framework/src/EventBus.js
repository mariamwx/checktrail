/**
 * EventBus.js
 * ---------------------------------------------------------
 * Bus d'events mínim. És el "pont" entre l'escena 3D i la
 * lògica del joc: cap dels dos costats coneix l'altre
 * directament, només es parlen per noms d'event.
 *
 * Convenció de noms d'event que fa servir el framework:
 *   "interact:<triggerName>"   -> l'usuari ha tocat/clicat un asset
 *   "animation:complete:<assetName>:<clipName>" -> una animació ha acabat
 *   "camera:arrived:<waypointName>"  -> la càmera ha arribat a un waypoint
 *
 * El joc pot emetre els seus propis events (ex: "game:correctAnswer")
 * i el codi de l'escena hi pot escoltar per disparar triggers.
 * ---------------------------------------------------------
 */

export class EventBus {
  constructor({ debug = false } = {}) {
    this._listeners = new Map();
    this.debug = debug;
  }

  on(eventName, callback) {
    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, new Set());
    }
    this._listeners.get(eventName).add(callback);
  }

  off(eventName, callback) {
    this._listeners.get(eventName)?.delete(callback);
  }

  /** Escolta un event una sola vegada. */
  once(eventName, callback) {
    const wrapper = (payload) => {
      this.off(eventName, wrapper);
      callback(payload);
    };
    this.on(eventName, wrapper);
  }

  emit(eventName, payload) {
    if (this.debug) {
      console.log(`[EventBus] ${eventName}`, payload ?? '');
    }
    this._listeners.get(eventName)?.forEach((cb) => {
      try {
        cb(payload);
      } catch (err) {
        console.error(`[EventBus] Error a listener de "${eventName}":`, err);
      }
    });
  }

  clear(eventName) {
    if (eventName) {
      this._listeners.delete(eventName);
    } else {
      this._listeners.clear();
    }
  }
}
