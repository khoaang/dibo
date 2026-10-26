import { useEffect, type RefObject } from "react";

/**
 * Lets a finger drag scroll an element. On the Pi, Chromium runs under Xwayland and
 * gets the touchscreen as a mouse, so the browser's own touch scrolling never kicks in.
 */
export function useDragScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let pressed = false;
    let dragging = false;
    let startY = 0;
    let startScroll = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocity = 0; // px per ms, positive when scrolling down
    let frame = 0;

    const onDown = (e: PointerEvent) => {
      // Real touch input already scrolls natively.
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      cancelAnimationFrame(frame);
      pressed = true;
      dragging = false;
      startY = lastY = e.clientY;
      startScroll = el.scrollTop;
      lastTime = e.timeStamp;
      velocity = 0;
    };

    const onMove = (e: PointerEvent) => {
      if (!pressed) return;
      // A little slack so a tap with a wobbly finger still counts as a tap.
      if (!dragging && Math.abs(e.clientY - startY) < 8) return;
      dragging = true;
      el.scrollTop = startScroll - (e.clientY - startY);
      const dt = e.timeStamp - lastTime;
      if (dt > 0) velocity = (lastY - e.clientY) / dt;
      lastY = e.clientY;
      lastTime = e.timeStamp;
    };

    const onUp = (e: PointerEvent) => {
      if (!pressed) return;
      pressed = false;
      // Only glide if the finger was still moving when it lifted.
      if (!dragging || e.timeStamp - lastTime > 80) return;
      let step = velocity * 16;
      const glide = () => {
        if (Math.abs(step) < 0.5) return;
        el.scrollTop += step;
        step *= 0.92;
        frame = requestAnimationFrame(glide);
      };
      glide();
    };

    // The click that ends a drag shouldn't also press whatever button the drag started on.
    const onClick = (e: MouseEvent) => {
      if (!dragging) return;
      dragging = false;
      e.stopPropagation();
      e.preventDefault();
    };

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("click", onClick, true);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("click", onClick, true);
    };
  }, [ref]);
}
