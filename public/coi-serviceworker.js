/*
 * Isolamento entre origens para a versão web (finanças).
 *
 * O banco do app no navegador (expo-sqlite) usa SharedArrayBuffer, que o navegador só libera
 * quando a página chega com os cabeçalhos COOP/COEP. Nem todo servidor os envia (o servidor de
 * desenvolvimento do Expo esquece na página "/", e muitas hospedagens não deixam configurar).
 * Este service worker acrescenta os cabeçalhos às respostas do próprio site.
 * Pedidos para outros sites (Supabase, cotações) passam direto, sem alteração.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request).then((response) => {
      if (response.status === 0) return response;
      const headers = new Headers(response.headers);
      headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
      headers.set('Cross-Origin-Opener-Policy', 'same-origin');
      headers.set('Cross-Origin-Resource-Policy', 'same-origin');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }),
  );
});
