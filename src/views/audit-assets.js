// Audits : images dans le bucket privé existant « user-resources » (dossier = ton identifiant, comme les autres fichiers).
import { supabase } from "../supabase.js";
import { newId } from "./audits-data.js";

const cache = new Map(); // chemin -> { url, exp }

export async function signedUrls(paths) {
  const now = Date.now();
  const need = [...new Set(paths)].filter((p) => p && !(cache.get(p) && cache.get(p).exp > now));
  if (need.length) {
    const { data } = await supabase.storage.from("user-resources").createSignedUrls(need, 3600);
    (data || []).forEach((r) => { if (r.signedUrl) cache.set(r.path, { url: r.signedUrl, exp: now + 3300e3 }); });
  }
  return (p) => (cache.get(p) && cache.get(p).url) || "";
}

// Réduit l'image (1600 px max) et l'enregistre en JPEG : léger pour le stockage gratuit et pour la page publique.
async function toJpeg(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("conversion"))), "image/jpeg", 0.86));
}

export async function uploadImage(file, auditId) {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error("Choisis une image JPEG, PNG ou WebP.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Image trop lourde (15 Mo maximum).");
  let blob;
  try { blob = await toJpeg(file); } catch { throw new Error("Image illisible."); }
  const uid = (await supabase.auth.getUser()).data.user.id;
  const path = `${uid}/audits/${auditId}/${newId()}${newId()}.jpg`;
  const { error } = await supabase.storage.from("user-resources").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error("Envoi impossible : " + error.message);
  return path;
}
