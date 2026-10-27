/**
 * Page-side loader for the studio agent.
 *
 * The loader never hardcodes a host: it derives the studio origin from
 * `document.referrer` (the page is embedded in the studio) and falls back to a
 * `data-dsh-origin` attribute when the referrer is unavailable. That keeps the
 * same snippet working across machines, ports and DSH versions.
 */

export const AGENT_PATH = '/browser-studio/agent.js'

export const AGENT_LOADER = `(function () {
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
})();`

export interface AgentSnippetOptions {
  /** Fallback origin used when the page has no referrer. */
  origin?: string
}

/** Full `<script>` block for the app's dev HTML. */
export function agentSnippet(options: AgentSnippetOptions = {}): string {
  const attr = options.origin === undefined || options.origin === '' ? '' : ` data-dsh-origin="${options.origin}"`
  return `<script${attr}>\n${AGENT_LOADER}\n</script>`
}
