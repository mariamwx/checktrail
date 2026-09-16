/**
 * ShaderLibrary.js
 * ---------------------------------------------------------
 * Gestiona els materials custom del framework: de moment,
 * toon shading (cel-shading amb bandes de llum) i outline
 * (contorn) per rim/silueta.
 *
 * Pensat per ser editable: els shaders GLSL viuen en fitxers
 * separats (ToonShader.js, OutlineShader.js) perquè un
 * programador o TD els pugui modificar sense tocar la
 * lògica d'aplicació.
 * ---------------------------------------------------------
 */

import * as THREE from 'three';
import { ToonShaderDef } from './ToonShader.js';
import { OutlineShaderDef } from './OutlineShader.js';

export class ShaderLibrary {
  constructor() {
    // Guardem referència als materials toon creats per poder-los
    // reconfigurar globalment (ex: canviar nombre de bandes de llum a tots)
    this._toonMaterials = new Set();
  }

  /**
   * Substitueix els materials d'un objecte (i els seus fills) per
   * una versió toon-shaded, conservant el color/textura base.
   *
   * @param {THREE.Object3D} root
   * @param {Object} [options]
   * @param {number} [options.bands=4] - nombre de graons de llum
   * @param {THREE.Color|number} [options.shadowColor=0x1a1a2e] - color de l'ombra
   * @param {number} [options.specularIntensity=0.15] - brillantor especular estilitzada (0 = sense)
   * @param {number} [options.rimPower=0] - rim light estilitzat (0 = desactivat)
   * @param {THREE.Color|number} [options.rimColor=0xffffff]
   */
  applyToon(root, options = {}) {
    const {
      bands = 4,
      shadowColor = 0x1a1a2e,
      specularIntensity = 0.15,
      rimPower = 0,
      rimColor = 0xffffff,
    } = options;

    root.traverse((child) => {
      if (!child.isMesh) return;

      const baseColor = child.material?.color ? child.material.color.clone() : new THREE.Color(0xffffff);
      const baseMap = child.material?.map ?? null;

      const material = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.lights,
          {
            uBaseColor: { value: baseColor },
            uMap: { value: baseMap },
            uHasMap: { value: baseMap ? 1 : 0 },
            uBands: { value: bands },
            uShadowColor: { value: new THREE.Color(shadowColor) },
            uSpecularIntensity: { value: specularIntensity },
            uRimPower: { value: rimPower },
            uRimColor: { value: new THREE.Color(rimColor) },
          },
        ]),
        vertexShader: ToonShaderDef.vertexShader,
        fragmentShader: ToonShaderDef.fragmentShader,
        lights: true,
      });

      child.material = material;
      this._toonMaterials.add(material);
    });
  }

  /**
   * Reconfigura tots els materials toon ja aplicats (canvi global,
   * útil per ajustar l'estil en calent des d'un panell de debug).
   */
  updateToonGlobals(options = {}) {
    this._toonMaterials.forEach((mat) => {
      if (options.bands !== undefined) mat.uniforms.uBands.value = options.bands;
      if (options.shadowColor !== undefined) mat.uniforms.uShadowColor.value.set(options.shadowColor);
      if (options.specularIntensity !== undefined) mat.uniforms.uSpecularIntensity.value = options.specularIntensity;
      if (options.rimPower !== undefined) mat.uniforms.uRimPower.value = options.rimPower;
      if (options.rimColor !== undefined) mat.uniforms.uRimColor.value.set(options.rimColor);
    });
  }

  /**
   * Afegeix un outline (contorn) a un objecte fent servir la tècnica
   * de "backface expansion": es duplica la malla, s'infla lleugerament
   * al llarg de la normal, i es renderitza per darrere (backface only)
   * amb un color pla. És la tècnica estàndard per outlines toon
   * (l'usa per exemple Genshin Impact / moltes eines NPR).
   *
   * @param {THREE.Object3D} root
   * @param {Object} [options]
   * @param {number} [options.thickness=0.02] - gruix del contorn en unitats de món
   * @param {THREE.Color|number} [options.color=0x000000]
   * @returns {THREE.Group} el grup de malles d'outline afegit (per poder-lo treure després)
   */
  applyOutline(root, options = {}) {
    const { thickness = 0.02, color = 0x000000 } = options;

    const outlineGroup = new THREE.Group();
    outlineGroup.name = '__outline';

    root.traverse((child) => {
      if (!child.isMesh) return;

      const outlineMat = new THREE.ShaderMaterial({
        uniforms: {
          uThickness: { value: thickness },
          uColor: { value: new THREE.Color(color) },
        },
        vertexShader: OutlineShaderDef.vertexShader,
        fragmentShader: OutlineShaderDef.fragmentShader,
        side: THREE.BackSide,
      });

      const outlineMesh = new THREE.Mesh(child.geometry, outlineMat);
      outlineMesh.position.copy(child.position);
      outlineMesh.rotation.copy(child.rotation);
      outlineMesh.scale.copy(child.scale);

      // Si el child té skinning (personatges animats), cal mantenir-ho sincronitzat
      if (child.isSkinnedMesh) {
        console.warn(
          '[ShaderLibrary] Outline sobre SkinnedMesh: cal vincular manualment skeleton/bindMatrix si l\'animació el deforma.'
        );
      }

      child.parent.add(outlineMesh);
      outlineGroup.add(outlineMesh);
    });

    return outlineGroup;
  }
}
