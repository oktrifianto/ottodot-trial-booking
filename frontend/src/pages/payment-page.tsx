import { useState } from 'react';
import { api } from '../api/client';
import { StatusBadge } from '../components/status-badge';

export function PaymentPage({ bookingId, onDone }: { bookingId: number; onDone: () => void }) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function pay(simulate: 'success' | 'fail') {
    setLoading(true);
    setError(null);
    try {
      const key = `${bookingId}-${Date.now()}`; // demo idempotency key
      const result = await api.payBooking(bookingId, key, simulate);
      setStatus(result.status);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Booking #{bookingId}</h1>

      <div className="flex gap-3">
        <button
          onClick={() => pay('success')}
          disabled={loading}
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          Simulate Success
        </button>
        <button
          onClick={() => pay('fail')}
          disabled={loading}
          className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          Simulate Fail
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {status && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Result:</span>
          <StatusBadge status={status} />
        </div>
      )}
      {status === 'cancelled' && (
        <p className="text-sm text-red-600">Sorry, the seat was taken by someone else.</p>
      )}

      <button onClick={onDone} className="text-sm text-blue-600 hover:underline">
        View roster →
      </button>
    </div>
  );
}
