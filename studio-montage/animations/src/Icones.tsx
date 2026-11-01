import React from "react";

export type IconeNom =
  | "play" | "flask" | "users" | "trend" | "target" | "trophy" | "tag" | "clipboard"
  | "gift" | "eye" | "heart" | "bolt" | "star" | "chat" | "check";

const TRACES: Record<IconeNom, React.ReactNode> = {
  play: <path d="M8 5v14l11-7z" />,
  flask: (<><path d="M9 3h6" /><path d="M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" /><path d="M8 15h8" /></>),
  users: (<><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.5 0 4.5 2 4.5 4.5" /></>),
  trend: (<><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>),
  target: (<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>),
  trophy: (<><path d="M8 21h8M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" /></>),
  tag: (<><path d="M3 12V4h8l10 10-8 8L3 12z" /><circle cx="7.5" cy="8.5" r="1.3" /></>),
  clipboard: (<><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v3H9z" /><path d="M9 14l2.2 2.2L15.5 12" /></>),
  gift: (<><rect x="3" y="8" width="18" height="4" /><path d="M5 12v9h14v-9M12 8v13" /><path d="M12 8H8a2.2 2.2 0 1 1 0-4.4C11 3.6 12 8 12 8zM12 8h4a2.2 2.2 0 1 0 0-4.4C13 3.6 12 8 12 8z" /></>),
  eye: (<><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>),
  heart: <path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" />,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  star: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
};

/** Icône en trait (24×24), de la couleur voulue. */
export const Icone: React.FC<{ nom: IconeNom; size?: number; color?: string; epaisseur?: number }> = ({
  nom,
  size = 48,
  color = "#111",
  epaisseur = 1.9,
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={epaisseur} strokeLinecap="round" strokeLinejoin="round">
    {TRACES[nom]}
  </svg>
);
