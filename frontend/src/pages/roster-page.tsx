import { useEffect, useState } from 'react';
import { api } from '../api/client';

export function RosterPage() {
  const [classId, setClassId] = useState('1');
  const [roster, setRoster] = useState<{ student_id: number; name: string; seat_no: number }[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setRoster(await api.roster(Number(classId)));
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Roster</h1>
      <div className="flex gap-2">
        <input
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-2 flex-1"
          placeholder="Class ID"
        />
        <button onClick={load} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          Load
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">
        {roster.map((r) => (
          <li key={r.student_id} className="px-4 py-2 flex justify-between">
            <span>{r.name}</span>
            <span className="text-slate-400 text-sm">Seat {r.seat_no}</span>
          </li>
        ))}
        {roster.length === 0 && <li className="px-4 py-3 text-sm text-slate-400">No confirmed students yet.</li>}
      </ul>
    </div>
  );
}
