document.addEventListener("DOMContentLoaded", () => {
  /* ===== MOBILE MENU CONTROLLER ===== */
  const burgerBtn = document.querySelector(".burger-btn");
  const mobileOverlay = document.querySelector(".mobile-overlay");
  const mobileLinks = document.querySelectorAll(".mobile-nav-link, .mobile-sign-in");

  function openMenu() {
    if (!burgerBtn || !mobileOverlay) return;
    burgerBtn.setAttribute("aria-expanded", "true");
    mobileOverlay.removeAttribute("hidden");
    document.body.classList.add("menu-open");
  }

  function closeMenu() {
    if (!burgerBtn || !mobileOverlay) return;
    burgerBtn.setAttribute("aria-expanded", "false");
    mobileOverlay.setAttribute("hidden", "");
    document.body.classList.remove("menu-open");
  }

  function toggleMenu() {
    const isExpanded = burgerBtn?.getAttribute("aria-expanded") === "true";
    if (isExpanded) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  burgerBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  // Close on overlay click outside sheet
  mobileOverlay?.addEventListener("click", (e) => {
    if (e.target === mobileOverlay) {
      closeMenu();
    }
  });

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeMenu();
    }
  });

  // Close on link click
  mobileLinks.forEach((link) => {
    link.addEventListener("click", () => {
      closeMenu();
    });
  });

  // Close on viewport resize > 720px
  window.addEventListener("resize", () => {
    if (window.innerWidth > 720) {
      closeMenu();
    }
  });

  /* ===== STATS COUNT-UP CONTROLLER ===== */
  const statValues = document.querySelectorAll(".stat-value");

  function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
  }

  function animateStat(element, index) {
    const target = parseFloat(element.getAttribute("data-target")) || 0;
    const suffix = element.getAttribute("data-suffix") || "";
    const decimals = parseInt(element.getAttribute("data-decimals"), 10) || 0;

    const duration = 1500 + index * 80;
    const startOffset = 480 + index * 90;

    setTimeout(() => {
      let startTime = null;

      function step(currentTime) {
        if (!startTime) startTime = currentTime;
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutCubic(progress);

        const currentValue = eased * target;
        element.textContent = currentValue.toFixed(decimals) + suffix;

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          element.textContent = target.toFixed(decimals) + suffix;
        }
      }

      requestAnimationFrame(step);
    }, startOffset);
  }

  let animated = false;
  function triggerStatsAnimation() {
    if (animated) return;
    animated = true;
    statValues.forEach((el, index) => {
      animateStat(el, index);
    });
  }

  const statsSection = document.querySelector(".stats");
  if ("IntersectionObserver" in window && statsSection) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            triggerStatsAnimation();
            observer.disconnect();
          }
        });
      },
      { threshold: 0.25 }
    );
    observer.observe(statsSection);
  } else {
    triggerStatsAnimation();
  }
});

