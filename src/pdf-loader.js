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

// Un seul "worker" pdf.js, démarré à l'avance et réutilisé pour tous les PDF
// (sinon chaque ouverture relance le sien).
let workerPromise = null;

export function loadPdfWorker() {
  if (!workerPromise) workerPromise = loadPdfjs().then((pdfjs) => new pdfjs.PDFWorker({ name: "zenoa-pdf" }));
  return workerPromise;
}

// Documents déjà ouverts (ou en cours d'ouverture), par adresse : rouvrir un
// livre est immédiat, et on peut commencer à charger un PDF dès qu'on passe
// dessus. Le fichier arrive en continu, et les pages à afficher sont
// demandées en priorité par gros morceaux (512 Ko : peu d'allers-retours).
const MAX_OPEN_DOCS = 3;
const docs = new Map();

export function getPdfDocument(url) {
  if (docs.has(url)) {
    const cached = docs.get(url);
    docs.delete(url);
    docs.set(url, cached);
    return cached;
  }
  const promise = (async () => {
    const [pdfjs, worker] = await Promise.all([loadPdfjs(), loadPdfWorker()]);
    return pdfjs.getDocument({ url, worker, isEvalSupported: false, disableAutoFetch: true, rangeChunkSize: 512 * 1024 }).promise;
  })();
  promise.catch(() => docs.delete(url));
  docs.set(url, promise);
  while (docs.size > MAX_OPEN_DOCS) {
    const [oldUrl, old] = docs.entries().next().value;
    docs.delete(oldUrl);
    old.then((d) => d.destroy()).catch(() => {});
  }
  return promise;
}
