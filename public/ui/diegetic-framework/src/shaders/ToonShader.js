/**
 * ToonShader.js
 * ---------------------------------------------------------
 * GLSL del toon/cel shader. Separat en el seu propi fitxer
 * perquè sigui fàcil d'editar sense tocar la lògica
 * d'aplicació a ShaderLibrary.js.
 *
 * Tècnica: es calcula la llum difusa normal (N·L) i després
 * es "quantitza" (es parteix en esglaons) en lloc de deixar-la
 * contínua — això és el que dona l'aspecte de bandes planes
 * típic del cel-shading.
 * ---------------------------------------------------------
 */

export const ToonShaderDef = {
  vertexShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vec4 viewPosition = viewMatrix * worldPosition;

      vNormal = normalize(normalMatrix * normal);
      vViewDir = normalize(-viewPosition.xyz);

      gl_Position = projectionMatrix * viewPosition;
    }
  `,

  fragmentShader: /* glsl */ `
    uniform vec3 uBaseColor;
    uniform sampler2D uMap;
    uniform float uHasMap;
    uniform float uBands;
    uniform vec3 uShadowColor;
    uniform float uSpecularIntensity;
    uniform float uRimPower;
    uniform vec3 uRimColor;

    // three.js injecta aquí les llums (uniforms com directionalLights[])
    // gràcies a "lights: true" al ShaderMaterial i THREE.UniformsLib.lights
    #if NUM_DIR_LIGHTS > 0
      struct DirectionalLight {
        vec3 direction;
        vec3 color;
      };
      uniform DirectionalLight directionalLights[NUM_DIR_LIGHTS];
    #endif

    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec2 vUv;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 baseColor = uBaseColor;
      if (uHasMap > 0.5) {
        baseColor *= texture2D(uMap, vUv).rgb;
      }

      vec3 litColor = vec3(0.0);

      #if NUM_DIR_LIGHTS > 0
        for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
          vec3 lightDir = normalize(directionalLights[i].direction);
          float ndl = max(dot(normal, lightDir), 0.0);

          // --- Quantització (el cor del toon shading) ---
          float bands = max(uBands, 1.0);
          float step = floor(ndl * bands) / bands;

          vec3 diffuse = mix(uShadowColor, directionalLights[i].color, step);

          // --- Especular estilitzat (opcional) ---
          vec3 halfDir = normalize(lightDir + vViewDir);
          float ndh = max(dot(normal, halfDir), 0.0);
          float specular = step * pow(ndh, 32.0) * uSpecularIntensity;

          litColor += baseColor * diffuse + specular;
        }
      #else
        // Sense llums direccionals a l'escena: fallback pla
        litColor = baseColor * 0.8;
      #endif

      // --- Rim light estilitzat (opcional) ---
      if (uRimPower > 0.0) {
        float rim = 1.0 - max(dot(normal, vViewDir), 0.0);
        rim = pow(rim, uRimPower);
        litColor += uRimColor * rim;
      }

      gl_FragColor = vec4(litColor, 1.0);
    }
  `,
};
