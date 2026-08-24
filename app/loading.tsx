export default function Loading() {
  return (
    <main className="container mx-auto space-y-6 px-4 py-8" aria-busy="true" aria-label="Cargando contenido">
      <div className="h-10 w-72 max-w-full animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-48 animate-pulse rounded-2xl border border-border bg-muted/50" />
        ))}
      </div>
    </main>
  )
}
