
// Inject a left-side navigation rail and mark the active item.
// Also adds a class to shift page content to the right of the rail.

function initLeftNav() {
  // Ensure Material Symbols Rounded (modern look)
  if (!document.querySelector('link[href*="Material+Symbols+Rounded"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0';
    document.head.appendChild(link);
  }

  document.documentElement.classList.add('has-left-rail');

  const items = [
    { href: 'index.html',         icon: 'home',      label: 'Home (Map)' },
    { href: 'route_planner.html', icon: 'directions',  label: 'Directions' },
  ];

  const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  const nav = document.createElement('nav');
  nav.className = 'left-nav';
  nav.setAttribute('aria-label', 'Primary');

  const top = document.createElement('div');
  top.className = 'nav-group';

  items.forEach(it => {
    const active = file === it.href.toLowerCase() || (file === '' && it.href === 'index.html');
    const a = document.createElement('a');
    a.className = 'rail-item' + (active ? ' active' : '');
    a.href = it.href;
    a.setAttribute('aria-label', it.label);
    if (active) a.setAttribute('aria-current', 'page');
    a.dataset.tooltip = it.label;
    a.innerHTML = `<span class="material-symbols-rounded">${it.icon}</span>`;
    top.appendChild(a);
  });

  const spacer = document.createElement('div');
  spacer.className = 'nav-spacer';

  nav.appendChild(top);
  nav.appendChild(spacer);
  document.body.appendChild(nav);
};

initLeftNav();
