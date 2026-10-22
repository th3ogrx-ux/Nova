import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="apparition mb-8 flex justify-center"><Logo taille={52} /></div>
      <div className="carte apparition p-7 sm:p-8" style={{ animationDelay: ".08s" }}>
        <h1 className="titre mb-1 text-4xl">Connexion</h1>
        <p className="mb-7 text-sm text-encre-doux">Accédez au suivi de votre visibilité Google.</p>
        <LoginForm />
      </div>
      <p className="mt-6 text-center text-xs text-encre-discret">
        Pas de compte ? Votre accès vous est envoyé par votre contact Zenoa.
      </p>
    </main>
  );
}
