import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";

// Étape 1 : page provisoire. Le client ne voit que SON commerce, grâce à la
// base de données. Le vrai tableau de bord = étape 2.
export default async function ClientHome() {
  await requireSession("client");
  const supabase = await createClient();
  const { data: commerces } = await supabase.from("businesses").select("nom, secteur, ville");
  const commerce = commerces?.[0];

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-8 flex items-center justify-between"><Logo /><LogoutButton /></header>
      <h1 className="titre apparition mb-1 text-4xl">{commerce?.nom ?? "Votre commerce"}</h1>
      <p className="mb-6 text-sm text-encre-doux">{[commerce?.secteur, commerce?.ville].filter(Boolean).join(" · ")}</p>
      <section className="carte"><p className="text-encre-doux">Votre tableau de bord arrive à l&apos;étape suivante.</p></section>
    </main>
  );
}
