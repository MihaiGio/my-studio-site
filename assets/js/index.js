/**
 * Main JS file for GhostScroll behaviours
 *
 * Project-level override of themes/hugo-scroll/assets/js/index.js (Hugo's
 * asset mounts resolve resources.Get "js/index.js" here first). Only change
 * vs. the theme original: the post-after wave divider's fadeOut/fadeIn calls
 * now stop() any in-flight/queued animation first. Without it, the
 * continuous scroll handler queues a fadeOut/fadeIn on every scroll tick;
 * jQuery plays queued animations one at a time, so a fast scroll down piles
 * up dozens of queued fadeOut calls, and reversing direction (scrolling up)
 * queues its fadeIn behind all of them - the divider stays hidden for
 * seconds because it's waiting for a backlog that's already visually done.
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
      $(window).scroll(function () {
        var w = $(window).scrollTop();
        var g = $sitehead.offset().top;
        var h = $sitehead.offset().top + $sitehead.height() - 100;

        if (w >= Math.floor(g) && w <= Math.ceil(h)) {
          $(".fixed-nav").fadeOut("fast");
        } else {
          $(".fixed-nav").css("display", "flex").fadeIn("fast");
        }

        $post.each(function () {
          if (($(window).height() + w) > ($(document).height() - $(".site-footer").height())) {
            var l = $postholder.length;
            $(".fn-item").removeClass("active")
            $(".fn-item[item_index='" + (l) + "']").addClass("active")
          } else {
            var f = $(this).offset().top;
            var b = $(this).offset().top + $(this).height();
            var t = $(this).parent(".post-holder").index();
            var i = $(".fn-item[item_index='" + t + "']");
            var a = $(this)
              .parent(".post-holder")
              .prev(".post-holder")
              .find(".post-after");

            $(this).attr("item_index", t);

            if (w >= f && w <= b) {
              i.addClass("active");
              a.stop(true, true).fadeOut("slow");
            } else {
              i.removeClass("active");
              a.stop(true, true).fadeIn("slow");
            }
        }
        });
      });
    }

    var ulLiIcon = getComputedStyle(document.documentElement).getPropertyValue('--ul-li-icon');
    if (ulLiIcon.length > 0) {
      $('ul').addClass("fa-ul");
      $("ul li").prepend('<span class="fa-li"><i class="fa ' + ulLiIcon + '"></i></span>');
    }
    $("blockquote p").prepend('<span class="quo fa fa-quote-left"></span>');
    $("blockquote p").append('<span class="quo fa fa-quote-right"></span>');
  });
})(jQuery);
