/**
 * Host half of dsh-browser-studio.
 *
 * All behaviour lives in the client bundle: the plugin takes over the
 * `browser` tab kind and drives its own leased Desktop webview. There is no
 * host tool, no HTTP route and no config schema, so this half only exists to
 * give the bundle a mountable entry.
 */
export function apply() {}
