import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
// latin-only subsets: the full imports ship every unicode-range file (~50
// font files per build), which burns through pinning-service file quotas.
// Non-latin glyphs fall back to system fonts.
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-700.css'
import './index.css'
import { CONFIG } from './config'

// Shared bootstrap for both entry points (index.html and eas-setup.html):
// fonts, stylesheet, accent override, StrictMode root.
export function mount(node: ReactNode): void {
  if (CONFIG.accent) document.documentElement.style.setProperty('--accent', CONFIG.accent)
  createRoot(document.getElementById('root')!).render(<StrictMode>{node}</StrictMode>)
}
