"use client";
import { useActionState } from "react";
import { signIn, type LoginState } from "@/app/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="email" className="etiquette">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="champ" placeholder="vous@commerce.fr" />
      </div>
      <div>
        <label htmlFor="password" className="etiquette">Mot de passe</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="champ" />
      </div>
      {state.erreur && (
        <p role="alert" className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent-doux">
          {state.erreur}
        </p>
      )}
      <button type="submit" disabled={pending} className="bouton w-full">
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
