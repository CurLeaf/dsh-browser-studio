# dsh-browser-studio

Turn the DeepSeek Harness built-in browser into a browser studio: **preview at device sizes**, **pick page elements**, and drop their context straight into the session.

- The phone icon in the address bar toggles device emulation (on: last device size, off: fill); the size bar's dropdown switches models, plus device frame, mobile UA and pixel rulers with draggable guides
- A size bar under the address bar (editable width/height + zoom) appears whenever a device size is active, and the simulated page carries a `393px × 852px` badge
- Element picker: hover highlight, click to select, captures selector, DOM path, text, box, styles and React component name (Desktop)
- Pick-to-chat: the composer is summoned and focused, and the element shows up as a removable **chip** above it
- **Nothing is written into the editor**: the element details are injected by the host as a hidden context message on the next step
- Keeps HMR, sign-ins and real interaction — it is a real browser, not a screenshot

> Takeover: Desktop replaces the shipped browser tab kind (`browser`) by default; uninstalling or disabling the plugin restores it untouched.

## Compatibility

| Environment | Device sizes | Element picking | Into the chat |
|---|---|---|---|
| DSH Desktop ≥ 0.2.1-rc.1 | ✅ | ✅ | ✅ |
| DSH Web | ✅ (iframe) | ✅ when the page loads `agent.js`, otherwise disabled | ✅ |

### Picking in the Web build

The parent page cannot read a cross-origin iframe. Load the page agent in the previewed app instead; the agent lives in the page, draws the highlights, and talks to the studio over `postMessage`.

The loader is origin-agnostic: it reads the studio origin from `document.referrer`, so the same snippet works on every machine and port. `data-dsh-origin` is only a fallback for pages that strip their referrer.

```html
<script data-dsh-origin="http://127.0.0.1:3080">
(function () {
  var el = document.currentScript;
  var origin = '';
  try { origin = (location.ancestorOrigins && location.ancestorOrigins[0]) || ''; } catch (e) { origin = ''; }
  if (!origin) {
    try { origin = document.referrer ? new URL(document.referrer).origin : ''; } catch (e) { origin = ''; }
  }
  if (!origin) origin = (el && el.getAttribute('data-dsh-origin')) || '';
  if (!origin) return;
  var s = document.createElement('script');
  s.src = origin + '/browser-studio/agent.js';
  s.defer = true;
  document.head.appendChild(s);
})();
</script>
```

Dev-only; keep it out of production builds. If the app's CSP blocks inline or cross-origin scripts, host `lib/agent.js` from the same origin and point the loader there.

### Vite projects

The package ships the same loader as a Vite plugin, so the app's HTML stays untouched:

```ts
// vite.config.ts
import dshStudioAgent from 'dsh-browser-studio/vite'

export default defineConfig({
  plugins: [dshStudioAgent()],
})
```

`apply: 'serve'` keeps it out of production builds. By default it injects the referrer loader; pass `dshStudioAgent({ origin: 'http://host:port' })` or set `DSH_STUDIO_URL` to inject a direct script when the page strips its referrer.

## Install

```sh
dsh plugin --profile desktop add dsh-browser-studio
```

Refresh the window after installing. From source:

```sh
git clone https://github.com/curleaf/dsh-browser-studio
cd dsh-browser-studio && npm install && npm run build
dsh plugin --profile desktop add .
```

## Usage

1. Open **Browser** in the right sidebar (`Ctrl/Cmd+T`) and enter `localhost:5173`.
2. The phone icon in the address bar toggles device emulation: off fills the panel, on restores the last device (iPhone 15 the first time) and shows the size bar. The device name in the size bar opens the model list; edit the numbers and press `Enter` (or blur) to apply. Choosing "Responsive" hides the bar and fills the panel again.
3. The ruler and pick icons next to it toggle page-pixel rulers and element picking. With rulers on, drag downward from the top ruler for a horizontal guide (rightward from the side ruler for a vertical one); drag it back out or double-click it to remove. UA and the device frame are switches in the device list.
4. Press `⊕` to start picking: hover highlights the element; clicking outlines it in blue and opens an **annotation card** that follows the element.
5. Type the change ("make the corners smaller") and press `Enter` or `→`; `Esc` / `×` cancels. The composer is focused and a chip appears above it, while the editor gets one compact line:

```
⟦元素1⟧ · <button#submit.btn.primary>「提交订单」 · localhost:5173/checkout · 120×40 · src/components/checkout.tsx
```

6. Add an instruction and send. Chips clear with the message; `×` removes one chip and its line.

## Deliberate limits

- **No DPR or touch emulation.** DSH exposes no CDP seam to plugins; only the viewport size and the UA are real.
- **Cross-origin iframes stay opaque** unless they opt in by loading `agent.js`; without that script the studio has no way into the page, and the pick button stays disabled.
- **Page data is untrusted.** The block is generated from page DOM inside the page's main world; review before sending.
- **Web picking is opt-in.** It needs the page to load `/browser-studio/agent.js`; Desktop needs no such change.
- **Rulers are drawn by the studio, not the page.** Ticks come from the guest's measured box and use page CSS pixels; nothing is injected, so they also work on Web (iframe).
- **Context travels through the host.** The client posts details to `/browser-studio/api/refs`; the host appends a hidden `user` message with a non-`user` source kind on the next `agent/pre-step`. The composer only carries a compact `〔引用 N · label〕` line so the sent bubble shows what travelled with it.
- **Unsent references expire** after 30 minutes on the host; removing a chip deletes it immediately.

## How it works

- Takes over the `browser` kind (`ctx.sidebarRightTabs.register`) and registers the body on `sidebar.right.pane.tab`.
- Desktop acquires a guest: `window.dshDesktop.browser.acquire(workspace)` → `<webview src="about:blank#lease">`.
- Injects a page agent (`executeJavaScript`): Shadow DOM overlay, picker, numbered pins; the client drains it every 170ms.
- The webview's CSS box is the guest viewport (media queries are real); a `transform: scale()` wrapper fits it into the panel.
- Rulers re-measure that box on resize and draw ticks at `scale` in the device bar's overlay, so page and ruler stay aligned at any zoom.
- Web picking: the studio posts `hello`/commands to the frame, the page agent answers over `postMessage` (source-window and version checked), and the parent positions the annotation card from the rect the agent reports.
- Into the chat: a `conversation.input.dock` component captures `inputActions.setDraft`; falls back to `conversation.send()`.
- Device data comes from Chrome DevTools `EmulatedDevices.ts` (BSD-3); React metadata comes from [bippy](https://github.com/aidenybai/bippy) (MIT). See `NOTICE`.

## Development

```sh
npm install
npm run build
npm run typecheck
npm test
npm run test:bundle
npm run test:agent
npm run test:all
```

### Verified so far

- `vitest`: URL normalization, fit/rotate math, size/zoom/rulers editing in the built component, element block, draft bridge, apply wiring (37 tests).
- `test/bundle.e2e.mjs`: loads the **built bundle** in Chrome with a stub module loader + fake Cordis ctx and asserts the browser takeover, tab body and dock registrations.
- `test/agent.e2e.mjs` / `test/react-agent.e2e.mjs`: real Chrome, real clicks — picking, payload, capture-phase guard, pins, Esc; the React fixture proves bippy resolves component names.
- `test/electron/spike.mjs`: on **Electron 44.7** (same major as DSH Desktop) it proves the webview viewport equals its CSS box, CSS-transform scaling renders and routes input in scaled coordinates, and `setUserAgent` + reload applies.

Not yet installed into a live DSH Desktop profile (that needs a desktop restart).

## License

MIT. Third-party notices in [NOTICE](./NOTICE).
