"use client"

import { Button } from "@/components/ui/button"
import { Save, Download, Check, MessageSquareText } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface ScorePanelProps {
  teamAScore: number
  teamBScore: number
  comments: string
  onCommentsChange: (comments: string) => void
  onSave: () => void
  onDownloadPDF: () => void
  loading: boolean
  canSave: boolean
}

export function ScorePanel({
  teamAScore,
  teamBScore,
  comments,
  onCommentsChange,
  onSave,
  onDownloadPDF,
  loading,
  canSave,
}: ScorePanelProps) {
  return (
    <aside className="flex min-h-[300px] flex-col border-y bg-muted/10 p-3 md:min-h-0 md:border-y-0">
      <div className="flex h-full w-full flex-col overflow-y-auto rounded-xl border bg-background shadow-sm">
        <div className="p-4 xl:p-5">
          <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Marcador del partido
          </p>

          <div className="flex items-center justify-center gap-3 rounded-xl bg-muted/25 px-3 py-5">
            <div className="min-w-12 text-center text-5xl font-black tracking-tight text-foreground tabular-nums xl:text-6xl">
              {teamAScore}
            </div>
            <div className="text-2xl font-medium text-muted-foreground">—</div>
            <div className="min-w-12 text-center text-5xl font-black tracking-tight text-foreground tabular-nums xl:text-6xl">
              {teamBScore}
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">Se calcula automáticamente con los goles</p>

          <div className="mt-5">
            <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
              <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" />Comentarios del acta
            </label>
            <textarea
              value={comments}
              onChange={(e) => onCommentsChange(e.target.value)}
              placeholder="Incidencias, observaciones o notas…"
              className="h-24 w-full resize-none rounded-lg border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-2 border-t bg-muted/10 p-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={loading || !canSave} className="h-11 w-full gap-2 font-semibold">
                <Save className="h-4 w-4" />
                {loading ? "Guardando…" : "Guardar acta"}
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent className="border-border bg-background shadow-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar acta</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  Vas a guardar definitivamente el acta con el resultado{" "}
                  <span className="font-bold text-foreground">{teamAScore}</span> -{" "}
                  <span className="font-bold text-foreground">{teamBScore}</span>. Comprueba los goles y exclusiones antes de continuar.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onSave} className="gap-2">
                  <Check className="h-4 w-4" />
                  Confirmar y guardar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            onClick={onDownloadPDF}
            variant="outline"
            disabled={!canSave}
            className="h-10 w-full gap-2 bg-transparent text-sm"
          >
            <Download className="h-3 w-3" />
            PDF
          </Button>
        </div>
      </div>
    </aside>
  )
}
