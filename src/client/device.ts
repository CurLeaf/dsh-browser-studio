import { PRESET_BY_ID, type Preset } from './presets'

export type Zoom = 'fit' | number

/** Zoom choices offered next to the size fields; "fit" is always first. */
export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5] as const

export interface DeviceState {
  /** `responsive` fills the panel; otherwise a preset id or `custom`. */
  presetId: string
  width: number
  height: number
  zoom: Zoom
  uaMobile: boolean
  frame: boolean
  portrait: boolean
  /** Pixel rulers drawn around the simulated viewport. */
  rulers: boolean
}

export const DEFAULT_DEVICE: DeviceState = {
  presetId: 'responsive',
  width: 1280,
  height: 800,
  zoom: 'fit',
  uaMobile: false,
  frame: false,
  portrait: true,
  rulers: false,
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function presetFor(id: string): Preset | null {
  return PRESET_BY_ID.get(id) ?? null
}

/** Size of the simulated viewport, before zoom. */
export function viewportSize(state: DeviceState, avail: { w: number; h: number }): { w: number; h: number } {
  if (state.presetId === 'responsive') {
    return { w: Math.max(240, Math.round(avail.w)), h: Math.max(320, Math.round(avail.h)) }
  }
  return { w: Math.max(120, Math.round(state.width)), h: Math.max(120, Math.round(state.height)) }
}

/** Visual scale applied around the fixed viewport. */
export function computeScale(
  state: DeviceState,
  avail: { w: number; h: number },
  padding = 24,
): number {
  if (state.presetId === 'responsive') return 1
  const { w, h } = viewportSize(state, avail)
  if (state.zoom !== 'fit') return clamp(Number.isFinite(state.zoom) ? state.zoom : 1, 0.1, 4)
  const fit = Math.min((avail.w - padding) / w, (avail.h - padding) / h)
  return clamp(Number.isFinite(fit) ? fit : 1, 0.1, 1)
}

export function applyPreset(state: DeviceState, preset: Preset): DeviceState {
  return {
    ...state,
    presetId: preset.id,
    width: preset.width,
    height: preset.height,
    portrait: preset.height >= preset.width,
    zoom: 'fit',
    uaMobile: preset.mobile,
    frame: preset.mobile || preset.id.startsWith('ipad'),
  }
}

/** A portrait preset that the user has rotated into landscape. */
export function isLandscape(state: DeviceState, preset: Preset | null): boolean {
  return preset !== null && preset.width < preset.height && state.width > state.height
}

export function normalizeUrl(input: string): string {
  const raw = input.trim()
  if (raw === '') return ''
  let candidate = raw
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) {
    // A scheme-like prefix is only accepted when it is really host:port.
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
      const rest = raw.slice(raw.indexOf(':') + 1)
      if (!/^\d+([/?#]|$)/.test(rest)) return ''
    }
    const loopback =
      /^(localhost|127\.|0\.0\.0\.0|\[::1\]|\d{1,3}(\.\d{1,3}){3})(:\d+)?([/?#]|$)/i.test(raw)
    candidate = `${loopback ? 'http://' : 'https://'}${raw}`
  }
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    if (url.username !== '' || url.password !== '') return ''
    return url.href
  } catch {
    return ''
  }
}

export function formatSize(w: number, h: number): string {
  return `${w} × ${h}`
}
