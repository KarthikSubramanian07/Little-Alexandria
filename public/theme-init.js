// Runs before first paint. Marks the page as scripted (so the plain-HTML copy
// meant for crawlers and no-JavaScript readers steps aside for the app), and
// applies the saved theme so dark mode never flashes cream.
document.documentElement.classList.add('js')
try {
  var theme = localStorage.getItem('la-theme')
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme
} catch (e) {}
