"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export function TeamLogo({ name, logoUrl, className }: { name?: string | null; logoUrl?: string | null; className?: string }) {
  const initials = name?.trim().slice(0, 2).toUpperCase() || "EQ"
  const normalizedLogoUrl = logoUrl?.trim() || null
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [normalizedLogoUrl])

  return (
    <div className={cn("relative flex size-8 shrink-0 overflow-hidden rounded-full border border-border bg-background", className)}>
      {normalizedLogoUrl && !imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={normalizedLogoUrl}
          alt={`Logo de ${name || "equipo"}`}
          className="size-full object-contain p-1"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="flex size-full items-center justify-center bg-muted/40 text-sm font-bold text-foreground">
          {initials}
        </span>
      )}
    </div>
  )
}
