// Pause decorative CSS loops outside the viewport and in background tabs.
(() => {
  const tracked = new Set();
  const seen = new WeakMap();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      seen.set(entry.target, entry.isIntersecting);
      entry.target.classList.toggle('motion-paused', !entry.isIntersecting || document.hidden);
    }
  });
  const refresh = () => {
    for (const element of tracked) if (!element.isConnected) { observer.unobserve(element); tracked.delete(element); }
    for (const element of document.querySelectorAll('.scene,.weather-art,.profile-orbit,.intro-art,.loading-orb')) {
      if (tracked.has(element)) continue;
      tracked.add(element);
      observer.observe(element);
    }
  };
  document.addEventListener('visibilitychange', () => {
    for (const element of tracked) element.classList.toggle('motion-paused', document.hidden || seen.get(element) === false);
  });
  new MutationObserver(refresh).observe(document.querySelector('#app'), {childList:true, subtree:true});
  refresh();
})();
