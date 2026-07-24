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

  /* ----------------------------------------------------------------
     Author mode — paste a clipboard image and get the correct path.

     A browser cannot write into the repo, so this tool: detects the
     current section, names the file, shows a preview, DOWNLOADS the
     image, copies the ready <figure> snippet, and drops a live preview
     into the page. Save the download into the shown folder and commit.

     Enable with ?author=1 (sticky) or when viewing on localhost.
     Disable with ?author=0. The published site is unaffected.
     ---------------------------------------------------------------- */
  var IMG_SRC_PREFIX = "assets/images";

  function slugFromFile(file) { return file.replace(/\.html$/, ""); }

  function isAuthorMode() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get("author") === "1") localStorage.setItem("authorMode", "1");
      if (q.get("author") === "0") localStorage.removeItem("authorMode");
    } catch (e) {}
    var h = location.hostname;
    var local = h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h === "";
    var flag = false;
    try { flag = localStorage.getItem("authorMode") === "1"; } catch (e) {}
    return local || flag;
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function timestampName(section) {
    var d = new Date();
    return section + "-" + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) +
           "-" + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds()) + ".png";
  }

  function buildSnippet(section, filename, caption) {
    var src = IMG_SRC_PREFIX + "/" + section + "/" + filename;
    var alt = caption || (section + " screenshot");
    var lines = [
      '<figure class="figure">',
      '  <img src="' + src + '" alt="' + alt + '" loading="lazy">'
    ];
    if (caption) lines.push('  <figcaption>' + caption + '</figcaption>');
    lines.push('</figure>');
    return lines.join("\n");
  }

  function insertLivePreview(section, filename, caption, blobUrl) {
    var content = document.querySelector(".content");
    if (!content) return null;
    var src = IMG_SRC_PREFIX + "/" + section + "/" + filename;
    var fig = document.createElement("figure");
    fig.className = "figure author-inserted";
    var img = document.createElement("img");
    img.setAttribute("loading", "lazy");
    img.alt = caption || (section + " screenshot");
    img.src = src;                       // real committed path...
    img.onerror = function () {          // ...falls back to the preview blob
      if (img.src !== blobUrl) { img.src = blobUrl; }
    };
    fig.appendChild(img);
    if (caption) {
      var cap = document.createElement("figcaption");
      cap.textContent = caption;
      fig.appendChild(cap);
    }
    var tag = document.createElement("span");
    tag.className = "author-inserted__tag";
    tag.textContent = "preview · save image then commit";
    fig.appendChild(tag);
    var pager = content.querySelector("#pager-mount");
    content.insertBefore(fig, pager || null);
    fig.scrollIntoView({ behavior: "smooth", block: "center" });
    return fig;
  }

  function toast(msg) {
    var t = document.createElement("div");
    t.className = "author-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add("show"); }, 10);
    setTimeout(function () { t.classList.remove("show"); }, 2200);
    setTimeout(function () { t.remove(); }, 2600);
  }

  function showAuthorPanel(section, blob, blobUrl, width, height) {
    var existing = document.getElementById("author-panel");
    if (existing) existing.remove();

    var filename = timestampName(section);
    var folder = "docs/" + IMG_SRC_PREFIX + "/" + section + "/";

    var panel = document.createElement("div");
    panel.id = "author-panel";
    panel.className = "author-panel";
    panel.innerHTML =
      '<div class="author-panel__head">' +
        '<strong>Paste image → ' + section + '</strong>' +
        '<button class="author-panel__x" title="Close">&times;</button>' +
      '</div>' +
      '<img class="author-panel__preview" alt="preview">' +
      '<div class="author-panel__meta">' + width + '\u00d7' + height + ' px · saves to <code>' + folder + '</code></div>' +
      '<label class="author-panel__lbl">File name</label>' +
      '<input class="author-panel__in" id="ap-name" value="' + filename + '">' +
      '<label class="author-panel__lbl">Caption (optional)</label>' +
      '<input class="author-panel__in" id="ap-cap" placeholder="e.g. CML dashboard">' +
      '<label class="author-panel__lbl">Snippet (auto-copied)</label>' +
      '<textarea class="author-panel__code" id="ap-code" rows="4" readonly></textarea>' +
      '<div class="author-panel__row">' +
        '<button class="btn btn--outline" id="ap-dl">Download image</button>' +
        '<button class="btn btn--outline" id="ap-copy">Copy snippet</button>' +
      '</div>' +
      '<p class="author-panel__note">Browsers can\u2019t write to the repo. Save the download into ' +
        'the folder above (or run <code>python tools/paste_image.py</code>) and commit.</p>';
    document.body.appendChild(panel);

    var preview = panel.querySelector(".author-panel__preview");
    preview.src = blobUrl;
    var nameIn = panel.querySelector("#ap-name");
    var capIn = panel.querySelector("#ap-cap");
    var codeEl = panel.querySelector("#ap-code");

    var liveFig = null;
    function refresh(doCopy) {
      var name = nameIn.value.trim() || filename;
      var cap = capIn.value.trim();
      var snippet = buildSnippet(section, name, cap);
      codeEl.value = snippet;
      if (liveFig) liveFig.remove();
      liveFig = insertLivePreview(section, name, cap, blobUrl);
      if (doCopy && navigator.clipboard) {
        navigator.clipboard.writeText(snippet).catch(function () {});
      }
    }
    nameIn.addEventListener("input", function () { refresh(false); });
    capIn.addEventListener("input", function () { refresh(false); });

    panel.querySelector("#ap-copy").addEventListener("click", function () {
      navigator.clipboard.writeText(codeEl.value).then(function () { toast("Snippet copied"); });
    });
    panel.querySelector("#ap-dl").addEventListener("click", function () {
      var a = document.createElement("a");
      a.href = blobUrl;
      a.download = nameIn.value.trim() || filename;
      document.body.appendChild(a); a.click(); a.remove();
      toast("Saved to Downloads — move it into " + folder);
    });
    panel.querySelector(".author-panel__x").addEventListener("click", function () {
      if (liveFig) liveFig.remove();
      panel.remove();
    });

    refresh(true); // auto-insert live preview + auto-copy snippet
    toast("Snippet copied · image ready to download");
  }

  function onAuthorPaste(e) {
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    var items = (e.clipboardData && e.clipboardData.items) || [];
    var file = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf("image") === 0) {
        file = items[i].getAsFile();
        break;
      }
    }
    if (!file) return;
    e.preventDefault();
    var section = slugFromFile(currentFile());
    var blobUrl = URL.createObjectURL(file);
    var probe = new Image();
    probe.onload = function () {
      showAuthorPanel(section, file, blobUrl, probe.naturalWidth, probe.naturalHeight);
    };
    probe.src = blobUrl;
  }

  function wireAuthorPaste() {
    if (!isAuthorMode()) return;
    var badge = document.createElement("div");
    badge.className = "author-badge";
    badge.innerHTML = "\u25CF Author mode · <strong>Ctrl+V</strong> to paste an image";
    document.body.appendChild(badge);
    document.addEventListener("paste", onAuthorPaste);
  }

  document.addEventListener("DOMContentLoaded", function () {
    buildSidebar();
    buildPager();
    buildTopbar();
    wireMobileMenu();
    wireCopyButtons();
    wireAuthorPaste();

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
