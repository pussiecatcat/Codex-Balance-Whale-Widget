export function createNameMarquee({ document, speed = 40 }) {
  function bind(item, nameElement) {
    try {
      if (!item || !nameElement) return () => {};
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
        // The row this was bound to may have been replaced while the pointer was
        // still over it, and a replaced row never fires mouseleave. A detached
        // node has nothing to animate, so release it rather than keep the
        // closure — and this timer — alive for the life of the widget.
        if (nameElement.isConnected === false) { stop(); return; }
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
      const onEnter = () => {
        try {
          stop();
          if (textWidth() <= nameElement.clientWidth + 1) return;
          ensureDuplicate();
          cycle();
        } catch (error) {}
      };
      item.addEventListener('mouseenter', onEnter);
      item.addEventListener('mouseleave', stop);
      // Callers that rebuild a list should call this rather than hoping the
      // pointer leaves first.
      return () => {
        stop();
        try {
          item.removeEventListener('mouseenter', onEnter);
          item.removeEventListener('mouseleave', stop);
        } catch (error) {}
      };
    } catch (error) { return () => {}; }
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
