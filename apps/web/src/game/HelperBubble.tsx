import { useLabStore } from '../store/labStore';
import { helperMessage, type Tone } from './gameModel';

const TONE_CLASS: Record<Tone, string> = {
  info: 'helper-info',
  good: 'helper-good',
  warn: 'helper-warn',
  danger: 'helper-danger',
};

/** ข้อความผู้ช่วย 💬 ลอยเหนือ Dock ล่าง — เฉพาะโหมดด่าน (SPEC § 4.9) */
export function HelperBubble() {
  const s = useLabStore((st) => st.snapshot);
  if (!s?.level) return null;
  const m = helperMessage(s);
  return (
    <div className={`helper-bubble ${TONE_CLASS[m.tone]}`} role="status" aria-live="polite">
      <span aria-hidden>💬</span> {m.text}
    </div>
  );
}
