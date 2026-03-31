import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "No autorizado - Solo admins pueden crear usuarios" }, { status: 403 })
    }

    const body = await request.json()
    const { name, email, password } = body

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 })
    }

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
      },
    })

    if (createError) {
      console.error("[v0] Error creating user:", createError.message)
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    if (!newUser.user) {
      return NextResponse.json({ error: "No se pudo crear el usuario" }, { status: 400 })
    }

    const { data: tournamentUser, error: insertError } = await supabase
      .from("tournament_users")
      .insert({
        id: newUser.user.id,
        tournament_id: params.id,
        name,
        email,
        password_hash: "managed_by_supabase_auth", // Placeholder ya que Auth gestiona las contraseñas
      })
      .select()
      .single()

    if (insertError) {
      console.error("[v0] Error inserting tournament user:", insertError.message)
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    return NextResponse.json({ user: tournamentUser }, { status: 201 })
  } catch (error) {
    console.error("[v0] Error in POST /api/tournaments/[id]/users:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { data: users, error } = await supabase
      .from("tournament_users")
      .select("*")
      .eq("tournament_id", params.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ users }, { status: 200 })
  } catch (error) {
    console.error("[v0] Error in GET /api/tournaments/[id]/users:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
