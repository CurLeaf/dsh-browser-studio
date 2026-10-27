// src/shared/agent-loader.ts
var AGENT_PATH = "/browser-studio/agent.js";
var AGENT_LOADER = `(function () {
  var el = document.currentScript;
  var origin = '';
  try { origin = (location.ancestorOrigins && location.ancestorOrigins[0]) || ''; } catch (e) { origin = ''; }
  if (!origin) {
    try { origin = document.referrer ? new URL(document.referrer).origin : ''; } catch (e) { origin = ''; }
  }
  if (!origin) origin = (el && el.getAttribute('data-dsh-origin')) || '';
  if (!origin) return;
  var s = document.createElement('script');
  s.src = origin + '${AGENT_PATH}';
  s.defer = true;
  document.head.appendChild(s);
})();`;

// src/vite/index.ts
function dshStudioAgent(options = {}) {
  const env = globalThis.process?.env;
  const origin = (options.origin ?? env?.DSH_STUDIO_URL ?? "").replace(/\/+$/, "");
  const direct = origin === "" ? "" : `${origin}${AGENT_PATH}`;
  return {
    name: "dsh-browser-studio:agent",
    apply: "serve",
    transformIndexHtml(html) {
      if (html.includes(AGENT_PATH)) return html;
      if (direct !== "") {
        return [{ tag: "script", attrs: { src: direct, defer: true }, injectTo: "head" }];
      }
      return [{ tag: "script", children: AGENT_LOADER, injectTo: "head" }];
    }
  };
}
export {
  dshStudioAgent as default
};
