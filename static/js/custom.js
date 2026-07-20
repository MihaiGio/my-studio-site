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

  var observer = new IntersectionObserver(
    function (entries) {
      var best = null;
      entries.forEach(function (entry) {
        if (entry.isIntersecting && (!best || entry.intersectionRatio > best.intersectionRatio)) {
          best = entry;
        }
      });
      if (!best) return;

      fixedNav.style.setProperty("background-color", contrastColorFor(best.target), "important");
    },
    { threshold: [0.25, 0.5, 0.75] }
  );

  holders.forEach(function (holder) {
    observer.observe(holder);
  });
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
