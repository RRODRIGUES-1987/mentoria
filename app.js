/* =====================================================================
   Mentoria App — Lógica principal
   ===================================================================== */

/* ---------- 0. Cliente Supabase ---------- */
const cfg = window.SUPABASE_CONFIG || {};
if (!cfg.url || cfg.url.includes("SEU-PROJETO")) {
  document.body.innerHTML =
    '<div style="font-family:sans-serif;max-width:560px;margin:60px auto;padding:24px;' +
    'background:#fff;border:1px solid #ddd;border-radius:12px">' +
    '<h2>⚙️ Configuração necessária</h2>' +
    '<p>Edite o arquivo <code>config.js</code> e cole a URL e a chave anon do seu ' +
    'projeto Supabase. Veja o <code>README.md</code> para o passo a passo.</p></div>';
  throw new Error("Supabase não configurado");
}
const supa = supabase.createClient(cfg.url, cfg.anonKey);

/* ---------- 1. Helpers ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => (s == null ? "" : String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"));

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const money = (n) => BRL.format(Number(n || 0));
const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";
const fmtDateTime = (d) => d
  ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
  : "—";
const todayISO = () => new Date().toISOString().slice(0, 10);

const ICON = {
  edit:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  plus:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  empty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  paid:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
};

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 2400);
}

/* ---------- 2. Estado ---------- */
const state = {
  user: null,
  contacts: [],
  programs: [],
  currentProgram: null,
  authMode: "signin",
};

/* ---------- 3. Autenticação ---------- */
const authEls = {
  screen: $("#auth-screen"), app: $("#app"),
  email: $("#auth-email"), pass: $("#auth-pass"),
  submit: $("#auth-submit"), msg: $("#auth-msg"),
  title: $("#auth-title"), sub: $("#auth-sub"),
  toggleText: $("#auth-toggle-text"), toggleBtn: $("#auth-toggle-btn"),
};

function setAuthMode(mode) {
  state.authMode = mode;
  const signin = mode === "signin";
  authEls.title.textContent = signin ? "Bem-vindo de volta" : "Criar sua conta";
  authEls.sub.textContent = signin
    ? "Acesse para gerir seus programas de mentoria."
    : "Comece a organizar seus mentorados.";
  authEls.submit.textContent = signin ? "Entrar" : "Criar conta";
  authEls.toggleText.textContent = signin ? "Ainda não tem conta?" : "Já tem conta?";
  authEls.toggleBtn.textContent = signin ? "Criar conta" : "Entrar";
  authEls.msg.className = "auth-msg";
}
authEls.toggleBtn.onclick = () => setAuthMode(state.authMode === "signin" ? "signup" : "signin");

async function handleAuth() {
  const email = authEls.email.value.trim();
  const password = authEls.pass.value;
  if (!email || !password) return showAuthMsg("Preencha e-mail e senha.", "err");
  authEls.submit.disabled = true;
  authEls.submit.textContent = "Aguarde…";
  try {
    if (state.authMode === "signin") {
      const { error } = await supa.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } else {
      const { data, error } = await supa.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) {
        showAuthMsg("Conta criada! Verifique seu e-mail para confirmar e depois entre.", "ok");
        setAuthMode("signin");
        return;
      }
    }
  } catch (e) {
    showAuthMsg(translateAuthError(e.message), "err");
  } finally {
    authEls.submit.disabled = false;
    authEls.submit.textContent = state.authMode === "signin" ? "Entrar" : "Criar conta";
  }
}
function showAuthMsg(msg, kind) { authEls.msg.textContent = msg; authEls.msg.className = "auth-msg " + kind; }
function translateAuthError(m) {
  if (/invalid login/i.test(m)) return "E-mail ou senha incorretos.";
  if (/already registered/i.test(m)) return "Este e-mail já está cadastrado.";
  if (/at least 6/i.test(m)) return "A senha precisa de ao menos 6 caracteres.";
  return m;
}
authEls.submit.onclick = handleAuth;
authEls.pass.addEventListener("keydown", (e) => { if (e.key === "Enter") handleAuth(); });

$("#logout-btn").onclick = async () => { await supa.auth.signOut(); };

supa.auth.onAuthStateChange((_event, session) => {
  if (session?.user) onLogin(session.user);
  else onLogout();
});

async function onLogin(user) {
  state.user = user;
  authEls.screen.classList.add("hidden");
  authEls.app.classList.remove("hidden");
  $("#user-email").textContent = user.email;
  await Promise.all([loadContacts(), loadPrograms()]);
  showView("dashboard");
}
function onLogout() {
  state.user = null; state.contacts = []; state.programs = [];
  authEls.app.classList.add("hidden");
  authEls.screen.classList.remove("hidden");
  authEls.email.value = ""; authEls.pass.value = "";
}

/* ---------- 4. Acesso a dados ---------- */
async function loadContacts() {
  const { data } = await supa.from("contacts").select("*").order("name");
  state.contacts = data || [];
}
async function loadPrograms() {
  const { data } = await supa.from("programs")
    .select("*, contacts(name)").order("created_at", { ascending: false });
  state.programs = data || [];
}
const contactName = (id) => state.contacts.find((c) => c.id === id)?.name || "—";

async function save(table, payload, id) {
  payload.user_id = state.user.id;
  const q = id
    ? supa.from(table).update(payload).eq("id", id)
    : supa.from(table).insert(payload);
  const { error } = await q;
  if (error) { toast("Erro: " + error.message); throw error; }
}
async function remove(table, id) {
  const { error } = await supa.from(table).delete().eq("id", id);
  if (error) { toast("Erro ao excluir."); throw error; }
}

/* ---------- 5. Navegação ---------- */
$$(".nav-item[data-view]").forEach((b) => b.onclick = () => showView(b.dataset.view));

function showView(name) {
  $$(".view").forEach((v) => v.classList.add("hidden"));
  $$(".nav-item[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  $("#view-" + name).classList.remove("hidden");
  ({
    dashboard: renderDashboard, contacts: renderContacts, programs: renderPrograms,
    evaluations: renderEvaluations, billings: renderBillings,
  })[name]?.();
}

/* ---------- 6. Modal ---------- */
function openModal({ title, body, onSave, saveLabel = "Salvar", wide = false }) {
  const root = $("#modal-root");
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal ${wide ? "wide" : ""}">
        <div class="modal-head">
          <h3>${esc(title)}</h3>
          <button class="icon-btn" data-close>✕</button>
        </div>
        <div class="modal-body">${body}</div>
        <div class="modal-foot">
          <button class="btn ghost" data-close>Cancelar</button>
          <button class="btn primary" data-save>${esc(saveLabel)}</button>
        </div>
      </div>
    </div>`;
  const close = () => (root.innerHTML = "");
  $$("[data-close]", root).forEach((b) => b.onclick = close);
  $(".modal-backdrop", root).onclick = (e) => { if (e.target.classList.contains("modal-backdrop")) close(); };
  $("[data-save]", root).onclick = async () => {
    const btn = $("[data-save]", root);
    btn.disabled = true; btn.textContent = "Salvando…";
    try { await onSave(); close(); }
    catch { btn.disabled = false; btn.textContent = saveLabel; }
  };
  return { close, root };
}
const field = (label, inner) => `<div class="field"><label>${esc(label)}</label>${inner}</div>`;
const val = (id, root) => $("#" + id, root).value.trim();
const numOrNull = (v) => v === "" ? null : Number(v);

function pageHead(eyebrow, title, actionLabel, actionFn) {
  const id = "act-" + Math.random().toString(36).slice(2);
  setTimeout(() => { const b = $("#" + id); if (b && actionFn) b.onclick = actionFn; });
  return `<div class="page-head"><div><div class="eyebrow">${esc(eyebrow)}</div>
    <h2>${esc(title)}</h2></div>
    ${actionLabel ? `<button class="btn primary" id="${id}"><span class="row" style="gap:7px">${ICON.plus}${esc(actionLabel)}</span></button>` : ""}</div>`;
}
const emptyState = (txt) => `<div class="empty">${ICON.empty}<div>${esc(txt)}</div></div>`;
const statusChip = (s) => `<span class="chip ${esc(s)}">${esc(s)}</span>`;

/* ===================================================================
   7. DASHBOARD
   =================================================================== */
async function renderDashboard() {
  const v = $("#view-dashboard");
  v.innerHTML = pageHead("Visão geral", "Painel");

  const activePrograms = state.programs.filter((p) => p.status === "ativo").length;
  const [{ data: meetings }, { data: billings }] = await Promise.all([
    supa.from("meetings").select("*, programs(title, contacts(name))")
      .gte("scheduled_at", new Date().toISOString())
      .eq("status", "agendado").order("scheduled_at").limit(6),
    supa.from("billings").select("*, programs(title)"),
  ]);

  const received = (billings || []).filter((b) => b.status === "pago")
    .reduce((s, b) => s + Number(b.amount), 0);
  const pending = (billings || []).filter((b) => b.status === "pendente" || b.status === "atrasado")
    .reduce((s, b) => s + Number(b.amount), 0);
  const overdue = (billings || []).filter((b) =>
    b.status !== "pago" && b.status !== "cancelado" && b.due_date && b.due_date < todayISO());

  v.innerHTML += `
    <div class="stat-grid">
      <div class="stat"><div class="accent-bar"></div><div class="label">Contatos</div><div class="value">${state.contacts.length}</div></div>
      <div class="stat"><div class="accent-bar"></div><div class="label">Mentorias ativas</div><div class="value">${activePrograms}</div></div>
      <div class="stat gold"><div class="accent-bar"></div><div class="label">A receber</div><div class="value money">${money(pending)}</div></div>
      <div class="stat"><div class="accent-bar"></div><div class="label">Recebido</div><div class="value money">${money(received)}</div></div>
    </div>
    <div class="dash-cols">
      <div class="card pad">
        <h3 class="section-title">Próximos encontros</h3>
        ${(meetings || []).length ? (meetings || []).map((m) => `
          <div class="list-line">
            <div><div class="ll-title">${esc(m.topic || "Encontro")}</div>
              <div class="ll-sub">${esc(m.programs?.title || "")} · ${esc(m.programs?.contacts?.name || "")}</div></div>
            <div class="ll-sub" style="text-align:right">${fmtDateTime(m.scheduled_at)}</div>
          </div>`).join("") : emptyState("Nenhum encontro agendado.")}
      </div>
      <div class="card pad">
        <h3 class="section-title">Faturas em atraso</h3>
        ${overdue.length ? overdue.map((b) => `
          <div class="list-line">
            <div><div class="ll-title">${esc(b.description || b.programs?.title || "Fatura")}</div>
              <div class="ll-sub">Venceu em ${fmtDate(b.due_date)}</div></div>
            <div class="ll-title" style="color:var(--danger)">${money(b.amount)}</div>
          </div>`).join("") : emptyState("Nenhuma fatura em atraso. 🎉")}
      </div>
    </div>`;
}

/* ===================================================================
   8. CONTATOS
   =================================================================== */
async function renderContacts() {
  const v = $("#view-contacts");
  v.innerHTML = pageHead("Pessoas", "Contatos", "Novo contato", () => contactForm());
  await loadContacts();
  const rows = state.contacts.map((c) => `
    <tr>
      <td><div class="cell-strong">${esc(c.name)}</div>
        <div class="cell-sub">${esc([c.role, c.company].filter(Boolean).join(" · "))}</div></td>
      <td>${esc(c.email || "—")}<div class="cell-sub">${esc(c.phone || "")}</div></td>
      <td>${c.tags ? c.tags.split(",").map((t) => `<span class="chip">${esc(t.trim())}</span>`).join(" ") : "—"}</td>
      <td><div class="row-actions">
        <button class="icon-btn" title="Editar" data-edit="${c.id}">${ICON.edit}</button>
        <button class="icon-btn danger" title="Excluir" data-del="${c.id}">${ICON.trash}</button>
      </div></td>
    </tr>`).join("");

  v.innerHTML += state.contacts.length ? `
    <div class="card table-wrap"><table>
      <thead><tr><th>Nome</th><th>Contato</th><th>Tags</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>` : emptyState("Nenhum contato ainda. Crie o primeiro.");

  $$("[data-edit]", v).forEach((b) => b.onclick = () =>
    contactForm(state.contacts.find((c) => c.id === b.dataset.edit)));
  $$("[data-del]", v).forEach((b) => b.onclick = async () => {
    if (confirm("Excluir este contato?")) { await remove("contacts", b.dataset.del); toast("Contato excluído."); renderContacts(); }
  });
}

function contactForm(c = {}) {
  openModal({
    title: c.id ? "Editar contato" : "Novo contato",
    body: `
      ${field("Nome *", `<input id="f-name" value="${esc(c.name || "")}">`)}
      <div class="grid-2">
        ${field("E-mail", `<input id="f-email" type="email" value="${esc(c.email || "")}">`)}
        ${field("Telefone", `<input id="f-phone" value="${esc(c.phone || "")}">`)}
      </div>
      <div class="grid-2">
        ${field("Empresa", `<input id="f-company" value="${esc(c.company || "")}">`)}
        ${field("Cargo/Papel", `<input id="f-role" value="${esc(c.role || "")}">`)}
      </div>
      ${field("Tags (separadas por vírgula)", `<input id="f-tags" value="${esc(c.tags || "")}" placeholder="executivo, primeira mentoria">`)}
      ${field("Notas", `<textarea id="f-notes">${esc(c.notes || "")}</textarea>`)}`,
    onSave: async () => {
      const name = val("f-name");
      if (!name) { toast("Informe o nome."); throw 0; }
      await save("contacts", {
        name, email: val("f-email"), phone: val("f-phone"),
        company: val("f-company"), role: val("f-role"),
        tags: val("f-tags"), notes: val("f-notes"),
      }, c.id);
      toast("Contato salvo.");
      await loadContacts(); renderContacts();
    },
  });
}

/* ===================================================================
   9. MENTORIAS (programas)
   =================================================================== */
async function renderPrograms() {
  const v = $("#view-programs");
  v.innerHTML = pageHead("Programas", "Mentorias", "Nova mentoria", () => programForm());
  await loadPrograms();

  v.innerHTML += state.programs.length ? `<div class="card table-wrap"><table>
      <thead><tr><th>Programa</th><th>Mentorado</th><th>Período</th><th>Valor</th><th>Status</th><th></th></tr></thead>
      <tbody>${state.programs.map((p) => `
        <tr style="cursor:pointer" data-open="${p.id}">
          <td><div class="cell-strong">${esc(p.title)}</div><div class="cell-sub">${esc(p.objective || "")}</div></td>
          <td>${esc(p.contacts?.name || "—")}</td>
          <td class="cell-sub">${fmtDate(p.start_date)} → ${fmtDate(p.end_date)}</td>
          <td>${money(p.total_value)}</td>
          <td>${statusChip(p.status)}</td>
          <td><div class="row-actions">
            <button class="icon-btn" title="Editar" data-edit="${p.id}">${ICON.edit}</button>
            <button class="icon-btn danger" title="Excluir" data-del="${p.id}">${ICON.trash}</button>
          </div></td>
        </tr>`).join("")}</tbody></table></div>`
    : emptyState("Nenhuma mentoria cadastrada. Crie a primeira.");

  $$("[data-open]", v).forEach((tr) => tr.onclick = (e) => {
    if (e.target.closest("[data-edit],[data-del]")) return;
    openProgramDetail(tr.dataset.open);
  });
  $$("[data-edit]", v).forEach((b) => b.onclick = () =>
    programForm(state.programs.find((p) => p.id === b.dataset.edit)));
  $$("[data-del]", v).forEach((b) => b.onclick = async () => {
    if (confirm("Excluir esta mentoria? Encontros e avaliações vinculados também serão removidos.")) {
      await remove("programs", b.dataset.del); toast("Mentoria excluída."); renderPrograms();
    }
  });
}

function contactOptions(selected) {
  return state.contacts.map((c) =>
    `<option value="${c.id}" ${c.id === selected ? "selected" : ""}>${esc(c.name)}</option>`).join("");
}
const STATUS_PROG = ["ativo", "pausado", "concluido", "cancelado"];

function programForm(p = {}) {
  openModal({
    title: p.id ? "Editar mentoria" : "Nova mentoria", wide: true,
    body: `
      ${field("Título *", `<input id="f-title" value="${esc(p.title || "")}" placeholder="Mentoria de liderança – João">`)}
      <div class="grid-2">
        ${field("Mentorado", `<select id="f-contact"><option value="">— selecione —</option>${contactOptions(p.contact_id)}</select>`)}
        ${field("Status", `<select id="f-status">${STATUS_PROG.map((s) => `<option ${s === (p.status || "ativo") ? "selected" : ""}>${s}</option>`).join("")}</select>`)}
      </div>
      ${field("Objetivo", `<input id="f-objective" value="${esc(p.objective || "")}" placeholder="Desenvolver gestão de times">`)}
      <div class="grid-3">
        ${field("Início", `<input id="f-start" type="date" value="${esc(p.start_date || "")}">`)}
        ${field("Término", `<input id="f-end" type="date" value="${esc(p.end_date || "")}">`)}
        ${field("Valor total (R$)", `<input id="f-value" type="number" step="0.01" value="${esc(p.total_value ?? "")}">`)}
      </div>
      ${field("Descrição", `<textarea id="f-desc">${esc(p.description || "")}</textarea>`)}`,
    onSave: async () => {
      const title = val("f-title");
      if (!title) { toast("Informe o título."); throw 0; }
      await save("programs", {
        title, objective: val("f-objective"), description: val("f-desc"),
        status: val("f-status"), contact_id: val("f-contact") || null,
        start_date: val("f-start") || null, end_date: val("f-end") || null,
        total_value: numOrNull(val("f-value")) || 0,
      }, p.id);
      toast("Mentoria salva.");
      await loadPrograms(); renderPrograms();
    },
  });
}

/* ---------- 9b. Detalhe da mentoria (abas) ---------- */
async function openProgramDetail(id, tab = "encontros") {
  await loadPrograms();
  const p = state.programs.find((x) => x.id === id);
  if (!p) return;
  state.currentProgram = p;
  $$(".view").forEach((v) => v.classList.add("hidden"));
  $$(".nav-item[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === "programs"));
  const v = $("#view-program-detail");
  v.classList.remove("hidden");

  v.innerHTML = `
    <button class="back-link" id="pd-back">← Voltar para mentorias</button>
    <div class="page-head"><div>
      <div class="eyebrow">${esc(p.contacts?.name || "Mentoria")}</div>
      <h2>${esc(p.title)}</h2>
    </div>${statusChip(p.status)}</div>
    <div class="card pad" style="margin-bottom:20px">
      <div class="row wrap" style="gap:30px">
        <div><div class="cell-sub">Objetivo</div><div>${esc(p.objective || "—")}</div></div>
        <div><div class="cell-sub">Período</div><div>${fmtDate(p.start_date)} → ${fmtDate(p.end_date)}</div></div>
        <div><div class="cell-sub">Valor total</div><div>${money(p.total_value)}</div></div>
      </div>
      ${p.description ? `<p class="muted" style="margin:14px 0 0">${esc(p.description)}</p>` : ""}
    </div>
    <div class="tabs">
      <button class="tab" data-tab="encontros">Encontros</button>
      <button class="tab" data-tab="avaliacoes">Avaliações</button>
      <button class="tab" data-tab="faturamento">Faturamento</button>
    </div>
    <div id="pd-content"></div>`;
  $("#pd-back").onclick = () => showView("programs");
  $$(".tab", v).forEach((b) => b.onclick = () => switchTab(b.dataset.tab));
  switchTab(tab);
}
function switchTab(tab) {
  $$("#view-program-detail .tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  ({ encontros: renderMeetings, avaliacoes: renderProgramEvals, faturamento: renderProgramBillings })[tab]();
}

/* ---------- Encontros ---------- */
const STATUS_MEET = ["agendado", "realizado", "cancelado", "remarcado"];
async function renderMeetings() {
  const c = $("#pd-content");
  c.innerHTML = `<div class="row spread" style="margin-bottom:14px">
    <h3 class="section-title" style="margin:0">Encontros & observações</h3>
    <button class="btn primary sm" id="add-meet"><span class="row" style="gap:6px">${ICON.plus}Novo encontro</span></button></div>`;
  const { data } = await supa.from("meetings").select("*")
    .eq("program_id", state.currentProgram.id).order("scheduled_at", { ascending: false });

  c.innerHTML += (data || []).length ? `<div class="card table-wrap"><table>
    <thead><tr><th>Data/hora</th><th>Tema & observações</th><th>Duração</th><th>Status</th><th></th></tr></thead>
    <tbody>${data.map((m) => `<tr>
      <td class="cell-strong">${fmtDateTime(m.scheduled_at)}</td>
      <td><div class="cell-strong">${esc(m.topic || "—")}</div>
        ${m.notes ? `<div class="cell-sub" style="white-space:pre-wrap;max-width:420px">${esc(m.notes)}</div>` : ""}</td>
      <td>${m.duration_min} min</td>
      <td>${statusChip(m.status)}</td>
      <td><div class="row-actions">
        <button class="icon-btn" data-edit="${m.id}">${ICON.edit}</button>
        <button class="icon-btn danger" data-del="${m.id}">${ICON.trash}</button>
      </div></td></tr>`).join("")}</tbody></table></div>`
    : emptyState("Nenhum encontro registrado.");

  $("#add-meet").onclick = () => meetingForm();
  $$("[data-edit]", c).forEach((b) => b.onclick = () => meetingForm((data || []).find((m) => m.id === b.dataset.edit)));
  $$("[data-del]", c).forEach((b) => b.onclick = async () => {
    if (confirm("Excluir este encontro?")) { await remove("meetings", b.dataset.del); toast("Encontro excluído."); renderMeetings(); }
  });
}
function meetingForm(m = {}) {
  const dtVal = m.scheduled_at ? new Date(m.scheduled_at).toISOString().slice(0, 16) : "";
  openModal({
    title: m.id ? "Editar encontro" : "Novo encontro",
    body: `
      <div class="grid-2">
        ${field("Data e hora *", `<input id="f-dt" type="datetime-local" value="${dtVal}">`)}
        ${field("Duração (min)", `<input id="f-dur" type="number" value="${esc(m.duration_min || 60)}">`)}
      </div>
      <div class="grid-2">
        ${field("Tema", `<input id="f-topic" value="${esc(m.topic || "")}">`)}
        ${field("Status", `<select id="f-status">${STATUS_MEET.map((s) => `<option ${s === (m.status || "agendado") ? "selected" : ""}>${s}</option>`).join("")}</select>`)}
      </div>
      ${field("Observações do encontro", `<textarea id="f-notes" style="min-height:120px">${esc(m.notes || "")}</textarea>`)}`,
    onSave: async () => {
      const dt = val("f-dt");
      if (!dt) { toast("Informe data e hora."); throw 0; }
      await save("meetings", {
        program_id: state.currentProgram.id,
        scheduled_at: new Date(dt).toISOString(),
        duration_min: numOrNull(val("f-dur")) || 60,
        topic: val("f-topic"), notes: val("f-notes"), status: val("f-status"),
      }, m.id);
      toast("Encontro salvo."); renderMeetings();
    },
  });
}

/* ---------- Avaliações (dentro da mentoria) ---------- */
async function renderProgramEvals() {
  const c = $("#pd-content");
  c.innerHTML = `<div class="row spread" style="margin-bottom:14px">
    <h3 class="section-title" style="margin:0">Avaliações de performance</h3>
    <button class="btn primary sm" id="add-eval"><span class="row" style="gap:6px">${ICON.plus}Nova avaliação</span></button></div>`;
  const { data } = await supa.from("evaluations").select("*")
    .eq("program_id", state.currentProgram.id).order("evaluated_at", { ascending: false });

  c.innerHTML += (data || []).length ? data.map((ev) => `
    <div class="card pad" style="margin-bottom:12px">
      <div class="row spread">
        <div><div class="cell-strong">${esc(ev.period || "Avaliação")} · ${fmtDate(ev.evaluated_at)}</div>
          <div class="cell-sub">Nota geral</div></div>
        <div style="text-align:right">
          <div style="font-family:var(--font-display);font-size:1.8rem;color:var(--accent)">${ev.overall_score ?? "—"}<span class="cell-sub">/10</span></div>
          <div class="row-actions"><button class="icon-btn" data-edit="${ev.id}">${ICON.edit}</button>
            <button class="icon-btn danger" data-del="${ev.id}">${ICON.trash}</button></div>
        </div>
      </div>
      ${(ev.criteria || []).length ? `<div class="row wrap" style="gap:8px;margin-top:12px">
        ${ev.criteria.map((cr) => `<span class="chip">${esc(cr.name)}: ${esc(cr.score)}</span>`).join("")}</div>` : ""}
      ${ev.comments ? `<p class="muted" style="margin:12px 0 0;white-space:pre-wrap">${esc(ev.comments)}</p>` : ""}
    </div>`).join("") : emptyState("Nenhuma avaliação registrada.");

  $("#add-eval").onclick = () => evaluationForm();
  $$("[data-edit]", c).forEach((b) => b.onclick = () => evaluationForm((data || []).find((e) => e.id === b.dataset.edit)));
  $$("[data-del]", c).forEach((b) => b.onclick = async () => {
    if (confirm("Excluir esta avaliação?")) { await remove("evaluations", b.dataset.del); toast("Avaliação excluída."); renderProgramEvals(); }
  });
}
function evaluationForm(ev = {}) {
  const crits = ev.criteria && ev.criteria.length ? ev.criteria : [{ name: "", score: "" }];
  const critRow = (cr = {}) => `<div class="crit-row">
    <input class="crit-name" placeholder="Critério (ex.: Comunicação)" value="${esc(cr.name || "")}">
    <input class="crit-score" type="number" step="0.5" min="0" max="10" placeholder="0-10" value="${esc(cr.score ?? "")}">
    <button class="icon-btn danger crit-del" type="button">${ICON.trash}</button></div>`;
  openModal({
    title: ev.id ? "Editar avaliação" : "Nova avaliação", wide: true,
    body: `
      <div class="grid-3">
        ${field("Período", `<input id="f-period" value="${esc(ev.period || "")}" placeholder="Mês 1">`)}
        ${field("Data", `<input id="f-date" type="date" value="${esc(ev.evaluated_at || todayISO())}">`)}
        ${field("Nota geral (0-10)", `<input id="f-overall" type="number" step="0.1" min="0" max="10" value="${esc(ev.overall_score ?? "")}">`)}
      </div>
      ${field("Critérios", `<div id="crit-list">${crits.map(critRow).join("")}</div>
        <button class="btn sm" type="button" id="crit-add" style="margin-top:6px">+ Critério</button>`)}
      ${field("Comentários", `<textarea id="f-comments" style="min-height:90px">${esc(ev.comments || "")}</textarea>`)}`,
    onSave: async () => {
      const root = $("#modal-root");
      const criteria = $$(".crit-row", root).map((r) => ({
        name: $(".crit-name", r).value.trim(),
        score: numOrNull($(".crit-score", r).value),
      })).filter((cr) => cr.name);
      await save("evaluations", {
        program_id: state.currentProgram.id,
        period: val("f-period"), evaluated_at: val("f-date") || todayISO(),
        overall_score: numOrNull(val("f-overall")), criteria, comments: val("f-comments"),
      }, ev.id);
      toast("Avaliação salva."); renderProgramEvals();
    },
  });
  const root = $("#modal-root");
  const bind = () => $$(".crit-del", root).forEach((b) => b.onclick = () => {
    if ($$(".crit-row", root).length > 1) b.closest(".crit-row").remove();
  });
  bind();
  $("#crit-add", root).onclick = () => { $("#crit-list", root).insertAdjacentHTML("beforeend", critRow()); bind(); };
}

/* ---------- Faturamento (dentro da mentoria) ---------- */
async function renderProgramBillings() {
  const c = $("#pd-content");
  c.innerHTML = `<div class="row spread" style="margin-bottom:14px">
    <h3 class="section-title" style="margin:0">Faturamento do programa</h3>
    <button class="btn primary sm" id="add-bill"><span class="row" style="gap:6px">${ICON.plus}Nova fatura</span></button></div>`;
  const { data } = await supa.from("billings").select("*")
    .eq("program_id", state.currentProgram.id).order("due_date", { ascending: true });
  c.innerHTML += renderBillingTable(data || [], false);
  bindBillingTable(c, data || [], renderProgramBillings);
  $("#add-bill").onclick = () => billingForm({ program_id: state.currentProgram.id });
}

/* ===================================================================
   10. AVALIAÇÕES (visão global, somente leitura + atalho)
   =================================================================== */
async function renderEvaluations() {
  const v = $("#view-evaluations");
  v.innerHTML = pageHead("Performance", "Avaliações");
  const { data } = await supa.from("evaluations")
    .select("*, programs(title, contacts(name))").order("evaluated_at", { ascending: false });

  v.innerHTML += (data || []).length ? `<div class="card table-wrap"><table>
    <thead><tr><th>Mentorado / Programa</th><th>Período</th><th>Data</th><th>Nota geral</th><th></th></tr></thead>
    <tbody>${data.map((ev) => `<tr style="cursor:pointer" data-open="${ev.program_id}">
      <td><div class="cell-strong">${esc(ev.programs?.contacts?.name || "—")}</div>
        <div class="cell-sub">${esc(ev.programs?.title || "")}</div></td>
      <td>${esc(ev.period || "—")}</td>
      <td>${fmtDate(ev.evaluated_at)}</td>
      <td><span style="font-family:var(--font-display);font-size:1.2rem;color:var(--accent)">${ev.overall_score ?? "—"}</span><span class="cell-sub">/10</span></td>
      <td class="cell-sub">abrir →</td>
    </tr>`).join("")}</tbody></table></div>`
    : emptyState("Nenhuma avaliação ainda. Abra uma mentoria para adicionar.");
  $$("[data-open]", v).forEach((tr) => tr.onclick = () => openProgramDetail(tr.dataset.open, "avaliacoes"));
}

/* ===================================================================
   11. FATURAMENTO (visão global)
   =================================================================== */
const STATUS_BILL = ["pendente", "pago", "atrasado", "cancelado"];
function programOptions(selected) {
  return state.programs.map((p) =>
    `<option value="${p.id}" ${p.id === selected ? "selected" : ""}>${esc(p.title)}${p.contacts?.name ? " — " + esc(p.contacts.name) : ""}</option>`).join("");
}

function renderBillingTable(rows, showProgram = true) {
  if (!rows.length) return emptyState("Nenhuma fatura registrada.");
  return `<div class="card table-wrap"><table>
    <thead><tr>${showProgram ? "<th>Programa</th>" : ""}<th>Descrição</th><th>Vencimento</th><th>Valor</th><th>Status</th><th></th></tr></thead>
    <tbody>${rows.map((b) => {
      const overdue = b.status !== "pago" && b.status !== "cancelado" && b.due_date && b.due_date < todayISO();
      const stat = overdue ? "atrasado" : b.status;
      return `<tr>
        ${showProgram ? `<td class="cell-strong">${esc(b.programs?.title || "—")}</td>` : ""}
        <td>${esc(b.description || "—")}</td>
        <td>${fmtDate(b.due_date)}${b.paid_at ? `<div class="cell-sub">pago ${fmtDate(b.paid_at)}</div>` : ""}</td>
        <td class="cell-strong">${money(b.amount)}</td>
        <td>${statusChip(stat)}</td>
        <td><div class="row-actions">
          ${b.status !== "pago" ? `<button class="icon-btn" title="Marcar como pago" data-pay="${b.id}">${ICON.paid}</button>` : ""}
          <button class="icon-btn" title="Editar" data-edit="${b.id}">${ICON.edit}</button>
          <button class="icon-btn danger" title="Excluir" data-del="${b.id}">${ICON.trash}</button>
        </div></td></tr>`;
    }).join("")}</tbody></table></div>`;
}
function bindBillingTable(root, rows, refresh) {
  $$("[data-pay]", root).forEach((b) => b.onclick = async () => {
    await save("billings", { status: "pago", paid_at: todayISO() }, b.dataset.pay);
    toast("Fatura marcada como paga."); refresh();
  });
  $$("[data-edit]", root).forEach((b) => b.onclick = () => billingForm(rows.find((x) => x.id === b.dataset.edit), refresh));
  $$("[data-del]", root).forEach((b) => b.onclick = async () => {
    if (confirm("Excluir esta fatura?")) { await remove("billings", b.dataset.del); toast("Fatura excluída."); refresh(); }
  });
}

async function renderBillings() {
  const v = $("#view-billings");
  v.innerHTML = pageHead("Financeiro", "Faturamento", "Nova fatura", () => billingForm({}, renderBillings));
  await loadPrograms();
  const { data } = await supa.from("billings")
    .select("*, programs(title)").order("due_date", { ascending: true });
  const rows = data || [];

  const received = rows.filter((b) => b.status === "pago").reduce((s, b) => s + Number(b.amount), 0);
  const pending = rows.filter((b) => b.status !== "pago" && b.status !== "cancelado").reduce((s, b) => s + Number(b.amount), 0);
  v.innerHTML += `<div class="stat-grid">
    <div class="stat"><div class="accent-bar"></div><div class="label">Recebido</div><div class="value money">${money(received)}</div></div>
    <div class="stat gold"><div class="accent-bar"></div><div class="label">Em aberto</div><div class="value money">${money(pending)}</div></div>
    <div class="stat"><div class="accent-bar"></div><div class="label">Total faturas</div><div class="value">${rows.length}</div></div>
  </div>`;
  v.innerHTML += renderBillingTable(rows, true);
  bindBillingTable(v, rows, renderBillings);
}

function billingForm(b = {}, refresh) {
  const done = refresh || (state.currentProgram ? renderProgramBillings : renderBillings);
  openModal({
    title: b.id ? "Editar fatura" : "Nova fatura",
    body: `
      ${field("Programa", `<select id="f-program"><option value="">— avulsa —</option>${programOptions(b.program_id)}</select>`)}
      ${field("Descrição", `<input id="f-desc" value="${esc(b.description || "")}" placeholder="Parcela 1/6">`)}
      <div class="grid-3">
        ${field("Valor (R$) *", `<input id="f-amount" type="number" step="0.01" value="${esc(b.amount ?? "")}">`)}
        ${field("Vencimento", `<input id="f-due" type="date" value="${esc(b.due_date || "")}">`)}
        ${field("Status", `<select id="f-status">${STATUS_BILL.map((s) => `<option ${s === (b.status || "pendente") ? "selected" : ""}>${s}</option>`).join("")}</select>`)}
      </div>
      ${field("Data de pagamento", `<input id="f-paid" type="date" value="${esc(b.paid_at || "")}">`)}`,
    onSave: async () => {
      const amount = numOrNull(val("f-amount"));
      if (amount == null) { toast("Informe o valor."); throw 0; }
      const status = val("f-status");
      await save("billings", {
        program_id: val("f-program") || null, description: val("f-desc"),
        amount, due_date: val("f-due") || null, status,
        paid_at: val("f-paid") || (status === "pago" ? todayISO() : null),
      }, b.id);
      toast("Fatura salva."); done();
    },
  });
}

/* ---------- 12. Boot ---------- */
(async () => {
  const { data } = await supa.auth.getSession();
  if (data.session?.user) onLogin(data.session.user);
  else { setAuthMode("signin"); onLogout(); }
})();
