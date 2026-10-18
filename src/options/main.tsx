import React from 'react';
import { createRoot } from 'react-dom/client';
import { OptionsPage } from './options';
import './options.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');
createRoot(container).render(
  <React.StrictMode>
    <OptionsPage />
  </React.StrictMode>
);
