# dsh-browser-studio

Turn the DeepSeek Harness built-in browser into a browser studio: **preview at device sizes**, **pick page elements**, and drop their context straight into the session.

- Device toolbar: presets, custom width/height, rotate, fit-to-panel, device frame, mobile UA
- Element picker: hover highlight, click to select, captures selector, DOM path, text, box, styles and React component name (Desktop)
- Pick-to-chat: the composer is summoned and focused, and the element shows up as a removable **chip** above it
- The editor only receives one compact reference line (selector / page / box / React file); the full detail lives in the chip tooltip
- Keeps HMR, sign-ins and real interaction — it is a real browser, not a screenshot

> Takeover: Desktop replaces the shipped browser tab kind (`browser`) by default; uninstalling or disabling the plugin restores it untouched.

## Compatibility

| Environment | Device sizes | Element picking | Into the chat |
|---|---|---|---|
| DSH Desktop ≥ 0.2.1-rc.1 | ✅ | ✅ | ✅ |
| DSH Web | ✅ (iframe) | ❌ Desktop only | ✅ |

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
2. Use the second toolbar row to pick a device, or type a width/height.
3. `UA` switches to a mobile user agent (reloads once); `▣` draws a device frame; `Fit` scales the viewport into the panel.
4. Press `⊕` to start picking: hover highlights the element; clicking outlines it in blue and opens an **annotation card** that follows the element.
5. Type the change ("make the corners smaller") and press `Enter` or `→`; `Esc` / `×` cancels. The composer is focused and a chip appears above it, while the editor gets one compact line:

```
⟦元素1⟧ · <button#submit.btn.primary>「提交订单」 · localhost:5173/checkout · 120×40 · src/components/checkout.tsx
```

6. Add an instruction and send. Chips clear with the message; `×` removes one chip and its line.

## Deliberate limits

- **No DPR or touch emulation.** DSH exposes no CDP seam to plugins; only the viewport size and the UA are real.
- **Cross-origin iframes stay opaque.** Browser security model; Cursor has the same limit.
- **Page data is untrusted.** The block is generated from page DOM inside the page's main world; review before sending.
- **No picking on Web.** Without a guest lease there is no injection channel.
- **Not a native mention.** DSH exposes no plugin API for inserting native reference chips into the composer, so the editor holds one compact line and the real tag sits above it, one-to-one.

## How it works

- Takes over the `browser` kind (`ctx.sidebarRightTabs.register`) and registers the body on `sidebar.right.pane.tab`.
- Desktop acquires a guest: `window.dshDesktop.browser.acquire(workspace)` → `<webview src="about:blank#lease">`.
- Injects a page agent (`executeJavaScript`): Shadow DOM overlay, picker, numbered pins; the client drains it every 170ms.
- The webview's CSS box is the guest viewport (media queries are real); a `transform: scale()` wrapper fits it into the panel.
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

- `vitest`: URL normalization, fit/rotate math, element block, draft bridge, apply wiring (13 tests).
- `test/bundle.e2e.mjs`: loads the **built bundle** in Chrome with a stub module loader + fake Cordis ctx and asserts the browser takeover, tab body and dock registrations.
- `test/agent.e2e.mjs` / `test/react-agent.e2e.mjs`: real Chrome, real clicks — picking, payload, capture-phase guard, pins, Esc; the React fixture proves bippy resolves component names.
- `test/electron/spike.mjs`: on **Electron 44.7** (same major as DSH Desktop) it proves the webview viewport equals its CSS box, CSS-transform scaling renders and routes input in scaled coordinates, and `setUserAgent` + reload applies.

Not yet installed into a live DSH Desktop profile (that needs a desktop restart).

## License

MIT. Third-party notices in [NOTICE](./NOTICE).
