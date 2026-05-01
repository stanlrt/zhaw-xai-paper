import {defineConfig, Plugin} from 'vite';
import {createRequire} from 'module';
import {readFileSync, readdirSync, statSync} from 'fs';
import {resolve, dirname, join} from 'path';
import {fileURLToPath} from 'url';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const require = createRequire(import.meta.url);
const motionCanvas = require('@motion-canvas/vite-plugin').default;

const __dirname = dirname(fileURLToPath(import.meta.url));

const SLIDE_RE = /slide\(\s*['"]([^'"]+)['"]\s*,\s*`([\s\S]*?)`/g;

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

function extractNotes(): Record<string, string> {
  const dir = resolve(__dirname, 'src/scenes');
  const notes: Record<string, string> = {};
  for (const file of walk(dir)) {
    const src = readFileSync(file, 'utf8');
    let m: RegExpExecArray | null;
    SLIDE_RE.lastIndex = 0;
    while ((m = SLIDE_RE.exec(src))) {
      notes[m[1]] = m[2].replace(/^[ \t]+/gm, '').trim();
    }
  }
  return notes;
}

function slideNotesPlugin(): Plugin {
  const ID = 'virtual:slide-notes';
  const RESOLVED = '\0' + ID;
  return {
    name: 'slide-notes',
    resolveId(id) {
      if (id === ID) return RESOLVED;
    },
    load(id) {
      if (id === RESOLVED) {
        return `export default ${JSON.stringify(extractNotes())};`;
      }
    },
    handleHotUpdate(ctx) {
      if (ctx.file.includes('/src/scenes/') || ctx.file.includes('\\src\\scenes\\')) {
        const mod = ctx.server.moduleGraph.getModuleById(RESOLVED);
        if (mod) {
          ctx.server.moduleGraph.invalidateModule(mod);
          ctx.server.ws.send({type: 'full-reload'});
        }
      }
    },
  };
}

function presenterBridgePlugin(): Plugin {
  const SCRIPT =
    '<script type="module" src="/src/lib/presenter-bridge.ts"></script>';
  return {
    name: 'inject-presenter-bridge',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        if (req.url.includes('notes')) return next();
        const u = req.url.split('?')[0];
        const isEditor = u === '/' || u === '/index.html' || /^\/[^./]+\/?$/.test(u);
        if (!isEditor) return next();

        const origEnd = res.end.bind(res);
        res.end = function (chunk: any, ...args: any[]) {
          try {
            const ct = String(res.getHeader('content-type') || '');
            if (
              ct.includes('text/html') &&
              chunk &&
              typeof chunk !== 'function'
            ) {
              const buf = Buffer.isBuffer(chunk)
                ? chunk
                : Buffer.from(String(chunk));
              let html = buf.toString('utf8');
              if (
                html.includes('</body>') &&
                !html.includes('presenter-bridge')
              ) {
                html = html.replace('</body>', SCRIPT + '</body>');
                res.removeHeader('content-length');
                return origEnd(html, ...args);
              }
            }
          } catch {}
          return origEnd(chunk, ...args);
        } as any;
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [presenterBridgePlugin(), motionCanvas(), slideNotesPlugin()],
});
