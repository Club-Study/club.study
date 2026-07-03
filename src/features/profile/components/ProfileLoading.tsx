export function ProfileLoading() {
  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="h-8 w-44 rounded-md bg-muted" />
      <div className="h-48 rounded-lg border bg-muted/20" />
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="h-64 rounded-lg border bg-muted/20" />
        <div className="h-64 rounded-lg border bg-muted/20" />
      </div>
    </section>
  );
}
