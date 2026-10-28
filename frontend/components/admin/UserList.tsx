'use client';

import { Search, TriangleAlert } from 'lucide-react';
import { User } from '@/lib/adminApi';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

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
  const flagged = users.filter((u) => u.warningCount > 0).length;

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <div className="mt-2 flex justify-between px-1 text-[12px] text-subtle-foreground">
          <span>
            {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
          </span>
          {flagged > 0 && <span>{flagged} with warnings</span>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filteredUsers.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No users found</p>
        ) : (
          filteredUsers.map((user) => {
            const selected = selectedUserId === user._id;
            return (
              <button
                key={user._id}
                onClick={() => onSelectUser(user)}
                className={cn(
                  'mb-0.5 flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors',
                  selected ? 'bg-secondary' : 'hover:bg-muted',
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-[11px] font-medium text-muted-foreground">
                  {user.name[0]?.toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className={cn('truncate text-[13px] font-medium', selected ? 'text-foreground' : 'text-foreground/90')}>
                      {user.name}
                    </span>
                    {user.banned && <Badge tone="danger">banned</Badge>}
                    {user.warningCount > 0 && (
                      <Badge tone={user.warningCount >= 3 ? 'danger' : 'warning'}><TriangleAlert className="size-3" />{user.warningCount}</Badge>
                    )}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-subtle-foreground">
                    {user.email || user._id}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
