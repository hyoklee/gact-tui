import { describe, expect, it } from 'vitest';
import { relationGeometry, roundedRelationPath } from './gantt-relation-geometry';

describe('recorded parent connectors', () => {
  it('rounds bends without detaching endpoints', () => {
    expect(
      roundedRelationPath(
        [
          { x: 1, y: 1 },
          { x: 1, y: 3 },
          { x: 5, y: 3 },
        ],
        0.2,
      ),
    ).toBe('M 1 1 L 1 2.8 Q 1 3 1.2 3 L 5 3');
  });
  it('routes around intermediate duration bars and lands at the target edge', () => {
    const geometry = relationGeometry(
      { x: 4, y: 2 },
      { x: 8, y: 7 },
      [
        { id: 'parent', left: 1, right: 12, top: 1, bottom: 2 },
        { id: 'blocking-tool', left: 3, right: 7, top: 3, bottom: 5 },
        { id: 'child', left: 8, right: 12, top: 6, bottom: 8 },
      ],
      'parent',
      'child',
    );
    expect(geometry?.line).toMatch(/^M 4 2 /);
    const vertical = geometry!.points
      .slice(1)
      .filter(
        (point, index) =>
          point.x === geometry!.points[index]!.x && point.y >= 5 && geometry!.points[index]!.y <= 3,
      );
    expect(vertical.length).toBeGreaterThan(0);
    expect(vertical.every((point) => point.x > 7 && point.x < 8)).toBe(true);
    expect(geometry?.arrow).toMatch(/^M 8 7 /);
    expect(geometry?.line).toContain(' Q ');
  });
  it('skips a connection when no unobstructed route exists', () => {
    expect(
      relationGeometry(
        { x: 4, y: 2 },
        { x: 8, y: 7 },
        [{ id: 'blocking', left: -100, right: 100, top: 2.1, bottom: 6 }],
        'parent',
        'child',
      ),
    ).toBeUndefined();
  });
});
