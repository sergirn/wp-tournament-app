import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGlobalAdmin } from "@/lib/admin-authorization"

const schema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email().transform((value) => value.toLowerCase()), password: z.string().min(8).max(128).optional().or(z.literal("")), role: z.enum(["admin", "user"]) })

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const auth = await requireGlobalAdmin()
  if (auth.error) return auth.error
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Datos del usuario no válidos" }, { status: 400 })
  if (userId === auth.user.id && parsed.data.role !== "admin") return NextResponse.json({ error: "No puedes quitarte tu propio rol de administrador" }, { status: 409 })
  const authUpdate: { email: string; password?: string; user_metadata: { full_name: string } } = { email: parsed.data.email, user_metadata: { full_name: parsed.data.name } }
  if (parsed.data.password) authUpdate.password = parsed.data.password
  const { error: authError } = await auth.admin.auth.admin.updateUserById(userId, authUpdate)
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })
  const { data: user, error } = await auth.admin.from("profiles").update({ email: parsed.data.email, full_name: parsed.data.name, role: parsed.data.role }).eq("id", userId).select("id, email, full_name, role, created_at").single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ user })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const auth = await requireGlobalAdmin()
  if (auth.error) return auth.error
  if (userId === auth.user.id) return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 409 })
  await auth.admin.from("matches").update({ created_by: null }).eq("created_by", userId)
  await auth.admin.from("tournaments").update({ created_by: null }).eq("created_by", userId)
  await auth.admin.from("tournament_users").delete().eq("id", userId)
  const { error } = await auth.admin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await auth.admin.from("profiles").delete().eq("id", userId)
  return NextResponse.json({ success: true })
}
