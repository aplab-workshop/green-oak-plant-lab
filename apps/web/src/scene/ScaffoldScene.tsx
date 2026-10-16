import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import type { Mesh } from 'three';

function SpinningTank() {
  const ref = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.3;
  });
  return (
    <mesh ref={ref} position={[0, 0.1, 0]} castShadow>
      <boxGeometry args={[0.5, 0.2, 0.4]} />
      <meshStandardMaterial color="#10b981" roughness={0.4} />
    </mesh>
  );
}

/** ฉากทดสอบ R3F + Drei (P1) */
export function ScaffoldScene() {
  return (
    <Canvas camera={{ position: [0.8, 0.6, 0.8], fov: 45 }} dpr={[1, 2]}>
      <color attach="background" args={['#f8fafc']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 3, 1]} intensity={1.2} />
      <SpinningTank />
      <Grid args={[4, 4]} cellSize={0.1} sectionSize={0.5} cellColor="#cbd5e1" sectionColor="#94a3b8" fadeDistance={4} />
      <OrbitControls makeDefault target={[0, 0.1, 0]} />
    </Canvas>
  );
}
