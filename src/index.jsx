import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App'; // Extensie verwijderd; bundler zoekt nu automatisch naar .js, .jsx, etc.
import './index.css'; // Dit moet werken als index.css in de src/ map staat

// Zoek de root DOM-node
const container = document.getElementById('root');
const root = createRoot(container);

// Render de hoofdapplicatie
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
