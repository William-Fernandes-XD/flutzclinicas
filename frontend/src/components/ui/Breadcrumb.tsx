import { Link } from "react-router-dom";

export function Breadcrumb({ items }: { items: { to?: string; label: string }[] }) {
  return (
    <nav aria-label="Trilha" className="mb-4 text-sm text-muted">
      <ol className="flex min-w-0 flex-wrap items-center gap-1">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
            {index > 0 ? <span aria-hidden>/</span> : null}
            {item.to ? (
              <Link to={item.to} className="truncate hover:text-brand">
                {item.label}
              </Link>
            ) : (
              <span className="truncate text-ink dark:text-zinc-200">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
