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

const PRESENT_HINT = `Space play · → skip · ← back · R first · L last · F fullscreen · N notes · P export PDF (⇧P +notes)`;

function presentBuildPlugin(): Plugin {
  // Build: emit a standalone presenter (no editor UI) at index.html plus
  // notes.html. Dev: serve the same presenter at /present so behavior
  // matches prod and the MC editor stays available at /.
  let isBuild = false;
  const presentEntryName = "present-entry";
  const presentEntryFile = resolve(__dirname, "src/present-entry.ts");
  const notesHtmlPath = resolve(__dirname, "notes.html");
  return {
    name: "mc-present-build",
    configResolved(c) {
      isBuild = c.command === "build";
    },
    config(_, env) {
      if (env.command !== "build") return;
      return {
        build: {
          rollupOptions: {
            input: {
              [presentEntryName]: presentEntryFile,
              notes: notesHtmlPath,
            },
          },
        },
      };
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const path = req.url.split("?")[0];
        if (path !== "/present" && path !== "/present/") return next();
        const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Presentation (dev)</title>
    <style>html,body{margin:0;height:100%;background:#000;color:#eee;font-family:system-ui,sans-serif}#hint{position:fixed;left:12px;bottom:8px;font-size:12px;opacity:.5;pointer-events:none}:fullscreen #hint,:-webkit-full-screen #hint{display:none}</style>
  </head>
  <body>
    <div id="hint">${PRESENT_HINT} · <em>dev</em></div>
    <script type="module" src="/src/present-entry.ts"></script>
  </body>
</html>`;
        res.setHeader("Content-Type", "text/html");
        res.end(html);
      });
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
    <title>Presentation</title>
    <style>html,body{margin:0;height:100%;background:#000;color:#eee;font-family:system-ui,sans-serif}#hint{position:fixed;left:12px;bottom:8px;font-size:12px;opacity:.5;pointer-events:none}:fullscreen #hint,:-webkit-full-screen #hint{display:none}</style>
  </head>
  <body>
    <div id="hint">${PRESENT_HINT}${notesHtmlFile ? ` (<a style="color:#9cf" href="./${notesHtmlFile}" target="_blank" rel="noopener">notes</a>)` : ""}</div>
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
          await open(`${base}/present`);
          await open(`${base}/notes.html`);
        } catch (err) {
          console.error("[open-tabs] failed", err);
        }
      };
      server.httpServer?.once("listening", () => setTimeout(fire, 300));
    },
  };
}

export default defineConfig(({ command }) => ({
  base: command === "build" ? "./" : "/",
  server: { open: false },
  plugins: [
    presenterBridgePlugin(),
    motionCanvas(),
    slideNotesPlugin(),
    suppressMetaReload(),
    presentBuildPlugin(),
    openTabsPlugin(),
  ],
}));
