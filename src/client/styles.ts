export const CSS = `
.dbs-root {
  display: flex; flex-direction: column; height: 100%; min-height: 0; container-type: inline-size;
  font-family: inherit; font-size: 13px; color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base, transparent);
}
.dbs-root * { box-sizing: border-box; }

/* ---------------------------------------------------------------- address bar */
.dbs-bar {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 10px 6px; flex: none;
}
.dbs-nav { display: flex; align-items: center; gap: 1px; flex: none; }
.dbs-iconBtn {
  width: 30px; height: 30px; padding: 0; display: inline-flex; align-items: center; justify-content: center;
  border: 0; border-radius: 8px; background: transparent; color: var(--dsw-alias-label-secondary);
  cursor: pointer; transition: background 120ms ease, color 120ms ease;
}
.dbs-iconBtn:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dbs-iconBtn:active:not(:disabled) { background: var(--dsw-alias-bg-layer-3); }
.dbs-iconBtn:disabled { opacity: .35; cursor: default; }
.dbs-addrWrap {
  flex: 1 1 auto; min-width: 80px; height: 32px; display: flex; align-items: center; gap: 7px;
  padding: 0 8px 0 10px; border-radius: 9px;
  border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.dbs-addrWrap:focus-within {
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6fed) 55%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6fed) 12%, transparent);
}
.dbs-addrIcon { display: inline-flex; color: var(--dsw-alias-label-tertiary); flex: none; }
.dbs-addr {
  flex: 1 1 auto; min-width: 0; height: 100%; border: 0; outline: 0; padding: 0;
  background: transparent; color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 12.5px; letter-spacing: .1px;
}
.dbs-addr::placeholder { color: var(--dsw-alias-label-tertiary); }
.dbs-go {
  flex: none; width: 22px; height: 22px; border: 0; border-radius: 6px; cursor: pointer;
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary);
  display: inline-flex; align-items: center; justify-content: center;
}
.dbs-go:hover { background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary); }

/* ---------------------------------------------------------------- device bar */
.dbs-deviceBar {
  position: relative; display: flex; align-items: center; gap: 6px; flex: none;
  padding: 2px 10px 8px; border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.dbs-chip {
  height: 27px; padding: 0 8px; display: inline-flex; align-items: center; gap: 5px;
  border-radius: 7px; border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 12px; cursor: pointer; white-space: nowrap;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.dbs-chip:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dbs-chip svg { opacity: .8; }
.dbs-deviceChip { max-width: 168px; }
.dbs-deviceChip span { overflow: hidden; text-overflow: ellipsis; }
.dbs-chevron { margin-left: -1px; opacity: .55; }
.dbs-sizeChip {
  border-color: transparent; background: transparent; padding: 0 2px;
  color: var(--dsw-alias-label-tertiary); cursor: default;
  font-variant-numeric: tabular-nums; letter-spacing: .2px;
}
.dbs-sizeChip:hover { background: transparent; color: var(--dsw-alias-label-tertiary); }
.dbs-zoomChip { min-width: 48px; justify-content: center; font-variant-numeric: tabular-nums; }
.dbs-spacer { flex: 1 1 auto; }
.dbs-pickBtn {
  height: 27px; padding: 0 10px; display: inline-flex; align-items: center; gap: 6px;
  border-radius: 7px; border: 1px solid var(--dsw-alias-border-l2);
  background: transparent; color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 12px; cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.dbs-pickBtn:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dbs-pickBtn[data-on="true"] {
  color: var(--dsw-alias-brand-primary, #2f6fed);
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6fed) 45%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6fed) 13%, transparent);
}
.dbs-pickBtn:disabled { opacity: .4; cursor: default; }

/* ---------------------------------------------------------------- device menu */
.dbs-menu {
  position: absolute; top: calc(100% + 6px); left: 10px; right: 10px; z-index: 30;
  max-height: min(78vh, 560px); overflow: hidden; padding: 4px; display: flex; flex-direction: column;
  border-radius: 12px; border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: 0 12px 32px rgba(0,0,0,.28), 0 2px 6px rgba(0,0,0,.18);
}
.dbs-menuScroll {
  overflow: auto; min-height: 0; padding: 6px 2px 10px;
  mask-image: linear-gradient(to bottom, #000 calc(100% - 18px), transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 18px), transparent 100%);
}
.dbs-section { padding: 6px 2px; flex: none; }
.dbs-section + .dbs-section, .dbs-menuScroll + .dbs-section { border-top: 1px solid var(--dsw-alias-border-l1); }
.dbs-sectionLabel {
  padding: 2px 8px 6px; font-size: 11px; color: var(--dsw-alias-label-tertiary); letter-spacing: .2px;
}
.dbs-row {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 6px 8px; border: 0; border-radius: 7px; background: transparent;
  color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; text-align: left; cursor: pointer;
}
.dbs-row:hover { background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary); }
.dbs-row[data-active="true"] { color: var(--dsw-alias-brand-primary, #2f6fed); }
.dbs-row small {
  font-size: 11px; color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums;
}
.dbs-row[data-active="true"] small { color: inherit; opacity: .75; }
.dbs-sizeRow { display: flex; align-items: center; gap: 6px; padding: 2px 6px; }
.dbs-num {
  width: 74px; height: 27px; padding: 0 6px; border-radius: 7px; text-align: center;
  border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px;
  font-variant-numeric: tabular-nums; outline: none;
}
.dbs-num:focus { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6fed) 55%, transparent); }
.dbs-times { color: var(--dsw-alias-label-tertiary); font-size: 11px; }
.dbs-seg {
  display: flex; gap: 2px; padding: 2px; border-radius: 9px;
  background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1);
}
.dbs-segBtn {
  flex: 1 1 0; height: 24px; border: 0; border-radius: 7px; background: transparent;
  color: var(--dsw-alias-label-secondary); font: inherit; font-size: 11.5px; cursor: pointer;
}
.dbs-segBtn:hover { color: var(--dsw-alias-label-primary); }
.dbs-segBtn[data-active="true"] {
  background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary);
  box-shadow: 0 1px 2px rgba(0,0,0,.16);
}
.dbs-toggleRow {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 6px 8px; font-size: 12px; color: var(--dsw-alias-label-secondary);
}
.dbs-toggleRow[data-disabled="true"] { opacity: .45; }
.dbs-switch {
  position: relative; width: 34px; height: 20px; flex: none; padding: 0; border: 0; border-radius: 999px;
  background: var(--dsw-alias-bg-layer-3); cursor: pointer; transition: background 140ms ease;
}
.dbs-switch[data-on="true"] { background: var(--dsw-alias-brand-primary, #2f6fed); }
.dbs-switch::after {
  content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.3); transition: transform 140ms ease;
}
.dbs-switch[data-on="true"]::after { transform: translateX(14px); }
.dbs-switch:disabled { cursor: default; }

/* ---------------------------------------------------------------- viewport */
.dbs-viewport {
  position: relative; flex: 1 1 auto; min-height: 0; overflow: auto;
  display: flex; align-items: safe center; justify-content: safe center; padding: 16px;
  background:
    radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--dsw-alias-bg-layer-2) 55%, transparent), transparent 70%),
    var(--dsw-alias-bg-layer-1);
}
.dbs-viewport[data-responsive="true"] { padding: 0; align-items: stretch; justify-content: stretch; }
.dbs-stage { position: relative; flex: none; }
.dbs-canvas {
  position: relative; transform-origin: top left; background: #fff; overflow: hidden;
  box-shadow: 0 0 0 1px var(--dsw-alias-border-l1), 0 10px 28px rgba(0,0,0,.22), 0 2px 6px rgba(0,0,0,.12);
}
.dbs-frame { border: 8px solid #101012; border-radius: 26px; background: #101012;
  box-shadow: 0 18px 44px rgba(0,0,0,.36), 0 4px 10px rgba(0,0,0,.24); }
.dbs-frame .dbs-canvas { border-radius: 18px; box-shadow: none; }
.dbs-notch {
  position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  width: 84px; height: 20px; border-radius: 11px; background: #0b0b0c; z-index: 4; pointer-events: none;
}
.dbs-guest { display: flex; width: 100%; height: 100%; border: 0; background: #fff; }
.dbs-iframe { display: block; width: 100%; height: 100%; border: 0; background: #fff; }

/* ---------------------------------------------------------------- status + overlays */
.dbs-status {
  flex: none; display: flex; align-items: center; justify-content: space-between; gap: 10px;
  height: 27px; padding: 0 12px; border-top: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-tertiary); font-size: 11px; white-space: nowrap;
}
.dbs-status span { overflow: hidden; text-overflow: ellipsis; }
.dbs-status .dbs-dot { opacity: .45; margin: 0 4px; }
.dbs-start {
  position: absolute; inset: 0; z-index: 5; display: flex; align-items: center; justify-content: center;
  padding: 24px 18px; overflow: auto; pointer-events: none;
  background:
    radial-gradient(130% 70% at 50% 8%, color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6fed) 12%, transparent), transparent 62%),
    radial-gradient(rgba(255,255,255,.035) 1px, transparent 1px) 0 0 / 16px 16px,
    var(--dsw-alias-bg-layer-1);
}
.dbs-startCard {
  width: 100%; max-width: 312px; display: flex; flex-direction: column; gap: 14px; pointer-events: auto;
}
.dbs-startArt {
  width: 54px; height: 54px; margin: 0 auto 2px; border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  color: var(--dsw-alias-brand-primary, #2f6fed);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6fed) 12%, var(--dsw-alias-bg-layer-2));
  border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6fed) 32%, transparent);
  box-shadow: 0 12px 32px color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6fed) 16%, transparent);
}
.dbs-startTitle { text-align: center; font-size: 15px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.dbs-startSub { margin: 0; text-align: center; font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-tertiary); }
.dbs-startForm {
  display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 6px 0 11px;
  border-radius: 10px; border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-tertiary);
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.dbs-startForm:focus-within {
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6fed) 55%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6fed) 12%, transparent);
}
.dbs-startInput {
  flex: 1 1 auto; min-width: 0; height: 100%; padding: 0; border: 0; outline: 0;
  background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 12.5px;
}
.dbs-startInput::placeholder { color: var(--dsw-alias-label-tertiary); }
.dbs-startGo {
  flex: none; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 8px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6fed) 16%, transparent);
  color: var(--dsw-alias-brand-primary, #2f6fed); transition: background 120ms ease;
}
.dbs-startGo:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6fed) 28%, transparent); }
.dbs-startSection { display: flex; flex-direction: column; gap: 6px; }
.dbs-startLabel { padding: 0 2px; font-size: 11px; color: var(--dsw-alias-label-tertiary); }
.dbs-startChips { display: flex; flex-wrap: wrap; gap: 6px; }
.dbs-startChip {
  height: 26px; padding: 0 9px; border-radius: 7px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary); font: inherit; font-size: 11.5px;
}
.dbs-startChip:hover { background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary); }
.dbs-recentList { display: flex; flex-direction: column; gap: 1px; }
.dbs-recentRow {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px;
  border: 0; border-radius: 7px; background: transparent; cursor: pointer; text-align: left;
  color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px;
}
.dbs-recentRow:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dbs-recentRow svg { flex: none; opacity: .55; }
.dbs-recentUrl {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11.5px;
}
.dbs-error {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
  max-width: 340px; padding: 12px 14px; border-radius: 11px; text-align: center;
  border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 1.6;
  box-shadow: 0 10px 28px rgba(0,0,0,.22);
}
.dbs-toast {
  position: absolute; left: 50%; bottom: 40px; transform: translateX(-50%);
  padding: 6px 12px; border-radius: 999px; font-size: 12px; white-space: nowrap;
  background: rgba(17,24,39,.92); color: #fff; box-shadow: 0 6px 18px rgba(0,0,0,.28);
  z-index: 6; pointer-events: none;
}
.dbs-pickHint {
  position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%);
  display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 999px;
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6fed) 92%, black);
  color: #fff; font-size: 11.5px; white-space: nowrap; pointer-events: none; z-index: 6;
  box-shadow: 0 6px 18px rgba(0,0,0,.28);
}
.dbs-loading {
  position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  padding: 3px 10px; border-radius: 999px; font-size: 11px;
  background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-secondary);
  border: 1px solid var(--dsw-alias-border-l2); z-index: 5;
}
/* ---------------------------------------------------------------- ref chips */
.dbs-refs {
  display: flex; flex-wrap: wrap; gap: 6px; padding: 0 14px 8px;
}
.dbs-refChip {
  display: inline-flex; align-items: center; gap: 6px; max-width: 100%;
  height: 26px; padding: 0 4px 0 9px; border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary); font-size: 11.5px; line-height: 1;
  box-shadow: 0 1px 2px rgba(0,0,0,.08);
}
.dbs-refIcon { display: inline-flex; flex: none; color: var(--dsw-alias-brand-primary, #2f6fed); }
.dbs-refChip b { flex: none; font-weight: 600; color: var(--dsw-alias-label-primary); }
.dbs-refNote {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;
  color: var(--dsw-alias-label-primary); font-size: 11.5px;
}
.dbs-refLabel {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; opacity: .7;
}
.dbs-refRemove {
  flex: none; width: 18px; height: 18px; padding: 0; border: 0; border-radius: 50%;
  background: transparent; color: var(--dsw-alias-label-tertiary); cursor: pointer;
  font-size: 13px; line-height: 1; display: inline-flex; align-items: center; justify-content: center;
}
.dbs-refRemove:hover { background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary); }

/* ---------------------------------------------------------- annotation pop */
.dbs-pop {
  position: absolute; z-index: 12; display: flex; flex-direction: column; gap: 8px;
  padding: 9px 10px 10px; border-radius: 14px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 92%, #000);
  box-shadow: 0 18px 44px rgba(0,0,0,.42), 0 2px 8px rgba(0,0,0,.24);
}
.dbs-popHead { display: flex; align-items: center; gap: 6px; min-width: 0; }
.dbs-popKicker { flex: none; font-size: 11px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.dbs-popTarget {
  flex: 1 1 auto; min-width: 0; font-size: 11px; color: var(--dsw-alias-label-tertiary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dbs-popClose {
  flex: none; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 50%;
  background: transparent; color: var(--dsw-alias-label-tertiary);
  font-size: 14px; line-height: 1; cursor: pointer;
}
.dbs-popClose:hover { background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary); }
.dbs-popRow {
  display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 5px 0 10px;
  border-radius: 10px; border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  transition: border-color 120ms ease;
}
.dbs-popRow:focus-within {
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6fed) 50%, transparent);
}
.dbs-popLink { display: inline-flex; flex: none; color: var(--dsw-alias-brand-primary, #2f6fed); }
.dbs-popInput {
  flex: 1 1 auto; min-width: 0; height: 100%; border: 0; outline: 0; padding: 0;
  background: transparent; color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 12.5px;
}
.dbs-popInput::placeholder { color: var(--dsw-alias-label-tertiary); }
.dbs-popSend {
  flex: none; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6fed) 16%, transparent);
  color: var(--dsw-alias-brand-primary, #2f6fed);
  transition: background 120ms ease;
}
.dbs-popSend:disabled { opacity: .35; cursor: default; }
.dbs-popSend:not(:disabled):hover {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6fed) 28%, transparent);
}

/* narrow sidebars */
@container (max-width: 372px) {
  .dbs-sizeChip { display: none; }
}
@container (max-width: 344px) {
  .dbs-zoomChip { display: none; }
  .dbs-deviceChip { max-width: 150px; }
}
@container (max-width: 302px) {
  .dbs-pickBtn span { display: none; }
  .dbs-pickBtn { padding: 0 7px; }
  .dbs-deviceChip { max-width: 132px; }
}
`
