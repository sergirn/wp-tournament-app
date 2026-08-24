import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { AdminSettings } from "@/components/admin-settings"
import { DashboardNavbar } from "@/components/dashboard-navbar"

export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "admin") redirect("/")
  const admin = createAdminClient()
  if (!admin) throw new Error("Falta configurar SUPABASE_SERVICE_ROLE_KEY")

  const [{ data: teams }, { data: profiles }, authUsers] = await Promise.all([
    admin.from("teams").select("id, name, logo_url, players(id, name, cap_number)").order("name"),
    admin.from("profiles").select("id, email, full_name, role, created_at").order("created_at", { ascending: false }),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])
  const authMap = new Map((authUsers.data.users || []).map((item) => [item.id, item]))
  const users = (profiles || []).map((item) => ({ ...item, email: authMap.get(item.id)?.email || item.email }))

  return <div className="min-h-screen bg-background"><DashboardNavbar email={user.email || "Administrador"} isAdmin /><AdminSettings initialTeams={teams || []} initialUsers={users} currentUserId={user.id} /></div>
}

export const dynamic = "force-dynamic"
