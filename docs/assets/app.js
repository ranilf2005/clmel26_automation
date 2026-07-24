/* ============================================================
   CLMEL26 Automation Lab Guide — shared UI script
   Builds sidebar nav, prev/next pager, copy buttons, mobile menu.
   ============================================================ */
(function () {
  "use strict";

  // Ordered list of pages — single source of truth for navigation.
  var PAGES = [
    { file: "index.html",          num: "\u2302", title: "Home",              group: "Introduction" },
    { file: "overview.html",       num: "0",       title: "Overview",          group: "Introduction" },
    { file: "getting-started.html",num: "1",       title: "Getting Started",   group: "Lab Guide" },
    { file: "prepare-lab.html",    num: "2",       title: "Prepare the Lab",   group: "Lab Guide" },
    { file: "gitlab-project.html", num: "3",       title: "GitLab Project",    group: "Lab Guide" },
    { file: "pipeline.html",       num: "4",       title: "Pipeline Run",      group: "Lab Guide" },
    { file: "ansible-vlans.html", num: "5",       title: "Ansible VLAN Task", group: "Lab Guide" },
    { file: "project-files.html",  num: "6",       title: "Project Files",     group: "Reference" },
    { file: "appendix-other.html", num: "7",       title: "Appendix",          group: "Reference" },
    { file: "topologies.html",     num: "\u25C9",  title: "Topologies",        group: "Reference" },
    { file: "conclusion.html",     num: "\u2713",  title: "Conclusion",        group: "Reference" }
  ];

  function currentFile() {
    var path = location.pathname.split("/").pop();
    return path && path.length ? path : "index.html";
  }

  function buildSidebar() {
    var mount = document.getElementById("sidebar-mount");
    if (!mount) return;
    var here = currentFile();

    var html = '' +
      '<a class="sidebar__brand" href="index.html">' +
        '<span class="sidebar__logo">NA</span>' +
        '<span>' +
          '<span class="sidebar__title">NetDevOps Lab</span><br>' +
          '<span class="sidebar__subtitle">LTRENS-2687 &middot; CLMEL26</span>' +
        '</span>' +
      '</a>' +
      '<nav class="nav" aria-label="Lab sections">';

    var lastGroup = null;
    PAGES.forEach(function (p) {
      if (p.group !== lastGroup) {
        html += '<div class="nav__group-label">' + p.group + '</div>';
        lastGroup = p.group;
      }
      var active = (p.file === here) ? " active" : "";
      html += '<a class="' + active.trim() + '" href="' + p.file + '">' +
                '<span class="nav__num">' + p.num + '</span>' +
                '<span>' + p.title + '</span>' +
              '</a>';
    });
    html += '</nav>';
    mount.innerHTML = html;
  }

  function buildPager() {
    var mount = document.getElementById("pager-mount");
    if (!mount) return;
    var here = currentFile();
    var idx = PAGES.findIndex(function (p) { return p.file === here; });
    if (idx === -1) return;

    var prev = PAGES[idx - 1];
    var next = PAGES[idx + 1];
    var html = "";
    if (prev) {
      html += '<a href="' + prev.file + '"><span class="dir">&larr; Previous</span>' +
              '<span class="lbl">' + prev.title + '</span></a>';
    } else {
      html += '<span></span>';
    }
    if (next) {
      html += '<a class="next" href="' + next.file + '"><span class="dir">Next &rarr;</span>' +
              '<span class="lbl">' + next.title + '</span></a>';
    }
    mount.innerHTML = html;
  }

  function buildTopbar() {
    var here = currentFile();
    var page = PAGES.find(function (p) { return p.file === here; });
    var el = document.querySelector(".topbar__title");
    if (el && page) el.textContent = page.title;
  }

  function wireMobileMenu() {
    var btn = document.querySelector(".hamburger");
    var backdrop = document.querySelector(".backdrop");
    if (btn) btn.addEventListener("click", function () { document.body.classList.toggle("nav-open"); });
    if (backdrop) backdrop.addEventListener("click", function () { document.body.classList.remove("nav-open"); });
    document.addEventListener("click", function (e) {
      var link = e.target.closest && e.target.closest(".nav a");
      if (link) document.body.classList.remove("nav-open");
    });
  }

  function wireCopyButtons() {
    document.querySelectorAll(".copy-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var wrap = btn.closest(".codeblock");
        var pre = wrap && wrap.querySelector("pre");
        if (!pre) return;
        var text = pre.innerText;
        navigator.clipboard.writeText(text).then(function () {
          var original = btn.textContent;
          btn.textContent = "Copied!";
          btn.classList.add("copied");
          setTimeout(function () { btn.textContent = original; btn.classList.remove("copied"); }, 1600);
        }).catch(function () {
          btn.textContent = "Press Ctrl+C";
        });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    buildSidebar();
    buildPager();
    buildTopbar();
    wireMobileMenu();
    wireCopyButtons();

    if (window.mermaid) {
      window.mermaid.initialize({
        startOnLoad: true,
        theme: "base",
        themeVariables: {
          primaryColor: "#eaf2fb",
          primaryBorderColor: "#049fd9",
          primaryTextColor: "#0d274d",
          lineColor: "#5b7290",
          fontFamily: "Inter, Segoe UI, sans-serif"
        }
      });
    }
  });
})();
