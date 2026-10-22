// Client Supabase côté SERVEUR : lit la session de l'utilisateur dans les cookies.
// Il utilise la clé publique : c'est donc la base (règles RLS) qui décide de ce
// que l'utilisateur a le droit de voir, pas ce code.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Appelé depuis un composant serveur : le middleware rafraîchit déjà la session.
          }
        },
      },
    },
  );
}
