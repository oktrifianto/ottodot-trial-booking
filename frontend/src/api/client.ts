const API_URL = import.meta.env.VITE_API_URL;

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  listClasses: () => request('/classes'),
  roster: (classId: number) => request(`/classes/${classId}/roster`),
  createBooking: (studentId: number, classId: number) =>
    request('/bookings', { method: 'POST', body: JSON.stringify({ studentId, classId }) }),
  payBooking: (bookingId: number, idempotencyKey: string, simulate: 'success' | 'fail') =>
    request(`/bookings/${bookingId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ idempotencyKey, simulate }),
    }),
  getBooking: (bookingId: number) => request(`/bookings/${bookingId}`),
};
