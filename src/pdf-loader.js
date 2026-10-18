// Chargement de pdf.js à la demande (≈ 500 Ko) : uniquement quand on
// ajoute ou qu'on ouvre un PDF, pas au chargement du site.
let pdfjsPromise = null;

export function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

// PDF téléchargé en entier en une seule demande (avec la progression en %),
// puis ouvert. Le chargement par petits morceaux était plus rapide en test
// mais pouvait rester bloqué indéfiniment avec le stockage Supabase.
// Les documents ouverts restent en mémoire : rouvrir un livre est immédiat.
const MAX_OPEN_DOCS = 3;
const STALL_MS = 30000; // plus rien reçu pendant 30 s : on abandonne
const docs = new Map(); // url -> { promise, percent, listeners }

async function downloadPdf(url, onProgress) {
  const controller = new AbortController();
  let stallTimer = null;
  const armStall = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => controller.abort(), STALL_MS);
  };
  armStall();
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error("téléchargement refusé (" + res.status + ")");
    const total = Number(res.headers.get("content-length")) || 0;
    if (!res.body || !total) return new Uint8Array(await res.arrayBuffer());
    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      armStall();
      chunks.push(value);
      received += value.length;
      onProgress(Math.min(99, Math.round((received * 100) / total)));
    }
    const out = new Uint8Array(received);
    let offset = 0;
    for (const c of chunks) { out.set(c, offset); offset += c.length; }
    return out;
  } catch (err) {
    if (err.name === "AbortError") throw new Error("le téléchargement ne répond plus");
    throw err;
  } finally {
    clearTimeout(stallTimer);
  }
}

// `onProgress(pourcentage)` : facultatif, appelé pendant le téléchargement.
export function getPdfDocument(url, onProgress) {
  let entry = docs.get(url);
  if (entry) {
    docs.delete(url);
    docs.set(url, entry);
  } else {
    entry = { percent: 0, listeners: new Set() };
    entry.promise = (async () => {
      const [pdfjs, data] = await Promise.all([
        loadPdfjs(),
        downloadPdf(url, (p) => { entry.percent = p; entry.listeners.forEach((fn) => fn(p)); })
      ]);
      return pdfjs.getDocument({ data, isEvalSupported: false }).promise;
    })();
    entry.promise.catch(() => docs.delete(url)); // une erreur n'est pas gardée : on pourra réessayer
    docs.set(url, entry);
    while (docs.size > MAX_OPEN_DOCS) {
      const [oldUrl, old] = docs.entries().next().value;
      docs.delete(oldUrl);
      old.promise.then((d) => d.destroy()).catch(() => {});
    }
  }
  if (onProgress) {
    entry.listeners.add(onProgress);
    onProgress(entry.percent);
    entry.promise.finally(() => entry.listeners.delete(onProgress)).catch(() => {});
  }
  return entry.promise;
}
