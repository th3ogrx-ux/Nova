// Audits : modèles prêts à l'emploi (le contenu est un point de départ, tout se modifie ensuite) et modèles personnels.
import { supabase } from "../supabase.js";
import { newId, AUDIT_COLS, createAudit } from "./audits-data.js";

const b = (type, props = {}) => ({ id: newId(), type, ...props });
const title = (text, sub = "") => b("title", { text, sub });
const text = (html) => b("text", { html });
const recos = (items) => b("recos", { items: items.map(([priority, t]) => ({ priority, text: t })) });
const score = (label, value, comment = "") => b("score", { label, value, comment });
const table = (rows) => b("table", { header: true, rows });
const page = (t, blocks) => ({ id: newId(), title: t, blocks });
const intro = (what) => text(`<p>Bonjour, voici l'audit ${what}. Il présente l'état actuel, les points forts, ce qui vous fait perdre des clients et les actions à mener, classées par priorité.</p>`);
const closing = () => [b("separator"), b("quote", { style: "callout", text: "Je peux m'occuper de tout cela pour vous. Parlons-en lors d'un appel de 15 minutes.", author: "" }), b("cta", { label: "Prendre rendez-vous", url: "" })];

export const BUILTIN_TEMPLATES = [
  { key: "blank", label: "Vierge", hint: "Une page vide", content: () => ({ pages: [page("Page 1", [])] }) },
  { key: "seo", label: "Audit SEO", hint: "Visibilité sur Google, mots-clés, technique", content: () => ({ pages: [
    page("Résumé", [intro("SEO de votre site"), score("Score SEO global", 50, "À ajuster selon votre analyse."), recos([["high", "Corriger les titres et descriptions des pages principales"], ["medium", "Cibler 5 mots-clés locaux"], ["low", "Ajouter des liens internes"]])]),
    page("Analyse détaillée", [title("Visibilité sur Google", "Position sur les recherches locales"), table([["Mot-clé", "Position", "Remarque"], ["", "", ""], ["", "", ""]]), title("Technique", "Vitesse, mobile, sécurité"), score("Vitesse mobile", 50), b("chart", { kind: "bar", title: "Trafic mensuel", points: [{ label: "Mois 1", value: "" }, { label: "Mois 2", value: "" }, { label: "Mois 3", value: "" }] })]),
    page("Plan d'action", [recos([["high", ""], ["medium", ""]]), ...closing()])] }) },
  { key: "ads", label: "Audit publicité", hint: "Campagnes, budget, résultats", content: () => ({ pages: [
    page("Résumé", [intro("de vos campagnes publicitaires"), score("Efficacité des campagnes", 50), recos([["high", "Revoir le ciblage des annonces"], ["medium", "Tester 2 nouveaux visuels"], ["low", "Mettre en place le suivi des appels"]])]),
    page("Résultats", [table([["Campagne", "Budget", "Résultats", "Coût par contact"], ["", "", "", ""], ["", "", "", ""]]), b("chart", { kind: "line", title: "Contacts générés par semaine", points: [{ label: "S1", value: "" }, { label: "S2", value: "" }, { label: "S3", value: "" }, { label: "S4", value: "" }] })]),
    page("Plan d'action", [recos([["high", ""], ["medium", ""]]), ...closing()])] }) },
  { key: "site", label: "Audit de site web", hint: "Design, contenu, performance, conversion", content: () => ({ pages: [
    page("Résumé", [intro("de votre site web"), score("Note globale", 50), recos([["high", "Rendre le numéro de téléphone visible dès l'arrivée"], ["medium", "Ajouter des avis clients"], ["low", "Optimiser les images"]])]),
    page("Analyse", [title("Première impression", "Ce que voit un visiteur en 5 secondes"), b("annotated", { path: null, caption: "", notes: [] }), title("Mobile et vitesse"), score("Vitesse", 50), score("Confort sur mobile", 50), title("Contenu et conversion"), text("<p>Points forts :</p><ul><li></li></ul><p>Points à améliorer :</p><ul><li></li></ul>")]),
    page("Plan d'action", [recos([["high", ""], ["medium", ""]]), ...closing()])] }) },
  { key: "social", label: "Audit réseaux sociaux", hint: "Régularité, contenu, communauté", content: () => ({ pages: [
    page("Résumé", [intro("de vos réseaux sociaux"), score("Présence en ligne", 50), recos([["high", "Publier 3 fois par semaine"], ["medium", "Harmoniser la photo et la bio"], ["low", "Répondre aux commentaires sous 24 h"]])]),
    page("Analyse", [table([["Réseau", "Abonnés", "Publications / mois", "Engagement"], ["Instagram", "", "", ""], ["Facebook", "", "", ""], ["TikTok", "", "", ""]]), b("chart", { kind: "bar", title: "Abonnés par réseau", points: [{ label: "Instagram", value: "" }, { label: "Facebook", value: "" }, { label: "TikTok", value: "" }] }), b("gallery", { items: [] })]),
    page("Plan d'action", [recos([["high", ""], ["medium", ""]]), ...closing()])] }) }
];

export async function listCustomTemplates() {
  const { data, error } = await supabase.from("audits").select("id,title,content").eq("is_template", true).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function saveAsTemplate(audit, name, content) {
  return createAudit({ title: name, client_name: null, content, is_template: true, template_kind: "custom" });
}
export async function deleteTemplate(id) {
  const { error } = await supabase.from("audits").delete().eq("id", id).eq("is_template", true);
  if (error) throw error;
}
// Copie le contenu d'un modèle en donnant de nouveaux identifiants à chaque page et bloc.
export function freshContent(content) {
  const c = JSON.parse(JSON.stringify(content));
  (c.pages || []).forEach((p) => { p.id = newId(); (p.blocks || []).forEach((bl) => { bl.id = newId(); }); });
  return c;
}
