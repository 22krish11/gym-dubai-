/* ============================================================
   IRON WEB FITNESS — interactions
   No libraries. Everything degrades gracefully; reduced-motion
   turns the movement off entirely.
   ============================================================ */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const lerp = (a, b, t) => a + (b - a) * t;

  const docEl = document.documentElement;
  const onScroll = [];
  const onResize = [];

  /* ---------------- Scroll progress + header ---------------- */
  const header = document.getElementById("siteHeader");
  const bar = document.getElementById("progressBar");

  let lastY = -1, rafPending = false;
  function frame() {
    rafPending = false;
    const y = window.scrollY;
    onScroll.forEach((fn) => fn(y));
    lastY = y;
  }
  function requestFrame() {
    if (!rafPending) { rafPending = true; requestAnimationFrame(frame); }
  }
  window.addEventListener("scroll", requestFrame, { passive: true });
  window.addEventListener("resize", requestFrame, { passive: true });

  onScroll.push((y) => {
    if (y !== lastY || true) {
      const max = docEl.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = "scaleX(" + (max > 0 ? clamp01(y / max) : 0) + ")";
      if (header) header.classList.toggle("scrolled", y > 24);
    }
  });

  /* ---------------- Reveal on scroll ---------------- */
  const revealEls = document.querySelectorAll(".reveal, .mi");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in-view");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
  revealEls.forEach((el) => io.observe(el));

  if (reduceMotion.matches) {
    revealEls.forEach((el) => el.classList.add("in-view"));
  }

  /* ---------------- Section entry hooks (clock, network) ---------------- */
  const alwaysSection = document.getElementById("always");
  const webSection = document.getElementById("web");
  const sectionSeen = { always: false, web: false };
  const seenIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      if (e.target === alwaysSection) sectionSeen.always = true;
      if (e.target === webSection) { sectionSeen.web = true; }
      seenIO.unobserve(e.target);
    });
  }, { threshold: 0.25 });
  if (alwaysSection) seenIO.observe(alwaysSection);
  if (webSection) seenIO.observe(webSection);

  /* ---------------- Time roll (6AM → midnight) ---------------- */
  const timeRoll = document.getElementById("timeRoll");
  if (timeRoll) {
    const spans = timeRoll.querySelectorAll("span");
    const applyTime = (p) => {
      // p 0..1 across the section scroll; move the strip one slot at a time
      const idx = Math.min(spans.length - 1, Math.floor(p * spans.length));
      spans.forEach((s, i) => s.style.opacity = i === idx ? "1" : "0.25");
      const y = -idx * 44;
      timeRoll.style.transform = "translateY(" + (reduceMotion.matches ? 0 : y) + "px)";
    };
    onScroll.push(() => {
      if (!alwaysSection) return;
      const r = alwaysSection.getBoundingClientRect();
      const total = r.height + window.innerHeight;
      const passed = window.innerHeight - r.top;
      applyTime(clamp01(passed / total));
    });
    applyTime(0);
  }

  /* ---------------- The WEB — network diagram ---------------- */
  const netSvg = document.getElementById("netSvg");
  if (netSvg) {
    const NS = "http://www.w3.org/2000/svg";
    const edgesG = document.getElementById("netEdges");
    const nodesG = document.getElementById("netNodes");

    const nodes = [
      { x: 600, y: 300, label: "IRON WEB", core: true },
      { x: 210, y: 140, label: "TRAINING" },
      { x: 960, y: 150, label: "COMMUNITY" },
      { x: 120, y: 380, label: "EQUIPMENT" },
      { x: 1040, y: 400, label: "DISCIPLINE" },
      { x: 380, y: 520, label: "ACCESS" },
      { x: 830, y: 530, label: "PROGRESS" }
    ];

    // connect every satellite to the core + a few cross-links
    const links = [];
    for (let i = 1; i < nodes.length; i++) links.push([0, i]);
    links.push([1, 2], [2, 4], [1, 3], [3, 5], [4, 6], [5, 6]);

    const linkEls = links.map(([a, b]) => {
      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", nodes[a].x); line.setAttribute("y1", nodes[a].y);
      line.setAttribute("x2", nodes[b].x); line.setAttribute("y2", nodes[b].y);
      line.setAttribute("class", "net-edge");
      edgesG.appendChild(line);
      return { el: line, a: nodes[a], b: nodes[b] };
    });

    const nodeEls = nodes.map((n, i) => {
      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", "net-node");
      const halo = document.createElementNS(NS, "circle");
      halo.setAttribute("cx", n.x); halo.setAttribute("cy", n.y); halo.setAttribute("r", 22);
      halo.setAttribute("class", "net-node-halo");
      const core = document.createElementNS(NS, "circle");
      core.setAttribute("cx", n.x); core.setAttribute("cy", n.y); core.setAttribute("r", n.core ? 7 : 4.5);
      core.setAttribute("class", "net-node-core");
      g.appendChild(halo); g.appendChild(core);
      const label = document.createElementNS(NS, "text");
      label.setAttribute("x", n.x); label.setAttribute("y", n.y - 32);
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("class", "net-node-label");
      label.textContent = n.label;
      g.appendChild(label);
      nodesG.appendChild(g);
      g.style.opacity = "0";
      g.style.transition = "opacity 0.6s ease " + (i * 0.08) + "s";
      return { g, node: n };
    });

    let webP = 0, webDrawn = 0;
    const drawWeb = () => {
      // draw edges toward their target length
      const target = sectionSeen.web || reduceMotion.matches ? 1 : 0;
      webDrawn = lerp(webDrawn, target, reduceMotion.matches ? 1 : 0.08);
      const p = easeOutCubic(clamp01(webDrawn));
      linkEls.forEach(({ el, a, b }, i) => {
        const stagger = clamp01((p - i * 0.04) / 0.6);
        el.setAttribute("x2", lerp(a.x, b.x, stagger));
        el.setAttribute("y2", lerp(a.y, b.y, stagger));
        el.style.opacity = String(0.25 + 0.55 * stagger);
      });
      nodeEls.forEach(({ g }, i) => {
        g.style.opacity = String(clamp01((p - 0.3 - i * 0.03) * 4));
      });
    };

    // activation cycle: nodes light up one by one, forever (subtle)
    let activeIdx = 0, lastSwap = 0;
    const cycleNodes = (ts) => {
      if (ts - lastSwap > 1600 && webDrawn > 0.9) {
        lastSwap = ts;
        nodeEls.forEach(({ g }, i) => g.classList.toggle("active", i === activeIdx));
        activeIdx = (activeIdx + 1) % nodeEls.length;
      }
    };

    const webLoop = (ts) => {
      drawWeb();
      if (!reduceMotion.matches) cycleNodes(ts);
      requestAnimationFrame(webLoop);
    };
    requestAnimationFrame(webLoop);

    // initial paint
    nodeEls.forEach(({ g }) => (g.style.opacity = "0"));
    drawWeb();
  }

  /* ---------------- Equipment rail: drag to scroll ---------------- */
  const rail = document.getElementById("rail");
  if (rail) {
    let isDown = false, startX = 0, startLeft = 0, moved = 0;

    rail.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse") return; // touch scrolls natively
      isDown = true; moved = 0;
      startX = e.clientX; startLeft = rail.scrollLeft;
      rail.classList.add("dragging");
      rail.setPointerCapture(e.pointerId);
    });
    rail.addEventListener("pointermove", (e) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      rail.scrollLeft = startLeft - dx;
    });
    const endDrag = () => { isDown = false; rail.classList.remove("dragging"); };
    rail.addEventListener("pointerup", endDrag);
    rail.addEventListener("pointercancel", endDrag);

    // prevent accidental click after a drag
    rail.addEventListener("click", (e) => { if (moved > 8) e.preventDefault(); }, true);

    // wheel: vertical scroll over the rail becomes horizontal
    rail.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const atStart = rail.scrollLeft <= 0 && e.deltaY < 0;
      const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1 && e.deltaY > 0;
      if (atStart || atEnd) return;
      e.preventDefault();
      rail.scrollLeft += e.deltaY;
    }, { passive: false });

    // keyboard support
    rail.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { rail.scrollBy({ left: 320, behavior: reduceMotion.matches ? "auto" : "smooth" }); e.preventDefault(); }
      if (e.key === "ArrowLeft") { rail.scrollBy({ left: -320, behavior: reduceMotion.matches ? "auto" : "smooth" }); e.preventDefault(); }
    });
  }

  /* ---------------- Accordion ---------------- */
  document.querySelectorAll("#accordion .acc-item").forEach((item) => {
    const btn = item.querySelector(".acc-btn");
    const panel = item.querySelector(".acc-panel");
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") === "true";
      // close others
      document.querySelectorAll("#accordion .acc-btn[aria-expanded='true']").forEach((other) => {
        if (other !== btn) {
          other.setAttribute("aria-expanded", "false");
          other.closest(".acc-item").querySelector(".acc-panel").style.height = "0px";
        }
      });
      btn.setAttribute("aria-expanded", String(!open));
      panel.style.height = open ? "0px" : panel.scrollHeight + "px";
    });
  });
  window.addEventListener("resize", () => {
    document.querySelectorAll("#accordion .acc-btn[aria-expanded='true'] .acc-panel, #accordion .acc-panel")
      .forEach((p) => {
        const btn = p.closest(".acc-item")?.querySelector(".acc-btn");
        if (btn && btn.getAttribute("aria-expanded") === "true") p.style.height = p.scrollHeight + "px";
      });
  });
  onResize.push(() => {});

  /* ---------------- Magnetic buttons ---------------- */
  if (finePointer.matches && !reduceMotion.matches) {
    document.querySelectorAll(".magnetic").forEach((el) => {
      let raf = null, tx = 0, ty = 0;
      const apply = () => { raf = null; el.style.transform = "translate(" + tx + "px," + ty + "px)"; };
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        tx = (e.clientX - (r.left + r.width / 2)) * 0.12;
        ty = (e.clientY - (r.top + r.height / 2)) * 0.18 - 2;
        if (!raf) raf = requestAnimationFrame(apply);
      });
      el.addEventListener("pointerleave", () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(apply); });
    });
  }

  /* ---------------- Mobile menu ---------------- */
  const menu = document.getElementById("mobileMenu");
  const menuBtn = document.getElementById("menuBtn");
  let menuOpen = false, lastFocus = null;

  const setMenu = (open) => {
    menuOpen = open;
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add("open"));
      lastFocus = document.activeElement;
      document.body.style.overflow = "hidden";
      menu.querySelector(".mobile-menu-close").focus();
    } else {
      menu.classList.remove("open");
      document.body.style.overflow = "";
      if (lastFocus) lastFocus.focus();
      setTimeout(() => { menu.hidden = true; }, reduceMotion.matches ? 0 : 500);
    }
    menuBtn.setAttribute("aria-expanded", String(open));
  };

  menuBtn.addEventListener("click", () => setMenu(!menuOpen));
  menu.querySelectorAll("[data-menu-close]").forEach((el) => el.addEventListener("click", () => setMenu(false)));
  menu.querySelectorAll(".mobile-menu-links a").forEach((a) => a.addEventListener("click", () => setMenu(false)));

  document.addEventListener("keydown", (e) => {
    if (!menuOpen) return;
    if (e.key === "Escape") setMenu(false);
    if (e.key === "Tab") {
      const focusables = menu.querySelectorAll("a, button");
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  });

  /* ---------------- Footer year ---------------- */
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  // first paint
  requestFrame();
})();
