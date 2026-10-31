'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { fetchReplay, fetchSnapshotCode, type Replay, type ReplayPoint } from '@/lib/adminApi';
import PreviewPanel from '@/components/admin/PreviewPanel';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

/**
 * How a contest submission came about: the code's size over the contest (from the editor's
 * heartbeats, every 15 s), with pastes and offline gaps marked, and the code itself at each
 * snapshot (about once a minute). A sudden jump in size - a big paste, or code set from
 * devtools - is visible where it happened.
 *
 * Chart colours: categorical slots 1 and 2 of the dataviz reference palette, dark steps
 * (validated on this surface: CVD ΔE 26.8, both >= 3:1). Text stays in text tokens.
 */
const SERIES_SIZE = '#3987e5';
const SERIES_PASTE = '#d95926';
const SURFACE = '#0a0a0a'; // --card: the ring around markers
const GAP_SECONDS = 45; // as contest-service: a longer silence is a gap
const HEIGHT = 200;
const PAD = { top: 12, right: 16, bottom: 28, left: 48 };

const minutes = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

// 1, 2, 5 × 10^n: round tick steps for the size axis
function niceStep(max: number, ticks = 4) {
  const raw = max / ticks;
  const power = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 5, 10].map((m) => m * power).find((step) => step >= raw) ?? power * 10;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

interface ChartProps {
  replay: Replay;
  selected: number;
  onSelect: (index: number) => void;
}

function SizeChart({ replay, selected, onSelect }: ChartProps) {
  const [box, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const submittedAt = new Date(replay.submission.submittedAt).getTime();
  const points = useMemo(() => {
    const sized = replay.timeline
      .filter((p): p is ReplayPoint & { chars: number } => p.chars !== null)
      .map((p) => ({ ...p, t: new Date(p.at).getTime() }));
    // The submitted code is the last point
    return [...sized, { at: replay.submission.submittedAt, typed: 0, pasted: 0, largestPaste: 0, chars: replay.submission.chars, t: submittedAt, submitted: true }];
  }, [replay, submittedAt]);

  const start = Math.min(points[0].t, replay.contest ? new Date(replay.contest.startTime).getTime() : points[0].t);
  const span = Math.max(submittedAt - start, 60_000);
  const step = niceStep(Math.max(...points.map((p) => p.chars), 100));
  const yMax = step * Math.ceil(Math.max(...points.map((p) => p.chars), 1) / step);
  const plotW = Math.max(width - PAD.left - PAD.right, 10);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - start) / span) * plotW;
  const y = (chars: number) => PAD.top + plotH - (chars / yMax) * plotH;

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.chars).toFixed(1)}`).join('');
  const gaps = points.slice(1).flatMap((p, i) => {
    const prev = points[i];
    return (p.t - prev.t) / 1000 > GAP_SECONDS ? [{ from: prev.t, to: p.t }] : [];
  });
  const timeTicks = (() => {
    const stepMin = [1, 2, 5, 10, 15, 30, 60].find((m) => span / 60_000 / m <= 6) ?? 120;
    return Array.from({ length: Math.floor(span / 60_000 / stepMin) + 1 }, (_, i) => start + i * stepMin * 60_000);
  })();
  const snapTimes = replay.snapshots.map((s) => new Date(s.at).getTime());

  const nearest = <T,>(list: T[], at: (item: T) => number, t: number) =>
    list.reduce((best, item, i) => (Math.abs(at(item) - t) < Math.abs(at(list[best]) - t) ? i : best), 0);
  const timeAt = (clientX: number) => {
    const rect = box.current!.getBoundingClientRect();
    return start + ((clientX - rect.left - PAD.left) / plotW) * span;
  };

  const hovered = hover !== null ? points[hover] : null;
  const hoverGap = hovered && gaps.find((g) => g.to === hovered.t);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: SERIES_SIZE }} /> Code size</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: SERIES_PASTE }} /> Paste</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-px bg-muted-foreground" /> Snapshot</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm bg-foreground/10" /> Offline</span>
      </div>
      <div
        ref={box}
        className="relative cursor-crosshair select-none"
        style={{ height: HEIGHT }}
        onPointerMove={(e) => setHover(nearest(points, (p) => p.t, timeAt(e.clientX)))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => snapTimes.length && onSelect(nearest(snapTimes, (t) => t, timeAt(e.clientX)))}
        role="img"
        aria-label={`Code size over the contest: ${points.length} points, ${replay.snapshots.length} snapshots`}
      >
        {width > 0 && (
          <svg width={width} height={HEIGHT} className="block overflow-visible">
            {/* Size gridlines and labels */}
            {Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step).map((v) => (
              <g key={v}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-border" strokeWidth={1} />
                <text x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-subtle-foreground text-[11px] tabular-nums">
                  {v >= 1000 ? `${v / 1000}k` : v}
                </text>
              </g>
            ))}
            {timeTicks.map((t) => (
              <text key={t} x={x(t)} y={HEIGHT - 8} textAnchor="middle" className="fill-subtle-foreground text-[11px] tabular-nums">
                {minutes(t - start)}
              </text>
            ))}
            {gaps.map((g) => (
              <rect key={g.from} x={x(g.from)} y={PAD.top} width={Math.max(x(g.to) - x(g.from), 1)} height={plotH} className="fill-foreground/10" />
            ))}
            {/* Snapshots: ticks on the baseline; the selected one as a line through the plot */}
            {snapTimes.map((t, i) => (
              <line key={t} x1={x(t)} x2={x(t)} y1={PAD.top + plotH} y2={PAD.top + plotH + (i === selected ? 8 : 5)} stroke="currentColor"
                className={i === selected ? 'text-foreground' : 'text-muted-foreground'} strokeWidth={i === selected ? 2 : 1} />
            ))}
            {snapTimes[selected] !== undefined && (
              <line x1={x(snapTimes[selected])} x2={x(snapTimes[selected])} y1={PAD.top} y2={PAD.top + plotH} stroke="currentColor" className="text-foreground/40" strokeWidth={1} />
            )}
            <path d={path} fill="none" stroke={SERIES_SIZE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {points.filter((p) => p.pasted > 0).map((p) => (
              <circle key={p.t} cx={x(p.t)} cy={y(p.chars)} r={4} fill={SERIES_PASTE} stroke={SURFACE} strokeWidth={2} />
            ))}
            {hovered && (
              <>
                <line x1={x(hovered.t)} x2={x(hovered.t)} y1={PAD.top} y2={PAD.top + plotH} stroke="currentColor" className="text-foreground/60" strokeWidth={1} />
                <circle cx={x(hovered.t)} cy={y(hovered.chars)} r={4} fill={SERIES_SIZE} stroke={SURFACE} strokeWidth={2} />
              </>
            )}
          </svg>
        )}
        {hovered && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-md border border-border-strong bg-popover px-2.5 py-1.5 text-[12px] shadow-xl shadow-black"
            style={{ left: Math.min(x(hovered.t) + 10, width - 170) }}
          >
            <div className="font-medium tabular-nums text-foreground">{hovered.chars.toLocaleString()} characters</div>
            <div className="text-muted-foreground tabular-nums">
              {'submitted' in hovered ? 'Submitted' : `at ${minutes(hovered.t - start)}`}
              {hovered.typed > 0 && ` · typed ${hovered.typed}`}
              {hovered.pasted > 0 && ` · pasted ${hovered.pasted}`}
            </div>
            {hoverGap && <div className="text-muted-foreground">after {Math.round((hoverGap.to - hoverGap.from) / 1000)} s offline</div>}
          </div>
        )}
      </div>
    </div>
  );
}

const TABS = ['Preview', 'HTML', 'CSS', 'JS'] as const;

export default function ContestReplay({ submissionId, onClose }: { submissionId: string; onClose: () => void }) {
  const [replay, setReplay] = useState<Replay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [code, setCode] = useState<{ id: string; html: string; css: string; js: string } | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Preview');

  useEffect(() => {
    fetchReplay(submissionId)
      .then((data) => {
        setReplay(data);
        setSelected(Math.max(0, data.snapshots.length - 1));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the replay'));
  }, [submissionId]);

  const snapshot = replay?.snapshots[selected];
  useEffect(() => {
    if (!snapshot) return;
    fetchSnapshotCode(submissionId, snapshot._id)
      .then((body) => setCode({ id: snapshot._id, ...body }))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the snapshot'));
  }, [submissionId, snapshot]);

  const start = replay && (replay.contest ? new Date(replay.contest.startTime).getTime() : new Date(replay.timeline[0]?.at ?? replay.submission.submittedAt).getTime());
  const current = code && snapshot && code.id === snapshot._id ? code : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="text-sm font-medium text-foreground">
          Replay <span className="font-normal text-muted-foreground">· {replay?.contest?.title ?? 'submission'}</span>
        </div>
        <Button size="icon" variant="ghost" aria-label="Close the replay" title="Close the replay" onClick={onClose}><X /></Button>
      </div>

      {error && <p className="px-4 py-3 text-sm text-destructive">{error}</p>}
      {!replay && !error && <div className="flex flex-1 items-center justify-center"><Spinner className="size-5" /></div>}

      {replay && replay.timeline.length === 0 && replay.snapshots.length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-subtle-foreground">
          No replay for this submission: it was made before replays were recorded.
        </p>
      )}

      {replay && (replay.timeline.length > 0 || replay.snapshots.length > 0) && (
        <>
          <div className="border-b border-border px-4 py-3">
            <SizeChart replay={replay} selected={selected} onSelect={setSelected} />
            {replay.snapshots.length > 0 ? (
              <div className="mt-3 flex items-center gap-3">
                <Button size="icon" variant="ghost" aria-label="Previous snapshot" disabled={selected === 0} onClick={() => setSelected((s) => s - 1)}><ChevronLeft /></Button>
                <input
                  type="range"
                  min={0}
                  max={replay.snapshots.length - 1}
                  value={selected}
                  onChange={(e) => setSelected(Number(e.target.value))}
                  aria-label="Snapshot"
                  className="flex-1 accent-foreground"
                />
                <Button size="icon" variant="ghost" aria-label="Next snapshot" disabled={selected === replay.snapshots.length - 1} onClick={() => setSelected((s) => s + 1)}><ChevronRight /></Button>
                <span className="w-56 text-right text-[12px] tabular-nums text-muted-foreground">
                  Snapshot {selected + 1} of {replay.snapshots.length} · {minutes(new Date(snapshot!.at).getTime() - start!)} · {snapshot!.chars.toLocaleString()} chars
                </span>
              </div>
            ) : (
              <p className="mt-2 text-[12px] text-subtle-foreground">No code snapshots for this submission (only the activity timeline).</p>
            )}
            <details className="mt-2 text-[12px] text-muted-foreground">
              <summary className="cursor-pointer select-none">Table</summary>
              <table className="mt-2 w-full text-left tabular-nums">
                <thead className="text-subtle-foreground"><tr><th className="py-1 font-normal">Time</th><th className="font-normal">Size</th><th className="font-normal">Typed</th><th className="font-normal">Pasted</th></tr></thead>
                <tbody>
                  {replay.timeline.map((p) => (
                    <tr key={p.at} className="border-t border-border">
                      <td className="py-1">{minutes(new Date(p.at).getTime() - start!)}</td>
                      <td>{p.chars ?? '-'}</td><td>{p.typed}</td><td>{p.pasted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>

          {replay.snapshots.length > 0 && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex gap-1 border-b border-border px-3">
                {TABS.map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={cn('-mb-px border-b px-2.5 py-2 text-[13px] transition-colors', tab === t ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1">
                {!current ? (
                  <div className="flex h-full items-center justify-center"><Spinner className="size-5" /></div>
                ) : tab === 'Preview' ? (
                  <PreviewPanel html={current.html} css={current.css} js={current.js} projectName={`Snapshot ${selected + 1}`} />
                ) : (
                  <pre className="h-full overflow-auto bg-editor p-4 font-mono text-[12px] leading-5 text-foreground">
                    {tab === 'HTML' ? current.html : tab === 'CSS' ? current.css : current.js}
                  </pre>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
