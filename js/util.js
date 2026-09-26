export const $ = id => document.getElementById(id);

export function fmtAge(s) {
  if (s < 60) return s + ' s';
  if (s < 3600) return Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0');
  return Math.floor(s / 3600) + ' h ' + String(Math.floor(s / 60) % 60).padStart(2, '0');
}

export const fmtWhen = t => new Date(t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
