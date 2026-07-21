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

// Falling images: a decorative overlay of images pulled at random from
// static/images/raininganimation that drift from the top of the #welcome
// section (the first .post-holder) to the bottom of the page on a loop,
// scrolling together with the content (the layer lives inside main.content,
// see the CSS comment on .bubble-field). Each one pulsates and is sized
// randomly so they don't read as a uniform grid.
(function () {
  "use strict";

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  // ===== Manual tuning knobs =====
  var BUBBLE_COUNT = 30; // how many images fall at once
  var MIN_SIZE_PX = 40; // smallest an image can be rendered at
  var MAX_SIZE_PX = 160; // largest an image can be rendered at
  var OPACITY = 0.80; // 0 (invisible) - 1 (fully solid)
  var MIN_SPIN_SECONDS = 4; // fastest a full 360deg spin can take
  var MAX_SPIN_SECONDS = 12; // slowest a full 360deg spin can take
  var COLLIDE_RADIUS = 70; // px of clearance an image tries to keep around the cursor
  var COLLIDE_PUSH = 2600; // how hard the cursor shoves an image away on contact
  var COLLIDE_SPRING = 0.006; // how strongly a pushed image springs back onto its falling path
  var COLLIDE_DAMPING = 0.15; // velocity lost per frame (higher = settles faster, less bouncy)
  // ================================

  var IMAGE_NAMES = ["9.png", "11.png", "12.png", "13.png", "15.png", "berry3.png", "blueberry.png"];

  // custom.js is a plain static file (not run through Hugo's templating), so
  // it can't resolve {{ "images/..." | relURL }} itself - instead it derives
  // the site's base path from its own <script> src, which custom_body.html
  // already builds correctly for the deployed subpath (see hugo.toml's
  // baseURL).
  var scriptEl = document.currentScript;
  var imageBase = scriptEl
    ? scriptEl.src.replace(/js\/custom\.js(?:[?#].*)?$/, "images/raininganimation/")
    : "images/raininganimation/";

  var content = document.querySelector("main.content");
  if (!content) return;

  var field = document.createElement("div");
  field.className = "bubble-field";
  field.setAttribute("aria-hidden", "true");
  // Appended last (not inserted first) so at the shared z-index:1 tier it
  // paints after every .post-holder's .post-after wave divider - same
  // "shows on top of the wave" treatment the spider-web overlay gets
  // (see the z-index comment on .bubble-field in custom.css) - while still
  // painting before main.content::after itself, since a ::after always
  // comes after all real children regardless of DOM order.
  content.appendChild(field);

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
    dot.style.opacity = OPACITY;
    var img = document.createElement("img");
    img.src = imageBase + IMAGE_NAMES[Math.floor(Math.random() * IMAGE_NAMES.length)];
    img.alt = "";
    img.style.setProperty("--spin-duration", (MIN_SPIN_SECONDS + Math.random() * (MAX_SPIN_SECONDS - MIN_SPIN_SECONDS)) + "s");
    img.style.setProperty("--spin-direction", Math.random() < 0.5 ? -1 : 1);
    img.style.setProperty("--spin-delay", -(Math.random() * MAX_SPIN_SECONDS) + "s");
    dot.appendChild(img);

    // .bubble already spends its transform on the fall (translate) and
    // .bubble-dot on the pulse (scale) - a third, purely JS-driven transform
    // for the cursor push needs its own wrapper in between, or it'd stomp
    // one of those animations instead of layering on top of it.
    var collide = document.createElement("span");
    collide.className = "bubble-collide";
    collide.appendChild(dot);
    bubble.appendChild(collide);

    bubble.collideEl = collide;
    bubble.pushX = 0;
    bubble.pushY = 0;
    bubble.velX = 0;
    bubble.velY = 0;

    var xPercent = opts.xPercent != null ? opts.xPercent : Math.random() * 100;
    var startTop = opts.startTop || 0;

    bubble.style.setProperty("--x", xPercent + "%");
    bubble.style.setProperty("--size", (MIN_SIZE_PX + Math.random() * (MAX_SIZE_PX - MIN_SIZE_PX)) + "px");
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

  // Left click anywhere on the page drops a new image at the cursor, with
  // the same fall/pulse behavior as the ambient ones - it just starts at
  // the click point instead of the top of #welcome.
  document.addEventListener("click", function (e) {
    if (e.button !== 0) return;

    var fieldRect = field.getBoundingClientRect();
    var y = e.clientY - fieldRect.top;
    if (y < 0 || y > fieldRect.height || fieldRect.width === 0) return;

    var xPercent = ((e.clientX - fieldRect.left) / fieldRect.width) * 100;
    createBubble({ xPercent: xPercent, startTop: y, immediate: true });
    retiming();
  });

  // Cursor collision: the falling images treat the cursor as a solid body
  // and get shoved off their straight fall path around it, then spring back
  // once it moves away. Kept off-screen until the first real mousemove so
  // nothing gets nudged before the pointer is known to be over the page.
  var mouseX = -9999;
  var mouseY = -9999;

  window.addEventListener("mousemove", function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }, { passive: true });

  window.addEventListener("mouseleave", function () {
    mouseX = -9999;
    mouseY = -9999;
  });

  function stepCollisions() {
    bubbles.forEach(function (bubble) {
      // Measured on .bubble-collide (not .bubble) so the push reacts to
      // where the image is actually rendered on screen right now - the
      // fall animation's translate3d plus any push already applied -
      // rather than its unperturbed position on the fall path.
      var rect = bubble.collideEl.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dx = cx - mouseX;
      var dy = cy - mouseY;
      var dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      var reach = COLLIDE_RADIUS + rect.width / 2;

      if (dist < reach) {
        var force = (1 - dist / reach) * COLLIDE_PUSH * (1 / 60);
        bubble.velX += (dx / dist) * force;
        bubble.velY += (dy / dist) * force;
      }

      // Spring-and-damp back toward the unperturbed fall path so a shove
      // settles instead of drifting off or oscillating forever.
      bubble.velX += -bubble.pushX * COLLIDE_SPRING;
      bubble.velY += -bubble.pushY * COLLIDE_SPRING;
      bubble.velX *= COLLIDE_DAMPING;
      bubble.velY *= COLLIDE_DAMPING;
      bubble.pushX += bubble.velX;
      bubble.pushY += bubble.velY;

      bubble.collideEl.style.transform = "translate3d(" + bubble.pushX.toFixed(1) + "px, " + bubble.pushY.toFixed(1) + "px, 0)";
    });

    window.requestAnimationFrame(stepCollisions);
  }

  window.requestAnimationFrame(stepCollisions);
})();
