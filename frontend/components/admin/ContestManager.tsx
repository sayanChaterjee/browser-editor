import { useState, useEffect } from 'react';
import { Contest, fetchAllContests, createContest, updateContestStatus } from '@/lib/adminApi';

export default function ContestManager() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError(null);
    try {
      if (!title || !startTime || !endTime || !imageUrl) {
         throw new Error("All fields are required");
      }
      await createContest({
        title,
        startTime,
        endTime,
        imageUrl
      });
      setTitle('');
      setStartTime('');
      setEndTime('');
      setImageUrl('');
      await loadContests();
    } catch (err: any) {
       setError(err.message || 'Failed to create contest');
    } finally {
      setSubmitLoading(false);
    }
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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-8 overflow-y-auto">
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

      {/* Create Contest Form */}
      <div className="bg-[#0c1222] border border-gray-800 rounded-xl p-6 mb-8 shadow-xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6 pb-4 border-b border-gray-800">New Contest Schema</h3>
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
                <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2">Cloudinary Image URL</label>
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
          <div className="pt-4 flex justify-end flex-row">
            <button 
               type="submit" 
               disabled={submitLoading}
               className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
            >
              Initialize Contest
            </button>
          </div>
        </form>
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
                       <button onClick={() => handleStatusChange(c._id, 'ended')} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-lg text-xs font-bold transition-colors">End Contest</button>
                    )}
                 </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
