import { useState, useEffect } from 'react';
import { Contest, fetchAllContests, createContest, updateContest, updateContestStatus, deleteContest } from '@/lib/adminApi';
import PreviewPanel from '@/components/admin/PreviewPanel';

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
    } catch (err: any) {
      setError(err.message || 'Failed to load contests');
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
    } catch (err: any) {
       setError(err.message || (editMode ? 'Failed to update contest' : 'Failed to create contest'));
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
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this contest? This action cannot be undone.')) return;
    try {
      setError(null);
      await deleteContest(id);
      await loadContests();
    } catch (err: any) {
      setError(err.message || 'Failed to delete contest');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-8 overflow-y-auto w-full">
      <div className="flex justify-between items-center mb-8">
         <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Contest Management</h2>
            <p className="text-sm text-gray-500">Create and oversee global css battles</p>
         </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-[#0c1222] border border-gray-800 rounded-xl p-6 mb-8 shadow-xl flex flex-col xl:flex-row gap-6">
        <div className="flex-1">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6 pb-4 border-b border-gray-800">
            {editMode ? 'Edit Contest' : 'New Contest Schema'}
          </h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2">Contest Title</label>
                  <input 
                    type="text" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    placeholder="e.g. Weekly Battle #42"
                  />
               </div>
               <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2">Image URL (Optional)</label>
                  <input 
                    type="url" 
                    value={imageUrl} 
                    onChange={(e) => setImageUrl(e.target.value)} 
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    placeholder="https://res.cloudinary.com/..."
                  />
               </div>
               <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2">Start Time</label>
                  <input 
                    type="datetime-local" 
                    value={startTime} 
                    onChange={(e) => setStartTime(e.target.value)} 
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors [color-scheme:dark]"
                  />
               </div>
               <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2">End Time</label>
                  <input 
                    type="datetime-local" 
                    value={endTime} 
                    onChange={(e) => setEndTime(e.target.value)} 
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors [color-scheme:dark]"
                  />
               </div>
            </div>
            
            <div className="border-t border-gray-800 pt-4 mt-4">
               <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2 text-center">OR PROVIDE TARGET CODE</label>
               <div className="grid grid-cols-3 gap-2">
                 <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">HTML</label>
                    <textarea 
                      value={html} 
                      onChange={(e) => setHtml(e.target.value)} 
                      className="w-full h-32 bg-gray-900 border border-gray-700 rounded flex-1 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 transition-colors"
                      placeholder="<div>...</div>"
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">CSS</label>
                    <textarea 
                      value={css} 
                      onChange={(e) => setCss(e.target.value)} 
                      className="w-full h-32 bg-gray-900 border border-gray-700 rounded flex-1 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 transition-colors"
                      placeholder="div { ... }"
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">JS</label>
                    <textarea 
                      value={js} 
                      onChange={(e) => setJs(e.target.value)} 
                      className="w-full h-32 bg-gray-900 border border-gray-700 rounded flex-1 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 transition-colors"
                      placeholder="console.log(...)"
                    />
                 </div>
               </div>
            </div>
            
            <div className="pt-4 flex justify-end flex-row gap-3">
              {editMode && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-6 py-2.5 rounded-lg text-sm font-bold transition-colors"
                >
                  Cancel
                </button>
              )}
              <button 
                 type="submit" 
                 disabled={submitLoading}
                 className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              >
                {submitLoading ? 'Saving...' : (editMode ? 'Save Changes' : 'Initialize Contest')}
              </button>
            </div>
          </form>
        </div>
        
        {/* Preview Side */}
        <div className="flex-1 border border-gray-800 rounded-xl overflow-hidden min-h-[400px] xl:min-h-full bg-black relative flex flex-col">
          <div className="absolute inset-x-0 top-0 h-8 bg-gray-900 border-b border-gray-800 flex items-center px-4 text-[10px] text-gray-500 font-bold uppercase tracking-widest z-10">
             Target Preview
          </div>
          <div className="pt-8 flex-1 h-full w-full">
            {(html || css || js) ? (
              <PreviewPanel html={html} css={css} js={js} projectName="Live Preview" />
            ) : imageUrl ? (
              <img src={imageUrl} alt="Preview" className="w-full h-full object-contain bg-gray-900" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-600">
                 <div className="w-16 h-16 rounded-full border border-dashed border-gray-700 flex items-center justify-center mb-4">
                    <span className="text-2xl opacity-20">🖼️</span>
                 </div>
                 <p className="text-xs">Preview will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contest List */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Active & Historical Contests</h3>
        {contests.length === 0 ? (
           <div className="text-center p-8 bg-gray-900/50 rounded-xl border border-gray-800 text-sm text-gray-500">
             No contest records found in database.
           </div>
        ) : (
          contests.map((c) => (
            <div key={c._id} className="bg-[#0c1222] border border-gray-800 rounded-xl p-5 flex items-center justify-between group hover:border-gray-700 transition-colors">
              <div className="flex items-center gap-6">
                 <div className="w-16 h-16 rounded bg-gray-900 overflow-hidden border border-gray-800 shrink-0">
                    <img src={c.imageUrl} alt="preview" className="w-full h-full object-cover" />
                 </div>
                 <div>
                    <h4 className="text-base font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors">{c.title}</h4>
                    <div className="flex gap-4 text-xs font-mono text-gray-500">
                       <span>START: {new Date(c.startTime).toLocaleString()}</span>
                       <span>END: {new Date(c.endTime).toLocaleString()}</span>
                    </div>
                 </div>
              </div>
              
              <div className="flex items-center gap-4">
                 <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full border ${
                    c.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                    c.status === 'ended' ? 'bg-gray-800 text-gray-400 border-gray-700' :
                    'bg-amber-500/10 text-amber-400 border-amber-500/30'
                 }`}>
                    {c.status}
                 </span>
                 
                 <div className="flex gap-2 ml-4">
                    {c.status === 'pending' && (
                       <button onClick={() => handleStatusChange(c._id, 'active')} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-lg text-xs font-bold transition-colors">Start Contest</button>
                    )}
                    {c.status === 'active' && (
                       <button onClick={() => handleStatusChange(c._id, 'ended')} className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-4 py-2 rounded-lg text-xs font-bold transition-colors">End Contest</button>
                    )}
                    <button onClick={() => handleEditClick(c)} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-4 py-2 rounded-lg text-xs font-bold transition-colors">Edit Contest</button>
                    <button onClick={() => handleDelete(c._id)} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-2 rounded-lg text-xs font-bold transition-colors">Delete Contest</button>
                 </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
