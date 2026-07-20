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
