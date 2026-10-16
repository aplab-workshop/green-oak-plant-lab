import { Wifi, WifiOff } from 'lucide-react';
import { useConnectionStore } from '../store/connectionStore';

const LABEL = {
  connecting: 'Connecting…',
  connected: 'Server Connected',
  disconnected: 'Server Disconnected',
} as const;

export function ConnectionBadge() {
  const { status, lastHeartbeatSeq, rttMs, serverVersion } = useConnectionStore();
  const ok = status === 'connected';
  return (
    <div
      className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
        ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
      }`}
      title={serverVersion ? `Server v${serverVersion}` : undefined}
    >
      {ok ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
      <span data-testid="ws-status">{LABEL[status]}</span>
      {ok && (
        <span className="text-xs text-emerald-600/80">
          heartbeat #{lastHeartbeatSeq}
          {rttMs !== null && ` · ${rttMs} ms`}
        </span>
      )}
    </div>
  );
}
