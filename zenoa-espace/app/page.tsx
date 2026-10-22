import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

// Page d'accueil : n'affiche rien, aiguille chacun vers son espace.
export default async function Home() {
  const session = await requireSession();
  redirect(session.role === "admin" ? "/admin" : "/espace");
}
