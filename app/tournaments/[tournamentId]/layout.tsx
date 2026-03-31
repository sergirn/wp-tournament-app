import type React from "react"
import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { TournamentNav } from "@/components/tournament-nav"

export default async function TournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tournamentId: string }>
}) {
  const { tournamentId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: tournament } = await supabase.from("tournaments").select("*").eq("id", tournamentId).single()

  if (!tournament) {
    notFound()
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  const isAdmin = profile?.role === "admin"

  return (
    <div
      className="min-h-screen bg-background relative"
      style={{
        backgroundImage: "url('/images/2.png')",
        backgroundAttachment: "fixed",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-background/80" />
      <div className="relative z-10">
        <TournamentNav tournament={tournament} isAdmin={isAdmin} />
        {children}
      </div>
    </div>
  )
}
