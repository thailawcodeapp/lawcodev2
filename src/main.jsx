import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// Wave's fonts, bundled so they work offline (spec 2.5). Classic never uses
// these families, so the browser never downloads the files there.
import '@fontsource/anuphan/400.css';
import '@fontsource/anuphan/500.css';
import '@fontsource/anuphan/600.css';
import '@fontsource/anuphan/700.css';
import '@fontsource/ibm-plex-sans-thai-looped/400.css';
import '@fontsource/ibm-plex-sans-thai-looped/500.css';
import './styles/wave.css';
import './styles/stats.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
