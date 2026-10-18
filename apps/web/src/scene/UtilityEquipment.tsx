import { useEffect, useMemo, useRef } from 'react';
import { RoundedBox } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, CanvasTexture, CatmullRomCurve3, MathUtils, TubeGeometry, Vector3, type Mesh, type Points, type ShaderMaterial } from 'three';
import { useLabStore } from '../store/labStore';
import { useSceneStore } from './sceneStore';
import { Clickable } from './Clickable';
import { cm } from './layout';
import { RoutedPipe } from './Plumbing';

type Point = [number, number, number];
function Pipe({ points, radius = 0.006, color = '#168bd4' }: { points: Point[]; radius?: number; color?: string }) {
  const geo = useMemo(() => new TubeGeometry(new CatmullRomCurve3(points.map((p) => new Vector3(...p)), false, 'centripetal'), 40, radius, 8, false), [points, radius]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} castShadow><meshStandardMaterial color={color} roughness={0.32} metalness={0.15} /></mesh>;
}
function Box({ size, position, color = '#242b32', radius = 0.006 }: { size: Point; position?: Point; color?: string; radius?: number }) {
  return <RoundedBox args={size} radius={radius} smoothness={3} position={position} castShadow receiveShadow><meshStandardMaterial color={color} roughness={0.42} metalness={0.12} /></RoundedBox>;
}
function Port({ position, radius = 0.012, length = 0.02, rotation = [0, 0, 0] }: { position: Point; radius?: number; length?: number; rotation?: Point }) {
  return <mesh position={position} rotation={rotation} castShadow><cylinderGeometry args={[radius, radius, length, 16]} /><meshStandardMaterial color="#202930" roughness={0.4} /></mesh>;
}
function Indicator({ bit, position }: { bit: 'humidifier' | 'refillPump' | 'airPump'; position: Point }) {
  const on = useLabStore((s) => s.snapshot?.commands[bit] ?? false);
  return <mesh position={position}><sphereGeometry args={[0.003, 8, 6]} /><meshStandardMaterial color={on ? '#53e7ac' : '#56606a'} emissive={on ? '#1ca76a' : '#000000'} emissiveIntensity={0.7} /></mesh>;
}

/** Soft point sprites: ไม่มี bitmap ภายนอก และ phase มาจากเวลาจำลองเท่านั้น */
function Mist() {
  const low = useSceneStore((s) => s.lowGraphics);
  const count = low ? 26 : 72;
  const points = useRef<Points>(null);
  const material = useRef<ShaderMaterial>(null);
  const { size, gl } = useThree();
  const opacity = useRef(0);
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('alpha', new BufferAttribute(new Float32Array(count), 1));
    g.setAttribute('diameter', new BufferAttribute(new Float32Array(count), 1));
    return g;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(() => ({ viewport: { value: 720 }, strength: { value: 0 } }), []);
  useFrame((_, dt) => {
    const snap = useLabStore.getState().snapshot;
    if (!snap || !points.current || !material.current) return;
    opacity.current = MathUtils.damp(opacity.current, snap.commands.humidifier ? 1 : 0, 3, Math.min(dt, 0.1));
    points.current.visible = opacity.current > 0.01;
    material.current.uniforms.strength!.value = opacity.current;
    material.current.uniforms.viewport!.value = size.height * gl.getPixelRatio();
    const pos = geometry.getAttribute('position'), alpha = geometry.getAttribute('alpha'), diameter = geometry.getAttribute('diameter');
    for (let i = 0; i < count; i++) {
      const u = (snap.simTimeS * 0.12 + i * 0.618034) % 1;
      const angle = i * 2.39996;
      const spread = 0.006 + 0.035 * u;
      pos.setXYZ(i, -u * 0.055 + Math.cos(angle + u * 3) * spread, -u * 0.15, u * 0.085 + Math.sin(angle) * spread);
      alpha.setX(i, Math.sin(Math.PI * u) * (low ? 0.85 : 0.55));
      diameter.setX(i, 0.018 + u * 0.073);
    }
    pos.needsUpdate = alpha.needsUpdate = diameter.needsUpdate = true;
  });
  return <points ref={points} geometry={geometry} frustumCulled={false} raycast={() => null} renderOrder={8}>
    <shaderMaterial ref={material} uniforms={uniforms} transparent depthWrite={false}
      vertexShader={`attribute float alpha; attribute float diameter; uniform float viewport; varying float a;
        void main(){ a=alpha; vec4 p=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*p;
        gl_PointSize=clamp(diameter*viewport*projectionMatrix[1][1]/(-2.0*p.z),1.0,180.0); }`}
      fragmentShader={`uniform float strength; varying float a;
        void main(){ vec2 q=gl_PointCoord*2.0-1.0; float r=dot(q,q); if(r>1.0) discard;
        float soft=exp(-r*3.5)*(1.0-smoothstep(0.65,1.0,r));
        gl_FragColor=vec4(vec3(0.96,0.98,1.0),soft*a*strength); }`} />
  </points>;
}

export function Humidifier() {
  return <group position={[0.39, 0.38, -0.35]}>
    <Clickable device={{ kind: 'actuator', key: 'humidifier' }} labelOffset={[0, 0.145, 0]}>
      <Box size={[0.081, 0.111, 0.023]} position={[0, 0.05, -0.025]} />
      <Box size={[0.078, 0.105, 0.063]} position={[0, 0.05, 0]} color="#fff8ef" radius={0.015} />
      <Box size={[0.054, 0.073, 0.006]} position={[0, 0.053, 0.032]} color="#eee8e1" radius={0.009} />
      <Port position={[0, -0.01, 0.017]} radius={0.014} length={0.018} />
      <Indicator bit="humidifier" position={[0.026, 0.016, 0.033]} />
      <Pipe points={[[0, 0.102, 0], [0, 0.124, -0.008], [0.035, 0.12, -0.036], [0.035, 0.04, -0.04]]} radius={0.003} color="#303940" />
    </Clickable>
    <group position={[0, -0.022, 0.02]}><Mist /></group>
  </group>;
}

const OUTLET: Point = [0.18, 0.19, 0.17];
function WaterStream() {
  const stream = useRef<Mesh>(null);
  useFrame(() => {
    const snap = useLabStore.getState().snapshot;
    if (!stream.current || !snap) return;
    const length = Math.max(0.001, OUTLET[1] - cm(snap.tank.waterHeightCm));
    stream.current.visible = snap.commands.refillPump;
    stream.current.scale.y = length;
    stream.current.position.y = OUTLET[1] - length / 2;
  });
  return <mesh ref={stream} visible={false} position={[OUTLET[0], 0.1, OUTLET[2]]} raycast={() => null} renderOrder={5}>
    <cylinderGeometry args={[0.004, 0.005, 1, 12]} /><meshStandardMaterial color="#95e5ff" transparent opacity={0.7} depthWrite={false} />
  </mesh>;
}

function PowerMeter() {
  const meter = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
    return { canvas, texture: new CanvasTexture(canvas), last: '' };
  }, []);
  useEffect(() => () => meter.texture.dispose(), [meter]);
  useFrame(() => {
    const watts = useLabStore.getState().snapshot?.sensors.powerW;
    const text = watts === undefined ? '— W' : `${watts.toFixed(0)} W`;
    if (text === meter.last) return;
    const ctx = meter.canvas.getContext('2d'); if (!ctx) return;
    meter.last = text; ctx.fillStyle = '#132c4a'; ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#93c5fd'; ctx.font = '20px sans-serif'; ctx.fillText('POWER · D108', 12, 28);
    ctx.fillStyle = '#f5e38b'; ctx.font = 'bold 52px monospace'; ctx.fillText(text, 12, 88);
    meter.texture.needsUpdate = true;
  });
  return <Clickable device={{ kind: 'sensor', key: 'powerW' }} position={[0.28, -0.105, 0.34]} labelOffset={[0, 0.085, 0]}>
    <Box size={[0.073, 0.115, 0.036]} color="#dfe4e3" />
    <Box size={[0.06, 0.058, 0.006]} position={[0, 0.019, 0.02]} color="#39444c" radius={0.003} />
    <mesh position={[0, 0.019, 0.0235]}><planeGeometry args={[0.051, 0.034]} /><meshBasicMaterial map={meter.texture} toneMapped={false} /></mesh>
    {[-0.018, 0.018].map((x) => <Port key={x} position={[x, -0.063, 0]} radius={0.005} length={0.018} />)}
    <Port position={[0, -0.026, 0.021]} rotation={[Math.PI / 2, 0, 0]} radius={0.008} length={0.005} />
    {[-0.028, 0.028].flatMap((x) => [-0.048, 0.048].map((y) => <mesh key={`${x}:${y}`} position={[x, y, 0.019]}><sphereGeometry args={[0.0025, 8, 6]} /><meshStandardMaterial color="#65767d" metalness={0.6} /></mesh>))}
  </Clickable>;
}

export function UtilityEquipment() {
  return <group>
    {/* ถังสำรองเป็นภาพประกอบ ไม่แสดงระดับเสมือนว่ามี State ปริมาณสำรอง */}
    <Box size={[0.34, 0.016, 0.48]} position={[0.40, -0.188, 0.15]} color="#cbd5d5" />
    <mesh position={[0.40, -0.065, 0]}><boxGeometry args={[0.15, 0.22, 0.14]} /><meshStandardMaterial color="#b6e7f5" transparent opacity={0.24} depthWrite={false} roughness={0.18} /></mesh>
    <mesh position={[0.40, -0.087, 0]}><boxGeometry args={[0.139, 0.17, 0.129]} /><meshStandardMaterial color="#289bd4" transparent opacity={0.43} depthWrite={false} /></mesh>
    <Box size={[0.165, 0.018, 0.155]} position={[0.40, 0.047, 0]} color="#e9f0f0" />
    <Box size={[0.165, 0.012, 0.155]} position={[0.40, -0.174, 0]} color="#d9e5e8" />
    <RoutedPipe points={[[0.43, -0.15, 0], [0.43, 0.075, 0], [0.51, 0.075, 0], [0.51, -0.125, 0], [0.51, -0.125, 0.19], [0.458, -0.125, 0.19]]} />
    <Clickable device={{ kind: 'actuator', key: 'refillPump' }} position={[0.40, -0.125, 0.19]} labelOffset={[0, 0.09, 0]}>
      <Box size={[0.115, 0.074, 0.08]} radius={0.014} />
      <Box size={[0.10, 0.012, 0.1]} position={[0, -0.046, 0]} />
      <Port position={[-0.055, 0, 0]} radius={0.044} length={0.035} rotation={[0, 0, Math.PI / 2]} />
      {[-0.03, -0.015, 0, 0.015, 0.03].map((x) => <Box key={x} size={[0.004, 0.068, 0.083]} position={[x, 0, 0]} radius={0.001} color="#48545b" />)}
      <Box size={[0.045, 0.018, 0.05]} position={[0.012, 0.044, 0]} radius={0.003} />
      <Indicator bit="refillPump" position={[0.03, 0.052, 0.018]} />
    </Clickable>
    <RoutedPipe points={[[0.328, -0.125, 0.19], [0.305, -0.125, 0.19], [0.305, -0.125, 0.20], [0.305, 0.025, 0.20], [0.357, 0.025, 0.20]]} />
    <Clickable device={{ kind: 'sensor', key: 'flowLpm' }} position={[0.40, 0.025, 0.20]} labelOffset={[0, 0.07, 0]}>
      {/* Inline turbine housing: ฝาดำแปดเหลี่ยมและ Union สองข้าง */}
      <Box size={[0.044, 0.039, 0.039]} radius={0.008} color="#252b2e" />
      <mesh position={[0, 0, 0.021]} rotation={[Math.PI / 2, Math.PI / 8, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.008, 8]} />
        <meshStandardMaterial color="#303639" roughness={0.43} />
      </mesh>
      <mesh position={[0, 0, 0.0255]}>
        <torusGeometry args={[0.006, 0.001, 6, 16]} />
        <meshStandardMaterial color="#202629" roughness={0.6} />
      </mesh>
      {[-1, 1].map((side) => <group key={side}>
        <Port position={[side * 0.033, 0, 0]} radius={0.013} length={0.022} rotation={[0, 0, Math.PI / 2]} />
        {[0.026, 0.036, 0.041].map((x) => <mesh key={x} position={[side * x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.016, 0.016, 0.004, 12]} />
          <meshStandardMaterial color="#353d40" roughness={0.4} />
        </mesh>)}
        <Port position={[0, side * 0.024, 0]} radius={0.016} length={0.01} />
        <mesh position={[0, side * 0.029, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.014, 0.002, 8, 24]} />
          <meshStandardMaterial color="#424a4d" roughness={0.4} />
        </mesh>
        <Port position={[side * 0.027, 0.019, 0]} radius={0.005} length={0.018} />
        <mesh position={[side * 0.027, 0.029, 0]}>
          <cylinderGeometry args={[0.003, 0.003, 0.002, 6]} />
          <meshStandardMaterial color="#8a9499" metalness={0.7} roughness={0.4} />
        </mesh>
      </group>)}
      <Pipe points={[[-0.027, 0.028, -0.002], [-0.027, 0.037, -0.008], [-0.018, 0.041, -0.026]]} radius={0.0015} color="#a63a36" />
    </Clickable>
    <RoutedPipe points={[[0.443, 0.025, 0.20], [0.49, 0.025, 0.20], [0.49, 0.235, 0.20], [0.18, 0.235, 0.20], [0.18, 0.235, 0.17], OUTLET]} />
    {/* แคลมป์ยึดแนวท่อบนขอบโต๊ะ */}
    <Box size={[0.014, 0.03, 0.019]} position={[0.25, 0.227, 0.20]} radius={0.003} color="#42545b" />
    <WaterStream />
    <Clickable device={{ kind: 'actuator', key: 'airPump' }} position={[0.44, -0.13, 0.35]} labelOffset={[0, 0.09, 0]}>
      <Box size={[0.16, 0.075, 0.09]} radius={0.022} />
      <Box size={[0.13, 0.008, 0.092]} position={[0, -0.02, 0]} radius={0.003} color="#4d5b63" />
      {[-0.05, 0.05].map((x) => <Box key={x} size={[0.024, 0.019, 0.10]} position={[x, -0.043, 0]} radius={0.004} />)}
      {[-0.04, -0.02, 0, 0.02, 0.04].map((x) => <Box key={x} size={[0.008, 0.003, 0.046]} position={[x, 0.038, 0]} radius={0.001} color="#59666b" />)}
      <Indicator bit="airPump" position={[0.055, 0.012, 0.045]} />
      <Port position={[-0.085, 0, 0]} radius={0.007} rotation={[0, 0, Math.PI / 2]} />
    </Clickable>
    <RoutedPipe points={[[0.355, -0.13, 0.35], [0.278, -0.13, 0.35], [0.278, -0.13, 0.18], [0.278, 0.222, 0.18], [0.12, 0.222, 0.18], [0.12, 0.012, 0.18], [0.12, 0.012, 0], [-0.12, 0.012, 0]]} radius={0.0028} color="#d7e1dc" />
    <PowerMeter />
    <Pipe points={[[0.26, -0.17, 0.34], [0.26, -0.177, 0.41], [0.44, -0.177, 0.41], [0.44, -0.13, 0.39]]} radius={0.003} color="#30393d" />
    <Pipe points={[[0.30, -0.17, 0.34], [0.30, -0.177, 0.23], [0.45, -0.17, 0.24], [0.45, -0.12, 0.21]]} radius={0.003} color="#30393d" />
  </group>;
}
