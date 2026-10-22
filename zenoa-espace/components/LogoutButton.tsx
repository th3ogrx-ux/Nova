import { signOut } from "@/app/actions";

export function LogoutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="bouton-discret">Se déconnecter</button>
    </form>
  );
}
