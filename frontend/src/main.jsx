import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import './styles/variables.css';
import './styles/theme.css';
import './styles/home.css';
import './styles/auth.css';
import './styles/dashboard.css';
import './styles/workspace.css';
import './styles/call.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
