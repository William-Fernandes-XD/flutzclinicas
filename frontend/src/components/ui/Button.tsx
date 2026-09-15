import { useEffect, useRef, useState, type ButtonHTMLAttributes, type MouseEvent, type MouseEventHandler, type ReactNode } from "react";
import { Link } from "react-router-dom";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

type SharedProps = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  busy?: boolean;
  busyLabel?: string;
};

type ButtonAsButton = SharedProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof SharedProps | "type"> & {
    type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
    to?: undefined;
    href?: undefined;
  };

type ButtonAsLink = SharedProps & {
  to: string;
  href?: undefined;
};

type ButtonAsAnchor = SharedProps & {
  href: string;
  to?: undefined;
  target?: string;
  rel?: string;
};

export type ButtonProps = ButtonAsButton | ButtonAsLink | ButtonAsAnchor;

const variantClass: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-sm hover:bg-brand-hover dark:bg-brand dark:text-white dark:hover:bg-brand-hover",
  secondary:
    "border border-line bg-white text-ink hover:border-brand/40 hover:bg-brand-soft dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
  ghost: "text-ink hover:bg-brand-soft dark:text-zinc-100 dark:hover:bg-zinc-800",
};

const sizeClass: Record<Size, string> = {
  md: "min-h-10 px-4 text-sm",
  lg: "min-h-12 px-6 text-base",
};

function classes(variant: Variant, size: Size, className?: string): string {
  return [
    "inline-flex max-w-full min-w-0 items-center justify-center gap-2 rounded-xl font-semibold break-words transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    variantClass[variant],
    sizeClass[size],
    className ?? "",
  ].join(" ");
}

export function Button(props: ButtonProps) {
  const { children, variant = "primary", size = "md", className, onClick } = props;
  const classNames = classes(variant, size, className);

  if ("to" in props && props.to) {
    return (
      <Link to={props.to} className={classNames} onClick={onClick}>
        {children}
      </Link>
    );
  }

  if ("href" in props && props.href) {
    return (
      <a href={props.href} target={props.target} rel={props.rel} className={classNames} onClick={onClick}>
        {children}
      </a>
    );
  }

  const buttonProps = props as ButtonAsButton;
  const {
    busy: parentBusyProp,
    busyLabel,
    type,
    disabled,
    children: _children,
    variant: _variant,
    size: _size,
    className: _className,
    onClick: _onClick,
    ...rest
  } = buttonProps;
  const [localBusy, setLocalBusy] = useState(false);
  const lockRef = useRef(false);
  const parentBusyRef = useRef(false);
  const parentBusy = Boolean(parentBusyProp);
  const isSubmit = type === "submit";
  parentBusyRef.current = parentBusy;
  const busy = parentBusy || (!isSubmit && localBusy);
  const label = busy && busyLabel ? busyLabel : children;

  useEffect(() => {
    if (parentBusy) {
      lockRef.current = true;
      setLocalBusy(true);
      return;
    }
    lockRef.current = false;
    setLocalBusy(false);
  }, [parentBusy]);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (buttonProps.disabled || parentBusy) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    // Submit precisa disparar o form. Desabilitar no clique cancela o envio no navegador.
    if (isSubmit) {
      onClick?.(event);
      return;
    }
    if (lockRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (parentBusyProp !== undefined) {
      lockRef.current = true;
      setLocalBusy(true);
      window.setTimeout(() => {
        if (!parentBusyRef.current) {
          lockRef.current = false;
          setLocalBusy(false);
        }
      }, 400);
    }
    onClick?.(event);
  }

  return (
    <button
      {...rest}
      type={type ?? "button"}
      className={classNames}
      onClick={handleClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {label}
    </button>
  );
}
