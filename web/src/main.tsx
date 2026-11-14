import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import Inicio from './pages/Inicio';
import Agendar from './pages/Agendar';
import Cita from './pages/Cita';
import Barbero from './pages/Barbero';
import Dueno from './pages/Dueno';
import Pantalla from './pages/Pantalla';
import Privacidad from './pages/Privacidad';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/agendar" element={<Agendar />} />
        <Route path="/c/:codigo" element={<Cita />} />
        <Route path="/barbero" element={<Barbero />} />
        <Route path="/dueno" element={<Dueno />} />
        <Route path="/pantalla" element={<Pantalla />} />
        <Route path="/privacidad" element={<Privacidad />} />
        <Route path="*" element={<Inicio />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
}
