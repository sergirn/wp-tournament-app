import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGlobalAdmin } from "@/lib/admin-authorization"

const teamSchema = z.object({
  name: z.string().trim().min(2).max(100),
  logoUrl: z.string().trim().url().or(z.literal("")).default(""),
  players: z.array(z.object({ name: z.string().trim().min(2).max(100), capNumber: z.number().int().min(1).max(99) })).max(50),
}).refine((value) => new Set(value.players.map((player) => player.capNumber)).size === value.players.length, { message: "Los números de gorro no pueden repetirse" })

export async function POST(request: Request) {
  const auth = await requireGlobalAdmin()
  if (auth.error) return auth.error
  const parsed = teamSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos del equipo no válidos" }, { status: 400 })
  const { data: team, error } = await auth.admin.from("teams").insert({ name: parsed.data.name, logo_url: parsed.data.logoUrl || null }).select("id, name, logo_url").single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (parsed.data.players.length) {
    const { data: players, error: playersError } = await auth.admin.from("players").insert(parsed.data.players.map((player) => ({ team_id: team.id, name: player.name, cap_number: player.capNumber }))).select("id, name, cap_number")
    if (playersError) {
      await auth.admin.from("teams").delete().eq("id", team.id)
      return NextResponse.json({ error: playersError.message }, { status: 400 })
    }
    return NextResponse.json({ team: { ...team, players } }, { status: 201 })
  }
  return NextResponse.json({ team: { ...team, players: [] } }, { status: 201 })
}
