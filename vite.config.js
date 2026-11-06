import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [{
    name: 'site-content',
    transformIndexHtml(html) {
      const { site } = JSON.parse(readFileSync(new URL('./content.json', import.meta.url), 'utf8'));
      const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
      return html.replace(/%CONTENT_(\w+)%/g, (_, key) => {
        if (!(key in site)) throw new Error(`Missing site content: ${key}`);
        return String(site[key]).replace(/[&<>"']/g, character => escapes[character]);
      });
    },
  }],
});
