import * as React from 'react'
import { createRoot } from 'react-dom/client'

export function SubmitButton(): React.ReactElement {
  return (
    <button id="submit" className="btn primary" data-testid="submit-order" type="button">
      提交订单
    </button>
  )
}

function App(): React.ReactElement {
  return (
    <main className="app">
      <h1>Checkout</h1>
      <form className="row" id="form">
        <input id="email" placeholder="email" />
        <SubmitButton />
      </form>
    </main>
  )
}

const root = createRoot(document.getElementById('root') as HTMLElement)
root.render(<App />)
