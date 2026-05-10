/* Yozuv embeddable booking widget.
 *
 * Drop a single line on any third-party site:
 *
 *   <script src="https://yozuv.com/widget.js"
 *           data-business="ahmad-barber"
 *           async></script>
 *
 * Optional attributes:
 *   data-position="left" | "right" (default right)
 *   data-label="Yozilish"          (default "Yozilish")
 *   data-color="#4853F5"           (button background)
 *
 * The script renders a floating action button in the corner. Clicking
 * it opens an iframe pointing at https://<host>/biz/<slug>?embed=1.
 * Closing the iframe just removes it from the DOM. Re-opening reuses
 * the same iframe element so the page state is fresh each time.
 *
 * Lightweight on purpose: no React, no fetch — just DOM. Loads in
 * one network round-trip after the host page's parser resolves the
 * <script>. We tag the inserted nodes with data-yz="widget" so a
 * second include is a no-op.
 */
(function () {
  // Already injected — bail. Two embeds on the same page would just
  // pile up duplicate buttons.
  if (typeof document === "undefined" || document.querySelector('[data-yz="widget-root"]')) {
    return;
  }

  // Find our own <script> tag so we can read data-* attributes off it.
  // currentScript fails inside async/deferred contexts on some old
  // engines; we fall back to scanning script[src*="widget.js"].
  var me =
    document.currentScript ||
    (function () {
      var nodes = document.getElementsByTagName("script");
      for (var i = nodes.length - 1; i >= 0; i--) {
        if (/\/widget\.js(\?|$)/.test(nodes[i].src || "")) return nodes[i];
      }
      return null;
    })();
  if (!me) return;

  var slug = me.getAttribute("data-business") || "";
  if (!slug) {
    console.warn("[yozuv] widget: data-business is required");
    return;
  }

  // Origin we should iframe — same origin we were loaded from.
  var origin = "";
  try {
    origin = new URL(me.src, document.baseURI).origin;
  } catch (e) {
    origin = "https://yozuv.com";
  }
  var embedUrl = origin + "/biz/" + encodeURIComponent(slug) + "?embed=1";

  var position = (me.getAttribute("data-position") || "right").toLowerCase();
  var label = me.getAttribute("data-label") || "Yozilish";
  var color = me.getAttribute("data-color") || "#4853F5";

  // Container we own. Everything we add lives inside it so a host
  // CSS reset can't tank our z-index, and so a second include can
  // detect us via the [data-yz="widget-root"] selector above.
  var root = document.createElement("div");
  root.setAttribute("data-yz", "widget-root");
  root.style.cssText =
    "position:fixed;z-index:2147483600;" +
    (position === "left" ? "left:18px" : "right:18px") +
    ";bottom:18px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;";
  document.body.appendChild(root);

  // Floating button.
  var btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.style.cssText =
    "appearance:none;border:0;cursor:pointer;color:#fff;" +
    "background:" + color + ";" +
    "padding:14px 22px;border-radius:9999px;font-weight:700;font-size:15px;" +
    "box-shadow:0 12px 30px rgba(0,0,0,0.18);" +
    "transition:transform .15s ease;";
  btn.onmouseover = function () { btn.style.transform = "translateY(-1px)"; };
  btn.onmouseout = function () { btn.style.transform = "translateY(0)"; };
  root.appendChild(btn);

  // Hidden modal scaffolding — we mount it lazily on first click so
  // the iframe URL isn't fetched until the user actually wants it.
  var modal = null;
  var iframe = null;

  function openModal() {
    if (modal) {
      modal.style.display = "flex";
      // Force a reload so the page state is fresh — the user may
      // have booked, closed, returned later.
      iframe.src = embedUrl;
      return;
    }

    modal = document.createElement("div");
    modal.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;" +
      "background:rgba(11,15,31,0.55);backdrop-filter:blur(2px);" +
      "display:flex;align-items:stretch;justify-content:center;";
    modal.addEventListener("click", function (e) {
      // Close when clicking the backdrop, not the iframe itself.
      if (e.target === modal) closeModal();
    });

    var sheet = document.createElement("div");
    sheet.style.cssText =
      "position:relative;background:#fff;width:100%;max-width:520px;" +
      "margin:auto;border-radius:24px;overflow:hidden;" +
      "height:min(85vh,820px);box-shadow:0 30px 80px rgba(0,0,0,0.35);";

    var close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Yopish");
    close.textContent = "✕";
    close.style.cssText =
      "position:absolute;top:8px;right:8px;z-index:2;appearance:none;border:0;" +
      "width:36px;height:36px;border-radius:18px;cursor:pointer;" +
      "background:rgba(255,255,255,0.92);font-size:18px;line-height:1;" +
      "box-shadow:0 4px 12px rgba(0,0,0,0.15);";
    close.onclick = closeModal;

    iframe = document.createElement("iframe");
    iframe.src = embedUrl;
    iframe.title = "Yozuv";
    iframe.allow = "geolocation";
    iframe.style.cssText = "border:0;width:100%;height:100%;display:block;";

    sheet.appendChild(iframe);
    sheet.appendChild(close);
    modal.appendChild(sheet);
    document.body.appendChild(modal);

    // Listen for "close" postMessage from the iframe so the embedded
    // page can self-dismiss (e.g. after a successful booking).
    window.addEventListener("message", function (ev) {
      if (ev.origin !== origin) return;
      var data = ev.data;
      if (data && data.type === "yozuv:close") closeModal();
    });

    // Esc closes the modal.
    document.addEventListener("keydown", onKey);
  }

  function closeModal() {
    if (!modal) return;
    modal.style.display = "none";
    document.removeEventListener("keydown", onKey);
  }

  function onKey(ev) {
    if (ev.key === "Escape") closeModal();
  }

  btn.addEventListener("click", openModal);
})();
