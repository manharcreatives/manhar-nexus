export function Spinner({ label }: { label?: string }) {
  return (
    <span role={label ? 'status' : undefined} aria-label={label} className="inline-flex">
      <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
    </span>
  );
}
