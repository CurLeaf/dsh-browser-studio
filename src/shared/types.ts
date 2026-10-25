export type Rect = { x: number; y: number; w: number; h: number }

export interface ReactInfo {
  name?: string
  file?: string
  line?: number
  component?: string
}

export interface ElementRef {
  selector: string
  domPath: string
  tag: string
  idAttr: string
  classes: string[]
  attrs: Record<string, string>
  text: string
  rect: Rect
  styles: Record<string, string>
  react?: ReactInfo
  pageUrl: string
}

export interface Pin {
  n: number
  selector: string
}

export type AgentEvent = { kind: 'pick'; ref: ElementRef } | { kind: 'esc' }

export interface DrainResult {
  events: AgentEvent[]
}
