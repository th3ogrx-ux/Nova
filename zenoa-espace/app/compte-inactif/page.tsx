import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";

export default function CompteInactif() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 text-center">
      <div className="flex justify-center"><Logo taille={52} /></div>
      <div className="carte">
        <h1 className="titre mb-2 text-3xl">Compte non activé</h1>
        <p className="mb-6 text-sm text-encre-doux">
          Ce compte n&apos;est rattaché à aucun commerce. Contactez Zenoa pour obtenir votre accès.
        </p>
        <LogoutButton />
      </div>
    </main>
  );
}
