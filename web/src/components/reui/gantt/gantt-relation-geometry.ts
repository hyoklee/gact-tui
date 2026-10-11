export interface RelationPoint {
  x: number;
  y: number;
}
export interface RelationObstacle {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Rounded orthogonal connectors with a clear corridor between the actual bars. */
export function relationGeometry(
  from: RelationPoint,
  to: RelationPoint,
  obstacles: readonly RelationObstacle[],
  sourceId: string,
  targetId: string,
): { line: string; arrow: string; points: readonly RelationPoint[] } | undefined {
  const gap = 0.35;
  const arrowSize = 0.32;
  const down = to.y >= from.y ? 1 : -1;
  const departure = from.y + down * gap;
  const end = { x: to.x - arrowSize, y: to.y };
  const candidates = [
    from.x,
    to.x - gap - arrowSize,
    ...obstacles.flatMap((box) => [box.left - gap, box.right + gap]),
  ];
  const routes = candidates.map((x) => [
    from,
    { x: from.x, y: departure },
    { x, y: departure },
    { x, y: to.y },
    end,
  ]);
  const clear = routes.filter((points) =>
    points
      .slice(1)
      .every((point, index) =>
        obstacles.every(
          (box) =>
            (index === 0 && box.id === sourceId) ||
            (index === points.length - 2 && box.id === targetId) ||
            !intersects(points[index]!, point, box),
        ),
      ),
  );
  clear.sort((a, b) => length(a) - length(b));
  const points = clear[0];
  if (!points) return undefined;
  return {
    line: roundedRelationPath(points, 0.2),
    points,
    arrow: `M ${to.x} ${to.y} L ${end.x} ${to.y - 0.18} L ${end.x} ${to.y + 0.18} Z`,
  };
}

function intersects(a: RelationPoint, b: RelationPoint, box: RelationObstacle): boolean {
  const epsilon = 0.025;
  return a.x === b.x
    ? a.x > box.left - epsilon &&
        a.x < box.right + epsilon &&
        Math.max(a.y, b.y) > box.top - epsilon &&
        Math.min(a.y, b.y) < box.bottom + epsilon
    : a.y > box.top - epsilon &&
        a.y < box.bottom + epsilon &&
        Math.max(a.x, b.x) > box.left - epsilon &&
        Math.min(a.x, b.x) < box.right + epsilon;
}

function length(points: readonly RelationPoint[]): number {
  return points
    .slice(1)
    .reduce(
      (total, point, index) =>
        total + Math.abs(point.x - points[index]!.x) + Math.abs(point.y - points[index]!.y),
      0,
    );
}

/** Round corners without moving the source or arrowhead anchors. */
export function roundedRelationPath(input: readonly RelationPoint[], radius: number): string {
  const points = input.filter(
    (point, index) =>
      index === 0 || point.x !== input[index - 1]!.x || point.y !== input[index - 1]!.y,
  );
  if (!points.length) return '';
  let path = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let index = 1; index < points.length - 1; index++) {
    const before = points[index - 1]!;
    const corner = points[index]!;
    const after = points[index + 1]!;
    const incoming = Math.hypot(corner.x - before.x, corner.y - before.y);
    const outgoing = Math.hypot(after.x - corner.x, after.y - corner.y);
    const r = Math.min(radius, incoming / 2, outgoing / 2);
    path += ` L ${corner.x - ((corner.x - before.x) / incoming) * r} ${corner.y - ((corner.y - before.y) / incoming) * r}`;
    path += ` Q ${corner.x} ${corner.y} ${corner.x + ((after.x - corner.x) / outgoing) * r} ${corner.y + ((after.y - corner.y) / outgoing) * r}`;
  }
  const last = points.at(-1)!;
  return `${path} L ${last.x} ${last.y}`;
}
