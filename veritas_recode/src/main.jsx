import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { primeCurrency } from '@/lib/useMoney'

// Start resolving the institution currency immediately so every amount
// across the app renders with the correct symbol from first paint.
primeCurrency()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)