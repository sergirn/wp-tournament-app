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
    <div className="flex flex-col items-center justify-center border-x border-border bg-gradient-to-b from-background to-muted/30 p-3">
      <div className="flex w-full flex-1 flex-col justify-between overflow-y-auto rounded-lg border border-border bg-background shadow-sm scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        <div className="p-4">
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Score
          </p>

          <div className="mb-6 flex items-center justify-center gap-3">
            <div className="text-5xl font-bold tracking-tight text-foreground">
              {teamAScore}
            </div>
            <div className="text-3xl font-bold text-muted-foreground">-</div>
            <div className="text-5xl font-bold tracking-tight text-foreground">
              {teamBScore}
            </div>
          </div>

          <div className="my-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Comments
            </label>
            <textarea
              value={comments}
              onChange={(e) => onCommentsChange(e.target.value)}
              placeholder="Incidents and notes"
              className="h-20 w-full resize-none rounded-lg border border-input bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 p-4 pt-0">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={loading || !canSave} className="h-8 w-full gap-2 text-xs">
                <Save className="h-3 w-3" />
                Save
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent className="border-border bg-background shadow-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm save</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  You are about to save the match report with the score{" "}
                  <span className="font-bold text-foreground">{teamAScore}</span> -{" "}
                  <span className="font-bold text-foreground">{teamBScore}</span>. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onSave} className="gap-2">
                  <Check className="h-4 w-4" />
                  Confirm and save
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            onClick={onDownloadPDF}
            variant="outline"
            disabled={!canSave}
            className="h-8 w-full gap-2 bg-transparent text-xs"
          >
            <Download className="h-3 w-3" />
            PDF
          </Button>
        </div>
      </div>
    </div>
  )
}