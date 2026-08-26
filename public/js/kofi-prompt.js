/*
 * Shared "Ko-fi success" toast.
 * Call window.showKofiPrompt() right after a tool produces a genuine,
 * user-initiated successful result. Shows once ever per visitor
 * (tracked via localStorage), regardless of how many tools they use.
 */
(function () {
  var STORAGE_KEY = 'opsbash_kofi_prompt_shown';
  var AUTO_DISMISS_MS = 9000;
  var KOFI_URL = 'https://ko-fi.com/rishmish';

  function alreadyShown() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch (e) {
      // localStorage unavailable (private mode, blocked, etc) — don't show,
      // since we can't guarantee the "once ever" contract.
      return true;
    }
  }

  function markShown() {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'true');
    } catch (e) {
      // ignore — nothing we can do if storage is blocked
    }
  }

  function injectStyles() {
    if (document.getElementById('kofi-prompt-styles')) return;
    var style = document.createElement('style');
    style.id = 'kofi-prompt-styles';
    style.textContent =
      '#kofi-prompt-toast{' +
        'position:fixed;bottom:20px;right:20px;z-index:60;' +
        'width:min(320px, calc(100vw - 32px));' +
        'background:#111111;border:1px solid #222222;border-radius:14px;' +
        'padding:16px;box-shadow:0 12px 32px rgba(0,0,0,0.45);' +
        'font-family:Inter,sans-serif;' +
        'opacity:0;transform:translateY(16px);' +
        'transition:opacity 0.28s ease-out, transform 0.28s ease-out;' +
      '}' +
      '#kofi-prompt-toast.kofi-toast-visible{opacity:1;transform:translateY(0);}' +
      '#kofi-prompt-toast .kofi-toast-close{' +
        'position:absolute;top:8px;right:8px;width:24px;height:24px;' +
        'display:flex;align-items:center;justify-content:center;' +
        'background:transparent;border:none;border-radius:6px;cursor:pointer;' +
        'color:#94A3B8;line-height:1;font-size:16px;padding:0;' +
      '}' +
      '#kofi-prompt-toast .kofi-toast-close:hover,' +
      '#kofi-prompt-toast .kofi-toast-close:focus-visible{color:#F8FAFC;background:rgba(248,250,252,0.08);}' +
      '#kofi-prompt-toast .kofi-toast-msg{' +
        'margin:0 22px 12px 0;font-size:13px;line-height:1.5;color:#F8FAFC;' +
      '}' +
      '#kofi-prompt-toast .kofi-toast-btn{' +
        'display:inline-flex;align-items:center;background:#F97316;color:#000000;' +
        'font-weight:700;font-size:13px;padding:8px 16px;border-radius:9999px;' +
        'text-decoration:none;white-space:nowrap;transition:background 0.15s, box-shadow 0.15s;' +
        'font-family:Inter,sans-serif;' +
      '}' +
      '#kofi-prompt-toast .kofi-toast-btn:hover{background:#EA6A0A;box-shadow:0 0 16px rgba(249,115,22,0.35);}' +
      '@media (prefers-reduced-motion: reduce){' +
        '#kofi-prompt-toast{transition:opacity 0.01ms;transform:none;}' +
      '}';
    document.head.appendChild(style);
  }

  window.showKofiPrompt = function () {
    if (alreadyShown()) return;
    if (document.getElementById('kofi-prompt-toast')) return; // already open this pageview

    markShown();
    injectStyles();

    var toast = document.createElement('div');
    toast.id = 'kofi-prompt-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.position = 'fixed';
    toast.innerHTML =
      '<button type="button" class="kofi-toast-close" aria-label="Dismiss">&times;</button>' +
      '<p class="kofi-toast-msg">Glad this helped! If OpsBash saves you time, a coffee keeps it free and ad-free.</p>' +
      '<a href="' + KOFI_URL + '" target="_blank" rel="noopener noreferrer" class="kofi-toast-btn">Buy me a Koffee</a>';

    document.body.appendChild(toast);

    var closeBtn = toast.querySelector('.kofi-toast-close');
    var dismissTimer;

    function dismiss() {
      clearTimeout(dismissTimer);
      toast.classList.remove('kofi-toast-visible');
      toast.addEventListener('transitionend', function handler() {
        toast.removeEventListener('transitionend', handler);
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      });
      // Fallback removal in case transitionend doesn't fire (e.g. reduced motion)
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 400);
    }

    function scheduleAutoDismiss() {
      dismissTimer = setTimeout(dismiss, AUTO_DISMISS_MS);
    }

    closeBtn.addEventListener('click', dismiss);
    toast.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') dismiss();
    });
    toast.addEventListener('mouseenter', function () { clearTimeout(dismissTimer); });
    toast.addEventListener('mouseleave', scheduleAutoDismiss);
    toast.addEventListener('focusin', function () { clearTimeout(dismissTimer); });
    toast.addEventListener('focusout', scheduleAutoDismiss);

    // Trigger enter animation on next frame
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        toast.classList.add('kofi-toast-visible');
      });
    });

    scheduleAutoDismiss();
  };
})();
