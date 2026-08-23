/* =====================================================================
   Dr.Glass — interakciók
   ===================================================================== */
(function () {
  "use strict";

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ------------------------------------------------------------------
     1. Nyelvváltás
     ------------------------------------------------------------------ */
  var DICT = window.DRG_I18N || {};
  var LANGS = ["hu", "sk"];
  var STORE = "drglass.lang";

  // az elsődleges hívás gombok a nyelvhez tartozó számot tárcsázzák
  var TEL = { hu: "+36203914936", sk: "+421950349732" };

  function detectLang() {
    var url = new URLSearchParams(location.search).get("lang");
    if (LANGS.indexOf(url) > -1) return url;
    try {
      var saved = localStorage.getItem(STORE);
      if (LANGS.indexOf(saved) > -1) return saved;
    } catch (e) {}
    var nav = (navigator.language || "hu").slice(0, 2).toLowerCase();
    return nav === "sk" || nav === "cs" ? "sk" : "hu";
  }

  function applyLang(lang, persist) {
    var d = DICT[lang];
    if (!d) return;

    document.documentElement.lang = lang;
    document.documentElement.classList.add("lang-swapping");

    $$("[data-i18n]").forEach(function (el) {
      var v = d[el.getAttribute("data-i18n")];
      if (v != null) el.innerHTML = v;
    });

    $$("[data-i18n-attr]").forEach(function (el) {
      // formátum: "placeholder:ct.msgPh|aria-label:nav.menu"
      el.getAttribute("data-i18n-attr").split("|").forEach(function (pair) {
        var p = pair.split(":");
        var v = d[p[1]];
        if (v != null) el.setAttribute(p[0], v.replace(/<[^>]+>/g, ""));
      });
    });

    $$("[data-tel]").forEach(function (a) {
      a.href = "tel:" + TEL[lang];
      a.setAttribute("aria-label", (d["nav.call"] || "") + " " + TEL[lang]);
    });

    if (d["meta.title"]) document.title = d["meta.title"];
    var md = $('meta[name="description"]');
    if (md && d["meta.desc"]) md.setAttribute("content", d["meta.desc"]);

    $$(".lang button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    });

    if (persist) { try { localStorage.setItem(STORE, lang); } catch (e) {} }

    setTimeout(function () {
      document.documentElement.classList.remove("lang-swapping");
    }, 150);
  }

  $$(".lang button").forEach(function (b) {
    b.addEventListener("click", function () { applyLang(b.dataset.lang, true); });
  });

  applyLang(detectLang(), false);

  /* ------------------------------------------------------------------
     2. Header + mobil menü
     ------------------------------------------------------------------ */
  var header = $(".header");
  var onScroll = function () {
    header.classList.toggle("is-stuck", window.scrollY > 24);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  var burger = $(".burger");
  var nav = $(".nav");
  if (burger && nav) {
    burger.addEventListener("click", function () {
      var open = burger.getAttribute("aria-expanded") === "true";
      burger.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("is-open", !open);
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        burger.setAttribute("aria-expanded", "false");
        nav.classList.remove("is-open");
      }
    });
  }

  /* ------------------------------------------------------------------
     3. Aktív menüpont
     ------------------------------------------------------------------ */
  var navLinks = $$('.nav a[href^="#"]');
  var sections = navLinks
    .map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); })
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ------------------------------------------------------------------
     4. Scroll reveal
     ------------------------------------------------------------------ */
  var reveals = $$(".reveal");
  if ("IntersectionObserver" in window) {
    var ro = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); obs.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { ro.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ------------------------------------------------------------------
     5. Előtte / utána csúszkák
     ------------------------------------------------------------------ */
  $$(".ba").forEach(function (ba) {
    var range = $(".ba__range", ba);
    if (!range) return;           // sima fotókártya, nincs csúszka
    var set = function (v) {
      v = Math.max(0, Math.min(100, v));
      ba.style.setProperty("--pos", v + "%");
    };
    set(parseFloat(range.value));
    range.addEventListener("input", function () { set(parseFloat(range.value)); });

    // Egérrel / ujjal húzás bárhol a képen belül
    var drag = false;
    var move = function (clientX) {
      var r = ba.getBoundingClientRect();
      var v = ((clientX - r.left) / r.width) * 100;
      range.value = String(v);
      set(v);
    };
    ba.addEventListener("pointerdown", function (e) {
      drag = true; ba.setPointerCapture(e.pointerId); move(e.clientX);
    });
    ba.addEventListener("pointermove", function (e) { if (drag) move(e.clientX); });
    ["pointerup", "pointercancel"].forEach(function (ev) {
      ba.addEventListener(ev, function () { drag = false; });
    });

    /* Folyamatos „húzd el” jelzés.
       A vonal lassan ide-oda söpör, így látszik, hogy a két fotó váltakozik;
       a gomb közben lüktet. Amint a látogató hozzányúl, végleg leáll. */
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var raf = null;
    var done = false;
    var phase = Math.random() * Math.PI * 2;   // hogy a kártyák ne egyszerre mozogjanak

    var pause = function () {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      ba.classList.remove("is-hinting");
    };
    var play = function () {
      if (done || reduce || raf) return;
      ba.classList.add("is-hinting");
      var tick = function (t) {
        // abszolút időből számolva a szünet után is folytonos marad
        var v = 50 + Math.sin(t / 1900 * Math.PI + phase) * 9;
        range.value = String(v);
        set(v);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    var stop = function () { done = true; pause(); };

    ["pointerdown", "input", "keydown", "touchstart"].forEach(function (ev) {
      ba.addEventListener(ev, stop, { passive: true });
    });

    if ("IntersectionObserver" in window && !reduce) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { en.isIntersecting ? play() : pause(); });
      }, { threshold: 0.35 });
      io.observe(ba);
    }
  });

  /* ------------------------------------------------------------------
     6. Galéria szűrő
     ------------------------------------------------------------------ */
  var filterBtns = $$(".filters button");
  filterBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var f = btn.dataset.filter;
      filterBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
      // minden kattintásnál újraolvassuk: hiányzó fotójú kártyák közben eltűnhettek
      $$(".gallery > *").forEach(function (it) {
        it.hidden = !(f === "all" || it.dataset.cat === f);
      });
    });
  });

  /* ------------------------------------------------------------------
     7. Kapcsolati űrlap → előre kitöltött e-mail
     ------------------------------------------------------------------ */
  var form = $("#contact-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = new FormData(form);
      var lang = document.documentElement.lang === "sk" ? "sk" : "hu";
      var L = lang === "sk"
        ? { subj: "Dopyt z webu – ", name: "Meno", phone: "Telefón", mail: "E-mail", svc: "Služba", msg: "Popis" }
        : { subj: "Ajánlatkérés a weboldalról – ", name: "Név", phone: "Telefon", mail: "E-mail", svc: "Szolgáltatás", msg: "Leírás" };

      var body = [
        L.name  + ": " + (f.get("name")  || ""),
        L.phone + ": " + (f.get("phone") || ""),
        L.mail  + ": " + (f.get("email") || ""),
        L.svc   + ": " + (f.get("service") || ""),
        "",
        L.msg + ":",
        f.get("message") || ""
      ].join("\n");

      window.location.href =
        "mailto:info@dr-glass.eu" +
        "?subject=" + encodeURIComponent(L.subj + (f.get("name") || "")) +
        "&body=" + encodeURIComponent(body);
    });
  }

  /* ------------------------------------------------------------------
     8. Opcionális képek (ha a fájl nincs feltöltve, a kártya eltűnik)
     ------------------------------------------------------------------ */
  // ha egy galéria-kategória kiürült, a hozzá tartozó szűrőgomb is eltűnik
  var syncTimer;
  var syncFilters = function () {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      filterBtns.forEach(function (b) {
        var f = b.dataset.filter;
        if (f === "all") return;
        b.hidden = !document.querySelector('.gallery > [data-cat="' + f + '"]');
      });
    }, 120);
  };

  $$("img[data-optional]").forEach(function (img) {
    var drop = function () {
      var fig = img.closest("figure") || img;
      var box = fig.parentNode;
      if (!box) return;
      box.removeChild(fig);
      if (!box.children.length) box.style.display = "none";
      syncFilters();
    };
    if (img.complete && img.naturalWidth === 0) drop();
    img.addEventListener("error", drop);
  });

  window.addEventListener("load", syncFilters);

  /* ------------------------------------------------------------------
     9. Évszám a láblécben
     ------------------------------------------------------------------ */
  var y = $("#year");
  if (y) y.textContent = String(new Date().getFullYear());
})();
