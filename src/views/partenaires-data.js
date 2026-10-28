// Partenaires : annuaire (marques, photographes, monteurs…), liens avec les mannequins, comptes de connexion.
import { supabase } from "../supabase.js";
import { callAdmin } from "./espace-admin-api.js";

async function run(q) { const { data, error } = await q; if (error) throw error; return data; }

export const MISSING_MESSAGE = "Les partenaires ne sont pas encore installés : colle partenaires.sql dans Supabase (SQL Editor > Run), puis recharge la page.";
export const isMissing = (err) => !!err && /espace_partner|partenaires\.sql|schema cache|42P01|PGRST205/i.test(`${err.code || ""} ${err.message || ""}`);

export async function loadDirectory() {
  const [partners, privates, links, businesses] = await Promise.all([
    run(supabase.from("espace_partners").select("*").order("nom")),
    run(supabase.from("espace_partner_private").select("*")),
    run(supabase.from("espace_partner_links").select("business_id, partner_id")),
    run(supabase.from("espace_businesses").select("id, nom").order("nom"))
  ]);
  return { partners, privates, links, businesses };
}

export const savePartner = (values, id) => id
  ? run(supabase.from("espace_partners").update(values).eq("id", id).select().single())
  : run(supabase.from("espace_partners").insert(values).select().single());
export const deletePartner = (id) => run(supabase.from("espace_partners").delete().eq("id", id));
export const savePrivate = (partnerId, values) => run(supabase.from("espace_partner_private").upsert({ partner_id: partnerId, ...values }, { onConflict: "partner_id" }));

// Remplace la liste des mannequins associés à un partenaire.
export async function setLinks(partnerId, businessIds, current) {
  const want = new Set(businessIds), have = new Set(current);
  const toAdd = [...want].filter((b) => !have.has(b)), toRemove = [...have].filter((b) => !want.has(b));
  if (toAdd.length) await run(supabase.from("espace_partner_links").insert(toAdd.map((b) => ({ business_id: b, partner_id: partnerId }))));
  for (const b of toRemove) await run(supabase.from("espace_partner_links").delete().eq("partner_id", partnerId).eq("business_id", b));
}

// Associe / retire un partenaire d'un mannequin depuis la fiche du mannequin.
export const addLink = (businessId, partnerId) => run(supabase.from("espace_partner_links").insert({ business_id: businessId, partner_id: partnerId }));
export const removeLink = (businessId, partnerId) => run(supabase.from("espace_partner_links").delete().eq("business_id", businessId).eq("partner_id", partnerId));

export const createAccount = (partnerId, email) => callAdmin("partner_account_create", { partner_id: partnerId, email });
export const resetAccount = (partnerId) => callAdmin("partner_account_reset", { partner_id: partnerId });
export const removeAccount = (partnerId) => callAdmin("partner_account_remove", { partner_id: partnerId });
