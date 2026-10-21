import {
  CAUSE_INFO,
  MOOD_EMOJI,
  STAGE_CELEBRATION,
  isCelebrating,
  isPlantDead,
  plantCause,
  plantMood,
  showGainBadge,
  type GrowthStage,
  type PlantCause,
  type PlantMood,
} from '@gol/shared';
import { useLabStore, type LabState } from '../store/labStore';
import { POT } from './layout';

/**
 * ป้ายเป็น DOM ชั้นเดียวซ้อนบน Canvas (ไม่ใช้ drei Html ที่สร้าง React root แยกต่อป้าย)
 * Lettuce เขียนตำแหน่งจอของแต่ละต้นลง Element นี้ทุกเฟรมจาก Group เหนือทรงพุ่ม
 */
export const badgeElements = new Map<number, HTMLDivElement>();

/**
 * สรุปป้ายของต้นเป็นสตริงเดียว — selector คืนค่า primitive จึงไม่ render วน (กฎ Zustand)
 * mood|cause|gain|celebrateStage|damage%
 */
function badgeKey(s: LabState, plantId: number): string {
  const snap = s.snapshot;
  const p = snap?.plants.find((x) => x.id === plantId);
  if (!snap || !p) return '';
  const dead = isPlantDead(p, snap.game.deadPlantIds);
  const mood = plantMood(p, dead);
  const cause = dead ? '' : (plantCause(p, { ph: snap.sensors.ph, minuteOfDay: snap.sim.minuteOfDay, ignorePh: !!snap.level?.ignoredFactors.includes('ph') }) ?? '');
  const gain = !dead && showGainBadge(p, snap.sim.minuteOfDay) ? p.gainYesterdayG!.toFixed(1) : '';
  const party = !dead && isCelebrating(p, snap.simTimeS) ? p.stage : '';
  return `${mood}|${cause}|${gain}|${party}|${Math.round(p.damage * 100)}`;
}

/** ป้ายเหนือผัก: Mood + สาเหตุ, แถบ Damage, "+g", ฉลองเปลี่ยนระยะ (SPEC § 4.10) */
function PlantBadge({ plantId }: { plantId: number }) {
  const key = useLabStore((s) => badgeKey(s, plantId));
  if (!key) return null;
  const [mood, cause, gain, party, damage] = key.split('|') as [PlantMood, PlantCause | '', string, GrowthStage | '', string];
  const damagePct = Number(damage);
  const causeInfo = cause ? CAUSE_INFO[cause] : null;
  return (
      <div className="plant-badge" aria-label={`Plant ${plantId}`}>
        {party && <div className="plant-badge-party">{STAGE_CELEBRATION[party]}</div>}
        {gain && <div className="plant-badge-gain" title="โตเมื่อวาน">+{gain} g</div>}
        <div className="plant-badge-face" title={causeInfo?.label}>
          <span>{MOOD_EMOJI[mood]}</span>
          {causeInfo && <span className="plant-badge-cause">{causeInfo.icon}</span>}
        </div>
        {damagePct > 0 && mood !== 'dead' && (
          <div className="plant-badge-damage" title={`Damage ${damagePct}%`}>
            <div style={{ width: `${damagePct}%` }} />
          </div>
        )}
      </div>
  );
}

/** ชั้นป้ายของทุกต้น วางใน PlantView เหนือ Canvas 3D */
export function PlantBadges() {
  const ids = useLabStore((s) => s.snapshot?.plants.map((p) => p.id).join(',') ?? '');
  if (!ids) return null;
  return (
    <div className="plant-badge-layer" aria-hidden>
      {ids.split(',').map(Number).map((id) => (
        <div
          key={id}
          className="plant-badge-anchor"
          style={{ display: 'none' }}
          ref={(el) => {
            if (el) badgeElements.set(id, el);
            else badgeElements.delete(id);
          }}
        >
          <PlantBadge plantId={id} />
        </div>
      ))}
    </div>
  );
}

/** วงแหวนสีทองรอบกระถางระหว่างฉลองเปลี่ยนระยะ (ตามเวลาจำลอง) */
export function CelebrationRing({ plantId }: { plantId: number }) {
  const on = useLabStore((s) => {
    const p = s.snapshot?.plants.find((x) => x.id === plantId);
    return !!p && !!s.snapshot && isCelebrating(p, s.snapshot.simTimeS);
  });
  if (!on) return null;
  return (
    <mesh position={[0, POT.topY + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[POT.topRadius * 1.5, POT.topRadius * 1.85, 40]} />
      <meshBasicMaterial color="#f59e0b" transparent opacity={0.9} />
    </mesh>
  );
}
