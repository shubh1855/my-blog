/**
 * Build-time geometry for the flapping Geass sigil on the 404 page.
 *
 * Instead of clipping the sigil into pieces (which leaves seams at the joints), the
 * single sigil path is "skinned": every point on a horn is rotated about that horn's
 * neck by an angle weighted by how far along the horn it sits. Points at the neck and
 * on the body don't move, so the outline bends smoothly and stays one closed shape.
 * The resulting frames all share the same command structure, so SVG can interpolate
 * between them (`<animate attributeName="d">`).
 */

export interface Point {
  x: number;
  y: number;
}

/** A path made only of absolute moveto + cubic segments (closed). */
export interface CubicPath {
  start: Point;
  segments: [Point, Point, Point][];
}

const TOKEN = /[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g;

/**
 * Parse an SVG path that uses only m/M, c/C, s/S and z/Z commands into absolute cubics.
 * Throws on any other command so unsupported input fails loudly at build time.
 */
export function parseCubicPath(d: string): CubicPath {
  const tokens = d.match(TOKEN) ?? [];
  let i = 0;
  let cmd = '';
  let cur: Point = { x: 0, y: 0 };
  let start: Point | null = null;
  let lastCtrl: Point | null = null;
  const segments: [Point, Point, Point][] = [];
  const num = () => Number(tokens[i++]);

  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const at = (x: number, y: number): Point => (rel ? { x: cur.x + x, y: cur.y + y } : { x, y });
    switch (cmd.toLowerCase()) {
      case 'm': {
        cur = at(num(), num());
        start ??= cur;
        lastCtrl = null;
        cmd = rel ? 'l' : 'L'; // implicit lineto after moveto is unsupported below
        break;
      }
      case 'c': {
        const c1 = at(num(), num());
        const c2 = at(num(), num());
        const end = at(num(), num());
        segments.push([c1, c2, end]);
        lastCtrl = c2;
        cur = end;
        break;
      }
      case 's': {
        const c1 = lastCtrl ? { x: 2 * cur.x - lastCtrl.x, y: 2 * cur.y - lastCtrl.y } : cur;
        const c2 = at(num(), num());
        const end = at(num(), num());
        segments.push([c1, c2, end]);
        lastCtrl = c2;
        cur = end;
        break;
      }
      case 'z':
        if (start) cur = start;
        lastCtrl = null;
        break;
      default:
        throw new Error(`geass-wing: unsupported path command "${cmd}"`);
    }
  }
  if (!start) throw new Error('geass-wing: path has no moveto');
  return { start, segments };
}

export interface WingRig {
  /** x of the sigil's mirror axis; points left of it belong to the left horn. */
  axisX: number;
  /** Pivot (neck) of the left horn; the right pivot is mirrored across `axisX`. */
  leftPivot: Point;
  /** A point near the left horn tip; defines the horn's direction from the pivot. */
  leftTip: Point;
  /** Distance along the horn over which the bend ramps from 0 to the full angle. */
  ramp: number;
  /**
   * Optional second joint near the tip. Points past `at` (distance from the neck along
   * the horn) curl inward about the elbow by the frame's `elbow` angle, ramping in over `ramp`.
   */
  elbow?: { at: number; ramp: number };
}

/** Joint angles for one animation frame, in degrees. Positive values swing upward/inward. */
export interface WingPose {
  neck: number;
  elbow?: number;
}

const smoothstep = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

function rotateAbout(p: Point, c: Point, rad: number): Point {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * Math.cos(rad) - dy * Math.sin(rad), y: c.y + dx * Math.sin(rad) + dy * Math.cos(rad) };
}

/**
 * Bend a point by a pose. The elbow curl is applied first in rest space, then the whole
 * horn swings about the neck, so the curled tip rides along with the wing (two-bone skinning).
 * Positive angles swing both horns upward/inward (clockwise on the left, counter-clockwise
 * on the right, in SVG's y-down space).
 */
export function bendPoint(p: Point, rig: WingRig, pose: WingPose | number): Point {
  const { neck, elbow = 0 } = typeof pose === 'number' ? { neck: pose } : pose;
  const left = p.x <= rig.axisX;
  const mirror = (q: Point): Point => (left ? q : { x: 2 * rig.axisX - q.x, y: q.y });
  const pivot = mirror(rig.leftPivot);
  const tip = mirror(rig.leftTip);
  const len = Math.hypot(tip.x - pivot.x, tip.y - pivot.y);
  const ux = (tip.x - pivot.x) / len;
  const uy = (tip.y - pivot.y) / len;
  const along = (p.x - pivot.x) * ux + (p.y - pivot.y) * uy;
  const side = left ? 1 : -1;
  const toRad = (deg: number) => (side * deg * Math.PI) / 180;

  let q = p;
  if (rig.elbow && elbow !== 0) {
    const w = smoothstep((along - rig.elbow.at) / rig.elbow.ramp);
    if (w > 0) q = rotateAbout(q, { x: pivot.x + ux * rig.elbow.at, y: pivot.y + uy * rig.elbow.at }, toRad(elbow * w));
  }
  const w = smoothstep(along / rig.ramp);
  return w > 0 ? rotateAbout(q, pivot, toRad(neck * w)) : q;
}

const fmt = (n: number) => Number(n.toFixed(2)).toString();
const pt = (p: Point) => `${fmt(p.x)},${fmt(p.y)}`;

/** Serialize a cubic path with every point bent by `pose`. */
function bentPathD(path: CubicPath, rig: WingRig, pose: WingPose | number): string {
  const b = (p: Point) => pt(bendPoint(p, rig, pose));
  return `M${b(path.start)}${path.segments.map(([c1, c2, e]) => `C${b(c1)} ${b(c2)} ${b(e)}`).join('')}Z`;
}

/** One path per pose, ready for `<animate attributeName="d" values="…">`. */
export function wingFrames(d: string, rig: WingRig, poses: readonly (WingPose | number)[]): string[] {
  const path = parseCubicPath(d);
  return poses.map((pose) => bentPathD(path, rig, pose));
}

export interface FlapTiming {
  /** Neck angle at the top of the stroke (horns vertical). */
  verticalDeg: number;
  /** Neck angle at the bottom of the follow-through (below rest). */
  dipDeg: number;
  /** Elbow curl at the top of the stroke (tips touch). */
  curlDeg: number;
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeInOut = (t: number) => (1 - Math.cos(Math.PI * clamp01(t))) / 2;
const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3;
const easeIn = (t: number) => clamp01(t) ** 3;

/**
 * Pose at normalized time `t` (0–1) of one flap cycle.
 *
 * The two joints run on different clocks within the same cycle: the main wing (neck) is
 * slow and heavy, using most of the upstroke to rise, while the tips (elbow) are quick —
 * they snap inward late in the rise, hold briefly at the top, and flick back out early.
 */
export function flapPose(t: number, timing: FlapTiming): WingPose {
  const { verticalDeg, dipDeg, curlDeg } = timing;
  const neck =
    t < 0.5
      ? verticalDeg * easeInOut(t / 0.5)
      : t < 0.88
        ? verticalDeg + (dipDeg - verticalDeg) * easeInOut((t - 0.5) / 0.38)
        : dipDeg * (1 - easeInOut((t - 0.88) / 0.12));
  const curl = t < 0.5 ? easeOut((t - 0.18) / 0.16) : 1 - easeIn((t - 0.54) / 0.14);
  return { neck, elbow: curlDeg * curl };
}
