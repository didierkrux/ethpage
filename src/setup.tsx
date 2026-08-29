import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/poppins/latin-700.css'
import './index.css'
import { CONFIG } from './config'
import { EasSetup } from './components/EasSetup'

if (CONFIG.accent) document.documentElement.style.setProperty('--accent', CONFIG.accent)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EasSetup />
  </StrictMode>
)
