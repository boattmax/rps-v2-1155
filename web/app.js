// app.js — header (fixed order)
const CFG = window.CFG;
// ===== Preferences (persist) =====
const PREF = {
  dark: "rps_pref_dark",
  auto: "rps_pref_auto",
  sfx:  "rps_pref_sfx",
  lang: "rps_pref_lang",
  fMine: "rps_pref_filter_mine",
  fJoin: "rps_pref_filter_join",
  lastCreateAt: "rps_last_create_at",
};
// LS helpers
function lsBool(k, def=false){ try{ const v=localStorage.getItem(k); return v===null?def:(v==="1"); }catch(_){return def;} }
function lsStr(k, def=""){ try{ const v=localStorage.getItem(k); return v===null?def:v; }catch(_){return def;} }
function lsSet(k, v){ try{ localStorage.setItem(k, v); }catch(_){} }

// ===== Anti-spam: create limits =====
const MAX_OPEN_OWNED = 3;          // จำกัดห้องเปิดค้างที่เราสร้าง
const CREATE_COOLDOWN_MS = 30_000; // 30s
let lastCreateAt = Number(lsStr(PREF.lastCreateAt, "0")) || 0;


async function countMyOpenMatches(scan=300){
  if (!GAME || !me) return 0;
  const meL = me.toLowerCase();
  const n = Number(await GAME.nextMatchId());
  const from = Math.max(0, n - scan);
  let c = 0;
  for (let i=from;i<n;i++){
    const m = await GAME.matches(i);
    const mine = String(m.p1).toLowerCase() === meL;
    if (mine && !m.resolved && String(m.p2) === ZERO) c++;
  }
  return c;
}

const log = (m)=>document.getElementById('log').textContent += m + "\n";
log("RPS Web UI v9-rt loaded");

let myBal = {1:0,2:0,3:0,4:0,5:0,6:0};
const metaCache = {}; // {id: {url,name}}

function isRare(id){ return id>=4 && id<=6 }

async function refreshBalancesQuick(){
  const ids=[1,2,3,4,5,6], acc=ids.map(()=>me);
  const bal = await NFT.balanceOfBatch(acc, ids);
  ids.forEach((id,i)=> myBal[id]=Number(bal[i]));
}

async function getMeta(id){
  if (metaCache[id]) return metaCache[id];
  const raw = await NFT.uri(id);
  const meta = await fetchJsonFromIpfs(raw);
  const url  = ipfsToHttp(meta.image || meta.image_url || meta.imageURI || "");
  const name = (typeof kindLabel === "function") ? kindLabel(id) : `#${id}`;
  metaCache[id] = { url, name };
  return metaCache[id];
}

const NFT_ABI = [
  "function balanceOf(address account,uint256 id) view returns (uint256)",
  "function balanceOfBatch(address[] accounts,uint256[] ids) view returns (uint256[])",
  "function setApprovalForAll(address operator,bool approved)",
  "function isApprovedForAll(address account,address operator) view returns (bool)",
  "function uri(uint256 id) view returns (string)"
];

const GAME_ABI = [
  "function nextMatchId() view returns (uint256)",
  "function matches(uint256) view returns (address p1,uint256 t1,address p2,uint256 t2,bool resolved,address winner)",
  "function createMatch(uint256 tokenId) returns (uint256)",
  "function joinMatch(uint256 id,uint256 tokenId)",
  "function cancelMatch(uint256 id)"
];

let provider, signer, me, NFT, GAME;

let currentLang = 'th';
const i18n = {
  th: {
    connect: "🔌 เชื่อมต่อกระเป๋า",
    approve: "✅ อนุมัติให้เกมใช้การ์ด",
    balances: "📊 ดูยอดการ์ด",
    showCards: "🖼️ ดูการ์ดของฉัน",
    listOpen: "📜 ห้องที่กำลังรอ",
    myStats: "🏆 สถิติของฉัน",
    create: "สร้าง",
    join: "เข้าร่วม",
    inspect: "ตรวจสอบ",
    waiting: "รอผู้ท้าชิง…",
    yours: "ของคุณ",
    joinNow: "Join",
    canceled: "ยกเลิกแมตช์แล้ว",
    autoOn: "🔁 Auto: ON",
    autoOff: "🔁 Auto: OFF",
    darkOn: "🌗 Dark: ON",
    darkOff: "🌗 Dark: OFF",
    th: "🇹🇭/🇬🇧 TH",
    en: "🇹🇭/🇬🇧 EN",
    toastWin: "คุณชนะ! ได้การ์ดของคู่ต่อสู้เพิ่ม ✨",
    toastLose: "คุณแพ้… การ์ดถูกส่งให้คู่ต่อสู้",
    toastTie: "เสมอ! ทั้งสองฝ่ายได้การ์ดคืน",
    someoneJoined: id => `มีคนเข้าร่วมแมตช์ของคุณ #${id}`,
    exported: "บันทึกประวัติเป็น CSV แล้ว",
  },
  en: {
    connect: "🔌 Connect Wallet",
    approve: "✅ Approve Game",
    balances: "📊 Show Balances",
    showCards: "🖼️ Show My Cards",
    listOpen: "📜 List Open Matches",
    myStats: "🏆 My Stats",
    create: "Create",
    join: "Join",
    inspect: "Inspect",
    waiting: "Waiting for opponent…",
    yours: "YOURS",
    joinNow: "Join",
    canceled: "Match canceled",
    autoOn: "🔁 Auto: ON",
    autoOff: "🔁 Auto: OFF",
    darkOn: "🌗 Dark: ON",
    darkOff: "🌗 Dark: OFF",
    th: "🇹🇭/🇬🇧 TH",
    en: "🇹🇭/🇬🇧 EN",
    toastWin: "You WIN! You received opponent's card ✨",
    toastLose: "You lose… Your card went to the opponent",
    toastTie: "Tie! Both cards returned",
    someoneJoined: id => `Someone joined your match #${id}`,
    exported: "Exported CSV",
  }
};

// ==== Realtime UI state & helpers (ADD THIS) ====
let realtimeOn = true;   // ค่าเริ่มต้นเปิด Realtime

function getRtInterval() {
  const el = document.getElementById('rtSpeed');
  const v = el ? Number(el.value) : 6000;
  return Number.isFinite(v) && v > 0 ? v : 6000;  // default 6s
}

function setRealtimeUI() {
  const b = document.getElementById('btnRealtime');
  if (b) b.textContent = realtimeOn ? "🔔 Realtime: ON" : "🔕 Realtime: OFF";
}

// --- persist realtime prefs ---
const LS_KEYS = { rtOn: "rps_rt_on", rtMs: "rps_rt_ms" };

function loadRtPrefs() {
  try {
    const vOn = localStorage.getItem(LS_KEYS.rtOn);
    if (vOn !== null) realtimeOn = vOn === "1";
    const vMs = localStorage.getItem(LS_KEYS.rtMs);
    const sel = document.getElementById("rtSpeed");
    if (vMs && sel) sel.value = vMs;
  } catch (_) {}
  setRealtimeUI();
}

function saveRtPrefs() {
  try {
    localStorage.setItem(LS_KEYS.rtOn, realtimeOn ? "1" : "0");
    const sel = document.getElementById("rtSpeed");
    if (sel) localStorage.setItem(LS_KEYS.rtMs, sel.value);
  } catch (_) {}
}

function applySavedPrefs(){
  // Dark
  const darkOn = lsBool(PREF.dark, false);
  document.body.classList.toggle('dark', darkOn);

  // Auto
  autoOn = lsBool(PREF.auto, false);

  // SFX
  sfxOn = lsBool(PREF.sfx, true);

  // Lang
  const savedLang = lsStr(PREF.lang, currentLang);
  currentLang = (savedLang === 'th' || savedLang === 'en') ? savedLang : 'th';

  // Filters
  const fm = document.getElementById('filterMine');
  const fj = document.getElementById('filterJoinable');
  if (fm) fm.checked = lsBool(PREF.fMine, false);
  if (fj) fj.checked = lsBool(PREF.fJoin, false);
}

function saveFilterPrefs(){
  const fm = document.getElementById('filterMine');
  const fj = document.getElementById('filterJoinable');
  if (fm) lsSet(PREF.fMine, fm.checked ? "1" : "0");
  if (fj) lsSet(PREF.fJoin, fj.checked ? "1" : "0");
}


function rebindUI(){
  const bind = (id, h) => { const el = document.getElementById(id); if (el) el.onclick = h; };

  // — main buttons —
  bind("btnConnect",  connect);
  bind("btnApprove",  () => approveGame().catch(e=>log(e.message)));
  bind("btnBalances", () => showBalances().catch(e=>log(e.message)));
  bind("btnShowCards",() => showMyCards().catch(e=>log(e.message)));
  bind("btnListOpen", () => { saveFilterPrefs(); listOpenMatches().catch(e=>log(e.message)); });
  bind("btnMyStats",  () => myStats().catch(e=>log(e.message)));

  // export
  bind("btnExport",     () => exportMyHistory("csv").catch(e=>log(e.message||e)));
  bind("btnExportCSV",  () => exportMyHistory("csv").catch(e=>log(e.message||e)));
  bind("btnExportJSON", () => exportMyHistory("json").catch(e=>log(e.message||e)));

  // network
  bind("btnSwitchNet", () => switchToTarget().catch(e => log(e.message||String(e))));

  // create / join / inspect
  bind("btnCreate",  () => createMatch().catch(e => log(e.message || e)));
  bind("btnJoin",    () => joinMatch().catch(e=>log(e.message)));
  bind("btnInspect", () => {
    const el = document.getElementById("im_id") || document.getElementById("inspect_id");
    const v = Number((el && el.value) || 0);
    if (v >= 0) openInspectDialog(v);
  });

  // filters — ใช้ onchange (ไม่ต้อง bind onclick ซ้ำ)
  const fm = document.getElementById('filterMine');
  const fj = document.getElementById('filterJoinable');
  if (fm && !fm._wired){ fm.onchange = ()=>{ saveFilterPrefs(); listOpenMatches(); }; fm._wired = true; }
  if (fj && !fj._wired){ fj.onchange = ()=>{ saveFilterPrefs(); listOpenMatches(); }; fj._wired = true; }

  // dark / lang
  const btnDark = document.getElementById("btnDark");
  if (btnDark){
    btnDark.onclick = () => {
      document.body.classList.toggle('dark');
      lsSet(PREF.dark, document.body.classList.contains('dark') ? "1" : "0");
      applyLang && applyLang();
    };
  }
  const btnLang = document.getElementById("btnLang");
  if (btnLang){
    btnLang.onclick = () => {
      currentLang = (currentLang==='th')?'en':'th';
      lsSet(PREF.lang, currentLang);
      applyLang && applyLang();
    };
  }

  // auto
  const btnAuto = document.getElementById("btnAuto");
  if (btnAuto){ btnAuto.onclick = () => toggleAuto(true); } // true = save pref

  // sfx (ผูกที่นี่ที่เดียวพอ)
  const sfxBtn = document.getElementById("btnSfx");
  if (sfxBtn && !sfxBtn._wired) {
    sfxBtn.onclick = () => {
      sfxOn = !sfxOn;
      lsSet(PREF.sfx, sfxOn ? "1" : "0");
      sfxBtn.textContent = sfxOn ? "🔊 SFX: ON" : "🔈 SFX: OFF";
    };
    sfxBtn._wired = true;
  }

  // realtime controls (ย้ายเข้ามาอยู่ใน rebindUI)
  const rtBtn = document.getElementById('btnRealtime');
  if (rtBtn && !rtBtn._wired) {
    rtBtn.onclick = () => {
      realtimeOn = !realtimeOn;
      setRealtimeUI();
      saveRtPrefs();
      if (realtimeOn) startWatch(getRtInterval());
      else stopWatch();
    };
    rtBtn._wired = true;
  }
  const speed = document.getElementById('rtSpeed');
  if (speed && !speed._wired) {
    speed.onchange = () => {
      saveRtPrefs();
      if (realtimeOn) startWatch(getRtInterval());
    };
    speed._wired = true;
  }

  // โหลด prefs ทั้งหมด + sync UI labels
  applySavedPrefs();   // dark/auto/sfx/lang/filters
  loadRtPrefs();       // realtime on/off + ความถี่
  setRealtimeUI();     // อัปเดตปุ่ม Realtime ให้ตรงสถานะ
  applyLang && applyLang();
}
document.addEventListener("DOMContentLoaded", rebindUI);


window.myStats = window.myStats || (async ()=>{});

// Join จากแถวในตาราง โดยใช้ Token ID จากช่อง Join Match (jm_token)
async function joinFromTable(id){
  try {
    if (!GAME) { showToast && showToast("Not connected", "error"); return; }
    const tokEl = document.getElementById("jm_token");
    if (!tokEl) { showToast && showToast("Join form missing", "error"); return; }
    const tokenId = Number(tokEl.value || 0);
    if (!(tokenId >= 1 && tokenId <= 6)) {
      showToast && showToast("กรุณาใส่ Token ID (1..6) ก่อน", "error"); return;
    }
    await requireNetworkOrThrow();
    const tx = await GAME.joinMatch(id, tokenId);
    log("join tx: " + tx.hash);
    await tx.wait();
    showToast && showToast(`Joined match #${id}`, "success");
    await listOpenMatches();
    await refreshInventory();
    await announceOutcome(id); // ประกาศผล + SFX
  } catch (e) {
    showToast && showToast(e.reason || e.message || String(e), "error", 3500);
  }
}

async function openJoinDialog(matchId){
  try{
    const modal   = document.getElementById('joinModal');
    const grid    = document.getElementById('joinGrid');
    const hint    = document.getElementById('joinHint');
    const headNo  = document.getElementById('joinMatchNo');
    const closeBt = document.getElementById('joinClose');

    if (!modal || !grid) return;

    headNo && (headNo.textContent = `#${matchId}`);
    grid.innerHTML = `<div class="muted">Loading...</div>`;
    hint.textContent = "";

    // เปิดโมดัล + กันสกรอลล์พื้นหลัง
    modal.classList.remove('hidden');
    document.body.classList.add('no-scroll');

    // ปิดด้วยปุ่ม X, คลิกพื้นหลัง, หรือกด ESC
    const closeModal = ()=>{
      modal.classList.add('hidden');
      document.body.classList.remove('no-scroll');
      modal.onclick = null; document.removeEventListener('keydown', escHandler);
    };
    const escHandler = (e)=>{ if(e.key==='Escape') closeModal(); };
    if (closeBt && !closeBt._wired){ closeBt.onclick = closeModal; closeBt._wired = true; }
    modal.onclick = (e)=>{ if(e.target === modal) closeModal(); };
    document.addEventListener('keydown', escHandler);

    // ดึงข้อมูลแมตช์ + กำหนดกลุ่มการ์ด
    const m = await GAME.matches(matchId);
    const rareGroup = Number(m.t1) >= 4;          // 4..6 = Rare, 1..3 = Normal
    const allowed   = rareGroup ? [4,5,6] : [1,2,3];

    // ดูจำนวนการ์ดที่เรามีในกลุ่มนั้น
    const accounts = allowed.map(()=>me);
    const bals     = await NFT.balanceOfBatch(accounts, allowed);

    // โหลดรูปจาก metadata
    const items = [];
    for (let i=0;i<allowed.length;i++){
      const id = allowed[i];
      const amount = Number(bals[i]);
      let img = null;
      try{
        const uri  = await NFT.uri(id);
        const meta = await fetchJsonFromIpfs(uri);
        img = ipfsToHttp(meta.image || meta.image_url || meta.imageURI || "");
      }catch(_){}
      items.push({ id, amount, img });
    }

    const canPlay = items.some(x => x.amount > 0);
    grid.innerHTML = items.map(it => `
      <div class="join-card ${it.amount>0?'':'disabled'}" data-id="${it.id}">
        ${it.img?`<img src="${it.img}" alt="#${it.id}">`:`<div style="height:180px"></div>`}
        <div style="margin-top:6px;display:flex;justify-content:space-between;align-items:center">
          <div>#${it.id} ${kindLabel(it.id)}</div>
          <span class="badge">x${it.amount}</span>
        </div>
      </div>
    `).join("");

    hint.textContent = canPlay ? "เลือกการ์ด 1 ใบเพื่อเข้าร่วม" : "คุณไม่มีการ์ดในกลุ่มนี้เพียงพอ";

    // คลิกเลือกการ์ดแล้ว join
    for (const el of grid.querySelectorAll('.join-card')) {
      el.onclick = async ()=>{
        const tokenId = Number(el.getAttribute('data-id'));
        try{
          await requireNetworkOrThrow();
          const tx = await GAME.joinMatch(matchId, tokenId);
          log('join tx: '+tx.hash);
          await tx.wait();
          showToast && showToast(`Joined match #${matchId} with card #${tokenId}`, 'success');
          closeModal();
          await listOpenMatches();
          await refreshInventory();
          await announceOutcome(matchId); // ประกาศผล + SFX
        }catch(e){
          showToast && showToast(e.reason || e.message || String(e), 'error', 3500);
        }
      };
    }
  }catch(e){
    showToast && showToast(e.message || String(e), 'error', 3500);
    console.error(e);
  }
}

// ---------- utils ----------
function shortAddr(a){ return a ? (a.slice(0,6) + "…" + a.slice(-4)) : "-"; }
function labelStatus(m){
  if (m.resolved) return "RESOLVED";
  if (String(m.p2).toLowerCase() === String(ZERO).toLowerCase()) return "OPEN";
  return "IN-PROGRESS";
}

async function openInspectDialog(matchId){
  const modal  = document.getElementById('inspectModal');
  const body   = document.getElementById('insBody');
  const headNo = document.getElementById('insMatchNo');
  const btnX   = document.getElementById('insClose');
  if (!modal || !body) return;

  modal.classList.remove('hidden');
  document.body.classList.add('no-scroll');
  headNo && (headNo.textContent = `#${matchId}`);
  body.innerHTML = `<div class="muted">Loading…</div>`;

  const close = ()=>{
    modal.classList.add('hidden');
    document.body.classList.remove('no-scroll');
    modal.onclick = null; document.removeEventListener('keydown', esc);
  };
  const esc = (e)=>{ if(e.key==='Escape') close(); };
  if (btnX && !btnX._wired){ btnX.onclick = close; btnX._wired = true; }
  modal.onclick = (e)=>{ if(e.target === modal) close(); };
  document.addEventListener('keydown', esc);

  try{
    const m = await GAME.matches(matchId);
    const status = labelStatus(m);

    // ผู้ชนะ (ไม่เปิดเผย token)
    let winnerLabel = "-";
    if (m.resolved){
      if (String(m.winner) === String(ZERO)) winnerLabel = "TIE";
      else if (String(m.winner).toLowerCase() === String(m.p1).toLowerCase()) winnerLabel = "P1";
      else if (String(m.winner).toLowerCase() === String(m.p2).toLowerCase()) winnerLabel = "P2";
      else winnerLabel = shortAddr(m.winner);
    }

    const rareGroup = Number(m.t1 ?? 0) >= 4; // ใช้เพื่อบอกกลุ่มเท่านั้น
    const groupText = rareGroup ? "RARE (4–6)" : "NORMAL (1–3)";

    body.innerHTML = `
      <div style="display:grid;grid-template-columns:160px 1fr;gap:12px;">
        <div class="muted">Status</div><div><span class="badge ${status==='RESOLVED'?'win':(status==='OPEN'?'tie':'lose')}">${status}</span></div>
        <div class="muted">P1</div><div title="${m.p1}">${shortAddr(String(m.p1))}</div>
        <div class="muted">P2</div><div title="${m.p2}">${String(m.p2).toLowerCase()===String(ZERO).toLowerCase() ? '-' : shortAddr(String(m.p2))}</div>
        <div class="muted">Group</div><div>${groupText}</div>
        <div class="muted">Winner</div><div>${winnerLabel}</div>
      </div>

      <div style="margin-top:14px;display:flex;gap:8px;">
        <button id="insJoin" ${status!=='OPEN'?'disabled':''}>Join This Match</button>
        <button id="insCancel" ${status==='OPEN' && m.p1 && me && (String(m.p1).toLowerCase()===me.toLowerCase()) ? '' : 'disabled'}>Cancel (owner)</button>
      </div>
    `;

    const btnJoin = document.getElementById('insJoin');
    if (btnJoin){
      btnJoin.onclick = ()=>{ close(); if (typeof openJoinDialog === 'function') openJoinDialog(matchId); };
    }
    const btnCancel = document.getElementById('insCancel');
    if (btnCancel){
      btnCancel.onclick = async ()=>{
        try{
          await requireNetworkOrThrow();
          const tx = await GAME.cancelMatch(matchId);
          log("cancel tx: "+tx.hash);
          await tx.wait();
          showToast && showToast("Canceled", "info");
          close();
          await safeCall(listOpenMatches);
          await safeCall(refreshInventory);
        }catch(e){ showToast && showToast(e.message || String(e), "error", 3500); }
      };
    }
  }catch(e){
    body.innerHTML = `<div class="muted">Error: ${e.message || String(e)}</div>`;
  }
}

// ---------- helpers ----------
let autoOn = false; let autoTimer = null; let autoStatsTimer = null;
const ZERO = "0x0000000000000000000000000000000000000000";

function ipfsToHttp(u, gateway = "https://ipfs.io/ipfs/") {
  if (!u) return null;
  if (u.startsWith("ipfs://")) return gateway + u.slice("ipfs://".length);
  return u;
}

// ------- Network helpers -------
function cfgReady() { return !!(window.CFG && CFG.CHAIN && CFG.CHAIN.idHex); }

async function getChainIdHex() {
  try {
    if (window.ethereum?.request) return await window.ethereum.request({ method: "eth_chainId" });
    if (provider?.send) return await provider.send("eth_chainId", []);
  } catch (_) {}
  return null;
}

function setNetBadge(ok, text) {
  const el = document.getElementById("netBadge");
  const btn = document.getElementById("btnSwitchNet");
  if (!el) return;
  el.textContent = text || (ok ? (CFG?.CHAIN?.name || "Network") : "Wrong network");
  el.classList.remove("net-ok", "net-bad");
  el.classList.add(ok ? "net-ok" : "net-bad");
  if (btn) btn.style.display = ok ? "none" : "inline-block";
}

async function detectAndUpdateNetwork(justChanged = false) {
  if (!cfgReady()) { setNetBadge(false, "Checking network…"); return false; }
  const cid = await getChainIdHex();
  const ok = cid && String(cid).toLowerCase() === String(CFG.CHAIN.idHex).toLowerCase();
  setNetBadge(ok, ok ? `${CFG.CHAIN.name}` : `Wrong: ${cid || "unknown"}`);
  if (!ok && justChanged && typeof showToast === "function") {
    showToast(`Please switch to ${CFG.CHAIN.name}`, "error", 2500);
  }
  return ok;
}

async function switchToTarget() {
  if (!cfgReady()) return false;
  if (!window.ethereum) { alert("No wallet"); return false; }
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CFG.CHAIN.idHex }],
    });
  } catch (e) {
    if (e.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: CFG.CHAIN.idHex,
          chainName: CFG.CHAIN.name,
          rpcUrls: CFG.CHAIN.rpcUrls,
          nativeCurrency: CFG.CHAIN.nativeCurrency,
          blockExplorerUrls: [CFG.CHAIN.explorer],
        }],
      });
    } else { throw e; }
  }
  return await detectAndUpdateNetwork(true);
}

// เรียกก่อนยิง tx ทุกครั้ง
async function requireNetworkOrThrow() {
  const ok = await detectAndUpdateNetwork(false);
  if (!ok) {
    const msg = `Wrong network. Please switch to ${CFG?.CHAIN?.name || "target chain"}.`;
    if (typeof showToast === "function") showToast(msg, "error", 3000);
    throw new Error(msg);
  }
}

// ---------- download helpers / export ----------
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}

function toCSV(rows) {
  const header = ["match_id","role","status","my_token","group","opponent","opponent_joined","winner"];
  const escape = v => `"${String(v ?? "").replace(/\"/g,'\"\"')}"`;
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      r.id, r.role, r.status, (r.my_token ?? ""), r.group,
      r.opponent, r.opp_joined, r.winner
    ].map(escape).join(","));
  }
  return lines.join("\r\n");
}

let myQty = {1:0,2:0,3:0,4:0,5:0,6:0};
function kindLabel(id){ const k=((id-1)%3)+1; return k===1?'Rock':k===2?'Paper':'Scissors'; }
function sameGroup(a,b){ const ar=(a>=4&&a<=6), br=(b>=4&&b<=6); return ar===br; }
function short(a){ return a.slice(0,6) + "…" + a.slice(-4); }

// ---------- collect my matches for export ----------
async function collectMyMatches(scan = 600) {
  if (!GAME || !me) throw new Error("Not connected");
  const meL = me.toLowerCase();
  const ZERO_LC = String(ZERO).toLowerCase();

  const n = Number(await GAME.nextMatchId());
  const from = Math.max(0, n - scan);
  const rows = [];

  for (let i = from; i < n; i++) {
    const m = await GAME.matches(i);
    const p1 = String(m.p1).toLowerCase();
    const p2 = String(m.p2).toLowerCase();
    const isP1 = (p1 === meL);
    const isP2 = (p2 === meL);
    if (!isP1 && !isP2) continue;

    const resolved = !!m.resolved;
    const status = resolved ? "RESOLVED" : (p2 === ZERO_LC ? "OPEN" : "IN-PROGRESS");

    let winner = "";
    if (resolved) {
      if (String(m.winner) === String(ZERO)) winner = "TIE";
      else if (String(m.winner).toLowerCase() === meL) winner = "ME";
      else winner = "OPP";
    }

    const my_token = isP1 ? Number(m.t1 ?? 0) : Number(m.t2 ?? 0);   // การ์ดของเราเท่านั้น
    const rareGroup = Number(m.t1 ?? 0) >= 4;                        // กติกาห้อง (NORMAL/RARE)
    rows.push({
      id: i,
      role: isP1 ? "P1" : "P2",
      status,
      my_token: my_token || undefined,
      group: rareGroup ? "RARE" : "NORMAL",
      opponent: isP1 ? m.p2 : m.p1,
      opp_joined: p2 !== ZERO_LC,
      winner
    });
  }
  return rows;
}

// ---------- export ----------
async function exportMyHistory(format = "csv", scan = 600) {
  try {
    const rows = await collectMyMatches(scan);
    const shortMe = me ? me.slice(0,6) : "me";
    const ts = new Date().toISOString().replace(/[:.]/g,"-");
    if (format === "json") {
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      saveBlob(blob, `rps-history-${shortMe}-${ts}.json`);
      showToast && showToast("Exported JSON", "success");
    } else {
      const csv = toCSV(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      saveBlob(blob, `rps-history-${shortMe}-${ts}.csv`);
      showToast && showToast("Exported CSV", "success");
    }
  } catch (e) {
    showToast && showToast(e.message || String(e), "error", 3500);
  }
}

async function refreshMyBalances() {
  if (!NFT || !me) return;
  const ids = [1,2,3,4,5,6];
  const accounts = ids.map(() => me);
  const bal = await NFT.balanceOfBatch(accounts, ids);
  ids.forEach((id, i) => myQty[id] = Number(bal[i]));
}

async function recentMatches(limit=20, scan=400){
  const tbl  = document.getElementById("recentTbl");
  const body = document.getElementById("recentBody");
  if (!tbl || !body) return;

  const n = Number(await GAME.nextMatchId());
  const from = Math.max(0, n - scan);
  const rows = [];

  for (let i = n - 1; i >= from && rows.length < limit; i--) {
    const m = await GAME.matches(i);
    if (!m.resolved) continue;
    const res = (m.winner === ZERO) ? "TIE"
      : (m.winner.toLowerCase() === m.p1.toLowerCase() ? "P1" : "P2");
    rows.push({ id:i, m, res });
  }

  body.innerHTML = rows.map(r => `
    <tr>
      <td>#${r.id}</td>
      <td title="${r.m.p1}">${short(r.m.p1)}</td>
      <td title="${r.m.p2}">${short(r.m.p2)}</td>
      <td><span class="badge ${r.res==='TIE'?'tie':(r.res==='P1'?'win':'lose')}">${r.res}</span></td>
    </tr>
  `).join("");

  tbl.style.display = rows.length ? "table" : "none";
}

// ---------- toasts / auto refresh ----------
function showToast(msg, type="info", ttl=2500){
  const dock = document.getElementById("toastDock");
  if (!dock) return alert(msg);
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = msg;
  dock.appendChild(el);
  setTimeout(()=>{ el.style.opacity = '0'; el.style.transition='opacity .2s'; setTimeout(()=>el.remove(), 200); }, ttl);
}

function toggleAuto(save=false){
  const btn = document.getElementById("btnAuto");
  autoOn = !autoOn;
  if (btn) btn.textContent = autoOn ? i18n[currentLang].autoOn : i18n[currentLang].autoOff;

  if (autoOn) {
    safeCall(listOpenMatches);
    safeCall(recentMatches);
    safeCall(myStats);

    if (autoTimer) clearInterval(autoTimer);
    if (autoStatsTimer) clearInterval(autoStatsTimer);
    autoTimer = setInterval(()=> safeCall(listOpenMatches), 15000);
    autoStatsTimer = setInterval(()=> { safeCall(myStats); safeCall(recentMatches); }, 30000);

    showToast && showToast("Auto refresh enabled", "info");
  } else {
    if (autoTimer) clearInterval(autoTimer);
    if (autoStatsTimer) clearInterval(autoStatsTimer);
    showToast && showToast("Auto refresh disabled", "info");
  }
  if (save) lsSet(PREF.auto, autoOn ? "1" : "0");
}


// ---------- SFX (Web Audio) ----------
let sfxOn = true;
let _audioCtx;
function getCtx(){ if (!_audioCtx) _audioCtx = new (window.AudioContext||window.webkitAudioContext)(); return _audioCtx; }
function sfxOsc(freq=440, dur=0.15, type="sine", gain=0.06){
  if (!sfxOn) return;
  const ctx = getCtx();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g); g.connect(ctx.destination);
  o.start();
  setTimeout(()=>{ o.stop(); }, dur*1000);
}
async function playSfxWin(){
  sfxOsc(660, .12, "triangle");
  setTimeout(()=>sfxOsc(880, .12, "triangle"), 130);
  setTimeout(()=>sfxOsc(1046, .14, "triangle"), 260);
}
async function playSfxLose(){
  sfxOsc(330, .14, "sawtooth");
  setTimeout(()=>sfxOsc(247, .16, "sawtooth"), 140);
}
async function playSfxTie(){
  sfxOsc(523, .12, "sine");
}

// ---------- announce outcome helper ----------
async function announceOutcome(id, retries=5, waitMs=600, silent=false){
  try{
    let m = null;
    for (let i=0;i<=retries;i++){
      m = await GAME.matches(id);
      if (m && m.resolved) break;
      await new Promise(r=>setTimeout(r, waitMs));
    }
    if (!m) return;
    if (!m.resolved) { log("ℹ️ match pending resolution"); return; }

    if (m.winner === ZERO){
      if (!silent){ showToast(i18n[currentLang].toastTie, "info"); playSfxTie && playSfxTie(); }
    } else if (m.winner.toLowerCase() === me.toLowerCase()){
      if (!silent){ showToast(i18n[currentLang].toastWin, "success"); playSfxWin && playSfxWin(); }
    } else {
      if (!silent){ showToast(i18n[currentLang].toastLose, "error"); playSfxLose && playSfxLose(); }
    }
  }catch(e){
    console.warn("announceOutcome error:", e);
  }
}


async function fetchJsonFromIpfs(url) {
  const gateways = ["https://ipfs.io/ipfs/", "https://cloudflare-ipfs.com/ipfs/"];
  const path = url.startsWith("ipfs://") ? url.slice(7) : url;
  for (const g of gateways) {
    try {
      const res = await fetch(g + path, { mode: "cors" });
      if (res.ok) return await res.json();
    } catch (_) {}
  }
  throw new Error("fetch fail " + url);
}

// Quick refresh for UX: update gallery && balances
async function refreshInventory() {
  try {
    await showMyCards();
    await showBalances();
    log("🔄 inventory refreshed");
  } catch (e) {
    // ignore UI refresh errors
  }
}

// ---------- connect / approve / balances ----------
async function connect() {
  try {
    if (!window.ethereum) { alert("No wallet"); return; }
    provider = new ethers.BrowserProvider(window.ethereum);
    await detectAndUpdateNetwork();  // อัปเดตป้ายครั้งแรก
    if (window.ethereum && !window._chainWired) {
      window.ethereum.on?.("chainChanged", () => detectAndUpdateNetwork(true));
      window._chainWired = true;
    }

    try { await provider.send("eth_requestAccounts", []); }
    catch (e) { showToast && showToast(e.message || String(e), "error", 4000); throw e; }

    const chainHex = await provider.send("eth_chainId", []);
    const chainDec = parseInt(chainHex, 16);
    const target = CFG?.CHAIN?.idDec;
    if (Number.isFinite(target) && chainDec !== target) {
      log(`⚠️ chainId wallet: ${chainDec}, ต้องเป็น ${target} (${CFG?.CHAIN?.name})`);
    }

    signer = await provider.getSigner();
    me = await signer.getAddress();

    NFT  = new ethers.Contract(CFG.NFT_ADDRESS,  NFT_ABI,  signer);
    GAME = new ethers.Contract(CFG.GAME_ADDRESS, GAME_ABI, signer);

    const whoEl = document.getElementById("who");
    if (whoEl) whoEl.textContent = `Connected: ${me}`;
    log("Connected: " + me);

    try {
      await safeCall(showMyCards);
      await safeCall(showBalances);
      await safeCall(listOpenMatches);
      await safeCall(myStats);
      await safeCall(recentMatches);
    } catch(e) { console.warn(e); }

    // 🚀 เริ่ม Real-time Watcher ตามสวิตช์และความถี่ที่เลือก
    if (realtimeOn) startWatch(getRtInterval()); else stopWatch();


    applyLang && applyLang();
  } catch (e) {
    showToast && showToast(e.message || String(e), "error", 4000);
    console.error(e);
  }
}

// เรียกหลัง connect(), เผื่ออยากแสดงไว้ในกล่อง log
async function logChainInfo() {
  const hex = await getChainIdHex();
  const dec = hex ? parseInt(hex, 16) : "unknown";
  const target = (CFG?.CHAIN?.idDec ?? "unknown");
  log(`chainId wallet: ${dec}, target ${target} (${CFG?.CHAIN?.name || "-"})`);
}

async function approveGame() {
  await requireNetworkOrThrow();
  const ok = await NFT.isApprovedForAll(me, CFG.GAME_ADDRESS);
  if (ok) { log("already approved"); return; }
  const tx = await NFT.setApprovalForAll(CFG.GAME_ADDRESS, true);
  log("approve tx: " + tx.hash);
  await tx.wait();
  showToast && showToast("Approved", "success");
}

async function showBalances() {
  const ids = [1,2,3,4,5,6];
  const accounts = ids.map(()=>me);
  const bal = await NFT.balanceOfBatch(accounts, ids);
  log("Balances (id:amount):");
  ids.forEach((id, i) => log(`- ${id}: ${bal[i].toString()}`));
}

// ---------- matches ----------
function readTokenIdFromUI() {
  const ids = ["createTokenId","cm_token","cm_id","create_id","token_create"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el && el.value !== undefined) {
      const v = Number(String(el.value).trim());
      if (Number.isFinite(v)) return v;
    }
  }
  return NaN;
}

async function createMatch(tokenIdParam) {
  try {
    let tid = Number(tokenIdParam);
    if (!Number.isFinite(tid)) {
      const el = document.getElementById("cm_token") || document.getElementById("createTokenId") || document.getElementById("create_id") || document.getElementById("token_create");
      tid = Number(el?.value || NaN);
    }
    if (!(tid >= 1 && tid <= 6)) {
      showToast && showToast("กรุณาใส่ Token ID ระหว่าง 1..6", "error", 3000); 
      return;
    }

    await requireNetworkOrThrow();

    // ✅ Cooldown check
    const now = Date.now();
    const left = (lastCreateAt + CREATE_COOLDOWN_MS) - now;
    if (left > 0){
      const s = Math.ceil(left/1000);
      showToast && showToast(`รอสักครู่… สร้างแมตช์ได้ใน ${s}s`, "error", 2500);
      return;
    }

    // ✅ Max open matches check
    const openMine = await countMyOpenMatches(350);
    if (openMine >= MAX_OPEN_OWNED){
      showToast && showToast(`คุณเปิดห้องไว้ครบ ${MAX_OPEN_OWNED} ห้องแล้ว — โปรดยกเลิกห้องเก่าก่อน`, "error", 3500);
      return;
    }

    const tx = await GAME.createMatch(tid);
    log("create tx: " + tx.hash);
    await tx.wait();
    showToast && showToast("Match created!", "success");

    lastCreateAt = Date.now();
    lsSet(PREF.lastCreateAt, String(lastCreateAt));

    await safeCall(listOpenMatches);
    await safeCall(refreshInventory);
    document.getElementById("openTbl")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    showToast && showToast(e.reason || e.message || String(e), "error", 3500);
  }
}


async function createMatchWithId(id){
  document.getElementById("cm_token").value = id;
  return createMatch(id);
}

async function joinMatch() {
  const id = Number(document.getElementById("jm_id").value);
  const tokenId = Number(document.getElementById("jm_token").value);
  await requireNetworkOrThrow();
  await approveGame();
  const tx = await GAME.joinMatch(id, tokenId);
  log("join tx: " + tx.hash);
  await tx.wait();
  await safeCall(listOpenMatches);
  await safeCall(refreshInventory);
  const m = await GAME.matches(id);
  if (!m.resolved) {
    log("ℹ️ match pending resolution");
  } else if (m.winner === ZERO) {
    log("🤝 Tie! Both cards returned.");
    showToast(i18n[currentLang].toastTie, "info");  playSfxTie();
  } else if (m.winner.toLowerCase() === me.toLowerCase()) {
    log("🏆 You WIN! You received opponent's card.");
    showToast(i18n[currentLang].toastWin, "success"); playSfxWin();
  } else {
    log("☠️ You lose. Your card went to the opponent.");
    showToast(i18n[currentLang].toastLose, "error");  playSfxLose();
  }
  await refreshInventory();
}

async function inspectMatch() {
  const id = Number(document.getElementById("im_id").value);
  const m = await GAME.matches(id);
  log(JSON.stringify({
    id,
    p1: m.p1,
    t1: Number(m.t1),
    p2: m.p2,
    t2: Number(m.t2),
    resolved: m.resolved,
    winner: m.winner
  }, null, 2));
}

// ---------- gallery: show my cards ----------
async function showMyCards() {
  
  const grid = document.getElementById("cardsGrid");
  if (!grid) return;

  grid.innerHTML = `<div class="muted">Loading your cards…</div>`;
  try {
    const ids = [1,2,3,4,5,6];
    const accounts = ids.map(()=>me);
    const bal = await NFT.balanceOfBatch(accounts, ids);

    const cards = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const amount = Number(bal[i]);
      if (amount <= 0) continue;

      let imageUrl = null, metaUrl = null;
      try {
        const raw = await NFT.uri(id);
        metaUrl = ipfsToHttp(raw);
        const metaJson = await fetchJsonFromIpfs(raw);
        imageUrl = ipfsToHttp(metaJson.image || metaJson.image_url || metaJson.imageURI || "");
      } catch (_) {}

      cards.push({ id, amount, imageUrl, metaUrl });
    }

    if (cards.length === 0) {
      grid.innerHTML = `<div class="muted">คุณยังไม่ถือการ์ดใด ๆ (หรือเมตาดาต้ายังไม่พร้อม)</div>`;
      return;
    }

    grid.innerHTML = cards.map(c => `
      <div class="card ${(c.id>=4 && c.id<=6) ? 'rare' : 'normal'}">
        ${c.imageUrl ? `<img src="${c.imageUrl}" alt="Card ${c.id}" loading="lazy" />`
                      : `<div style="height:160px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border-radius:8px">No Image</div>`}
        <div style="margin-top:8px;font-weight:600">#${c.id} ${kindLabel(c.id)} <span class="badge">x${c.amount}</span></div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button onclick="createMatchWithId(${c.id})">Create Match</button>
          ${c.metaUrl ? `<a href="${c.metaUrl}" class="muted" target="_blank">metadata</a>` : ``}
        </div>
      </div>
    `).join("");
	
	

    // reset prevBalances if you use it elsewhere
    if (typeof prevBalances === "object") {
      prevBalances = {1:0,2:0,3:0,4:0,5:0,6:0};
      cards.forEach(c => prevBalances[c.id] = c.amount);
    }
  } catch (e) {
    grid.innerHTML = `<div class="muted">โหลดรูปไม่สำเร็จ: ${e.message}</div>`;
  }
}

// safeCall (async) – ใช้ตัวนี้ตัวเดียว
async function safeCall(fn, ...args) {
  try { if (typeof fn === "function") return await fn(...args); }
  catch (e) {
    console.warn(e);
    if (typeof log === "function") log(e.message || String(e));
  }
}

async function myStats(limitScan=600){
  const statTbl  = document.getElementById("statTbl");
  const statBody = document.getElementById("statBody");
  const statSum  = document.getElementById("statSummary");
  if (!statTbl || !statBody || !statSum) return;

  // group placeholder
  let statGroup = document.getElementById("statGroup");
  if (!statGroup){
    statGroup = document.createElement('div');
    statGroup.id = "statGroup";
    statGroup.className = "stats-box";
    statSum.parentElement.insertBefore(statGroup, statTbl);
  }

  const n = Number(await GAME.nextMatchId());
  const from = Math.max(0, n - limitScan);

  let win=0, lose=0, tie=0;
  const rows = [];
  const grp = {
    NORMAL: {win:0,lose:0,tie:0},
    RARE:   {win:0,lose:0,tie:0}
  };

  for (let i=from;i<n;i++){
    const m = await GAME.matches(i);
    if (!m.resolved) continue;
    const meP1 = (m.p1.toLowerCase() === me.toLowerCase());
    const meP2 = (m.p2.toLowerCase && m.p2.toLowerCase() === me.toLowerCase());
    if (!meP1 && !meP2) continue;

    const myTok = meP1 ? Number(m.t1 ?? 0) : Number(m.t2 ?? 0);
    const gKey  = (Number(m.t1 ?? 0) >= 4) ? "RARE" : "NORMAL"; // กติกาห้อง

    let result;
    if (m.winner === ZERO) { result = "TIE"; tie++; grp[gKey].tie++; }
    else if (m.winner.toLowerCase() === me.toLowerCase()) { result = "WIN"; win++; grp[gKey].win++; }
    else { result = "LOSE"; lose++; grp[gKey].lose++; }

    rows.push({ id:i, role: meP1?"P1":"P2", result, myTok, group:gKey });
  }

  const total = win+lose+tie;
  const wr = total ? Math.round((win/Math.max(1,(win+lose)))*100) : 0;
  statSum.textContent = `Total ${total} | WIN ${win} / LOSE ${lose} / TIE ${tie} | WR ${wr}%`;

  // กล่องแยก Normal/Rare
  function line(g){
    const t = g.win+g.lose+g.tie, wr = t? Math.round((g.win/Math.max(1,(g.win+g.lose)))*100) : 0;
    return `WIN ${g.win} / LOSE ${g.lose} / TIE ${g.tie} | WR ${wr}%`;
  }
  statGroup.innerHTML = `
    <div><b>Normal (1–3)</b> — ${line(grp.NORMAL)}</div>
    <div style="margin-top:4px"><b>Rare (4–6)</b> — ${line(grp.RARE)}</div>
  `;

  statBody.innerHTML = rows.map(r => `
    <tr>
      <td>#${r.id}</td>
      <td>${r.role}</td>
      <td>${r.group}</td>
      <td>${r.myTok || '-'}</td>
      <td><span class="badge ${r.result==='WIN'?'win':(r.result==='LOSE'?'lose':'tie')}">${r.result}</span></td>
    </tr>
  `).join("");

  // เพิ่มหัวคอลัมน์ซึ่งบางธีมมีอยู่แล้ว—ถ้าไม่มี ให้จัดเอง
  const thead = statTbl.querySelector('thead');
  if (thead && !thead._patched){
    thead.innerHTML = `<tr><th>Match</th><th>Role</th><th>Group</th><th>My Token</th><th>Result</th></tr>`;
    thead._patched = true;
  }

  statTbl.style.display = rows.length ? "table" : "none";
}


// ---------- open matches list (with filters) ----------
async function listOpenMatches() {
  const tbl  = document.getElementById("openTbl");
  const body = document.getElementById("openBody");
  if (!tbl || !body) return;

// ใส่ skeleton ชั่วคราว
  body.innerHTML = `
    <tr><td colspan="5"><div class="skeleton skel-row"></div></td></tr>
    <tr><td colspan="5"><div class="skeleton skel-row"></div></td></tr>
    <tr><td colspan="5"><div class="skeleton skel-row"></div></td></tr>
  `;

  try {
    const rows = await recentOpenMatchesFiltered(); // ← ใช้ฟังก์ชันที่คุณวางฟิลเตอร์ไว้
    if (!rows.length) { body.innerHTML = `<tr><td colspan="5" style="opacity:.6">ไม่มีห้องเปิด</td></tr>`; return; }
    body.innerHTML = rows.map(r => `
      <tr>
        <td>#${r.id}</td>
        <td>${r.ownerShort}</td>
        <td>${r.group}</td>
        <td>${r.canJoin ? `<button data-j="${r.id}" class="btn">Join</button>` : '-'}</td>
        <td><button data-i="${r.id}" class="btn">Inspect</button></td>
      </tr>
    `).join("");

    // wire ปุ่ม
    body.querySelectorAll("[data-j]").forEach(b => b.onclick = () => joinMatch(Number(b.dataset.j)));
    body.querySelectorAll("[data-i]").forEach(b => b.onclick = () => openInspectDialog(Number(b.dataset.i)));
  } catch (e) {
    body.innerHTML = `<tr><td colspan="5" style="color:#c33">${e.message||e}</td></tr>`;
  }
}

  body.innerHTML = "";
  tbl.style.display = "none";

  await refreshMyBalances();

  const hideMine     = !!document.getElementById("filterMine")?.checked;
  const onlyJoinable = !!document.getElementById("filterJoinable")?.checked;

  const n = Number(await GAME.nextMatchId());
  const from = Math.max(0, n - 300);

  const open = [];
  for (let i = from; i < n; i++) {
    const m = await GAME.matches(i);
    if (m.resolved || m.p2 !== ZERO) continue;

    const isMine = me && (m.p1.toLowerCase() === me.toLowerCase());
    if (hideMine && isMine) continue;

    const rareGroup = Number(m.t1) >= 4;
    const canJoinByCard = rareGroup
      ? (myQty[4] + myQty[5] + myQty[6]) > 0
      : (myQty[1] + myQty[2] + myQty[3]) > 0;

    if (onlyJoinable && !canJoinByCard) continue;

    open.push({ id: i, m, isMine });
  }

  open.sort((a,b) => {
    if (a.isMine && !b.isMine) return -1;
    if (!a.isMine && b.isMine) return 1;
    return a.id - b.id;
  });

  if (open.length === 0) {
    body.innerHTML = `<tr><td colspan="3" class="muted">ไม่พบห้องที่ตรงกับตัวกรอง</td></tr>`;
    tbl.style.display = "table";
    return;
  }

  for (const {id, m, isMine} of open) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${id}</td>
      <td>${isMine ? i18n[currentLang].yours : i18n[currentLang].waiting}</td>
      <td>
        ${isMine
          ? `<button data-cancel="${id}">Cancel</button>`
          : `<button data-id="${id}">${i18n[currentLang].joinNow}</button>`}
        <button data-inspect="${id}" style="margin-left:6px">Inspect</button>
        <button data-copy="${id}" style="margin-left:6px">Copy</button>
      </td>
    `;

    if (isMine) {
      tr.querySelector("[data-cancel]").onclick = async () => {
        try {
          await requireNetworkOrThrow();
          const tx = await GAME.cancelMatch(id);
          log("cancel tx: " + tx.hash);
          await tx.wait();
          showToast && showToast(i18n[currentLang].canceled, "info");
          await listOpenMatches();
          await refreshInventory();
        } catch (e) { showToast && showToast(e.message, "error", 3500); }
      };
    } else {
      tr.querySelector("[data-id]").onclick      = () => openJoinDialog(id);
    }

    tr.querySelector("[data-inspect]").onclick = () => openInspectDialog(id);
    tr.querySelector("[data-copy]").onclick    = () => {
      navigator.clipboard.writeText(String(id));
      showToast && showToast(`Copied match #${id}`, "success");
    };

    body.appendChild(tr);
  }

  tbl.style.display = "table";
}

// ---------- language apply ----------
function applyLang(){
  const mapping = [
    ["btnConnect", "connect"],
    ["btnApprove", "approve"],
    ["btnBalances", "balances"],
    ["btnShowCards", "showCards"],
    ["btnListOpen", "listOpen"],
    ["btnMyStats", "myStats"],
  ];
  for (const [id, key] of mapping) {
    const el = document.getElementById(id);
    if (el) el.textContent = i18n[currentLang][key];
  }
  const btnDK = document.getElementById("btnDark");
  if (btnDK) btnDK.textContent = document.body.classList.contains('dark') ? i18n[currentLang].darkOn : i18n[currentLang].darkOff;
  const btnLG = document.getElementById("btnLang");
  if (btnLG) btnLG.textContent = currentLang === 'th' ? i18n[currentLang].th : i18n[currentLang].en;
}

// ===== Real-time watcher (quiet on connect + only my matches + toast cap) =====
let watchTimer = null;
let watchMap = {};    // id -> { p2Joined: boolean, resolved: boolean }
let watchReady = false;
const MAX_TOASTS_PER_SCAN = 2;

function isZero(addr){ return !addr || String(addr).toLowerCase() === ZERO.toLowerCase(); }

// สแกนเฉพาะแมตช์ที่เราเกี่ยวข้อง (เราเป็น P1 หรือ P2)
async function scanMyMatches(scan = 250) {
  if (!GAME || !me) return [];
  const meL = me.toLowerCase();
  const n = Number(await GAME.nextMatchId());
  const from = Math.max(0, n - scan);
  const out = [];
  for (let i = from; i < n; i++) {
    const m = await GAME.matches(i);
    const isP1 = String(m.p1).toLowerCase() === meL;
    const isP2 = String(m.p2).toLowerCase() === meL;
    if (!(isP1 || isP2)) continue;
    out.push({ id: i, m, isP1, isP2 });
  }
  return out;
}

// ทำ baseline ครั้งแรกหลัง connect — ไม่แจ้งเตือนย้อนหลัง
async function seedWatchMap(){
  watchMap = {};
  const rows = await scanMyMatches();
  for (const { id, m } of rows) {
    watchMap[String(id)] = { p2Joined: !isZero(m.p2), resolved: !!m.resolved };
  }
  watchReady = true;
}

async function checkAndNotify(){
  if (!watchReady || !realtimeOn) return;
  const rows = await scanMyMatches();
  let shown = 0; // จำกัด toast ต่อรอบสแกน

  for (const { id, m, isP1 } of rows) {
    const key  = String(id);
    const prev = watchMap[key] || { p2Joined:false, resolved:false };

    const nowJoined = !isZero(m.p2);
    const nowSolved = !!m.resolved;

    // แจ้ง "มีคนเข้าห้องของเรา" เฉพาะแมตช์ที่เราเป็น P1
    if (isP1 && !prev.p2Joined && nowJoined) {
      if (shown < MAX_TOASTS_PER_SCAN) {
        showToast && showToast(i18n[currentLang].someoneJoined(id), "info", 3000);
        sfxOsc && sfxOsc(740, .1, "triangle");
        shown++;
      }
      safeCall(listOpenMatches);
    }

    // แจ้งผล (เราเป็น P1 หรือ P2 ก็ได้) — ถ้าเกินโควตา จะเงียบ
    if (!prev.resolved && nowSolved) {
      const silent = shown >= MAX_TOASTS_PER_SCAN;
      await announceOutcome(id, 5, 600, silent);
      if (!silent) shown++;
      await safeCall(myStats);
      await safeCall(refreshInventory);
    }

    watchMap[key] = { p2Joined: nowJoined, resolved: nowSolved };
  }
}

async function startWatch(intervalMs){
  stopWatch();
  watchReady = false;
  await seedWatchMap();                         // ตั้งค่าสถานะตั้งต้น (เงียบ ๆ)
  watchTimer = setInterval(checkAndNotify, intervalMs ?? getRtInterval());
  // ไม่ยิง checkAndNotify ทันทีเพื่อกันเด้งรัวตอนเพิ่งเชื่อมต่อ
}

function stopWatch(){
  if (watchTimer) { clearInterval(watchTimer); watchTimer = null; }
}

