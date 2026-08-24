import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { z } from "zod"

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Acceso exclusivo para administradores" }, { status: 403 }) }
  }
  return { supabase }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAdmin()
  if (auth.error) return auth.error
  const parsed = z.object({ status: z.enum(["draft", "active", "finished"]) })
    .safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Estado no válido" }, { status: 400 })

  const { data, error } = await auth.supabase.from("tournaments")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, status")
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 })
  return NextResponse.json({ tournament: data })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const { data: tournament } = await auth.supabase.from("tournaments").select("id").eq("id", id).maybeSingle()
  if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 })

  const [{ data: matches }, { data: groups }, { data: tournamentUsers }] = await Promise.all([
    auth.supabase.from("matches").select("id").eq("tournament_id", id),
    auth.supabase.from("groups").select("id").eq("tournament_id", id),
    auth.supabase.from("tournament_users").select("id").eq("tournament_id", id),
  ])
  const matchIds = matches?.map((match) => match.id) || []
  const groupIds = groups?.map((group) => group.id) || []
  if (matchIds.length > 0) await auth.supabase.from("match_events").delete().in("match_id", matchIds)
  if (groupIds.length > 0) await auth.supabase.from("group_members").delete().in("group_id", groupIds)
  await auth.supabase.from("matches").delete().eq("tournament_id", id)
  await auth.supabase.from("tournament_phases").delete().eq("tournament_id", id)
  await auth.supabase.from("groups").delete().eq("tournament_id", id)
  await auth.supabase.from("tournament_teams").delete().eq("tournament_id", id)
  await auth.supabase.from("tournament_users").delete().eq("tournament_id", id)

  const { data, error } = await auth.supabase.from("tournaments").delete().eq("id", id).select("id").maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: "No se pudo eliminar el torneo" }, { status: 400 })

  const admin = createAdminClient()
  if (admin && tournamentUsers) {
    await Promise.allSettled(tournamentUsers.map((member) => admin.auth.admin.deleteUser(member.id)))
  }
  return NextResponse.json({ success: true })
}
