import { BufferGeometry, Float32BufferAttribute, MeshStandardMaterial, DoubleSide, type IUniform } from 'three';

/**
 * ใบผักสลัด Green Oak แบบ Procedural
 * - ใบยาว 1 หน่วยตามแกน +Z (ก้านที่ z = 0), กว้างตามแกน X, Instance matrix จะ scale เป็นขนาดจริง
 * - ขอบใบหยักลึกแบบใบโอ๊ค (rounded lobes) และเป็นคลื่นเล็กน้อย
 * - เป็น Grid (ไม่ใช่ outline อย่างเดียว) จึงโค้งงอใน Vertex shader ได้
 */

/** จำนวนหยักต่อข้างของใบ */
export const LEAF_LOBES = 4.5;

/** ครึ่งความกว้างของใบที่ตำแหน่ง t (0 = ก้าน, 1 = ปลาย) */
export function leafHalfWidth(t: number): number {
  const petiole = 0.18 + 0.82 * smoothstep(0, 0.22, t);
  const envelope = Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.98 + 0.02)), 0.65) * petiole;
  const lobe = 0.7 + 0.3 * Math.cos(2 * Math.PI * LEAF_LOBES * t);
  return 0.5 * envelope * lobe;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function createLeafGeometry(segmentsLength: number, segmentsHalfWidth: number): BufferGeometry {
  const cols = segmentsHalfWidth * 2 + 1;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segmentsLength; i++) {
    const t = i / segmentsLength;
    const half = leafHalfWidth(t);
    for (let j = 0; j < cols; j++) {
      const s = j / (cols - 1) * 2 - 1; // −1…1
      const x = s * half;
      // ใบห่อขึ้นเล็กน้อย + ขอบใบเป็นคลื่น (ลักษณะใบผักสลัด)
      const cup = 0.4 * s * s * half + 0.12 * Math.sin(Math.PI * t);
      const ruffle = 0.026 * Math.abs(s) ** 3 * (Math.sin(48 * t + 7 * s) + 0.2 * Math.sin(97 * t)) * (0.3 + t);
      const veinRidge = 0.006 * Math.cos(42 * t - Math.abs(s) * 8) * Math.abs(s);
      positions.push(x, cup + ruffle + veinRidge, t);
      // เส้นกลางใบสว่าง ขอบใบเข้มขึ้น
      const shade = 0.78 + 0.2 * Math.abs(s) + 0.06 * Math.sin(t * 16 + s * 4);
      const vein = Math.abs(s) < 0.08 ? 0.2 : Math.pow(Math.max(0, Math.cos(42 * t - Math.abs(s) * 8)), 12) * 0.09;
      colors.push(Math.min(1, shade + vein), Math.min(1, shade + vein), Math.min(1, shade * 0.72 + vein));
    }
  }
  for (let i = 0; i < segmentsLength; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

export interface LeafUniforms {
  /** ความโค้งของปลายใบ (ใบตก) */
  uBend: IUniform<number>;
  /** ใบเหี่ยว: ขอบใบห่อลงและใบแคบลง */
  uWilt: IUniform<number>;
  /** ใบม้วนขึ้น (Light stress — M2) */
  uCurl: IUniform<number>;
  /** ความสูงผิวฝาถัง (world y) — ใบที่ตกจะนอนบนฝา ไม่ทะลุลงไป */
  uFloorY: IUniform<number>;
}

/**
 * Material ของใบ: โค้งใบใน Vertex shader ตาม uniforms ของแต่ละต้น
 * (ทำงานใน Local space ของใบ ก่อนคูณ Instance matrix)
 */
export function createLeafMaterial(floorY: number): { material: MeshStandardMaterial; uniforms: LeafUniforms } {
  const uniforms: LeafUniforms = { uBend: { value: 0.3 }, uWilt: { value: 0 }, uCurl: { value: 0 }, uFloorY: { value: floorY } };
  const material = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.72, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBend = uniforms.uBend;
    shader.uniforms.uWilt = uniforms.uWilt;
    shader.uniforms.uCurl = uniforms.uCurl;
    shader.uniforms.uFloorY = uniforms.uFloorY;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uBend;
        uniform float uWilt;
        uniform float uCurl;
        uniform float uFloorY;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float lt = transformed.z;
        float ax = abs(transformed.x);
        // ใบเหี่ยว: แคบลงไปทางปลาย และขอบใบห่อลง
        transformed.x *= 1.0 - 0.38 * uWilt * lt;
        transformed.y -= uWilt * ax * 0.9;
        // Light stress (M2): ขอบใบม้วนขึ้น
        transformed.y += uCurl * ax * 0.7;
        // ปลายใบโค้งลง (ใบตก) แบบพาราโบลา และหดความยาวเล็กน้อยให้ดูเป็นส่วนโค้ง
        transformed.y -= uBend * lt * lt * 0.55;
        transformed.z *= 1.0 - 0.18 * uBend * lt;`,
      )
      .replace(
        '#include <project_vertex>',
        `#ifdef USE_INSTANCING
          mat4 leafModel = modelMatrix * instanceMatrix;
        #else
          mat4 leafModel = modelMatrix;
        #endif
        // ส่วนของใบที่ตกต่ำกว่าผิวฝา ให้นอนราบบนฝา (เหมือนใบเหี่ยวพาดบนฝาถัง)
        vec4 leafWorld = leafModel * vec4(transformed, 1.0);
        if (leafWorld.y < uFloorY) {
          leafWorld.y = uFloorY + (uFloorY - leafWorld.y) * 0.03;
          transformed = (inverse(leafModel) * leafWorld).xyz;
        }
        #include <project_vertex>`,
      );
  };
  return { material, uniforms };
}
