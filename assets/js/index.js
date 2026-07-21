/**
 * Main JS file for GhostScroll behaviours
 *
 * Project-level override of themes/hugo-scroll/assets/js/index.js (Hugo's
 * asset mounts resolve resources.Get "js/index.js" here first). Changes vs.
 * the theme original:
 * - The post-after wave divider's and fixed-nav's fadeOut/fadeIn calls now
 *   stop() any in-flight/queued animation first. Without it, the continuous
 *   scroll handler queues a fadeOut/fadeIn on every scroll tick; jQuery plays
 *   queued animations one at a time, so a fast scroll down piles up dozens
 *   of queued fadeOut calls, and reversing direction (scrolling up) queues
 *   its fadeIn behind all of them - the element stays hidden for seconds,
 *   then snaps back all at once, because it's working through a backlog
 *   that's already visually done.
 * - The scroll handler's body (several jQuery .offset()/.height() calls,
 *   each a forced synchronous layout) now runs at most once per animation
 *   frame instead of once per native "scroll" event. Touch scrolling fires
 *   scroll events far more often than the screen repaints, so without this
 *   throttle the handler was doing many times more forced-layout work than
 *   it needed to - visible as stutter while scrolling on mobile.
 * - Those same .offset()/.height() reads for #site-head and every .post are
 *   now taken once (on load/resize) and cached, instead of being re-read on
 *   every throttled scroll tick. They're document-relative measurements that
 *   only change when the page's layout actually changes (resize, images/
 *   fonts loading) - scrolling itself never moves them - so re-measuring on
 *   every tick was forcing a synchronous layout for a value that hadn't
 *   changed since the last one. The scroll handler itself now only reads
 *   window.scrollTop/height and compares against the cache, with no layout
 *   work of its own.
 */

var $post = $(".post");
var $first = $(".post.first");
var $last = $(".post.last");
var $fnav = $(".fixed-nav");
var $postholder = $(".post-holder");
var $sitehead = $("#site-head");

/* Globals jQuery, document */
(function ($) {
  "use strict";
  function srcTo(el, dur = 1000) {
    $("html, body").animate(
      {
        scrollTop: el.offset().top,
      },
      dur,
      function() {
        window.location.hash = el.attr("id");
      }
    );
  }
  function srcToAnchorWithTitle(str) {
    var $el = $("#" + str);
    if ($el.length) {
      srcTo($el);
    }
  }
  $(document).ready(function () {
    // fallback to jQuery animate if smooth scrolling is not supported
    if (!"scrollBehavior" in document.documentElement.style) {
      // Cover buttons
      $("a.btn.site-menu").click(function (e) {
        e.preventDefault();
        srcToAnchorWithTitle($(e.target).data("title-anchor"));
      });

      // cover arrow button
      $("#header-arrow").click(function (e) {
        e.preventDefault()
        srcTo($first);
      });
    }

    $(".post.last").next(".post-after").hide();

    if ($sitehead.length) {
      var scrollTicking = false;
      var scrollMetrics = null;

      // Every value gathered here is document-relative (or a fixed DOM
      // reference) and only changes when the page's own layout changes, not
      // when the user scrolls - so it's measured once here (each read a
      // forced synchronous layout) instead of on every scroll tick.
      function measureScrollMetrics() {
        var headTop = $sitehead.offset().top;
        var lastItem = $(".fn-item[item_index='" + $postholder.length + "']");

        var posts = $post.map(function () {
          var $this = $(this);
          var $holder = $this.parent(".post-holder");
          var top = $this.offset().top;
          return {
            top: top,
            bottom: top + $this.height(),
            item: $(".fn-item[item_index='" + $holder.index() + "']"),
            wave: $holder.prev(".post-holder").find(".post-after"),
          };
        }).get();

        scrollMetrics = {
          headTop: headTop,
          headBottom: headTop + $sitehead.height() - 100,
          footerHeight: $(".site-footer").height(),
          lastItem: lastItem,
          posts: posts,
        };
      }

      function handleScroll() {
        scrollTicking = false;
        if (!scrollMetrics) return;

        var w = $(window).scrollTop();

        if (w >= Math.floor(scrollMetrics.headTop) && w <= Math.ceil(scrollMetrics.headBottom)) {
          $(".fixed-nav").stop(true, true).fadeOut("fast");
        } else {
          $(".fixed-nav").stop(true, true).css("display", "flex").fadeIn("fast");
        }

        if (($(window).height() + w) > ($(document).height() - scrollMetrics.footerHeight)) {
          $(".fn-item").removeClass("active");
          scrollMetrics.lastItem.addClass("active");
        } else {
          scrollMetrics.posts.forEach(function (p) {
            if (w >= p.top && w <= p.bottom) {
              p.item.addClass("active");
              p.wave.stop(true, true).fadeOut("slow");
            } else {
              p.item.removeClass("active");
              p.wave.stop(true, true).fadeIn("slow");
            }
          });
        }
      }

      measureScrollMetrics();
      $(window).on("scroll", function () {
        if (!scrollTicking) {
          scrollTicking = true;
          requestAnimationFrame(handleScroll);
        }
      });
      // Web fonts/images loading late (or a resize) can change post heights
      // and offsets enough to invalidate the cache above.
      $(window).on("resize load", measureScrollMetrics);
    }

    var ulLiIcon = getComputedStyle(document.documentElement).getPropertyValue('--ul-li-icon');
    if (ulLiIcon.length > 0) {
      $('ul').addClass("fa-ul");
      $("ul li").prepend('<span class="fa-li"><i class="fa ' + ulLiIcon + '"></i></span>');
    }
    $("blockquote p").prepend('<span class="quo fa fa-quote-left"></span>');
    $("blockquote p").append('<span class="quo fa fa-quote-right"></span>');

    // Liquid wave divider flow (see static/css/custom.css for why this is
    // driven from rAF/wall-clock time instead of a CSS transform animation
    // or SMIL <animateTransform>).
    var waveTracks = document.querySelectorAll(".post-after-wave-track");
    if (
      waveTracks.length &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      var waveDurationMs = 18000; // matches the wave's former 18s CSS animation
      var waveWidth = 1440; // one copy's width, matching the SVG viewBox

      function tickWave(now) {
        var offset = -((now % waveDurationMs) / waveDurationMs) * waveWidth;
        for (var i = 0; i < waveTracks.length; i++) {
          waveTracks[i].setAttribute("transform", "translate(" + offset + ",0)");
        }
        requestAnimationFrame(tickWave);
      }

      // Every wave sits at the bottom of a .post-holder, so on a long page
      // most of them are off-screen at any given scroll position - without
      // this, the loop above still ran (and kept writing a transform to
      // every track) even for the ones nowhere near the viewport. An
      // IntersectionObserver lets the rAF loop stop entirely once none are
      // visible, and restart the instant one scrolls back into (near) view,
      // instead of ticking the whole page's worth of waves forever
      // regardless of scroll position.
      if (window.IntersectionObserver) {
        var visibleWaveTracks = new Set();
        var waveTicking = false;

        function tickWaveWhileVisible(now) {
          if (visibleWaveTracks.size === 0) {
            waveTicking = false;
            return;
          }
          var offset = -((now % waveDurationMs) / waveDurationMs) * waveWidth;
          for (var i = 0; i < waveTracks.length; i++) {
            waveTracks[i].setAttribute("transform", "translate(" + offset + ",0)");
          }
          requestAnimationFrame(tickWaveWhileVisible);
        }

        var waveObserver = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                visibleWaveTracks.add(entry.target);
              } else {
                visibleWaveTracks.delete(entry.target);
              }
            });
            if (!waveTicking && visibleWaveTracks.size > 0) {
              waveTicking = true;
              requestAnimationFrame(tickWaveWhileVisible);
            }
          },
          { rootMargin: "200px 0px" }
        );

        for (var wi = 0; wi < waveTracks.length; wi++) {
          waveObserver.observe(waveTracks[wi]);
        }
      } else {
        requestAnimationFrame(tickWave);
      }
    }

    // Hero background drift (see #site-head.withCenteredImage in
    // custom.css): unlike a `transform` animation, animating
    // `background-position` isn't compositor-only - the browser has to
    // repaint every frame it's running, even while the hero is scrolled
    // fully out of view. Pausing it via IntersectionObserver when it's
    // off-screen avoids paying that repaint cost for the rest of a long
    // page's scrolling/lifetime.
    var $heroBg = $("#site-head.withCenteredImage");
    if ($heroBg.length && window.IntersectionObserver) {
      var heroBgEl = $heroBg[0];
      var heroBgObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          heroBgEl.classList.toggle("bg-drift-paused", !entry.isIntersecting);
        });
      });
      heroBgObserver.observe(heroBgEl);
    }
  });
})(jQuery);
