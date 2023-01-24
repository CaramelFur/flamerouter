import flamethrower from '/flamethrower.js';
flamethrower({ prefetch: 'visible', log: true, pageTransitions: true });

window.addEventListener('flamerouter:fetch-progress', ({ detail }) => {
  const loadBar = document.getElementById('load-bar');
  console.log('Fetch Progress:', detail);
  loadBar.style.width = detail.progress + '%';
});
