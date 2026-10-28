import { useState, useEffect } from 'react';
import { Contest, fetchAllContests, createContest, updateContest, updateContestStatus, deleteContest } from '@/lib/adminApi';
import PreviewPanel from '@/components/admin/PreviewPanel';
import { ImageIcon, Pencil, Play, Square, Trash2, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

export default function ContestManager() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [html, setHtml] = useState('');
  const [css, setCss] = useState('');
  const [js, setJs] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editContestId, setEditContestId] = useState<string | null>(null);

  const loadContests = async () => {
    try {
      setLoading(true);
      const data = await fetchAllContests();
      setContests(data);
    } catch (err) {
      setError((err instanceof Error && err.message) || 'Failed to load contests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContests();
  }, []);

  // Auto-update contest status when endTime passes
  useEffect(() => {
    const interval = setInterval(() => {
      contests.forEach(c => {
        if (c.status === 'active' && new Date(c.endTime).getTime() <= Date.now()) {
          handleStatusChange(c._id, 'ended');
        }
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [contests]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError(null);
    try {
      if (!title || !startTime || !endTime) {
         throw new Error("Title and time fields are required");
      }
      if (!imageUrl && !html && !css && !js) {
         throw new Error("Provide either an image URL or code for the question");
      }
      if (editMode && editContestId) {
        await updateContest(editContestId, {
          title,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          imageUrl: imageUrl || undefined,
          html: html || undefined,
          css: css || undefined,
          js: js || undefined
        });
        setEditMode(false);
        setEditContestId(null);
      } else {
        await createContest({
          title,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          imageUrl: imageUrl || undefined,
          html: html || undefined,
          css: css || undefined,
          js: js || undefined
        });
      }
      resetForm();
      await loadContests();
    } catch (err) {
       setError((err instanceof Error && err.message) || (editMode ? 'Failed to update contest' : 'Failed to create contest'));
    } finally {
      setSubmitLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setStartTime('');
    setEndTime('');
    setImageUrl('');
    setHtml('');
    setCss('');
    setJs('');
    setEditMode(false);
    setEditContestId(null);
  };

  const handleEditClick = (contest: Contest) => {
    setEditMode(true);
    setEditContestId(contest._id);
    setTitle(contest.title);
    
    // Format date for datetime-local input
    const start = new Date(contest.startTime);
    start.setMinutes(start.getMinutes() - start.getTimezoneOffset());
    setStartTime(start.toISOString().slice(0, 16));
    
    const end = new Date(contest.endTime);
    end.setMinutes(end.getMinutes() - end.getTimezoneOffset());
    setEndTime(end.toISOString().slice(0, 16));
    
    setImageUrl(contest.imageUrl || '');
    setHtml(contest.html || '');
    setCss(contest.css || '');
    setJs(contest.js || '');
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStatusChange = async (id: string, newStatus: 'pending' | 'active' | 'ended') => {
    try {
      setError(null);
      await updateContestStatus(id, newStatus);
      await loadContests();
    } catch (err) {
      setError((err instanceof Error && err.message) || 'Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this contest? This action cannot be undone.')) return;
    try {
      setError(null);
      await deleteContest(id);
      await loadContests();
    } catch (err) {
      setError((err instanceof Error && err.message) || 'Failed to delete contest');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="size-5" />
      </div>
    );
  }

  const textarea =
    'h-32 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-subtle-foreground transition-colors hover:border-border-strong focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30';

  return (
    <div className="flex w-full flex-1 flex-col overflow-y-auto">
      <header className="flex h-16 shrink-0 items-center border-b border-border px-6">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">Contests</h2>
          <p className="text-[13px] text-muted-foreground">Create contests, start and end them, and edit their targets.</p>
        </div>
      </header>

      <div className="space-y-8 p-6">
        {error && (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive">
            {error}
          </div>
        )}

        <section className="grid gap-px overflow-hidden rounded-xl border border-border bg-border xl:grid-cols-2">
          <div className="bg-card p-6">
            <h3 className="text-sm font-medium text-foreground">{editMode ? 'Edit contest' : 'New contest'}</h3>
            <form onSubmit={handleCreate} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="contest-title">Title</Label>
                  <Input id="contest-title" className="mt-1.5" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly battle #42" />
                </div>
                <div>
                  <Label htmlFor="contest-start">Starts</Label>
                  <Input id="contest-start" type="datetime-local" className="mt-1.5" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="contest-end">Ends</Label>
                  <Input id="contest-end" type="datetime-local" className="mt-1.5" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="contest-image">Target image URL (optional)</Label>
                  <Input id="contest-image" type="url" className="mt-1.5" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
                </div>
              </div>

              <div>
                <p className="text-[13px] font-medium text-muted-foreground">Or target code</p>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  <textarea aria-label="Target HTML" value={html} onChange={(e) => setHtml(e.target.value)} className={textarea} placeholder="<div>...</div>" />
                  <textarea aria-label="Target CSS" value={css} onChange={(e) => setCss(e.target.value)} className={textarea} placeholder="div { ... }" />
                  <textarea aria-label="Target JavaScript" value={js} onChange={(e) => setJs(e.target.value)} className={textarea} placeholder="console.log(...)" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {editMode && (
                  <Button type="button" variant="secondary" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
                <Button type="submit" variant="primary" disabled={submitLoading}>
                  {submitLoading ? 'Saving...' : editMode ? 'Save changes' : 'Create contest'}
                </Button>
              </div>
            </form>
          </div>

          <div className="flex min-h-[400px] flex-col bg-background">
            <div className="flex h-9 items-center border-b border-border px-3 text-[11px] font-medium uppercase tracking-wider text-subtle-foreground">
              Target preview
            </div>
            <div className="flex-1">
              {(html || css || js) ? (
                <PreviewPanel html={html} css={css} js={js} projectName="Live preview" />
              ) : imageUrl ? (
                <img src={imageUrl} alt="Target" className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center text-center">
                  <ImageIcon className="size-5 text-subtle-foreground" />
                  <p className="mt-2 text-[13px] text-muted-foreground">Add an image URL or target code to preview it</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-medium text-foreground">All contests</h3>
          {contests.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border-strong p-8 text-center text-sm text-muted-foreground">
              No contests yet.
            </p>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {contests.map((c) => (
                <div key={c._id} className="flex items-center justify-between gap-4 bg-card px-4 py-3 transition-colors hover:bg-muted">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
                      {c.imageUrl ? (
                        <img src={c.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Trophy className="size-4 text-subtle-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="truncate text-sm font-medium text-foreground">{c.title}</h4>
                        <Badge tone={c.status === 'active' ? 'success' : c.status === 'pending' ? 'warning' : 'neutral'}>
                          {c.status === 'active' && <span className="size-1.5 rounded-full bg-success" />}
                          {c.status}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                        {new Date(c.startTime).toLocaleString()} → {new Date(c.endTime).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {c.status === 'pending' && (
                      <Button size="sm" variant="primary" onClick={() => handleStatusChange(c._id, 'active')}>
                        <Play /> Start
                      </Button>
                    )}
                    {c.status === 'active' && (
                      <Button size="sm" variant="secondary" onClick={() => handleStatusChange(c._id, 'ended')}>
                        <Square /> End
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" aria-label={`Edit ${c.title}`} title="Edit" onClick={() => handleEditClick(c)}>
                      <Pencil />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={`Delete ${c.title}`} title="Delete" className="hover:text-destructive" onClick={() => handleDelete(c._id)}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
