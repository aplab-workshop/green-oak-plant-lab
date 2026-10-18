import { useEffect, useMemo } from 'react';
import { CurvePath, LineCurve3, QuadraticBezierCurve3, TubeGeometry, Vector3 } from 'three';

type Point = [number, number, number];

/** แนวท่อตรงกับข้อศอกโค้งสั้น ไม่เกิดการโก่งออกนอกแนวแบบ spline */
export function RoutedPipe({ points, radius = 0.006, color = '#168bd4' }: {
  points: Point[]; radius?: number; color?: string;
}) {
  const geometry = useMemo(() => {
    const vertices = points.map((p) => new Vector3(...p));
    const path = new CurvePath<Vector3>();
    let start = vertices[0]!;
    for (let i = 1; i < vertices.length - 1; i++) {
      const corner = vertices[i]!;
      const before = vertices[i - 1]!;
      const after = vertices[i + 1]!;
      const bend = Math.min(radius * 3, corner.distanceTo(before) * 0.3, corner.distanceTo(after) * 0.3);
      const entry = corner.clone().add(before.clone().sub(corner).normalize().multiplyScalar(bend));
      const exit = corner.clone().add(after.clone().sub(corner).normalize().multiplyScalar(bend));
      path.add(new LineCurve3(start, entry));
      path.add(new QuadraticBezierCurve3(entry, corner, exit));
      start = exit;
    }
    path.add(new LineCurve3(start, vertices[vertices.length - 1]!));
    return new TubeGeometry(path, Math.max(48, points.length * 16), radius, 10, false);
  }, [points, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} castShadow>
    <meshStandardMaterial color={color} roughness={0.42} metalness={0.08} />
  </mesh>;
}
