// Logo Zenoa. Pour le remplacer : remplace simplement le fichier public/logo.png
// (carré, fond transparent de préférence). Rien d'autre à modifier.
import Image from "next/image";

export function Logo({ taille = 36, texte = true }: { taille?: number; texte?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Image src="/logo.png" alt="" width={taille} height={taille} priority />
      {texte && <span className="titre text-2xl leading-none tracking-[.12em] text-encre">Zenoa</span>}
    </span>
  );
}
