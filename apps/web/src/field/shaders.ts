export const FIELD_VERTEX = /* glsl */ `
precision highp float;

attribute vec3 aA;
attribute vec3 aB;
attribute vec3 aC;
attribute vec3 aD;
attribute vec4 aRand;
attribute vec2 aUV;

uniform float uTime;
uniform float uMorph;
uniform float uNoise;
uniform float uPulse;
uniform float uFault;
uniform vec3 uRot;
uniform vec2 uAnchor;
uniform float uUnit;
uniform float uAspect;
uniform vec2 uPointer;
uniform float uPointerForce;
uniform float uPx;
uniform float uTone;
uniform float uAlpha;
uniform float uLineAlpha;
uniform float uStretch;
// 1 while the strands are drawn as lines, 0 while points are drawn.
uniform mediump float uLine;

varying vec3 vColor;

const float CAM = 4.2;
const vec3 HOT = vec3(1.0, 0.24, 0.07);
const vec3 EMBER = vec3(1.0, 0.56, 0.3);
const vec3 BONE = vec3(1.0, 0.95, 0.87);

vec3 flow(vec3 p, float t) {
  vec3 q = p + 0.5 * sin(p.yzx * 1.7 + t * 0.6);
  return vec3(
    sin(q.y * 2.1 + t) + cos(q.z * 1.6 - t * 0.7),
    sin(q.z * 2.4 - t * 0.8) + cos(q.x * 1.9 + t * 0.5),
    sin(q.x * 2.0 + t * 0.9) + cos(q.y * 2.3 - t * 0.6)
  ) * 0.5;
}

float ease(float t) {
  return t * t * (3.0 - 2.0 * t);
}

// Each point leaves for the next formation at its own moment.
float stage(float index, float seed) {
  float t = clamp(uMorph - index, 0.0, 1.0);
  return ease(clamp(t * 1.6 - seed * 0.6, 0.0, 1.0));
}

vec3 rotate(vec3 p, vec3 e) {
  float cx = cos(e.x);
  float sx = sin(e.x);
  p = vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);
  float cy = cos(e.y);
  float sy = sin(e.y);
  p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
  float cz = cos(e.z);
  float sz = sin(e.z);
  return vec3(p.x * cz - p.y * sz, p.x * sz + p.y * cz, p.z);
}

void main() {
  // Most points hold their strand; the rest drift off it as dust. Strand
  // lines always hold.
  float loose = step(0.64, aRand.y) * (1.0 - uLine);
  // Held points leave in order along their strand, so a strand pays out like
  // thread between formations; dust leaves whenever it likes.
  float seed = mix(0.6 * aUV.x + 0.4 * aUV.y, aRand.x, loose);
  float t0 = stage(0.0, seed);
  float t1 = stage(1.0, seed);
  float t2 = stage(2.0, seed);
  float wA = 1.0 - t0;
  float wB = t0 * (1.0 - t1);
  float wC = t1 * (1.0 - t2);
  float wD = t2;

  // Scope: stacked ridgelines, and a wave that runs outward from the middle
  // when a check is verified.
  vec3 c = aC;
  float envelope = exp(-c.x * c.x * 0.16);
  float swell = sin(c.x * 4.6 + uTime * 0.8 + c.z * 2.6) * 0.55
    + sin(c.x * 9.2 - uTime * 1.2 + c.z * 6.1) * 0.3
    + sin(c.x * 17.0 + uTime * 1.9 + c.z * 11.0) * 0.15;
  float crest = pow(max(0.5 + 0.5 * swell, 0.0), 1.7);
  float lead = (abs(c.x) - (1.0 - uPulse) * 4.6) * 2.4;
  float ring = exp(-lead * lead) * uPulse;
  c.y = envelope * (0.08 + 0.92 * crest) * 0.46 + ring * 0.3;

  vec3 p = mix(mix(mix(aA, aB, t0), c, t1), aD, t2);

  float travel = t0 * (1.0 - t0) + t1 * (1.0 - t1) + t2 * (1.0 - t2);
  // A slow writhe that moves each strand as one piece.
  float sway = wA * 0.2 + wB * 0.025 + wD * 0.006 + travel * 0.5;
  p += flow(p * 1.2 + aUV.y * 4.0, uTime * 0.28) * sway;
  // Per-point scatter: the dust halo, the noise control, and a failed check.
  float mess = pow(max(uNoise - 0.08, 0.0) / 0.92, 1.6);
  float scatter = loose * (
      (wA * 0.3 + wB * 0.08 + wC * 0.05 + wD * 0.035) * (0.7 + uNoise * 1.5)
      + travel * 1.2
    )
    + mess * (wA * 0.8 + wB * 0.4 + wC * 0.25 + wD * 0.3)
    + uFault * 0.35;
  p += flow(aRand.zwy * 37.0 + p * 0.8, uTime * 0.4 + aRand.w * 6.2832) * scatter;
  p *= 1.0 + wB * 0.03 * sin(aUV.x * 18.85 + uTime * 0.9);

  float burst = (length(p) - (1.0 - uPulse) * 1.5) * 3.6;
  float shock = exp(-burst * burst) * uPulse * (1.0 - wC);
  p *= 1.0 + shock * 0.14;

  vec3 v = rotate(p, uRot);
  float persp = CAM / max(CAM - v.z, 0.8);
  // The scope is centred, then exaggerated vertically on screen to fill a
  // wide window. Doing that after projection keeps its perspective mild.
  vec2 ndc = vec2(v.x, (v.y - 0.14 * wC) * mix(1.0, uStretch, wC)) * persp * uUnit;
  ndc.x /= uAspect;
  ndc += uAnchor;

  // The pointer bends the field like a lens; gently inside the scope window.
  vec2 away = ndc - uPointer;
  away.x *= uAspect;
  float near = exp(-dot(away, away) * 9.0) * uPointerForce;
  ndc += vec2(away.x / uAspect, away.y) * near * 0.5 * (1.0 - 0.7 * wC);

  // Dust far from the focal plane goes soft; strands stay crisp.
  float soft = smoothstep(0.5, 1.3, abs(v.z)) * loose;
  float size = mix(0.9 + aRand.w * 0.7, 1.0 + aRand.z * 2.2, loose)
    * persp * (1.0 + soft * 2.4);
  gl_PointSize = clamp(size * uPx, 1.0, 28.0);
  gl_Position = vec4(ndc, 0.0, 1.0);

  float flicker = 0.5 + 0.5 * sin(uTime * (1.1 + aRand.z * 2.6) + aRand.z * 31.0);
  float twinkle = 1.0 - mix(0.14, 0.45, loose) * flicker;
  float packet = pow(max(0.0, sin(aUV.x * 12.566 - uTime * 0.85 + aUV.y * 43.0)), 26.0);
  float depthFade = 0.45 + 0.55 * smoothstep(-1.1, 0.9, v.z);
  float pointAlpha = uAlpha * mix(0.42, 1.0, loose) * twinkle / (1.0 + soft * 3.0);
  // Strands dissolve as the noise rises: order is line, noise is dust.
  float lineAlpha = uLineAlpha * (1.0 - mess * 0.9);
  // Whatever is in transit dims, so a crossing never fights the text it passes.
  float alpha = mix(pointAlpha, lineAlpha, uLine) * depthFade
    * (1.0 - 0.55 * min(1.0, travel * 4.0));
  alpha *= 1.0 + packet * 2.4 + near * 1.6 + shock * 3.0 + ring * wC * 3.5
    + wC * crest * envelope * 0.9;

  // Noise runs hot; order reads as clear light. Packets flash the other way.
  float along = 0.22 * sin(aUV.x * 12.566 + aUV.y * 20.0);
  float grain = (aRand.w - 0.5) * mix(0.22, 0.8, loose) * (1.0 - uLine);
  float tone = clamp(
    uTone + along + grain + packet * (0.5 - uTone) * 1.6 + ring * wC + shock,
    0.0,
    1.0
  );
  vec3 color = mix(HOT, EMBER, smoothstep(0.0, 0.5, tone));
  color = mix(color, BONE, smoothstep(0.4, 0.95, tone));
  color = mix(color, vec3(1.0, 0.12, 0.05), clamp(uFault, 0.0, 1.0) * 0.85);
  vColor = color * alpha;
}
`;

export const FIELD_FRAGMENT = /* glsl */ `
precision mediump float;

uniform mediump float uLine;

varying vec3 vColor;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float falloff = mix(smoothstep(0.25, 0.0, dot(c, c)), 1.0, uLine);
  gl_FragColor = vec4(vColor * falloff, 1.0);
}
`;

export const BACKDROP_VERTEX = /* glsl */ `
attribute vec2 aPos;

void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const BACKDROP_FRAGMENT = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uRes;
uniform vec2 uGlow;
uniform float uGlowAmount;
uniform float uTime;

void main() {
  vec2 p = gl_FragCoord.xy / uRes * 2.0 - 1.0;
  vec2 d = p - uGlow;
  d.x *= uRes.x / uRes.y;
  float haze = exp(-dot(d, d) * 1.8) * uGlowAmount;
  vec3 color = vec3(0.039, 0.035, 0.031) + vec3(1.0, 0.32, 0.12) * haze;
  color *= 1.0 - 0.16 * dot(p, p);
  float grain = fract(
    sin(dot(gl_FragCoord.xy + fract(uTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453
  );
  color += (grain - 0.5) * 0.022;
  gl_FragColor = vec4(color, 1.0);
}
`;
