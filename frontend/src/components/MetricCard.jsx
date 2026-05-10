export default function MetricCard({ label, value, subvalue, tone = 'neutral' }) {
  const toneClass = {
    neutral: 'text-text-primary',
    positive: 'text-accent-green',
    negative: 'text-accent-red',
    blue: 'text-accent-blue',
    amber: 'text-accent-amber',
  }[tone];

  return (
    <section className="surface p-5">
      <p className="label">{label}</p>
      <div className={`mt-3 text-2xl font-semibold tracking-tight tabular-nums ${toneClass}`}>{value}</div>
      {subvalue && <p className="mt-1 text-xs text-text-muted">{subvalue}</p>}
    </section>
  );
}
