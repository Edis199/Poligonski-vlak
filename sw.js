/* sw.js — Service Worker: omogućava instalaciju i rad bez interneta.
   Strategija: MREŽA PRVO, pa keš. Kad ima interneta, uvijek se učita najnovija verzija
   (i upiše u keš; provjera kod servera se radi svaki put); bez interneta se koristi zadnja sačuvana verzija. */
const KES = "geodetske-mreze-v2";
const DATOTEKE = [
  "./",
  "index.html",
  "manifest.json",
  "ikone/apple-touch-icon.png",
  "ikone/favicon.ico",
  "ikone/icon_nivelmanska.png",
  "ikone/icon_poligonska.png",
  "ikone/ikona-192.png",
  "ikone/ikona-512.png",
  "ikone/ikona-mreza.svg",
  "ikone/logo_main.png",
  "poligon-app/app.js",
  "poligon-app/detalj.js",
  "poligon-app/favicon.ico",
  "poligon-app/girus.js",
  "poligon-app/ikona-192.png",
  "poligon-app/ikona-512.png",
  "poligon-app/ikona-totalka.svg",
  "poligon-app/index.html",
  "poligon-app/logo.png",
  "poligon-app/manifest.json",
  "poligon-app/obrasci.js",
  "poligon-app/poslovi.js",
  "poligon-app/predlozak_tahimetrijski_zapisnik.csv",
  "poligon-app/predlozak_zapisnik.csv",
  "poligon-app/racun.js",
  "poligon-app/stil.css",
  "poligon-app/ucitavanje.js",
  "poligon-app/visine.js",
  "poligon-app/xlsx.js",
  "nivelman-app/app.js",
  "nivelman-app/favicon.ico",
  "nivelman-app/ikona-192.png",
  "nivelman-app/ikona-512.png",
  "nivelman-app/ikona-totalka.svg",
  "nivelman-app/index.html",
  "nivelman-app/logo.png",
  "nivelman-app/manifest.json",
  "nivelman-app/obrasci.js",
  "nivelman-app/poslovi.js",
  "nivelman-app/racun.js",
  "nivelman-app/stil.css",
  "nivelman-app/ucitavanje.js",
  "nivelman-app/xlsx.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(KES).then((kes) =>
      Promise.all(DATOTEKE.map((d) => fetch(d, { cache: "reload" }).then((o) => (o.ok ? kes.put(d, o) : null)).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((nazivi) => Promise.all(nazivi.filter((n) => n !== KES).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const zahtjev = e.request;
  if (zahtjev.method !== "GET" || !zahtjev.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(zahtjev, { cache: "no-cache" })   // uvijek provjeri kod servera (ne koristi stari HTTP keš)
      .then((odgovor) => {
        if (odgovor && odgovor.ok) {
          const kopija = odgovor.clone();
          caches.open(KES).then((kes) => kes.put(zahtjev, kopija));
        }
        return odgovor;
      })
      .catch(() =>
        caches.match(zahtjev, { ignoreSearch: true }).then((u) => u || caches.match(zahtjev.mode === "navigate" ? "index.html" : zahtjev, { ignoreSearch: true }))
      )
  );
});
