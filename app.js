/* =====================================================================
   Mentoria App — Lógica (estilo VERUS)
   ===================================================================== */
const cfg = window.SUPABASE_CONFIG || {};
if (!cfg.url || cfg.url.includes("SEU-PROJETO")) {
  document.body.innerHTML =
    '<div style="font-family:sans-serif;max-width:560px;margin:60px auto;padding:24px;background:#fff;border:1px solid #ddd;border-radius:12px">' +
    '<h2>⚙️ Configuração necessária</h2><p>Edite <code>config.js</code> com a URL e a chave do seu projeto Supabase.</p></div>';
  throw new Error("Supabase não configurado");
}
const supa = supabase.createClient(cfg.url, cfg.anonKey);

/* ---------- helpers ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => (s == null ? "" : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"));
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const money = (n) => BRL.format(Number(n || 0));
const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const todayISO = () => new Date().toISOString().slice(0, 10);
const ini = (n) => !n ? "?" : n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const avClass = (s) => "av" + (Math.abs([...String(s || "")].reduce((a, c) => a + c.charCodeAt(0), 0)) % 5);
const BADGE = { ativo: "bg", realizado: "bg", pago: "bg", pendente: "ba", agendado: "ba", pausado: "ba", atrasado: "br", cancelado: "br", concluido: "bb", remarcado: "bgr" };
const badge = (s) => `<span class="bdg ${BADGE[s] || "bgr"}">${esc(s)}</span>`;

const ICON = {
  edit:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  paid:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  empty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
};
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2400);
}
const emptyState = (txt) => `<div class="empty">${ICON.empty}<p>${esc(txt)}</p></div>`;
const sechdr = (eyebrow, title, btnId, btnLabel) =>
  `<div class="sechdr"><div>${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ""}<span class="sectitle">${esc(title)}</span></div>
   ${btnId ? `<button class="btn btn-p" id="${btnId}">${esc(btnLabel)}</button>` : ""}</div>`;

/* ---------- estado ---------- */
const state = { user: null, contacts: [], programs: [], currentProgram: null, authMode: "signin" };

/* ---------- AUTH ---------- */
const A = {
  screen: $("#auth-screen"), app: $("#app"), email: $("#auth-email"), pass: $("#auth-pass"),
  submit: $("#auth-submit"), msg: $("#auth-msg"), title: $("#auth-title"), sub: $("#auth-sub"),
  toggleText: $("#auth-toggle-text"), toggleBtn: $("#auth-toggle-btn"),
};
function setAuthMode(mode) {
  state.authMode = mode;
  const signin = mode === "signin";
  A.title.textContent = signin ? "Bem-vindo de volta" : "Criar sua conta";
  A.sub.textContent = signin ? "Acesse para gerir seus programas de mentoria." : "Comece a organizar seus mentorados.";
  A.submit.textContent = signin ? "Entrar" : "Criar conta";
  A.toggleText.textContent = signin ? "Ainda não tem conta?" : "Já tem conta?";
  A.toggleBtn.textContent = signin ? "Criar conta" : "Entrar";
  A.msg.className = "msg msg-err";
}
A.toggleBtn.onclick = () => setAuthMode(state.authMode === "signin" ? "signup" : "signin");
function showAuthMsg(msg, kind) { A.msg.textContent = msg; A.msg.className = "msg " + (kind === "ok" ? "msg-ok" : "msg-err") + " show"; }
function authErr(m) {
  if (/invalid login/i.test(m)) return "E-mail ou senha incorretos.";
  if (/already registered/i.test(m)) return "Este e-mail já está cadastrado.";
  if (/at least 6/i.test(m)) return "A senha precisa de ao menos 6 caracteres.";
  return m;
}
async function handleAuth() {
  const email = A.email.value.trim(), password = A.pass.value;
  if (!email || !password) return showAuthMsg("Preencha e-mail e senha.");
  A.submit.disabled = true; A.submit.textContent = "Aguarde…";
  try {
    if (state.authMode === "signin") {
      const { error } = await supa.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } else {
      const { data, error } = await supa.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) { showAuthMsg("Conta criada! Confirme pelo e-mail e depois entre.", "ok"); setAuthMode("signin"); return; }
    }
  } catch (e) { showAuthMsg(authErr(e.message)); }
  finally { A.submit.disabled = false; A.submit.textContent = state.authMode === "signin" ? "Entrar" : "Criar conta"; }
}
A.submit.onclick = handleAuth;
A.pass.addEventListener("keydown", (e) => { if (e.key === "Enter") handleAuth(); });

$("#logout-btn").onclick = async () => { await supa.auth.signOut(); };
$("#logout-mobile").onclick = async () => { if (confirm("Sair da conta?")) await supa.auth.signOut(); };

supa.auth.onAuthStateChange((_e, session) => { if (session?.user) onLogin(session.user); else onLogout(); });

async function onLogin(user) {
  state.user = user;
  A.screen.classList.add("hidden"); A.app.classList.remove("hidden");
  $("#user-email").textContent = user.email;
  $("#sb-avatar").textContent = ini(user.email);
  $("#tb-avatar").textContent = ini(user.email);
  await Promise.all([loadContacts(), loadPrograms()]);
  showView("dashboard");
}
function onLogout() {
  state.user = null; state.contacts = []; state.programs = [];
  A.app.classList.add("hidden"); A.screen.classList.remove("hidden");
  A.email.value = ""; A.pass.value = "";
}

/* ---------- dados ---------- */
async function loadContacts() { const { data } = await supa.from("contacts").select("*").order("name"); state.contacts = data || []; }
async function loadPrograms() { const { data } = await supa.from("programs").select("*, contacts(name)").order("created_at", { ascending: false }); state.programs = data || []; }
async function save(table, payload, id) {
  payload.user_id = state.user.id;
  const { error } = id ? await supa.from(table).update(payload).eq("id", id) : await supa.from(table).insert(payload);
  if (error) { toast("Erro: " + error.message); throw error; }
}
async function remove(table, id) { const { error } = await supa.from(table).delete().eq("id", id); if (error) { toast("Erro ao excluir."); throw error; } }

/* ---------- navegação ---------- */
const TITLES = { dashboard: "Painel", contacts: "Contatos", programs: "Mentorias", evaluations: "Avaliações", billings: "Faturamento" };
$$(".navitem[data-view]").forEach((b) => b.onclick = () => showView(b.dataset.view));
function showView(name) {
  $$(".view").forEach((v) => v.classList.add("hidden"));
  $$(".navitem[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  $("#view-" + name).classList.remove("hidden");
  $("#dtitle").textContent = TITLES[name] || "Mentoria";
  $("#content").scrollTop = 0;
  ({ dashboard: renderDashboard, contacts: renderContacts, programs: renderPrograms, evaluations: renderEvaluations, billings: renderBillings })[name]?.();
}

/* ---------- modal ---------- */
function openModal({ title, body, onSave, saveLabel = "Salvar", wide = false }) {
  const root = $("#modal-root");
  root.innerHTML = `<div class="modal-overlay"><div class="modal ${wide ? "wide" : ""}">
    <span class="mhandle"></span><div class="mtitle">${esc(title)}</div>
    <div class="mbody">${body}</div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button>
      <button class="btn btn-p" data-save>${esc(saveLabel)}</button></div></div></div>`;
  const close = () => (root.innerHTML = "");
  $("[data-close]", root).onclick = close;
  $(".modal-overlay", root).onclick = (e) => { if (e.target.classList.contains("modal-overlay")) close(); };
  $("[data-save]", root).onclick = async () => {
    const b = $("[data-save]", root); b.disabled = true; b.textContent = "Salvando…";
    try { await onSave(); close(); } catch { b.disabled = false; b.textContent = saveLabel; }
  };
}
const field = (label, inner) => `<div class="fg"><label class="fl">${esc(label)}</label>${inner}</div>`;
const val = (id) => $("#" + id).value.trim();
const numOrNull = (v) => v === "" ? null : Number(v);

/* ===================================================================
   DASHBOARD
   =================================================================== */
async function renderDashboard() {
  const v = $("#view-dashboard");
  const active = state.programs.filter((p) => p.status === "ativo").length;
  const [{ data: meetings }, { data: billings }] = await Promise.all([
    supa.from("meetings").select("*, programs(title, contacts(name))").gte("scheduled_at", new Date().toISOString()).eq("status", "agendado").order("scheduled_at").limit(6),
    supa.from("billings").select("*, programs(title)"),
  ]);
  const received = (billings || []).filter((b) => b.status === "pago").reduce((s, b) => s + Number(b.amount), 0);
  const pending = (billings || []).filter((b) => b.status === "pendente" || b.status === "atrasado").reduce((s, b) => s + Number(b.amount), 0);
  const overdue = (billings || []).filter((b) => b.status !== "pago" && b.status !== "cancelado" && b.due_date && b.due_date < todayISO());

  v.innerHTML = `
    <div class="metrics">
      <div class="metric"><div class="mlabel">Contatos</div><div class="mval">${state.contacts.length}</div></div>
      <div class="metric"><div class="mlabel">Mentorias ativas</div><div class="mval">${active}</div></div>
      <div class="metric"><div class="mlabel">A receber</div><div class="mval">${money(pending)}</div></div>
      <div class="metric"><div class="mlabel">Recebido</div><div class="mval">${money(received)}</div></div>
    </div>
    <div class="dash-cols">
      <div class="panel"><div class="sechdr"><span class="sectitle">Próximos encontros</span></div>
        ${(meetings || []).length ? (meetings || []).map((m) => `<div class="list-line">
          <div><div class="ll-title">${esc(m.topic || "Encontro")}</div>
            <div class="ll-sub">${esc(m.programs?.title || "")}${m.programs?.contacts?.name ? " · " + esc(m.programs.contacts.name) : ""}</div></div>
          <div class="ll-sub" style="text-align:right">${fmtDateTime(m.scheduled_at)}</div></div>`).join("") : emptyState("Nenhum encontro agendado.")}
      </div>
      <div class="panel"><div class="sechdr"><span class="sectitle">Faturas em atraso</span></div>
        ${overdue.length ? overdue.map((b) => `<div class="list-line">
          <div><div class="ll-title">${esc(b.description || b.programs?.title || "Fatura")}</div>
            <div class="ll-sub">Venceu em ${fmtDate(b.due_date)}</div></div>
          <div class="lval" style="color:var(--red-text)">${money(b.amount)}</div></div>`).join("") : emptyState("Nenhuma fatura em atraso.")}
      </div>
    </div>`;
}

/* ===================================================================
   CONTATOS
   =================================================================== */
async function renderContacts() {
  const v = $("#view-contacts");
  await loadContacts();
  v.innerHTML = sechdr("Pessoas", "Contatos", "add-contact", "+ Novo contato") +
    (state.contacts.length ? state.contacts.map((c) => `
      <div class="li clickable" data-edit="${c.id}">
        <div class="av ${avClass(c.name)}">${esc(ini(c.name))}</div>
        <div class="linfo"><div class="lname">${esc(c.name)}</div>
          <div class="lsub">${esc([c.role, c.company].filter(Boolean).join(" · ") || c.email || "—")}</div></div>
        <div class="lright"><button class="bicon danger" data-del="${c.id}" title="Excluir">${ICON.trash}</button></div>
      </div>`).join("") : emptyState("Nenhum contato ainda. Crie o primeiro."));

  $("#add-contact").onclick = () => contactForm();
  $$("[data-edit]", v).forEach((el) => el.onclick = (e) => { if (e.target.closest("[data-del]")) return; contactForm(state.contacts.find((c) => c.id === el.dataset.edit)); });
  $$("[data-del]", v).forEach((b) => b.onclick = async (e) => { e.stopPropagation(); if (confirm("Excluir este contato?")) { await remove("contacts", b.dataset.del); toast("Contato excluído."); renderContacts(); } });
}
function contactForm(c = {}) {
  openModal({
    title: c.id ? "Editar contato" : "Novo contato",
    body: `${field("Nome", `<input id="f-name" value="${esc(c.name || "")}">`)}
      <div class="grid-2">${field("E-mail", `<input id="f-email" type="email" value="${esc(c.email || "")}">`)}
        ${field("Telefone", `<input id="f-phone" value="${esc(c.phone || "")}">`)}</div>
      <div class="grid-2">${field("Empresa", `<input id="f-company" value="${esc(c.company || "")}">`)}
        ${field("Cargo/Papel", `<input id="f-role" value="${esc(c.role || "")}">`)}</div>
      ${field("Tags", `<input id="f-tags" value="${esc(c.tags || "")}" placeholder="executivo, primeira mentoria">`)}
      ${field("Notas", `<textarea id="f-notes">${esc(c.notes || "")}</textarea>`)}`,
    onSave: async () => {
      const name = val("f-name"); if (!name) { toast("Informe o nome."); throw 0; }
      await save("contacts", { name, email: val("f-email"), phone: val("f-phone"), company: val("f-company"), role: val("f-role"), tags: val("f-tags"), notes: val("f-notes") }, c.id);
      toast("Contato salvo."); await loadContacts(); renderContacts();
    },
  });
}

/* ===================================================================
   MENTORIAS
   =================================================================== */
const STATUS_PROG = ["ativo", "pausado", "concluido", "cancelado"];
async function renderPrograms() {
  const v = $("#view-programs");
  await loadPrograms();
  v.innerHTML = sechdr("Programas", "Mentorias", "add-prog", "+ Nova mentoria") +
    (state.programs.length ? state.programs.map((p) => `
      <div class="li clickable" data-open="${p.id}">
        <div class="av ${avClass(p.title)}">${esc(ini(p.contacts?.name || p.title))}</div>
        <div class="linfo"><div class="lname">${esc(p.title)}</div>
          <div class="lsub">${esc(p.contacts?.name || "Sem mentorado")}${p.objective ? " · " + esc(p.objective) : ""}</div></div>
        <div class="lright"><span class="lval">${money(p.total_value)}</span>${badge(p.status)}
          <button class="bicon" data-edit="${p.id}" title="Editar">${ICON.edit}</button>
          <button class="bicon danger" data-del="${p.id}" title="Excluir">${ICON.trash}</button></div>
      </div>`).join("") : emptyState("Nenhuma mentoria cadastrada. Crie a primeira."));

  $("#add-prog").onclick = () => programForm();
  $$("[data-open]", v).forEach((el) => el.onclick = (e) => { if (e.target.closest("[data-edit],[data-del]")) return; openProgramDetail(el.dataset.open); });
  $$("[data-edit]", v).forEach((b) => b.onclick = (e) => { e.stopPropagation(); programForm(state.programs.find((p) => p.id === b.dataset.edit)); });
  $$("[data-del]", v).forEach((b) => b.onclick = async (e) => { e.stopPropagation(); if (confirm("Excluir esta mentoria? Encontros e avaliações vinculados também serão removidos.")) { await remove("programs", b.dataset.del); toast("Mentoria excluída."); renderPrograms(); } });
}
const contactOptions = (sel) => state.contacts.map((c) => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${esc(c.name)}</option>`).join("");
function programForm(p = {}) {
  openModal({
    title: p.id ? "Editar mentoria" : "Nova mentoria", wide: true,
    body: `${field("Título", `<input id="f-title" value="${esc(p.title || "")}" placeholder="Mentoria de liderança – João">`)}
      <div class="grid-2">${field("Mentorado", `<select id="f-contact"><option value="">— selecione —</option>${contactOptions(p.contact_id)}</select>`)}
        ${field("Status", `<select id="f-status">${STATUS_PROG.map((s) => `<option ${s === (p.status || "ativo") ? "selected" : ""}>${s}</option>`).join("")}</select>`)}</div>
      ${field("Objetivo", `<input id="f-objective" value="${esc(p.objective || "")}" placeholder="Desenvolver gestão de times">`)}
      <div class="grid-3">${field("Início", `<input id="f-start" type="date" value="${esc(p.start_date || "")}">`)}
        ${field("Término", `<input id="f-end" type="date" value="${esc(p.end_date || "")}">`)}
        ${field("Valor total (R$)", `<input id="f-value" type="number" step="0.01" value="${esc(p.total_value ?? "")}">`)}</div>
      ${field("Descrição", `<textarea id="f-desc">${esc(p.description || "")}</textarea>`)}`,
    onSave: async () => {
      const title = val("f-title"); if (!title) { toast("Informe o título."); throw 0; }
      await save("programs", { title, objective: val("f-objective"), description: val("f-desc"), status: val("f-status"), contact_id: val("f-contact") || null, start_date: val("f-start") || null, end_date: val("f-end") || null, total_value: numOrNull(val("f-value")) || 0 }, p.id);
      toast("Mentoria salva."); await loadPrograms(); renderPrograms();
    },
  });
}

/* ---------- detalhe da mentoria ---------- */
async function openProgramDetail(id, tab = "encontros") {
  await loadPrograms();
  const p = state.programs.find((x) => x.id === id); if (!p) return;
  state.currentProgram = p;
  $$(".view").forEach((v) => v.classList.add("hidden"));
  $$(".navitem[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === "programs"));
  $("#dtitle").textContent = p.title;
  const v = $("#view-program-detail"); v.classList.remove("hidden");
  v.innerHTML = `
    <button class="back-link" id="pd-back"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>Mentorias</button>
    <div class="sechdr"><div><div class="eyebrow">${esc(p.contacts?.name || "Mentoria")}</div><span class="sectitle">${esc(p.title)}</span></div>${badge(p.status)}</div>
    <div class="infocard"><div class="infogrid">
      <div><div class="lbl">Objetivo</div><div class="v">${esc(p.objective || "—")}</div></div>
      <div><div class="lbl">Período</div><div class="v">${fmtDate(p.start_date)} → ${fmtDate(p.end_date)}</div></div>
      <div><div class="lbl">Valor total</div><div class="v">${money(p.total_value)}</div></div>
    </div>${p.description ? `<div class="divider"></div><div class="muted">${esc(p.description)}</div>` : ""}</div>
    <div class="tabs">
      <button class="tab" data-tab="encontros">Encontros</button>
      <button class="tab" data-tab="avaliacoes">Avaliações</button>
      <button class="tab" data-tab="faturamento">Faturas</button>
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

/* ---------- encontros ---------- */
const STATUS_MEET = ["agendado", "realizado", "cancelado", "remarcado"];
async function renderMeetings() {
  const c = $("#pd-content");
  const { data } = await supa.from("meetings").select("*").eq("program_id", state.currentProgram.id).order("scheduled_at", { ascending: false });
  c.innerHTML = sechdr(null, "Encontros & observações", "add-meet", "+ Encontro") +
    ((data || []).length ? data.map((m) => `
      <div class="li" style="align-items:flex-start">
        <div class="linfo"><div class="lname">${esc(m.topic || "Encontro")} <span class="muted" style="font-weight:400">· ${fmtDateTime(m.scheduled_at)}</span></div>
          ${m.notes ? `<div class="lsub" style="white-space:pre-wrap;overflow:visible">${esc(m.notes)}</div>` : ""}
          <div class="lsub">${m.duration_min} min</div></div>
        <div class="lright" style="align-items:flex-end;flex-direction:column">${badge(m.status)}
          <div class="row" style="gap:2px"><button class="bicon" data-edit="${m.id}">${ICON.edit}</button>
            <button class="bicon danger" data-del="${m.id}">${ICON.trash}</button></div></div>
      </div>`).join("") : emptyState("Nenhum encontro registrado."));
  $("#add-meet").onclick = () => meetingForm();
  $$("[data-edit]", c).forEach((b) => b.onclick = () => meetingForm((data || []).find((m) => m.id === b.dataset.edit)));
  $$("[data-del]", c).forEach((b) => b.onclick = async () => { if (confirm("Excluir este encontro?")) { await remove("meetings", b.dataset.del); toast("Encontro excluído."); renderMeetings(); } });
}
function meetingForm(m = {}) {
  const dtVal = m.scheduled_at ? new Date(m.scheduled_at).toISOString().slice(0, 16) : "";
  openModal({
    title: m.id ? "Editar encontro" : "Novo encontro",
    body: `<div class="grid-2">${field("Data e hora", `<input id="f-dt" type="datetime-local" value="${dtVal}">`)}
        ${field("Duração (min)", `<input id="f-dur" type="number" value="${esc(m.duration_min || 60)}">`)}</div>
      <div class="grid-2">${field("Tema", `<input id="f-topic" value="${esc(m.topic || "")}">`)}
        ${field("Status", `<select id="f-status">${STATUS_MEET.map((s) => `<option ${s === (m.status || "agendado") ? "selected" : ""}>${s}</option>`).join("")}</select>`)}</div>
      ${field("Observações do encontro", `<textarea id="f-notes" style="min-height:120px">${esc(m.notes || "")}</textarea>`)}`,
    onSave: async () => {
      const dt = val("f-dt"); if (!dt) { toast("Informe data e hora."); throw 0; }
      await save("meetings", { program_id: state.currentProgram.id, scheduled_at: new Date(dt).toISOString(), duration_min: numOrNull(val("f-dur")) || 60, topic: val("f-topic"), notes: val("f-notes"), status: val("f-status") }, m.id);
      toast("Encontro salvo."); renderMeetings();
    },
  });
}

/* ---------- avaliações no programa ---------- */
async function renderProgramEvals() {
  const c = $("#pd-content");
  const { data } = await supa.from("evaluations").select("*").eq("program_id", state.currentProgram.id).order("evaluated_at", { ascending: false });
  c.innerHTML = sechdr(null, "Avaliações de performance", "add-eval", "+ Avaliação") +
    ((data || []).length ? data.map((ev) => `
      <div class="li" style="align-items:flex-start">
        <div class="av av1">${ev.overall_score ?? "—"}</div>
        <div class="linfo"><div class="lname">${esc(ev.period || "Avaliação")} <span class="muted" style="font-weight:400">· ${fmtDate(ev.evaluated_at)}</span></div>
          ${(ev.criteria || []).length ? `<div class="lsub" style="overflow:visible">${ev.criteria.map((cr) => `${esc(cr.name)}: <strong>${esc(cr.score)}</strong>`).join(" · ")}</div>` : ""}
          ${ev.comments ? `<div class="lsub" style="white-space:pre-wrap;overflow:visible;margin-top:4px">${esc(ev.comments)}</div>` : ""}</div>
        <div class="lright"><button class="bicon" data-edit="${ev.id}">${ICON.edit}</button>
          <button class="bicon danger" data-del="${ev.id}">${ICON.trash}</button></div>
      </div>`).join("") : emptyState("Nenhuma avaliação registrada."));
  $("#add-eval").onclick = () => evaluationForm();
  $$("[data-edit]", c).forEach((b) => b.onclick = () => evaluationForm((data || []).find((e) => e.id === b.dataset.edit)));
  $$("[data-del]", c).forEach((b) => b.onclick = async () => { if (confirm("Excluir esta avaliação?")) { await remove("evaluations", b.dataset.del); toast("Avaliação excluída."); renderProgramEvals(); } });
}
function evaluationForm(ev = {}) {
  const crits = ev.criteria && ev.criteria.length ? ev.criteria : [{ name: "", score: "" }];
  const critRow = (cr = {}) => `<div class="crit-row"><input class="crit-name" placeholder="Critério" value="${esc(cr.name || "")}">
    <input class="crit-score" type="number" step="0.5" min="0" max="10" placeholder="0-10" value="${esc(cr.score ?? "")}">
    <button class="bicon danger crit-del" type="button">${ICON.trash}</button></div>`;
  openModal({
    title: ev.id ? "Editar avaliação" : "Nova avaliação", wide: true,
    body: `<div class="grid-3">${field("Período", `<input id="f-period" value="${esc(ev.period || "")}" placeholder="Mês 1">`)}
        ${field("Data", `<input id="f-date" type="date" value="${esc(ev.evaluated_at || todayISO())}">`)}
        ${field("Nota geral (0-10)", `<input id="f-overall" type="number" step="0.1" min="0" max="10" value="${esc(ev.overall_score ?? "")}">`)}</div>
      ${field("Critérios", `<div id="crit-list">${crits.map(critRow).join("")}</div><button class="btn btn-sm" type="button" id="crit-add" style="margin-top:6px">+ Critério</button>`)}
      ${field("Comentários", `<textarea id="f-comments" style="min-height:90px">${esc(ev.comments || "")}</textarea>`)}`,
    onSave: async () => {
      const criteria = $$(".crit-row").map((r) => ({ name: $(".crit-name", r).value.trim(), score: numOrNull($(".crit-score", r).value) })).filter((cr) => cr.name);
      await save("evaluations", { program_id: state.currentProgram.id, period: val("f-period"), evaluated_at: val("f-date") || todayISO(), overall_score: numOrNull(val("f-overall")), criteria, comments: val("f-comments") }, ev.id);
      toast("Avaliação salva."); renderProgramEvals();
    },
  });
  const bind = () => $$(".crit-del").forEach((b) => b.onclick = () => { if ($$(".crit-row").length > 1) b.closest(".crit-row").remove(); });
  bind();
  $("#crit-add").onclick = () => { $("#crit-list").insertAdjacentHTML("beforeend", critRow()); bind(); };
}

/* ---------- faturas no programa ---------- */
async function renderProgramBillings() {
  const c = $("#pd-content");
  const { data } = await supa.from("billings").select("*").eq("program_id", state.currentProgram.id).order("due_date", { ascending: true });
  c.innerHTML = sechdr(null, "Faturamento do programa", "add-bill", "+ Fatura") +
    ((data || []).length ? data.map((b) => billingLi(b, false)).join("") : emptyState("Nenhuma fatura registrada."));
  bindBillings(c, data || [], renderProgramBillings);
  $("#add-bill").onclick = () => billingForm({ program_id: state.currentProgram.id }, renderProgramBillings);
}

/* ===================================================================
   AVALIAÇÕES (global)
   =================================================================== */
async function renderEvaluations() {
  const v = $("#view-evaluations");
  const { data } = await supa.from("evaluations").select("*, programs(title, contacts(name))").order("evaluated_at", { ascending: false });
  v.innerHTML = sechdr("Performance", "Avaliações", null) +
    ((data || []).length ? data.map((ev) => `
      <div class="li clickable" data-open="${ev.program_id}">
        <div class="av av1">${ev.overall_score ?? "—"}</div>
        <div class="linfo"><div class="lname">${esc(ev.programs?.contacts?.name || "—")}</div>
          <div class="lsub">${esc(ev.programs?.title || "")}${ev.period ? " · " + esc(ev.period) : ""} · ${fmtDate(ev.evaluated_at)}</div></div>
        <div class="lright muted">abrir ›</div>
      </div>`).join("") : emptyState("Nenhuma avaliação ainda. Abra uma mentoria para adicionar."));
  $$("[data-open]", v).forEach((el) => el.onclick = () => openProgramDetail(el.dataset.open, "avaliacoes"));
}

/* ===================================================================
   FATURAMENTO (global)
   =================================================================== */
const STATUS_BILL = ["pendente", "pago", "atrasado", "cancelado"];
const programOptions = (sel) => state.programs.map((p) => `<option value="${p.id}" ${p.id === sel ? "selected" : ""}>${esc(p.title)}${p.contacts?.name ? " — " + esc(p.contacts.name) : ""}</option>`).join("");

function billingLi(b, showProgram = true) {
  const overdue = b.status !== "pago" && b.status !== "cancelado" && b.due_date && b.due_date < todayISO();
  const stat = overdue ? "atrasado" : b.status;
  const sub = [showProgram ? (b.programs?.title || "Avulsa") : null, b.due_date ? "vence " + fmtDate(b.due_date) : null, b.paid_at ? "pago " + fmtDate(b.paid_at) : null].filter(Boolean).join(" · ");
  return `<div class="li">
    <div class="linfo"><div class="lname">${esc(b.description || b.programs?.title || "Fatura")}</div><div class="lsub">${esc(sub || "—")}</div></div>
    <div class="lright"><span class="lval">${money(b.amount)}</span>${badge(stat)}
      ${b.status !== "pago" ? `<button class="bicon" data-pay="${b.id}" title="Marcar como pago">${ICON.paid}</button>` : ""}
      <button class="bicon" data-edit="${b.id}" title="Editar">${ICON.edit}</button>
      <button class="bicon danger" data-del="${b.id}" title="Excluir">${ICON.trash}</button></div>
  </div>`;
}
function bindBillings(root, rows, refresh) {
  $$("[data-pay]", root).forEach((b) => b.onclick = async () => { await save("billings", { status: "pago", paid_at: todayISO() }, b.dataset.pay); toast("Fatura paga."); refresh(); });
  $$("[data-edit]", root).forEach((b) => b.onclick = () => billingForm(rows.find((x) => x.id === b.dataset.edit), refresh));
  $$("[data-del]", root).forEach((b) => b.onclick = async () => { if (confirm("Excluir esta fatura?")) { await remove("billings", b.dataset.del); toast("Fatura excluída."); refresh(); } });
}
async function renderBillings() {
  const v = $("#view-billings");
  await loadPrograms();
  const { data } = await supa.from("billings").select("*, programs(title)").order("due_date", { ascending: true });
  const rows = data || [];
  const received = rows.filter((b) => b.status === "pago").reduce((s, b) => s + Number(b.amount), 0);
  const pending = rows.filter((b) => b.status !== "pago" && b.status !== "cancelado").reduce((s, b) => s + Number(b.amount), 0);
  v.innerHTML = sechdr("Financeiro", "Faturamento", "add-bill-g", "+ Nova fatura") +
    `<div class="metrics" style="grid-template-columns:repeat(3,1fr)">
      <div class="metric"><div class="mlabel">Recebido</div><div class="mval">${money(received)}</div></div>
      <div class="metric"><div class="mlabel">Em aberto</div><div class="mval">${money(pending)}</div></div>
      <div class="metric"><div class="mlabel">Faturas</div><div class="mval">${rows.length}</div></div>
    </div>` +
    (rows.length ? rows.map((b) => billingLi(b, true)).join("") : emptyState("Nenhuma fatura registrada."));
  $("#add-bill-g").onclick = () => billingForm({}, renderBillings);
  bindBillings(v, rows, renderBillings);
}
function billingForm(b = {}, refresh) {
  const done = refresh || (state.currentProgram ? renderProgramBillings : renderBillings);
  openModal({
    title: b.id ? "Editar fatura" : "Nova fatura",
    body: `${field("Programa", `<select id="f-program"><option value="">— avulsa —</option>${programOptions(b.program_id)}</select>`)}
      ${field("Descrição", `<input id="f-desc" value="${esc(b.description || "")}" placeholder="Parcela 1/6">`)}
      <div class="grid-3">${field("Valor (R$)", `<input id="f-amount" type="number" step="0.01" value="${esc(b.amount ?? "")}">`)}
        ${field("Vencimento", `<input id="f-due" type="date" value="${esc(b.due_date || "")}">`)}
        ${field("Status", `<select id="f-status">${STATUS_BILL.map((s) => `<option ${s === (b.status || "pendente") ? "selected" : ""}>${s}</option>`).join("")}</select>`)}</div>
      ${field("Data de pagamento", `<input id="f-paid" type="date" value="${esc(b.paid_at || "")}">`)}`,
    onSave: async () => {
      const amount = numOrNull(val("f-amount")); if (amount == null) { toast("Informe o valor."); throw 0; }
      const status = val("f-status");
      await save("billings", { program_id: val("f-program") || null, description: val("f-desc"), amount, due_date: val("f-due") || null, status, paid_at: val("f-paid") || (status === "pago" ? todayISO() : null) }, b.id);
      toast("Fatura salva."); done();
    },
  });
}

/* ---------- boot ---------- */
(async () => {
  const { data } = await supa.auth.getSession();
  if (data.session?.user) onLogin(data.session.user);
  else { setAuthMode("signin"); onLogout(); }
})();
