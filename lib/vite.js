// src/vite/index.ts
var DEFAULT_ORIGIN = "http://127.0.0.1:3080";
var DEFAULT_PATH = "/browser-studio/agent.js";
function dshStudioAgent(options = {}) {
  const env = globalThis.process?.env;
  const origin = (options.origin ?? env?.DSH_STUDIO_URL ?? DEFAULT_ORIGIN).replace(/\/+$/, "");
  const path = options.path ?? DEFAULT_PATH;
  const src = `${origin}${path.startsWith("/") ? path : `/${path}`}`;
  return {
    name: "dsh-browser-studio:agent",
    apply: "serve",
    transformIndexHtml(html) {
      if (html.includes(src)) return html;
      return [{ tag: "script", attrs: { src, defer: true }, injectTo: "head" }];
    }
  };
}
export {
  dshStudioAgent as default
};
