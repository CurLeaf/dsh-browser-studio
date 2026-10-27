export const CSS = `
.dbs-root {
  --dbs-accent: #4f9cff;
  --dbs-accent-soft: color-mix(in srgb, var(--dbs-accent) 18%, transparent);
  --dbs-accent-strong: color-mix(in srgb, var(--dbs-accent) 26%, transparent);
  display: flex; flex-direction: column; height: 100%; min-height: 0; container-type: inline-size;
  font-family: inherit; font-size: 13px; color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base, transparent);
}
.dbs-root * { box-sizing: border-box; }

/* ---------------------------------------------------------------- address bar */
.dbs-bar {
  position: relative; display: flex; align-items: center; gap: 6px;
  padding: 8px 10px 6px; flex: none;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
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
.dbs-addrBox { position: relative; flex: 1 1 auto; min-width: 80px; display: flex; }
.dbs-addrWrap {
  flex: 1 1 auto; min-width: 80px; height: 32px; display: flex; align-items: center; gap: 7px;
  padding: 0 8px 0 12px; border-radius: 9px;
  border: 1px solid transparent; background: transparent;
  transition: background 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
}
.dbs-addrWrap:hover { background: var(--dsw-alias-bg-layer-2); }
/* Editing is indicated by the selection and caret, never by a focus ring. */
.dbs-addrWrap:focus-within { background: var(--dsw-alias-bg-layer-2); border-color: transparent; box-shadow: none; }
.dbs-addr {
  flex: 1 1 auto; min-width: 0; height: 100%; border: 0; outline: 0; padding: 0;
  background: transparent; color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 12.5px; letter-spacing: .1px;
}
.dbs-addr::placeholder { color: var(--dsw-alias-label-tertiary); }
.dbs-moreBtn[aria-expanded="true"] {
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
}
.dbs-moreMenu {
  position: absolute; top: calc(100% + 2px); right: 8px; z-index: 60;
  width: 208px; padding: 6px; display: flex; flex-direction: column;
  border-radius: 13px; border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: 0 18px 46px rgba(0,0,0,.38), 0 2px 8px rgba(0,0,0,.2);
}
.dbs-moreRow {
  width: 100%; height: 32px; padding: 0 10px; border: 0; border-radius: 8px;
  display: flex; align-items: center; background: transparent;
  color: var(--dsw-alias-label-primary); font: inherit; font-size: 12.5px;
  text-align: left; white-space: nowrap; cursor: pointer;
}
.dbs-moreRow:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-3); }
.dbs-moreRow:disabled { color: var(--dsw-alias-label-tertiary); opacity: .55; cursor: default; }
.dbs-moreSep { height: 1px; margin: 5px 6px; background: var(--dsw-alias-border-l1); flex: none; }

/* ---------------------------------------------------------------- device tools */
.dbs-toolBtn { width: 30px; height: 30px; }
.dbs-toolBtn[aria-disabled="true"] { opacity: .4; }
.dbs-toolBtn[aria-disabled="true"]:hover:not(:disabled) {
  background: transparent; color: var(--dsw-alias-label-secondary);
}
.dbs-toolBtn[data-on="true"] {
  color: var(--dbs-accent);
  background: var(--dbs-accent-soft);
}
.dbs-toolBtn[aria-expanded="true"] {
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
}
.dbs-toolBtn[data-on="true"]:hover:not(:disabled) {
  background: var(--dbs-accent-strong);
  color: var(--dbs-accent);
}
.dbs-barSep {
  width: 1px; height: 18px; flex: none; margin: 0 1px;
  background: var(--dsw-alias-border-l1);
}
.dbs-zoomWrap { position: relative; flex: none; }
.dbs-zoomBtn {
  display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 6px 0 8px;
  border-radius: 7px; border: 1px solid transparent;
  background: transparent; color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 11.5px; font-variant-numeric: tabular-nums; cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
/* Same treatment as the size fields: no border, fill on hover/open only. */
.dbs-zoomBtn:hover, .dbs-zoomBtn[aria-expanded="true"] {
  background: var(--dsw-alias-bg-layer-2); border-color: transparent;
  color: var(--dsw-alias-label-primary);
}
.dbs-zoomBtn svg { opacity: .55; flex: none; }
.dbs-zoomMenu {
  position: absolute; left: 0; top: calc(100% + 6px); z-index: 40;
  width: 196px; padding: 6px; display: flex; flex-direction: column;
  border-radius: 12px; border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: 0 14px 34px rgba(0,0,0,.34), 0 2px 6px rgba(0,0,0,.18);
}
.dbs-zoomRow {
  display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 8px;
  border: 0; border-radius: 7px; background: transparent; text-align: left;
  color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12.5px; cursor: pointer;
}
.dbs-zoomRow:hover { background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary); }
.dbs-zoomRow[data-active="true"] { color: var(--dsw-alias-label-primary); }
.dbs-zoomCheck {
  width: 14px; flex: none; display: inline-flex; align-items: center; justify-content: center;
  color: var(--dbs-accent);
}
.dbs-zoomValue {
  margin-left: auto; color: var(--dsw-alias-label-tertiary);
  font-variant-numeric: tabular-nums;
}

/* ---------------------------------------------------------------- size bar */
.dbs-sizeBar {
  position: relative; flex: none; display: flex; align-items: center; gap: 10px;
  padding: 3px 10px 7px; border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.dbs-sizeDevice {
  display: inline-flex; align-items: center; gap: 4px; flex: none;
  max-width: 180px; height: 26px; padding: 0 6px;
  border: 1px solid transparent; border-radius: 7px; background: transparent;
  color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
.dbs-sizeDevice:hover, .dbs-sizeDevice[aria-expanded="true"] {
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
}
.dbs-sizeDevice span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dbs-sizeDevice svg { flex: none; opacity: .55; }
.dbs-rowMain { display: flex; align-items: center; gap: 6px; min-width: 0; }
.dbs-rowMain > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dbs-rowCheck {
  width: 12px; flex: none; display: inline-flex; align-items: center; justify-content: center;
  color: var(--dbs-accent);
}
.dbs-sizeBar .dbs-sizeRow { flex: none; padding: 0; gap: 4px; }
.dbs-sizeSep { width: 1px; height: 18px; flex: none; background: var(--dsw-alias-border-l2); }
.dbs-sizeBar .dbs-num { width: 50px; height: 26px; padding: 0 3px; font-size: 11.5px; }
.dbs-sizeBadge {
  position: absolute; top: 8px; right: 8px; z-index: 4; pointer-events: none;
  padding: 1px 6px; border-radius: 5px; font-size: 10px; line-height: 1.4;
  font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 86%, transparent);
  border: 1px solid var(--dsw-alias-border-l2);
}

/* ---------------------------------------------------------------- device menu */
.dbs-menu {
  position: absolute; top: calc(100% + 4px); right: auto; z-index: 30;
  width: min(324px, calc(100% - 16px));
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
.dbs-row[data-active="true"] { color: var(--dbs-accent); }
.dbs-row small {
  font-size: 11px; color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums;
}
.dbs-row[data-active="true"] small { color: inherit; opacity: .75; }
.dbs-sizeRow { display: flex; align-items: center; gap: 6px; padding: 2px 6px; }
.dbs-num {
  width: 74px; height: 27px; padding: 0 6px; border-radius: 7px; text-align: center;
  border: 1px solid transparent; background: transparent;
  color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px;
  font-variant-numeric: tabular-nums; outline: none;
  transition: background 120ms ease, color 120ms ease;
}
/* Like the address field: only a hover/focus fill, never a border. */
.dbs-num:hover, .dbs-num:focus { background: var(--dsw-alias-bg-layer-2); border-color: transparent; }
.dbs-times { color: var(--dsw-alias-label-tertiary); font-size: 11px; }
.dbs-toggleRow {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 6px 8px; font-size: 12px; color: var(--dsw-alias-label-secondary);
}
.dbs-toggleRow[data-disabled="true"] { opacity: .45; }
.dbs-switch {
  position: relative; width: 34px; height: 20px; flex: none; padding: 0; border: 0; border-radius: 999px;
  background: var(--dsw-alias-bg-layer-3); cursor: pointer; transition: background 140ms ease;
}
.dbs-switch[data-on="true"] { background: var(--dbs-accent); }
.dbs-switch::after {
  content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.3); transition: transform 140ms ease;
}
.dbs-switch[data-on="true"]::after { transform: translateX(14px); }
.dbs-switch:disabled { cursor: default; }

/* ---------------------------------------------------------------- viewport */
.dbs-viewport {
  position: relative; flex: 1 1 auto; min-height: 0; overflow: auto; scrollbar-gutter: stable;
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

/* ---------------------------------------------------------------- rulers */
.dbs-rulers { position: absolute; inset: 0; z-index: 6; pointer-events: none; user-select: none; }
.dbs-rulerX, .dbs-rulerY {
  position: absolute; overflow: hidden; pointer-events: auto; touch-action: none;
  background-color: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 84%, transparent);
  border: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-tertiary);
}
.dbs-rulerX {
  height: 18px; border-left: 0; border-right: 0; cursor: row-resize;
  background-image:
    repeating-linear-gradient(to right, var(--dsw-alias-label-secondary) 0 1px, transparent 1px var(--dbs-major, 24px)),
    repeating-linear-gradient(to right, var(--dsw-alias-label-tertiary) 0 1px, transparent 1px var(--dbs-half, 12px)),
    repeating-linear-gradient(to right, var(--dsw-alias-border-l2) 0 1px, transparent 1px var(--dbs-tick, 3px));
  background-repeat: repeat-x, repeat-x, repeat-x;
  background-position:
    left var(--dbs-origin, 0px) bottom,
    left var(--dbs-origin, 0px) bottom,
    left var(--dbs-origin, 0px) bottom;
  background-size: 100% 9px, 100% 5px, 100% 3px;
}
.dbs-rulerY {
  width: 18px; border-top: 0; border-bottom: 0; cursor: col-resize;
  background-image:
    repeating-linear-gradient(to bottom, var(--dsw-alias-label-secondary) 0 1px, transparent 1px var(--dbs-major, 24px)),
    repeating-linear-gradient(to bottom, var(--dsw-alias-label-tertiary) 0 1px, transparent 1px var(--dbs-half, 12px)),
    repeating-linear-gradient(to bottom, var(--dsw-alias-border-l2) 0 1px, transparent 1px var(--dbs-tick, 3px));
  background-repeat: repeat-y, repeat-y, repeat-y;
  background-position:
    right 0 top var(--dbs-origin, 0px),
    right 0 top var(--dbs-origin, 0px),
    right 0 top var(--dbs-origin, 0px);
  background-size: 9px 100%, 5px 100%, 3px 100%;
}
.dbs-rulerLabel {
  position: absolute; top: 2px; transform: translateX(-50%);
  font-size: 9px; line-height: 1; white-space: nowrap;
  font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary);
}
.dbs-rulerLabelY {
  left: 6px; top: auto; transform: translate(-50%, -50%) rotate(-90deg); transform-origin: center;
}

.dbs-guide { position: absolute; z-index: 2; pointer-events: auto; touch-action: none; }
.dbs-guideX { width: 7px; margin-left: -3px; cursor: col-resize; }
.dbs-guideY { height: 7px; margin-top: -3px; cursor: row-resize; }
.dbs-guide::after { content: ""; position: absolute; background: #ff2d55; opacity: .9; }
.dbs-guideX::after { left: 3px; top: 0; bottom: 0; width: 1px; }
.dbs-guideY::after { top: 3px; left: 0; right: 0; height: 1px; }
.dbs-guide[data-dragging="true"]::after { opacity: 1; box-shadow: 0 0 0 1px rgba(255,45,85,.45); }
.dbs-guideTag {
  position: absolute; display: none; padding: 1px 4px; border-radius: 4px;
  background: #ff2d55; color: #fff; font-size: 9px; line-height: 1.35;
  font-variant-numeric: tabular-nums; white-space: nowrap; pointer-events: none;
}
.dbs-guide[data-dragging="true"] .dbs-guideTag { display: block; }
.dbs-guideX .dbs-guideTag { left: 6px; top: 2px; }
.dbs-guideY .dbs-guideTag { top: 6px; left: 4px; }
.dbs-rulerCorner {
  position: absolute; width: 18px; height: 18px;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1);
}

/* ---------------------------------------------------------------- status + overlays */
.dbs-status {
  flex: none; display: flex; align-items: center; justify-content: space-between; gap: 10px;
  height: 27px; padding: 0 12px; border-top: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-tertiary); font-size: 11px; white-space: nowrap;
}
.dbs-status span { overflow: hidden; text-overflow: ellipsis; }
.dbs-status .dbs-dot { opacity: .45; margin: 0 4px; }
.dbs-start {
  position: absolute; inset: 0; z-index: 5; overflow: auto;
  display: flex; flex-direction: column; align-items: center;
  padding: clamp(28px, 13vh, 120px) 20px 28px;
  background: var(--dsw-alias-bg-base);
}
.dbs-startForm {
  width: min(560px, 100%); height: 42px; flex: none;
  display: flex; align-items: center; gap: 9px; padding: 0 16px;
  border-radius: 999px; border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1);
  transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
}
.dbs-startForm:focus-within {
  background: var(--dsw-alias-bg-layer-2);
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6fed) 55%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6fed) 12%, transparent);
}
.dbs-startSearch { display: inline-flex; flex: none; color: var(--dsw-alias-label-tertiary); }
.dbs-startInput {
  flex: 1 1 auto; min-width: 0; height: 100%; padding: 0; border: 0; outline: 0;
  background: transparent; color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 13.5px; letter-spacing: .1px;
}
.dbs-startInput::placeholder { color: var(--dsw-alias-label-tertiary); }
.dbs-startRecents {
  width: min(560px, 100%); margin-top: 32px; display: flex; flex-direction: column; gap: 1px;
}
.dbs-startRecentsLabel {
  padding: 0 12px 8px; font-size: 12px; color: var(--dsw-alias-label-tertiary); letter-spacing: .2px;
}
.dbs-recentRow {
  width: 100%; height: 36px; padding: 0 12px; border: 0; border-radius: 8px;
  display: flex; align-items: center; gap: 12px; background: transparent;
  color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px;
  text-align: left; cursor: pointer;
}
.dbs-recentRow:hover { background: var(--dsw-alias-bg-layer-2); }
.dbs-recentIcon { display: inline-flex; flex: none; color: var(--dsw-alias-label-tertiary); }
.dbs-recentUrl { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dbs-startEmpty { padding: 4px 12px; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.dbs-suggest {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 40;
  padding: 5px; border-radius: 12px; border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: 0 14px 34px rgba(0,0,0,.34), 0 2px 6px rgba(0,0,0,.18);
  max-height: min(340px, 65vh); overflow-y: auto; overflow-x: hidden;
  scrollbar-width: none; -ms-overflow-style: none;
}
.dbs-suggest::-webkit-scrollbar { width: 0; height: 0; display: none; }
.dbs-suggestRow {
  width: 100%; min-height: 46px; display: flex; align-items: center; gap: 10px; padding: 7px 10px;
  border: 0; border-radius: 8px; background: transparent; cursor: pointer; text-align: left;
  color: var(--dsw-alias-label-secondary); font: inherit;
  transition: background 90ms ease, color 90ms ease;
}
.dbs-suggestRow:hover { background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary); }
.dbs-suggestRow[data-active="true"] {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6fed) 20%, var(--dsw-alias-bg-layer-3));
  color: var(--dsw-alias-label-primary);
  box-shadow: inset 2px 0 0 var(--dsw-alias-brand-primary, #2f6fed);
}
.dbs-suggestRow[data-active="true"] .dbs-suggestTitle { font-weight: 600; }
.dbs-suggestRow[data-active="true"] .dbs-suggestUrl { color: var(--dsw-alias-label-secondary); }
.dbs-suggestIcon { flex: none; display: inline-flex; color: var(--dsw-alias-label-tertiary); }
.dbs-suggestText { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.dbs-suggestTitle {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-label-primary); font-size: 12.5px; line-height: 1.35;
}
.dbs-suggestUrl {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 1.35;
}
.dbs-suggestMatch {
  color: var(--dsw-alias-brand-primary, #2f6fed); background: transparent;
  font-weight: 600;
}
.dbs-suggestHint { flex: none; font-size: 10.5px; color: var(--dsw-alias-label-tertiary); }
.dbs-chip {
  height: 27px; padding: 0 10px; display: inline-flex; align-items: center; gap: 5px;
  border-radius: 7px; border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 12px; cursor: pointer; white-space: nowrap;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.dbs-chip:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dbs-chip svg { opacity: .8; }
.dbs-error {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
  max-width: 340px; padding: 12px 14px; border-radius: 11px; text-align: center;
  border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 1.6;
  box-shadow: 0 10px 28px rgba(0,0,0,.22); z-index: 8;
}
.dbs-toast {
  position: absolute; left: 50%; bottom: 40px; transform: translateX(-50%);
  padding: 6px 12px; border-radius: 999px; font-size: 12px; white-space: nowrap;
  background: rgba(17,24,39,.92); color: #fff; box-shadow: 0 6px 18px rgba(0,0,0,.28);
  z-index: 6; pointer-events: none;
}
.dbs-stage[data-picking="true"] {
  cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' fill='%234f9cff' stroke='%23fff' stroke-width='1.5'/%3E%3Ccircle cx='8' cy='10.5' r='1.2' fill='%23fff'/%3E%3Ccircle cx='12' cy='10.5' r='1.2' fill='%23fff'/%3E%3Ccircle cx='16' cy='10.5' r='1.2' fill='%23fff'/%3E%3C/svg%3E") 4 21, crosshair;
}
.dbs-stage[data-picking="true"]::after {
  content: ''; position: absolute; inset: var(--dbs-frame-inset, 0); pointer-events: none; z-index: 24;
  border: 2px solid var(--dbs-accent); border-radius: 2px;
}
.dbs-pickBar {
  flex: none; display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 8px 0 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary);
  font-size: 11.5px; white-space: nowrap;
}
.dbs-pickBarIcon { display: inline-flex; color: var(--dbs-accent); }
.dbs-pickBarText { overflow: hidden; text-overflow: ellipsis; }
.dbs-pickBarClose {
  width: 22px; height: 22px; flex: none; margin-left: auto; border: 0; border-radius: 6px;
  background: transparent; color: inherit; font-size: 15px; line-height: 1; cursor: pointer;
}
.dbs-pickBarClose:hover { background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary); }
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
@container (max-width: 420px) {
  .dbs-sizeDevice { display: none; }
  .dbs-zoomMenu { left: auto; right: 0; }
}
@container (max-width: 380px) {
  .dbs-bar { gap: 4px; padding: 8px 6px 6px; }
  .dbs-nav { gap: 0; }
  .dbs-nav .dbs-iconBtn, .dbs-toolBtn, .dbs-moreBtn { width: 28px; height: 28px; }
  .dbs-sizeBar { gap: 6px; padding: 3px 6px 7px; }
  .dbs-sizeBar .dbs-num { width: 44px; }
}
@container (max-width: 320px) {
  .dbs-bar { gap: 3px; padding: 8px 4px 6px; }
  .dbs-nav .dbs-iconBtn, .dbs-toolBtn, .dbs-moreBtn { width: 26px; height: 26px; }
}
`
