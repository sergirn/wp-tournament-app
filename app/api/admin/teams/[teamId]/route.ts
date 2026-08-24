import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGlobalAdmin } from "@/lib/admin-authorization"

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  logoUrl: z.string().trim().url().or(z.literal("")),
  players: z.array(z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(2).max(100), capNumber: z.number().int().min(1).max(99) })).max(50),
}).refine((value) => new Set(value.players.map((player) => player.capNumber)).size === value.players.length, { message: "Los números de gorro no pueden repetirse" })

export async function PATCH(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params
  const auth = await requireGlobalAdmin()
  if (auth.error) return auth.error
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || !z.string().uuid().safeParse(teamId).success) return NextResponse.json({ error: parsed.success ? "Equipo no válido" : parsed.error.issues[0]?.message }, { status: 400 })
  const { data: currentPlayers } = await auth.admin.from("players").select("id").eq("team_id", teamId)
  const submittedIds = new Set(parsed.data.players.flatMap((player) => player.id ? [player.id] : []))
  const removedIds = (currentPlayers || []).filter((player) => !submittedIds.has(player.id)).map((player) => player.id)
  if (removedIds.length) {
    const { count } = await auth.admin.from("match_events").select("id", { count: "exact", head: true }).in("player_id", removedIds)
    if (count) return NextResponse.json({ error: "No se pueden eliminar jugadores que tengan eventos registrados" }, { status: 409 })
    const { error } = await auth.admin.from("players").delete().in("id", removedIds)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }
  for (const player of parsed.data.players) {
    const result = player.id
      ? await auth.admin.from("players").update({ name: player.name, cap_number: player.capNumber }).eq("id", player.id).eq("team_id", teamId)
      : await auth.admin.from("players").insert({ team_id: teamId, name: player.name, cap_number: player.capNumber })
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 })
  }
  const { data: team, error } = await auth.admin.from("teams").update({ name: parsed.data.name, logo_url: parsed.data.logoUrl || null }).eq("id", teamId).select("id, name, logo_url, players(id, name, cap_number)").single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ team })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params
  const auth = await requireGlobalAdmin()
  if (auth.error) return auth.error
  const { count: matchCount } = await auth.admin.from("matches").select("id", { count: "exact", head: true }).or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
  if (matchCount) return NextResponse.json({ error: "No se puede eliminar un equipo que tenga partidos registrados" }, { status: 409 })
  const { data: players } = await auth.admin.from("players").select("id").eq("team_id", teamId)
  const playerIds = (players || []).map((player) => player.id)
  if (playerIds.length) await auth.admin.from("players").delete().in("id", playerIds)
  await auth.admin.from("group_members").delete().eq("team_id", teamId)
  await auth.admin.from("tournament_teams").delete().eq("team_id", teamId)
  const { error } = await auth.admin.from("teams").delete().eq("id", teamId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
