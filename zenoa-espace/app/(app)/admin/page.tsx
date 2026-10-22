import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";

// Étape 1 : page provisoire. Elle prouve que la connexion et la sécurité
// fonctionnent (l'admin voit TOUS les commerces). Le vrai espace admin = étape 5.
export default async function AdminHome() {
  const session = await requireSession("admin");
  const supabase = await createClient();
  const { data: commerces } = await supabase.from("businesses").select("id, nom, ville").order("nom");

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-8 flex items-center justify-between"><Logo /><LogoutButton /></header>
      <h1 className="titre apparition mb-1 text-4xl">Espace admin</h1>
      <p className="mb-6 text-sm text-encre-doux">Connecté : {session.email}</p>
      <section className="carte">
        <h2 className="etiquette">Commerces visibles ({commerces?.length ?? 0})</h2>
        <ul className="divide-y divide-trait">
          {(commerces ?? []).map((c) => (
            <li key={c.id} className="py-3">{c.nom} <span className="text-encre-discret">— {c.ville}</span></li>
          ))}
          {!commerces?.length && <li className="py-3 text-encre-discret">Aucun commerce pour l&apos;instant.</li>}
        </ul>
      </section>
    </main>
  );
}
