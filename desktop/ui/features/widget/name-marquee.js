export function createNameMarquee({ document, speed = 40 }) {
  function bind(item, nameElement) {
    try {
      if (!item || !nameElement) return;
      let timer = null;
      function stop() {
        try {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
          const track = nameElement.querySelector('.dshwv-nameinner');
          if (!track) return;
          track.style.transitionTimingFunction = '';
          track.style.transitionDuration = '';
          track.style.transform = '';
          while (track.children?.length > 1) track.removeChild(track.children[track.children.length - 1]);
        } catch (error) {}
      }
      function textWidth() {
        try {
          const track = nameElement.querySelector('.dshwv-nameinner');
          return track?.children?.length ? track.children[0].offsetWidth || 0 : 0;
        } catch (error) { return 0; }
      }
      function ensureDuplicate() {
        const track = nameElement.querySelector('.dshwv-nameinner');
        if (!track || !track.children || track.children.length >= 2) return track;
        const copy = document.createElement('span');
        copy.className = 'dshwv-namecopy';
        copy.textContent = track.children[0].textContent;
        track.appendChild(copy);
        return track;
      }
      function cycle() {
        const track = nameElement.querySelector('.dshwv-nameinner');
        if (!track) return;
        const distance = track.scrollWidth / 2;
        const duration = Math.max(200, distance / speed * 1000);
        timer = setTimeout(cycle, duration + 40);
        track.style.transitionTimingFunction = 'linear';
        track.style.transitionDuration = '0ms';
        track.style.transform = 'translateX(0px)';
        void track.offsetWidth;
        track.style.transitionDuration = duration + 'ms';
        track.style.transform = 'translateX(' + -distance + 'px)';
      }
      item.addEventListener('mouseenter', () => {
        try {
          stop();
          if (textWidth() <= nameElement.clientWidth + 1) return;
          ensureDuplicate();
          cycle();
        } catch (error) {}
      });
      item.addEventListener('mouseleave', stop);
    } catch (error) {}
  }

  function makeCell(className, text) {
    const outer = document.createElement('span');
    outer.className = className;
    const inner = document.createElement('span');
    inner.className = 'dshwv-nameinner';
    const copy = document.createElement('span');
    copy.className = 'dshwv-namecopy';
    copy.textContent = text;
    inner.appendChild(copy);
    outer.appendChild(inner);
    return outer;
  }

  return Object.freeze({ bind, makeCell });
}
