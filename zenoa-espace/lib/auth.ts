// Qui est connecté, et avec quel rôle ? (lu via la base, donc non falsifiable)
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "client";
export type Session = { userId: string; email: string; role: Role; businessId: string | null };

// Renvoie la session + le rôle, ou redirige : vers /login si personne n'est
// connecté, vers /compte-inactif si le compte n'a pas de profil (ex. quelqu'un
// qui se serait inscrit seul : sans profil, il n'a accès à rien).
export async function requireSession(expected?: Role): Promise<Session> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, business_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/compte-inactif");

  const session: Session = {
    userId: user.id,
    email: user.email ?? "",
    role: profile.role as Role,
    businessId: profile.business_id,
  };
  if (expected && session.role !== expected) redirect(session.role === "admin" ? "/admin" : "/espace");
  return session;
}
