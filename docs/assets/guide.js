/* ============================================================
   CLMEL26 NetDevOps Lab Guide — markdown-driven single page.
   Each tab is its own Markdown file under docs/content/. Edit a
   file, push, and the published site updates. Cisco-branded dark
   (with light toggle) layout: left tabs + menu, right content.
   ============================================================ */
(function () {
  "use strict";

  // One editable Markdown file per left-hand tab.
  var TABS = [
    { id: "overview", label: "Overview", file: "content/overview.md" },
    { id: "project",  label: "Project",  file: "content/project.md" },
    { id: "pipeline", label: "Pipeline", file: "content/pipeline.md" },
    { id: "handson",  label: "Hands-on", file: "content/handson.md" }
  ];

  var tabsMount, menuMount, panelsMount, pager, topbarTitle, sidebarEl;
  var panels = [];
  var currentTab = null;
  var scrollTicking = false;

  /* ---------------- Theme ---------------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("guideTheme", theme); } catch (e) {}
    var lbl = document.querySelector(".theme-toggle__label");
    var icon = document.querySelector(".theme-toggle__icon");
    if (lbl) lbl.textContent = theme === "light" ? "Light" : "Dark";
    if (icon) icon.textContent = theme === "light" ? "\u2600" : "\u263E";
  }
  function initialTheme() {
    try { var t = localStorage.getItem("guideTheme"); if (t === "light" || t === "dark") return t; } catch (e) {}
    return "dark";
  }
  function mermaidTheme() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "neutral" : "dark";
  }

  /* ---------------- Mermaid ---------------- */
  function activePanelEl() {
    return document.querySelector(".panel.active");
  }

  // Render only the diagrams inside `container` that are not yet drawn for the
  // current theme. Diagrams are rendered lazily as their tab becomes visible:
  // mermaid cannot measure elements inside a display:none panel (it emits
  // "translate(undefined, NaN)" SVGs), so hidden diagrams are never rendered.
  function renderMermaidIn(container) {
    if (!window.mermaid || !container) return;
    var theme = mermaidTheme();
    try {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: theme,
        securityLevel: "loose",
        flowchart: { htmlLabels: true, curve: "basis" },
        themeVariables: { fontFamily: "Inter, Segoe UI, sans-serif" }
      });
    } catch (e) {}
    var nodes = Array.prototype.slice.call(container.querySelectorAll(".mermaid"))
      .filter(function (n) { return n.getAttribute("data-theme-rendered") !== theme; });
    if (!nodes.length) return;
    nodes.forEach(function (n) {
      n.removeAttribute("data-processed");
      n.innerHTML = n.getAttribute("data-src") || n.textContent;
      n.setAttribute("data-theme-rendered", theme);
    });
    if (typeof window.mermaid.run === "function") {
      try {
        var result = window.mermaid.run({ nodes: nodes });
        if (result && typeof result.catch === "function") { result.catch(function () {}); }
      } catch (e) {
        try { window.mermaid.init(undefined, nodes); } catch (e2) {}
      }
    } else {
      try { window.mermaid.init(undefined, nodes); } catch (e2) {}
    }
  }

  /* ---------------- Helpers ---------------- */
  function parseNum(title) {
    var m = /^\s*(\d+)/.exec(title);
    return m ? parseInt(m[1], 10) : NaN;
  }
  function stripNum(title) {
    return title.replace(/^\s*\d+[.\u00b7)\s]+/, "").trim();
  }

  function convertMermaid(root) {
    root.querySelectorAll("code.language-mermaid").forEach(function (code) {
      var pre = code.closest("pre");
      if (!pre) return;
      var src = code.textContent;
      var fig = document.createElement("div");
      fig.className = "mermaid-figure";
      var m = document.createElement("div");
      m.className = "mermaid";
      m.setAttribute("data-src", src);
      m.textContent = src;
      fig.appendChild(m);
      pre.replaceWith(fig);
    });
  }

  function wrapTables(root) {
    root.querySelectorAll("table").forEach(function (t) {
      if (t.parentElement && t.parentElement.classList.contains("table-wrap")) return;
      var w = document.createElement("div");
      w.className = "table-wrap";
      t.replaceWith(w);
      w.appendChild(t);
    });
  }

  function styleCallouts(root) {
    root.querySelectorAll("blockquote").forEach(function (bq) {
      bq.classList.add("callout");
      var txt = bq.textContent.toLowerCase();
      if (/\b(fail|failed|error|stops?|invalid|danger|black[- ]?hole|never|must not|unreachable)\b/.test(txt)) {
        bq.classList.add("callout--err");
      } else if (/\b(warn|caution|careful|patient|note that|reserved)\b/.test(txt)) {
        bq.classList.add("callout--warn");
      } else if (/\b(success|passed|verified|safe|idempoten|tip|expected|green)\b/.test(txt)) {
        bq.classList.add("callout--ok");
      }
    });
  }

  // Turn Markdown images into framed figures. When an image is the only thing in
  // its paragraph, its alt text becomes a caption below it.
  function styleImages(root) {
    root.querySelectorAll("img").forEach(function (img) {
      img.classList.add("md-img");
      img.setAttribute("loading", "lazy");
      var p = img.parentElement;
      if (p && p.tagName === "P" && p.childNodes.length === 1) {
        var fig = document.createElement("figure");
        fig.className = "md-figure";
        p.replaceWith(fig);
        fig.appendChild(img);
        var alt = img.getAttribute("alt");
        if (alt) {
          var cap = document.createElement("figcaption");
          cap.textContent = alt;
          fig.appendChild(cap);
        }
      }
    });
  }

  function addCopyButtons(root) {
    root.querySelectorAll("pre").forEach(function (pre) {
      if (pre.closest(".mermaid-figure")) return;
      var wrap = document.createElement("div");
      wrap.className = "codeblock";
      pre.replaceWith(wrap);
      wrap.appendChild(pre);
      var btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.type = "button";
      btn.textContent = "Copy";
      btn.addEventListener("click", function () {
        navigator.clipboard.writeText(pre.innerText).then(function () {
          btn.textContent = "Copied!";
          btn.classList.add("copied");
          setTimeout(function () { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1500);
        }).catch(function () { btn.textContent = "Ctrl+C"; });
      });
      wrap.appendChild(btn);
    });
  }

  function accentHeadings(root) {
    root.querySelectorAll("h2").forEach(function (h) {
      var m = /^\s*(\d+)[.\u00b7)]?\s+([\s\S]+)$/.exec(h.textContent);
      if (!m) return;
      h.textContent = "";
      var num = document.createElement("span");
      num.className = "h2-accent";
      num.textContent = m[1] + " \u00b7 ";
      h.appendChild(num);
      h.appendChild(document.createTextNode(m[2]));
    });
  }

  /* ---------------- Navigation ---------------- */
  function renderMenu(tab) {
    menuMount.innerHTML = "";
    var label = document.createElement("div");
    label.className = "menu__label";
    label.textContent = tab.label;
    menuMount.appendChild(label);

    tab.sections.forEach(function (s) {
      var group = document.createElement("div");
      group.className = "menu__group";
      group.dataset.group = s.id;

      var a = document.createElement("a");
      a.href = "#" + s.id;
      a.className = "menu__main";
      a.dataset.sec = s.id;
      var num = document.createElement("span");
      num.className = "num";
      num.textContent = s.num;
      var t = document.createElement("span");
      t.className = "menu__text";
      t.textContent = stripNum(s.title);
      a.appendChild(num);
      a.appendChild(t);
      if (s.subs.length) {
        var caret = document.createElement("span");
        caret.className = "menu__caret";
        caret.setAttribute("aria-hidden", "true");
        caret.textContent = "\u203A";
        a.appendChild(caret);
      }
      a.addEventListener("click", function (e) { e.preventDefault(); gotoSection(s.id); });
      group.appendChild(a);

      if (s.subs.length) {
        var subsWrap = document.createElement("div");
        subsWrap.className = "menu__subs";
        s.subs.forEach(function (sub) {
          var sa = document.createElement("a");
          sa.href = "#" + sub.id;
          sa.className = "menu__sub";
          sa.dataset.sec = sub.id;
          sa.textContent = sub.title;
          sa.addEventListener("click", function (e) { e.preventDefault(); gotoSection(sub.id); });
          subsWrap.appendChild(sa);
        });
        group.appendChild(subsWrap);
      }

      menuMount.appendChild(group);
    });
  }

  function buildPager(id) {
    var idx = TABS.findIndex(function (t) { return t.id === id; });
    pager.innerHTML = "";
    var prev = TABS[idx - 1], next = TABS[idx + 1];

    var pb = document.createElement("button");
    pb.type = "button";
    if (prev) {
      pb.innerHTML = '<span class="dir">\u2190 Previous</span><span class="lbl">' + prev.label + "</span>";
      pb.addEventListener("click", function () { activateTab(prev.id, true); });
    } else { pb.disabled = true; }
    pager.appendChild(pb);

    var nb = document.createElement("button");
    nb.type = "button";
    nb.className = "next";
    if (next) {
      nb.innerHTML = '<span class="dir">Next \u2192</span><span class="lbl">' + next.label + "</span>";
      nb.addEventListener("click", function () { activateTab(next.id, true); });
    } else { nb.disabled = true; }
    pager.appendChild(nb);
  }

  function activateTab(id, scrollTop) {
    var tab = TABS.find(function (t) { return t.id === id; });
    if (!tab) return;
    currentTab = id;

    document.querySelectorAll(".tab").forEach(function (b) {
      b.classList.toggle("active", b.dataset.tab === id);
      b.setAttribute("aria-selected", b.dataset.tab === id ? "true" : "false");
    });
    panels.forEach(function (p) { p.classList.toggle("active", p.id === "panel-" + id); });
    renderMermaidIn(document.getElementById("panel-" + id));

    renderMenu(tab);
    buildPager(id);
    if (topbarTitle) topbarTitle.textContent = tab.label;
    document.body.classList.remove("nav-open");
    if (scrollTop) window.scrollTo({ top: 0, behavior: "smooth" });
    updateActiveMenu();
  }

  function gotoSection(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var y = el.getBoundingClientRect().top + window.pageYOffset - 14;
    window.scrollTo({ top: y, behavior: "smooth" });
    document.body.classList.remove("nav-open");
  }

  // Keep the highlighted menu link within the visible band of the scrollable
  // sidebar, nudging it up or down only when it drifts out of view.
  function scrollMenuToActive(link) {
    if (!sidebarEl || !link) return;
    var box = sidebarEl.getBoundingClientRect();
    var lb = link.getBoundingClientRect();
    var margin = 44;
    if (lb.top < box.top + margin) {
      sidebarEl.scrollTop -= (box.top + margin - lb.top);
    } else if (lb.bottom > box.bottom - margin) {
      sidebarEl.scrollTop += (lb.bottom - (box.bottom - margin));
    }
  }

  // Scroll-spy across both levels: highlights the current main topic (h2) and
  // sub-topic (h3), expands the active group, and keeps the active link in view.
  function updateActiveMenu() {
    var panel = document.querySelector(".panel.active");
    if (!panel) return;
    var targets = Array.prototype.slice.call(panel.querySelectorAll(".guide-section, .guide-sub"));
    var best = null, bestTop = -Infinity;
    targets.forEach(function (el) {
      var top = el.getBoundingClientRect().top;
      if (top - 130 <= 0 && top > bestTop) { bestTop = top; best = el; }
    });
    if (!best && targets.length) best = targets[0];
    var activeId = best ? best.id : null;

    var mainId = null;
    if (best) {
      if (best.classList.contains("guide-section")) { mainId = best.id; }
      else { var sec = best.closest(".guide-section"); mainId = sec ? sec.id : null; }
    }

    menuMount.querySelectorAll("a").forEach(function (a) {
      a.classList.toggle("active", a.dataset.sec === activeId);
    });
    menuMount.querySelectorAll(".menu__group").forEach(function (g) {
      var open = g.dataset.group === mainId;
      g.classList.toggle("open", open);
      var mainLink = g.querySelector(".menu__main");
      if (mainLink) mainLink.classList.toggle("active-parent", open && activeId !== mainId);
    });

    var activeLink = menuMount.querySelector("a.active");
    if (activeLink) scrollMenuToActive(activeLink);
  }

  /* ---------------- Build ---------------- */
  // `texts` is an array of Markdown strings, one per TAB (same order).
  function build(texts) {
    panelsMount.innerHTML = "";
    panels = [];

    TABS.forEach(function (tab, ti) {
      var html = window.marked.parse(texts[ti], { gfm: true, breaks: false, headerIds: false, mangle: false });
      var tmp = document.createElement("div");
      tmp.innerHTML = html;

      var panel = document.createElement("section");
      panel.className = "panel";
      panel.id = "panel-" + tab.id;
      panel.setAttribute("role", "tabpanel");
      tab.sections = [];

      // Partition each file's content into main sections by <h2>, and collect the
      // <h3> sub-topics inside each so the left menu can show two nested levels.
      var secEl = null, curSection = null, secIdx = 0;
      Array.prototype.slice.call(tmp.childNodes).forEach(function (node) {
        if (node.nodeType === 1 && node.tagName === "H2") {
          var title = node.textContent.trim();
          secIdx = tab.sections.length + 1;
          var n = parseNum(title);
          var secId = "sec-" + tab.id + "-" + secIdx;
          secEl = document.createElement("div");
          secEl.className = "guide-section";
          secEl.id = secId;
          secEl.appendChild(node);
          panel.appendChild(secEl);
          curSection = { num: isNaN(n) ? String(secIdx) : String(n), title: title, id: secId, subs: [] };
          tab.sections.push(curSection);
        } else if (secEl) {
          if (node.nodeType === 1 && node.tagName === "H3" && curSection) {
            var subIdx = curSection.subs.length + 1;
            var subId = "sub-" + tab.id + "-" + secIdx + "-" + subIdx;
            node.id = subId;
            node.classList.add("guide-sub");
            curSection.subs.push({ id: subId, title: node.textContent.trim() });
          }
          secEl.appendChild(node);
        }
        // any content before the first H2 is ignored (files start at an H2).
      });

      panelsMount.appendChild(panel);
      panels.push(panel);
    });

    // Post-process content now that it is in the DOM.
    accentHeadings(panelsMount);
    convertMermaid(panelsMount);
    wrapTables(panelsMount);
    styleCallouts(panelsMount);
    styleImages(panelsMount);
    addCopyButtons(panelsMount);

    // Build the tab buttons (once).
    tabsMount.innerHTML = "";
    TABS.forEach(function (tab) {
      var b = document.createElement("button");
      b.className = "tab";
      b.type = "button";
      b.dataset.tab = tab.id;
      b.textContent = tab.label;
      b.setAttribute("role", "tab");
      b.addEventListener("click", function () { activateTab(tab.id, true); });
      tabsMount.appendChild(b);
    });

    activateTab(TABS[0].id, false);

    window.addEventListener("scroll", function () {
      if (scrollTicking) return;
      scrollTicking = true;
      window.requestAnimationFrame(function () { updateActiveMenu(); scrollTicking = false; });
    }, { passive: true });
  }

  function showError(message) {
    if (!panelsMount) return;
    panelsMount.innerHTML =
      '<div class="load-error"><strong>Could not load the guide.</strong><br>' + message +
      '<br><br>The page renders the Markdown files in <code>content/</code> at runtime, so it must be ' +
      'served over HTTP (GitHub Pages does this automatically). If you opened the file directly, run a ' +
      'local server first.</div>';
  }

  /* ---------------- Boot ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    tabsMount = document.getElementById("tabs");
    menuMount = document.getElementById("menu");
    panelsMount = document.getElementById("panels");
    pager = document.getElementById("pager");
    topbarTitle = document.getElementById("topbar-title");
    sidebarEl = document.getElementById("sidebar");

    applyTheme(initialTheme());

    var toggle = document.getElementById("theme-toggle");
    if (toggle) toggle.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      applyTheme(next);
      renderMermaidIn(activePanelEl());
    });

    var hamburger = document.getElementById("hamburger");
    var backdrop = document.getElementById("backdrop");
    if (hamburger) hamburger.addEventListener("click", function () { document.body.classList.toggle("nav-open"); });
    if (backdrop) backdrop.addEventListener("click", function () { document.body.classList.remove("nav-open"); });

    if (!window.marked) { showError("The markdown renderer (marked) failed to load from the CDN."); return; }

    Promise.all(TABS.map(function (tab) {
      return fetch(tab.file, { cache: "no-cache" }).then(function (r) {
        if (!r.ok) throw new Error(tab.file + " \u2192 HTTP " + r.status);
        return r.text();
      });
    }))
      .then(build)
      .catch(function (err) { showError(String(err && err.message ? err.message : err)); });
  });
})();
