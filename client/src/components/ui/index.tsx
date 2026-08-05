import { AlertTriangle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { cx } from "../../lib/format";

/* ------------------------------------------------------------------ Card */

export function Card({
  children, className, as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return <Tag className={cx("card p-5", className)}>{children}</Tag>;
}

export function CardHeader({
  title, subtitle, action, icon,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="mt-0.5 shrink-0 text-muted">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/* ---------------------------------------------------------------- Button */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--series-1)] text-white hover:opacity-90 disabled:opacity-40",
  secondary:
    "bg-surface-2 text-ink border border-hairline hover:bg-surface-3 disabled:opacity-40",
  ghost:
    "text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-40",
  danger:
    "bg-[var(--critical)] text-white hover:opacity-90 disabled:opacity-40",
};

export function Button({
  children, onClick, variant = "secondary", disabled, loading,
  type = "button", className, title, size = "md",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
  className?: string;
  title?: string;
  size?: "sm" | "md";
}) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium",
        "transition-colors disabled:cursor-not-allowed",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm",
        BUTTON_STYLES[variant],
        className,
      )}
    >
      {loading && <Loader2 size={14} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------- Badge */

export function Badge({
  children, color, subtle, icon,
}: {
  children: ReactNode;
  color?: string;
  subtle?: boolean;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5",
        "text-xs font-medium",
        subtle ? "bg-surface-2 text-ink-2" : "text-white",
      )}
      style={subtle ? undefined : { backgroundColor: color ?? "var(--series-1)" }}
    >
      {icon}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------- Stat tile */

export function Stat({
  label, value, unit, hint, accent, tone,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  accent?: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const toneColor =
    tone === "good" ? "var(--success-text)"
      : tone === "bad" ? "var(--critical)"
        : undefined;

  return (
    <div className="card p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p
        className="mt-1.5 text-2xl font-semibold leading-none"
        style={{ color: toneColor ?? accent ?? "var(--ink)" }}
      >
        {value}
        {unit && (
          <span className="ml-1 text-sm font-normal text-ink-2">{unit}</span>
        )}
      </p>
      {hint && <p className="mt-1.5 text-xs text-ink-2">{hint}</p>}
    </div>
  );
}

/* ----------------------------------------------------------- Field/Input */

export function Field({
  label, hint, htmlFor, children, error,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 flex items-baseline justify-between gap-2"
      >
        <span className="text-xs font-medium text-ink">{label}</span>
        {hint && <span className="text-[11px] text-muted">{hint}</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-[11px] text-[var(--critical)]">{error}</p>
      )}
    </div>
  );
}

export function Select({
  value, onChange, options, id, className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  id?: string;
  className?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cx(
        "w-full rounded-md border border-hairline bg-surface px-3 py-2",
        "text-sm text-ink transition-colors hover:border-hairline-strong",
        className,
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function NumberInput({
  value, onChange, min, max, step, id, suffix,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  id?: string;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!Number.isNaN(next)) onChange(next);
        }}
        className={cx(
          "tabular w-full rounded-md border border-hairline bg-surface",
          "px-3 py-2 text-sm text-ink transition-colors hover:border-hairline-strong",
          suffix && "pr-12",
        )}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
          {suffix}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------- State displays */

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-2">
      <Loader2 size={16} className="animate-spin" aria-hidden />
      {label ?? "Loading…"}
    </div>
  );
}

export function ErrorState({
  message, onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-md border p-4"
      style={{
        borderColor: "var(--critical)",
        backgroundColor: "color-mix(in srgb, var(--critical) 8%, transparent)",
      }}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          size={16}
          className="mt-0.5 shrink-0"
          style={{ color: "var(--critical)" }}
          aria-hidden
        />
        <p className="text-sm text-ink">{message}</p>
      </div>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title, description, action, icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-2">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-md", className)} />;
}

/* --------------------------------------------------------------- Legend */

export function Legend({
  items,
}: {
  items: { label: string; color: string; dashed?: boolean }[];
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-0.5 w-4 rounded-full"
            style={{
              backgroundColor: item.dashed ? "transparent" : item.color,
              borderTop: item.dashed ? `2px dashed ${item.color}` : undefined,
            }}
          />
          <span className="text-[11px] text-ink-2">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
