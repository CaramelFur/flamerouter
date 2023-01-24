export function updateHist() {
  const href = window.location.href;
  const state = window.history.state ?? {};
  state.__flame = {
    url: href,
    scroll: window.scrollY,
  };
  window.history.replaceState(state, '', href);
}
