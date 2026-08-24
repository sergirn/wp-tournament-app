import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function requireGlobalAdmin() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "admin") return { error: NextResponse.json({ error: "Acceso exclusivo para administradores" }, { status: 403 }) }
  const admin = createAdminClient()
  if (!admin) return { error: NextResponse.json({ error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 }) }
  return { admin, user }
}
