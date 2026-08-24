import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGlobalAdmin } from "@/lib/admin-authorization"

const schema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email().transform((value) => value.toLowerCase()), password: z.string().min(8).max(128), role: z.enum(["admin", "user"]) })

export async function POST(request: Request) {
  const auth = await requireGlobalAdmin()
  if (auth.error) return auth.error
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Nombre, email, contraseña o rol no válidos" }, { status: 400 })
  const { data, error } = await auth.admin.auth.admin.createUser({ email: parsed.data.email, password: parsed.data.password, email_confirm: true, user_metadata: { full_name: parsed.data.name } })
  if (error || !data.user) return NextResponse.json({ error: error?.message || "No se pudo crear el usuario" }, { status: 400 })
  const { data: profile, error: profileError } = await auth.admin.from("profiles").upsert({ id: data.user.id, email: parsed.data.email, full_name: parsed.data.name, role: parsed.data.role }, { onConflict: "id" }).select("id, email, full_name, role, created_at").single()
  if (profileError) {
    await auth.admin.auth.admin.deleteUser(data.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }
  return NextResponse.json({ user: profile }, { status: 201 })
}
