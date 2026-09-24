import { useEffect, useState } from 'react';
import { api } from '../api/client';

type ClassRow = { id: number; title: string; starts_at: string; capacity: number; seats_left: number };

// Hardcoded student picker for demo purposes — this take-home has no
// auth, so students come straight from the seed data via a simple
// text input for the student id (see README: "what I deliberately cut").
export function BookingPage({ onBooked }: { onBooked: (bookingId: number) => void }) {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.listClasses().then(setClasses).catch((e) => setError(e.message));
  }, []);

  async function book(classId: number) {
    setError(null);
    if (!studentId) {
      setError('Enter a student id (see seed output in your terminal).');
      return;
    }
    setLoading(true);
    try {
      const booking = await api.createBooking(Number(studentId), classId);
      onBooked(booking.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Trial Booking</h1>

      <div>
        <label className="block text-sm text-slate-600 mb-1">Student ID</label>
        <input
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          placeholder="e.g. 1"
          className="border border-slate-300 rounded-md px-3 py-2 w-full"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {classes.map((c) => (
          <div
            key={c.id}
            className="bg-white border border-slate-200 rounded-lg p-4 flex justify-between items-center"
          >
            <div>
              <p className="font-medium text-slate-900">{c.title}</p>
              <p className="text-sm text-slate-500">
                Seats left: {c.seats_left}/{c.capacity}
              </p>
            </div>
            <button
              disabled={c.seats_left <= 0 || loading}
              onClick={() => book(c.id)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-blue-700"
            >
              {c.seats_left <= 0 ? 'Full' : 'Book'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
