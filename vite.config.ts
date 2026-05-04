import { readdirSync, readFileSync, statSync } from "fs";
import { createRequire } from "module";
import { basename, dirname, extname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig, Plugin } from "vite";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const require = createRequire(import.meta.url);
const motionCanvas = require("@motion-canvas/vite-plugin").default;

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
  const dir = resolve(__dirname, "src/scenes");
  const notes: Record<string, SlideMeta> = {};
  for (const file of walk(dir)) {
    const sceneName = basename(file, extname(file));
    const src = readFileSync(file, "utf8");
    let m: RegExpExecArray | null;
    SLIDE_RE.lastIndex = 0;
    while ((m = SLIDE_RE.exec(src))) {
      const fullId = `${sceneName}:${m[1]}`;
      notes[fullId] = {
        notes: m[2].replace(/^[ \t]+/gm, "").trim(),
        owner: m[3] || undefined,
      };
    }
  }
  return notes;
}

function slideNotesPlugin(): Plugin {
  const ID = "virtual:slide-notes";
  const RESOLVED = "\0" + ID;
  return {
    name: "slide-notes",
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
        ctx.file.includes("/src/scenes/") ||
        ctx.file.includes("\\src\\scenes\\")
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
    name: "inject-presenter-bridge",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        if (req.url.includes("notes")) return next();
        const u = req.url.split("?")[0];
        const isEditor =
          u === "/" || u === "/index.html" || /^\/[^./]+\/?$/.test(u);
        if (!isEditor) return next();

        const origEnd = res.end.bind(res);
        res.end = function (chunk: any, ...args: any[]) {
          try {
            const ct = String(res.getHeader("content-type") || "");
            if (
              ct.includes("text/html") &&
              chunk &&
              typeof chunk !== "function"
            ) {
              const buf = Buffer.isBuffer(chunk)
                ? chunk
                : Buffer.from(String(chunk));
              let html = buf.toString("utf8");
              if (
                html.includes("</body>") &&
                !html.includes("presenter-bridge")
              ) {
                html = html.replace("</body>", SCRIPT + "</body>");
                res.removeHeader("content-length");
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
    name: "suppress-meta-reload",
    enforce: "post",
    handleHotUpdate(ctx) {
      if (ctx.file.endsWith(".meta")) {
        return [];
      }
    },
  };
}

function presentBuildPlugin(): Plugin {
  // Static build: ship a standalone presenter (no editor UI) at index.html
  // plus the existing notes.html. The presenter mounts the Stage canvas
  // fullscreen and binds keyboard nav. presenter-bridge wires the
  // BroadcastChannel to notes.html.
  let isBuild = false;
  const presentEntryName = "present-entry";
  const presentEntryId = "virtual:mc-present-entry";
  const resolvedPresentEntryId = "\0" + presentEntryId;
  const projectFile = resolve(__dirname, "src/project.ts");
  const notesHtmlPath = resolve(__dirname, "notes.html");
  return {
    name: "mc-present-build",
    apply: "build",
    configResolved(c) {
      isBuild = c.command === "build";
    },
    config() {
      return {
        build: {
          rollupOptions: {
            input: {
              [presentEntryName]: presentEntryId,
              notes: notesHtmlPath,
            },
          },
        },
      };
    },
    resolveId(id) {
      if (id === presentEntryId) return resolvedPresentEntryId;
    },
    load(id) {
      if (id !== resolvedPresentEntryId) return;
      const projectImport = projectFile.replace(/\\/g, "/") + "?project";
      const bridgeImport = resolve(
        __dirname,
        "src/lib/presenter-bridge.ts",
      ).replace(/\\/g, "/");
      return `\
import {Presenter} from '@motion-canvas/core';
import ${JSON.stringify(bridgeImport)};
import project from ${JSON.stringify(projectImport)};

const presenter = new Presenter(project);
const canvas = presenter.stage.finalBuffer;

document.documentElement.style.height = '100%';
document.body.style.margin = '0';
document.body.style.height = '100vh';
document.body.style.background = '#000';
document.body.style.overflow = 'hidden';
document.body.style.display = 'flex';
document.body.style.alignItems = 'center';
document.body.style.justifyContent = 'center';
canvas.style.maxWidth = '100vw';
canvas.style.maxHeight = '100vh';
canvas.style.width = 'auto';
canvas.style.height = 'auto';
canvas.style.display = 'block';
document.body.appendChild(canvas);

const settings = {
  ...project.meta.getFullRenderingSettings(),
  name: project.name,
  slide: null,
};
presenter.present(settings);

window.addEventListener('keydown', (e) => {
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  switch (e.key) {
    case ' ':
      // resume() plays animation forward through current slide marker
      presenter.resume();
      e.preventDefault();
      break;
    case 'ArrowRight':
    case 'PageDown':
      presenter.requestNextSlide();
      e.preventDefault();
      break;
    case 'ArrowLeft':
    case 'PageUp':
      presenter.requestPreviousSlide();
      e.preventDefault();
      break;
    case 'Home':
      presenter.requestFirstSlide();
      break;
    case 'End':
      presenter.requestLastSlide();
      break;
    case 'f':
    case 'F':
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
      break;
    case 'n':
    case 'N':
      window.open('./notes.html', 'mc-notes', 'noopener');
      break;
  }
});
`;
    },
    generateBundle(_opts, bundle) {
      if (!isBuild) return;

      let entryFile: string | undefined;
      let notesHtmlFile: string | undefined;
      for (const [file, chunk] of Object.entries(bundle)) {
        if (
          chunk.type === "chunk" &&
          chunk.isEntry &&
          chunk.name === presentEntryName
        ) {
          entryFile = file;
        }
        if (
          chunk.type === "asset" &&
          (chunk.fileName === "notes.html" || chunk.name === "notes.html")
        ) {
          notesHtmlFile = chunk.fileName;
        }
      }
      if (!entryFile) return;

      const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sparse Feature Circuits — Presentation</title>
    <style>html,body{margin:0;height:100%;background:#000;color:#eee;font-family:system-ui,sans-serif}#hint{position:fixed;left:12px;bottom:8px;font-size:12px;opacity:.5;pointer-events:none}:fullscreen #hint,:-webkit-full-screen #hint{display:none}</style>
  </head>
  <body>
    <div id="hint">Space play · → snap next · ← snap prev · F fullscreen · N open notes${notesHtmlFile ? ` (<a style="color:#9cf" href="./${notesHtmlFile}" target="_blank" rel="noopener">notes</a>)` : ""}</div>
    <script type="module" src="./${entryFile}"></script>
  </body>
</html>
`;
      this.emitFile({ type: "asset", fileName: "index.html", source: html });
    },
  };
}

function openTabsPlugin(): Plugin {
  let opened = false;
  return {
    name: "open-tabs",
    apply: "serve",
    configureServer(server) {
      const fire = async () => {
        if (opened) return;
        opened = true;
        try {
          const a = server.httpServer?.address();
          if (!a || typeof a === "string") return;
          const base = `http://localhost:${a.port}`;
          const { default: open } = await import("open");
          await open(`${base}?present`);
          await open(`${base}/notes.html`);
        } catch (err) {
          console.error("[open-tabs] failed", err);
        }
      };
      server.httpServer?.once("listening", () => setTimeout(fire, 300));
    },
  };
}

export default defineConfig({
  base: "./",
  server: { open: false },
  plugins: [
    presenterBridgePlugin(),
    motionCanvas(),
    slideNotesPlugin(),
    suppressMetaReload(),
    presentBuildPlugin(),
    openTabsPlugin(),
  ],
});
