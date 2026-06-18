/* =========================================================================
   Yamamotoya URL Shortening Tool — admin app
   Apple-JP design (案B). Vanilla JS wired to the live API.
   API: GET /api/links, POST /api/links, PATCH /api/links/:code,
        DELETE /api/links/:code, GET /api/stats?code=
   QR via the bundled qrcodejs (window.QRCode).
   ========================================================================= */
(function () {
  "use strict";

  /* ---- inline icons (Lucide-style, currentColor) ---------------------- */
  var I = {
    ext:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6"/><rect x="13" y="7" width="3" height="10"/><rect x="19" y="13" width="0.5" height="4"/></svg>',
    qr:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3"/><path d="M14 21h7"/><path d="M21 17v4"/></svg>',
    edit:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    power: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
    back:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>',
    link:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></svg>',
    eye:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10.7 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a13.4 13.4 0 0 1-2.4 3.1"/><path d="M6.6 6.6A13.4 13.4 0 0 0 2 12s3.5 7 10 7a10.8 10.8 0 0 0 4.2-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m2 2 20 20"/></svg>',
    copy:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
  };

  /* ---- helpers -------------------------------------------------------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function nf(n) { return Number(n || 0).toLocaleString("ja-JP"); }
  function statusOf(l) {
    if (l.disabled) return "disabled";
    if (l.expires_at != null && Date.now() > l.expires_at) return "expired";
    return "active";
  }
  var STATUS_LABEL = { active: "有効", disabled: "無効", expired: "期限切れ" };
  function badge(l) {
    var s = statusOf(l);
    return '<span class="badge badge--' + s + '">' + STATUS_LABEL[s] + "</span>";
  }
  function shortHost() { return location.host; }
  function shortUrl(code) { return location.origin + "/" + code; }

  // Expiry is a calendar date (no time). Store/restore as YYYY-MM-DD and treat
  // the chosen day's *end* (23:59:59.999 local) as the moment it expires, so a
  // link stays valid through the whole selected day.
  function msToDateInput(ms) {
    if (ms == null) return "";
    var d = new Date(ms);
    var p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function dateInputToMs(v) {
    if (!v) return null;
    var parts = v.split("-");
    if (parts.length !== 3) return null;
    var d = new Date(+parts[0], +parts[1] - 1, +parts[2], 23, 59, 59, 999);
    var ms = d.getTime();
    return isNaN(ms) ? null : ms;
  }

  function showFormError(el, msg) {
    el.querySelector(".form-error__msg").textContent = msg;
    el.hidden = false;
  }
  function clearFormError(el) { el.hidden = true; }

  /* ---- view switching ------------------------------------------------- */
  var page = $("page");
  function showView(name) {
    ["auth", "list", "stats", "edit"].forEach(function (v) {
      $("view-" + v).hidden = v !== name;
    });
    page.classList.toggle("page--narrow", name === "edit");
    window.scrollTo(0, 0);
  }

  /* ---- auth state ----------------------------------------------------- */
  var authMode = "login";

  function setAuthed(user) {
    $("appbar-user").hidden = false;
    $("appbar-username").textContent = user.username;
    showView("list");
    loadLinks();
  }

  function setLoggedOut() {
    $("appbar-user").hidden = true;
    setAuthMode("login");
    showView("auth");
  }

  function setAuthMode(mode) {
    authMode = mode;
    var login = mode === "login";
    $("auth-title").textContent = login ? "ログイン" : "新規登録";
    $("auth-sub").textContent = login ? "アカウントにログインしてください。" : "新しいアカウントを作成します。";
    $("auth-submit").textContent = login ? "ログイン" : "登録してはじめる";
    $("auth-toggle-text").textContent = login ? "アカウントをお持ちでないですか？" : "すでにアカウントをお持ちですか？";
    $("auth-toggle").textContent = login ? "新規登録" : "ログイン";
    $("auth-pw-hint").hidden = login;
    $("auth-password").setAttribute("autocomplete", login ? "current-password" : "new-password");
    $("auth-error").hidden = true;
  }

  function togglePassword(btn) {
    var input = $("auth-password");
    var show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.setAttribute("aria-label", show ? "パスワードを隠す" : "パスワードを表示");
    btn.innerHTML = show ? I.eyeOff : I.eye;
  }

  /* ---- list rendering ------------------------------------------------- */
  var linksByCode = {};

  function rowActions(l, skipCopy) {
    var c = esc(l.code);
    var toggle = l.disabled ? "有効化" : "無効化";
    var b = function (act, cls, icon, label) {
      return '<button class="iconbtn' + (cls ? " " + cls : "") + '" data-act="' + act +
        '" data-code="' + c + '" aria-label="' + label + '">' + icon +
        '<span class="iconbtn__t">' + label + "</span></button>";
    };
    return (skipCopy ? "" : b("copy", "", I.copy, "コピー")) +
      b("open", "", I.ext, "開く") +
      b("stats", "", I.chart, "分析") +
      b("qr", "", I.qr, "QR") +
      b("edit", "", I.edit, "編集") +
      b("toggle", "", I.power, toggle) +
      b("delete", "iconbtn--danger", I.trash, "削除");
  }
  function shortUrlAnchor(l) {
    var c = esc(l.code);
    return '<span class="shorturl">' + esc(shortHost()) +
      "/<wbr><span class=\"shorturl__code\">" + c + "</span></span>";
  }
  // small inline copy button used inside the table URL cells
  function copyBtn(act, code, label) {
    return '<button type="button" class="copybtn" data-act="' + act +
      '" data-code="' + esc(code) + '" aria-label="' + label + '">' + I.copy + "</button>";
  }

  function renderTable(links, tbody) {
    tbody.innerHTML = links.map(function (l) {
      return "<tr>" +
        "<td>" +
          '<div class="cellurl">' + shortUrlAnchor(l) +
            copyBtn("copy", l.code, "短縮URLをコピー") + "</div>" +
          (l.title ? '<div class="row-title">' + esc(l.title) + "</div>" : "") +
        "</td>" +
        '<td><div class="cellurl">' +
          '<span class="target" title="' + esc(l.target_url) + '">' + esc(l.target_url) + "</span>" +
          copyBtn("copy-target", l.code, "リンク先URLをコピー") +
        "</div></td>" +
        "<td>" + badge(l) + "</td>" +
        '<td class="num"><span class="clicks">' + nf(l.click_count) + "</span></td>" +
        '<td class="col-actions"><div class="row-actions">' + rowActions(l, true) + "</div></td>" +
      "</tr>";
    }).join("");
  }

  function renderCards(links, container) {
    container.innerHTML = links.map(function (l) {
      return '<div class="linkcard">' +
        '<div class="linkcard__top">' +
          '<div class="linkcard__row">' + shortUrlAnchor(l) +
            (l.title ? '<div class="row-title">' + esc(l.title) + "</div>" : "") +
          "</div>" + badge(l) +
        "</div>" +
        '<div class="linkcard__row"><span class="linkcard__lbl">リンク先</span><span class="linkcard__val">' + esc(l.target_url) + "</span></div>" +
        '<div class="linkcard__grid">' +
          '<div class="linkcard__row"><span class="linkcard__lbl">クリック数</span><span class="clicks">' + nf(l.click_count) + "</span></div>" +
        "</div>" +
        '<div class="linkcard__actions">' + rowActions(l) + "</div>" +
      "</div>";
    }).join("");
  }

  function renderList(links) {
    linksByCode = {};
    links.forEach(function (l) { linksByCode[l.code] = l; });
    $("link-count").textContent = links.length + " 件のリンク";
    var empty = links.length === 0;
    $("empty-state").hidden = !empty;
    $("table-wrap").hidden = empty;
    $("links-cards").hidden = empty;
    renderTable(links, $("links-tbody"));
    renderCards(links, $("links-cards"));
  }

  function loadLinks() {
    return fetch("/api/links")
      .then(function (r) {
        if (r.status === 401) { setLoggedOut(); return null; }
        return r.ok ? r.json() : { links: [] };
      })
      .then(function (data) { if (data) renderList(data.links || []); })
      .catch(function () {});
  }

  /* ---- analytics ------------------------------------------------------ */
  function renderDayChart(byDay, container) {
    if (!byDay.length) { container.innerHTML = '<div class="nodata">データなし</div>'; return; }
    var max = Math.max.apply(null, byDay.map(function (d) { return d.count; })) || 1;
    container.innerHTML = byDay.map(function (d, i) {
      var h = Math.round((d.count / max) * 140) + 2;
      var md = d.key.slice(5).replace("-", "/");
      var showVal = byDay.length <= 16 || i % 2 === 1;
      return '<div class="daybar" title="' + esc(d.key) + "：" + d.count + '">' +
        '<span class="daybar__val">' + (showVal ? d.count : "&nbsp;") + "</span>" +
        '<div class="daybar__fill" style="height:' + h + 'px"></div>' +
        '<span class="daybar__lbl">' + esc(md) + "</span>" +
      "</div>";
    }).join("");
  }
  function renderBreakdown(items, container) {
    if (!items.length) { container.innerHTML = '<div class="nodata">— データなし</div>'; return; }
    var total = items.reduce(function (s, x) { return s + x.count; }, 0);
    container.innerHTML = items.map(function (x) {
      var pct = total ? Math.round((x.count / total) * 100) : 0;
      return '<div class="hbar">' +
        '<span class="hbar__key" title="' + esc(x.key) + '">' + esc(x.key) + "</span>" +
        '<span class="hbar__track"><span class="hbar__fill" style="width:' + pct + '%"></span></span>' +
        '<span class="hbar__val">' + pct + "%</span>" +
      "</div>";
    }).join("");
  }

  function showStats(code) {
    fetch("/api/stats?code=" + encodeURIComponent(code))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        var s = data.stats;
        $("stats-code").textContent = "/" + code;
        $("stats-total").textContent = nf(s.total);
        renderDayChart(s.byDay || [], $("chart-byday"));
        renderBreakdown(s.byCountry || [], $("bk-country"));
        renderBreakdown(s.byReferer || [], $("bk-referer"));
        renderBreakdown(s.byDevice || [], $("bk-device"));
        renderBreakdown(s.byOs || [], $("bk-os"));
        renderBreakdown(s.byBrowser || [], $("bk-browser"));
        showView("stats");
      });
  }

  /* ---- edit ----------------------------------------------------------- */
  function showEdit(link) {
    $("edit-code").value = link.code;
    $("edit-code-label").textContent = "/" + link.code;
    $("edit-target").value = link.target_url;
    $("edit-title-input").value = link.title || "";
    $("edit-expires").value = msToDateInput(link.expires_at);
    $("edit-disabled").checked = !!link.disabled;
    clearFormError($("edit-error"));
    showView("edit");
  }

  /* ---- QR ------------------------------------------------------------- */
  var qrModal = $("qr-modal");
  function showQr(code) {
    var url = shortUrl(code);
    $("qr-url").textContent = shortHost() + "/" + code;
    var box = $("qr-box");
    box.innerHTML = "";
    /* global QRCode */
    new QRCode(box, {
      text: url, width: 176, height: 176,
      colorDark: "#1d1d1f", colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
    qrModal.hidden = false;
  }
  function closeQr() { qrModal.hidden = true; }

  /* ---- copy short URL ------------------------------------------------- */
  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error("execCommand failed"));
      } catch (e) { reject(e); }
    });
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      // Fall back to execCommand if the async clipboard API is blocked.
      return navigator.clipboard.writeText(text).catch(function () {
        return legacyCopy(text);
      });
    }
    return legacyCopy(text);
  }
  function flashCopied(btn, ok) {
    if (btn._copyT) clearTimeout(btn._copyT);
    if (btn._orig == null) btn._orig = btn.innerHTML;
    var hasLabel = /iconbtn__t/.test(btn._orig);
    btn.innerHTML = hasLabel
      ? (ok ? I.check : I.copy) + '<span class="iconbtn__t">' + (ok ? "コピーしました" : "失敗") + "</span>"
      : (ok ? I.check : I.copy);
    btn.classList.toggle("is-copied", ok);
    btn._copyT = setTimeout(function () {
      if (btn._orig != null) btn.innerHTML = btn._orig;
      btn._orig = null;
      btn.classList.remove("is-copied");
    }, 1500);
  }
  function copyShort(btn, code) {
    copyText(shortUrl(code)).then(
      function () { flashCopied(btn, true); },
      function () { flashCopied(btn, false); }
    );
  }
  function copyTarget(btn, code) {
    var l = linksByCode[code];
    if (!l) return;
    copyText(l.target_url).then(
      function () { flashCopied(btn, true); },
      function () { flashCopied(btn, false); }
    );
  }

  /* ---- actions -------------------------------------------------------- */
  function toggleDisabled(link) {
    fetch("/api/links/" + encodeURIComponent(link.code), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled: !link.disabled })
    }).then(loadLinks);
  }
  function deleteLinkUi(code) {
    if (!confirm("/" + code + " を削除しますか？")) return;
    fetch("/api/links/" + encodeURIComponent(code), { method: "DELETE" }).then(loadLinks);
  }

  var CREATE_ERR = {
    "invalid target_url": "リンク先URLは http:// または https:// から始まる正しい形式で入力してください。",
    "invalid_code": "カスタムコードは英数・- ・_、32文字までで入力してください。",
    "code_taken": "そのカスタムコードは既に使われています。別の文字列をお試しください。"
  };

  /* ---- event wiring --------------------------------------------------- */
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]");
    if (!el) {
      if (e.target === qrModal) closeQr();
      return;
    }
    var act = el.getAttribute("data-act");
    var code = el.getAttribute("data-code");
    var link = code ? linksByCode[code] : null;
    if (act === "copy") copyShort(el, code);
    else if (act === "copy-target") copyTarget(el, code);
    else if (act === "open") window.open(shortUrl(code), "_blank", "noopener");
    else if (act === "stats") showStats(code);
    else if (act === "qr") showQr(code);
    else if (act === "edit") { if (link) showEdit(link); }
    else if (act === "toggle") { if (link) toggleDisabled(link); }
    else if (act === "delete") deleteLinkUi(code);
    else if (act === "back-list") showView("list");
    else if (act === "qr-close") closeQr();
    else if (act === "auth-toggle") { setAuthMode(authMode === "login" ? "register" : "login"); }
    else if (act === "logout") { fetch("/api/logout", { method: "POST" }).then(setLoggedOut); }
    else if (act === "toggle-password") { togglePassword(el); }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !qrModal.hidden) closeQr();
  });

  /* ---- hover/focus tooltips for icon-only buttons (desktop table) ----- */
  var tipEl = null;
  function tooltipTarget(node) {
    return node && node.closest
      ? node.closest(".table .row-actions .iconbtn, .table .copybtn")
      : null;
  }
  function showTip(btn) {
    var label = btn.getAttribute("aria-label");
    if (!label) return;
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.className = "tooltip";
      tipEl.setAttribute("role", "tooltip");
      document.body.appendChild(tipEl);
    }
    tipEl.textContent = label;
    tipEl.classList.add("show");
    var r = btn.getBoundingClientRect();
    var tr = tipEl.getBoundingClientRect();
    var top = r.top - tr.height - 8;
    var below = top < 4;
    if (below) top = r.bottom + 8;
    var left = r.left + r.width / 2 - tr.width / 2;
    left = Math.max(6, Math.min(left, window.innerWidth - tr.width - 6));
    tipEl.classList.toggle("tooltip--below", below);
    tipEl.style.top = (top + window.scrollY) + "px";
    tipEl.style.left = (left + window.scrollX) + "px";
  }
  function hideTip() { if (tipEl) tipEl.classList.remove("show"); }
  document.addEventListener("mouseover", function (e) {
    var btn = tooltipTarget(e.target);
    if (btn) showTip(btn);
  });
  document.addEventListener("mouseout", function (e) {
    if (tooltipTarget(e.target)) hideTip();
  });
  document.addEventListener("focusin", function (e) {
    var btn = tooltipTarget(e.target);
    if (btn) showTip(btn);
  });
  document.addEventListener("focusout", hideTip);
  window.addEventListener("scroll", hideTip, true);

  $("create-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("create-error");
    clearFormError(err);
    var target_url = $("create-target").value.trim();
    var title = $("create-title").value.trim();
    var code = $("create-code").value.trim();
    var expires_at = dateInputToMs($("create-expires").value);
    fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_url: target_url, title: title, code: code || undefined, expires_at: expires_at })
    }).then(function (r) {
      if (r.ok) {
        $("create-form").reset();
        return loadLinks();
      }
      return r.json().catch(function () { return {}; }).then(function (b) {
        showFormError(err, CREATE_ERR[b.error] || "作成に失敗しました。");
      });
    });
  });

  var AUTH_ERR = {
    "invalid_credentials": "ユーザーIDまたはパスワードが違います。",
    "username_taken": "そのユーザーIDは既に使われています。",
    "invalid_username": "ユーザーID（メールアドレス可）の形式が正しくありません。3文字以上で入力してください。",
    "invalid_password": "パスワードは8文字以上で入力してください。"
  };

  $("auth-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var authErr = $("auth-error");
    clearFormError(authErr);
    var username = $("auth-username").value.trim();
    var password = $("auth-password").value;
    var url = authMode === "login" ? "/api/login" : "/api/register";
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username, password: password })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) {
        if (r.ok) {
          setAuthed(b.user);
        } else {
          var msg = AUTH_ERR[b.error] ||
            (authMode === "login" ? "ログインに失敗しました。" : "登録に失敗しました。");
          showFormError(authErr, msg);
        }
      });
    });
  });

  $("edit-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("edit-error");
    clearFormError(err);
    var code = $("edit-code").value;
    var payload = {
      target_url: $("edit-target").value.trim(),
      title: $("edit-title-input").value.trim(),
      expires_at: dateInputToMs($("edit-expires").value),
      disabled: $("edit-disabled").checked
    };
    fetch("/api/links/" + encodeURIComponent(code), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (r.ok) {
        return loadLinks().then(function () { showView("list"); });
      }
      return r.json().catch(function () { return {}; }).then(function (b) {
        showFormError(err, b.error === "invalid target_url"
          ? "リンク先URLは http:// または https:// から始まる正しい形式で入力してください。"
          : "保存に失敗しました。");
      });
    });
  });

  /* ---- mount ---------------------------------------------------------- */
  Array.prototype.slice.call(document.querySelectorAll("[data-icon]")).forEach(function (el) {
    el.innerHTML = I[el.getAttribute("data-icon")] || "";
  });
  $("appbar-host").textContent = location.host;
  fetch("/api/me").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (d && d.user) { setAuthed(d.user); } else { setLoggedOut(); }
  });
})();
