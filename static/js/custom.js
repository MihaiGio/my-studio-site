(function () {
  "use strict";

  // Must match --section-light-bg-color / --section-dark-bg-color in custom.css
  var lightColor = "#FFFF00";
  var darkColor = "#7700FF";

  var fixedNav = document.querySelector(".fixed-nav");
  var holders = Array.prototype.slice.call(document.querySelectorAll(".post-holder"));
  if (!fixedNav || !holders.length) return;

  // Always the opposite of the section currently underneath, so the bar can never match it.
  function contrastColorFor(holder) {
    return holder.classList.contains("dark") ? lightColor : darkColor;
  }

  // Picks whichever section covers the most viewport pixels right now.
  // IntersectionObserver's intersectionRatio is normalized to each target's
  // own height, not the viewport - for a section much taller than the
  // viewport (heroes/enemies/cards, full of images) the next section could
  // already fill the screen well before the outgoing one's ratio dropped
  // enough to hand off, leaving the nav showing the wrong (matching) color
  // for a stretch of scrolling. Comparing raw visible pixel height instead
  // ties the color to what's actually on screen, regardless of section height.
  var ticking = false;

  function updateNavColor() {
    ticking = false;
    var viewportHeight = window.innerHeight;
    var best = null;
    var bestVisible = 0;

    holders.forEach(function (holder) {
      var rect = holder.getBoundingClientRect();
      var visible = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
      if (visible > bestVisible) {
        bestVisible = visible;
        best = holder;
      }
    });

    if (best) {
      fixedNav.style.setProperty("background-color", contrastColorFor(best), "important");
    }
  }

  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(updateNavColor);
    }
  }

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  updateNavColor();
})();

// Cards gallery: let the mouse drag the horizontally scrolling row, since it
// has no scrollbar-dragging affordance of its own on most platforms.
(function () {
  "use strict";

  var galleries = Array.prototype.slice.call(document.querySelectorAll("#cards .post-content p:has(img)"));

  galleries.forEach(function (gallery) {
    var isDown = false;
    var startX = 0;
    var startScrollLeft = 0;
    var moved = false;

    gallery.addEventListener("mousedown", function (e) {
      isDown = true;
      moved = false;
      gallery.classList.add("dragging");
      startX = e.pageX;
      startScrollLeft = gallery.scrollLeft;
    });

    function stopDrag() {
      isDown = false;
      gallery.classList.remove("dragging");
    }

    gallery.addEventListener("mouseleave", stopDrag);
    gallery.addEventListener("mouseup", stopDrag);

    gallery.addEventListener("mousemove", function (e) {
      if (!isDown) return;
      e.preventDefault();
      var walk = e.pageX - startX;
      if (Math.abs(walk) > 3) moved = true;
      gallery.scrollLeft = startScrollLeft - walk;
    });

    // Dragging over an image would otherwise start the browser's native
    // image-drag-ghost instead of scrolling the row.
    Array.prototype.slice.call(gallery.querySelectorAll("img")).forEach(function (img) {
      img.addEventListener("dragstart", function (e) {
        e.preventDefault();
      });
    });

    // A drag that actually moved the row shouldn't also fire the image's click/link.
    gallery.addEventListener(
      "click",
      function (e) {
        if (moved) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true
    );
  });
})();

// Falling color-shifting bubbles: a decorative overlay of small blobs that
// drift from the top of the #welcome section (the first .post-holder) to
// the bottom of the page on a loop, scrolling together with the content
// (the layer lives inside main.content, see the CSS comment on
// .bubble-field). Color isn't time-based - a rolling check compares each
// bubble's current position against the .post-holder underneath it and
// sets the bubble to whichever of yellow/purple contrasts with that
// section's background, so it never blends into what it's crossing.
(function () {
  "use strict";

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  var lightColor = "#FFFF00";
  var darkColor = "#7700FF";

  var content = document.querySelector("main.content");
  var holders = Array.prototype.slice.call(document.querySelectorAll(".post-holder"));
  if (!content || !holders.length) return;

  var BUBBLE_COUNT = 28;
  var field = document.createElement("div");
  field.className = "bubble-field";
  field.setAttribute("aria-hidden", "true");
  content.insertBefore(field, content.firstChild);

  var bubbles = [];

  // Shared by the ambient population above and the click-spawned bubbles
  // below. `startTop` (px from the top of the field) defaults to 0 - the
  // ambient bubbles fall the full field height; a click-spawned one starts
  // wherever the cursor was instead, and `immediate` skips the randomized
  // negative animation-delay so it visibly starts falling right away rather
  // than appearing to already be mid-fall.
  function createBubble(opts) {
    opts = opts || {};
    var bubble = document.createElement("span");
    bubble.className = "bubble";

    var dot = document.createElement("span");
    dot.className = "bubble-dot";
    bubble.appendChild(dot);
    bubble.dotEl = dot;

    var xPercent = opts.xPercent != null ? opts.xPercent : Math.random() * 100;
    var startTop = opts.startTop || 0;

    bubble.style.setProperty("--x", xPercent + "%");
    bubble.style.setProperty("--size", (8 + Math.random() * 48) + "px");
    bubble.style.setProperty("--drift", (Math.random() * 60 - 30) + "px");
    bubble.style.top = startTop + "px";
    bubble.startTop = startTop;

    dot.style.setProperty("--pulse-duration", (1.6 + Math.random() * 2) + "s");
    dot.style.setProperty("--pulse-delay", -(Math.random() * 4) + "s");
    // px/second - kept on the element so retiming() can turn it back into a
    // duration whenever the measured fall distance changes (e.g. on resize).
    bubble.dataset.speed = 30 + Math.random() * 50;

    if (opts.immediate) {
      bubble.style.setProperty("--fall-delay", "0s");
      bubble.dataset.delaySet = "1";

      // Click-spawned bubbles aren't part of the fixed ambient population, so
      // without this they'd pile up in the DOM forever - one fall past the
      // bottom of main.content (i.e. down to where the footer starts) and
      // then despawn instead of looping.
      bubble.classList.add("bubble--once");
      bubble.addEventListener("animationend", function onFallEnd(e) {
        if (e.animationName !== "bubble-fall") return;
        bubble.removeEventListener("animationend", onFallEnd);
        bubble.remove();
        var idx = bubbles.indexOf(bubble);
        if (idx !== -1) bubbles.splice(idx, 1);
      });
    }

    field.appendChild(bubble);
    bubbles.push(bubble);
    return bubble;
  }

  for (var i = 0; i < BUBBLE_COUNT; i++) {
    createBubble();
  }

  // Re-measures the page height so the fall distance/duration stay correct
  // after images or webfonts load and reflow the page, or the window resizes.
  function retiming() {
    var fieldHeight = field.offsetHeight;
    bubbles.forEach(function (bubble) {
      var travel = (fieldHeight - bubble.startTop) + 60;
      var speed = parseFloat(bubble.dataset.speed);
      var duration = travel / speed;
      bubble.style.setProperty("--fall-distance", travel + "px");
      bubble.style.setProperty("--fall-duration", duration + "s");
      if (!bubble.dataset.delaySet) {
        bubble.style.setProperty("--fall-delay", -(Math.random() * duration) + "s");
        bubble.dataset.delaySet = "1";
      }
    });
  }

  retiming();
  window.addEventListener("load", retiming);
  window.addEventListener("resize", retiming);

  // Left click anywhere on the page drops a new bubble at the cursor, with
  // the same fall/pulse/color behavior as the ambient ones - it just starts
  // at the click point instead of the top of #welcome.
  document.addEventListener("click", function (e) {
    if (e.button !== 0) return;

    var fieldRect = field.getBoundingClientRect();
    var y = e.clientY - fieldRect.top;
    if (y < 0 || y > fieldRect.height || fieldRect.width === 0) return;

    var xPercent = ((e.clientX - fieldRect.left) / fieldRect.width) * 100;
    createBubble({ xPercent: xPercent, startTop: y, immediate: true });
    retiming();
    updateColors();
  });

  function updateColors() {
    var holderRects = holders.map(function (holder) {
      var r = holder.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, dark: holder.classList.contains("dark") };
    });

    bubbles.forEach(function (bubble) {
      var r = bubble.getBoundingClientRect();
      var centerY = r.top + r.height / 2;
      for (var j = 0; j < holderRects.length; j++) {
        var hr = holderRects[j];
        if (centerY >= hr.top && centerY <= hr.bottom) {
          bubble.dotEl.style.color = hr.dark ? lightColor : darkColor;
          break;
        }
      }
    });
  }

  updateColors();
  setInterval(updateColors, 150);
})();
