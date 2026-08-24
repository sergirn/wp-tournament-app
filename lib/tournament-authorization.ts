import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function authorizeTournamentManager(tournamentId: string) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) }

  const admin = createAdminClient()
  if (!admin) return { error: NextResponse.json({ error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 }) }

  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "admin") {
    const { data: membershipById } = await admin.from("tournament_users").select("id").eq("tournament_id", tournamentId).eq("id", user.id).maybeSingle()
    const { data: membershipByEmail } = user.email
      ? await admin.from("tournament_users").select("id").eq("tournament_id", tournamentId).eq("email", user.email.toLowerCase()).maybeSingle()
      : { data: null }
    if (!membershipById && !membershipByEmail) {
      return { error: NextResponse.json({ error: "No tienes permiso para configurar este torneo" }, { status: 403 }) }
    }
  }

  return { admin, user }
}
