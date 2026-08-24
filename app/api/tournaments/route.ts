import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"

const groupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  orderNumber: z.number().int().positive(),
  teamIds: z.array(z.string().uuid()).min(1),
})

const tournamentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(["league", "groups"]),
  teamIds: z.array(z.string().uuid()).min(2),
  groups: z.array(groupSchema).default([]),
})

function databaseErrorMessage(message: string) {
  if (message.includes("phase_id") && message.includes("schema cache")) {
    return "Falta aplicar la migración de la segunda fase de grupos en Supabase. Ejecuta supabase/migrations/20260824_second_group_stage.sql y recarga el esquema."
  }
  return message
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const parsed = tournamentSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos del torneo no válidos", details: parsed.error.flatten() }, { status: 400 })
  }

  const { name, type, teamIds, groups } = parsed.data
  if (new Set(teamIds).size !== teamIds.length) {
    return NextResponse.json({ error: "No se permiten equipos duplicados" }, { status: 400 })
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Solo un administrador puede crear torneos" }, { status: 403 })
  }

  if (type === "groups") {
    const assignedIds = groups.flatMap((group) => group.teamIds)
    const validAssignment = assignedIds.length === teamIds.length
      && new Set(assignedIds).size === teamIds.length
      && assignedIds.every((teamId) => teamIds.includes(teamId))
    if (!validAssignment) {
      return NextResponse.json({ error: "Cada equipo debe estar asignado exactamente a un grupo" }, { status: 400 })
    }
  }

  const { data: existingTeams, error: teamsLookupError } = await supabase.from("teams").select("id").in("id", teamIds)
  if (teamsLookupError || existingTeams?.length !== teamIds.length) {
    return NextResponse.json({ error: "Uno o más equipos no existen" }, { status: 400 })
  }

  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .insert({ name, type, status: "active", created_by: user.id })
    .select("id")
    .single()
  if (tournamentError) return NextResponse.json({ error: tournamentError.message }, { status: 400 })

  const rollback = async () => {
    const { data: createdGroups } = await supabase.from("groups").select("id").eq("tournament_id", tournament.id)
    const groupIds = createdGroups?.map((group) => group.id) || []
    if (groupIds.length > 0) await supabase.from("group_members").delete().in("group_id", groupIds)
    await supabase.from("groups").delete().eq("tournament_id", tournament.id)
    await supabase.from("tournament_phases").delete().eq("tournament_id", tournament.id)
    await supabase.from("tournament_teams").delete().eq("tournament_id", tournament.id)
    await supabase.from("tournaments").delete().eq("id", tournament.id)
  }
  const { error: participantsError } = await supabase.from("tournament_teams").insert(
    teamIds.map((teamId) => ({ tournament_id: tournament.id, team_id: teamId })),
  )
  if (participantsError) {
    await rollback()
    return NextResponse.json({ error: participantsError.message }, { status: 400 })
  }

  if (type === "groups") {
    const { error: formatError } = await supabase.from("tournament_format_config").insert({ tournament_id: tournament.id, progression_mode: "direct_knockout", qualifiers_from_first_phase: 2, configured_by: user.id })
    if (formatError) {
      await rollback()
      return NextResponse.json({ error: formatError.message }, { status: 400 })
    }
    const { data: groupPhase, error: phaseError } = await supabase.from("tournament_phases").insert({ tournament_id: tournament.id, name: "Fase de grupos 1", phase_order: 1, phase_type: "group", locked: false }).select("id").single()
    if (phaseError || !groupPhase) {
      await rollback()
      return NextResponse.json({ error: phaseError ? databaseErrorMessage(phaseError.message) : "No se pudo crear la fase de grupos" }, { status: 400 })
    }
    for (const group of groups) {
      const { data: createdGroup, error: groupError } = await supabase
        .from("groups")
        .insert({ tournament_id: tournament.id, phase_id: groupPhase.id, name: group.name, order_number: group.orderNumber })
        .select("id")
        .single()
      if (groupError) {
        await rollback()
        return NextResponse.json({ error: databaseErrorMessage(groupError.message) }, { status: 400 })
      }
      const { error: membersError } = await supabase.from("group_members").insert(
        group.teamIds.map((teamId) => ({ group_id: createdGroup.id, team_id: teamId })),
      )
      if (membersError) {
        await rollback()
        return NextResponse.json({ error: membersError.message }, { status: 400 })
      }
    }
  }

  return NextResponse.json({ tournamentId: tournament.id }, { status: 201 })
}
