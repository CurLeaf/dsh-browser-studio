# dsh-browser-studio

Turn the DeepSeek Harness built-in browser into a browser studio: **preview at device sizes**, **pick page elements**, and drop their context straight into the session.

- Device toolbar: presets, custom width/height, rotate, fit-to-panel, device frame, mobile UA
- Element picker: hover highlight, click to select, captures selector, DOM path, text, box, styles and React component name (Desktop)
- One click into the chat: inserts into the composer (Cursor-style), falls back to a direct message
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
4. Press `⊕` to start picking: hover highlights the element, click adds it to the composer; `Esc` exits.
5. Add an instruction in the composer and send.

## Deliberate limits

- **No DPR or touch emulation.** DSH exposes no CDP seam to plugins; only the viewport size and the UA are real.
- **Cross-origin iframes stay opaque.** Browser security model; Cursor has the same limit.
- **Page data is untrusted.** The block is generated from page DOM inside the page's main world; review before sending.
- **No picking on Web.** Without a guest lease there is no injection channel.

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

## License

MIT. Third-party notices in [NOTICE](./NOTICE).
