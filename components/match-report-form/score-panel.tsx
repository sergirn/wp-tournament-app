"use client"

import { Button } from "@/components/ui/button"
import { Save, Download, Check } from "lucide-react"
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
    <div className="bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col items-center justify-center p-3 border-x border-primary/20">
      <div className="bg-card/80 backdrop-blur-lg border border-primary/30 shadow-xl rounded-lg p-4 text-center w-full flex-1 flex flex-col justify-between overflow-y-auto scrollbar-thin scrollbar-thumb-primary scrollbar-track-slate-900">
        <div>
          <p className="text-muted-foreground text-xs mb-4 uppercase tracking-widest font-semibold">Marcador</p>
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="text-5xl font-bold sport-gradient-text tracking-tight">{teamAScore}</div>
            <div className="text-3xl font-bold text-muted-foreground">-</div>
            <div className="text-5xl font-bold sport-gradient-text tracking-tight">{teamBScore}</div>
          </div>
        </div>

        <div className="my-4">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Comentarios
          </label>
          <textarea
            value={comments}
            onChange={(e) => onCommentsChange(e.target.value)}
            placeholder="Incidencias y notas"
            className="w-full h-20 p-2 rounded-lg bg-background/40 border border-primary/30 text-foreground text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={loading || !canSave} className="sport-gradient gap-2 h-8 text-xs w-full">
                <Save className="h-3 w-3" />
                Guardar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card/90 backdrop-blur-xl border border-primary/30 shadow-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="gradient-text">Confirmar guardado</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  Estás a punto de guardar el acta del partido con el marcador{" "}
                  <span className="font-bold text-cyan-400">{teamAScore}</span> -{" "}
                  <span className="font-bold text-orange-400">{teamBScore}</span>. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-primary/30">Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onSave} className="sport-gradient gap-2">
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
            className="gap-2 border-primary/30 hover:bg-primary/10 bg-transparent h-8 text-xs w-full"
          >
            <Download className="h-3 w-3" />
            PDF
          </Button>
        </div>
      </div>
    </div>
  )
}
