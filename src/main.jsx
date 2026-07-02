import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initIpadScale } from './lib/ipadScale';

initIpadScale();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
