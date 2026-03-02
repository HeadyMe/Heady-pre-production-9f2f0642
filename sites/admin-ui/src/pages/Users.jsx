import React, { useState, useEffect } from 'react';
import { Users as UsersIcon, Shield, Key, Clock } from 'lucide-react';

export default function Users() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch('/api/auth/users').then(r => r.json())
      .then(data => setUsers(data.users || []))
      .catch(() => {
        setUsers([
          { email: 'josh@headyme.com', username: 'josh', tier: 'internal', role: 'admin', lastLogin: '2026-03-02', active: true },
          { email: 'd@headyme.com', username: 'dewayne', tier: 'internal', role: 'user', lastLogin: '2026-03-02', active: true },
        ]);
      });
  }, []);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="rounded-2xl border border-violet-500/30 bg-slate-900/70 p-5">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><UsersIcon className="w-6 h-6 text-violet-300" /> Users</h1>
        <p className="text-slate-400 text-sm mt-1">{users.length} registered users</p>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/70 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">Tier</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Last Login</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.email} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{u.username}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${u.tier === 'internal' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-slate-800 text-slate-400'}`}>
                    {u.tier}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-300 text-xs">{u.role}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{u.lastLogin || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`w-2 h-2 rounded-full inline-block ${u.active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
