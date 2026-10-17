import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { ExtrudeGeometry, MathUtils, Path, Shape, type Group } from 'three';
import { useLabStore } from '../store/labStore';
import { useSceneStore } from './sceneStore';
import { Clickable } from './Clickable';

/** หน้ากากเหลี่ยมมุมมน มีช่องลมจริง (ไม่ใช้แผ่นทึบบังใบพัด) */
function housingShape() {
  const s = new Shape();
  const a = 0.083, r = 0.009;
  s.moveTo(-a + r, -a); s.lineTo(a - r, -a); s.quadraticCurveTo(a, -a, a, -a + r);
  s.lineTo(a, a - r); s.quadraticCurveTo(a, a, a - r, a);
  s.lineTo(-a + r, a); s.quadraticCurveTo(-a, a, -a, a - r);
  s.lineTo(-a, -a + r); s.quadraticCurveTo(-a, -a, -a + r, -a);
  const hole = new Path(); hole.absarc(0, 0, 0.068, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return s;
}

/** ใบพัดกว้างแบบกวาดโค้งจาก Hub ถึงขอบช่องลม */
function bladeShape() {
  const s = new Shape();
  s.moveTo(0.014, -0.007);
  s.bezierCurveTo(0.03, -0.028, 0.053, -0.032, 0.061, -0.014);
  s.bezierCurveTo(0.069, 0.002, 0.062, 0.019, 0.05, 0.026);
  s.bezierCurveTo(0.041, 0.031, 0.03, 0.022, 0.02, 0.014);
  s.quadraticCurveTo(0.01, 0.008, 0.014, -0.007);
  return s;
}

export function VentFan({ x }: { x: number }) {
  const low = useSceneStore((s) => s.lowGraphics);
  const blades = useRef<Group>(null);
  const airflow = useRef<Group>(null);
  const speed = useRef(0);
  const geometry = useMemo(() => {
    const frame = new ExtrudeGeometry(housingShape(), { depth: 0.026, bevelEnabled: true,
      bevelSize: 0.0015, bevelThickness: 0.0015, bevelSegments: 2, steps: 1, curveSegments: low ? 10 : 24 });
    frame.translate(0, 0, -0.013);
    const blade = new ExtrudeGeometry(bladeShape(), { depth: 0.0022, bevelEnabled: true,
      bevelSize: 0.0008, bevelThickness: 0.0008, bevelSegments: 2, steps: 1, curveSegments: low ? 6 : 16 });
    // Pitch ของใบทำให้มีผิวรับแสงและความหนาเมื่อมองด้านข้าง
    const vertices = blade.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) {
      vertices.setZ(i, vertices.getZ(i) + 0.005 * (vertices.getX(i) / 0.065) * (vertices.getY(i) / 0.03));
    }
    blade.computeVertexNormals();
    return { frame, blade };
  }, [low]);
  useEffect(() => () => { geometry.frame.dispose(); geometry.blade.dispose(); }, [geometry]);
  useFrame((_, dt) => {
    const on = useLabStore.getState().snapshot?.commands.fan ?? false;
    const k = Math.min(dt, 0.1);
    speed.current = MathUtils.damp(speed.current, on ? 22 : 0, 1.5, k);
    if (blades.current) blades.current.rotation.z += speed.current * k;
    if (airflow.current) airflow.current.visible = on;
  });
  return <Clickable device={{ kind: 'actuator', key: 'fan' }} position={[x, 0.44, -0.21]} labelOffset={[0, 0.105, 0]}>
    {/* หน้าพัดลมหันออกนอกโรงเรือนทั้งสองฝั่ง */}
    <group rotation={[0, x < 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
      <mesh geometry={geometry.frame} castShadow receiveShadow>
        <meshStandardMaterial color="#232a32" roughness={0.46} metalness={0.25} />
      </mesh>
      {[-1, 1].map((side) => <group key={side}>
        <mesh position={[0, 0, side * 0.014]}>
          <torusGeometry args={[0.068, 0.0022, 6, low ? 32 : 64]} />
          <meshStandardMaterial color="#4b525b" roughness={0.4} metalness={0.4} />
        </mesh>
        {[-1, 1].flatMap((u) => [-1, 1].map((v) => <mesh key={`${u}:${v}`} position={[u * 0.072, v * 0.072, side * 0.016]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.0035, 0.0035, 0.002, 6]} />
          <meshStandardMaterial color="#969da6" metalness={0.75} roughness={0.35} />
        </mesh>))}
      </group>)}
      {/* โครงยึด Motor อยู่หลังใบพัด ไม่ปิดบังด้านหน้า */}
      {[Math.PI / 4, -Math.PI / 4].map((angle) => <mesh key={angle} position={[0, 0, -0.01]} rotation={[0, 0, angle]}>
        <boxGeometry args={[0.006, 0.136, 0.004]} /><meshStandardMaterial color="#303740" roughness={0.6} />
      </mesh>)}
      <group ref={blades}>
        {Array.from({ length: 5 }, (_, i) => <mesh key={i} geometry={geometry.blade} rotation={[0, 0, i * Math.PI * 2 / 5]} castShadow>
          <meshStandardMaterial color="#424b58" roughness={0.43} metalness={0.15} />
        </mesh>)}
      </group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.007]} castShadow>
        <cylinderGeometry args={[0.021, 0.023, 0.027, low ? 20 : 40]} />
        <meshStandardMaterial color="#2c333e" roughness={0.38} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0, 0.022]} scale={[1, 1, 0.16]}>
        <sphereGeometry args={[0.021, low ? 16 : 32, 12]} /><meshStandardMaterial color="#444d5b" roughness={0.4} metalness={0.2} />
      </mesh>
      {/* สัญลักษณ์ทิศลมคงที่ แสดงตาม M100 เท่านั้น ไม่สร้าง Animation แยกจาก State */}
      <group ref={airflow} visible={false}>
        {[-0.035, 0, 0.035].map((y) => <group key={y} position={[0, y, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh raycast={() => null}><cylinderGeometry args={[0.0025, 0.0025, 0.055, 8]} /><meshBasicMaterial color="#38c9ed" transparent opacity={0.65} depthWrite={false} /></mesh>
          <mesh position={[0, 0.037, 0]} raycast={() => null}><coneGeometry args={[0.01, 0.022, 8]} /><meshBasicMaterial color="#38c9ed" transparent opacity={0.75} depthWrite={false} /></mesh>
        </group>)}
      </group>
    </group>
  </Clickable>;
}
