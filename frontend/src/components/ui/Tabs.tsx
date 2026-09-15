export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (value: T) => void;
  items: { id: T; label: string }[];
}) {
  return (
    <div className="flex min-w-0 flex-wrap gap-2" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            value === item.id ? "bg-brand text-white" : "bg-white text-muted ring-1 ring-line dark:bg-zinc-900"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
