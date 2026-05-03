import {defineConfig, Plugin} from 'vite';
import {createRequire} from 'module';
import {readFileSync, readdirSync, statSync} from 'fs';
import {resolve, dirname, join, basename, extname} from 'path';
import {fileURLToPath} from 'url';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const require = createRequire(import.meta.url);
const motionCanvas = require('@motion-canvas/vite-plugin').default;

const __dirname = dirname(fileURLToPath(import.meta.url));

const SLIDE_RE =
  /slide\(\s*['"]([^'"]+)['"]\s*,\s*`([\s\S]*?)`(?:\s*,\s*['"]([^'"]+)['"])?/g;

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

interface SlideMeta {
  notes: string;
  owner?: string;
}

function extractNotes(): Record<string, SlideMeta> {
  const dir = resolve(__dirname, 'src/scenes');
  const notes: Record<string, SlideMeta> = {};
  for (const file of walk(dir)) {
    const sceneName = basename(file, extname(file));
    const src = readFileSync(file, 'utf8');
    let m: RegExpExecArray | null;
    SLIDE_RE.lastIndex = 0;
    while ((m = SLIDE_RE.exec(src))) {
      const fullId = `${sceneName}:${m[1]}`;
      notes[fullId] = {
        notes: m[2].replace(/^[ \t]+/gm, '').trim(),
        owner: m[3] || undefined,
      };
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
      if (
        ctx.file.includes('/src/scenes/') ||
        ctx.file.includes('\\src\\scenes\\')
      ) {
        const mod = ctx.server.moduleGraph.getModuleById(RESOLVED);
        if (mod) {
          ctx.server.moduleGraph.invalidateModule(mod);
          return [...ctx.modules, mod];
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

function suppressMetaReload(): Plugin {
  return {
    name: 'suppress-meta-reload',
    enforce: 'post',
    handleHotUpdate(ctx) {
      if (ctx.file.endsWith('.meta')) {
        return [];
      }
    },
  };
}

function editorHtmlBuildPlugin(): Plugin {
  // Motion Canvas vite-plugin emits the editor HTML only in dev. For static
  // builds (e.g. GitHub Pages) we generate index.html ourselves from the
  // @motion-canvas/ui editor.html template and ship style.css as an asset.
  let isBuild = false;
  const projectEntryName = 'project';
  const editorEntryName = 'editor-entry';
  const editorEntryId = 'virtual:mc-editor-entry';
  const resolvedEditorEntryId = '\0' + editorEntryId;
  const projectFile = resolve(__dirname, 'src/project.ts');
  // Plugins loaded at runtime by editorBootstrap via `/@id/<spec>` dynamic
  // imports — Vite dev URLs that 404 in production. We bundle each as an
  // additional Rollup input and remap via importmap in the generated HTML.
  const runtimePlugins = ['@motion-canvas/2d/editor'];
  return {
    name: 'mc-editor-html-build',
    apply: 'build',
    configResolved(c) {
      isBuild = c.command === 'build';
    },
    config() {
      const input: Record<string, string> = {
        [editorEntryName]: editorEntryId,
      };
      for (const spec of runtimePlugins) {
        input[spec.replace(/[@/]/g, '_').replace(/^_+/, '')] =
          require.resolve(spec);
      }
      return {build: {rollupOptions: {input}}};
    },
    resolveId(id) {
      if (id === editorEntryId) return resolvedEditorEntryId;
    },
    load(id) {
      if (id === resolvedEditorEntryId) {
        const projectImport = projectFile.replace(/\\/g, '/') + '?project';
        return `import {editor} from '@motion-canvas/ui';\nimport project from ${JSON.stringify(projectImport)};\neditor(project);\n`;
      }
    },
    generateBundle(_opts, bundle) {
      if (!isBuild) return;
      const uiDir = dirname(require.resolve('@motion-canvas/ui/package.json'));
      const editorHtml = readFileSync(
        resolve(uiDir, 'dist/editor.html'),
        'utf8',
      );
      const styleSrc = readFileSync(resolve(uiDir, 'dist/style.css'));

      const styleRef = this.emitFile({
        type: 'asset',
        name: 'style.css',
        source: styleSrc,
      });
      const styleFile = this.getFileName(styleRef);

      let entryFile: string | undefined;
      const pluginEntries: Record<string, string> = {};
      const pluginNameToSpec = new Map<string, string>();
      for (const spec of runtimePlugins) {
        pluginNameToSpec.set(
          spec.replace(/[@/]/g, '_').replace(/^_+/, ''),
          spec,
        );
      }
      let projectChunkFile: string | undefined;
      for (const [file, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'chunk' || !chunk.isEntry) continue;
        if (chunk.name === editorEntryName) entryFile = file;
        if (chunk.name === projectEntryName) projectChunkFile = file;
        const spec = pluginNameToSpec.get(chunk.name);
        if (spec) pluginEntries[spec] = file;
      }
      if (!entryFile) entryFile = projectChunkFile;
      if (!entryFile) return;

      const importMap: Record<string, string> = {};
      for (const [spec, file] of Object.entries(pluginEntries)) {
        importMap[`/@id/${spec}`] = `./${file}`;
      }
      const importMapTag = `    <script type="importmap">${JSON.stringify({imports: importMap})}</script>\n  `;

      let html = editorHtml
        .replace('{{style}}', `./${styleFile}`)
        .replace('{{source}}', `./${entryFile}`);
      html = html.replace('</head>', importMapTag + '</head>');

      this.emitFile({type: 'asset', fileName: 'index.html', source: html});
    },
  };
}

function openTabsPlugin(): Plugin {
  let opened = false;
  return {
    name: 'open-tabs',
    apply: 'serve',
    configureServer(server) {
      const fire = async () => {
        if (opened) return;
        opened = true;
        try {
          const a = server.httpServer?.address();
          if (!a || typeof a === 'string') return;
          const base = `http://localhost:${a.port}`;
          const {default: open} = await import('open');
          await open(`${base}/`);
          await open(`${base}/notes.html`);
        } catch (err) {
          console.error('[open-tabs] failed', err);
        }
      };
      server.httpServer?.once('listening', () => setTimeout(fire, 300));
    },
  };
}

export default defineConfig({
  base: './',
  server: {open: false},
  plugins: [
    presenterBridgePlugin(),
    motionCanvas({buildForEditor: true}),
    slideNotesPlugin(),
    suppressMetaReload(),
    editorHtmlBuildPlugin(),
    openTabsPlugin(),
  ],
});
