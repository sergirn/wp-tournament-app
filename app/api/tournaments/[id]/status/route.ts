import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { status } = await request.json()

    const supabase = await createClient()

    // Verificar autenticación
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    // Verificar que el usuario sea admin
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Solo administradores pueden cambiar el estado del torneo" }, { status: 403 })
    }

    // Validar el nuevo estado
    if (!["active", "finished", "draft"].includes(status)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 })
    }

    // Actualizar el estado del torneo
    const { error } = await supabase
      .from("tournaments")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) {
      console.error("Error updating tournament status:", error)
      return NextResponse.json({ error: "Error al actualizar el estado del torneo" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in PATCH /api/tournaments/[id]/status:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
