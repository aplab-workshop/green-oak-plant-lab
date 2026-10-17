import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import { Quaternion, Vector3 } from 'three';
import { useSceneStore } from './sceneStore';

type Point = [number, number, number];

/** โครงตกแต่งเท่านั้น — ไม่เปลี่ยนขนาดถังหรือ Environment ของ Simulation */
function Beam({ a, b, width = 0.012, color = '#a8b7b4' }: { a: Point; b: Point; width?: number; color?: string }) {
  const { mid, rotation, length } = useMemo(() => {
    const start = new Vector3(...a), end = new Vector3(...b);
    const direction = end.clone().sub(start);
    return { mid: start.add(end).multiplyScalar(0.5), length: direction.length(),
      rotation: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()) };
  }, [a, b]);
  return <mesh position={mid} quaternion={rotation} castShadow>
    <boxGeometry args={[width, length, width]} />
    <meshStandardMaterial color={color} metalness={0.25} roughness={0.38} />
  </mesh>;
}

export function Greenhouse() {
  const low = useSceneStore((s) => s.lowGraphics);
  const left = -0.48, right = 0.56, back = -0.43, front = 0.43;
  const floor = -0.21, eave = 0.55, ridge = 0.71;
  return <group>
    {/* ฐานเกาะสวนขอบมนแบบเกม Diorama */}
    <RoundedBox args={[1.36, 0.11, 1.13]} radius={0.045} smoothness={low ? 2 : 4} position={[0.04, -0.3, 0]} receiveShadow>
      <meshStandardMaterial color="#846f53" roughness={1} />
    </RoundedBox>
    <RoundedBox args={[1.36, 0.035, 1.13]} radius={0.025} smoothness={3} position={[0.04, -0.238, 0]} receiveShadow>
      <meshStandardMaterial color="#91ad5d" roughness={0.95} />
    </RoundedBox>
    <RoundedBox args={[1.14, 0.035, 0.94]} radius={0.016} smoothness={3} position={[0.04, -0.218, 0]} receiveShadow>
      <meshStandardMaterial color="#e1d9c5" roughness={0.92} />
    </RoundedBox>
    {[-0.32, -0.05, 0.22].map((x) => <RoundedBox key={x} args={[0.22, 0.013, 0.08]} radius={0.01}
      position={[x, -0.212, 0.51]} receiveShadow><meshStandardMaterial color="#c5bda6" roughness={1} /></RoundedBox>)}
    {!low && Array.from({ length: 22 }, (_, i) => {
      const x = -0.58 + (i % 11) * 0.12, z = i < 11 ? -0.51 : 0.52;
      return <group key={i} position={[x, -0.22, z]} rotation={[0, i * 2.4, 0]}>
        {[0, 1, 2].map((j) => <mesh key={j} position={[(j - 1) * 0.012, 0.009, 0]} rotation={[0.15 * j, 0, (j - 1) * 0.35]}>
          <coneGeometry args={[0.008, 0.04 + (i % 3) * 0.006, 4]} />
          <meshStandardMaterial color={i % 2 ? '#73974c' : '#a5b960'} roughness={1} />
        </mesh>)}
      </group>;
    })}
    {/* เปิดด้านหน้าเพื่อเห็นและเลือกต้นได้; กระจกไม่รับ pointer */}
    {[left, right].map((x) => <group key={x}>
      {[back, front].map((z) => <group key={z}>
        <Beam a={[x, floor, z]} b={[x, eave, z]} width={0.018} />
        <mesh position={[x, floor + 0.008, z]}><boxGeometry args={[0.045, 0.012, 0.045]} /><meshStandardMaterial color="#465b58" /></mesh>
        <mesh position={[x, eave, z]}><boxGeometry args={[0.026, 0.035, 0.028]} /><meshStandardMaterial color="#465b58" metalness={0.5} /></mesh>
      </group>)}
      {[floor + 0.03, 0.12, eave].map((y) => <Beam key={y} a={[x, y, back]} b={[x, y, front]} />)}
    </group>)}
    {[back, front].map((z) => <group key={z}>
      <Beam a={[left, eave, z]} b={[right, eave, z]} />
      <Beam a={[left, eave, z]} b={[0.04, ridge, z]} />
      <Beam a={[0.04, ridge, z]} b={[right, eave, z]} />
    </group>)}
    <Beam a={[0.04, ridge, back]} b={[0.04, ridge, front]} />
    <Beam a={[left, eave, -0.08]} b={[right, eave, -0.08]} width={0.008} />
    {/* หลังคาโปร่งแสงด้านไกล; เปิดด้านใกล้เหมือนเกมเพื่อมองเห็นพืช */}
    <mesh position={[-0.22, (ridge + eave) / 2, 0]} rotation={[0, 0, Math.atan2(ridge - eave, 0.52)]} raycast={() => null}>
      <boxGeometry args={[Math.hypot(0.52, ridge - eave), 0.002, 0.85]} />
      <meshStandardMaterial color="#d1e7de" transparent opacity={0.1} depthWrite={false} roughness={0.25} />
    </mesh>
    {[-0.14, 0.14].map((z) => <Beam key={z} a={[left, eave, z]} b={[0.04, ridge, z]} width={0.006} />)}
    <Beam a={[left, floor + 0.03, back]} b={[right, floor + 0.03, back]} />
    <Beam a={[left, 0.14, back]} b={[right, 0.14, back]} />
    {[-0.22, 0.04, 0.3].map((x) => <Beam key={x} a={[x, floor, back]} b={[x, eave, back]} width={0.007} />)}
    <mesh position={[0.04, 0.2, back]} raycast={() => null}>
      <boxGeometry args={[1.02, 0.8, 0.002]} />
      <meshStandardMaterial color="#c4e0d7" transparent opacity={0.12} roughness={0.3} depthWrite={false} />
    </mesh>
    <mesh position={[left, 0.2, 0]} raycast={() => null}>
      <boxGeometry args={[0.002, 0.8, 0.85]} />
      <meshStandardMaterial color="#c4e0d7" transparent opacity={0.08} depthWrite={false} />
    </mesh>
    {/* โต๊ะปลูกและชั้นวางอุปกรณ์ */}
    {[-0.245, 0.245].flatMap((x) => [-0.19, 0.19].map((z) => <Beam key={`${x}:${z}`} a={[x, floor, z]} b={[x, 0, z]} width={0.014} />))}
    {[-0.19, 0.19].map((z) => <Beam key={z} a={[-0.26, -0.018, z]} b={[0.26, -0.018, z]} />)}
    <RoundedBox args={[0.22, 0.012, 0.27]} radius={0.006} position={[0.405, 0.003, -0.255]}>
      <meshStandardMaterial color="#d5dfd8" metalness={0.35} roughness={0.4} />
    </RoundedBox>
    {[0.32, 0.49].flatMap((x) => [-0.36, -0.15].map((z) => <Beam key={`${x}:${z}`} a={[x, floor, z]} b={[x, 0, z]} width={0.009} />))}
  </group>;
}
