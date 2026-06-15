const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const createForm = document.getElementById("create-form");
const createError = document.getElementById("create-error");
const linksBody = document.getElementById("links-body");

function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
  loadLinks();
}

async function loadLinks() {
  const res = await fetch("/api/links");
  if (res.status === 401) {
    appView.hidden = true;
    loginView.hidden = false;
    return false;
  }
  const { links } = await res.json();
  linksBody.innerHTML = "";
  for (const link of links) {
    const shortUrl = `${location.origin}/${link.code}`;
    const tr = document.createElement("tr");
    const status = linkStatus(link);
    tr.innerHTML =
      `<td data-label="短縮URL"><a href="${shortUrl}" target="_blank" rel="noopener">${shortUrl}</a></td>` +
      `<td data-label="リンク先" class="target-cell">${escapeHtml(link.target_url)}</td>` +
      `<td data-label="状態" class="status-${status.cls}">${status.label}</td>` +
      `<td data-label="クリック">${link.click_count}</td>` +
      `<td class="row-actions">` +
        `<button type="button" data-act="stats" data-code="${escapeHtml(link.code)}">分析</button>` +
        `<button type="button" data-act="qr" data-code="${escapeHtml(link.code)}">QR</button>` +
        `<button type="button" data-act="edit" data-code="${escapeHtml(link.code)}">編集</button>` +
        `<button type="button" data-act="toggle" data-code="${escapeHtml(link.code)}">${link.disabled ? "有効化" : "無効化"}</button>` +
        `<button type="button" class="danger" data-act="delete" data-code="${escapeHtml(link.code)}">削除</button>` +
      `</td>`;
    tr._link = link;
    linksBody.appendChild(tr);
  }
  return true;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

function linkStatus(link) {
  if (link.disabled) return { cls: "disabled", label: "無効" };
  if (link.expires_at !== null && Date.now() > link.expires_at) {
    return { cls: "expired", label: "期限切れ" };
  }
  return { cls: "active", label: "有効" };
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  const passphrase = document.getElementById("passphrase").value;
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passphrase }),
  });
  if (res.ok) showApp();
  else loginError.hidden = false;
});

createForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  createError.hidden = true;
  const target_url = document.getElementById("target-url").value;
  const title = document.getElementById("title").value;
  const code = document.getElementById("custom-code").value.trim();
  const expires_at = localInputToMs(document.getElementById("expires-at").value);
  const res = await fetch("/api/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_url, title, code: code || undefined, expires_at }),
  });
  if (res.ok) {
    createForm.reset();
    loadLinks();
  } else {
    const { error } = await res.json().catch(() => ({ error: "作成に失敗しました" }));
    createError.textContent = error || "作成に失敗しました";
    createError.hidden = false;
  }
});

const statsView = document.getElementById("stats-view");
const linksTable = document.getElementById("links-table");

linksBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const code = btn.dataset.code;
  const tr = btn.closest("tr");
  const link = tr && tr._link;
  switch (btn.dataset.act) {
    case "stats": showStats(code); break;
    case "qr": showQr(code); break;
    case "edit": if (link) showEdit(link); break;
    case "toggle": if (link) toggleDisabled(link); break;
    case "delete": deleteLinkUi(code); break;
  }
});

document.getElementById("stats-back").addEventListener("click", () => {
  statsView.hidden = true;
  linksTable.hidden = false;
});

async function showStats(code) {
  const res = await fetch(`/api/stats?code=${encodeURIComponent(code)}`);
  if (!res.ok) return;
  const { stats } = await res.json();

  document.getElementById("stats-title").textContent = `/${code} の分析`;
  document.getElementById("stats-total").textContent = stats.total;

  renderChart(document.getElementById("chart-byday"), stats.byDay);
  renderBars(document.getElementById("bk-country"), stats.byCountry);
  renderBars(document.getElementById("bk-referer"), stats.byReferer);
  renderBars(document.getElementById("bk-device"), stats.byDevice);
  renderBars(document.getElementById("bk-os"), stats.byOs);
  renderBars(document.getElementById("bk-browser"), stats.byBrowser);

  linksTable.hidden = true;
  statsView.hidden = false;
}

function renderChart(container, buckets) {
  container.innerHTML = "";
  if (!buckets.length) {
    container.textContent = "データなし";
    return;
  }
  const max = Math.max(...buckets.map((b) => b.count));
  for (const b of buckets) {
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = `${Math.round((b.count / max) * 120) + 2}px`;
    bar.title = `${b.key}: ${b.count}`;
    const label = document.createElement("span");
    label.textContent = b.key.slice(5); // MM-DD
    bar.appendChild(label);
    container.appendChild(bar);
  }
}

function renderBars(container, buckets) {
  container.innerHTML = "";
  if (!buckets.length) {
    container.textContent = "—";
    return;
  }
  const max = Math.max(...buckets.map((b) => b.count));
  for (const b of buckets) {
    const row = document.createElement("div");
    row.className = "bar-row";
    const pct = Math.round((b.count / max) * 100);
    row.innerHTML =
      `<span class="label" title="${escapeHtml(b.key)}">${escapeHtml(b.key)}</span>` +
      `<span class="track"><span class="fill" style="width:${pct}%"></span></span>` +
      `<span class="num">${b.count}</span>`;
    container.appendChild(row);
  }
}

const editView = document.getElementById("edit-view");
const editForm = document.getElementById("edit-form");
const editError = document.getElementById("edit-error");

document.getElementById("edit-back").addEventListener("click", () => {
  editView.hidden = true;
  linksTable.hidden = false;
});

// epoch ms <-> <input type="datetime-local"> value (local time)
function msToLocalInput(ms) {
  if (ms == null) return "";
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function showEdit(link) {
  document.getElementById("edit-code").value = link.code;
  document.getElementById("edit-target").value = link.target_url;
  document.getElementById("edit-title-input").value = link.title || "";
  document.getElementById("edit-expires").value = msToLocalInput(link.expires_at);
  document.getElementById("edit-disabled").checked = !!link.disabled;
  document.getElementById("edit-title").textContent = `/${link.code} を編集`;
  editError.hidden = true;
  linksTable.hidden = true;
  editView.hidden = false;
}

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  editError.hidden = true;
  const code = document.getElementById("edit-code").value;
  const payload = {
    target_url: document.getElementById("edit-target").value,
    title: document.getElementById("edit-title-input").value,
    expires_at: localInputToMs(document.getElementById("edit-expires").value),
    disabled: document.getElementById("edit-disabled").checked,
  };
  const res = await fetch(`/api/links/${encodeURIComponent(code)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.ok) {
    editView.hidden = true;
    linksTable.hidden = false;
    loadLinks();
  } else {
    const { error } = await res.json().catch(() => ({ error: "保存に失敗しました" }));
    editError.textContent = error || "保存に失敗しました";
    editError.hidden = false;
  }
});

async function toggleDisabled(link) {
  await fetch(`/api/links/${encodeURIComponent(link.code)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ disabled: !link.disabled }),
  });
  loadLinks();
}

async function deleteLinkUi(code) {
  if (!confirm(`/${code} を削除しますか？`)) return;
  await fetch(`/api/links/${encodeURIComponent(code)}`, { method: "DELETE" });
  loadLinks();
}

const qrModal = document.getElementById("qr-modal");
const qrCanvas = document.getElementById("qr-canvas");
document.getElementById("qr-close").addEventListener("click", () => {
  qrModal.hidden = true;
});
qrModal.addEventListener("click", (e) => {
  if (e.target === qrModal) qrModal.hidden = true;
});

function showQr(code) {
  const url = `${location.origin}/${code}`;
  document.getElementById("qr-title").textContent = url;
  qrCanvas.innerHTML = "";
  // eslint-disable-next-line no-undef
  new QRCode(qrCanvas, { text: url, width: 200, height: 200 });
  qrModal.hidden = false;
}

// On load: if a valid session cookie already exists, show the app; otherwise stay on login.
loadLinks().then((ok) => {
  if (ok) {
    loginView.hidden = true;
    appView.hidden = false;
  }
});
