// Publication d'audit (étape 3).
export const publishError = () => "Action impossible pour le moment.";
export async function unpublish() { throw new Error("pas encore installé"); }
export function openPublishDialog() { window.alert("La publication arrive à l'étape suivante."); }
