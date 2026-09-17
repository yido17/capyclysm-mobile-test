/* Large engine files are delivered in small static assets. Only these two
 * same-origin requests are adapted; all other fetches keep browser semantics. */
(() => {
  const originalFetch = window.fetch.bind(window);
  const manifest = originalFetch('chunks.json', {cache: 'no-store'}).then(r => {
    if (!r.ok) throw new Error('Oyun dosya listesi yüklenemedi.');
    return r.json();
  });
  window.fetch = async (input, options) => {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    const name = url.pathname.split('/').pop();
    if (url.origin !== location.origin || !['index.pck', 'index.wasm'].includes(name)) {
      return originalFetch(input, options);
    }
    const file = (await manifest)[name];
    if (!file) return originalFetch(input, options);
    let part = 0;
    let reader;
    return new Response(new ReadableStream({
      async pull(controller) {
        try {
          if (!reader) {
            if (part === file.parts.length) { controller.close(); return; }
            const response = await originalFetch(file.parts[part++] + '?v=' + file.sha256.slice(0, 16), options);
            if (!response.ok) throw new Error('Oyun dosyası indirilemedi. Sayfayı yeniden aç.');
            reader = response.body.getReader();
          }
          const result = await reader.read();
          if (result.done) { reader = null; return this.pull(controller); }
          controller.enqueue(result.value);
        } catch (error) { controller.error(error); }
      },
      cancel() { return reader?.cancel(); }
    }), {headers: {'Content-Type': name.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream', 'Content-Length': String(file.size)}});
  };
})();
