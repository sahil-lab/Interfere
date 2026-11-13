import { STRIDE, buildGeometry, type Geometry } from './formations';
import {
  BACKDROP_FRAGMENT,
  BACKDROP_VERTEX,
  FIELD_FRAGMENT,
  FIELD_VERTEX,
} from './shaders';

export interface FieldUniforms {
  time: number;
  morph: number;
  noise: number;
  pulse: number;
  fault: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  /** Field centre in normalized device coordinates. */
  anchorX: number;
  anchorY: number;
  /** Normalized device height of one model unit. */
  unit: number;
  aspect: number;
  pointerX: number;
  pointerY: number;
  pointerForce: number;
  px: number;
  tone: number;
  alpha: number;
  lineAlpha: number;
  glow: number;
  /** Vertical exaggeration of the scope so it fills a narrow window. */
  stretch: number;
}

export interface FieldPlan {
  strands: number;
  perStrand: number;
}

export interface FieldRenderer {
  readonly total: number;
  readonly strands: number;
  /** The browser is rasterizing WebGL on the CPU. */
  readonly software: boolean;
  resize(width: number, height: number, dpr: number): void;
  /**
   * Draws `strands` whole strands as lines under `points` points. `backdrop`
   * adds the full-screen haze and grain pass; off, the canvas is only cleared.
   * Returns false while the WebGL context is lost and nothing was drawn.
   */
  draw(
    uniforms: FieldUniforms,
    points: number,
    strands: number,
    backdrop: boolean,
  ): boolean;
  dispose(): void;
}

const FIELD_ATTRIBUTES = [
  { name: 'aA', size: 3 },
  { name: 'aB', size: 3 },
  { name: 'aC', size: 3 },
  { name: 'aD', size: 3 },
  { name: 'aRand', size: 4 },
  { name: 'aUV', size: 2 },
] as const;

const FIELD_UNIFORMS = [
  'uTime',
  'uMorph',
  'uNoise',
  'uPulse',
  'uFault',
  'uRot',
  'uAnchor',
  'uUnit',
  'uAspect',
  'uPointer',
  'uPointerForce',
  'uPx',
  'uTone',
  'uAlpha',
  'uLineAlpha',
  'uStretch',
  'uLine',
] as const;

const BACKDROP_UNIFORMS = ['uRes', 'uGlow', 'uGlowAmount', 'uTime'] as const;

type Locations<Name extends string> = Record<Name, WebGLUniformLocation | null>;

interface Resources {
  field: WebGLProgram;
  backdrop: WebGLProgram;
  pointBuffer: WebGLBuffer;
  lineBuffer: WebGLBuffer;
  quadBuffer: WebGLBuffer;
  at: Locations<(typeof FIELD_UNIFORMS)[number]>;
  back: Locations<(typeof BACKDROP_UNIFORMS)[number]>;
}

/** Why the renderer could not start, for diagnostics without console noise. */
export let fieldFailure = '';

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    fieldFailure = gl.getShaderInfoLog(shader) ?? 'Shader compilation failed.';
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function link(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
  attributes: readonly string[],
) {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  attributes.forEach((name, index) =>
    gl.bindAttribLocation(program, index, name),
  );
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    fieldFailure = gl.getProgramInfoLog(program) ?? 'Program linking failed.';
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function setup(
  gl: WebGLRenderingContext,
  geometry: Geometry,
): Resources | null {
  const field = link(
    gl,
    FIELD_VERTEX,
    FIELD_FRAGMENT,
    FIELD_ATTRIBUTES.map((attribute) => attribute.name),
  );
  const backdrop = link(gl, BACKDROP_VERTEX, BACKDROP_FRAGMENT, ['aPos']);
  const pointBuffer = gl.createBuffer();
  const lineBuffer = gl.createBuffer();
  const quadBuffer = gl.createBuffer();
  if (!field || !backdrop || !pointBuffer || !lineBuffer || !quadBuffer) {
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, geometry.data, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.lines, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );

  const at = {} as Resources['at'];
  for (const name of FIELD_UNIFORMS) {
    at[name] = gl.getUniformLocation(field, name);
  }
  const back = {} as Resources['back'];
  for (const name of BACKDROP_UNIFORMS) {
    back[name] = gl.getUniformLocation(backdrop, name);
  }

  gl.disable(gl.DEPTH_TEST);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.clearColor(0.039, 0.035, 0.031, 1);
  return { field, backdrop, pointBuffer, lineBuffer, quadBuffer, at, back };
}

export function createFieldRenderer(
  canvas: HTMLCanvasElement,
  plan: (software: boolean) => FieldPlan,
): FieldRenderer | null {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
  });
  if (!gl) {
    fieldFailure = 'WebGL is not available.';
    return null;
  }

  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const device = String(
    gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
  );
  const software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(
    device,
  );
  const { strands, perStrand } = plan(software);
  const geometry = buildGeometry(strands, perStrand);
  let resources = setup(gl, geometry);
  if (!resources) return null;
  let lost = false;

  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
  };
  const onRestored = () => {
    resources = setup(gl, geometry);
    lost = resources === null;
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  return {
    total: geometry.count,
    strands,
    software,

    resize(width, height, dpr) {
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    },

    draw(u, pointCount, strandCount, backdropPass) {
      if (lost || !resources) return false;
      const { field, backdrop, pointBuffer, lineBuffer, quadBuffer, at, back } =
        resources;
      gl.viewport(0, 0, canvas.width, canvas.height);

      gl.disable(gl.BLEND);
      if (backdropPass) {
        gl.useProgram(backdrop);
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        for (let index = 1; index < FIELD_ATTRIBUTES.length; index++) {
          gl.disableVertexAttribArray(index);
        }
        gl.uniform2f(back.uRes, canvas.width, canvas.height);
        gl.uniform2f(back.uGlow, u.anchorX, u.anchorY);
        gl.uniform1f(back.uGlowAmount, u.glow);
        gl.uniform1f(back.uTime, u.time);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      } else {
        gl.clear(gl.COLOR_BUFFER_BIT);
      }

      gl.enable(gl.BLEND);
      gl.useProgram(field);
      gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
      let offset = 0;
      FIELD_ATTRIBUTES.forEach((attribute, index) => {
        gl.enableVertexAttribArray(index);
        gl.vertexAttribPointer(
          index,
          attribute.size,
          gl.FLOAT,
          false,
          STRIDE * 4,
          offset,
        );
        offset += attribute.size * 4;
      });
      gl.uniform1f(at.uTime, u.time);
      gl.uniform1f(at.uMorph, u.morph);
      gl.uniform1f(at.uNoise, u.noise);
      gl.uniform1f(at.uPulse, u.pulse);
      gl.uniform1f(at.uFault, u.fault);
      gl.uniform3f(at.uRot, u.rotX, u.rotY, u.rotZ);
      gl.uniform2f(at.uAnchor, u.anchorX, u.anchorY);
      gl.uniform1f(at.uUnit, u.unit);
      gl.uniform1f(at.uAspect, u.aspect);
      gl.uniform2f(at.uPointer, u.pointerX, u.pointerY);
      gl.uniform1f(at.uPointerForce, u.pointerForce);
      gl.uniform1f(at.uPx, u.px);
      gl.uniform1f(at.uTone, u.tone);
      gl.uniform1f(at.uAlpha, u.alpha);
      gl.uniform1f(at.uLineAlpha, u.lineAlpha);
      gl.uniform1f(at.uStretch, u.stretch);

      const indices = Math.min(strandCount, strands) * geometry.strandIndices;
      if (indices > 0 && u.lineAlpha > 0.002) {
        gl.uniform1f(at.uLine, 1);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineBuffer);
        gl.drawElements(gl.LINES, indices, gl.UNSIGNED_SHORT, 0);
      }
      gl.uniform1f(at.uLine, 0);
      gl.drawArrays(gl.POINTS, 0, Math.min(pointCount, geometry.count));
      return true;
    },

    dispose() {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      if (!resources || lost) return;
      gl.deleteBuffer(resources.pointBuffer);
      gl.deleteBuffer(resources.lineBuffer);
      gl.deleteBuffer(resources.quadBuffer);
      gl.deleteProgram(resources.field);
      gl.deleteProgram(resources.backdrop);
      resources = null;
    },
  };
}
