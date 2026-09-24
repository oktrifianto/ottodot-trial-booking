const styles: Record<string, string> = {
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  pending_payment: 'bg-amber-50 text-amber-700 border-amber-200',
  payment_failed: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium border ${styles[status] ?? ''}`}>
      {status}
    </span>
  );
}
