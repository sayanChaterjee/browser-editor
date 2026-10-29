'use client';

import { TriangleAlert } from 'lucide-react';
import type { Submission, SubmissionFlag } from '@/lib/adminApi';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const FLAG_LABELS: Record<SubmissionFlag, { label: string; hint: string }> = {
  'missing-heartbeats': { label: 'Missing heartbeats', hint: 'The editor reported far less often than it should have: reports blocked, or the contest page wasn\'t open' },
  offline: { label: 'Offline', hint: 'Long silences between reports' },
  'large-paste': { label: 'Large paste', hint: 'Big blocks of code inserted at once (paste, drop or script)' },
  'code-without-typing': { label: 'Code without typing', hint: 'The submission has more code than was typed or pasted in the editor' },
  'similar-submission': { label: 'Similar to another', hint: 'Closely matches another user\'s submission in this contest' },
  'matches-target': { label: 'Matches target code', hint: 'Closely matches the contest\'s target code' },
};

const percent = (value: number) => `${Math.round(value * 100)}%`;
const duration = (seconds: number) => (seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`);

function Stat({ label, value, detail, alert }: { label: string; value: string; detail?: string; alert?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wider text-subtle-foreground">{label}</div>
      <div className={cn('mt-0.5 truncate font-mono text-[13px]', alert ? 'text-warning' : 'text-foreground')}>{value}</div>
      {detail && <div className="truncate text-[11px] text-subtle-foreground">{detail}</div>}
    </div>
  );
}

/** What contest-service recorded about a submission, for the reviewer: evidence, not a verdict. */
export default function SubmissionSignals({ submission }: { submission: Submission }) {
  const s = submission.signals;
  const flags = new Set(submission.flags ?? []);
  if (!s) {
    return (
      <div className="border-b border-border px-4 py-3 text-[13px] text-subtle-foreground">
        No activity signals: this submission was made before they were recorded.
      </div>
    );
  }

  return (
    <div className="border-b border-border px-4 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {flags.size === 0 ? (
          <Badge tone="success">No flags</Badge>
        ) : (
          [...flags].map((flag) => (
            <Badge key={flag} tone="warning" title={FLAG_LABELS[flag]?.hint}>
              <TriangleAlert className="size-3" />
              {FLAG_LABELS[flag]?.label ?? flag}
            </Badge>
          ))
        )}
        <span className="ml-auto text-[11px] text-subtle-foreground">Signals are for review, not proof</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-x-5 gap-y-3 xl:grid-cols-7">
        <Stat label="Heartbeats" value={`${s.heartbeats} / ${s.expectedHeartbeats}`} detail="got / due" alert={flags.has('missing-heartbeats')} />
        <Stat label="Offline" value={duration(s.offlineSeconds)} detail={`${s.gaps} gaps`} alert={flags.has('offline')} />
        <Stat label="Typed" value={`${s.typedChars}`} detail="characters" />
        <Stat label="Pasted" value={`${s.pastedChars}`} detail={`${s.pasteCount}×, max ${s.largestPaste}`} alert={flags.has('large-paste')} />
        <Stat label="Unexplained" value={`${s.unexplainedChars}`} detail="characters" alert={flags.has('code-without-typing')} />
        <Stat
          label="Closest entry"
          value={s.similarity ? percent(s.similarity.score) : '—'}
          detail={s.similarity ? `#${s.similarity.submissionId.slice(-6)}` : undefined}
          alert={flags.has('similar-submission')}
        />
        <Stat label="Target code" value={percent(s.targetSimilarity)} detail="similarity" alert={flags.has('matches-target')} />
      </div>
    </div>
  );
}
