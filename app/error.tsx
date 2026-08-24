"use client"

import { Button } from "@/components/ui/button"

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="container mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold">No se pudo cargar esta página</h1>
      <p className="mt-2 text-muted-foreground">Ha ocurrido un error inesperado. Puedes volver a intentarlo.</p>
      <Button className="mt-6" onClick={reset}>Reintentar</Button>
    </main>
  )
}
