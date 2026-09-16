# Diegetic World Framework

Framework base per construir UI diegètica 3D en un joc de navegador (HTML/JS).
No té dependències de build tooling — funciona directament amb `<script type="module">`
i `three.js` importat via CDN (import map), per facilitar-ne l'ús a qualsevol
programador sense configurar Webpack/Vite.

## Filosofia

Aquest framework **no sap res de la lògica del vostre joc** (preguntes, puntuació,
estats de partida...). Només sap:

- gestionar una escena 3D
- moure una càmera entre punts de vista predefinits (waypoints)
- carregar assets `.glb` i reproduir-ne animacions
- detectar quan es toca/clica un asset i emetre'n un event
- aplicar toon shading + outline als assets

La connexió amb la lògica del joc real es fa amb un **event bus**: el vostre
codi de joc escolta events com `interact:select_answer` i, alhora, pot emetre
events propis (`game:correctAnswer`, etc.) que l'escena escolta per disparar
animacions/moviments de càmera. Vegeu `examples/quiz-integration.js` — és
el patró a seguir per lligar-ho amb el vostre `QuizGame` actual.

## Estructura de carpetes

```
diegetic-framework/
  src/
    DiegeticWorld.js       <- classe principal, orquestra tot
    EventBus.js             <- sistema d'events
    CameraRig.js             <- waypoints i moviment de càmera
    AssetManager.js          <- càrrega de .glb, animacions
    InteractionSystem.js     <- raycasting / tap / click
    shaders/
      ShaderLibrary.js       <- aplicació de materials custom
      ToonShader.js           <- GLSL del toon shader (editable)
      OutlineShader.js        <- GLSL de l'outline (editable)
  examples/
    index.html
    quiz-integration.js      <- exemple de connexió amb lògica de joc
```

## On van els assets

Els `.glb` (recomanat: format binari únic, no `.gltf` + `.bin` + textures soltes)
van a una carpeta servida com a fitxers estàtics pel vostre hosting/servidor,
per exemple:

```
/public/assets/models/quiz_room.glb
/public/assets/models/podium.glb
```

El path base es configura en crear el món:

```js
const world = new DiegeticWorld({
  container: document.getElementById('scene-container'),
  assetBasePath: '/assets/models/', // o una URL de CDN completa
});
```

Si en algun moment migreu a un CDN, només cal canviar aquest paràmetre —
la resta del codi no es toca.

## Ús bàsic

```js
import { DiegeticWorld } from './diegetic-framework/src/index.js';

const world = new DiegeticWorld({
  container: document.getElementById('scene-container'),
  assetBasePath: '/assets/models/',
});

// Carregar un asset
await world.loadAsset('lamp', 'lamp.glb', {
  position: [0, 0, 0],
  toon: true,
  outline: true,
});

// Definir un punt de vista de càmera
world.addCameraWaypoint('intro', {
  position: [0, 1.6, 4],
  lookAt: [0, 1, 0],
});
world.cameraRig.jumpTo('intro'); // posició inicial, sense animar

// Moure la càmera (interpolat)
await world.moveCameraTo('intro', { duration: 1.2 });

// Fer un asset interactuable
world.makeInteractive('lamp', 'lamp_switch');
world.on('interact:lamp_switch', () => {
  world.playAnimation('lamp', 'Flicker', { loop: false });
});

world.start();
```

## API principal (`DiegeticWorld`)

| Mètode | Descripció |
|---|---|
| `loadAsset(name, file, opts)` | Carrega un `.glb`. `opts`: `position`, `rotation`, `scale`, `toon`, `outline`, `toonOptions`, `outlineOptions` |
| `getAsset(name)` | Retorna l'`Object3D` arrel d'un asset carregat |
| `playAnimation(assetName, clipName, opts)` | Reprodueix un clip. `opts`: `loop`, `crossfade`, `timeScale` |
| `addCameraWaypoint(name, {position, lookAt, fov})` | Registra un punt de vista |
| `moveCameraTo(waypointName, {duration, easing})` | Mou la càmera (retorna Promise) |
| `makeInteractive(assetName, triggerName, opts)` | Marca un asset com a tocable/clicable |
| `on(event, callback)` / `emit(event, payload)` | Bus d'events |
| `start()` / `stop()` | Engega/atura el render loop |

### Noms d'animació

Els noms de clip (`clipName`) són **els que es defineixen a Blender/l'eina 3D**
en exportar el glTF (el nom de l'Action). No els inventa el framework — cal
que qui exporta els assets i qui escriu el codi de triggers es posin d'acord
en aquests noms (recomanable: llista compartida en un doc o comentari al
propi fitxer d'integració).

### Events estàndard que emet el framework

- `interact:<triggerName>` — tap/click sobre un asset marcat interactuable. Payload: `{ assetName, point, payload }`
- `interact:hoverStart:<triggerName>` / `interact:hoverEnd:<triggerName>` — només mouse
- (Cap event de "game:..." — aquests els definiu vosaltres al fitxer de connexió)

## Toon shader i outline

```js
await world.loadAsset('character', 'character.glb', {
  toon: true,
  toonOptions: {
    bands: 4,              // nombre de graons de llum (2-3 = més gràfic, 5+ = més suau)
    shadowColor: 0x1a1a2e, // color de la zona d'ombra
    specularIntensity: 0.15,
    rimPower: 0,            // >0 activa un rim light estilitzat
    rimColor: 0xffffff,
  },
  outline: true,
  outlineOptions: {
    thickness: 0.02, // gruix en unitats de món — ajustar segons escala dels assets
    color: 0x000000,
  },
});
```

Podeu reconfigurar l'estil toon globalment en calent (útil per afinar-lo amb
un panell de debug):

```js
world.shaderLibrary.updateToonGlobals({ bands: 3, rimPower: 1.5 });
```

**Nota tècnica sobre outline**: fa servir la tècnica de "backface expansion"
(duplica la malla, la infla per la normal, la renderitza només per darrere).
Funciona bé per a props estàtics. Per a malles amb esquelet/animació (`SkinnedMesh`)
cal vincular el mateix `skeleton` a la malla d'outline — actualment el
framework avisa per consola si detecta aquest cas però no ho resol automàticament;
si necessiteu outline en personatges animats, digueu-m'ho i ho ampliem.

## Provar l'exemple

Obriu `examples/index.html` amb un servidor local (necessari perquè els
imports de mòduls ES i la càrrega de `.glb` funcionin — no val `file://`
directe). Per exemple:

```bash
npx serve examples/
```

L'exemple (`quiz-integration.js`) carrega una escena de mostra i mostra
exactament on connectar-hi el vostre `QuizGame` real — busqueu els
comentaris `// <-- el vostre joc real`.

## Coses pensades per ampliar més endavant (no incloses encara)

- **Postprocessing** (bloom, etc.) — es pot afegir amb `EffectComposer` de three.js sense tocar l'arquitectura
- **Àudio posicional** lligat als triggers d'interacció
- **Mode de càmera lliure (orbit)** — l'esquelet ja hi és (`CameraRig.enableFreeLook`), només cal instanciar `OrbitControls` i passar-la
- **LOD / optimització mòbil** — si el nombre d'assets creix, caldrà vigilar el pressupost de draw calls en mòbil
