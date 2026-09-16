/**
 * OutlineShader.js
 * ---------------------------------------------------------
 * GLSL per l'outline via "backface expansion": infla la
 * malla al llarg de la normal i la renderitza només per
 * darrere (BackSide), de manera que sobresurt just al
 * voltant de la silueta de l'objecte original.
 * ---------------------------------------------------------
 */

export const OutlineShaderDef = {
  vertexShader: /* glsl */ `
    uniform float uThickness;

    void main() {
      // Inflem la posició al llarg de la normal en espai objecte.
      vec3 inflated = position + normal * uThickness;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(inflated, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform vec3 uColor;

    void main() {
      gl_FragColor = vec4(uColor, 1.0);
    }
  `,
};
