export default function EmptyState({ title, message, action }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center border border-dashed border-border-color bg-bg-elevated/40 p-8 text-center">
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      {message && <p className="mt-2 max-w-md text-sm text-text-secondary">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
