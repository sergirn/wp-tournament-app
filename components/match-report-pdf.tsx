"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface MatchReportPDFProps {
  match: any
  teamAPlayers: any[]
  teamBPlayers: any[]
  className?: string
}

export function MatchReportPDF({ match, teamAPlayers, teamBPlayers, className }: MatchReportPDFProps) {
  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF()

      doc.setFontSize(20)
      doc.text("ACTA DE PARTIDO - WATERPOLO", 105, 20, { align: "center" })

      doc.setFontSize(12)
      doc.text(
        new Date(match.match_date).toLocaleDateString("es-ES", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        105,
        30,
        { align: "center" },
      )

      if (match.location) {
        doc.text(`Lugar: ${match.location}`, 105, 37, { align: "center" })
      }

      doc.setFontSize(16)
      doc.text(
        `${match.team_a?.name} ${match.team_a_score || 0} - ${match.team_b_score || 0} ${match.team_b?.name}`,
        105,
        50,
        { align: "center" },
      )

      doc.setFontSize(14)
      doc.text(match.team_a?.name || "Equipo A", 14, 65)
      autoTable(doc, {
        startY: 70,
        head: [["Gorro", "Jugador", "Goles", "Exclusiones"]],
        body: teamAPlayers.map((p) => [p.cap_number, p.name, p.goals, p.exclusions]),
        margin: { left: 14, right: 105 },
        theme: "grid",
        headStyles: { fillColor: [6, 182, 212] },
      })

      const finalY = (doc as any).lastAutoTable.finalY || 70
      doc.text(match.team_b?.name || "Equipo B", 110, 65)
      autoTable(doc, {
        startY: 70,
        head: [["Gorro", "Jugador", "Goles", "Exclusiones"]],
        body: teamBPlayers.map((p) => [p.cap_number, p.name, p.goals, p.exclusions]),
        margin: { left: 110 },
        theme: "grid",
        headStyles: { fillColor: [251, 146, 60] },
      })

      if (match.comments) {
        const commentsY = Math.max(finalY, (doc as any).lastAutoTable.finalY) + 15
        doc.setFontSize(12)
        doc.text("Comentarios:", 14, commentsY)
        doc.setFontSize(10)
        const splitComments = doc.splitTextToSize(match.comments, 180)
        doc.text(splitComments, 14, commentsY + 7)
      }

      doc.save(`acta-${match.team_a?.name}-vs-${match.team_b?.name}-${new Date().toISOString().split("T")[0]}.pdf`)
    } catch (error) {
      console.error("[v0] Error generando PDF:", error)
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleDownloadPDF} className={className || "gap-2"}>
      <Download className="h-4 w-4" />
      Exportar PDF
    </Button>
  )
}
