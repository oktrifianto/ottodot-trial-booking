import { useState } from 'react';
import { BookingPage } from './pages/booking-page';
import { PaymentPage } from './pages/payment-page';
import { RosterPage } from './pages/roster-page';

type Page = 'booking' | 'payment' | 'roster';

// No router — 3 simple pages, state-based navigation is enough for
// this demo (see README: "what I deliberately cut").
export default function App() {
  const [page, setPage] = useState<Page>('booking');
  const [activeBookingId, setActiveBookingId] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b border-slate-200 bg-white px-6 py-3 flex gap-4">
        <button onClick={() => setPage('booking')} className="text-sm font-medium text-slate-700 hover:text-blue-600">
          Booking
        </button>
        <button onClick={() => setPage('roster')} className="text-sm font-medium text-slate-700 hover:text-blue-600">
          Roster
        </button>
      </nav>

      {page === 'booking' && (
        <BookingPage
          onBooked={(id) => {
            setActiveBookingId(id);
            setPage('payment');
          }}
        />
      )}
      {page === 'payment' && activeBookingId && (
        <PaymentPage bookingId={activeBookingId} onDone={() => setPage('roster')} />
      )}
      {page === 'roster' && <RosterPage />}
    </div>
  );
}
