export const CSS = `
.dbs-root {
  display: flex; flex-direction: column; height: 100%; min-height: 0;
  font-family: inherit; font-size: 13px; color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base, transparent);
}
.dbs-root * { box-sizing: border-box; }
.dbs-bar { display: flex; align-items: center; gap: 6px; padding: 8px 10px 6px; flex: none; }
.dbs-device { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 0 10px 8px; flex: none; }
.dbs-icon {
  flex: none; width: 26px; height: 26px; padding: 0; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 7px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 1; cursor: pointer;
}
.dbs-icon:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary); }
.dbs-icon:disabled { opacity: .38; cursor: default; }
.dbs-icon[data-on="true"] {
  color: var(--dsw-alias-brand-primary, #2f6fed);
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6fed) 45%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6fed) 12%, transparent);
}
.dbs-addrForm { flex: 1 1 auto; min-width: 80px; display: flex; }
.dbs-addr {
  width: 100%; height: 26px; padding: 0 9px; border-radius: 7px;
  border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary); font-size: 12px; outline: none;
}
.dbs-addr:focus { border-color: var(--dsw-alias-brand-primary, #2f6fed); }
.dbs-select {
  height: 26px; padding: 0 6px; border-radius: 7px; max-width: 150px;
  border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary); font-size: 12px; outline: none;
}
.dbs-num {
  width: 56px; height: 26px; padding: 0 4px; border-radius: 7px; text-align: center;
  border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary); font-size: 12px; outline: none;
}
.dbs-dim { color: var(--dsw-alias-label-tertiary); font-size: 11px; }
.dbs-viewport {
  position: relative; flex: 1 1 auto; min-height: 0; overflow: auto;
  display: flex; align-items: safe center; justify-content: safe center;
  padding: 12px; background: var(--dsw-alias-bg-layer-1);
}
.dbs-viewport[data-responsive="true"] { padding: 0; align-items: stretch; justify-content: stretch; }
.dbs-stage { position: relative; flex: none; }
.dbs-canvas { position: relative; transform-origin: top left; background: #fff; overflow: hidden; }
.dbs-frame {
  border: 10px solid #1c1c1e; border-radius: 34px; box-shadow: 0 12px 32px rgba(0,0,0,.28);
  overflow: hidden; background: #000;
}
.dbs-frame .dbs-canvas { border-radius: 24px; }
.dbs-notch {
  position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
  width: 86px; height: 22px; border-radius: 12px; background: #0b0b0c; z-index: 4; pointer-events: none;
}
.dbs-guest { display: flex; width: 100%; height: 100%; border: 0; background: #fff; }
.dbs-iframe { display: block; width: 100%; height: 100%; border: 0; background: #fff; }
.dbs-status {
  flex: none; display: flex; align-items: center; gap: 8px; padding: 4px 12px 6px;
  color: var(--dsw-alias-label-tertiary); font-size: 11px; white-space: nowrap; overflow: hidden;
  border-top: 1px solid var(--dsw-alias-border-l1);
}
.dbs-status span { overflow: hidden; text-overflow: ellipsis; }
.dbs-start {
  position: absolute; inset: 0; display: flex; flex-direction: column; gap: 6px;
  align-items: center; justify-content: center; padding: 24px; text-align: center;
  color: var(--dsw-alias-label-secondary); pointer-events: none;
}
.dbs-start b { font-size: 14px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.dbs-start small { font-size: 12px; color: var(--dsw-alias-label-tertiary); max-width: 320px; line-height: 1.5; }
.dbs-error {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
  max-width: 340px; padding: 10px 12px; border-radius: 10px; text-align: center;
  border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 1.6;
}
.dbs-toast {
  position: absolute; left: 50%; bottom: 42px; transform: translateX(-50%);
  padding: 6px 12px; border-radius: 999px; font-size: 12px; white-space: nowrap;
  background: rgba(17,24,39,.92); color: #fff; box-shadow: 0 6px 18px rgba(0,0,0,.28);
  z-index: 6; pointer-events: none;
}
.dbs-loading {
  position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  padding: 3px 10px; border-radius: 999px; font-size: 11px;
  background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-secondary);
  border: 1px solid var(--dsw-alias-border-l2); z-index: 5;
}
`
