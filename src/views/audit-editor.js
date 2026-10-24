// Éditeur d'audit (étape 2).
export function renderEditor(root, id, back) { root.innerHTML = `<p class="pro-muted">Éditeur à venir.</p><button class="btn ghost" id="b">Retour</button>`; root.querySelector("#b").onclick = back; }
export function openPreview() {}
