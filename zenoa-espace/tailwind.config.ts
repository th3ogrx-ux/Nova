import type { Config } from "tailwindcss";

// Couleurs et polices de la marque Zenoa : tout le design part d'ici.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        fond: "#0A0A0B", // noir mat
        carte: "#111113", // surface des cartes
        trait: "#26211F", // bordures fines
        accent: { DEFAULT: "#FF2A2A", doux: "#FF6B6B", sombre: "#B31212" }, // rouge néon
        encre: { DEFAULT: "#F2EEEA", doux: "#BDB4AE", discret: "#8C827C" }, // blanc cassé + gris chauds
      },
      fontFamily: {
        titre: ["var(--font-titre)", "Impact", "sans-serif"], // condensé, majuscules
        texte: ["var(--font-texte)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        halo: "0 0 0 1px rgba(255,42,42,.35), 0 0 28px -4px rgba(255,42,42,.35)",
      },
    },
  },
  plugins: [],
};

export default config;
