import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bendPoint, flapPose, parseCubicPath, type WingRig, wingFrames } from './geass-wing';

const rig: WingRig = { axisX: 100, leftPivot: { x: 80, y: 100 }, leftTip: { x: 0, y: 20 }, ramp: 40 };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

describe('parseCubicPath', () => {
  it('converts relative c/s segments to absolute cubics', () => {
    const path = parseCubicPath('m10,10c0,0 10,0 10,10s10,10 10,10z');
    assert.deepEqual(path.start, { x: 10, y: 10 });
    assert.equal(path.segments.length, 2);
    assert.deepEqual(path.segments[0][2], { x: 20, y: 20 });
    // reflected control point of the smooth segment
    assert.deepEqual(path.segments[1][0], { x: 20, y: 30 });
    assert.deepEqual(path.segments[1][2], { x: 30, y: 30 });
  });

  it('rejects unsupported commands', () => {
    assert.throws(() => parseCubicPath('M0,0 L10,10'), /unsupported/);
  });
});

describe('bendPoint', () => {
  it('leaves points at or behind the neck untouched', () => {
    assert.deepEqual(bendPoint({ x: 90, y: 120 }, rig, 45), { x: 90, y: 120 });
  });

  it('rotates horn points fully beyond the ramp', () => {
    const tip = bendPoint({ x: 0, y: 20 }, rig, 45);
    // the left horn points up-left at 45°; +45° swings it straight up
    assert.ok(near(tip.x, 80));
    assert.ok(tip.y < 20);
  });

  it('mirrors the right horn', () => {
    const left = bendPoint({ x: 0, y: 20 }, rig, 30);
    const right = bendPoint({ x: 200, y: 20 }, rig, 30);
    assert.ok(near(left.x + right.x, 200));
    assert.ok(near(left.y, right.y));
  });
});

describe('elbow curl', () => {
  const elbowRig: WingRig = { ...rig, elbow: { at: 60, ramp: 10 } };

  it('only moves points beyond the elbow', () => {
    const mid = { x: 60, y: 80 }; // ~28 along the horn, before the elbow
    assert.deepEqual(bendPoint(mid, elbowRig, { neck: 0, elbow: 30 }), mid);
    const tip = bendPoint({ x: 0, y: 20 }, elbowRig, { neck: 0, elbow: 30 });
    assert.ok(tip.x > 0, 'tip curls inward toward the axis');
  });

  it('accepts a bare number as a neck-only pose', () => {
    assert.deepEqual(bendPoint({ x: 0, y: 20 }, elbowRig, 20), bendPoint({ x: 0, y: 20 }, elbowRig, { neck: 20 }));
  });
});

describe('wingFrames', () => {
  it('produces structurally identical paths and an unbent rest frame', () => {
    const d = 'm0,20c10,10 40,40 80,80c10,10 30,10 40,0c40,-40 70,-70 80,-80z';
    const [rest, up] = wingFrames(d, rig, [0, 40]);
    const shape = (p: string) => p.replace(/-?[\d.]+/g, '#');
    assert.equal(shape(rest), shape(up));
    assert.notEqual(rest, up);
    assert.ok(rest.startsWith('M0,20C'));
  });
});

describe('flapPose', () => {
  const timing = { verticalDeg: 47, dipDeg: -8, curlDeg: 40 };

  it('starts and ends the cycle at rest', () => {
    assert.ok(near(flapPose(0, timing).neck, 0) && near(flapPose(0, timing).elbow ?? 0, 0));
    assert.ok(Math.abs(flapPose(1, timing).neck) < 1e-9);
  });

  it('peaks with the horns vertical and the tips touching', () => {
    const top = flapPose(0.5, timing);
    assert.ok(near(top.neck, 47));
    assert.ok(near(top.elbow ?? 0, 40));
  });

  it('moves the tips faster than the main wing', () => {
    // a third of the way up, the tips are far further through their curl than the neck is through its lift
    const p = flapPose(0.33, timing);
    assert.ok((p.elbow ?? 0) / 40 > p.neck / 47 + 0.1);
  });
});
