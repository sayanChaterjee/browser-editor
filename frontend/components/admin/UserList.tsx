'use client';

import { User } from '@/lib/adminApi';

interface UserListProps {
  users: User[];
  selectedUserId: string | null;
  onSelectUser: (user: User) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function UserList({
  users,
  selectedUserId,
  onSelectUser,
  searchQuery,
  onSearchChange,
}: UserListProps) {
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u._id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-4 border-b border-gray-800">
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all"
        />
      </div>

      {/* Stats Bar */}
      <div className="px-4 py-2 border-b border-gray-800/60 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-gray-600">
          {users.filter((u) => u.warningCount > 0).length} flagged
        </span>
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto">
        {filteredUsers.length === 0 ? (
          <div className="p-6 text-center text-gray-600 text-sm">
            No users found
          </div>
        ) : (
          filteredUsers.map((user) => (
            <button
              key={user._id}
              onClick={() => onSelectUser(user)}
              className={`w-full text-left px-4 py-3 border-b border-gray-800/40 transition-all duration-150 hover:bg-gray-800/50 group ${
                selectedUserId === user._id
                  ? 'bg-cyan-950/30 border-l-2 border-l-cyan-400'
                  : 'border-l-2 border-l-transparent'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`font-medium text-sm truncate ${
                  selectedUserId === user._id ? 'text-cyan-300' : 'text-gray-200 group-hover:text-white'
                }`}>
                  {user.name}
                </span>
                {user.warningCount > 0 && (
                  <span className={`flex-shrink-0 ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    user.warningCount >= 3
                      ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
                      : 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30'
                  }`}>
                    {user.warningCount} ⚠
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500 font-mono truncate max-w-[160px]">
                  {user.email || user._id.slice(0, 16) + '...'}
                </span>
                <span className="text-[10px] text-gray-600">
                  {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
