// Keep the public website independent of the operational application's styles and data.
const isSystemRoute = () => window.location.hash.startsWith('#/') && !['#/site', '#/'].includes(window.location.hash);
const systemMode = isSystemRoute();
window.addEventListener('hashchange', () => {
  if (isSystemRoute() !== systemMode) window.location.reload();
});
if (systemMode) {
  document.title = 'SF TORRES — Centro Operacional';
  import('./main.jsx');
} else {
  import('./public-site.jsx');
}
