// Nav split: the primary nav bar's buttons stretch to fill it edge-to-edge
// (see a.fn-item in custom.css), which means more items on the page means
// less room per button - past a point the labels would have to truncate to
// keep fitting. Rather than truncate, once a button's natural (unstretched)
// width no longer fits its equal share of the bar, this moves it and
// everything after it onto the secondary bar instead (which loops the
// opposite direction, so the two read as distinct rows rather than one bar
// repeated). The primary bar is server-rendered with the full list as a
// working fallback (see layouts/_default/index.html) and the secondary bar
// starts empty/hidden; this progressively enhances both from the canonical
// item list in the inert <template>, rebuilding each bar's content
// (including the duplicate copy each needs for its own seamless loop - see
// the .fn-track comment in custom.css) only once it's actually measured a
// need to split.
(function () {
  "use strict";

  var wrapper = document.querySelector(".fixed-nav-wrapper");
  var primary = document.querySelector(".fixed-nav:not(.fixed-nav-secondary)");
  var secondary = document.querySelector(".fixed-nav-secondary");
  var itemsTemplate = document.getElementById("fn-items-template");
  if (!wrapper || !primary || !secondary || !itemsTemplate) return;

  var primaryTrack = primary.querySelector(".fn-track");
  var secondaryTrack = secondary.querySelector(".fn-track");

  var sourceItems = Array.prototype.slice.call(itemsTemplate.content.querySelectorAll("a.fn-item"));
  if (!sourceItems.length) return;

  // Renders one throwaway copy of each item with no flex-stretch/shrink
  // applied, so getBoundingClientRect reports its intrinsic text+padding
  // width - i.e. the least width it needs to avoid truncating - rather than
  // whatever width the previous layout pass squeezed it into.
  function measureNaturalWidths() {
    var probe = document.createElement("div");
    probe.style.cssText = "position:absolute; visibility:hidden; top:0; left:-9999px; display:flex;";
    probe.className = primary.className.replace("fn-empty", "") + " fn-measure-probe";
    document.body.appendChild(probe);

    var group = document.createElement("div");
    group.className = "fn-group";
    group.style.width = "auto";
    probe.appendChild(group);

    try {
      return sourceItems.map(function (item) {
        var clone = item.cloneNode(true);
        clone.style.flex = "0 0 auto";
        group.appendChild(clone);
        return clone.getBoundingClientRect().width;
      });
    } finally {
      document.body.removeChild(probe);
    }
  }

  // Builds a track's two back-to-back copies in a detached fragment rather
  // than writing straight into the live track - layout() only swaps the
  // fragment in once BOTH the primary and secondary content are fully
  // built, so a mid-way error can't leave a track cleared with nothing to
  // replace it (which would show as an empty/missing bar).
  function buildTrackFragment(items) {
    if (!items.length) return null;

    var groupA = document.createElement("div");
    groupA.className = "fn-group";
    var groupB = document.createElement("div");
    groupB.className = "fn-group";
    groupB.setAttribute("aria-hidden", "true");

    items.forEach(function (item) {
      groupA.appendChild(item.cloneNode(true));
      groupB.appendChild(item.cloneNode(true));
    });

    var frag = document.createDocumentFragment();
    frag.appendChild(groupA);
    frag.appendChild(groupB);
    return frag;
  }

  function layout() {
    try {
      // Measured from the wrapper, not the primary bar itself - the primary
      // bar gets display:none'd by index.js's scroll handler while the hero
      // section is on screen (including on first load, before any
      // scrolling), which would otherwise read as 0 width and skip
      // populating either bar until the next resize/load event fires. The
      // wrapper is never hidden.
      var availableWidth = wrapper.clientWidth;
      if (!availableWidth) return;

      var widths = measureNaturalWidths();
      var total = sourceItems.length;

      var widestOverall = 0;
      for (var i = 0; i < total; i++) {
        if (widths[i] > widestOverall) widestOverall = widths[i];
      }

      var primaryCount;
      if (widestOverall * total <= availableWidth) {
        // Everything fits its equal share on one bar untruncated - no split
        // needed at all.
        primaryCount = total;
      } else {
        // Split evenly between the two bars rather than packing the primary
        // bar down to the bare minimum that fits - the primary/top bar gets
        // the extra item when the count is odd, so it's always the larger
        // (or equal) of the two.
        primaryCount = Math.ceil(total / 2);
        // Never leave a single straggler alone on the secondary bar.
        if (total - primaryCount === 1 && primaryCount > 1) primaryCount--;
      }

      var primaryFrag = buildTrackFragment(sourceItems.slice(0, primaryCount));
      var secondaryFrag = buildTrackFragment(sourceItems.slice(primaryCount));

      if (primaryFrag) {
        primaryTrack.textContent = "";
        primaryTrack.appendChild(primaryFrag);
      }
      secondaryTrack.textContent = "";
      if (secondaryFrag) secondaryTrack.appendChild(secondaryFrag);

      secondary.classList.toggle("fn-empty", primaryCount >= total);
    } catch (e) {
      // Fail safe: leave whatever's already rendered (the server-rendered
      // full list, or the last successful split) rather than risk a blank
      // or half-updated bar.
      if (window.console && console.error) console.error("nav-split layout failed", e);
    }
  }

  var resizeTicking = false;
  function requestLayout() {
    if (resizeTicking) return;
    resizeTicking = true;
    window.requestAnimationFrame(function () {
      resizeTicking = false;
      layout();
    });
  }

  layout();
  window.addEventListener("resize", requestLayout);
  // Web fonts swapping in after first paint can change each label's natural
  // width enough to change the split.
  window.addEventListener("load", requestLayout);
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
  var BUBBLE_COUNT = 30; // how many images fall at once in the initial ambient population (fine-pointer/desktop devices)
  var BUBBLE_COUNT_MOBILE = 30; // same, but for coarse-pointer (touch/mobile) devices - each bubble is 3 nested elements animating `transform` (fall/pulse/spin), so it's its own composited layer; low-end mobile GPUs feel the layer count much sooner than desktop does, so this is worth tuning down independently
  var MAX_TOTAL_BUBBLES = 60; // hard cap on ambient + left-click-spawned images combined (fine-pointer/desktop devices); the oldest is de-spawned to make room once this is reached
  var MAX_TOTAL_BUBBLES_MOBILE = 60; // same cap, but for coarse-pointer (touch/mobile) devices
  var MIN_SIZE_PX = 40; // smallest an image can be rendered at
  var MAX_SIZE_PX = 160; // largest an image can be rendered at
  var OPACITY = 0.80; // 0 (invisible) - 1 (fully solid)
  var MIN_SPIN_SECONDS = 4; // fastest a full 360deg spin can take
  var MAX_SPIN_SECONDS = 12; // slowest a full 360deg spin can take
  var COLLIDE_RADIUS = 70; // px of clearance an image tries to keep around the cursor
  var COLLIDE_PUSH = 2600; // how hard the cursor shoves an image away on contact
  var COLLIDE_SPRING = 0.006; // how strongly a pushed image springs back onto its falling path
  var COLLIDE_DAMPING = 0.9; // velocity lost per frame (higher = settles faster, less bouncy)
  var BUBBLE_RESTITUTION = 1; // bounciness of image-vs-image hits (1 = perfectly elastic, billiard-ball-like)
  var BUBBLE_PUSH_STRENGTH = 1; // multiplier on how hard overlapping images shove apart (1 = exact depenetration, higher = more forceful)
  // ================================

  var scriptEl = document.currentScript;

  // Coarse-pointer (touch/mobile) devices load downscaled copies of the
  // falling images instead of the full-resolution ones - custom_body.html
  // resizes them via Hugo's built-in image processing at build time and
  // passes both sets of resolved URLs here as JSON, since this plain static
  // file can't run Hugo's templating (or resizing) itself. Computed early
  // so it's available for the image set choice below, and reused further
  // down to gate the cursor-collision behavior too.
  var hasPointerFine = !!(window.matchMedia && window.matchMedia("(pointer: fine)").matches);

  var IMAGE_URLS = JSON.parse((scriptEl && scriptEl.dataset.images) || "[]");
  var IMAGE_URLS_MOBILE = JSON.parse((scriptEl && scriptEl.dataset.imagesMobile) || "[]");
  var ACTIVE_IMAGE_URLS = (!hasPointerFine && IMAGE_URLS_MOBILE.length) ? IMAGE_URLS_MOBILE : IMAGE_URLS;
  var ACTIVE_BUBBLE_COUNT = hasPointerFine ? BUBBLE_COUNT : BUBBLE_COUNT_MOBILE;
  var ACTIVE_MAX_TOTAL_BUBBLES = hasPointerFine ? MAX_TOTAL_BUBBLES : MAX_TOTAL_BUBBLES_MOBILE;

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

  // Shared by the animationend cleanup (below) and the total-count cap in
  // createBubble - removes a bubble from both the DOM and the `bubbles`
  // array it's tracked in.
  function removeBubble(bubble) {
    bubble.remove();
    var idx = bubbles.indexOf(bubble);
    if (idx !== -1) bubbles.splice(idx, 1);
  }

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
    img.src = ACTIVE_IMAGE_URLS[Math.floor(Math.random() * ACTIVE_IMAGE_URLS.length)];
    img.alt = "";
    img.decoding = "async";
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
        removeBubble(bubble);
      });
    }

    (opts.parent || field).appendChild(bubble);
    bubbles.push(bubble);

    // Ambient and click-spawned images share one total cap - once it's
    // reached, the oldest surviving bubble (whichever end of that mix it
    // came from) is de-spawned to make room for this new one.
    while (bubbles.length > ACTIVE_MAX_TOTAL_BUBBLES) {
      removeBubble(bubbles[0]);
    }

    return bubble;
  }

  // Built into a fragment and appended once, rather than 30 separate
  // appendChild calls straight into the live .bubble-field, so the browser
  // only has to do one insertion/reflow for the whole initial population.
  var initialFragment = document.createDocumentFragment();
  for (var i = 0; i < ACTIVE_BUBBLE_COUNT; i++) {
    createBubble({ parent: initialFragment });
  }
  field.appendChild(initialFragment);

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
  //
  // The whole per-frame physics loop (this and the bubble-vs-bubble collision
  // below) is skipped entirely on touch devices, not just the cursor push -
  // there's no mouse to collide with, and on mobile CPUs the getBoundingClientRect
  // reads plus the O(n^2) pairwise collision check on every animation frame is
  // enough main-thread work to compete with touch scrolling and drop frames.
  // Without it the images still fall/pulse/spin via pure CSS (no JS driving
  // them), just without cursor-push or anti-overlap - occasional visual
  // overlap on mobile is a fair trade for smooth scrolling.
  // (hasPointerFine itself is computed above, alongside the image-set choice.)
  if (!hasPointerFine) return;

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
    // Reads and writes are done in separate passes over `bubbles` -
    // interleaving getBoundingClientRect() (forces layout) with a
    // style.transform write (invalidates layout) on each element in turn
    // would force the browser to redo layout up to 30 times a frame instead
    // of once.
    bubbles.forEach(function (bubble) {
      // Measured on .bubble-collide (not .bubble) so the push reacts to
      // where the image is actually rendered on screen right now - the
      // fall animation's translate3d plus any push already applied -
      // rather than its unperturbed position on the fall path.
      var rect = bubble.collideEl.getBoundingClientRect();
      bubble._cx = rect.left + rect.width / 2;
      bubble._cy = rect.top + rect.height / 2;
      bubble._halfWidth = rect.width / 2;

      // Real on-screen velocity, inferred from the position change since
      // last frame - this already bakes in the fall speed, the horizontal
      // drift, AND any push offset already applied (since all of those move
      // _cx/_cy), so it's the true closing speed two images hit each other
      // with, not just the JS-driven push velocity below.
      bubble._realVelX = bubble._prevCx == null ? 0 : bubble._cx - bubble._prevCx;
      bubble._realVelY = bubble._prevCy == null ? 0 : bubble._cy - bubble._prevCy;
      bubble._prevCx = bubble._cx;
      bubble._prevCy = bubble._cy;
    });

    bubbles.forEach(function (bubble) {
      var dx = bubble._cx - mouseX;
      var dy = bubble._cy - mouseY;
      var dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      var reach = COLLIDE_RADIUS + bubble._halfWidth;

      if (dist < reach) {
        var force = (1 - dist / reach) * COLLIDE_PUSH * (1 / 60);
        bubble.velX += (dx / dist) * force;
        bubble.velY += (dy / dist) * force;
      }
    });

    // Bubble-vs-bubble collision: treated as solid circles that never
    // overlap, resolved like a billiard-ball hit rather than a soft push -
    // overlap is corrected instantly (no gradual oozing apart) and an
    // elastic impulse exchanges momentum along the contact normal, sized by
    // each image's real closing speed (see _realVelX/_realVelY above) and
    // mass (bigger images are heavier, so a small one bounces off harder).
    for (var i = 0; i < bubbles.length; i++) {
      var a = bubbles[i];
      for (var j = i + 1; j < bubbles.length; j++) {
        var b = bubbles[j];
        var dx = a._cx - b._cx;
        var dy = a._cy - b._cy;
        var minDist = a._halfWidth + b._halfWidth;
        if (Math.abs(dx) >= minDist || Math.abs(dy) >= minDist) continue; // cheap reject before sqrt
        var dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        if (dist >= minDist) continue;

        var nx = dx / dist;
        var ny = dy / dist;
        var massA = a._halfWidth * a._halfWidth;
        var massB = b._halfWidth * b._halfWidth;
        var totalMass = massA + massB;

        // Depenetrate fully in one step, weighted by mass, so the images
        // never visibly sink into each other even for a single frame.
        var overlap = (minDist - dist) * BUBBLE_PUSH_STRENGTH;
        var correctionA = overlap * (massB / totalMass);
        var correctionB = overlap * (massA / totalMass);
        a.pushX += nx * correctionA;
        a.pushY += ny * correctionA;
        b.pushX -= nx * correctionB;
        b.pushY -= ny * correctionB;

        // Elastic impulse - only when actually closing (approach < 0), so
        // two images already separating don't get an extra kick apart.
        var relVelX = a._realVelX - b._realVelX;
        var relVelY = a._realVelY - b._realVelY;
        var approach = relVelX * nx + relVelY * ny;
        if (approach < 0) {
          var impulse = ((-(1 + BUBBLE_RESTITUTION) * approach) / (1 / massA + 1 / massB)) * BUBBLE_PUSH_STRENGTH;
          a.velX += (impulse / massA) * nx;
          a.velY += (impulse / massA) * ny;
          b.velX -= (impulse / massB) * nx;
          b.velY -= (impulse / massB) * ny;
        }
      }
    }

    bubbles.forEach(function (bubble) {
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
