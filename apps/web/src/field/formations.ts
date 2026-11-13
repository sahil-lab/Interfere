/** Interleaved floats per point: A(3) B(3) C(3) D(3) rand(4) uv(2). */
export const STRIDE = 18;
export const SCOPE_HALF_WIDTH = 4.2;
export const SCOPE_HALF_DEPTH = 0.6;

const TAU = Math.PI * 2;
const DEGREE = Math.PI / 180;
const PRINT_CORE_Y = 0.16;
const PRINT_WIDTH = 0.86;

export interface Geometry {
  /** Shuffled, so any prefix is a uniform sample of every strand. */
  data: Float32Array;
  count: number;
  /** Vertex pairs joining neighbouring points, one strand after another. */
  lines: Uint16Array;
  /** Indices per strand, so whole strands can be drawn as a prefix. */
  strandIndices: number;
}

interface Arc {
  radius: number;
  from: number;
  to: number;
}

function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ridges are concentric ellipses around a core that sits high in a fingertip
 * silhouette. The silhouette cuts the outer ones into nested U shapes; random
 * breaks do the rest. Returns exactly one arc per strand.
 */
function fingerprint(strands: number, random: () => number): Arc[] {
  const samples = 360;
  const inside = (radius: number, angle: number) => {
    const x = (radius * PRINT_WIDTH * Math.cos(angle)) / 0.78;
    const y = PRINT_CORE_Y + radius * Math.sin(angle);
    return x * x + y * y <= 1;
  };
  // Sampling starts at the top, where the silhouette cuts first, so a
  // U-shaped ridge stays in one piece.
  const angleAt = (sample: number) => Math.PI / 2 + (sample / samples) * TAU;

  let runs: Arc[] = [];
  for (let ridge = 0; ridge < 19; ridge++) {
    const radius = 0.07 + ridge * 0.062;
    let opened = -1;
    for (let sample = 0; sample <= samples; sample++) {
      const open = sample < samples && inside(radius, angleAt(sample));
      if (open && opened < 0) opened = sample;
      if (!open && opened >= 0) {
        if (sample - opened > 12) {
          // A whole circle may begin anywhere; vary it so breaks do not align.
          const turn = sample - opened === samples ? random() * TAU : 0;
          runs.push({
            radius,
            from: angleAt(opened) + turn,
            to: angleAt(sample) + turn,
          });
        }
        opened = -1;
      }
    }
  }

  const length = (arc: Arc) => arc.radius * (arc.to - arc.from);
  if (runs.length === 0) runs.push({ radius: 0.5, from: 0, to: TAU });
  runs.sort((a, b) => length(b) - length(a));
  runs = runs.slice(0, strands);
  const total = runs.reduce((sum, run) => sum + length(run), 0);
  const pieces = runs.map((run) =>
    Math.max(1, Math.round((length(run) / total) * strands)),
  );
  // Rounding rarely lands on the exact strand count; settle it on long runs.
  let spare = strands - pieces.reduce((sum, count) => sum + count, 0);
  for (let index = 0; spare !== 0; index = (index + 1) % runs.length) {
    if (spare > 0) {
      pieces[index]! += 1;
      spare -= 1;
    } else if (pieces[index]! > 1) {
      pieces[index]! -= 1;
      spare += 1;
    }
  }

  const arcs: Arc[] = [];
  runs.forEach((run, index) => {
    const slot = (run.to - run.from) / pieces[index]!;
    for (let piece = 0; piece < pieces[index]!; piece++) {
      const gap =
        random() < 0.45
          ? Math.min(slot * 0.22, ((1 + random() * 3) * DEGREE) / run.radius)
          : 0.004;
      arcs.push({
        radius: run.radius,
        from: run.from + slot * piece + gap,
        to: run.from + slot * (piece + 1) - gap,
      });
    }
  });
  return arcs;
}

/**
 * Every strand is one curve in each formation: a scribble in the tangle (A),
 * a winding of the woven loop (B), a row of the scope (C), and a ridge
 * segment of the fingerprint (D). Seeded, so the artwork is identical on
 * every load.
 */
export function buildGeometry(strands: number, perStrand: number): Geometry {
  const count = strands * perStrand;
  const data = new Float32Array(count * STRIDE);
  const random = createRandom(0x1f7e2a9);

  const order = new Uint32Array(count);
  for (let index = 0; index < count; index++) order[index] = index;
  for (let index = count - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    const held = order[index]!;
    order[index] = order[other]!;
    order[other] = held;
  }

  // Sixteen-bit indices; a larger field would simply draw without lines.
  // Strands are written in a shuffled order, so drawing a prefix of the
  // buffer thins every formation evenly instead of cutting part of it away.
  const strandIndices = count <= 65536 ? (perStrand - 1) * 2 : 0;
  const lines = new Uint16Array(strands * strandIndices);
  if (strandIndices) {
    const strandOrder = new Uint16Array(strands);
    for (let index = 0; index < strands; index++) strandOrder[index] = index;
    for (let index = strands - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      const held = strandOrder[index]!;
      strandOrder[index] = strandOrder[other]!;
      strandOrder[other] = held;
    }
    let write = 0;
    for (const strand of strandOrder) {
      for (let step = 0; step < perStrand - 1; step++) {
        lines[write++] = order[strand * perStrand + step]!;
        lines[write++] = order[strand * perStrand + step + 1]!;
      }
    }
  }

  const arcs = fingerprint(strands, random);
  const frequency = new Float32Array(9);
  const phase = new Float32Array(9);
  const amplitude = new Float32Array(9);
  const weights = [0.62, 0.3, 0.16];
  // Two strands share each scope row, offset so the row is evenly sampled.
  const rows = Math.max(1, Math.round(strands / 2));

  for (let strand = 0; strand < strands; strand++) {
    for (let term = 0; term < 9; term++) {
      const harmonic = term % 3;
      frequency[term] = 1 + Math.floor(random() * (harmonic === 0 ? 2 : 3));
      phase[term] = random() * TAU;
      amplitude[term] = weights[harmonic]! * (0.55 + random() * 0.45);
    }
    const reach = 0.5 + random() * 0.55;
    const arc = arcs[Math.min(strand, arcs.length - 1)]!;
    const phi = (strand / strands) * TAU;
    const row = Math.floor((strand * rows) / strands);
    const rowStart = Math.ceil((row * strands) / rows);
    const rowEnd = Math.ceil(((row + 1) * strands) / rows);
    const shift = (strand - rowStart) / Math.max(1, rowEnd - rowStart);
    const depth = ((row + 0.5) / rows - 0.5) * 2 * SCOPE_HALF_DEPTH;
    const lane = strand / strands;

    for (let step = 0; step < perStrand; step++) {
      const closed = step / perStrand;
      const open = perStrand > 1 ? step / (perStrand - 1) : 0;
      const at = order[strand * perStrand + step]! * STRIDE;

      let x = 0;
      let y = 0;
      let z = 0;
      for (let harmonic = 0; harmonic < 3; harmonic++) {
        x +=
          amplitude[harmonic]! *
          Math.sin(TAU * frequency[harmonic]! * closed + phase[harmonic]!);
        y +=
          amplitude[3 + harmonic]! *
          Math.sin(
            TAU * frequency[3 + harmonic]! * closed + phase[3 + harmonic]!,
          );
        z +=
          amplitude[6 + harmonic]! *
          Math.sin(
            TAU * frequency[6 + harmonic]! * closed + phase[6 + harmonic]!,
          );
      }
      const span = Math.hypot(x, y, z);
      const squash = span > 1e-6 ? (Math.tanh(span * 1.15) / span) * reach : 0;
      data[at] = x * squash;
      data[at + 1] = y * squash;
      data[at + 2] = z * squash;

      const theta = closed * TAU;
      const cross = phi + theta * 2;
      const ring = 0.7 + 0.3 * Math.cos(cross);
      data[at + 3] = ring * Math.cos(theta);
      data[at + 4] = ring * Math.sin(theta);
      data[at + 5] = 0.3 * Math.sin(cross);

      data[at + 6] = ((step + shift) / perStrand - 0.5) * 2 * SCOPE_HALF_WIDTH;
      data[at + 7] = 0;
      data[at + 8] = depth;

      const angle = arc.from + (arc.to - arc.from) * open;
      const radius = arc.radius + (random() - 0.5) * 0.008;
      const printX = radius * PRINT_WIDTH * Math.cos(angle);
      const printY = PRINT_CORE_Y + radius * Math.sin(angle);
      data[at + 9] = printX;
      data[at + 10] = printY;
      // A slight dome, so the print turns like a fingertip rather than a card.
      data[at + 11] = 0.18 * (1 - printX * printX - printY * printY);

      data[at + 12] = 0.45 * open + 0.35 * lane + 0.2 * random();
      data[at + 13] = random();
      data[at + 14] = random();
      data[at + 15] = random();
      data[at + 16] = closed;
      data[at + 17] = lane;
    }
  }

  return { data, count, lines, strandIndices };
}
