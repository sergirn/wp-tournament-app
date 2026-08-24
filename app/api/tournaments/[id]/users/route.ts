import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

const userSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
})

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Acceso exclusivo para administradores" }, { status: 403 }) }
  }
  return { supabase }
}

function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const parsed = userSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Nombre, email o contraseña no válidos" }, { status: 400 })

  const supabaseAdmin = getAdminClient()
  if (!supabaseAdmin) return NextResponse.json({ error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 })

  const { name, email, password } = parsed.data
  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  })
  if (createError || !newUser.user) {
    return NextResponse.json({ error: createError?.message || "No se pudo crear el usuario" }, { status: 400 })
  }

  const { data: tournamentUser, error: insertError } = await auth.supabase
    .from("tournament_users")
    .insert({ id: newUser.user.id, tournament_id: id, name, email, password_hash: "managed_by_supabase_auth" })
    .select("id, name, email, created_at")
    .single()
  if (insertError) {
    await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
    return NextResponse.json({ error: insertError.message }, { status: 400 })
  }

  return NextResponse.json({ user: tournamentUser }, { status: 201 })
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const { data: users, error } = await auth.supabase
    .from("tournament_users")
    .select("id, name, email, created_at")
    .eq("tournament_id", id)
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ users })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const body = await request.json().catch(() => null) as { userId?: string } | null
  const userId = z.string().uuid().safeParse(body?.userId)
  if (!userId.success) return NextResponse.json({ error: "Usuario no válido" }, { status: 400 })

  const { data: membership } = await auth.supabase
    .from("tournament_users")
    .select("id")
    .eq("id", userId.data)
    .eq("tournament_id", id)
    .maybeSingle()
  if (!membership) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })

  const supabaseAdmin = getAdminClient()
  if (!supabaseAdmin) return NextResponse.json({ error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 })

  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId.data)
  if (authDeleteError) return NextResponse.json({ error: authDeleteError.message }, { status: 400 })

  const { error: membershipError } = await auth.supabase
    .from("tournament_users")
    .delete()
    .eq("id", userId.data)
    .eq("tournament_id", id)
  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
