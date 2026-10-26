import React from 'react';
import './development-badge.css';

export function DevelopmentBadge() {
  if (!import.meta.env.DEV || import.meta.env.VITE_PARABOLIC_DEV !== '1') return null;
  return <aside className="development-badge" aria-label="Parabolic Dev — isolated workspace, hot reload enabled">DEV · Isolated workspace · Hot reload</aside>;
}
