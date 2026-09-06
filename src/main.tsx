import ReactDOM from 'react-dom/client'
import { App } from './App'
import { LegalWindow } from '../components/launcher/legal/LegalWindow'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/unbounded/600.css'
import '@fontsource/unbounded/700.css'
import { hideSplash } from "./splash"
import { initI18n } from "./i18n"
import './index.css'

const root = document.getElementById('root')!
const rootEl = ReactDOM.createRoot(root)

if (new URLSearchParams(window.location.search).get('win') === 'legal') {
  // Legal window: инициализируем i18n (нужен для useTranslation), затем рендерим документы.
  void initI18n().then(() => {
    rootEl.render(<LegalWindow />)
    hideSplash()
  })
} else {
  rootEl.render(<App />)
  window.addEventListener('app:hydrated', () => {
    hideSplash()
  }, { once: true })
}