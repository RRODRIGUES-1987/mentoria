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
const APP_VERSION = "1.5.0";

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
const BADGE = { ativo: "bg", realizado: "bg", pago: "bg", pendente: "ba", agendado: "ba", pausado: "ba", a_agendar: "bgr", atrasado: "br", cancelado: "br", concluido: "bb", remarcado: "bgr" };
const badgeLabel = (s) => s === "a_agendar" ? "a agendar" : s;
const badge = (s) => `<span class="bdg ${BADGE[s] || "bgr"}">${esc(badgeLabel(s))}</span>`;

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
const state = { user: null, contacts: [], programs: [], currentProgram: null };

/* ---------- loading ---------- */
const showLoading = () => $("#loading").classList.remove("hidden");
const hideLoading = () => $("#loading").classList.add("hidden");

/* ---------- AUTH (somente login; contas são criadas no Admin) ---------- */
const A = {
  screen: $("#auth-screen"), app: $("#app"), email: $("#auth-email"), pass: $("#auth-pass"),
  submit: $("#auth-submit"), msg: $("#auth-msg"),
};
function showAuthMsg(msg, kind) { A.msg.textContent = msg; A.msg.className = "msg " + (kind === "ok" ? "msg-ok" : "msg-err") + " show"; }
function authErr(m) {
  if (/invalid login/i.test(m)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(m)) return "E-mail ainda não confirmado.";
  return m;
}
async function handleAuth() {
  const email = A.email.value.trim(), password = A.pass.value;
  if (!email || !password) return showAuthMsg("Preencha e-mail e senha.");
  A.submit.disabled = true; A.submit.textContent = "Aguarde…";
  try {
    const { error } = await supa.auth.signInWithPassword({ email, password });
    if (error) throw error;
  } catch (e) { showAuthMsg(authErr(e.message)); }
  finally { A.submit.disabled = false; A.submit.textContent = "Entrar"; }
}
A.submit.onclick = handleAuth;
A.pass.addEventListener("keydown", (e) => { if (e.key === "Enter") handleAuth(); });

$("#logout-btn").onclick = async () => { await supa.auth.signOut(); };
$("#logout-mobile").onclick = async () => { if (confirm("Sair da conta?")) await supa.auth.signOut(); };

supa.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session?.user) { onLogout(); return; }
  if (!state.user) onLogin(session.user);
});

async function onLogin(user) {
  state.user = user;
  let prof = null;
  try { const r = await supa.from("profiles").select("*, companies(name, logo_url)").eq("id", user.id).maybeSingle(); prof = r.data; } catch (_) {}
  state.profile = prof;
  state.isSuperAdmin = prof?.role === "super_admin";
  state.companyId = prof?.company_id || null;
  const ALL = { contacts: true, programs: true, evaluations: true, billings: true };
  if (!prof) { state.permissions = ALL; toast("Perfil não configurado — rode a migração multi-empresa."); }
  else if (state.isSuperAdmin || prof.role === "admin") state.permissions = ALL;
  else state.permissions = prof.permissions || {};

  A.screen.classList.add("hidden"); A.app.classList.remove("hidden");
  setVersion();
  const display = prof?.full_name || user.email;
  $("#user-email").textContent = display;
  $("#sb-avatar").textContent = ini(display);
  $("#tb-avatar").textContent = ini(display);
  const roleEl = $(".sburole"); if (roleEl) roleEl.textContent = prof?.companies?.name || (state.isSuperAdmin ? "Super admin" : "Mentor");
  applyPermissions();
  await Promise.all([loadContacts(), loadPrograms()]);
  let last = null; try { last = sessionStorage.getItem("mentoria_view"); } catch (_) {}
  const b = last && $(`.navitem[data-view="${last}"]`);
  showView(b && !b.classList.contains("hidden") ? last : firstView());
  hideLoading();
}
function applyPermissions() {
  $$(".navitem[data-view]").forEach((b) => {
    const view = b.dataset.view;
    const show = view === "admin" ? state.isSuperAdmin
      : (state.isSuperAdmin || state.profile?.role === "admin" || state.permissions?.[view] === true);
    b.classList.toggle("hidden", !show);
  });
}
function firstView() {
  return ["programs", "contacts", "evaluations", "billings", "admin"]
    .find((v) => { const b = $(`.navitem[data-view="${v}"]`); return b && !b.classList.contains("hidden"); }) || "programs";
}
function onLogout() {
  state.user = null; state.contacts = []; state.programs = []; state.profile = null; state.isSuperAdmin = false;
  A.app.classList.add("hidden"); A.screen.classList.remove("hidden"); hideLoading();
  A.email.value = ""; A.pass.value = "";
}

/* ---------- dados ---------- */
async function loadContacts() { const { data } = await supa.from("contacts").select("*, positions(company, role, is_current, start_date, end_date)").order("name"); state.contacts = data || []; }
async function loadPrograms() { const { data } = await supa.from("programs").select("*, contacts(name)").order("created_at", { ascending: false }); state.programs = data || []; }
const DATA_TABLES = ["contacts", "programs", "meetings", "evaluations", "billings", "positions"];
async function save(table, payload, id) {
  payload.user_id = state.user.id;
  if (!id && DATA_TABLES.includes(table) && state.companyId) payload.company_id = state.companyId;
  const { error } = id ? await supa.from(table).update(payload).eq("id", id) : await supa.from(table).insert(payload);
  if (error) { toast("Erro: " + error.message); throw error; }
}
async function remove(table, id) { const { error } = await supa.from(table).delete().eq("id", id); if (error) { toast("Erro ao excluir."); throw error; } }

/* ---------- navegação ---------- */
const TITLES = { contacts: "Contatos", programs: "Mentorias", evaluations: "Avaliações", billings: "Faturamento", admin: "Admin" };
$$(".navitem[data-view]").forEach((b) => b.onclick = () => showView(b.dataset.view));
function showView(name) {
  if (name === "admin" && !state.isSuperAdmin) return;
  $$(".view").forEach((v) => v.classList.add("hidden"));
  $$(".navitem[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  $("#view-" + name).classList.remove("hidden");
  try { sessionStorage.setItem("mentoria_view", name); } catch (_) {}
  $("#dtitle").textContent = TITLES[name] || "Mentoria";
  $("#content").scrollTop = 0;
  ({ contacts: renderContacts, programs: renderPrograms, evaluations: renderEvaluations, billings: renderBillings, admin: renderAdmin })[name]?.();
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
   CONTATOS
   =================================================================== */
function currentPosition(c) {
  const ps = c.positions || []; if (!ps.length) return null;
  return ps.find((p) => p.is_current) || [...ps].sort((a, b) => (b.start_date || "") > (a.start_date || "") ? 1 : -1)[0];
}
function contactSubtitle(c) {
  const cur = currentPosition(c);
  if (cur) return [cur.role, cur.company].filter(Boolean).join(" · ") || c.email || "—";
  return [c.role, c.company].filter(Boolean).join(" · ") || c.email || "—";
}

async function renderContacts() {
  const v = $("#view-contacts");
  await loadContacts();
  v.innerHTML = sechdr("Pessoas", "Contatos", "add-contact", "+ Novo contato") +
    (state.contacts.length ? state.contacts.map((c) => `
      <div class="li clickable" data-open="${c.id}">
        <div class="av ${avClass(c.name)}">${esc(ini(c.name))}</div>
        <div class="linfo"><div class="lname">${esc(c.name)}${c.age ? ` · ${c.age}` : ""}</div>
          <div class="lsub">${esc(contactSubtitle(c))}</div></div>
        <div class="lright">${c.is_mentee ? '<span class="bdg bb">Mentorado</span>' : ""}
          <button class="bicon danger" data-del="${c.id}" title="Excluir">${ICON.trash}</button></div>
      </div>`).join("") : emptyState("Nenhum contato ainda. Crie o primeiro."));

  $("#add-contact").onclick = () => contactForm();
  $$("[data-open]", v).forEach((el) => el.onclick = (e) => { if (e.target.closest("[data-del]")) return; openContactDetail(el.dataset.open); });
  $$("[data-del]", v).forEach((b) => b.onclick = async (e) => { e.stopPropagation(); if (confirm("Excluir este contato? O histórico profissional dele também será removido.")) { await remove("contacts", b.dataset.del); toast("Contato excluído."); renderContacts(); } });
}

/* ---------- detalhe do contato ---------- */
function familyHtml(c) {
  const spouse = c.is_married
    ? `<div><div class="lbl">Cônjuge</div><div class="v">${esc(c.spouse_name || "—")}${c.spouse_age ? ` · ${c.spouse_age} anos` : ""}</div></div>
       <div><div class="lbl">Cônjuge trabalha</div><div class="v">${c.spouse_works ? `Sim — ${esc(c.spouse_workplace || "—")}${c.spouse_role ? " (" + esc(c.spouse_role) + ")" : ""}` : "Não"}</div></div>`
    : `<div><div class="lbl">Estado civil</div><div class="v">Solteiro(a)</div></div>`;
  const kids = c.children || [];
  const kidsHtml = kids.map((k) => `<div class="li"><div class="av av3">${esc(ini(k.name))}</div>
    <div class="linfo"><div class="lname">${esc(k.name || "—")}${k.age != null && k.age !== "" ? ` · ${esc(k.age)} anos` : ""}</div>
      <div class="lsub">${k.works ? `Trabalha — ${esc(k.workplace || "—")}${k.role ? " (" + esc(k.role) + ")" : ""}` : "Não trabalha"}</div></div></div>`).join("");
  return `<div class="infocard"><div class="infogrid">${spouse}</div></div>
    ${kids.length ? `<div class="sechdr" style="margin-top:6px"><span class="sectitle">Filhos (${kids.length})</span></div>${kidsHtml}` : ""}`;
}
async function openContactDetail(id) {
  await loadContacts();
  const c = state.contacts.find((x) => x.id === id); if (!c) return;
  state.currentContact = c;
  $$(".view").forEach((vv) => vv.classList.add("hidden"));
  $$(".navitem[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === "contacts"));
  $("#dtitle").textContent = c.name;
  await loadPrograms();
  const progs = state.programs.filter((p) => p.contact_id === id);
  const v = $("#view-contact-detail"); v.classList.remove("hidden");
  v.innerHTML = `
    <button class="back-link" id="cd-back"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>Contatos</button>
    <div class="sechdr"><div><div class="eyebrow">Contato${c.is_mentee ? " · Mentorado" : ""}</div>
      <span class="sectitle">${esc(c.name)}${c.age ? ` · ${c.age} anos` : ""}</span></div>
      <div class="row" style="gap:6px">
        <button class="btn btn-sm" id="cd-edit">Editar</button>
        <button class="btn btn-sm ${c.is_mentee ? "" : "btn-p"}" id="cd-mentee">${c.is_mentee ? "Remover de mentorados" : "Tornar mentorado"}</button>
      </div></div>
    <div class="infocard"><div class="infogrid">
      <div><div class="lbl">E-mail</div><div class="v">${esc(c.email || "—")}</div></div>
      <div><div class="lbl">Telefone</div><div class="v">${esc(c.phone || "—")}</div></div>
      <div><div class="lbl">Cadastrado em</div><div class="v">${c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "—"}</div></div>
      ${c.tags ? `<div><div class="lbl">Tags</div><div class="v">${esc(c.tags)}</div></div>` : ""}
    </div>${c.notes ? `<div class="divider"></div><div class="muted">${esc(c.notes)}</div>` : ""}</div>
    ${familyHtml(c)}
    <div class="sechdr" style="margin-top:18px"><span class="sectitle">Histórico profissional</span>
      <button class="btn btn-p btn-sm" id="add-pos">+ Cargo</button></div>
    <div id="positions-list"></div>
    ${c.is_mentee ? `<div class="sechdr" style="margin-top:18px"><span class="sectitle">Mentorias</span></div>
      ${progs.length ? progs.map((p) => `<div class="li clickable" data-prog="${p.id}">
        <div class="linfo"><div class="lname">${esc(p.title)}</div><div class="lsub">${esc(p.objective || "")}</div></div>
        <div class="lright">${badge(p.status)}</div></div>`).join("") : emptyState("Nenhuma mentoria ainda. Crie em Mentorias.")}` : ""}`;
  $("#cd-back").onclick = () => showView("contacts");
  $("#cd-edit").onclick = () => contactForm(c, () => openContactDetail(id));
  $("#cd-mentee").onclick = async () => {
    if (c.is_mentee) { await save("contacts", { is_mentee: false }, id); toast("Removido de mentorados."); openContactDetail(id); }
    else mentorshipSetupForm(c);
  };
  $$("[data-prog]", v).forEach((el) => el.onclick = () => openProgramDetail(el.dataset.prog));
  $("#add-pos").onclick = () => positionForm({ contact_id: id });
  renderContactPositions(id);
}
async function renderContactPositions(id) {
  const wrap = $("#positions-list"); if (!wrap) return;
  const { data } = await supa.from("positions").select("*").eq("contact_id", id).order("start_date", { ascending: false, nullsFirst: false });
  wrap.innerHTML = (data || []).length ? data.map((p) => `
    <div class="li" style="align-items:flex-start">
      <div class="linfo"><div class="lname">${esc(p.role || "Cargo")}${p.company ? ` · ${esc(p.company)}` : ""} ${p.is_current ? '<span class="bdg bg">atual</span>' : ""}</div>
        <div class="lsub">${fmtDate(p.start_date)} → ${p.is_current ? "atual" : fmtDate(p.end_date)}</div>
        ${p.remuneration != null ? `<div class="lsub">Remuneração: ${money(p.remuneration)}</div>` : ""}
        ${p.benefits ? `<div class="lsub" style="overflow:visible;white-space:pre-wrap">Benefícios: ${esc(p.benefits)}</div>` : ""}
        ${p.notes ? `<div class="lsub" style="overflow:visible;white-space:pre-wrap;margin-top:2px">${esc(p.notes)}</div>` : ""}</div>
      <div class="lright"><button class="bicon" data-pedit="${p.id}">${ICON.edit}</button>
        <button class="bicon danger" data-pdel="${p.id}">${ICON.trash}</button></div>
    </div>`).join("") : emptyState("Nenhum cargo registrado. Adicione o histórico profissional.");
  $$("[data-pedit]", wrap).forEach((b) => b.onclick = () => positionForm((data || []).find((p) => p.id === b.dataset.pedit)));
  $$("[data-pdel]", wrap).forEach((b) => b.onclick = async () => { if (confirm("Excluir este cargo?")) { await remove("positions", b.dataset.pdel); toast("Cargo excluído."); renderContactPositions(id); } });
}
function positionForm(p = {}) {
  const cid = p.contact_id || state.currentContact?.id;
  openModal({
    title: p.id ? "Editar cargo" : "Novo cargo", wide: true,
    body: `<div class="grid-2">${field("Empresa", `<input id="f-company" value="${esc(p.company || "")}">`)}
        ${field("Função/Cargo", `<input id="f-role" value="${esc(p.role || "")}">`)}</div>
      <div class="grid-3">${field("Início", `<input id="f-start" type="date" value="${esc(p.start_date || "")}">`)}
        ${field("Término", `<input id="f-end" type="date" value="${esc(p.end_date || "")}">`)}
        ${field("Remuneração (R$)", `<input id="f-rem" type="number" step="0.01" value="${esc(p.remuneration ?? "")}">`)}</div>
      <label class="ckline"><input type="checkbox" id="f-current" ${p.is_current ? "checked" : ""}> Cargo atual (sem data de término)</label>
      ${field("Pacote de benefícios", `<textarea id="f-benefits" style="min-height:70px" placeholder="Plano de saúde, PLR, bônus, stock options…">${esc(p.benefits || "")}</textarea>`)}
      ${field("Observações", `<textarea id="f-notes">${esc(p.notes || "")}</textarea>`)}`,
    onSave: async () => {
      const isCurrent = $("#f-current").checked;
      await save("positions", { contact_id: cid, company: val("f-company"), role: val("f-role"), start_date: val("f-start") || null, end_date: isCurrent ? null : (val("f-end") || null), is_current: isCurrent, remuneration: numOrNull(val("f-rem")), benefits: val("f-benefits"), notes: val("f-notes") }, p.id);
      toast("Cargo salvo."); renderContactPositions(cid);
    },
  });
}

/* ---------- criar mentoria (gera contrato + encontros) ---------- */
const FREQ = ["semanal", "quinzenal", "mensal", "bimestral"];
const FREQ_PER_MONTH = { semanal: 4, quinzenal: 2, mensal: 1, bimestral: 0.5 };
const meetingCount = (freq, months) => Math.max(1, Math.round((months || 0) * (FREQ_PER_MONTH[freq] || 1)));
function addMonths(iso, n) { const d = new Date(iso + "T00:00:00"); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); }

function mentorshipSetupForm(c) {
  const today = todayISO();
  const contactField = c
    ? `<input type="hidden" id="f-contact" value="${c.id}">`
    : field("Mentorado", `<select id="f-contact"><option value="">— selecione —</option>${state.contacts.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select>`);
  openModal({
    title: c ? "Tornar mentorado — nova mentoria" : "Nova mentoria", wide: true, saveLabel: "Criar mentoria",
    body: `${c ? `<p class="muted" style="font-size:12px;margin-bottom:12px">Configure a mentoria de <strong>${esc(c.name)}</strong>.</p>` : ""}
      ${contactField}
      ${field("Título", `<input id="f-title" value="${c ? "Mentoria — " + esc(c.name) : ""}">`)}
      ${field("Objetivo", `<input id="f-objective" placeholder="Ex.: desenvolver liderança">`)}
      <div class="grid-3">${field("Início", `<input id="f-start" type="date" value="${today}">`)}
        ${field("Prazo (meses)", `<input id="f-months" type="number" min="1" value="6">`)}
        ${field("Frequência", `<select id="f-freq">${FREQ.map((f) => `<option>${f}</option>`).join("")}</select>`)}</div>
      <label class="ckline"><input type="checkbox" id="f-gen-meet" checked> Gerar os encontros automaticamente</label>
      <div class="muted" id="meet-preview" style="font-size:12px;margin:-2px 0 8px"></div>
      <div class="divider"></div>
      <label class="ckline"><input type="checkbox" id="f-billed"> Mentoria cobrada</label>
      <div id="billing-box" style="display:none">
        <div class="grid-3">${field("Valor total (R$)", `<input id="f-total" type="number" step="0.01" placeholder="0,00">`)}
          ${field("Nº de parcelas", `<input id="f-inst" type="number" value="6">`)}
          ${field("Forma de pagamento", `<input id="f-pay" placeholder="PIX, boleto...">`)}</div>
        <label class="ckline"><input type="checkbox" id="f-gen" checked> Gerar as parcelas no faturamento</label>
      </div>`,
    onSave: async () => {
      const contactId = val("f-contact"); if (!contactId) { toast("Selecione o mentorado."); throw 0; }
      const title = val("f-title"); if (!title) { toast("Informe o título."); throw 0; }
      const months = numOrNull(val("f-months")) || 6;
      const freq = val("f-freq");
      const start = val("f-start") || todayISO();
      const billed = $("#f-billed").checked;
      const total = numOrNull(val("f-total")) || 0;
      const inst = numOrNull(val("f-inst")) || 0;
      const payload = {
        title, objective: val("f-objective"), status: "ativo", contact_id: contactId,
        start_date: start, end_date: addMonths(start, months), total_value: total,
        meeting_frequency: freq, contract_months: months,
        is_billed: billed, installments: billed ? inst : null, payment_method: billed ? val("f-pay") : null,
        user_id: state.user.id,
      };
      if (state.companyId) payload.company_id = state.companyId;
      const { data: prog, error } = await supa.from("programs").insert(payload).select().single();
      if (error) { toast(error.message); throw 0; }
      await supa.from("contacts").update({ is_mentee: true }).eq("id", contactId);
      // encontros como tarefas (sem agenda ainda)
      if ($("#f-gen-meet").checked) {
        const n = meetingCount(freq, months);
        const rows = [];
        for (let i = 1; i <= n; i++) rows.push({ user_id: state.user.id, company_id: state.companyId || null, program_id: prog.id, topic: `Encontro ${i}`, status: "a_agendar", seq: i, duration_min: 60, scheduled_at: null });
        const { error: mErr } = await supa.from("meetings").insert(rows);
        if (mErr) toast("Mentoria criada, mas os encontros falharam: " + mErr.message);
      }
      // parcelas (detalhe de cobrança)
      if (billed && inst > 0 && total > 0 && $("#f-gen").checked) {
        const base = Math.floor((total / inst) * 100) / 100;
        const rows = [];
        for (let i = 0; i < inst; i++) {
          const amount = i === inst - 1 ? Math.round((total - base * (inst - 1)) * 100) / 100 : base;
          rows.push({ user_id: state.user.id, company_id: state.companyId || null, program_id: prog.id, description: `Parcela ${i + 1}/${inst}`, amount, due_date: addMonths(start, i), status: "pendente" });
        }
        const { error: bErr } = await supa.from("billings").insert(rows);
        if (bErr) toast("Mentoria criada, mas as parcelas falharam: " + bErr.message);
      }
      toast("Mentoria criada!"); await loadPrograms(); openProgramDetail(prog.id);
    },
  });
  const updatePreview = () => { const n = meetingCount(val("f-freq"), numOrNull(val("f-months"))); $("#meet-preview").textContent = $("#f-gen-meet").checked ? `Serão criados ${n} encontros para você agendar.` : ""; };
  $("#f-billed").onchange = (e) => $("#billing-box").style.display = e.target.checked ? "" : "none";
  ["f-months", "f-freq"].forEach((id) => $("#" + id).oninput = updatePreview);
  $("#f-gen-meet").onchange = updatePreview;
  updatePreview();
}

/* ---------- formulário do contato ---------- */
function contactForm(c = {}, after) {
  const done = after || (async () => { await loadContacts(); renderContacts(); });
  const kids = (c.children && c.children.length) ? c.children : [];
  const childBlock = (ch = {}) => `<div class="child-row">
    <div class="grid-2"><div class="fg"><label class="fl">Nome</label><input class="ch-name" value="${esc(ch.name || "")}"></div>
      <div class="fg"><label class="fl">Idade</label><input class="ch-age" type="number" value="${esc(ch.age ?? "")}"></div></div>
    <label class="ckline"><input type="checkbox" class="ch-works" ${ch.works ? "checked" : ""}> Trabalha</label>
    <div class="ch-workbox grid-2" style="${ch.works ? "" : "display:none"}">
      <div class="fg"><label class="fl">Onde</label><input class="ch-workplace" value="${esc(ch.workplace || "")}"></div>
      <div class="fg"><label class="fl">Função</label><input class="ch-role" value="${esc(ch.role || "")}"></div></div>
    <button type="button" class="btn btn-sm btn-danger ch-del" style="margin-top:6px">Remover filho</button></div>`;
  openModal({
    title: c.id ? "Editar contato" : "Novo contato", wide: true,
    body: `
      <div class="grid-2">${field("Nome", `<input id="f-name" value="${esc(c.name || "")}">`)}
        ${field("Idade", `<input id="f-age" type="number" value="${esc(c.age ?? "")}">`)}</div>
      <div class="grid-2">${field("E-mail", `<input id="f-email" type="email" value="${esc(c.email || "")}">`)}
        ${field("Telefone", `<input id="f-phone" value="${esc(c.phone || "")}">`)}</div>
      ${field("Tags", `<input id="f-tags" value="${esc(c.tags || "")}" placeholder="executivo, primeira mentoria">`)}
      ${field("Notas", `<textarea id="f-notes">${esc(c.notes || "")}</textarea>`)}
      <label class="ckline"><input type="checkbox" id="f-mentee" ${c.is_mentee ? "checked" : ""}> É mentorado</label>
      <div class="divider"></div>
      <label class="ckline"><input type="checkbox" id="f-married" ${c.is_married ? "checked" : ""}> Casado(a)</label>
      <div id="spouse-box" style="${c.is_married ? "" : "display:none"}">
        <div class="grid-2">${field("Nome do cônjuge", `<input id="f-spouse-name" value="${esc(c.spouse_name || "")}">`)}
          ${field("Idade do cônjuge", `<input id="f-spouse-age" type="number" value="${esc(c.spouse_age ?? "")}">`)}</div>
        <label class="ckline"><input type="checkbox" id="f-spouse-works" ${c.spouse_works ? "checked" : ""}> Cônjuge trabalha</label>
        <div id="spouse-work" class="grid-2" style="${c.spouse_works ? "" : "display:none"}">
          ${field("Onde", `<input id="f-spouse-workplace" value="${esc(c.spouse_workplace || "")}">`)}
          ${field("Função", `<input id="f-spouse-role" value="${esc(c.spouse_role || "")}">`)}</div>
      </div>
      <div class="divider"></div>
      <div class="sechdr"><span class="sectitle">Filhos</span></div>
      <div id="children-list">${kids.map(childBlock).join("")}</div>
      <button class="btn btn-sm" type="button" id="add-child">+ Filho</button>`,
    onSave: async () => {
      const name = val("f-name"); if (!name) { toast("Informe o nome."); throw 0; }
      const married = $("#f-married").checked, sworks = $("#f-spouse-works").checked;
      const children = $$(".child-row").map((r) => ({
        name: $(".ch-name", r).value.trim(), age: numOrNull($(".ch-age", r).value),
        works: $(".ch-works", r).checked, workplace: $(".ch-workplace", r).value.trim(), role: $(".ch-role", r).value.trim(),
      })).filter((k) => k.name);
      await save("contacts", {
        name, age: numOrNull(val("f-age")), email: val("f-email"), phone: val("f-phone"),
        tags: val("f-tags"), notes: val("f-notes"), is_mentee: $("#f-mentee").checked,
        is_married: married, spouse_name: married ? val("f-spouse-name") : null,
        spouse_age: married ? numOrNull(val("f-spouse-age")) : null, spouse_works: married && sworks,
        spouse_workplace: (married && sworks) ? val("f-spouse-workplace") : null,
        spouse_role: (married && sworks) ? val("f-spouse-role") : null, children,
      }, c.id);
      toast("Contato salvo."); done();
    },
  });
  const bindChildWorks = () => $$(".ch-works").forEach((cb) => cb.onchange = () => { cb.closest(".child-row").querySelector(".ch-workbox").style.display = cb.checked ? "" : "none"; });
  const bindChildDel = () => $$(".ch-del").forEach((b) => b.onclick = () => b.closest(".child-row").remove());
  $("#f-married").onchange = (e) => $("#spouse-box").style.display = e.target.checked ? "" : "none";
  $("#f-spouse-works").onchange = (e) => $("#spouse-work").style.display = e.target.checked ? "" : "none";
  $("#add-child").onclick = () => { $("#children-list").insertAdjacentHTML("beforeend", childBlock()); bindChildWorks(); bindChildDel(); };
  bindChildWorks(); bindChildDel();
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

  $("#add-prog").onclick = () => mentorshipSetupForm();
  $$("[data-open]", v).forEach((el) => el.onclick = (e) => { if (e.target.closest("[data-edit],[data-del]")) return; openProgramDetail(el.dataset.open); });
  $$("[data-edit]", v).forEach((b) => b.onclick = (e) => { e.stopPropagation(); programForm(state.programs.find((p) => p.id === b.dataset.edit)); });
  $$("[data-del]", v).forEach((b) => b.onclick = async (e) => { e.stopPropagation(); if (confirm("Excluir esta mentoria? Encontros e avaliações vinculados também serão removidos.")) { await remove("programs", b.dataset.del); toast("Mentoria excluída."); renderPrograms(); } });
}
const contactOptions = (sel) => state.contacts.map((c) => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${esc(c.name)}</option>`).join("");
function programForm(p = {}) {
  openModal({
    title: "Editar mentoria", wide: true,
    body: `${field("Título", `<input id="f-title" value="${esc(p.title || "")}">`)}
      <div class="grid-2">${field("Mentorado", `<select id="f-contact"><option value="">— selecione —</option>${contactOptions(p.contact_id)}</select>`)}
        ${field("Status", `<select id="f-status">${STATUS_PROG.map((s) => `<option ${s === (p.status || "ativo") ? "selected" : ""}>${s}</option>`).join("")}</select>`)}</div>
      ${field("Objetivo", `<input id="f-objective" value="${esc(p.objective || "")}">`)}
      <div class="grid-3">${field("Início", `<input id="f-start" type="date" value="${esc(p.start_date || "")}">`)}
        ${field("Prazo (meses)", `<input id="f-months" type="number" min="1" value="${esc(p.contract_months ?? "")}">`)}
        ${field("Frequência", `<select id="f-freq"><option value="">—</option>${FREQ.map((f) => `<option ${f === p.meeting_frequency ? "selected" : ""}>${f}</option>`).join("")}</select>`)}</div>
      <div class="grid-2">${field("Valor total (R$)", `<input id="f-value" type="number" step="0.01" value="${esc(p.total_value ?? "")}">`)}
        ${field("Forma de pagamento", `<input id="f-pay" value="${esc(p.payment_method || "")}">`)}</div>
      <label class="ckline"><input type="checkbox" id="f-billed" ${p.is_billed ? "checked" : ""}> Mentoria cobrada</label>
      ${field("Descrição", `<textarea id="f-desc">${esc(p.description || "")}</textarea>`)}`,
    onSave: async () => {
      const title = val("f-title"); if (!title) { toast("Informe o título."); throw 0; }
      const contactId = val("f-contact") || null;
      const months = numOrNull(val("f-months"));
      const start = val("f-start") || null;
      await save("programs", {
        title, objective: val("f-objective"), description: val("f-desc"), status: val("f-status"), contact_id: contactId,
        start_date: start, end_date: (start && months) ? addMonths(start, months) : (p.end_date || null),
        contract_months: months, meeting_frequency: val("f-freq") || null,
        total_value: numOrNull(val("f-value")) || 0, is_billed: $("#f-billed").checked, payment_method: val("f-pay") || null,
      }, p.id);
      if (contactId) await save("contacts", { is_mentee: true }, contactId);
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
      ${p.meeting_frequency ? `<div><div class="lbl">Frequência</div><div class="v" style="text-transform:capitalize">${esc(p.meeting_frequency)}</div></div>` : ""}
      <div><div class="lbl">Valor total</div><div class="v">${money(p.total_value)}</div></div>
      ${p.is_billed ? `<div><div class="lbl">Contrato</div><div class="v">${p.contract_months || "?"} meses · ${p.installments || "?"}x${p.payment_method ? " · " + esc(p.payment_method) : ""}</div></div>` : ""}
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
const STATUS_MEET = ["a_agendar", "agendado", "realizado", "cancelado", "remarcado"];
const MEET_LABEL = { a_agendar: "a agendar", agendado: "agendado", realizado: "realizado", cancelado: "cancelado", remarcado: "remarcado" };
const fmtSize = (n) => !n ? "" : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;

async function renderMeetings() {
  const c = $("#pd-content");
  const [{ data }, { data: atts }] = await Promise.all([
    supa.from("meetings").select("*").eq("program_id", state.currentProgram.id)
      .order("seq", { ascending: true, nullsFirst: false }).order("scheduled_at", { ascending: true, nullsFirst: false }),
    supa.from("attachments").select("meeting_id").eq("program_id", state.currentProgram.id),
  ]);
  const attCount = {}; (atts || []).forEach((a) => attCount[a.meeting_id] = (attCount[a.meeting_id] || 0) + 1);
  const total = (data || []).length, done = (data || []).filter((m) => m.status === "realizado").length;
  c.innerHTML = sechdr(null, "Encontros & observações", "add-meet", "+ Encontro") +
    (total ? `<div class="muted" style="font-size:12px;margin:-4px 0 10px">${done} de ${total} realizados</div>` + data.map((m) => `
      <div class="li" style="align-items:flex-start">
        <div class="linfo"><div class="lname">${esc(m.topic || "Encontro")} <span class="muted" style="font-weight:400">· ${m.scheduled_at ? fmtDateTime(m.scheduled_at) : "sem agenda"}</span></div>
          ${m.key_points ? `<div class="lsub" style="white-space:pre-wrap;overflow:visible"><strong>Pontos:</strong> ${esc(m.key_points)}</div>` : ""}
          ${m.action_items ? `<div class="lsub" style="white-space:pre-wrap;overflow:visible"><strong>Próximos passos:</strong> ${esc(m.action_items)}</div>` : ""}
          ${m.notes ? `<div class="lsub" style="white-space:pre-wrap;overflow:visible">${esc(m.notes)}</div>` : ""}
          <div class="lsub">${m.duration_min || 60} min${attCount[m.id] ? ` · ${attCount[m.id]} anexo(s)` : ""}</div></div>
        <div class="lright" style="align-items:flex-end;flex-direction:column">${badge(m.status)}
          <div class="row" style="gap:2px">
            ${m.status === "a_agendar" ? `<button class="bicon" data-edit="${m.id}" title="Agendar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></button>` : `<button class="bicon" data-edit="${m.id}">${ICON.edit}</button>`}
            <button class="bicon danger" data-del="${m.id}">${ICON.trash}</button></div></div>
      </div>`).join("") : emptyState("Nenhum encontro registrado."));
  $("#add-meet").onclick = () => meetingForm();
  $$("[data-edit]", c).forEach((b) => b.onclick = () => meetingForm((data || []).find((m) => m.id === b.dataset.edit)));
  $$("[data-del]", c).forEach((b) => b.onclick = async () => { if (confirm("Excluir este encontro?")) { await remove("meetings", b.dataset.del); toast("Encontro excluído."); renderMeetings(); } });
}

/* ---------- anexos ---------- */
async function uploadMeetingFile(file, meetingId) {
  const safe = file.name.replace(/[^\w.\-]/g, "_");
  const path = `${state.companyId}/${meetingId}/${Date.now()}_${safe}`;
  const { error } = await supa.storage.from("attachments").upload(path, file);
  if (error) { toast("Falha no upload: " + error.message); return; }
  const { error: e2 } = await supa.from("attachments").insert({ user_id: state.user.id, company_id: state.companyId || null, meeting_id: meetingId, program_id: state.currentProgram?.id || null, file_name: file.name, file_path: path, mime_type: file.type, size_bytes: file.size });
  if (e2) toast("Falha ao registrar anexo: " + e2.message);
}
async function openAttachment(path) {
  const { data, error } = await supa.storage.from("attachments").createSignedUrl(path, 120);
  if (error) { toast("Não foi possível abrir o anexo."); return; }
  window.open(data.signedUrl, "_blank");
}
async function renderMeetingAttachments(meetingId) {
  const wrap = $("#att-list"); if (!wrap) return;
  const { data } = await supa.from("attachments").select("*").eq("meeting_id", meetingId).order("created_at");
  wrap.innerHTML = (data || []).length ? (data || []).map((a) => `
    <div class="att-row">
      <span class="att-name" data-open="${esc(a.file_path)}" title="Abrir">${esc(a.file_name || "arquivo")}</span>
      <span class="att-size">${fmtSize(a.size_bytes)}</span>
      <button class="bicon danger" data-adel="${a.id}" data-apath="${esc(a.file_path)}">${ICON.trash}</button>
    </div>`).join("") : `<div class="muted" style="font-size:12px">Nenhum anexo ainda.</div>`;
  $$("[data-open]", wrap).forEach((el) => el.onclick = () => openAttachment(el.dataset.open));
  $$("[data-adel]", wrap).forEach((b) => b.onclick = async () => { if (confirm("Excluir este anexo?")) { await supa.storage.from("attachments").remove([b.dataset.apath]); await supa.from("attachments").delete().eq("id", b.dataset.adel); renderMeetingAttachments(meetingId); } });
}

function meetingForm(m = {}) {
  const dtVal = m.scheduled_at ? new Date(m.scheduled_at).toISOString().slice(0, 16) : "";
  const curStatus = m.status || (m.id ? "agendado" : "a_agendar");
  openModal({
    title: m.id ? "Encontro — agenda, pontos e anexos" : "Novo encontro", wide: true,
    body: `<div class="grid-2">${field("Tema", `<input id="f-topic" value="${esc(m.topic || "")}">`)}
        ${field("Status", `<select id="f-status">${STATUS_MEET.map((s) => `<option value="${s}" ${s === curStatus ? "selected" : ""}>${MEET_LABEL[s]}</option>`).join("")}</select>`)}</div>
      <div class="grid-2">${field("Data e hora (agenda)", `<input id="f-dt" type="datetime-local" value="${dtVal}">`)}
        ${field("Duração (min)", `<input id="f-dur" type="number" value="${esc(m.duration_min || 60)}">`)}</div>
      ${field("Pontos relevantes", `<textarea id="f-key" style="min-height:90px" placeholder="O que foi discutido, decisões, insights...">${esc(m.key_points || "")}</textarea>`)}
      ${field("Compromissos & próximos passos", `<textarea id="f-action" style="min-height:70px" placeholder="Tarefas e combinados para o próximo encontro.">${esc(m.action_items || "")}</textarea>`)}
      ${field("Observações gerais", `<textarea id="f-notes" style="min-height:60px">${esc(m.notes || "")}</textarea>`)}
      ${m.id ? `<div class="divider"></div><label class="fl">Anexos (PDF, imagens...)</label>
        <input type="file" id="att-file" multiple style="font-size:13px;margin-bottom:8px">
        <div id="att-list"></div>` : `<div class="muted" style="font-size:12px;margin-top:8px">Salve o encontro para poder anexar arquivos.</div>`}`,
    onSave: async () => {
      const dt = val("f-dt");
      let status = val("f-status");
      if (dt && status === "a_agendar") status = "agendado";
      await save("meetings", { program_id: state.currentProgram.id, scheduled_at: dt ? new Date(dt).toISOString() : null, duration_min: numOrNull(val("f-dur")) || 60, topic: val("f-topic"), key_points: val("f-key"), action_items: val("f-action"), notes: val("f-notes"), status, seq: m.seq ?? null }, m.id);
      toast("Encontro salvo."); renderMeetings();
    },
  });
  if (m.id) {
    renderMeetingAttachments(m.id);
    $("#att-file").onchange = async (e) => {
      const files = [...e.target.files]; if (!files.length) return;
      toast("Enviando anexo(s)…");
      for (const f of files) await uploadMeetingFile(f, m.id);
      e.target.value = "";
      renderMeetingAttachments(m.id);
      toast("Anexo(s) enviado(s).");
    };
  }
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

/* ===================================================================
   ADMIN (só super admin) — Empresas e Usuários
   =================================================================== */
const MODULES = [["contacts", "Contatos"], ["programs", "Mentorias"], ["evaluations", "Avaliações"], ["billings", "Faturamento"]];
function renderAdmin() {
  const v = $("#view-admin");
  v.innerHTML = `<div class="sechdr"><div><div class="eyebrow">Administração</div><span class="sectitle">Admin</span></div></div>
    <div class="tabs"><button class="tab active" data-atab="empresas">Empresas</button>
      <button class="tab" data-atab="usuarios">Usuários</button></div>
    <div id="admin-content"></div>`;
  $$(".tab", v).forEach((b) => b.onclick = () => { $$(".tab", v).forEach((x) => x.classList.toggle("active", x === b)); (b.dataset.atab === "empresas" ? renderAdminCompanies : renderAdminUsers)(); });
  renderAdminCompanies();
}
async function loadCompanies() { const { data } = await supa.from("companies").select("*").order("name"); state.companies = data || []; return state.companies; }

async function renderAdminCompanies() {
  const c = $("#admin-content");
  const [companies, { data: profiles }] = await Promise.all([loadCompanies(), supa.from("profiles").select("company_id")]);
  const counts = {}; (profiles || []).forEach((p) => { if (p.company_id) counts[p.company_id] = (counts[p.company_id] || 0) + 1; });
  c.innerHTML = sechdr(null, "Empresas", "add-company", "+ Nova empresa") +
    (companies.length ? companies.map((co) => `
      <div class="li">
        ${co.logo_url ? `<img src="${esc(co.logo_url)}" alt="" style="width:34px;height:34px;border-radius:8px;object-fit:cover">` : `<div class="av ${avClass(co.name)}">${esc(ini(co.name))}</div>`}
        <div class="linfo"><div class="lname">${esc(co.name)}</div>
          <div class="lsub">${counts[co.id] || 0} / ${co.max_users} usuários</div></div>
        <div class="lright"><button class="bicon" data-cedit="${co.id}">${ICON.edit}</button></div>
      </div>`).join("") : emptyState("Nenhuma empresa cadastrada."));
  $("#add-company").onclick = () => companyForm();
  $$("[data-cedit]", c).forEach((b) => b.onclick = () => companyForm(companies.find((x) => x.id === b.dataset.cedit)));
}
function companyForm(co = {}) {
  openModal({
    title: co.id ? "Editar empresa" : "Nova empresa",
    body: `${field("Nome da empresa", `<input id="f-cname" value="${esc(co.name || "")}">`)}
      ${field("Limite de usuários", `<input id="f-cmax" type="number" min="1" value="${esc(co.max_users ?? 5)}">`)}
      ${field("Logomarca", `<input id="f-logo" type="file" accept="image/*">`)}
      ${co.logo_url ? `<img src="${esc(co.logo_url)}" alt="" style="max-height:60px;border-radius:8px;margin-top:4px">` : ""}`,
    onSave: async () => {
      const name = val("f-cname"); if (!name) { toast("Informe o nome."); throw 0; }
      const max = numOrNull(val("f-cmax")) || 5;
      let id = co.id;
      if (id) { const { error } = await supa.from("companies").update({ name, max_users: max }).eq("id", id); if (error) { toast(error.message); throw 0; } }
      else { const { data, error } = await supa.from("companies").insert({ name, max_users: max, created_by: state.user.id }).select().single(); if (error) { toast(error.message); throw 0; } id = data.id; }
      const f = $("#f-logo").files[0];
      if (f) {
        const path = `${id}/logo_${Date.now()}`;
        const { error: upErr } = await supa.storage.from("logos").upload(path, f, { upsert: true });
        if (upErr) toast("Logo não enviada: " + upErr.message);
        else { const { data: pub } = supa.storage.from("logos").getPublicUrl(path); await supa.from("companies").update({ logo_url: pub.publicUrl }).eq("id", id); }
      }
      toast("Empresa salva."); renderAdminCompanies();
    },
  });
}

async function renderAdminUsers() {
  const c = $("#admin-content");
  await loadCompanies();
  const [{ data: profiles }, { data: invites }] = await Promise.all([
    supa.from("profiles").select("*, companies(name)").order("created_at"),
    supa.from("invites").select("*, companies(name)").eq("accepted", false).order("created_at"),
  ]);
  const permSummary = (p) => p.role === "super_admin" ? "Acesso total" : p.role === "admin" ? "Admin da empresa" : MODULES.filter((m) => (p.permissions || {})[m[0]]).map((m) => m[1]).join(", ") || "Sem telas liberadas";
  c.innerHTML = sechdr(null, "Usuários", "add-user", "+ Novo usuário") +
    ((profiles || []).map((p) => `
      <div class="li" style="align-items:flex-start">
        <div class="av ${avClass(p.full_name || p.email)}">${esc(ini(p.full_name || p.email))}</div>
        <div class="linfo"><div class="lname">${esc(p.full_name || p.email)} ${p.role === "super_admin" ? '<span class="bdg bb">super admin</span>' : ""}</div>
          <div class="lsub">${esc(p.email)}${p.companies?.name ? " · " + esc(p.companies.name) : ""}</div>
          <div class="lsub">${esc(permSummary(p))}</div></div>
        <div class="lright">${p.role === "super_admin" ? "" : `<button class="bicon" data-uedit="${p.id}">${ICON.edit}</button>`}</div>
      </div>`).join("") +
    ((invites || []).length ? `<div class="sechdr" style="margin-top:16px"><span class="sectitle">Convites pendentes</span></div>` +
      invites.map((iv) => `<div class="li" style="align-items:flex-start">
        <div class="av ${avClass(iv.email)}">${esc(ini(iv.full_name || iv.email))}</div>
        <div class="linfo"><div class="lname">${esc(iv.full_name || iv.email)} <span class="bdg ba">aguardando 1º acesso</span></div>
          <div class="lsub">${esc(iv.email)}${iv.companies?.name ? " · " + esc(iv.companies.name) : ""}</div></div>
        <div class="lright"><button class="bicon danger" data-idel="${iv.id}">${ICON.trash}</button></div>
      </div>`).join("") : "") ||
    emptyState("Nenhum usuário ainda."));
  $("#add-user").onclick = () => userForm();
  $$("[data-uedit]", c).forEach((b) => b.onclick = () => editProfileForm((profiles || []).find((p) => p.id === b.dataset.uedit)));
  $$("[data-idel]", c).forEach((b) => b.onclick = async () => { if (confirm("Cancelar este convite?")) { await supa.from("invites").delete().eq("id", b.dataset.idel); toast("Convite cancelado."); renderAdminUsers(); } });
}
const companyOpts = (sel) => state.companies.map((co) => `<option value="${co.id}" ${co.id === sel ? "selected" : ""}>${esc(co.name)}</option>`).join("");
const permChecks = (perms = {}) => MODULES.map((m) => `<label class="ckline"><input type="checkbox" class="perm" data-perm="${m[0]}" ${perms[m[0]] ? "checked" : ""}> ${esc(m[1])}</label>`).join("");
function collectPerms() { const o = {}; $$(".perm").forEach((cb) => o[cb.dataset.perm] = cb.checked); return o; }

function userForm() {
  openModal({
    title: "Novo usuário", wide: true,
    body: `<p class="muted" style="font-size:12px;margin-bottom:12px">O usuário define a própria senha no primeiro acesso, usando este e-mail.</p>
      <div class="grid-2">${field("Nome", `<input id="f-uname" value="">`)}
        ${field("E-mail", `<input id="f-uemail" type="email" value="">`)}</div>
      <div class="grid-2">${field("Empresa", `<select id="f-ucompany">${companyOpts(state.companyId)}</select>`)}
        ${field("Papel", `<select id="f-urole"><option value="user">Usuário</option><option value="admin">Admin da empresa</option></select>`)}</div>
      ${field("Telas liberadas", `<div>${permChecks({})}</div>`)}`,
    onSave: async () => {
      const email = val("f-uemail"); if (!email) { toast("Informe o e-mail."); throw 0; }
      const { error } = await supa.from("invites").upsert({
        email: email.toLowerCase(), full_name: val("f-uname"), company_id: val("f-ucompany") || null,
        role: val("f-urole"), permissions: collectPerms(), created_by: state.user.id, accepted: false,
      }, { onConflict: "email" });
      if (error) { toast(error.message); throw 0; }
      toast("Usuário cadastrado. Ele define a senha no 1º acesso."); renderAdminUsers();
    },
  });
}
function editProfileForm(p) {
  openModal({
    title: "Editar usuário", wide: true,
    body: `${field("Nome", `<input id="f-uname" value="${esc(p.full_name || "")}">`)}
      <div class="grid-2">${field("Empresa", `<select id="f-ucompany">${companyOpts(p.company_id)}</select>`)}
        ${field("Papel", `<select id="f-urole"><option value="user" ${p.role === "user" ? "selected" : ""}>Usuário</option><option value="admin" ${p.role === "admin" ? "selected" : ""}>Admin da empresa</option></select>`)}</div>
      ${field("Telas liberadas", `<div>${permChecks(p.permissions || {})}</div>`)}
      <label class="ckline"><input type="checkbox" id="f-active" ${p.is_active ? "checked" : ""}> Usuário ativo</label>`,
    onSave: async () => {
      const { error } = await supa.from("profiles").update({
        full_name: val("f-uname"), company_id: val("f-ucompany") || null,
        role: val("f-urole"), permissions: collectPerms(), is_active: $("#f-active").checked,
      }).eq("id", p.id);
      if (error) { toast(error.message); throw 0; }
      toast("Usuário atualizado."); renderAdminUsers();
    },
  });
}

/* ---------- boot ---------- */
function setVersion() { try { $$(".ver-badge").forEach((e) => { e.textContent = "v" + APP_VERSION; e.title = "Versão " + APP_VERSION; }); } catch (_) {} }
console.log("%cMentoria app.js v" + APP_VERSION, "font-weight:bold");
setVersion();
(async () => {
  showLoading();
  const { data } = await supa.auth.getSession();
  if (data.session?.user) onLogin(data.session.user);
  else { A.app.classList.add("hidden"); A.screen.classList.remove("hidden"); hideLoading(); }
})();
