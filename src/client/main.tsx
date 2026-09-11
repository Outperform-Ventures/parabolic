import './template-history-events';
import React,{lazy,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,useLocation} from 'react-router-dom';
import './fonts.css';
import './styles.css';
import {App} from './shell';
import {installOfflineShell} from './offline-shell';
const RequesterAccount=lazy(()=>import('./requester-account'));
function Root(){const location=useLocation();return /^\/ask-access\/[A-Za-z0-9_-]+(?:\/|$)/.test(location.pathname)?<RequesterAccount/>:<App/>}
createRoot(document.getElementById('root')!).render(<BrowserRouter><Suspense fallback={<p role="status">Loading…</p>}><Root/></Suspense></BrowserRouter>);
installOfflineShell();
