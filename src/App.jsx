import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";

const SUPABASE_URL = "https://vwhfzqbpqrxonswzjbft.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3aGZ6cWJwcXJ4b25zd3pqYmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MTg4ODAsImV4cCI6MjA5ODQ5NDg4MH0.gyWUpVWyTaQL5Tr3lR5N1YxfjEak2IKci4pwkMPnBtM";
const SESSION_KEY = "himaip_admin_session";

async function rpcCall(fn, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify(body || {})
  });
  if (!res.ok) throw new Error("Gagal menghubungi server");
  return res.json();
}

// --- Sesi admin (diisi lewat Supabase Auth, bukan kode statis lagi) ---
let currentSession = null;

function saveSession(data) {
  currentSession = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now() + (data.expires_in || 3600) * 1000, user: data.user };
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(currentSession)); } catch(e) {}
}
function clearSession() {
  currentSession = null;
  try { localStorage.removeItem(SESSION_KEY); } catch(e) {}
}
function authHeaders(json) {
  const token = currentSession?.access_token || SUPABASE_KEY;
  const h = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` };
  if (json) h["Content-Type"] = "application/json";
  return h;
}
async function authSignIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Email atau password salah.");
  return data;
}
async function authRefresh(refresh_token) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token })
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Sesi kedaluwarsa");
  return data;
}
async function authSignOut() {
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: "POST", headers: authHeaders() });
  } catch(e) {}
}

const db = {
  async get(table, query = "") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?order=created_at.desc${query}`, {
      headers: authHeaders()
    });
    return res.json();
  },
  async insert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...authHeaders(true), Prefer: "return=representation" },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async delete(table, id) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "DELETE",
      headers: authHeaders()
    });
  },
  async update(table, id, data) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: authHeaders(true),
      body: JSON.stringify(data)
    });
  }
};

function compressImage(file, maxW = 800, quality = 0.65) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale; canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject; img.src = e.target.result;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}
// Sama seperti compressImage, tapi mempertahankan transparansi (PNG).
// Wajib dipakai untuk aset seperti logo kabinet yang punya background transparan,
// karena JPEG akan menimpa area transparan itu jadi hitam solid.
function compressImagePNG(file, maxW = 500) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale; canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject; img.src = e.target.result;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}
function formatDate(d) {
  if (!d) return "";
  try { return new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return d; }
}

const LEADERSHIP_QUOTES = [
  "Pemimpin sejati tidak mencari pengikut, ia melahirkan pemimpin baru.",
  "Kepemimpinan bukan tentang jabatan, melainkan tanggung jawab yang dipikul dengan ikhlas.",
  "Keberanian seorang pemimpin diuji bukan saat semua berjalan lancar, tapi saat semua terasa runtuh.",
  "Pemimpin yang baik mendengar lebih banyak daripada bicara.",
  "Melayani adalah bentuk kepemimpinan yang paling jujur.",
  "Pemimpin hebat membangun jembatan, bukan tembok, di antara perbedaan.",
  "Kepercayaan dibangun dari konsistensi, bukan dari janji.",
  "Pemimpin sejati berjalan di depan saat sulit, dan di belakang saat merayakan.",
  "Organisasi tumbuh bukan karena satu orang hebat, tapi karena banyak orang yang percaya bersama.",
  "Kepemimpinan adalah seni menyalakan cahaya orang lain tanpa memadamkan milik sendiri.",
  "Sejarah mencatat bukan siapa yang paling lama memimpin, tapi siapa yang paling berarti saat memimpin.",
  "Pemimpin yang rendah hati akan selalu punya ruang untuk belajar."
];

// Quotes singkat yang muncul di overlay setiap kali berpindah halaman
const PAGE_TRANSITION_QUOTES = [
  "Setiap langkah kecil hari ini adalah jejak sejarah HIMA IP esok hari.",
  "Kebersamaan adalah kekuatan yang tak pernah usang oleh waktu.",
  "Ilmu Pemerintahan bukan sekadar jurusan, tapi panggilan untuk melayani.",
  "Organisasi hebat lahir dari mahasiswa yang mau berproses, bukan yang menuntut hasil instan.",
  "Cakra Samagra: satu roda, satu arah, satu tujuan bersama.",
  "Yang diingat bukan siapa yang paling banyak bicara, tapi siapa yang paling banyak berkarya.",
  "Sejarah HIMA IP ditulis oleh mereka yang hadir, bukan yang hanya menonton.",
  "Kolaborasi selalu mengalahkan ambisi yang berjalan sendiri.",
  "Rumah ini dibangun dari keringat, diskusi panjang, dan mimpi yang sama.",
  "Integritas adalah warisan yang tidak akan pernah pudar oleh pergantian kepengurusan.",
  "Mahasiswa yang baik adalah yang pulang membawa perubahan, bukan sekadar gelar.",
  "Setiap kegiatan kecil adalah investasi besar untuk masa depan organisasi.",
];

export default function App() {
  const [tab, setTab] = useState("beranda");
  const [menuOpen, setMenuOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [photosByEvent, setPhotosByEvent] = useState({});
  const [lpjDocs, setLpjDocs] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [siteIntro, setSiteIntro] = useState(true);
  const [pageTransition, setPageTransition] = useState(null); // { quote, theme } saat overlay perpindahan halaman aktif
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [showPinLock, setShowPinLock] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinStage, setPinStage] = useState("enter");
  const [pinFirstEntry, setPinFirstEntry] = useState("");
  const [pinError, setPinError] = useState("");
  const [activeEvent, setActiveEvent] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [busy, setBusy] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventDesc, setNewEventDesc] = useState("");
  const [lpjTitle, setLpjTitle] = useState("");
  const [newMember, setNewMember] = useState({ name: "", npm: "", jabatan: "", semester: "", photo: "", music_fav: "", music_link: "" });
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [berkasFolders, setBerkasFolders] = useState([]);
  const [activeFolder, setActiveFolder] = useState(null);
  const [newFolderName, setNewFolderName] = useState("");
  const photoInputRef = useRef(null);
  const lpjFileInputRef = useRef(null);
  const memberPhotoRef = useRef(null);
  const editMemberPhotoRef = useRef(null);
  const contentRef = useRef(null);
  const siteIntroTimer = useRef(null);
  const pageTransitionHoldTimer = useRef(null);
  const pageTransitionSwapTimer = useRef(null);
  const announceRef = useRef(null);
  const announceFileRef = useRef(null);
  const editAnnounceFileRef = useRef(null);
  const [announcements, setAnnouncements] = useState([]);
  const [newAnnounceTitle, setNewAnnounceTitle] = useState("");
  const [newAnnounceDate, setNewAnnounceDate] = useState("");
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [visitorCount, setVisitorCount] = useState(null);

  // ===== Hall of Fame =====
  const [hofKetua, setHofKetua] = useState([]);
  const [hofKabinet, setHofKabinet] = useState([]);
  const [hofJourney, setHofJourney] = useState([]);
  const [editingKetua, setEditingKetua] = useState(null);
  const [editingKabinet, setEditingKabinet] = useState(null);
  const [editingJourney, setEditingJourney] = useState(null);
  const [showKelolaKabinet, setShowKelolaKabinet] = useState(false);
  const [hofActiveSection, setHofActiveSection] = useState("intro");
  const [hofQuoteOverlay, setHofQuoteOverlay] = useState(null);
  const [hofPressedLogo, setHofPressedLogo] = useState(null);
  const [hofIdentityPopup, setHofIdentityPopup] = useState(null);
  const [hofLeaderFilter, setHofLeaderFilter] = useState("semua");
  const [hofExpandedCard, setHofExpandedCard] = useState(null);
  const hofTouchX = useRef(null);
  const kabinetRefs = useRef({});
  const ketuaFotoRef = useRef(null);
  const wakilFotoRef = useRef(null);
  const kabinetLogoRef = useRef(null);
  const journeyFotoRef = useRef(null);
  const hofSectionRefs = useRef({});
  const hofHoldTimer = useRef(null);
  const hofQuoteTimer = useRef(null);

  const searchResults = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results = [];
    events.forEach(ev => {
      if ((ev.name||"").toLowerCase().includes(q) || (ev.description||"").toLowerCase().includes(q)) {
        results.push({ key:"ev_"+ev.id, type:"Kegiatan", label: ev.name, onClick: () => { navigate("galeri"); setTimeout(() => openEvent(ev.id), 420); } });
      }
    });
    members.forEach(m => {
      if ((m.name||"").toLowerCase().includes(q) || (m.jabatan||"").toLowerCase().includes(q) || (m.npm||"").toLowerCase().includes(q)) {
        results.push({ key:"m_"+m.id, type:"Anggota", label: m.jabatan ? `${m.name} — ${m.jabatan}` : m.name, onClick: () => navigate("anggota") });
      }
    });
    announcements.forEach(a => {
      if ((a.title||"").toLowerCase().includes(q)) {
        results.push({ key:"a_"+a.id, type:"Pengumuman", label: a.title, onClick: () => { navigate("beranda"); setTimeout(scrollToAnnounce, 550); } });
      }
    });
    lpjDocs.forEach(d => {
      if ((d.title||"").toLowerCase().includes(q) || (d.name||"").toLowerCase().includes(q)) {
        results.push({ key:"d_"+d.id, type:"Berkas", label: d.title || d.name, onClick: () => { navigate("lpj"); if (d.folder_id) setTimeout(() => openFolder(d.folder_id), 420); } });
      }
    });
    berkasFolders.forEach(f => {
      if ((f.name||"").toLowerCase().includes(q)) {
        results.push({ key:"f_"+f.id, type:"Folder", label: f.name, onClick: () => { navigate("lpj"); setTimeout(() => openFolder(f.id), 420); } });
      }
    });
    return results.slice(0, 20);
  }, [searchQuery, events, members, announcements, lpjDocs, berkasFolders]);

  useEffect(() => {
    function onScroll() { setShowScrollTop(window.scrollY > 400); }
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Animasi selamat datang saat pertama kali membuka website (2 detik, lalu masuk ke Beranda)
  useEffect(() => {
    siteIntroTimer.current = setTimeout(() => setSiteIntro(false), 2200);
    return () => clearTimeout(siteIntroTimer.current);
  }, []);

  // Kunci scroll body saat overlay welcome / transisi halaman sedang tampil
  useEffect(() => {
    document.body.style.overflow = (siteIntro || pageTransition) ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [siteIntro, pageTransition]);

  // Track which HOF section is active (for dot nav) while on the hof tab
  useEffect(() => {
    if (tab !== "hof") return;
    function onScroll() {
      const order = ["intro", "journey", "leadership"];
      let current = "intro";
      let best = Infinity;
      for (const key of order) {
        const el = hofSectionRefs.current[key];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const dist = Math.abs(rect.top - 90);
        if (rect.top <= window.innerHeight * 0.6 && dist < best) { best = dist; current = key; }
      }
      setHofActiveSection(current);
    }
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [tab]);

  function hofGoToSection(key) {
    const quote = LEADERSHIP_QUOTES[Math.floor(Math.random() * LEADERSHIP_QUOTES.length)];
    setHofQuoteOverlay(quote);
    clearTimeout(hofQuoteTimer.current);
    hofQuoteTimer.current = setTimeout(() => setHofQuoteOverlay(null), 3000);
    const el = hofSectionRefs.current[key];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setHofActiveSection(key);
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await rpcCall("increment_visitor_count");
        setVisitorCount(typeof res === "number" ? res : (res && res.increment_visitor_count));
      } catch(e) { console.error(e); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (saved.expires_at > Date.now() + 30000) {
          currentSession = saved;
          try {
            const isSet = await rpcCall("pin_is_set");
            if (isSet) setShowPinLock(true); else setIsAdmin(true);
          } catch(e) { setIsAdmin(true); }
        } else if (saved.refresh_token) {
          const refreshed = await authRefresh(saved.refresh_token);
          saveSession(refreshed);
          try {
            const isSet = await rpcCall("pin_is_set");
            if (isSet) setShowPinLock(true); else setIsAdmin(true);
          } catch(e) { setIsAdmin(true); }
        } else {
          clearSession();
        }
      } catch(e) { clearSession(); }
    })();
    loadAll();
  }, []);

  // --- Navigasi history browser (supaya tombol kembali HP tidak langsung keluar dari web) ---
  useEffect(() => {
    window.history.replaceState({ tab: "beranda", activeEvent: null, activeFolder: null }, "");
    function handlePopState(e) {
      const st = e.state || { tab: "beranda", activeEvent: null, activeFolder: null };
      triggerPageTransition(st.tab || "beranda", () => {
        setTab(st.tab || "beranda");
        setActiveEvent(st.activeEvent || null);
        setActiveFolder(st.activeFolder || null);
        setMenuOpen(false);
      });
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const evs = await db.get("events");
      setEvents(Array.isArray(evs) ? evs : []);
      const photoMap = {};
      if (Array.isArray(evs)) {
        const allPhotos = await db.get("photos");
        if (Array.isArray(allPhotos)) {
          for (const p of allPhotos) {
            if (!photoMap[p.event_id]) photoMap[p.event_id] = [];
            photoMap[p.event_id].push(p);
          }
        }
      }
      setPhotosByEvent(photoMap);
      const lpj = await db.get("lpj_docs");
      setLpjDocs(Array.isArray(lpj) ? lpj : []);
      const folders = await db.get("berkas_folders");
      setBerkasFolders(Array.isArray(folders) ? folders : []);
      const ann = await db.get("announcements", "&order=created_at.desc");
      setAnnouncements(Array.isArray(ann) ? ann : []);
      const mem = await db.get("members", "&order=created_at.asc");
      setMembers(Array.isArray(mem) ? mem : []);
      const hk = await db.get("hof_ketua");
      setHofKetua(Array.isArray(hk) ? hk : []);
      const hkab = await db.get("hof_kabinet");
      setHofKabinet(Array.isArray(hkab) ? hkab : []);
      const hj = await db.get("hof_journey");
      setHofJourney(Array.isArray(hj) ? hj : []);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  async function tryLogin() {
    setLoginError(""); setLoggingIn(true);
    try {
      const data = await authSignIn(emailInput.trim(), codeInput);
      saveSession(data);
      setIsAdmin(true); setShowLogin(false); setCodeInput(""); setEmailInput(""); setShowWelcome(true);
    } catch(e) {
      setLoginError("Email atau password salah.");
    }
    setLoggingIn(false);
  }
  async function doLogout() {
    await authSignOut();
    clearSession();
    setIsAdmin(false);
    setShowLogoutConfirm(false);
  }
  async function handlePinLockDigit(d) {
    const next = (pinValue + d).slice(0, 6);
    setPinValue(next);
    setPinError("");
    if (next.length === 6) {
      try {
        const ok = await rpcCall("verify_admin_pin", { input_pin: next });
        if (ok) {
          setShowPinLock(false); setPinValue(""); setIsAdmin(true);
        } else {
          setPinError("PIN salah, coba lagi.");
          setTimeout(() => setPinValue(""), 400);
        }
      } catch(e) {
        setPinError("Gagal memeriksa PIN, coba lagi.");
        setTimeout(() => setPinValue(""), 400);
      }
    }
  }
  function forgotPin() {
    clearSession();
    setShowPinLock(false); setPinValue(""); setPinError("");
    setShowLogin(true);
  }
  async function handlePinSetupDigit(d) {
    const next = (pinValue + d).slice(0, 6);
    setPinValue(next);
    setPinError("");
    if (next.length === 6) {
      if (pinStage === "enter") {
        setPinFirstEntry(next);
        setPinStage("confirm");
        setPinValue("");
      } else {
        if (next === pinFirstEntry) {
          try {
            await rpcCall("set_admin_pin", { new_pin: next });
            setShowPinSetup(false); setPinValue(""); setPinFirstEntry(""); setPinStage("enter");
          } catch(e) {
            setPinError("Gagal menyimpan PIN ke server, coba lagi.");
            setTimeout(() => { setPinValue(""); setPinStage("enter"); setPinFirstEntry(""); }, 800);
          }
        } else {
          setPinError("PIN tidak sama, ulangi dari awal.");
          setTimeout(() => { setPinValue(""); setPinStage("enter"); setPinFirstEntry(""); }, 600);
        }
      }
    }
  }
  function skipPinSetup() { setShowPinSetup(false); setPinValue(""); setPinFirstEntry(""); setPinStage("enter"); }
  function openChangePin() { setPinStage("enter"); setPinValue(""); setPinFirstEntry(""); setPinError(""); setShowPinSetup(true); }
  // Menampilkan overlay quote (2 detik, latar menyesuaikan halaman tujuan) sebelum konten halaman diganti,
  // supaya perpindahan halaman terasa smooth dan tertutup rapi tanpa "kedip" konten lama/baru.
  function triggerPageTransition(targetTab, applyChange) {
    clearTimeout(pageTransitionSwapTimer.current);
    clearTimeout(pageTransitionHoldTimer.current);
    const quote = PAGE_TRANSITION_QUOTES[Math.floor(Math.random() * PAGE_TRANSITION_QUOTES.length)];
    const theme = targetTab === "hof" ? "dark" : "light";
    setPageTransition({ quote, theme });
    pageTransitionSwapTimer.current = setTimeout(() => {
      applyChange();
      window.scrollTo(0, 0);
    }, 360);
    pageTransitionHoldTimer.current = setTimeout(() => {
      setPageTransition(null);
    }, 2000);
  }
  function navigate(t) {
    setMenuOpen(false);
    if (t === tab && !activeEvent && !activeFolder) return;
    triggerPageTransition(t, () => {
      setTab(t); setActiveEvent(null); setActiveFolder(null);
      window.history.pushState({ tab: t, activeEvent: null, activeFolder: null }, "");
    });
  }
  function openEvent(id) {
    setActiveEvent(id);
    window.history.pushState({ tab: "galeri", activeEvent: id, activeFolder: null }, "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openFolder(id) {
    setActiveFolder(id);
    window.history.pushState({ tab: "lpj", activeEvent: null, activeFolder: id }, "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function addAnnouncement(fileList) {
    const file = fileList[0]; if (!file) return;
    setBusy(true);
    try {
      const isImage = file.type.startsWith("image/");
      const file_url = isImage ? await compressImage(file, 1200, 0.75) : await fileToDataUrl(file);
      const item = { id: "a_" + Date.now() + Math.random().toString(36).slice(2,6), title: newAnnounceTitle.trim() || file.name, date: newAnnounceDate || new Date().toISOString().slice(0,10), file_url, file_name: file.name };
      await db.insert("announcements", item);
      setAnnouncements(a => [item, ...a]);
      setNewAnnounceTitle(""); setNewAnnounceDate("");
    } catch(e) { console.error(e); }
    setBusy(false);
  }
  async function deleteAnnouncement(id) {
    await db.delete("announcements", id);
    setAnnouncements(a => a.filter(x => x.id !== id));
  }
  async function saveEditAnnouncement(id, data) {
    await db.update("announcements", id, data);
    setAnnouncements(a => a.map(x => x.id === id ? {...x, ...data} : x));
    setEditingAnnouncement(null);
  }
  function scrollToAnnounce() { announceRef.current?.scrollIntoView({ behavior: "smooth" }); }
  function scrollToContent() { contentRef.current?.scrollIntoView({ behavior: "smooth" }); }

  async function addEvent() {
    if (!newEventName.trim()) return;
    const ev = { id: "ev_" + Date.now(), name: newEventName.trim(), date: newEventDate || "", description: newEventDesc.trim() };
    await db.insert("events", ev);
    setEvents(e => [ev, ...e]);
    setNewEventName(""); setNewEventDate(""); setNewEventDesc("");
  }
  async function deleteEvent(id) {
    if (!confirm("Hapus kegiatan ini?")) return;
    await db.delete("events", id);
    setEvents(e => e.filter(x => x.id !== id));
    if (activeEvent === id) setActiveEvent(null);
  }
  async function uploadPhotos(eventId, fileList) {
    setBusy(true);
    for (const file of Array.from(fileList)) {
      try {
        const src = await compressImage(file);
        const payload = { id: "p_" + Date.now() + Math.random().toString(36).slice(2,6), event_id: eventId, src, caption: "" };
        const inserted = await db.insert("photos", payload);
        const photo = Array.isArray(inserted) && inserted[0] ? inserted[0] : payload;
        setPhotosByEvent(p => ({ ...p, [eventId]: [photo, ...(p[eventId] || [])] }));
      } catch(e) { console.error(e); }
    }
    setBusy(false);
  }
  async function deletePhoto(eventId, photoId) {
    await db.delete("photos", photoId);
    setPhotosByEvent(p => ({ ...p, [eventId]: (p[eventId] || []).filter(x => x.id !== photoId) }));
  }
  async function uploadLpjFiles(folderId, fileList) {
    setBusy(true);
    for (const file of Array.from(fileList)) {
      try {
        const isImage = file.type.startsWith("image/");
        const data_url = isImage ? await compressImage(file, 1000, 0.7) : await fileToDataUrl(file);
        const doc = { id: "d_" + Date.now() + Math.random().toString(36).slice(2,6), title: lpjTitle.trim() || file.name, name: file.name, type: file.type, is_image: isImage, data_url, date: new Date().toISOString().slice(0,10), folder_id: folderId };
        await db.insert("lpj_docs", doc);
        setLpjDocs(d => [doc, ...d]);
      } catch(e) { console.error(e); }
    }
    setLpjTitle(""); setBusy(false);
  }
  async function deleteLpjDoc(id) {
    await db.delete("lpj_docs", id);
    setLpjDocs(d => d.filter(x => x.id !== id));
  }
  async function addFolder() {
    if (!newFolderName.trim()) return;
    const f = { id: "f_" + Date.now(), name: newFolderName.trim() };
    await db.insert("berkas_folders", f);
    setBerkasFolders(fs => [f, ...fs]);
    setNewFolderName("");
  }
  async function deleteFolder(id) {
    if (!confirm("Hapus folder ini beserta semua berkas di dalamnya?")) return;
    const docsInFolder = lpjDocs.filter(d => d.folder_id === id);
    for (const d of docsInFolder) await db.delete("lpj_docs", d.id);
    await db.delete("berkas_folders", id);
    setLpjDocs(d => d.filter(x => x.folder_id !== id));
    setBerkasFolders(fs => fs.filter(x => x.id !== id));
    if (activeFolder === id) setActiveFolder(null);
  }
  async function addMember() {
    if (!newMember.name.trim()) return;
    const m = { id: "m_" + Date.now(), ...newMember };
    await db.insert("members", m);
    setMembers(mem => [...mem, m]);
    setNewMember({ name: "", npm: "", jabatan: "", semester: "", photo: "", music_fav: "", music_link: "" });
  }
  async function deleteMember(id) {
    await db.delete("members", id);
    setMembers(m => m.filter(x => x.id !== id));
  }
  async function saveEditEvent(id, data) {
    await db.update("events", id, data);
    setEvents(e => e.map(x => x.id === id ? { ...x, ...data } : x));
    setEditingEvent(null);
  }
  async function saveEditMember(id, data) {
    await db.update("members", id, data);
    setMembers(m => m.map(x => x.id === id ? { ...x, ...data } : x));
    setEditingMember(null);
  }
  async function movePhoto(eventId, photoId, direction) {
    const photos = [...(photosByEvent[eventId] || [])];
    const idx = photos.findIndex(p => p.id === photoId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= photos.length) return;
    const a = photos[idx], b = photos[swapIdx];
    [photos[idx], photos[swapIdx]] = [photos[swapIdx], photos[idx]];
    setPhotosByEvent(p => ({ ...p, [eventId]: photos }));
    try {
      if (a.created_at && b.created_at) {
        await Promise.all([
          db.update("photos", a.id, { created_at: b.created_at }),
          db.update("photos", b.id, { created_at: a.created_at })
        ]);
        setPhotosByEvent(p => ({
          ...p,
          [eventId]: p[eventId].map(x => x.id === a.id ? { ...x, created_at: b.created_at } : x.id === b.id ? { ...x, created_at: a.created_at } : x)
        }));
      }
    } catch(e) { console.error(e); }
  }

  async function addKetuaPeriode() {
    const maxU = hofKetua.reduce((m, k) => Math.max(m, k.urutan || 0), 0);
    const row = { id: "hk_" + Date.now(), urutan: maxU + 1, periode: "Periode Baru", ketua_nama: "", ketua_npm: "", ketua_foto: "", wakil_nama: "", wakil_npm: "", wakil_foto: "" };
    await db.insert("hof_ketua", row);
    setHofKetua(k => [row, ...k]);
    setHofIndex(0); setHofFlipped(false);
    setEditingKetua(row);
  }
  async function saveEditKetua(id, data) {
    await db.update("hof_ketua", id, data);
    setHofKetua(k => k.map(x => x.id === id ? { ...x, ...data } : x));
    setEditingKetua(null);
  }
  function clearKetuaRole() {
    if (!confirm("Hapus data kartu Ketua (nama, NPM, foto) pada periode ini?")) return;
    setEditingKetua(k => ({ ...k, ketua_nama: "", ketua_npm: "", ketua_foto: "" }));
  }
  function clearWakilRole() {
    if (!confirm("Hapus data kartu Wakil Ketua (nama, NPM, foto) pada periode ini?")) return;
    setEditingKetua(k => ({ ...k, wakil_nama: "", wakil_npm: "", wakil_foto: "" }));
  }
  async function deleteKetuaPeriode(id) {
    if (!confirm("Hapus periode kepengurusan ini beserta kartu Ketua & Wakil?")) return;
    await db.delete("hof_ketua", id);
    setHofKetua(k => k.filter(x => x.id !== id));
  }
  async function moveKetuaPeriode(id, dir) {
    const sorted = [...hofKetua].sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
    const idx = sorted.findIndex(x => x.id === id);
    const swapIdx = idx + dir;
    if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx], b = sorted[swapIdx];
    const aU = a.urutan, bU = b.urutan;
    await Promise.all([db.update("hof_ketua", a.id, { urutan: bU }), db.update("hof_ketua", b.id, { urutan: aU })]);
    setHofKetua(k => k.map(x => x.id === a.id ? { ...x, urutan: bU } : x.id === b.id ? { ...x, urutan: aU } : x));
  }
  async function addKabinet() {
    const maxU = hofKabinet.reduce((m, k) => Math.max(m, k.urutan || 0), 0);
    const row = { id: "hkab_" + Date.now(), urutan: maxU + 1, periode: "", ketua_periode: "", nama_kabinet: "Nama Kabinet", filosofi: "", logo: "" };
    await db.insert("hof_kabinet", row);
    setHofKabinet(k => [row, ...k]);
    setEditingKabinet(row);
  }
  async function saveEditKabinet(id, data) {
    await db.update("hof_kabinet", id, data);
    setHofKabinet(k => k.map(x => x.id === id ? { ...x, ...data } : x));
    setEditingKabinet(null);
  }
  async function deleteKabinet(id) {
    if (!confirm("Hapus kartu kabinet ini?")) return;
    await db.delete("hof_kabinet", id);
    setHofKabinet(k => k.filter(x => x.id !== id));
  }

  const hofKabinetSorted = React.useMemo(() => [...hofKabinet].sort((a, b) => (b.urutan || 0) - (a.urutan || 0)), [hofKabinet]);

  // Flatten Ketua/Wakil periods into individual leadership cards (one per person)
  const hofLeaderCards = React.useMemo(() => {
    const sorted = [...hofKetua].sort((a, b) => (b.urutan || 0) - (a.urutan || 0));
    const arr = [];
    sorted.forEach(p => {
      const kab = hofKabinet.find(k => k.ketua_periode === p.periode);
      arr.push({ id: p.id + "_ketua", periode: p.id, role: "ketua", nama: p.ketua_nama, npm: p.ketua_npm, foto: p.ketua_foto, medsos: p.ketua_medsos, periodeLabel: p.periode, kabinetNama: kab ? kab.nama_kabinet : "" });
      arr.push({ id: p.id + "_wakil", periode: p.id, role: "wakil", nama: p.wakil_nama, npm: p.wakil_npm, foto: p.wakil_foto, medsos: p.wakil_medsos, periodeLabel: p.periode, kabinetNama: kab ? kab.nama_kabinet : "" });
    });
    return arr;
  }, [hofKetua, hofKabinet]);

  const hofLeaderFiltered = React.useMemo(() => {
    if (hofLeaderFilter === "semua") return hofLeaderCards;
    return hofLeaderCards.filter(c => c.kabinetNama === hofLeaderFilter);
  }, [hofLeaderCards, hofLeaderFilter]);

  // Journey (HIMA IP Journey) photo CRUD
  async function addJourneyPhoto(file) {
    const src = await compressImage(file, 700, 0.8);
    const maxU = hofJourney.reduce((m, j) => Math.max(m, j.urutan || 0), 0);
    const row = { id: "hj_" + Date.now(), urutan: maxU + 1, foto: src, deskripsi: "" };
    await db.insert("hof_journey", row);
    setHofJourney(j => [...j, row]);
  }
  async function saveEditJourney(id, data) {
    await db.update("hof_journey", id, data);
    setHofJourney(j => j.map(x => x.id === id ? { ...x, ...data } : x));
    setEditingJourney(null);
  }
  async function deleteJourneyPhoto(id) {
    if (!confirm("Hapus foto kegiatan ini?")) return;
    await db.delete("hof_journey", id);
    setHofJourney(j => j.filter(x => x.id !== id));
  }
  async function moveJourneyPhoto(id, dir) {
    const sorted = [...hofJourney].sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
    const idx = sorted.findIndex(x => x.id === id);
    const swapIdx = idx + dir;
    if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx], b = sorted[swapIdx];
    const aU = a.urutan, bU = b.urutan;
    await Promise.all([db.update("hof_journey", a.id, { urutan: bU }), db.update("hof_journey", b.id, { urutan: aU })]);
    setHofJourney(j => j.map(x => x.id === a.id ? { ...x, urutan: bU } : x.id === b.id ? { ...x, urutan: aU } : x));
  }
  const hofJourneySorted = React.useMemo(() => [...hofJourney].sort((a, b) => (a.urutan || 0) - (b.urutan || 0)), [hofJourney]);

  // Press & hold a kabinet logo: after 5s, open identity popup (name, filosofi, periode, logo)
  function hofLogoPressStart(kab) {
    setHofPressedLogo(kab);
    clearTimeout(hofHoldTimer.current);
    hofHoldTimer.current = setTimeout(() => {
      setHofIdentityPopup(kab);
    }, 5000);
  }
  function hofLogoPressEnd() {
    clearTimeout(hofHoldTimer.current);
    setHofPressedLogo(null);
    // popup identitas TIDAK ditutup di sini — biarkan terbuka sampai user tap tombol ✕
  }

  const totalPhotos = Object.values(photosByEvent).reduce((a, b) => a + b.length, 0);

  const pageKey = tab + ":" + (activeEvent || "") + ":" + (activeFolder || "");

  return (
    <div style={S.page}>
      <style>{`
        @keyframes pageFadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .page-fade-wrap { animation: pageFadeIn 0.75s cubic-bezier(0.4,0,0.2,1); }
        @keyframes siteIntroFade { 0% { opacity:0; } 12% { opacity:1; } 78% { opacity:1; } 100% { opacity:0; } }
        .site-intro-anim { animation: siteIntroFade 2.2s ease forwards; }
        @keyframes siteIntroTextIn { from { opacity:0; transform:translateY(14px); letter-spacing:2px; } to { opacity:1; transform:translateY(0); letter-spacing:1px; } }
        .site-intro-text-anim { animation: siteIntroTextIn 1s cubic-bezier(0.4,0,0.2,1) both; }
        @keyframes pageTransitionFade { 0% { opacity:0; } 15% { opacity:1; } 85% { opacity:1; } 100% { opacity:0; } }
        .page-transition-anim { animation: pageTransitionFade 2s ease forwards; }
        @keyframes pageTransitionTextIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .page-transition-text-anim { animation: pageTransitionTextIn 0.8s cubic-bezier(0.4,0,0.2,1) 0.25s both; }
        .music-link { color:#1DB954; font-weight:600; text-decoration:none; cursor:pointer; max-width:190px; display:inline-block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; vertical-align:bottom; transition:color 0.15s ease; }
        .music-link:hover { color:#2FE271; text-decoration:underline; }
        @keyframes hofSlideNext { from { opacity:0; transform:translateX(50px) scale(0.96); } to { opacity:1; transform:translateX(0) scale(1); } }
        @keyframes hofSlidePrev { from { opacity:0; transform:translateX(-50px) scale(0.96); } to { opacity:1; transform:translateX(0) scale(1); } }
        .hof-slide-next { animation: hofSlideNext 0.4s ease; }
        .hof-slide-prev { animation: hofSlidePrev 0.4s ease; }
        @keyframes hofMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .hof-marquee-track { display:flex; width:max-content; animation: hofMarquee 22s linear infinite; }
        @keyframes hofQuoteFade { 0% { opacity:0; } 12% { opacity:1; } 88% { opacity:1; } 100% { opacity:0; } }
        .hof-quote-anim { animation: hofQuoteFade 3s ease; }
      `}</style>

      {siteIntro && (
        <div style={S.siteIntroOverlay} className="site-intro-anim">
          <div style={S.siteIntroText} className="site-intro-text-anim">
            Welcome to HIMA IP STISIP Tasikmalaya website
          </div>
        </div>
      )}

      {pageTransition && (
        <div
          key={pageTransition.quote}
          style={pageTransition.theme === "dark" ? S.pageTransitionOverlayDark : S.pageTransitionOverlayLight}
          className="page-transition-anim"
        >
          <div style={S.pageTransitionQuote} className="page-transition-text-anim">"{pageTransition.quote}"</div>
        </div>
      )}

      <header style={S.header}>
        <div style={S.headerLeft}>
          <button style={S.hamburger} onClick={() => setMenuOpen(!menuOpen)}>
            <span style={S.bar}/><span style={S.bar}/><span style={S.bar}/>
          </button>
          {isAdmin && <button style={{...S.adminBtnHeader,background:C.navy,marginRight:8}} onClick={openChangePin}>Ganti PIN</button>}
          <button style={S.adminBtnHeader} onClick={() => isAdmin ? setShowLogoutConfirm(true) : setShowLogin(true)}>
            {isAdmin ? "Keluar Admin" : "Masuk Admin"}
          </button>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <button style={S.searchIconBtn} onClick={() => setSearchOpen(o => !o)} title="Cari">🔍</button>
          <div style={{...S.headerTitle, cursor:"pointer"}} onClick={() => navigate("beranda")}>
            WEBSITE ARSIP HIMA IP
          </div>
        </div>
      </header>

      {searchOpen && (
        <div style={S.searchPanel}>
          <input
            autoFocus
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Escape" && setSearchOpen(false)}
            placeholder="Cari kegiatan, anggota, pengumuman, atau berkas..."
            style={S.searchInput}
          />
          <div style={S.searchResults}>
            {searchQuery.trim().length === 0 && <div style={S.searchEmpty}>Ketik kata kunci untuk mencari di seluruh website...</div>}
            {searchQuery.trim().length > 0 && searchResults.length === 0 && <div style={S.searchEmpty}>Tidak ada hasil untuk "{searchQuery}"</div>}
            {searchResults.map(r => (
              <div key={r.key} style={S.searchResultItem} onClick={() => { r.onClick(); setSearchOpen(false); setSearchQuery(""); }}>
                <span style={S.searchResultBadge}>{r.type}</span>
                <span style={S.searchResultText}>{r.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {menuOpen && (
        <div style={S.drawerOverlay} onClick={() => setMenuOpen(false)}>
          <div style={S.drawer} onClick={e => e.stopPropagation()}>
            <div style={S.drawerTitle}>HIMA IP</div>
            {[["beranda","Beranda"],["galeri","Galeri Kegiatan"],["anggota","Anggota"],["tentang","Tentang HIMA IP"],["hof","Hall of Fame"],["lpj","BERKAS"],["pcard","Playing Card"]].map(([key,label]) => (
              <button key={key} style={{...S.drawerItem,...(tab===key?S.drawerItemActive:{})}} onClick={() => navigate(key)}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {showLogin && (
        <div style={S.modalOverlay} onClick={() => setShowLogin(false)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>Akses Admin</div>
            <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="Email admin" style={{...S.input,marginBottom:10}} autoFocus />
            <div style={{position:"relative"}}>
              <input type={showPass ? "text" : "password"} value={codeInput} onChange={e => setCodeInput(e.target.value)} onKeyDown={e => e.key==="Enter" && tryLogin()} placeholder="Password" style={{...S.input, paddingRight:44}} />
              <button type="button" onClick={() => setShowPass(p => !p)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:18,opacity:0.6}}>{showPass ? "🙈" : "👁️"}</button>
            </div>
            {loginError && <div style={S.errorText}>{loginError}</div>}
            <div style={{display:"flex",gap:10,marginTop:14}}>
              <button onClick={tryLogin} style={S.primaryBtn} disabled={loggingIn}>{loggingIn ? "Memeriksa…" : "Masuk"}</button>
              <button onClick={() => setShowLogin(false)} style={S.ghostBtn}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {showWelcome && (
        <div style={S.modalOverlay} onClick={() => setShowWelcome(false)}>
          <div style={{...S.modalBox,textAlign:"center"}} onClick={e => e.stopPropagation()}>
            <div style={{fontSize:52,marginBottom:10}}>🎉💥</div>
            <div style={{fontFamily:"Georgia,serif",fontWeight:700,fontSize:20,color:C.navy,marginBottom:10}}>SELAMAT!</div>
            <div style={{fontWeight:700,fontSize:14,color:C.red,letterSpacing:1,marginBottom:16}}>ANDA SEKARANG MEMILIKI AKSES ADMIN</div>
            <p style={{fontSize:13,color:C.muted,marginBottom:20}}>Kamu bisa menambah kegiatan, upload foto, dan kelola LPJ sekarang.</p>
            <button onClick={async () => { setShowWelcome(false); try { const isSet = await rpcCall("pin_is_set"); if (!isSet) { setPinStage("enter"); setPinValue(""); setPinFirstEntry(""); setShowPinSetup(true); } } catch(e) {} }} style={S.primaryBtn}>Siap! 🚀</button>
          </div>
        </div>
      )}

      {showPinLock && (
        <div style={S.modalOverlay}>
          <div style={{...S.modalBox,textAlign:"center"}} onClick={e => e.stopPropagation()}>
            <div style={{fontSize:36,marginBottom:6}}>🔒</div>
            <div style={S.modalTitle}>Masukkan PIN</div>
            <p style={{fontSize:12.5,color:C.muted,marginBottom:18}}>Masukkan PIN 6 digit untuk membuka mode admin di perangkat ini.</p>
            <PinPad value={pinValue} error={pinError} onDigit={handlePinLockDigit} onBackspace={() => setPinValue(v => v.slice(0,-1))} />
            <button onClick={forgotPin} style={{...S.ghostBtn,marginTop:22,width:"100%"}}>Lupa PIN? Login ulang</button>
          </div>
        </div>
      )}

      {showPinSetup && (
        <div style={S.modalOverlay}>
          <div style={{...S.modalBox,textAlign:"center"}} onClick={e => e.stopPropagation()}>
            <div style={{fontSize:36,marginBottom:6}}>🔢</div>
            <div style={S.modalTitle}>{pinStage === "enter" ? "Buat PIN Admin" : "Konfirmasi PIN"}</div>
            <p style={{fontSize:12.5,color:C.muted,marginBottom:18}}>{pinStage === "enter" ? "Buat PIN 6 digit supaya lebih cepat masuk mode admin di perangkat ini." : "Ketik ulang PIN yang sama untuk konfirmasi."}</p>
            <PinPad value={pinValue} error={pinError} onDigit={handlePinSetupDigit} onBackspace={() => setPinValue(v => v.slice(0,-1))} />
            <button onClick={skipPinSetup} style={{...S.ghostBtn,marginTop:22,width:"100%"}}>Lewati, tanya lagi nanti</button>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div style={S.modalOverlay} onClick={() => setShowLogoutConfirm(false)}>
          <div style={{...S.modalBox,textAlign:"center"}} onClick={e => e.stopPropagation()}>
            <div style={{fontSize:44,marginBottom:10}}>🤔</div>
            <div style={{fontFamily:"Georgia,serif",fontWeight:700,fontSize:18,color:C.navy,marginBottom:12}}>APA ANDA YAKIN INGIN KELUAR DARI MODE ADMIN?</div>
            <p style={{fontSize:13,color:C.muted,marginBottom:20}}>Setelah keluar, kamu tidak bisa upload atau hapus konten sampai masuk lagi.</p>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button onClick={doLogout} style={S.primaryBtn}>Ya, Keluar</button>
              <button onClick={() => setShowLogoutConfirm(false)} style={S.ghostBtn}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {editingEvent && (
        <div style={S.modalOverlay} onClick={() => setEditingEvent(null)}>
          <div style={{...S.modalBox,textAlign:"left"}} onClick={e => e.stopPropagation()}>
            <div style={{...S.modalTitle,textAlign:"center"}}>Edit Kegiatan</div>
            <input style={{...S.input,marginBottom:10}} placeholder="Nama kegiatan" defaultValue={editingEvent.name} onChange={e => setEditingEvent(ev => ({...ev,name:e.target.value}))} />
            <input style={{...S.input,marginBottom:10}} type="date" defaultValue={editingEvent.date} onChange={e => setEditingEvent(ev => ({...ev,date:e.target.value}))} />
            <textarea style={{...S.input,minHeight:60,resize:"vertical",marginBottom:14}} placeholder="Deskripsi" defaultValue={editingEvent.description} onChange={e => setEditingEvent(ev => ({...ev,description:e.target.value}))} />
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button style={S.primaryBtn} onClick={() => saveEditEvent(editingEvent.id,{name:editingEvent.name,date:editingEvent.date,description:editingEvent.description})}>Simpan</button>
              <button style={S.ghostBtn} onClick={() => setEditingEvent(null)}>Batal</button>
            </div>
          </div>
        </div>
      )}
      {editingMember && (
        <div style={S.modalOverlay} onClick={() => setEditingMember(null)}>
          <div style={{...S.modalBox,textAlign:"left"}} onClick={e => e.stopPropagation()}>
            <div style={{...S.modalTitle,textAlign:"center"}}>Edit Anggota</div>
            <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
              <div style={{width:120,aspectRatio:"3/4",borderRadius:8,overflow:"hidden",background:"#f0ebe0",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {editingMember.photo ? <img src={editingMember.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} /> : <span style={{fontSize:32,opacity:0.4}}>📷</span>}
              </div>
            </div>
            <input ref={editMemberPhotoRef} type="file" accept="image/*" style={{display:"none"}} onChange={e => {
              const file = e.target.files[0]; if (!file) return;
              compressImage(file, 400, 0.8).then(src => setEditingMember(m => ({...m,photo:src})));
            }} />
            <button style={{...S.ghostBtn,marginBottom:14,width:"100%"}} onClick={() => editMemberPhotoRef.current.click()}>{editingMember.photo ? "Ganti Foto" : "Tambah Foto"}</button>
            <input style={{...S.input,marginBottom:10}} placeholder="Nama" defaultValue={editingMember.name} onChange={e => setEditingMember(m => ({...m,name:e.target.value}))} />
            <input style={{...S.input,marginBottom:10}} placeholder="NPM" defaultValue={editingMember.npm} onChange={e => setEditingMember(m => ({...m,npm:e.target.value}))} />
            <input style={{...S.input,marginBottom:10}} placeholder="Jabatan" defaultValue={editingMember.jabatan} onChange={e => setEditingMember(m => ({...m,jabatan:e.target.value}))} />
            <input style={{...S.input,marginBottom:10}} placeholder="Semester" defaultValue={editingMember.semester} onChange={e => setEditingMember(m => ({...m,semester:e.target.value}))} />
            <input style={{...S.input,marginBottom:10}} placeholder="Music Fav. (mis. Shape Of My Heart - Backstreet Boys)" defaultValue={editingMember.music_fav} onChange={e => setEditingMember(m => ({...m,music_fav:e.target.value}))} />
            <input style={{...S.input,marginBottom:14}} placeholder="Link lagu Spotify (open.spotify.com/track/...)" defaultValue={editingMember.music_link} onChange={e => setEditingMember(m => ({...m,music_link:e.target.value}))} />
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button style={S.primaryBtn} onClick={() => saveEditMember(editingMember.id,{name:editingMember.name,npm:editingMember.npm,jabatan:editingMember.jabatan,semester:editingMember.semester,music_fav:editingMember.music_fav,music_link:editingMember.music_link,photo:editingMember.photo})}>Simpan</button>
              <button style={S.ghostBtn} onClick={() => setEditingMember(null)}>Batal</button>
            </div>
          </div>
        </div>
      )}
      {editingAnnouncement && (
        <div style={S.modalOverlay} onClick={() => setEditingAnnouncement(null)}>
          <div style={{...S.modalBox,textAlign:"left"}} onClick={e => e.stopPropagation()}>
            <div style={{...S.modalTitle,textAlign:"center"}}>Edit Pengumuman</div>
            <input style={{...S.input,marginBottom:10}} placeholder="Judul pengumuman" defaultValue={editingAnnouncement.title} onChange={e => setEditingAnnouncement(a => ({...a,title:e.target.value}))} />
            <input style={{...S.input,marginBottom:10}} type="date" defaultValue={editingAnnouncement.date} onChange={e => setEditingAnnouncement(a => ({...a,date:e.target.value}))} />
            <div style={{fontSize:12,color:C.muted,marginBottom:8}}>{editingAnnouncement.file_name ? `Berkas saat ini: ${editingAnnouncement.file_name}` : "Belum ada berkas"}</div>
            <input ref={editAnnounceFileRef} type="file" accept=".pdf,image/*" style={{display:"none"}} onChange={e => {
              const file = e.target.files[0]; if (!file) return;
              const isImage = file.type.startsWith("image/");
              (isImage ? compressImage(file,1200,0.75) : fileToDataUrl(file)).then(file_url => setEditingAnnouncement(a => ({...a,file_url,file_name:file.name})));
            }} />
            <button style={{...S.ghostBtn,marginBottom:14,width:"100%"}} onClick={() => editAnnounceFileRef.current.click()}>Ganti Berkas / PDF</button>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button style={S.primaryBtn} onClick={() => saveEditAnnouncement(editingAnnouncement.id,{title:editingAnnouncement.title,date:editingAnnouncement.date,file_url:editingAnnouncement.file_url,file_name:editingAnnouncement.file_name})}>Simpan</button>
              <button style={S.ghostBtn} onClick={() => setEditingAnnouncement(null)}>Batal</button>
            </div>
          </div>
        </div>
      )}
      {lightbox && (
        <div style={S.lightboxOverlay} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" style={S.lightboxImg} onClick={e => e.stopPropagation()} />
        </div>
      )}

      {editingKetua && (
        <div style={S.modalOverlay} onClick={() => setEditingKetua(null)}>
          <div style={{...S.modalBox,maxWidth:420,textAlign:"left"}} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>Edit Periode Ketua</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <input style={S.input} placeholder="Periode (mis. 2023-2024)" value={editingKetua.periode || ""} onChange={e => setEditingKetua(k => ({...k, periode: e.target.value}))} />

              <div style={S.hofEditSection}>
                <div style={S.hofEditSectionTitle}>Ketua</div>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <div style={S.hofEditPhotoPreview}>
                    {editingKetua.ketua_foto ? <img src={editingKetua.ketua_foto} alt="" style={S.hofEditPhotoImg} /> : <div style={{...S.hofPhotoEmpty,fontSize:22}}>👤</div>}
                  </div>
                  <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
                    <input style={S.input} placeholder="Nama Ketua" value={editingKetua.ketua_nama || ""} onChange={e => setEditingKetua(k => ({...k, ketua_nama: e.target.value}))} />
                    <input style={S.input} placeholder="NPM Ketua" value={editingKetua.ketua_npm || ""} onChange={e => setEditingKetua(k => ({...k, ketua_npm: e.target.value}))} />
                  </div>
                </div>
                <input ref={ketuaFotoRef} type="file" accept="image/*" style={{display:"none"}} onChange={e => e.target.files[0] && compressImage(e.target.files[0], 400, 0.8).then(src => setEditingKetua(k => ({...k, ketua_foto: src})))} />
                <div style={{display:"flex",gap:10,marginTop:10}}>
                  <button style={{...S.ghostBtn,flex:1}} onClick={() => ketuaFotoRef.current.click()}>{editingKetua.ketua_foto ? "Ganti Foto Ketua" : "Pilih Foto Ketua"}</button>
                  <button style={S.deleteLink} onClick={clearKetuaRole}>Hapus Kartu Ketua</button>
                </div>
                <input style={{...S.input,marginTop:10}} placeholder="Link Media Sosial Ketua (opsional)" value={editingKetua.ketua_medsos || ""} onChange={e => setEditingKetua(k => ({...k, ketua_medsos: e.target.value}))} />
              </div>

              <div style={S.hofEditSection}>
                <div style={S.hofEditSectionTitle}>Wakil Ketua</div>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <div style={S.hofEditPhotoPreview}>
                    {editingKetua.wakil_foto ? <img src={editingKetua.wakil_foto} alt="" style={S.hofEditPhotoImg} /> : <div style={{...S.hofPhotoEmpty,fontSize:22}}>👤</div>}
                  </div>
                  <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
                    <input style={S.input} placeholder="Nama Wakil" value={editingKetua.wakil_nama || ""} onChange={e => setEditingKetua(k => ({...k, wakil_nama: e.target.value}))} />
                    <input style={S.input} placeholder="NPM Wakil" value={editingKetua.wakil_npm || ""} onChange={e => setEditingKetua(k => ({...k, wakil_npm: e.target.value}))} />
                  </div>
                </div>
                <input ref={wakilFotoRef} type="file" accept="image/*" style={{display:"none"}} onChange={e => e.target.files[0] && compressImage(e.target.files[0], 400, 0.8).then(src => setEditingKetua(k => ({...k, wakil_foto: src})))} />
                <div style={{display:"flex",gap:10,marginTop:10}}>
                  <button style={{...S.ghostBtn,flex:1}} onClick={() => wakilFotoRef.current.click()}>{editingKetua.wakil_foto ? "Ganti Foto Wakil" : "Pilih Foto Wakil"}</button>
                  <button style={S.deleteLink} onClick={clearWakilRole}>Hapus Kartu Wakil</button>
                </div>
                <input style={{...S.input,marginTop:10}} placeholder="Link Media Sosial Wakil (opsional)" value={editingKetua.wakil_medsos || ""} onChange={e => setEditingKetua(k => ({...k, wakil_medsos: e.target.value}))} />
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:16,alignItems:"center",flexWrap:"wrap"}}>
              <button style={S.primaryBtn} onClick={() => saveEditKetua(editingKetua.id, {periode:editingKetua.periode, ketua_nama:editingKetua.ketua_nama, ketua_npm:editingKetua.ketua_npm, ketua_foto:editingKetua.ketua_foto, ketua_medsos:editingKetua.ketua_medsos, wakil_nama:editingKetua.wakil_nama, wakil_npm:editingKetua.wakil_npm, wakil_foto:editingKetua.wakil_foto, wakil_medsos:editingKetua.wakil_medsos})}>Simpan</button>
              <button style={S.ghostBtn} onClick={() => setEditingKetua(null)}>Batal</button>
              <button style={S.ghostBtn} onClick={() => moveKetuaPeriode(editingKetua.id, -1)}>↑ Naik</button>
              <button style={S.ghostBtn} onClick={() => moveKetuaPeriode(editingKetua.id, 1)}>↓ Turun</button>
              <button style={{...S.deleteLink,marginLeft:"auto"}} onClick={() => { deleteKetuaPeriode(editingKetua.id); setEditingKetua(null); }}>Hapus Periode Ini</button>
            </div>
          </div>
        </div>
      )}

      {editingKabinet && (
        <div style={S.modalOverlay} onClick={() => setEditingKabinet(null)}>
          <div style={{...S.modalBox,maxWidth:420,textAlign:"left"}} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>Edit Kabinet</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <input style={S.input} placeholder="Nama Kabinet" value={editingKabinet.nama_kabinet || ""} onChange={e => setEditingKabinet(k => ({...k, nama_kabinet: e.target.value}))} />
              <input style={S.input} placeholder="Periode (mis. 2023-2024)" value={editingKabinet.periode || ""} onChange={e => setEditingKabinet(k => ({...k, periode: e.target.value}))} />
              <select style={S.input} value={editingKabinet.ketua_periode || ""} onChange={e => setEditingKabinet(k => ({...k, ketua_periode: e.target.value}))}>
                <option value="">-- Hubungkan ke Periode Ketua --</option>
                {hofKetua.map(k => <option key={k.id} value={k.periode}>{k.periode}</option>)}
              </select>
              <textarea style={{...S.input,minHeight:100,resize:"vertical"}} placeholder="Filosofi kabinet" value={editingKabinet.filosofi || ""} onChange={e => setEditingKabinet(k => ({...k, filosofi: e.target.value}))} />
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                <div style={S.hofEditPhotoPreview}>
                  {editingKabinet.logo ? <img src={editingKabinet.logo} alt="" style={S.hofEditPhotoImg} /> : <div style={{...S.hofPhotoEmpty,fontSize:22}}>🛡️</div>}
                </div>
                <input ref={kabinetLogoRef} type="file" accept="image/*" style={{display:"none"}} onChange={e => e.target.files[0] && compressImagePNG(e.target.files[0], 500).then(src => setEditingKabinet(k => ({...k, logo: src})))} />
                <button style={{...S.ghostBtn,flex:1}} onClick={() => kabinetLogoRef.current.click()}>{editingKabinet.logo ? "Ganti Logo" : "Pilih Logo"}</button>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:16,alignItems:"center"}}>
              <button style={S.primaryBtn} onClick={() => saveEditKabinet(editingKabinet.id, {nama_kabinet:editingKabinet.nama_kabinet, periode:editingKabinet.periode, ketua_periode:editingKabinet.ketua_periode, filosofi:editingKabinet.filosofi, logo:editingKabinet.logo})}>Simpan</button>
              <button style={S.ghostBtn} onClick={() => setEditingKabinet(null)}>Batal</button>
              <button style={{...S.deleteLink,marginLeft:"auto"}} onClick={() => { deleteKabinet(editingKabinet.id); setEditingKabinet(null); }}>Hapus</button>
            </div>
          </div>
        </div>
      )}

      {showKelolaKabinet && (
        <div style={S.modalOverlay} onClick={() => setShowKelolaKabinet(false)}>
          <div style={{...S.modalBox,maxWidth:460}} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>Kelola Data Kabinet</div>
            <div style={{fontSize:12.5,color:C.muted,marginBottom:14}}>Data ini jadi sumber logo marquee &amp; identitas kabinet di section pembuka Hall of Fame. Gunakan logo PNG transparan.</div>
            <div style={{display:"flex",flexDirection:"column",gap:14,textAlign:"left"}}>
              {hofKabinetSorted.map(k => (
                <div key={k.id} style={S.hofKabinetItem}>
                  <div style={S.hofCardCorner1} />
                  <div style={S.hofCardCorner2} />
                  <div style={S.hofKabinetLogoWrap}>
                    {k.logo ? <img src={k.logo} alt={k.nama_kabinet} style={S.hofKabinetLogoImg} /> : <div style={S.hofKabinetLogoEmpty}>🛡️</div>}
                  </div>
                  <div style={S.hofKabinetInfo}>
                    <div style={S.hofKabinetName}>{k.nama_kabinet || "Nama Kabinet"}</div>
                    <div style={S.hofKabinetPeriode}>{k.periode ? "Periode " + k.periode : "-"}</div>
                    <div style={{display:"flex",gap:14,marginTop:8}}>
                      <button style={S.deleteLink} onClick={() => setEditingKabinet(k)}>Edit</button>
                      <button style={S.deleteLink} onClick={() => deleteKabinet(k.id)}>Hapus</button>
                    </div>
                  </div>
                </div>
              ))}
              {hofKabinetSorted.length === 0 && <div style={{fontSize:13.5,color:C.muted,textAlign:"center",padding:"10px 0"}}>Belum ada data kabinet.</div>}
            </div>
            <div style={{display:"flex",gap:10,marginTop:18}}>
              <button style={{...S.primaryBtn,flex:1}} onClick={addKabinet}>+ Tambah Kabinet</button>
              <button style={S.ghostBtn} onClick={() => setShowKelolaKabinet(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {editingJourney && (
        <div style={S.modalOverlay} onClick={() => setEditingJourney(null)}>
          <div style={{...S.modalBox,maxWidth:400,textAlign:"left"}} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>Edit Foto Kegiatan</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={S.hofJourneyEditPreview}>
                {editingJourney.foto ? <img src={editingJourney.foto} alt="" style={S.hofEditPhotoImg} /> : <div style={{...S.hofPhotoEmpty,fontSize:26}}>🖼️</div>}
              </div>
              <input ref={journeyFotoRef} type="file" accept="image/*" style={{display:"none"}} onChange={e => e.target.files[0] && compressImage(e.target.files[0], 700, 0.8).then(src => setEditingJourney(j => ({...j, foto: src})))} />
              <button style={S.ghostBtn} onClick={() => journeyFotoRef.current.click()}>{editingJourney.foto ? "Ganti Foto" : "Pilih Foto"}</button>
              <textarea style={{...S.input,minHeight:100,resize:"vertical"}} placeholder="Deskripsi kegiatan" value={editingJourney.deskripsi || ""} onChange={e => setEditingJourney(j => ({...j, deskripsi: e.target.value}))} />
            </div>
            <div style={{display:"flex",gap:10,marginTop:16,alignItems:"center"}}>
              <button style={S.primaryBtn} onClick={() => saveEditJourney(editingJourney.id, {foto:editingJourney.foto, deskripsi:editingJourney.deskripsi})}>Simpan</button>
              <button style={S.ghostBtn} onClick={() => setEditingJourney(null)}>Batal</button>
              <button style={{...S.deleteLink,marginLeft:"auto"}} onClick={() => { deleteJourneyPhoto(editingJourney.id); setEditingJourney(null); }}>Hapus</button>
            </div>
          </div>
        </div>
      )}

      {hofExpandedCard && (
        <div style={S.hofExpandOverlay} onClick={() => setHofExpandedCard(null)}>
          <div style={S.hofExpandPanel} onClick={e => e.stopPropagation()}>
            <button style={S.hofExpandClose} onClick={() => setHofExpandedCard(null)}>✕</button>
            <div style={S.hofExpandPhotoWrap}>
              {hofExpandedCard.foto ? <img src={hofExpandedCard.foto} alt="" style={S.hofExpandPhotoImg} /> : <div style={{fontSize:60,opacity:0.3}}>👤</div>}
            </div>
            <div style={S.hofExpandName}>{hofExpandedCard.nama || "Belum diisi"}</div>
            <div style={S.hofExpandRole}>{hofExpandedCard.role === "ketua" ? "Ketua" : "Wakil Ketua"} · {hofExpandedCard.periodeLabel}</div>
            {hofExpandedCard.npm && <div style={S.hofExpandNpm}>NPM {hofExpandedCard.npm}</div>}
            {hofExpandedCard.kabinetNama && <div style={S.hofExpandKabinet}>Kabinet {hofExpandedCard.kabinetNama}</div>}
            {hofExpandedCard.medsos && <a href={hofExpandedCard.medsos} target="_blank" rel="noreferrer" style={S.hofExpandMedsos}>Lihat Media Sosial ↗</a>}
            {isAdmin && (
              <button style={{...S.ghostBtn,marginTop:14}} onClick={() => { setEditingKetua(hofKetua.find(k => k.id === hofExpandedCard.periode)); setHofExpandedCard(null); }}>Edit Kartu Ini</button>
            )}
          </div>
        </div>
      )}

      {hofIdentityPopup && (
        <div style={S.hofExpandOverlay}>
          <div style={S.hofExpandPanel} onClick={e => e.stopPropagation()}>
            <button style={S.hofExpandClose} onClick={() => setHofIdentityPopup(null)}>✕</button>
            <div style={S.hofExpandPhotoWrap}>
              {hofIdentityPopup.logo ? <img src={hofIdentityPopup.logo} alt="" style={{...S.hofExpandPhotoImg,objectFit:"contain",background:"#fff"}} /> : <div style={{fontSize:60,opacity:0.3}}>🛡️</div>}
            </div>
            <div style={S.hofExpandName}>{hofIdentityPopup.nama_kabinet || "Nama Kabinet"}</div>
            {hofIdentityPopup.periode && <div style={S.hofExpandRole}>Periode {hofIdentityPopup.periode}</div>}
            <div style={{...S.hofExpandNpm,textAlign:"left",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{hofIdentityPopup.filosofi || "Filosofi kabinet belum diisi."}</div>
          </div>
        </div>
      )}


      {hofQuoteOverlay && (
        <div style={S.hofQuoteOverlay} className="hof-quote-anim">
          <div style={S.hofQuoteOverlayText}>"{hofQuoteOverlay}"</div>
        </div>
      )}

      <div key={pageKey} className="page-fade-wrap">
      {tab === "beranda" && (
        <>
          <div style={S.hero}>
            <video autoPlay loop muted playsInline style={S.heroVideo}>
              <source src="/video-himaip.mp4" type="video/mp4" />
            </video>
            <div style={S.heroOverlay} />
            <div style={S.heroCenter}>
              <div style={S.heroEyebrow}>HIMA IP — CAKRA SAMAGRA</div>
              <h1 style={S.heroTitle}>Bersama Almamater,<br/>Berkarya untuk Bangsa</h1>
              <button style={S.discoverBtn} onClick={scrollToContent}>What about ↓</button>
              <button style={{...S.discoverBtn,marginTop:10}} onClick={scrollToAnnounce}>PENGUMUMAN ↓</button>
            </div>
          </div>
          <div ref={contentRef}>
            <div style={S.kabinetSection}>
              <div style={S.kabinetEyebrow}>HIMPUNAN MAHASISWA ILMU PEMERINTAHAN</div>
              <div style={S.kabinetLogoRow}>
                <img src="/logo-kabinet.png" alt="Logo Cakra Samagra" style={S.kabinetLogo} onError={e => e.target.style.display="none"} />
                <div>
                  <div style={S.kabinetName}>CAKRA SAMAGRA</div>
                  <div style={S.kabinetPeriode}>Periode 2026 - 2027</div>
                </div>
              </div>
              <div style={S.kabinetQuote}>
                "Di pusaran harapan, kami bertumbuh dalam keikhlasan,<br/>
                melangkah bersama, menyatukan bangsa dalam panduan."<br/>
                <em>Bersama Almamater, berkarya untuk bangsa.</em>
              </div>
              <div style={S.statSection}>
                <StatCard num={events.length} label="Kegiatan" />
                <StatCard num={totalPhotos} label="Foto" />
                <StatCard num={members.length} label="Anggota" />
              </div>
            </div>
            <div ref={announceRef} style={S.announceSection}>
              <div style={S.announceInner}>
              <div style={S.announceLabel}>PENGUMUMAN</div>
              <div style={S.announceDivider} />
              {isAdmin && (
                <div style={S.formCard}>
                  <div style={S.formCardTitle}>+ Buat Pengumuman</div>
                  <div style={S.formRow}>
                    <input style={S.input} placeholder="Judul pengumuman" value={newAnnounceTitle} onChange={e => setNewAnnounceTitle(e.target.value)} />
                    <input style={S.input} type="date" value={newAnnounceDate} onChange={e => setNewAnnounceDate(e.target.value)} />
                  </div>
                  <input ref={announceFileRef} type="file" accept=".pdf,image/*" style={{display:"none"}} onChange={e => e.target.files.length && addAnnouncement(e.target.files)} />
                  <button style={{...S.primaryBtn,marginTop:12}} disabled={busy} onClick={() => announceFileRef.current.click()}>{busy ? "Mengunggah…" : "Pilih File / PDF"}</button>
                </div>
              )}
              {announcements.length === 0 ? <div style={{...S.emptyState,color:"#999"}}>Belum ada pengumuman.</div> : (
                <div style={S.announceList}>
                  {announcements.map(a => (
                    <div key={a.id} style={S.announceItem}>
                      <div style={S.announceDate}>{formatDate(a.date)}</div>
                      <div style={S.announceRow}>
                        <div style={S.announceTitleWrap}>
                          <span style={{marginRight:6}}>🔊</span>
                          <span style={S.announceTitle}>{a.title}</span>
                        </div>
                        <a href={a.file_url} target="_blank" rel="noreferrer" style={S.announceLink}>LIHAT PDF</a>
                      </div>
                      {a.file_name && <div style={S.announceFileName}>{a.file_name}</div>}
                      {isAdmin && (
                        <div style={{display:"flex",gap:10,marginTop:6}}>
                          <button style={S.deleteLink} onClick={() => setEditingAnnouncement(a)}>Edit</button>
                          <button style={S.deleteLink} onClick={() => deleteAnnouncement(a.id)}>Hapus</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              </div>
            </div>
            <div style={S.visiSection}>
              <div style={S.visiInner}>
                <SectionHeader eyebrow="ORGANISASI" title="Visi" light />
                <p style={S.visiText}>Menjadikan Himpunan Mahasiswa Ilmu Pemerintahan sebagai wadah yang aspiratif, advokasi, serta membangun kerjasama berkoordinatif dengan organisasi intra dan ekstra dan menjadikan organisasi katalisator untuk kepentingan seluruh mahasiswa dilingkungan prodi Ilmu Pemerintahan.</p>
                <SectionHeader eyebrow="ORGANISASI" title="Misi" light />
                <ul style={S.misiList}>
                  <li>Menjadikan Himpunan Mahasiswa Ilmu Pemerintahan sebagai wadah yang aspitarif dalam menampung, menyalurkan, dan memperjuangkan aspirasi seluruh mahasiswa Ilmu Pemerintahan.</li>
                  <li>Menguatkan peran advokasi mahasiswa terhadap isu-isu akademik sosial dan kebijakan yang berdampak pada kepentingan mahasiswa.</li>
                  <li>Membangun dan mempererat kerja sama yang berkoordinatif dan berkelanjutan dengan organisasi intra atau ekstra.</li>
                  <li>Menjadikan mahasiswa Ilmu Pemerintahan sebagai katalisator gerakan mahasiswa Ilmu Pemerintahan yang berorientasi pada kepentingan bersama dan kemajuan mahasiswa secara kolektif.</li>
                  <li>Mendorong terciptanya organisasi yang inklusif, partisipatif, dan responsif terhadap dinamika bersama.</li>
                </ul>
                <SectionHeader eyebrow="IDENTITAS" title="Makna Logo" light />
                <div style={S.maknaLogoList}>
                  <div style={S.maknaLogoItem}>
                    <div style={S.maknaLogoIconWrap}>
                      <img src="/makna-logo-pusaran.png" alt="Pusaran" style={S.maknaLogoIcon} onError={e => e.target.style.display="none"} />
                    </div>
                    <p style={S.maknaLogoItemText}>Representasi dari (<strong style={{color:C.gold}}>Cakram</strong>) atau pusaran air yang berputar menuju inti yang berada di tengah, dan 5 (lima) pilar mewakili misi.</p>
                  </div>
                  <div style={S.maknaLogoItem}>
                    <div style={S.maknaLogoIconWrap}>
                      <img src="/makna-logo-titik.png" alt="Titik Tengah" style={S.maknaLogoIcon} onError={e => e.target.style.display="none"} />
                    </div>
                    <p style={S.maknaLogoItemText}>Titik tengah adalah organisasi itu sendiri yang dikelilingi oleh pusaran dan dijaga oleh 5 (lima) pilar.</p>
                  </div>
                  <div style={S.maknaLogoItem}>
                    <div style={S.maknaLogoIconWrap}>
                      <img src="/makna-logo-lengkung.png" alt="Garis Lengkung" style={S.maknaLogoIcon} onError={e => e.target.style.display="none"} />
                    </div>
                    <p style={S.maknaLogoItemText}>Garis lengkung bagian luar melambangkan pelindung dan merupakan pusaran paling kuat.</p>
                  </div>
                  <div style={S.maknaLogoItem}>
                    <div style={S.maknaLogoIconWrap}>
                      <img src="/makna-logo-warna.png" alt="Warna Emas" style={S.maknaLogoIcon} onError={e => e.target.style.display="none"} />
                    </div>
                    <p style={{...S.maknaLogoItemText,marginBottom:0}}>Warna <strong style={{color:C.gold}}>emas</strong> melambangkan kemewahan, kekayaan, dan kemakmuran menjadikannya simbol kekuasaan.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "galeri" && !activeEvent && (
        <main style={S.main}>
          {loading ? <div style={S.emptyState}>Memuat data...</div> : (
            <>
              <SectionHeader eyebrow="ARSIP VISUAL" title="Galeri Kegiatan" />
              {isAdmin && (
                <div style={S.formCard}>
                  <div style={S.formCardTitle}>+ Tambah Kegiatan Baru</div>
                  <div style={S.formRow}>
                    <input style={S.input} placeholder="Nama kegiatan" value={newEventName} onChange={e => setNewEventName(e.target.value)} />
                    <input style={S.input} type="date" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} />
                  </div>
                  <textarea style={{...S.input,marginTop:10,minHeight:60,resize:"vertical"}} placeholder="Deskripsi singkat (opsional)" value={newEventDesc} onChange={e => setNewEventDesc(e.target.value)} />
                  <button style={{...S.primaryBtn,marginTop:12}} onClick={addEvent}>Simpan Kegiatan</button>
                </div>
              )}
              {events.length === 0 ? <div style={S.emptyState}>Belum ada kegiatan.</div> : (
                <div style={S.eventGrid}>
                  {events.map(ev => {
                    const photos = photosByEvent[ev.id] || []; const cover = photos[0]?.src;
                    return (
                      <div key={ev.id} style={S.eventCard} onClick={() => openEvent(ev.id)}>
                        <div style={S.eventCover}>
                          {cover ? <img src={cover} alt={ev.name} style={S.eventCoverImg} /> : <div style={S.eventCoverEmpty}>Belum ada foto</div>}
                          <div style={S.eventCoverBadge}>{photos.length} foto</div>
                        </div>
                        <div style={S.eventCardBody}>
                          <div style={S.eventCardName}>{ev.name}</div>
                          {ev.date && <div style={S.eventCardDate}>{formatDate(ev.date)}</div>}
                          {isAdmin && <div style={{display:"flex",gap:10}}><button style={S.deleteLink} onClick={e => {e.stopPropagation();setEditingEvent(ev);}}>Edit</button><button style={S.deleteLink} onClick={e => {e.stopPropagation();deleteEvent(ev.id);}}>Hapus</button></div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
      )}

      {tab === "galeri" && activeEvent && (() => {
        const event = events.find(e => e.id === activeEvent);
        const photos = photosByEvent[activeEvent] || [];
        if (!event) return null;
        return (
          <main style={S.main}>
            <button style={S.backBtn} onClick={() => window.history.back()}>← Kembali ke Galeri</button>
            <SectionHeader eyebrow={event.date ? formatDate(event.date) : "KEGIATAN"} title={event.name} />
            {event.description && <p style={S.eventDesc}>{event.description}</p>}
            {isAdmin && (
              <div style={{marginBottom:26}}>
                <input ref={photoInputRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e => e.target.files.length && uploadPhotos(activeEvent, e.target.files)} />
                <button style={S.primaryBtn} disabled={busy} onClick={() => photoInputRef.current.click()}>{busy ? "Mengunggah…" : "+ Unggah Foto"}</button>
              </div>
            )}
            {photos.length === 0 ? <div style={S.emptyState}>Belum ada foto.</div> : (
              <div style={S.photoGrid}>
                {photos.map(p => (
                  <div key={p.id} style={S.photoTile}>
                    <img src={p.src} alt="" style={S.photoImg} onClick={() => setLightbox(p.src)} />
                    {isAdmin && (
                      <>
                        <div style={{position:"absolute",top:6,left:6,display:"flex",gap:3}}>
                          <button title="Pindah ke kiri/atas" style={{position:"static",background:"rgba(27,42,69,0.85)",color:C.white,border:"none",borderRadius:4,width:24,height:24,fontSize:12,cursor:"pointer"}} onClick={() => movePhoto(activeEvent,p.id,"up")}>◀</button>
                          <button title="Pindah ke kanan/bawah" style={{position:"static",background:"rgba(27,42,69,0.85)",color:C.white,border:"none",borderRadius:4,width:24,height:24,fontSize:12,cursor:"pointer"}} onClick={() => movePhoto(activeEvent,p.id,"down")}>▶</button>
                        </div>
                        <button title="Hapus foto" style={S.photoDeleteBtn} onClick={() => deletePhoto(activeEvent,p.id)}>✕</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </main>
        );
      })()}

      {tab === "anggota" && (
        <main style={S.main}>
          <SectionHeader eyebrow="KEPENGURUSAN" title="Daftar Anggota" />
          {isAdmin && (
            <div style={S.formCard}>
              <div style={S.formCardTitle}>+ Tambah Anggota</div>
              <div style={S.formRow}>
                <input style={S.input} placeholder="Nama lengkap" value={newMember.name} onChange={e => setNewMember(m=>({...m,name:e.target.value}))} />
                <input style={S.input} placeholder="NPM" value={newMember.npm} onChange={e => setNewMember(m=>({...m,npm:e.target.value}))} />
              </div>
              <div style={{...S.formRow,marginTop:10}}>
                <input style={S.input} placeholder="Jabatan" value={newMember.jabatan} onChange={e => setNewMember(m=>({...m,jabatan:e.target.value}))} />
                <input style={S.input} placeholder="Semester" value={newMember.semester} onChange={e => setNewMember(m=>({...m,semester:e.target.value}))} />
              </div>
              <div style={{...S.formRow,marginTop:10}}>
                <input style={S.input} placeholder="Music Fav. (mis. Shape Of My Heart - Backstreet Boys)" value={newMember.music_fav} onChange={e => setNewMember(m=>({...m,music_fav:e.target.value}))} />
                <input style={S.input} placeholder="Link lagu Spotify (opsional)" value={newMember.music_link} onChange={e => setNewMember(m=>({...m,music_link:e.target.value}))} />
              </div>
              <input ref={memberPhotoRef} type="file" accept="image/*" style={{display:"none"}} onChange={e => {
                const file = e.target.files[0]; if (!file) return;
                compressImage(file, 400, 0.8).then(src => setNewMember(m=>({...m,photo:src})));
              }} />
              <button style={{...S.ghostBtn,marginTop:10}} onClick={() => memberPhotoRef.current.click()}>{newMember.photo ? "Foto dipilih ✓" : "Pilih Foto"}</button>
              <button style={{...S.primaryBtn,marginTop:12}} onClick={addMember}>Simpan Anggota</button>
            </div>
          )}
          {members.length === 0 ? <div style={S.emptyState}>Belum ada anggota.</div> : (
            <div style={S.memberGrid}>
              {members.map(m => (
                <div key={m.id} style={S.memberCard}>
                  <div style={S.memberPhotoWrap}>
                    {m.photo ? <img src={m.photo} alt={m.name} style={S.memberPhoto} /> : <div style={S.memberPhotoEmpty}>📷</div>}
                  </div>
                  <div style={S.memberName}>{m.name}</div>
                  <div style={S.memberRow}><span style={S.memberLabel}>NPM</span><span>{m.npm||"-"}</span></div>
                  <div style={S.memberRow}><span style={S.memberLabel}>Jabatan</span><span>{m.jabatan||"-"}</span></div>
                  <div style={S.memberRow}><span style={S.memberLabel}>Semester</span><span>{m.semester||"-"}</span></div>
                  {m.music_fav && (
                    <div style={S.memberRow}>
                      <span style={S.memberLabel}>🎵 Music Fav.</span>
                      {m.music_link ? (
                        <a href={m.music_link} target="_blank" rel="noreferrer" className="music-link" title={`${m.music_fav} — 🎵 Buka di Spotify`}>{m.music_fav}</a>
                      ) : (
                        <span style={{color:"#1DB954",fontWeight:600,maxWidth:190,display:"inline-block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",verticalAlign:"bottom"}} title={m.music_fav}>{m.music_fav}</span>
                      )}
                    </div>
                  )}
                  {isAdmin && <div style={{display:"flex",gap:10,marginTop:8}}><button style={S.deleteLink} onClick={() => setEditingMember(m)}>Edit</button><button style={S.deleteLink} onClick={() => deleteMember(m.id)}>Hapus</button></div>}
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {tab === "tentang" && (
        <>
          <div style={S.tentangHero}>
            <img src="/foto-hero-tentang.jpg" alt="" style={S.tentangHeroImg} onError={e => e.target.style.display="none"} />
            <div style={S.tentangHeroOverlay} />
            <div style={S.tentangHeroContent}>
              <img src="/logo-hima-ip.png" alt="Logo HIMA IP" style={S.tentangHeroLogo} onError={e => e.target.style.display="none"} />
              <div>
                <div style={S.tentangHeroEyebrow}>Tentang</div>
                <div style={S.tentangHeroTitle}>HIMA IP</div>
              </div>
            </div>
            <div style={S.tentangHeroDesc}>
              Mengenal HIMA IP lebih dekat sebagai organisasi mahasiswa yang tumbuh bersama semangat kepemimpinan, kolaborasi, dan pengabdian bagi Program Studi Ilmu Pemerintahan STISIP Tasikmalaya.
            </div>
          </div>

          <main style={{...S.main, paddingTop:50}}>
            {/* Sejarah */}
            <div style={S.sejarahRow}>
              <div style={S.sejarahText}>
                <div style={S.sejarahHeadRow}>
                  <div style={S.sejarahIconBox}><IconHistory /></div>
                  <h2 style={S.sejarahTitle}>Sejarah HIMA IP</h2>
                </div>
                <p style={S.sejarahBody}>
                  Himpunan Mahasiswa Program Studi Ilmu Pemerintahan (HIMA IP) STISIP Tasikmalaya merupakan organisasi kemahasiswaan yang menjadi wadah pengembangan potensi, kepemimpinan, dan pengabdian mahasiswa Program Studi Ilmu Pemerintahan. HIMA IP resmi berdiri pada 28 Oktober 2017 dan hingga saat ini terus berperan aktif dalam mendukung kegiatan akademik maupun non-akademik di lingkungan STISIP Tasikmalaya.
                </p>
              </div>
              <div style={S.sejarahBadge}>
                <div style={S.sejarahBadgeIcon}><IconCalendar /></div>
                <div>
                  <div style={S.sejarahBadgeLabel}>Didirikan pada</div>
                  <div style={S.sejarahBadgeDate}>28 Oktober 2017</div>
                </div>
              </div>
            </div>

            {/* Identitas & Landasan */}
            <div style={S.darkPanel}>
              <div style={S.twoColGrid}>
                <div>
                  <h3 style={S.darkPanelTitle}>Identitas Organisasi</h3>
                  {[
                    ["Nama","Himpunan Mahasiswa Ilmu Pemerintahan"],
                    ["Singkatan","HIMA IP"],
                    ["Kedudukan","Program Studi Ilmu Pemerintahan STISIP Tasikmalaya"],
                    ["Didirikan","28 Oktober 2017"],
                    ["Keanggotaan","16 Orang (Seluruh Mahasiswa Aktif Program Studi Ilmu Pemerintahan)"],
                  ].map(([label,val]) => (
                    <div key={label} style={S.identRow}>
                      <div style={S.identLabel}>{label}</div>
                      <div style={S.identColon}>:</div>
                      <div style={S.identVal}>{val}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <h3 style={S.darkPanelTitle}>Landasan Organisasi</h3>
                  {[
                    [<IconGaruda key="g" />, "Landasan Idiil", "Pancasila"],
                    [<IconBook key="b" />, "Landasan Konstitusional", "UUD Negara Republik Indonesia tahun 1945"],
                    [<IconDoc key="d" />, "Landasan Operasional", "Berpedoman pada peraturan organisasi kemahasiswaan yang berlaku di STISIP Tasikmalaya"],
                  ].map(([icon,title,desc]) => (
                    <div key={title} style={S.landasanRow}>
                      <div style={S.landasanIcon}>{icon}</div>
                      <div>
                        <div style={S.landasanTitle}>{title}</div>
                        <div style={S.landasanDesc}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Asas & Tujuan */}
            <div style={S.twoColGrid}>
              <div>
                <h3 style={S.lightPanelTitle}>Asas Organisasi</h3>
                <div style={S.asasGrid}>
                  {[
                    [<IconDoor key="1" />, "Keterbukaan", "Menjunjung tinggi transparansi dalam menjalankan organisasi"],
                    [<IconScale key="2" />, "Keseimbangan", "Tidak berpihak pada kepentingan politik praktis"],
                    [<IconHandshake key="3" />, "Kebersamaan", "Mengutamakan persatuan dan kerja sama"],
                    [<IconBallot key="4" />, "Demokrasi", "Mengutamakan musyawarah dalam pengambilan keputusan"],
                  ].map(([icon,title,desc]) => (
                    <div key={title} style={S.asasCard}>
                      <div style={S.asasIcon}>{icon}</div>
                      <div style={S.asasTitle}>{title}</div>
                      <div style={S.asasDesc}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 style={S.lightPanelTitle}>Tujuan HIMA IP</h3>
                <div style={S.tujuanList}>
                  {[
                    "Mengembangkan potensi dan kreativitas mahasiswa.",
                    "Menciptakan suasana akademik yang dinamis.",
                    "Membangun solidaritas antar mahasiswa.",
                    "Mendorong inovasi dan pengembangan diri.",
                    "Berkontribusi bagi Program Studi, kampus, dan masyarakat.",
                  ].map((t,i) => (
                    <div key={i} style={S.tujuanItem}>
                      <span style={S.tujuanDot} />
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>

          {/* Fungsi */}
          <div style={S.fungsiSection}>
            <div style={S.fungsiInner}>
              <h3 style={S.fungsiTitle}>Fungsi HIMA IP</h3>
              <div style={S.fungsiGrid}>
                {[
                  [<IconChat key="1" />, "Aspiratif", "Menjadi wadah untuk menghimpun, menampung, dan menyalurkan aspirasi mahasiswa Program Studi Ilmu Pemerintahan secara konstruktif."],
                  [<IconShield key="2" />, "Advokatif", "Berperan dalam memperjuangkan hak, kepentingan, serta memberikan pendampingan terhadap mahasiswa sesuai ketentuan organisasi."],
                  [<IconUsersGear key="3" />, "Koordinatif", "Menjalin komunikasi, koordinasi, dan kerja sama dengan civitas akademika maupun organisasi kemahasiswaan lainnya demi tercapainya tujuan bersama."],
                  [<IconRocket key="4" />, "Katalisator & Fasilitator", "Menjadi penggerak sekaligus fasilitator dalam mendukung pengembangan potensi, kreativitas, serta kualitas mahasiswa melalui berbagai program kerja organisasi."],
                ].map(([icon,title,desc]) => (
                  <div key={title} style={S.fungsiCard}>
                    <div style={S.fungsiIcon}>{icon}</div>
                    <div style={S.fungsiCardTitle}>{title}</div>
                    <div style={S.fungsiCardDesc}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quote penutup */}
          <div style={S.tentangQuoteBar}>
            "Bersama Almamater, Berkarya untuk Bangsa"
          </div>
        </>
      )}

      {tab === "hof" && (
        <div style={S.hofWrap}>
          <div style={S.hofHeroLabel}>
            <div style={S.hofHeroEyebrow}>THE HIMA IP JOURNEY</div>
            <div style={S.hofHeroTitle}>Hall of Fame</div>
          </div>

          <div style={S.hofDotNav}>
            {[["intro","Pembuka"],["journey","Journey"],["leadership","Kepemimpinan"]].map(([key,label]) => (
              <button key={key} style={{...S.hofNavDot, ...(hofActiveSection === key ? S.hofNavDotActive : {})}} onClick={() => hofGoToSection(key)} aria-label={label} title={label} />
            ))}
          </div>

          <div ref={el => (hofSectionRefs.current.intro = el)}>
            <HofParticleIntro
              kabinetList={hofKabinetSorted}
              pressedLogo={hofPressedLogo}
              onPressStart={hofLogoPressStart}
              onPressEnd={hofLogoPressEnd}
            />
            {isAdmin && (
              <div style={{textAlign:"center",margin:"18px 0 40px"}}>
                <button style={S.ghostBtn} onClick={() => setShowKelolaKabinet(true)}>Kelola Data Kabinet</button>
              </div>
            )}
          </div>

          <div ref={el => (hofSectionRefs.current.journey = el)} style={S.hofJourneySection}>
            <div style={S.hofSectionTitle}>HIMA IP Journey</div>
            <div style={S.hofSectionSub}>Jejak langkah &amp; momen perjalanan HIMA Ilmu Pemerintahan</div>
            {isAdmin && (
              <div style={{textAlign:"center",margin:"18px 0"}}>
                <input ref={journeyFotoRef} type="file" accept="image/*" style={{display:"none"}} onChange={e => e.target.files[0] && addJourneyPhoto(e.target.files[0])} />
                <button style={S.primaryBtn} onClick={() => journeyFotoRef.current.click()}>+ Tambah Foto Kegiatan</button>
              </div>
            )}
            {hofJourneySorted.length === 0 ? (
              <div style={S.emptyState}>Belum ada foto kegiatan.</div>
            ) : (
              <div style={S.hofJourneyList}>
                {hofJourneySorted.map((j, i) => (
                  <div key={j.id} style={{...S.hofJourneyRow, flexDirection: i % 2 === 0 ? "row" : "row-reverse"}}>
                    <div style={S.hofJourneyPhotoWrap}>
                      {j.foto ? <img src={j.foto} alt="" style={S.hofJourneyPhotoImg} /> : <div style={{fontSize:40,opacity:0.3}}>🖼️</div>}
                    </div>
                    <div style={S.hofJourneyDesc}>
                      <div style={S.hofJourneyDescText}>{j.deskripsi || "Belum ada deskripsi."}</div>
                      {isAdmin && (
                        <div style={{display:"flex",gap:12,marginTop:12,flexWrap:"wrap"}}>
                          <button style={S.deleteLink} onClick={() => setEditingJourney(j)}>Edit</button>
                          <button style={S.deleteLink} onClick={() => moveJourneyPhoto(j.id, -1)}>↑ Naik</button>
                          <button style={S.deleteLink} onClick={() => moveJourneyPhoto(j.id, 1)}>↓ Turun</button>
                          <button style={S.deleteLink} onClick={() => deleteJourneyPhoto(j.id)}>Hapus</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div ref={el => (hofSectionRefs.current.leadership = el)} style={S.hofLeaderSection}>
            <div style={S.hofSectionTitle}>Historical of Leadership</div>
            <div style={S.hofSectionSub}>Profil Riwayat Kepemimpinan HIMA IP</div>

            <div style={S.hofFilterRow}>
              <button style={{...S.hofFilterPill, ...(hofLeaderFilter === "semua" ? S.hofFilterPillActive : {})}} onClick={() => setHofLeaderFilter("semua")}>Semua Kabinet</button>
              {hofKabinetSorted.map(k => (
                <button key={k.id} style={{...S.hofFilterPill, ...(hofLeaderFilter === k.nama_kabinet ? S.hofFilterPillActive : {})}} onClick={() => setHofLeaderFilter(k.nama_kabinet)}>{k.nama_kabinet}</button>
              ))}
            </div>

            {isAdmin && (
              <div style={{textAlign:"center",margin:"18px 0"}}>
                <button style={S.primaryBtn} onClick={addKetuaPeriode}>+ Tambah Periode</button>
              </div>
            )}

            {hofLeaderFiltered.length === 0 ? (
              <div style={S.emptyState}>Belum ada data untuk kategori ini.</div>
            ) : (
              <div style={S.hofLeaderGrid}>
                {hofLeaderFiltered.map(c => (
                  <div key={c.id} style={S.hofLeaderCard} onClick={() => setHofExpandedCard(c)}>
                    <div style={S.hofCardCorner1} />
                    <div style={S.hofCardCorner2} />
                    <div style={S.hofLeaderPhotoWrap}>
                      {c.foto ? <img src={c.foto} alt={c.nama} style={S.hofLeaderPhotoImg} /> : <div style={{fontSize:36,opacity:0.3}}>👤</div>}
                    </div>
                    <div style={S.hofLeaderName}>{c.nama || "Belum diisi"}</div>
                    <div style={S.hofLeaderRole}>{c.role === "ketua" ? "Ketua" : "Wakil Ketua"} · {c.periodeLabel}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "lpj" && !isAdmin && (
        <main style={S.main}>
          <div style={{textAlign:"center",padding:"80px 20px"}}>
            <div style={{fontSize:56,marginBottom:18}}>🔒</div>
            <p style={{fontSize:15.5,lineHeight:1.8,color:C.muted,maxWidth:460,margin:"0 auto"}}>
              Halaman ini hanya dapat diakses oleh Administrator yang memiliki otorisasi resmi.<br/>
              Kamu menemukan pintunya, tetapi belum memiliki kuncinya🔑.
            </p>
          </div>
        </main>
      )}

      {tab === "lpj" && isAdmin && !activeFolder && (
        <main style={S.main}>
          <SectionHeader eyebrow="PERTANGGUNGJAWABAN" title="BERKAS" />
          <div style={S.formCard}>
            <div style={S.formCardTitle}>+ Buat Folder Baru</div>
            <div style={S.formRow}>
              <input style={S.input} placeholder="Nama folder (mis. LPJ Kegiatan A, Proposal, dst)" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => e.key==="Enter" && addFolder()} />
              <button style={S.primaryBtn} onClick={addFolder}>Buat Folder</button>
            </div>
          </div>
          {berkasFolders.length === 0 ? <div style={S.emptyState}>Belum ada folder.</div> : (
            <div style={S.eventGrid}>
              {berkasFolders.map(f => {
                const count = lpjDocs.filter(d => d.folder_id === f.id).length;
                return (
                  <div key={f.id} style={S.eventCard} onClick={() => openFolder(f.id)}>
                    <div style={S.eventCover}>
                      <div style={{...S.eventCoverEmpty,fontSize:44,opacity:0.6,fontStyle:"normal"}}>📁</div>
                      <div style={S.eventCoverBadge}>{count} berkas</div>
                    </div>
                    <div style={S.eventCardBody}>
                      <div style={S.eventCardName}>{f.name}</div>
                      <div style={{display:"flex",gap:10,marginTop:8}}>
                        <button style={S.deleteLink} onClick={e => {e.stopPropagation();deleteFolder(f.id);}}>Hapus Folder</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {tab === "lpj" && isAdmin && activeFolder && (() => {
        const folder = berkasFolders.find(f => f.id === activeFolder);
        const docsInFolder = lpjDocs.filter(d => d.folder_id === activeFolder);
        if (!folder) return null;
        return (
          <main style={S.main}>
            <button style={S.backBtn} onClick={() => window.history.back()}>← Kembali ke BERKAS</button>
            <SectionHeader eyebrow="FOLDER" title={folder.name} />
            <div style={S.formCard}>
              <div style={S.formCardTitle}>+ Unggah Berkas</div>
              <input style={S.input} placeholder="Judul berkas (opsional)" value={lpjTitle} onChange={e => setLpjTitle(e.target.value)} />
              <input ref={lpjFileInputRef} type="file" multiple style={{display:"none"}} onChange={e => e.target.files.length && uploadLpjFiles(activeFolder, e.target.files)} />
              <button style={{...S.primaryBtn,marginTop:12}} disabled={busy} onClick={() => lpjFileInputRef.current.click()}>{busy ? "Mengunggah…" : "Pilih Berkas / Foto"}</button>
            </div>
            {docsInFolder.length === 0 ? <div style={S.emptyState}>Belum ada berkas di folder ini.</div> : (
              <div style={S.docGrid}>
                {docsInFolder.map(d => (
                  <div key={d.id} style={S.docCard}>
                    {d.is_image ? <img src={d.data_url} alt={d.title} style={S.docThumb} onClick={() => setLightbox(d.data_url)} /> : <div style={S.docIconWrap} onClick={() => window.open(d.data_url,"_blank")}><DocIcon /></div>}
                    <div style={S.docBody}>
                      <div style={S.docTitle}>{d.title}</div>
                      <div style={S.docMeta}>{d.name} · {formatDate(d.date)}</div>
                      <div style={{display:"flex",gap:10,marginTop:6}}>
                        <a href={d.data_url} download={d.name} style={S.docLink}>Unduh</a>
                        <button style={S.deleteLink} onClick={() => deleteLpjDoc(d.id)}>Hapus</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        );
      })()}

      {tab === "pcard" && <PlayingCardPage isAdmin={isAdmin} />}

      </div>

      <footer style={S.footer}>
        <div style={S.footerTop}>
          <div style={S.footerBrand}>
            <div style={S.footerTitle}>HIMA IP — CAKRA SAMAGRA</div>
            <div style={S.footerSub}>Himpunan Mahasiswa Ilmu Pemerintahan STISIP Tasikmalaya · 2026–2027</div>
            <div style={{marginTop:16}}>
              <div style={S.footerSectionLabel}>📍 Lokasi Kampus</div>
              <a href="https://maps.google.com/?q=STISIP+Tasikmalaya" target="_blank" rel="noreferrer" style={S.gmapsLink}>STISIP Tasikmalaya — Buka di Google Maps</a>
            </div>
          </div>
          <div>
            <div style={S.footerSectionLabel}>Follow Us</div>
            <div style={S.footerSocials}>
              <a href="https://instagram.com/hima_ip_stisiptasik" target="_blank" rel="noreferrer" style={S.socialLink}>📸Instagram</a>
              <span style={S.socialSep}>|</span>
              <a href="https://tiktok.com/@hima_ip_stisiptasik" target="_blank" rel="noreferrer" style={S.socialLink}>🎵TikTok</a>
              <span style={S.socialSep}>|</span>
              <a href="mailto:himaipstisiptasik@gmail.com" target="_blank" rel="noreferrer" style={S.socialLink}>✉️Email</a>
            </div>
            <div style={S.visitorCounter}>
              <span>👁️</span>
              <span>{visitorCount !== null ? Number(visitorCount).toLocaleString("id-ID") : "…"} kali dikunjungi</span>
            </div>
          </div>
        </div>
        <div style={S.footerBottom}>© 2026 HIMA IP Cakra Samagra — STISIP Tasikmalaya</div>

      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} style={S.scrollTopBtn} title="Kembali ke atas">↑</button>
      )}
      </footer>
    </div>
  );
}


const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

const RARITY_CONFIG = [
  { name: "Common",   warna: "#3fa34d", poin: 1,  weight: 62.00 },
  { name: "Uncommon", warna: "#8a8a8a", poin: 3,  weight: 22.00 },
  { name: "Rare",     warna: "#2f6fd1", poin: 5,  weight: 10.00 },
  { name: "SR",       warna: "#8a3fd1", poin: 7,  weight: 4.45 },
  { name: "SSR",      warna: "#c9a227", poin: 8,  weight: 1.00 },
  { name: "UR",       warna: "#c62828", poin: 10, weight: 0.50 },
  { name: "SUR",      warna: "#6b1a1a", poin: 15, weight: 0 },
];

function pcRarityInfo(name) {
  return RARITY_CONFIG.find(r => r.name === name) || RARITY_CONFIG[0];
}

function PlayingCardPage({ isAdmin }) {
  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [screen, setScreen] = useState("setup"); // setup | playing | result

  // setup
  const [jumlahPemain, setJumlahPemain] = useState(2);
  const [namaPemain, setNamaPemain] = useState(["", ""]);
  const [pemainAktifAwal, setPemainAktifAwal] = useState(0);

  // sesi berjalan
  const [sessionId, setSessionId] = useState(null);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [scores, setScores] = useState({});
  const [usedCardIds, setUsedCardIds] = useState([]);
  const [surFound, setSurFound] = useState(false);

  const [turnPhase, setTurnPhase] = useState("pilih"); // pilih | dadu | swipe | reveal | pilihRekan
  const [chosenTipe, setChosenTipe] = useState(null);
  const [dice, setDice] = useState([1, 1]);
  const [rollingDice, setRollingDice] = useState(false);
  const [showingResult, setShowingResult] = useState(false);
  const [diceCountdown, setDiceCountdown] = useState(5);
  const [swipeTotal, setSwipeTotal] = useState(0);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [revealedCard, setRevealedCard] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [transferState, setTransferState] = useState(null); // { to, poin }
  const rollLockRef = useRef(false);

  // admin kelola kartu
  const [showKelolaKartu, setShowKelolaKartu] = useState(false);
  const [filterRarity, setFilterRarity] = useState("Common");
  const [newCard, setNewCard] = useState({ tipe: "truth", isi_challenge: "", gambar_depan: "", gambar_belakang: "" });
  const [editingCard, setEditingCard] = useState(null);
  const cardImgDepanRef = useRef(null);
  const cardImgBelakangRef = useRef(null);
  const editImgDepanRef = useRef(null);
  const editImgBelakangRef = useRef(null);

  // leaderboard
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  useEffect(() => { loadCards(); }, []);

  // Hitung mundur 5 detik menampilkan hasil dadu sebelum otomatis lanjut ke swipe
  useEffect(() => {
    if (!showingResult) return;
    if (diceCountdown <= 0) {
      setShowingResult(false);
      setTurnPhase("swipe");
      rollLockRef.current = false;
      return;
    }
    const t = setTimeout(() => setDiceCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [showingResult, diceCountdown]);

  async function loadCards() {
    setLoadingCards(true);
    try {
      const data = await db.get("playing_cards");
      setCards(Array.isArray(data) ? data : []);
    } catch (e) {}
    setLoadingCards(false);
  }

  async function loadLeaderboard() {
    setLoadingLeaderboard(true);
    try {
      const rows = await db.get("playing_leaderboard");
      const map = {};
      (Array.isArray(rows) ? rows : []).forEach(r => {
        if (!map[r.nama_pemain]) map[r.nama_pemain] = { nama: r.nama_pemain, total: 0, sesi: new Set() };
        map[r.nama_pemain].total += r.poin;
        map[r.nama_pemain].sesi.add(r.session_id);
      });
      const arr = Object.values(map).map(m => ({ nama: m.nama, total: m.total, kaliMain: m.sesi.size }));
      arr.sort((a, b) => b.total - a.total);
      setLeaderboardRows(arr);
    } catch (e) {}
    setLoadingLeaderboard(false);
  }

  function updateJumlahPemain(n) {
    n = Math.max(2, Math.min(20, n));
    setJumlahPemain(n);
    setNamaPemain(prev => {
      const arr = [...prev];
      while (arr.length < n) arr.push("");
      while (arr.length > n) arr.pop();
      return arr;
    });
  }

  function mulaiPermainan() {
    const namaFinal = namaPemain.map((n, i) => (n.trim() || `Pemain ${i + 1}`));
    setNamaPemain(namaFinal);
    const scoreInit = {};
    namaFinal.forEach(n => { scoreInit[n] = 0; });
    setScores(scoreInit);
    setCurrentPlayerIdx(pemainAktifAwal);
    setSessionId(crypto.randomUUID());
    setUsedCardIds([]);
    setSurFound(false);
    setTurnPhase("pilih");
    setChosenTipe(null);
    setTransferState(null);
    setScreen("playing");
  }

  function pilihTipe(tipe) {
    setChosenTipe(tipe);
    setTurnPhase("dadu");
  }

  // Kocok dadu: ~1.5 detik animasi kocokan (angka berkedip acak),
  // lalu hasil akhir ditampilkan diam selama 5 detik sebelum otomatis lanjut ke swipe.
  function kocokDadu() {
    if (rollLockRef.current) return;
    rollLockRef.current = true;
    setShowingResult(false);
    setRollingDice(true);

    const flickerInterval = setInterval(() => {
      setDice([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
    }, 90);

    setTimeout(() => {
      clearInterval(flickerInterval);
      const d1 = 1 + Math.floor(Math.random() * 6);
      const d2 = 1 + Math.floor(Math.random() * 6);
      setDice([d1, d2]);
      setSwipeTotal(d1 + d2);
      setSwipeProgress(0);
      setRollingDice(false);
      setDiceCountdown(5);
      setShowingResult(true);
      // rollLockRef dilepas otomatis oleh useEffect countdown di atas
    }, 1500);
  }

  function pickCardForTurn() {
    const pool = cards.filter(c => c.tipe === chosenTipe && !usedCardIds.includes(c.id));
    if (pool.length === 0) return null;
    if (!surFound) {
      const surPool = pool.filter(c => c.rarity === "SUR");
      if (surPool.length > 0 && Math.random() < 0.12) {
        return surPool[Math.floor(Math.random() * surPool.length)];
      }
    }
    const nonSur = pool.filter(c => c.rarity !== "SUR");
    const usePool = nonSur.length > 0 ? nonSur : pool;
    const weights = usePool.map(c => pcRarityInfo(c.rarity).weight || 1);
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < usePool.length; i++) {
      if (roll < weights[i]) return usePool[i];
      roll -= weights[i];
    }
    return usePool[usePool.length - 1];
  }

  function lanjutSwipe() {
    if (swipeProgress + 1 < swipeTotal) {
      setSwipeProgress(p => p + 1);
    } else {
      const card = pickCardForTurn();
      setRevealedCard(card);
      setFlipped(false);
      setTransferState(null);
      setTurnPhase("reveal");
    }
  }

  function bukaKartu() {
    setFlipped(true);
  }

  function tutupTurn(pemainDapatPoin, berhasil) {
    if (berhasil && revealedCard) {
      const poin = pcRarityInfo(revealedCard.rarity).poin;
      setScores(s => ({ ...s, [pemainDapatPoin]: (s[pemainDapatPoin] || 0) + poin }));
    }
    if (revealedCard) {
      setUsedCardIds(ids => [...ids, revealedCard.id]);
      if (revealedCard.rarity === "SUR") setSurFound(true);
    }
    setRevealedCard(null);
    setChosenTipe(null);
    setTransferState(null);
    setTurnPhase("pilih");
    setCurrentPlayerIdx(i => (i + 1) % namaPemain.length);
  }

  function selesaikanChallenge(berhasil) {
    tutupTurn(namaPemain[currentPlayerIdx], berhasil);
  }

  function berikanKeRekan(namaRekan) {
    const poin = pcRarityInfo(revealedCard.rarity).poin;
    const pemberi = namaPemain[currentPlayerIdx];
    setScores(s => ({ ...s, [pemberi]: (s[pemberi] || 0) - poin }));
    setTransferState({ to: namaRekan, poin });
    setTurnPhase("reveal");
  }

  function selesaikanTransfer(berhasil) {
    tutupTurn(transferState.to, berhasil);
  }

  async function akhiriPermainan() {
    try {
      const entries = Object.entries(scores);
      for (const [nama_pemain, poin] of entries) {
        await db.insert("playing_leaderboard", { nama_pemain, poin, session_id: sessionId });
      }
    } catch (e) {}
    setScreen("result");
  }

  function mainLagi() {
    setScreen("setup");
  }

  // ---- Admin: CRUD kartu ----
  async function tambahKartu() {
    if (!newCard.gambar_depan) return; // wajib ada desain kartu depan
    try {
      await db.insert("playing_cards", {
        rarity: filterRarity,
        tipe: newCard.tipe,
        isi_challenge: newCard.isi_challenge.trim() || "(tanpa catatan teks — sudah ada di desain kartu)",
        gambar_depan: newCard.gambar_depan,
        gambar_belakang: newCard.gambar_belakang || null,
      });
      setNewCard({ tipe: "truth", isi_challenge: "", gambar_depan: "", gambar_belakang: "" });
      loadCards();
    } catch (e) {}
  }
  async function simpanEditKartu() {
    if (!editingCard) return;
    try {
      await db.update("playing_cards", editingCard.id, {
        tipe: editingCard.tipe,
        isi_challenge: editingCard.isi_challenge,
        gambar_depan: editingCard.gambar_depan || null,
        gambar_belakang: editingCard.gambar_belakang || null,
      });
      setEditingCard(null);
      loadCards();
    } catch (e) {}
  }
  async function hapusKartu(id) {
    try { await db.delete("playing_cards", id); loadCards(); } catch (e) {}
  }

  const kartuFilterList = cards.filter(c => c.rarity === filterRarity);
  const totalKartuAktif = chosenTipe ? cards.filter(c => c.tipe === chosenTipe).length : 0;

  return (
    <main style={S.main}>
      <SectionHeader eyebrow="GAME KOMPETITIF" title="Playing Card" />

      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
        <button style={S.ghostBtn} onClick={() => { setShowLeaderboard(true); loadLeaderboard(); }}>🏆 Leaderboard All-Time</button>
        {isAdmin && <button style={S.ghostBtn} onClick={() => setShowKelolaKartu(true)}>⚙️ Kelola Deck Kartu</button>}
      </div>

      {loadingCards ? (
        <div style={S.emptyState}>Memuat data kartu…</div>
      ) : cards.length === 0 ? (
        <div style={S.emptyState}>Belum ada kartu di deck. {isAdmin ? "Tambahkan lewat Kelola Deck Kartu." : "Hubungi admin."}</div>
      ) : screen === "setup" ? (
        <PCSetup
          jumlahPemain={jumlahPemain}
          updateJumlahPemain={updateJumlahPemain}
          namaPemain={namaPemain}
          setNamaPemain={setNamaPemain}
          pemainAktifAwal={pemainAktifAwal}
          setPemainAktifAwal={setPemainAktifAwal}
          onMulai={mulaiPermainan}
        />
      ) : screen === "playing" ? (
        <PCGame
          namaPemain={namaPemain}
          scores={scores}
          currentPlayerIdx={currentPlayerIdx}
          turnPhase={turnPhase}
          chosenTipe={chosenTipe}
          dice={dice}
          rollingDice={rollingDice}
          showingResult={showingResult}
          diceCountdown={diceCountdown}
          swipeTotal={swipeTotal}
          swipeProgress={swipeProgress}
          revealedCard={revealedCard}
          flipped={flipped}
          transferState={transferState}
          totalKartuAktif={totalKartuAktif}
          onPilihTipe={pilihTipe}
          onKocokDadu={kocokDadu}
          onLanjutSwipe={lanjutSwipe}
          onBukaKartu={bukaKartu}
          onSelesaikanChallenge={selesaikanChallenge}
          onMintaTransfer={() => setTurnPhase("pilihRekan")}
          onBatalTransfer={() => setTurnPhase("reveal")}
          onBerikanKeRekan={berikanKeRekan}
          onSelesaikanTransfer={selesaikanTransfer}
          onAkhiri={akhiriPermainan}
        />
      ) : (
        <PCResult namaPemain={namaPemain} scores={scores} onMainLagi={mainLagi} />
      )}

      {showLeaderboard && (
        <div style={S.modalOverlay} onClick={() => setShowLeaderboard(false)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>🏆 Leaderboard All-Time</div>
            {loadingLeaderboard ? (
              <div style={S.emptyState}>Memuat…</div>
            ) : leaderboardRows.length === 0 ? (
              <div style={S.emptyState}>Belum ada histori permainan.</div>
            ) : (
              <div style={{ textAlign: "left", marginTop: 14 }}>
                {leaderboardRows.map((r, i) => (
                  <div key={r.nama} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #e0d8c8" }}>
                    <div>
                      <b>{i + 1}. {r.nama}</b>
                      <div style={{ fontSize: 11.5, color: C.muted }}>{r.kaliMain}x bermain</div>
                    </div>
                    <div style={{ fontWeight: 700, color: C.red }}>{r.total} poin</div>
                  </div>
                ))}
              </div>
            )}
            <button style={{ ...S.ghostBtn, marginTop: 16 }} onClick={() => setShowLeaderboard(false)}>Tutup</button>
          </div>
        </div>
      )}

      {showKelolaKartu && isAdmin && (
        <div style={S.modalOverlay} onClick={() => setShowKelolaKartu(false)}>
          <div style={{ ...S.modalBox, maxWidth: 480, textAlign: "left" }} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>⚙️ Kelola Deck Kartu</div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "14px 0" }}>
              {RARITY_CONFIG.map(r => (
                <button
                  key={r.name}
                  onClick={() => setFilterRarity(r.name)}
                  style={{
                    padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${r.warna}`,
                    background: filterRarity === r.name ? r.warna : "transparent",
                    color: filterRarity === r.name ? "#fff" : r.warna,
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {r.name}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 10 }}>
              {kartuFilterList.length} kartu {filterRarity} tersimpan · {pcRarityInfo(filterRarity).poin} poin/kartu · Ukuran gambar disarankan 750×1050px
            </div>

            <div style={S.formCard}>
              <div style={S.formCardTitle}>+ Tambah Kartu {filterRarity}</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button onClick={() => setNewCard(c => ({ ...c, tipe: "truth" }))} style={{ ...S.ghostBtn, flex: 1, ...(newCard.tipe === "truth" ? S.primaryBtn : {}) }}>Truth</button>
                <button onClick={() => setNewCard(c => ({ ...c, tipe: "dare" }))} style={{ ...S.ghostBtn, flex: 1, ...(newCard.tipe === "dare" ? S.primaryBtn : {}) }}>Dare</button>
              </div>

              <input ref={cardImgDepanRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => e.target.files[0] && compressImage(e.target.files[0], 900, 0.85).then(src => setNewCard(c => ({ ...c, gambar_depan: src })))} />
              <button style={{ ...S.ghostBtn, width: "100%", marginBottom: 8 }} onClick={() => cardImgDepanRef.current.click()}>
                {newCard.gambar_depan ? "✓ Desain Depan Terpasang — Ganti" : "+ Desain Kartu Depan (wajib)"}
              </button>
              {newCard.gambar_depan && <img src={newCard.gambar_depan} alt="" style={{ width: 90, borderRadius: 6, display: "block", margin: "0 auto 10px" }} />}

              <input ref={cardImgBelakangRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => e.target.files[0] && compressImage(e.target.files[0], 900, 0.85).then(src => setNewCard(c => ({ ...c, gambar_belakang: src })))} />
              <button style={{ ...S.ghostBtn, width: "100%", marginBottom: 10 }} onClick={() => cardImgBelakangRef.current.click()}>
                {newCard.gambar_belakang ? "✓ Desain Belakang Terpasang — Ganti" : "+ Desain Kartu Belakang (opsional)"}
              </button>
              {newCard.gambar_belakang && <img src={newCard.gambar_belakang} alt="" style={{ width: 90, borderRadius: 6, display: "block", margin: "0 auto 10px" }} />}

              <textarea style={{ ...S.input, minHeight: 50 }} placeholder="Catatan teks challenge (opsional, tidak tampil di kartu)…" value={newCard.isi_challenge} onChange={e => setNewCard(c => ({ ...c, isi_challenge: e.target.value }))} />

              <button style={{ ...S.primaryBtn, marginTop: 10, width: "100%" }} onClick={tambahKartu}>Simpan Kartu</button>
            </div>

            <div style={{ marginTop: 16, maxHeight: 320, overflowY: "auto" }}>
              {kartuFilterList.map(c => (
                <div key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid #e0d8c8" }}>
                  {editingCard?.id === c.id ? (
                    <div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <button onClick={() => setEditingCard(ec => ({ ...ec, tipe: "truth" }))} style={{ ...S.ghostBtn, flex: 1, ...(editingCard.tipe === "truth" ? S.primaryBtn : {}) }}>Truth</button>
                        <button onClick={() => setEditingCard(ec => ({ ...ec, tipe: "dare" }))} style={{ ...S.ghostBtn, flex: 1, ...(editingCard.tipe === "dare" ? S.primaryBtn : {}) }}>Dare</button>
                      </div>
                      <input ref={editImgDepanRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => e.target.files[0] && compressImage(e.target.files[0], 900, 0.85).then(src => setEditingCard(ec => ({ ...ec, gambar_depan: src })))} />
                      <button style={{ ...S.ghostBtn, width: "100%", marginBottom: 8 }} onClick={() => editImgDepanRef.current.click()}>Ganti Desain Depan</button>
                      {editingCard.gambar_depan && <img src={editingCard.gambar_depan} alt="" style={{ width: 80, borderRadius: 6, display: "block", margin: "0 auto 8px" }} />}
                      <input ref={editImgBelakangRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => e.target.files[0] && compressImage(e.target.files[0], 900, 0.85).then(src => setEditingCard(ec => ({ ...ec, gambar_belakang: src })))} />
                      <button style={{ ...S.ghostBtn, width: "100%", marginBottom: 8 }} onClick={() => editImgBelakangRef.current.click()}>Ganti Desain Belakang</button>
                      {editingCard.gambar_belakang && <img src={editingCard.gambar_belakang} alt="" style={{ width: 80, borderRadius: 6, display: "block", margin: "0 auto 8px" }} />}
                      <textarea style={{ ...S.input, minHeight: 50 }} value={editingCard.isi_challenge} onChange={e => setEditingCard(ec => ({ ...ec, isi_challenge: e.target.value }))} />
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button style={S.primaryBtn} onClick={simpanEditKartu}>Simpan</button>
                        <button style={S.ghostBtn} onClick={() => setEditingCard(null)}>Batal</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {c.gambar_depan && <img src={c.gambar_depan} alt="" style={{ width: 44, borderRadius: 4, flexShrink: 0 }} />}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase" }}>{c.tipe}</div>
                        <div style={{ fontSize: 12.5 }}>{c.isi_challenge}</div>
                        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                          <button style={S.deleteLink} onClick={() => setEditingCard(c)}>Edit</button>
                          <button style={S.deleteLink} onClick={() => hapusKartu(c.id)}>Hapus</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {kartuFilterList.length === 0 && <div style={S.emptyState}>Belum ada kartu {filterRarity}.</div>}
            </div>

            <button style={{ ...S.ghostBtn, marginTop: 16, width: "100%" }} onClick={() => setShowKelolaKartu(false)}>Tutup</button>
          </div>
        </div>
      )}
    </main>
  );
}

// ---------------- Sub-komponen: Setup ----------------
function PCSetup({ jumlahPemain, updateJumlahPemain, namaPemain, setNamaPemain, pemainAktifAwal, setPemainAktifAwal, onMulai }) {
  return (
    <div style={S.formCard}>
      <div style={S.formCardTitle}>Setup Permainan</div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>Jumlah Pemain (2–20)</label>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <button style={S.ghostBtn} onClick={() => updateJumlahPemain(jumlahPemain - 1)}>–</button>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.red, minWidth: 30, textAlign: "center" }}>{jumlahPemain}</div>
          <button style={S.ghostBtn} onClick={() => updateJumlahPemain(jumlahPemain + 1)}>+</button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>Nama Pemain</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {namaPemain.map((n, i) => (
            <input
              key={i}
              style={S.input}
              placeholder={`Pemain ${i + 1}`}
              value={n}
              onChange={e => setNamaPemain(prev => prev.map((p, idx) => idx === i ? e.target.value : p))}
            />
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>Pemain Pertama</label>
        <select
          style={{ ...S.input, marginTop: 8 }}
          value={pemainAktifAwal}
          onChange={e => setPemainAktifAwal(Number(e.target.value))}
        >
          {namaPemain.map((n, i) => (
            <option key={i} value={i}>{n.trim() || `Pemain ${i + 1}`}</option>
          ))}
        </select>
      </div>

      <button style={{ ...S.primaryBtn, width: "100%" }} onClick={onMulai}>Mulai Permainan</button>
    </div>
  );
}

// ---------------- Sub-komponen: Game ----------------
function PCGame({
  namaPemain, scores, currentPlayerIdx, turnPhase, chosenTipe, dice, rollingDice, showingResult, diceCountdown,
  swipeTotal, swipeProgress, revealedCard, flipped, transferState, totalKartuAktif,
  onPilihTipe, onKocokDadu, onLanjutSwipe, onBukaKartu, onSelesaikanChallenge,
  onMintaTransfer, onBatalTransfer, onBerikanKeRekan, onSelesaikanTransfer, onAkhiri,
}) {
  const pemainSekarang = namaPemain[currentPlayerIdx];
  const rekanLain = namaPemain.filter((_, i) => i !== currentPlayerIdx);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 20 }}>
        {namaPemain.map((n, i) => (
          <div key={i} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 12.5, fontWeight: 700,
            background: i === currentPlayerIdx ? C.red : "#f0ebe0",
            color: i === currentPlayerIdx ? "#fff" : C.navy,
          }}>
            {n}: {scores[n] || 0}
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <button style={S.deleteLink} onClick={onAkhiri}>Akhiri Permainan &amp; Simpan Skor</button>
      </div>

      <div style={{ textAlign: "center", fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 700, color: C.navy, marginBottom: 24 }}>
        Giliran: {pemainSekarang}
      </div>

      {turnPhase === "pilih" && (
        <div style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 16, color: C.muted, fontSize: 14 }}>Pilih jenis challenge:</div>
          <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
            <button style={{ ...S.primaryBtn, padding: "16px 32px", fontSize: 16 }} onClick={() => onPilihTipe("truth")}>Truth</button>
            <button style={{ ...S.primaryBtn, padding: "16px 32px", fontSize: 16, background: C.navy }} onClick={() => onPilihTipe("dare")}>Dare</button>
          </div>
        </div>
      )}

      {turnPhase === "dadu" && (
        <div style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 16, color: C.muted, fontSize: 14 }}>
            {totalKartuAktif} kartu {chosenTipe} tersedia.
          </div>
          <div style={{ fontSize: 56, marginBottom: 10, letterSpacing: 10 }}>
            {DICE_FACES[dice[0] - 1]} {DICE_FACES[dice[1] - 1]}
          </div>
          {showingResult ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.navy }}>Total: {dice[0]} + {dice[1]} = {dice[0] + dice[1]} kartu</div>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>Lanjut otomatis dalam {diceCountdown} detik…</div>
            </div>
          ) : (
            <div style={{ height: 38 }} />
          )}
          <button style={S.primaryBtn} disabled={rollingDice || showingResult} onClick={onKocokDadu}>
            {rollingDice ? "Mengocok…" : showingResult ? "Menunggu…" : "Kocok Dadu"}
          </button>
        </div>
      )}

      {turnPhase === "swipe" && (
        <PCSwipeStack swipeTotal={swipeTotal} swipeProgress={swipeProgress} onLanjutSwipe={onLanjutSwipe} />
      )}

      {turnPhase === "reveal" && revealedCard && (
        <PCRevealCard
          card={revealedCard}
          flipped={flipped}
          onBukaKartu={onBukaKartu}
          transferState={transferState}
          pemainSekarang={pemainSekarang}
          onSelesaikanChallenge={onSelesaikanChallenge}
          onMintaTransfer={onMintaTransfer}
          onSelesaikanTransfer={onSelesaikanTransfer}
        />
      )}

      {turnPhase === "pilihRekan" && (
        <div style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 14, fontSize: 14, color: C.muted }}>
            Berikan challenge ini ke siapa? {pemainSekarang} akan kehilangan {pcRarityInfo(revealedCard.rarity).poin} poin.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 14 }}>
            {rekanLain.map(n => (
              <button key={n} style={S.ghostBtn} onClick={() => onBerikanKeRekan(n)}>{n}</button>
            ))}
          </div>
          <button style={S.deleteLink} onClick={onBatalTransfer}>Batal</button>
        </div>
      )}
    </div>
  );
}

// ---------------- Sub-komponen: Tumpukan Kartu Geser (swipe) ----------------
function PCSwipeStack({ swipeTotal, swipeProgress, onLanjutSwipe }) {
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState("left");

  const remaining = swipeTotal - swipeProgress; // termasuk kartu paling depan yang akan digeser

  function handleSwipe() {
    if (animating) return;
    const dir = swipeProgress % 2 === 0 ? "left" : "right";
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setAnimating(false);
      onLanjutSwipe();
    }, 380);
  }

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ marginBottom: 14, color: C.muted, fontSize: 14 }}>
        Kartu {swipeProgress + 1} dari {swipeTotal}
      </div>
      <div style={{ position: "relative", width: 170, height: 238, margin: "0 auto 22px" }}>
        {Array.from({ length: remaining }).map((_, idx) => {
          const depth = idx; // 0 = paling depan (yang sedang digeser)
          const isFront = depth === 0;
          const stackOffset = depth * 4;
          const rotate = (depth % 2 === 0 ? -1 : 1) * depth * 1.4;
          let style = {
            position: "absolute", inset: 0, borderRadius: 12,
            background: `linear-gradient(135deg, ${C.navy}, ${C.black})`,
            border: `2px solid ${C.gold}`,
            transform: `translate(${stackOffset}px, ${-stackOffset}px) rotate(${rotate}deg)`,
            transition: "transform 0.38s cubic-bezier(.2,.7,.3,1), opacity 0.38s ease",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: C.gold, fontFamily: "Georgia,serif", fontWeight: 700, fontSize: 13,
            zIndex: remaining - depth, boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
          };
          if (isFront && animating) {
            style = {
              ...style,
              transform: `translate(${direction === "left" ? -240 : 240}px, -40px) rotate(${direction === "left" ? -30 : 30}deg)`,
              opacity: 0,
            };
          }
          return <div key={`${remaining}-${idx}`} style={style}>{isFront ? "HIMA IP" : ""}</div>;
        })}
      </div>
      <button style={S.primaryBtn} disabled={animating} onClick={handleSwipe}>
        {swipeProgress + 1 < swipeTotal ? "Geser Kartu →" : "Buka Kartu Terakhir"}
      </button>
    </div>
  );
}

// ---------------- Sub-komponen: Kartu Reveal + Flip ----------------
function PCRevealCard({ card, flipped, onBukaKartu, transferState, pemainSekarang, onSelesaikanChallenge, onMintaTransfer, onSelesaikanTransfer }) {
  const rarity = pcRarityInfo(card.rarity);

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ perspective: 1200, margin: "0 auto 20px", width: 240, maxWidth: "80vw", aspectRatio: "5/7" }}>
        <div
          onClick={!flipped ? onBukaKartu : undefined}
          style={{
            width: "100%", height: "100%", position: "relative",
            transformStyle: "preserve-3d", transition: "transform 0.6s",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            cursor: !flipped ? "pointer" : "default",
          }}
        >
          {/* Belakang kartu (tampak sebelum dibuka) */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: 12, backfaceVisibility: "hidden",
            overflow: "hidden", border: `2px solid ${C.gold}`,
          }}>
            {card.gambar_belakang ? (
              <img src={card.gambar_belakang} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{
                width: "100%", height: "100%",
                background: `linear-gradient(135deg, ${C.navy}, ${C.black})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "Georgia,serif", fontSize: 15, color: C.gold, fontWeight: 700,
              }}>
                HIMA IP
              </div>
            )}
          </div>
          {/* Depan kartu — full desain hasil upload, tidak ada teks/label tambahan */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: 12, backfaceVisibility: "hidden",
            transform: "rotateY(180deg)", overflow: "hidden", border: `3px solid ${rarity.warna}`,
          }}>
            {card.gambar_depan ? (
              <img src={card.gambar_depan} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{
                width: "100%", height: "100%", background: "#FAF7F2", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: rarity.warna, textTransform: "uppercase", marginBottom: 6 }}>
                  {card.rarity} · {card.tipe}
                </div>
                <div style={{ fontSize: 13.5, color: "#1F1B16", fontWeight: 600 }}>{card.isi_challenge}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {!flipped ? (
        <div style={{ color: C.muted, fontSize: 13 }}>Ketuk kartu untuk membuka</div>
      ) : transferState ? (
        <div>
          <div style={{ marginBottom: 12, fontSize: 14, color: C.navy, fontWeight: 600 }}>
            Diberikan ke {transferState.to} — apakah berhasil dikerjakan?
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button style={S.primaryBtn} onClick={() => onSelesaikanTransfer(true)}>Selesai (+{rarity.poin})</button>
            <button style={S.ghostBtn} onClick={() => onSelesaikanTransfer(false)}>Tolak (0 poin)</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button style={S.primaryBtn} onClick={() => onSelesaikanChallenge(true)}>Selesai (+{rarity.poin})</button>
          <button style={S.ghostBtn} onClick={() => onSelesaikanChallenge(false)}>Tolak (0 poin)</button>
          <button style={{ ...S.ghostBtn, color: C.red, borderColor: C.red }} onClick={onMintaTransfer}>Berikan ke Rekan</button>
        </div>
      )}
    </div>
  );
}

// ---------------- Sub-komponen: Hasil Akhir ----------------
function PCResult({ namaPemain, scores, onMainLagi }) {
  const ranked = namaPemain.map(n => ({ nama: n, poin: scores[n] || 0 })).sort((a, b) => b.poin - a.poin);
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 24, fontWeight: 700, color: C.navy, marginBottom: 20 }}>
        🏆 Hasil Permainan
      </div>
      <div style={{ maxWidth: 360, margin: "0 auto 24px" }}>
        {ranked.map((r, i) => (
          <div key={r.nama} style={{
            display: "flex", justifyContent: "space-between", padding: "12px 16px", marginBottom: 8,
            borderRadius: 8, background: i === 0 ? C.gold : "#f0ebe0", color: i === 0 ? "#fff" : C.navy,
          }}>
            <div style={{ fontWeight: 700 }}>{i + 1}. {r.nama}</div>
            <div style={{ fontWeight: 700 }}>{r.poin} poin</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16 }}>Skor sudah tersimpan ke leaderboard all-time.</div>
      <button style={S.primaryBtn} onClick={onMainLagi}>Main Lagi</button>
    </div>
  );
}

function PinPad({ value, onDigit, onBackspace, error }) {
  const dots = [0,1,2,3,4,5];
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
      <div style={{display:"flex",gap:12,marginBottom:22}}>
        {dots.map(i => (
          <div key={i} style={{width:14,height:14,borderRadius:"50%",background:i < value.length ? "#1B2A45" : "transparent",border:"2px solid #1B2A45"}} />
        ))}
      </div>
      {error && <div style={{color:"#8C2E33",fontSize:13,marginBottom:10,fontWeight:600}}>{error}</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3, 62px)",gap:14}}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} onClick={() => onDigit(String(n))} style={{width:62,height:62,borderRadius:"50%",border:"1px solid #ddd3bd",background:"#FAF7F2",fontSize:22,fontWeight:600,color:"#1B2A45",cursor:"pointer"}}>{n}</button>
        ))}
        <div />
        <button onClick={() => onDigit("0")} style={{width:62,height:62,borderRadius:"50%",border:"1px solid #ddd3bd",background:"#FAF7F2",fontSize:22,fontWeight:600,color:"#1B2A45",cursor:"pointer"}}>0</button>
        <button onClick={onBackspace} style={{width:62,height:62,borderRadius:"50%",border:"none",background:"none",fontSize:20,cursor:"pointer",color:"#8C2E33"}}>⌫</button>
      </div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, light }) {
  return (
    <div style={{marginBottom:24}}>
      <div style={{fontFamily:"'Inter',sans-serif",fontSize:11,letterSpacing:3,color:light?"#B68A3D":"#8C2E33",fontWeight:600,textTransform:"uppercase",marginBottom:8}}>{eyebrow}</div>
      <h2 style={{fontFamily:"Georgia,serif",fontSize:32,fontWeight:700,margin:0,color:light?"#fff":"#1B2A45"}}>{title}</h2>
      <div style={{height:3,width:48,marginTop:14,marginBottom:24,background:light?"#B68A3D":"#1B2A45"}} />
    </div>
  );
}
function StatCard({ num, label }) {
  return (
    <div style={S.statCard}>
      <div style={S.statNum}>{String(num).padStart(2,"0")}</div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
}
function makeGlowTexture() {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const gctx = c.getContext("2d");
  const grad = gctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.6, "rgba(255,255,255,0.25)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function HofParticleIntro({ kabinetList, pressedLogo, onPressStart, onPressEnd }) {
  const canvasRef = useRef(null);
  const glRef = useRef(null); // { renderer, scene, camera, points, geometry, material, texture }
  const dataRef = useRef(null); // Float32Arrays + per-particle state
  const targetsRef = useRef(null); // shape target points in world space, or null (idle)
  const pointCacheRef = useRef({});
  const rafRef = useRef(null);
  const sizeRef = useRef({ w: 300, h: 400 });
  const rotYRef = useRef(0);

  const N = 3200; // jumlah partikel

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-150, 150, 200, -200, -1000, 1000);
    camera.position.z = 200;
    camera.lookAt(0, 0, 0);

    const texture = makeGlowTexture();
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: 5.5,
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      sizeAttenuation: false
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);
    glRef.current = { renderer, scene, camera, points, geometry, material, texture };

    let inited = false;
    function makeIdleParticles(w, h) {
      // anchor tersebar proporsional ke ukuran box asli (bukan angka tetap),
      // ini yang tadinya bikin partikel ngumpul jadi gumpalan sempit di kotak besar
      const idle = [];
      for (let i = 0; i < N; i++) {
        idle.push({
          ax: (Math.random() - 0.5) * w * 0.92,
          ay: (Math.random() - 0.5) * h * 0.92,
          az: (Math.random() - 0.5) * Math.min(w, h) * 0.3,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          vz: (Math.random() - 0.5) * 0.25,
          speed: 0.03 + Math.random() * 0.06,
          r: 210 + Math.random() * 35, g: 185 + Math.random() * 35, b: 120 + Math.random() * 50
        });
      }
      dataRef.current = {
        idle,
        curX: new Float32Array(N), curY: new Float32Array(N), curZ: new Float32Array(N),
        curR: new Float32Array(N), curG: new Float32Array(N), curB: new Float32Array(N)
      };
      for (let i = 0; i < N; i++) {
        dataRef.current.curX[i] = idle[i].ax;
        dataRef.current.curY[i] = idle[i].ay;
        dataRef.current.curZ[i] = idle[i].az;
        dataRef.current.curR[i] = idle[i].r;
        dataRef.current.curG[i] = idle[i].g;
        dataRef.current.curB[i] = idle[i].b;
      }
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width || 300, h = rect.height || 400;
      renderer.setSize(w, h, false);
      camera.left = -w / 2; camera.right = w / 2;
      camera.top = h / 2; camera.bottom = -h / 2;
      camera.updateProjectionMatrix();
      sizeRef.current = { w, h };
      if (!inited) { makeIdleParticles(w, h); inited = true; }
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let t = 0;
    function tick() {
      t += 0.016;
      const d = dataRef.current;
      const targets = targetsRef.current;
      const pos = geometry.attributes.position.array;
      const col = geometry.attributes.color.array;
      const hasShape = targets && targets.length;

      // kotak selalu diam (tidak muter); posisi tegak baik saat idle maupun saat logo ditekan
      rotYRef.current += (0 - rotYRef.current) * 0.08;
      points.rotation.y = rotYRef.current;

      const { w: boxW, h: boxH } = sizeRef.current;
      const boundX = boxW * 0.46, boundY = boxH * 0.46, boundZ = Math.min(boxW, boxH) * 0.15;

      for (let i = 0; i < N; i++) {
        const idl = d.idle[i];
        let tx, ty, tz, tr, tg, tb;
        if (hasShape) {
          const tp = targets[i % targets.length];
          const jitterSeed = i * 12.9898 + Math.floor(t * 2);
          const jitter = Math.sin(jitterSeed) * 1.6;
          tx = tp.x; ty = tp.y; tz = tp.z + jitter;
          tr = tp.r; tg = tp.g; tb = tp.b;
        } else {
          // gerak melayang acak: anchor berjalan dengan kecepatan sendiri,
          // sesekali belok arah secara acak, dan memantul saat kena batas kotak
          idl.ax += idl.vx;
          idl.ay += idl.vy;
          idl.az += idl.vz;
          if (Math.random() < 0.01) {
            idl.vx += (Math.random() - 0.5) * 0.35;
            idl.vy += (Math.random() - 0.5) * 0.35;
            idl.vz += (Math.random() - 0.5) * 0.18;
            const maxV = 0.65;
            idl.vx = Math.max(-maxV, Math.min(maxV, idl.vx));
            idl.vy = Math.max(-maxV, Math.min(maxV, idl.vy));
            idl.vz = Math.max(-maxV, Math.min(maxV, idl.vz));
          }
          if (idl.ax > boundX || idl.ax < -boundX) idl.vx *= -1;
          if (idl.ay > boundY || idl.ay < -boundY) idl.vy *= -1;
          if (idl.az > boundZ || idl.az < -boundZ) idl.vz *= -1;
          tx = idl.ax; ty = idl.ay; tz = idl.az;
          tr = idl.r; tg = idl.g; tb = idl.b;
        }
        const sp = idl.speed;
        d.curX[i] += (tx - d.curX[i]) * sp;
        d.curY[i] += (ty - d.curY[i]) * sp;
        d.curZ[i] += (tz - d.curZ[i]) * sp;
        d.curR[i] += (tr - d.curR[i]) * 0.08;
        d.curG[i] += (tg - d.curG[i]) * 0.08;
        d.curB[i] += (tb - d.curB[i]) * 0.08;

        pos[i * 3] = d.curX[i]; pos[i * 3 + 1] = d.curY[i]; pos[i * 3 + 2] = d.curZ[i];
        col[i * 3] = d.curR[i] / 255; col[i * 3 + 1] = d.curG[i] / 255; col[i * 3 + 2] = d.curB[i] / 255;
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      geometry.dispose(); material.dispose(); texture.dispose(); renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (!pressedLogo || !pressedLogo.logo) { targetsRef.current = null; return; }
    const cacheKey = pressedLogo.id;
    if (pointCacheRef.current[cacheKey]) { targetsRef.current = pointCacheRef.current[cacheKey]; return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const S = 128;
      const off = document.createElement("canvas");
      off.width = S; off.height = S;
      const octx = off.getContext("2d");
      const scale = Math.min(S / img.width, S / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      octx.clearRect(0, 0, S, S);
      octx.drawImage(img, (S - dw) / 2, (S - dh) / 2, dw, dh);
      let data;
      try { data = octx.getImageData(0, 0, S, S).data; } catch (e) { return; }
      const { w: curW, h: curH } = sizeRef.current;
      const boxSize = Math.min(curW, curH) * 0.72; // ukuran logo relatif ke ukuran box asli
      const cell = boxSize / S; // jarak antar grid, dipakai buat jitter biar nggak jadi garis-garis kaku
      const pts = [];
      for (let yy = 0; yy < S; yy++) {
        for (let xx = 0; xx < S; xx++) {
          const idx = (yy * S + xx) * 4;
          if (data[idx + 3] > 90) {
            pts.push({
              x: (xx / S - 0.5) * boxSize + (Math.random() - 0.5) * cell * 0.9,
              y: -(yy / S - 0.5) * boxSize + (Math.random() - 0.5) * cell * 0.9,
              z: (Math.random() - 0.5) * 14,
              r: data[idx], g: data[idx + 1], b: data[idx + 2]
            });
          }
        }
      }
      let sampled = pts;
      if (pts.length > N) { const step = Math.ceil(pts.length / N); sampled = pts.filter((_, i) => i % step === 0); }
      if (!sampled.length) return;
      pointCacheRef.current[cacheKey] = sampled;
      targetsRef.current = sampled;
    };
    img.onerror = () => { targetsRef.current = null; };
    img.src = pressedLogo.logo;
  }, [pressedLogo]);

  return (
    <div style={S.hofIntroWrap}>
      <div style={S.hofGlassBox}>
        <canvas ref={canvasRef} style={S.hofParticleCanvas} />
      </div>
      <div style={S.hofMarqueeOuter}>
        <div className="hof-marquee-track" style={{ animationPlayState: pressedLogo ? "paused" : "running" }}>
          {kabinetList.length > 0 && [...kabinetList, ...kabinetList].map((k, i) => (
            <div
              key={k.id + "_" + i}
              style={S.hofMarqueeLogo}
              onPointerDown={() => onPressStart(k)}
              onPointerUp={onPressEnd}
              onPointerLeave={onPressEnd}
              onPointerCancel={onPressEnd}
              onContextMenu={e => e.preventDefault()}
            >
              {k.logo ? <img src={k.logo} alt={k.nama_kabinet} style={S.hofMarqueeLogoImg} draggable={false} /> : <div style={{ fontSize: 22, opacity: 0.5 }}>🛡️</div>}
            </div>
          ))}
        </div>
      </div>
      {kabinetList.length === 0 && (
        <div style={{ textAlign: "center", color: "#c9c2ad", fontSize: 12.5, marginTop: 10 }}>Belum ada logo kabinet. Tambahkan lewat mode admin.</div>
      )}
    </div>
  );
}
function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v4h4" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
function IconBook() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z" />
      <path d="M4 4.5v17" />
    </svg>
  );
}
function IconDoc() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h8" />
    </svg>
  );
}
function IconGaruda() {
  return (
    <img src="/garuda-pancasila.png" alt="Garuda Pancasila" style={{width:24,height:24,objectFit:"contain"}} onError={e => e.target.style.display="none"} />
  );
}
function IconDoor() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M13 4 6 5.5v15L13 19z" />
      <path d="M13 4h5v16h-5M10 12v.01" />
    </svg>
  );
}
function IconScale() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 3v18M5 8h14M5 8 2 15a3 3 0 0 0 6 0zM19 8l-3 7a3 3 0 0 0 6 0z" />
    </svg>
  );
}
function IconHandshake() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M8 12 3 17l2 2 1-1M16 12l5 5-2 2-1-1" />
      <path d="M8 12l3-3 2 2 3-3 3 3-4 4-2-2-2 2z" />
    </svg>
  );
}
function IconBallot() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 8h16v13H4z" />
      <path d="M9 8V5a3 3 0 0 1 6 0v3M12 12v4M9.5 14.5h5" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.4A8 8 0 1 1 21 12z" />
      <path d="M8 11h8M8 14h5" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 2 4 5v6c0 5 3.4 8.6 8 11 4.6-2.4 8-6 8-11V5z" />
    </svg>
  );
}
function IconUsersGear() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="18" cy="7" r="2" />
      <path d="M18 10.5v1M18 15.5v1M15 12.5h1M20 12.5h1M15.9 10.4l.7.7M19.4 13.9l.7.7M19.4 10.4l-.7.7M15.9 13.9l.7.7" />
    </svg>
  );
}
function IconRocket() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 16s-1-4 3-8c3-3 8-4 8-4s-1 5-4 8c-4 4-7 3-7 3z" />
      <circle cx="13" cy="8" r="1.5" />
      <path d="M8 13l-3 5 5-3M9 17l-1 3M4 15l3-1" />
    </svg>
  );
}

const C = { black:"#0A0A0A", gold:"#B68A3D", white:"#FFFFFF", offwhite:"#F5F0E8", red:"#8C2E33", navy:"#1B2A45", muted:"#666666" };

const S = {
  page:{minHeight:"100vh",background:C.offwhite,color:"#1F1B16",fontFamily:"'Inter',sans-serif"},
  header:{position:"fixed",top:0,left:0,right:0,zIndex:100,background:C.black,borderBottom:`2px solid ${C.gold}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",height:58,boxSizing:"border-box"},
  headerLeft:{display:"flex",alignItems:"center",gap:14},
  headerTitle:{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:13,color:C.gold,letterSpacing:2,textTransform:"uppercase"},
  searchIconBtn:{background:"none",border:"none",cursor:"pointer",fontSize:17,color:C.gold,padding:4,lineHeight:1},
  searchPanel:{position:"fixed",top:58,left:0,right:0,zIndex:99,background:C.black,borderBottom:`2px solid ${C.gold}`,padding:"16px 20px",maxHeight:"70vh",overflowY:"auto",boxShadow:"0 8px 20px rgba(0,0,0,0.4)"},
  searchInput:{width:"100%",padding:"11px 14px",borderRadius:6,border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.06)",color:C.white,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"'Inter',sans-serif"},
  searchResults:{marginTop:12,display:"flex",flexDirection:"column",gap:2,maxWidth:640,marginLeft:"auto",marginRight:"auto"},
  searchResultItem:{display:"flex",alignItems:"center",gap:10,padding:"11px 10px",borderRadius:6,cursor:"pointer"},
  searchResultBadge:{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5,color:C.gold,border:`1px solid ${C.gold}`,borderRadius:4,padding:"2px 7px",flexShrink:0},
  searchResultText:{fontSize:13.5,color:C.white},
  searchEmpty:{fontSize:13,color:"rgba(255,255,255,0.5)",padding:"10px 8px",maxWidth:640,marginLeft:"auto",marginRight:"auto"},
  scrollTopBtn:{position:"fixed",bottom:24,right:24,zIndex:200,width:46,height:46,borderRadius:"50%",background:C.gold,color:C.black,border:"none",fontSize:20,fontWeight:700,cursor:"pointer",boxShadow:"0 2px 12px rgba(0,0,0,0.35)"},
  visitorCounter:{display:"flex",alignItems:"center",gap:8,marginTop:16,fontSize:13,color:"rgba(255,255,255,0.6)"},
  hamburger:{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",gap:5,padding:4},
  bar:{display:"block",width:24,height:2,background:C.white,borderRadius:2},
  adminBtnHeader:{background:C.red,color:C.white,border:"none",fontWeight:600,fontSize:13,padding:"7px 14px",borderRadius:4,cursor:"pointer",fontFamily:"'Inter',sans-serif"},
  drawerOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:200},
  drawer:{position:"absolute",left:0,top:0,bottom:0,width:260,background:C.black,borderRight:`2px solid ${C.gold}`,paddingTop:60},
  drawerTitle:{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:18,color:C.gold,padding:"0 24px 20px",borderBottom:"1px solid rgba(182,138,61,0.3)",marginBottom:10},
  drawerItem:{display:"block",width:"100%",background:"none",border:"none",color:C.white,fontSize:15,fontWeight:500,padding:"14px 24px",cursor:"pointer",textAlign:"left",fontFamily:"'Inter',sans-serif"},
  drawerItemActive:{color:C.gold,background:"rgba(182,138,61,0.1)"},
  hero:{position:"relative",height:"100vh",width:"100%",overflow:"hidden"},
  heroVideo:{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",zIndex:0},
  heroOverlay:{position:"absolute",inset:0,background:"linear-gradient(135deg,rgba(10,22,40,0.6) 0%,rgba(10,22,40,0.4) 100%)",zIndex:1},
  heroCenter:{position:"relative",zIndex:2,height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"0 20px"},
  heroEyebrow:{fontFamily:"'Inter',sans-serif",fontSize:12,letterSpacing:4,color:C.gold,fontWeight:600,marginBottom:16,textTransform:"uppercase"},
  heroTitle:{fontFamily:"Georgia,serif",fontSize:"clamp(28px,5vw,56px)",fontWeight:700,color:C.white,lineHeight:1.2,margin:"0 0 32px"},
  discoverBtn:{background:"transparent",border:`2px solid ${C.white}`,color:C.white,fontSize:15,fontWeight:600,padding:"14px 36px",borderRadius:40,cursor:"pointer",letterSpacing:1,fontFamily:"'Inter',sans-serif"},
  kabinetSection:{background:C.white,padding:"70px 40px 0",textAlign:"center"},
  kabinetEyebrow:{fontSize:12,letterSpacing:3,color:C.gold,fontWeight:700,marginBottom:24,textTransform:"uppercase"},
  kabinetLogoRow:{display:"flex",alignItems:"center",justifyContent:"center",gap:24,marginBottom:24,flexWrap:"wrap"},
  kabinetLogo:{width:80,height:80,objectFit:"contain"},
  kabinetName:{fontFamily:"Georgia,serif",fontSize:"clamp(24px,4vw,38px)",fontWeight:700,color:C.navy,letterSpacing:2},
  kabinetPeriode:{fontFamily:"Georgia,serif",fontSize:20,fontStyle:"italic",color:C.muted,marginTop:4},
  kabinetQuote:{fontSize:15,lineHeight:1.8,color:C.muted,maxWidth:560,margin:"0 auto 40px",fontStyle:"italic"},
  statSection:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",background:C.black,margin:"0 -40px"},
  statCard:{padding:"28px 20px",textAlign:"center",background:C.white},
  statNum:{fontFamily:"Georgia,serif",fontSize:36,fontWeight:700,color:C.gold,lineHeight:1},
  statLabel:{marginTop:6,fontSize:11,color:C.muted,letterSpacing:1,textTransform:"uppercase"},
  visiSection:{background:C.navy,padding:"70px 0"},
  visiInner:{maxWidth:800,margin:"0 auto",padding:"0 40px"},
  visiText:{fontSize:15.5,lineHeight:1.75,color:"rgba(255,255,255,0.85)",marginBottom:24,marginTop:0},
  misiList:{paddingLeft:20,color:"rgba(255,255,255,0.85)",lineHeight:2,fontSize:15.5,marginBottom:40},
  maknaLogoList:{display:"flex",flexDirection:"column",gap:30},
  maknaLogoItem:{display:"flex",alignItems:"center",gap:26,flexWrap:"wrap"},
  maknaLogoIconWrap:{flexShrink:0,width:92,height:92,display:"flex",alignItems:"center",justifyContent:"center"},
  maknaLogoIcon:{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"},
  maknaLogoItemText:{flex:1,minWidth:220,fontSize:15.5,lineHeight:1.75,color:"rgba(255,255,255,0.85)",marginBottom:0,marginTop:0},
  main:{maxWidth:1100,margin:"0 auto",padding:"90px 40px 80px"},
  formCard:{background:C.white,border:"1px solid #e0d8c8",borderRadius:6,padding:22,marginBottom:30},
  formCardTitle:{fontWeight:700,marginBottom:14,fontSize:17,color:C.navy},
  formRow:{display:"flex",gap:10,flexWrap:"wrap"},
  input:{flex:"1 1 200px",border:"1px solid #e0d8c8",background:"#FAF7F2",borderRadius:4,padding:"10px 12px",fontSize:14,fontFamily:"'Inter',sans-serif",color:"#1F1B16",outline:"none",width:"100%",boxSizing:"border-box"},
  eventGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:20},
  eventCard:{background:C.white,border:"1px solid #e0d8c8",borderRadius:6,overflow:"hidden",cursor:"pointer"},
  eventCover:{position:"relative",height:150,background:"#e0d8c8"},
  eventCoverImg:{width:"100%",height:"100%",objectFit:"cover",display:"block"},
  eventCoverEmpty:{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",fontSize:13,opacity:0.5,fontStyle:"italic"},
  eventCoverBadge:{position:"absolute",bottom:8,right:8,background:"rgba(0,0,0,0.7)",color:C.white,fontSize:11,padding:"3px 8px",borderRadius:3},
  eventCardBody:{padding:"14px 16px"},
  eventCardName:{fontFamily:"Georgia,serif",fontWeight:700,fontSize:16,color:C.navy},
  eventCardDate:{fontSize:12,opacity:0.6,marginTop:4},
  photoGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:14},
  photoTile:{position:"relative",borderRadius:6,overflow:"hidden",border:"1px solid #e0d8c8"},
  photoImg:{width:"100%",height:180,objectFit:"cover",display:"block",cursor:"pointer"},
  photoDeleteBtn:{position:"absolute",top:6,right:6,background:"rgba(140,46,51,0.9)",color:C.white,border:"none",borderRadius:4,width:26,height:26,cursor:"pointer",fontSize:13},
  memberGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:20},
  memberCard:{background:C.white,border:"1px solid #e0d8c8",borderRadius:8,padding:16},
  memberPhotoWrap:{width:"100%",aspectRatio:"3/4",background:"#f0ebe0",borderRadius:6,overflow:"hidden",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"center"},
  memberPhoto:{width:"100%",height:"100%",objectFit:"cover"},
  memberPhotoEmpty:{fontSize:36,opacity:0.4},
  memberName:{fontFamily:"Georgia,serif",fontWeight:700,fontSize:15.5,color:C.navy,marginBottom:10},
  memberRow:{display:"flex",gap:8,fontSize:13,marginBottom:5,color:"#444"},
  memberLabel:{fontWeight:600,color:C.muted,minWidth:70},
  docGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:16},
  docCard:{display:"flex",gap:14,background:C.white,border:"1px solid #e0d8c8",borderRadius:6,padding:14,alignItems:"flex-start"},
  docThumb:{width:64,height:64,objectFit:"cover",borderRadius:4,cursor:"pointer",flexShrink:0},
  docIconWrap:{width:64,height:64,background:"#f0ebe0",border:"1px solid #e0d8c8",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",color:C.navy,cursor:"pointer",flexShrink:0},
  docBody:{flex:1,minWidth:0},
  docTitle:{fontWeight:700,fontSize:14.5,color:C.navy,wordBreak:"break-word"},
  docMeta:{fontSize:12,opacity:0.6,marginTop:3},
  docLink:{fontSize:13,color:C.red,fontWeight:600,textDecoration:"none"},
  primaryBtn:{background:C.red,color:C.white,border:"none",padding:"11px 20px",borderRadius:4,fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:"'Inter',sans-serif"},
  ghostBtn:{background:"transparent",color:C.navy,border:"1px solid #e0d8c8",padding:"11px 20px",borderRadius:4,fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:"'Inter',sans-serif"},
  backBtn:{background:"none",border:"none",color:C.red,fontWeight:600,fontSize:14,cursor:"pointer",padding:0,marginBottom:20,display:"block"},
  deleteLink:{background:"none",border:"none",color:C.red,fontSize:12.5,fontWeight:600,cursor:"pointer",padding:0,marginTop:8,display:"block"},
  emptyState:{textAlign:"center",padding:"60px 0",opacity:0.5,fontSize:15},
  announceSection:{background:C.black,width:"100%",padding:"48px 20px"},
  announceInner:{maxWidth:760,margin:"0 auto"},
  announceLabel:{fontSize:13,letterSpacing:2,color:C.gold,fontWeight:700,textTransform:"uppercase"},
  announceDivider:{height:1,background:"rgba(255,255,255,0.18)",margin:"10px 0 18px"},
  announceList:{display:"flex",flexDirection:"column",gap:16},
  announceItem:{borderBottom:"1px solid rgba(255,255,255,0.1)",paddingBottom:14},
  announceDate:{fontSize:11,color:"#9a9a9a",marginBottom:4},
  announceRow:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"},
  announceTitleWrap:{display:"flex",alignItems:"center"},
  announceTitle:{fontWeight:700,fontSize:15.5,color:C.white},
  announceFileName:{fontSize:12,color:"#9a9a9a",marginTop:2,marginLeft:26},
  announceLink:{color:"#E4666D",fontWeight:700,fontSize:13,textDecoration:"none",whiteSpace:"nowrap"},
  eventDesc:{fontSize:15,lineHeight:1.6,opacity:0.8,marginBottom:20},
  modalOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:20},
  modalBox:{background:"#FAF7F2",borderRadius:8,padding:30,maxWidth:380,width:"100%",textAlign:"center",maxHeight:"85vh",overflowY:"auto",WebkitOverflowScrolling:"touch"},
  modalTitle:{fontFamily:"Georgia,serif",fontWeight:700,fontSize:20,color:C.navy,marginBottom:16},
  errorText:{color:C.red,fontSize:13,marginTop:8},
  lightboxOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:600,padding:24,cursor:"zoom-out"},
  lightboxImg:{maxWidth:"100%",maxHeight:"100%",borderRadius:4},
  footer:{background:C.black,borderTop:`2px solid ${C.gold}`,padding:"44px 40px 24px"},
  footerTop:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:32,marginBottom:30},
  footerBrand:{},
  footerTitle:{fontWeight:700,fontSize:15,color:C.gold,letterSpacing:1,marginBottom:6},
  footerSub:{fontSize:13,color:"rgba(255,255,255,0.6)"},
  footerSectionLabel:{fontSize:11,letterSpacing:2,color:C.gold,fontWeight:700,textTransform:"uppercase",marginBottom:12},
  footerSocials:{display:"flex",flexDirection:"row",alignItems:"center",gap:12,flexWrap:"wrap"},
  socialLink:{color:"rgba(255,255,255,0.8)",fontSize:14,textDecoration:"none",fontWeight:500},
  socialSep:{color:"rgba(182,138,61,0.5)",fontSize:14},
  gmapsLink:{color:"rgba(255,255,255,0.7)",fontSize:13,textDecoration:"underline",display:"block",marginTop:6},
  footerBottom:{borderTop:"1px solid rgba(255,255,255,0.1)",paddingTop:20,fontSize:12,color:"rgba(255,255,255,0.4)",textAlign:"center"},

  // ===== Tentang HIMA IP =====
  tentangHero:{position:"relative",marginTop:58,padding:"60px 40px 40px",background:C.black,overflow:"hidden",minHeight:260,display:"flex",flexDirection:"column",justifyContent:"center"},
  tentangHeroImg:{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.35},
  tentangHeroOverlay:{position:"absolute",inset:0,background:"linear-gradient(100deg, rgba(10,10,10,0.95) 30%, rgba(10,10,10,0.55) 100%)"},
  tentangHeroContent:{position:"relative",zIndex:1,display:"flex",alignItems:"center",gap:18,marginBottom:20},
  tentangHeroLogo:{width:56,height:56,objectFit:"contain",borderRadius:"50%",background:"rgba(255,255,255,0.06)",border:`1px solid ${C.gold}`,padding:6},
  tentangHeroEyebrow:{fontSize:13,letterSpacing:3,color:C.white,fontWeight:500,textTransform:"uppercase"},
  tentangHeroTitle:{fontFamily:"Georgia,serif",fontSize:"clamp(30px,5vw,52px)",fontWeight:700,color:C.gold,lineHeight:1},
  tentangHeroDesc:{position:"relative",zIndex:1,fontSize:14.5,lineHeight:1.8,color:"rgba(255,255,255,0.8)",maxWidth:640},

  sejarahRow:{display:"flex",gap:28,flexWrap:"wrap",alignItems:"stretch",marginBottom:50},
  sejarahText:{flex:"2 1 380px"},
  sejarahHeadRow:{display:"flex",alignItems:"center",gap:14,marginBottom:16},
  sejarahIconBox:{width:44,height:44,borderRadius:8,background:C.offwhite,border:"1px solid #e0d8c8",display:"flex",alignItems:"center",justifyContent:"center",color:C.navy,flexShrink:0},
  sejarahTitle:{fontFamily:"Georgia,serif",fontSize:24,fontWeight:700,color:C.navy,margin:0},
  sejarahBody:{fontSize:14.5,lineHeight:1.8,color:"#333",margin:0},
  sejarahBadge:{flex:"1 1 220px",display:"flex",alignItems:"center",gap:14,background:C.black,borderRadius:10,padding:"22px 20px",minWidth:220},
  sejarahBadgeIcon:{width:44,height:44,borderRadius:"50%",background:C.gold,display:"flex",alignItems:"center",justifyContent:"center",color:C.black,flexShrink:0},
  sejarahBadgeLabel:{fontSize:12.5,color:"rgba(255,255,255,0.7)"},
  sejarahBadgeDate:{fontFamily:"Georgia,serif",fontSize:19,fontWeight:700,color:C.gold,marginTop:2},

  darkPanel:{background:C.black,borderRadius:12,padding:"36px 32px",marginBottom:50},
  darkPanelTitle:{fontFamily:"Georgia,serif",fontSize:20,fontWeight:700,color:C.gold,margin:"0 0 20px"},
  twoColGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:36,marginBottom:50},

  identRow:{display:"flex",gap:8,fontSize:13.5,marginBottom:12,color:"rgba(255,255,255,0.85)"},
  identLabel:{minWidth:88,color:C.gold,fontWeight:600},
  identColon:{opacity:0.5},
  identVal:{flex:1,lineHeight:1.5},

  landasanRow:{display:"flex",gap:14,marginBottom:20,alignItems:"flex-start"},
  landasanIcon:{width:38,height:38,borderRadius:"50%",background:"rgba(182,138,61,0.15)",border:`1px solid ${C.gold}`,display:"flex",alignItems:"center",justifyContent:"center",color:C.gold,flexShrink:0},
  landasanTitle:{fontSize:13.5,fontWeight:700,color:C.gold,textTransform:"uppercase",letterSpacing:0.5,marginBottom:3},
  landasanDesc:{fontSize:13.5,lineHeight:1.6,color:"rgba(255,255,255,0.75)"},

  lightPanelTitle:{fontFamily:"Georgia,serif",fontSize:20,fontWeight:700,color:C.navy,margin:"0 0 20px"},
  asasGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:16},
  asasCard:{textAlign:"center",padding:"18px 10px",background:C.offwhite,borderRadius:10,border:"1px solid #e0d8c8"},
  asasIcon:{width:46,height:46,borderRadius:"50%",background:C.white,border:`1.5px solid ${C.navy}`,display:"flex",alignItems:"center",justifyContent:"center",color:C.navy,margin:"0 auto 10px"},
  asasTitle:{fontWeight:700,fontSize:13.5,color:C.navy,marginBottom:6,textTransform:"uppercase",letterSpacing:0.5},
  asasDesc:{fontSize:12,lineHeight:1.5,color:C.muted},

  tujuanList:{display:"flex",flexDirection:"column",gap:14},
  tujuanItem:{display:"flex",alignItems:"flex-start",gap:10,fontSize:14,lineHeight:1.6,color:"#333"},
  tujuanDot:{width:8,height:8,borderRadius:"50%",background:C.red,marginTop:6,flexShrink:0},

  fungsiSection:{background:C.black,padding:"60px 40px",marginTop:10},
  fungsiInner:{maxWidth:1100,margin:"0 auto"},
  fungsiTitle:{fontFamily:"Georgia,serif",fontSize:26,fontWeight:700,color:C.gold,textAlign:"center",margin:"0 0 40px"},
  fungsiGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:28},
  fungsiCard:{textAlign:"center",padding:"10px 14px"},
  fungsiIcon:{width:64,height:64,borderRadius:"50%",background:"rgba(182,138,61,0.12)",border:`1.5px solid ${C.gold}`,display:"flex",alignItems:"center",justifyContent:"center",color:C.gold,margin:"0 auto 16px"},
  fungsiCardTitle:{fontWeight:700,fontSize:15,color:C.white,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5},
  fungsiCardDesc:{fontSize:12.5,lineHeight:1.6,color:"rgba(255,255,255,0.7)"},

  tentangQuoteBar:{background:C.black,borderTop:`2px solid ${C.gold}`,padding:"36px 20px",textAlign:"center",fontFamily:"Georgia,serif",fontStyle:"italic",fontSize:"clamp(16px,3vw,24px)",fontWeight:700,color:C.gold},

  // ===== Hall of Fame =====
  hofWrap:{paddingTop:58,background:C.black,minHeight:"100vh",overflow:"hidden",backgroundSize:"cover",backgroundPosition:"center",backgroundAttachment:"fixed",backgroundRepeat:"no-repeat"},
  hofHeroLabel:{textAlign:"center",padding:"36px 20px 0"},
  hofHeroEyebrow:{fontSize:12,letterSpacing:3,color:C.gold,fontWeight:700,textTransform:"uppercase"},
  hofHeroTitle:{fontFamily:"Georgia,serif",fontSize:"clamp(26px,4.5vw,40px)",fontWeight:700,color:C.white,marginTop:6},
  hofToggleRow:{display:"flex",justifyContent:"center",gap:10,padding:"22px 20px 0"},
  hofToggleBtn:{background:"transparent",border:`1px solid ${C.gold}`,color:C.gold,padding:"9px 22px",borderRadius:30,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"},
  hofToggleBtnActive:{background:C.gold,color:C.black},
  hofKetuaSection:{padding:"20px 20px 0"},
  hofCardStage:{position:"relative",display:"flex",alignItems:"center",justifyContent:"center",padding:"30px 44px",maxWidth:420,margin:"0 auto"},
  hofArrowBtn:{position:"absolute",top:"50%",transform:"translateY(-50%)",zIndex:5,background:"rgba(0,0,0,0.55)",color:C.gold,border:`1px solid ${C.gold}`,borderRadius:"50%",width:36,height:36,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"},
  hofCardOuter:{width:260,height:400,perspective:1200,margin:"0 auto"},
  hofCardInner:{position:"relative",width:"100%",height:"100%",transition:"transform 0.6s",transformStyle:"preserve-3d"},
  hofCardFace:{position:"absolute",inset:0,borderRadius:16,backfaceVisibility:"hidden",boxShadow:"0 10px 30px rgba(0,0,0,0.25)",overflow:"hidden",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center"},
  hofCardFront:{background:C.offwhite,border:"1px solid rgba(182,138,61,0.4)",padding:"22px 18px",justifyContent:"flex-start"},
  hofCardBack:{background:C.red,transform:"rotateY(180deg)",justifyContent:"center"},
  hofCardCorner1:{position:"absolute",top:10,left:10,width:34,height:34,borderTop:`2px solid ${C.gold}`,borderLeft:`2px solid ${C.gold}`},
  hofCardCorner2:{position:"absolute",bottom:10,right:10,width:34,height:34,borderBottom:`2px solid ${C.gold}`,borderRight:`2px solid ${C.gold}`},
  hofEditBtn:{position:"absolute",top:8,right:8,zIndex:6,background:C.gold,color:C.black,border:"none",borderRadius:"50%",width:28,height:28,fontSize:13,cursor:"pointer"},
  hofPhotoWrap:{width:110,height:110,aspectRatio:"1 / 1",borderRadius:14,overflow:"hidden",background:"#e5ded0",display:"flex",alignItems:"center",justifyContent:"center",marginTop:20,marginBottom:14,border:`3px solid ${C.gold}`},
  hofPhotoImg:{width:"100%",height:"100%",objectFit:"cover"},
  hofPhotoEmpty:{fontSize:42,opacity:0.4},
  hofEditSection:{border:"1px solid #e0d8c8",borderRadius:10,padding:"12px 14px",marginTop:6,background:"rgba(255,255,255,0.5)"},
  hofEditSectionTitle:{fontWeight:700,fontSize:13.5,color:C.navy,marginBottom:10,fontFamily:"Georgia,serif"},
  hofEditPhotoPreview:{width:64,height:64,minWidth:64,aspectRatio:"1 / 1",borderRadius:10,overflow:"hidden",background:"#e5ded0",display:"flex",alignItems:"center",justifyContent:"center",border:`2px solid ${C.gold}`},
  hofEditPhotoImg:{width:"100%",height:"100%",objectFit:"cover"},
  hofJabatan:{fontSize:11,letterSpacing:2,color:C.red,fontWeight:700,textTransform:"uppercase"},
  hofPeriodeSmall:{fontSize:12,color:C.muted,fontStyle:"italic",marginBottom:10},
  hofNama:{fontFamily:"Georgia,serif",fontSize:22,fontWeight:700,color:C.navy,textAlign:"center",lineHeight:1.2},
  hofNpm:{fontSize:12.5,color:C.muted,marginTop:4,marginBottom:14},
  hofLihatKabinetBtn:{background:"none",border:"none",color:C.red,fontSize:13,fontWeight:700,textDecoration:"underline",cursor:"pointer",marginTop:"auto",marginBottom:22,fontFamily:"'Inter',sans-serif"},
  hofTapHint:{fontSize:10.5,color:"rgba(0,0,0,0.35)",position:"absolute",bottom:8},
  hofBatikPattern:{position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(45deg, transparent 0 10px, rgba(182,138,61,0.35) 10px 12px), repeating-linear-gradient(-45deg, transparent 0 10px, rgba(182,138,61,0.35) 10px 12px)",opacity:0.9},
  hofBackContent:{position:"relative",zIndex:1,textAlign:"center",padding:"0 16px"},
  hofBackEyebrow:{fontFamily:"Georgia,serif",fontSize:15,color:C.white,letterSpacing:1},
  hofBackTitle:{fontFamily:"Georgia,serif",fontSize:19,color:C.white,fontWeight:700,marginTop:2},
  hofBackSub:{fontSize:11,letterSpacing:2,color:"rgba(255,255,255,0.75)",marginTop:2,marginBottom:20,textTransform:"uppercase"},
  hofBackBadge:{width:70,height:70,borderRadius:"50%",background:C.white,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"center",border:`2px solid ${C.gold}`},
  hofBackBadgeImg:{width:52,height:52,objectFit:"contain"},
  hofBackFullImg:{width:"100%",height:"100%",objectFit:"cover"},
  hofDots:{display:"flex",justifyContent:"center",gap:8,marginTop:6,flexWrap:"wrap",maxWidth:360,marginLeft:"auto",marginRight:"auto"},
  hofDot:{fontSize:13,color:"rgba(140,46,51,0.25)"},
  hofDotActive:{color:C.red},
  hofQuoteBar:{background:C.black,marginTop:26,padding:"30px 24px",textAlign:"center",borderRadius:8},
  hofQuoteText:{fontFamily:"Georgia,serif",fontStyle:"italic",fontSize:"clamp(14px,2.2vw,18px)",color:C.gold,maxWidth:600,margin:"0 auto",lineHeight:1.6},
  hofKabinetSection:{padding:"36px 20px 70px",maxWidth:800,margin:"0 auto"},
  hofKabinetList:{display:"flex",flexDirection:"column",gap:16,maxWidth:460,margin:"0 auto"},
  hofKabinetItem:{position:"relative",background:C.offwhite,border:"1px solid rgba(182,138,61,0.4)",borderRadius:16,padding:"18px 20px",display:"flex",alignItems:"center",gap:16,textAlign:"left",boxShadow:"0 10px 30px rgba(0,0,0,0.12)"},
  hofKabinetLogoWrap:{width:84,height:84,minWidth:84,aspectRatio:"1 / 1",borderRadius:14,background:"#e5ded0",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",border:`3px solid ${C.gold}`,overflow:"hidden"},
  hofKabinetLogoImg:{width:"78%",height:"78%",objectFit:"contain"},
  hofKabinetLogoEmpty:{fontSize:30,opacity:0.4},
  hofKabinetInfo:{flex:1,cursor:"pointer"},
  hofKabinetName:{fontFamily:"Georgia,serif",fontWeight:700,fontSize:17,color:C.navy},
  hofKabinetPeriode:{fontSize:12.5,color:C.muted,fontStyle:"italic",marginTop:2},

  // ===== HOF v2: dot nav =====
  hofDotNav:{position:"fixed",right:14,top:"50%",transform:"translateY(-50%)",display:"flex",flexDirection:"column",gap:12,zIndex:40},
  hofNavDot:{width:11,height:11,borderRadius:"50%",background:"transparent",border:`2px solid ${C.gold}`,padding:0,cursor:"pointer"},
  hofNavDotActive:{background:C.gold},

  // ===== HOF v2: particle intro =====
  hofIntroWrap:{maxWidth:640,margin:"10px auto 0",padding:"0 16px"},
  hofGlassBox:{position:"relative",borderRadius:18,overflow:"hidden",background:"radial-gradient(circle at 30% 20%, #1b1440 0%, #0a0a1f 60%, #000 100%)",border:"1px solid rgba(182,138,61,0.45)",boxShadow:"0 20px 50px rgba(0,0,0,0.5), inset 0 0 40px rgba(182,138,61,0.08)",backdropFilter:"blur(2px)"},
  hofParticleCanvas:{display:"block",width:"100%",aspectRatio:"4 / 3"},
  hofMarqueeOuter:{marginTop:14,overflow:"hidden",background:"rgba(10,10,20,0.9)",border:"1px solid rgba(182,138,61,0.35)",borderRadius:12,padding:"10px 0"},
  hofMarqueeLogo:{width:64,height:64,minWidth:64,margin:"0 10px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(182,138,61,0.3)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",touchAction:"none",WebkitTouchCallout:"none",WebkitUserSelect:"none",userSelect:"none"},
  hofMarqueeLogoImg:{width:"70%",height:"70%",objectFit:"contain",pointerEvents:"none"},
  hofIdentityCard:{marginTop:14,padding:"16px 18px",borderRadius:12,background:"rgba(10,10,20,0.92)",border:`1px solid ${C.gold}`,textAlign:"center",animation:"hofSlideNext 0.4s ease"},
  hofIdentityName:{fontFamily:"Georgia,serif",fontWeight:700,fontSize:17,color:C.gold},
  hofIdentityPeriode:{fontSize:12,color:"#c9c2ad",fontStyle:"italic",marginTop:2},
  hofIdentityFilosofi:{fontSize:13,color:"#e8e2d0",lineHeight:1.6,marginTop:10,whiteSpace:"pre-wrap"},

  // ===== HOF v2: journey =====
  hofJourneySection:{maxWidth:600,margin:"70px auto 0",padding:"0 18px"},
  hofSectionTitle:{fontFamily:"Georgia,serif",fontWeight:700,fontSize:24,color:C.white,textAlign:"center"},
  hofSectionSub:{fontSize:13,color:"#b8b2a0",textAlign:"center",marginTop:4,fontStyle:"italic"},
  hofJourneyList:{display:"flex",flexDirection:"column",gap:34,marginTop:24},
  hofJourneyRow:{display:"flex",alignItems:"center",gap:18,flexWrap:"wrap"},
  hofJourneyPhotoWrap:{width:180,aspectRatio:"3 / 4",borderRadius:12,overflow:"hidden",background:"#e5ded0",border:`3px solid ${C.gold}`,flex:"0 0 auto",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 10px 24px rgba(0,0,0,0.15)"},
  hofJourneyPhotoImg:{width:"100%",height:"100%",objectFit:"cover"},
  hofJourneyDesc:{flex:"1 1 180px",minWidth:180},
  hofJourneyDescText:{fontSize:14,lineHeight:1.7,color:"#3a3a3a"},

  // ===== HOF v2: leadership =====
  hofLeaderSection:{maxWidth:600,margin:"70px auto 40px",padding:"0 18px"},
  hofFilterRow:{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center",marginTop:18},
  hofFilterPill:{padding:"7px 16px",borderRadius:20,border:`1px solid ${C.gold}`,background:"transparent",color:C.navy,fontSize:12.5,fontWeight:600,cursor:"pointer"},
  hofFilterPillActive:{background:C.gold,color:C.white},
  hofLeaderGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:8},
  hofLeaderCard:{position:"relative",background:C.offwhite,border:"1px solid rgba(182,138,61,0.4)",borderRadius:14,padding:"14px 10px",textAlign:"center",cursor:"pointer",boxShadow:"0 8px 22px rgba(0,0,0,0.1)"},
  hofLeaderPhotoWrap:{width:"100%",aspectRatio:"1 / 1",borderRadius:10,overflow:"hidden",background:"#e5ded0",display:"flex",alignItems:"center",justifyContent:"center",border:`2px solid ${C.gold}`,marginBottom:10},
  hofLeaderPhotoImg:{width:"100%",height:"100%",objectFit:"cover"},
  hofLeaderName:{fontFamily:"Georgia,serif",fontWeight:700,fontSize:14.5,color:C.navy},
  hofLeaderRole:{fontSize:11.5,color:C.muted,fontStyle:"italic",marginTop:3},

  // ===== HOF v2: expand detail panel =====
  hofExpandOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:20},
  hofExpandPanel:{position:"relative",background:C.offwhite,borderRadius:18,padding:"30px 24px",maxWidth:360,width:"100%",textAlign:"center",border:`1px solid ${C.gold}`,boxShadow:"0 24px 60px rgba(0,0,0,0.4)",animation:"hofSlideNext 0.4s ease",maxHeight:"85vh",overflowY:"auto"},
  hofExpandClose:{position:"absolute",top:12,right:14,background:"none",border:"none",fontSize:18,color:C.navy,cursor:"pointer"},
  hofExpandPhotoWrap:{width:130,height:130,margin:"0 auto 16px",borderRadius:16,overflow:"hidden",background:"#e5ded0",border:`3px solid ${C.gold}`,display:"flex",alignItems:"center",justifyContent:"center"},
  hofExpandPhotoImg:{width:"100%",height:"100%",objectFit:"cover"},
  hofExpandName:{fontFamily:"Georgia,serif",fontWeight:700,fontSize:19,color:C.navy},
  hofExpandRole:{fontSize:12.5,color:C.muted,fontStyle:"italic",marginTop:4},
  hofExpandNpm:{fontSize:13,color:"#3a3a3a",marginTop:10},
  hofExpandKabinet:{fontSize:13,color:"#3a3a3a",marginTop:4},
  hofExpandMedsos:{display:"inline-block",marginTop:14,fontSize:13,color:C.gold,fontWeight:600,textDecoration:"none"},

  // ===== HOF v2: journey edit preview + quote overlay =====
  hofJourneyEditPreview:{width:110,aspectRatio:"3 / 4",margin:"0 auto",borderRadius:10,overflow:"hidden",background:"#e5ded0",display:"flex",alignItems:"center",justifyContent:"center",border:`2px solid ${C.gold}`},
  hofQuoteOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:40,pointerEvents:"none"},
  hofQuoteOverlayText:{color:C.gold,fontFamily:"Georgia,serif",fontStyle:"italic",fontSize:19,textAlign:"center",lineHeight:1.6,maxWidth:340},
  siteIntroOverlay:{position:"fixed",inset:0,background:C.black,display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:40,textAlign:"center"},
  siteIntroText:{color:C.gold,fontFamily:"Georgia,serif",fontWeight:600,fontSize:"clamp(18px,4.2vw,30px)",letterSpacing:1,lineHeight:1.5,maxWidth:560},
  pageTransitionOverlayDark:{position:"fixed",inset:0,background:C.black,display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:40,textAlign:"center"},
  pageTransitionOverlayLight:{position:"fixed",inset:0,background:C.offwhite,display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:40,textAlign:"center"},
  pageTransitionQuote:{color:C.gold,fontFamily:"Georgia,serif",fontStyle:"italic",fontWeight:600,fontSize:"clamp(16px,3vw,22px)",lineHeight:1.6,maxWidth:520,textShadow:"0 1px 2px rgba(0,0,0,0.15)"},
  hofKabinetModalBadge:{width:90,height:90,margin:"0 auto 4px",display:"flex",alignItems:"center",justifyContent:"center"},
  hofKabinetModalPattern:{height:14,margin:"0 -30px 18px",backgroundImage:"repeating-linear-gradient(45deg, transparent 0 6px, rgba(182,138,61,0.4) 6px 7px), repeating-linear-gradient(-45deg, transparent 0 6px, rgba(182,138,61,0.4) 6px 7px)",backgroundColor:C.red}
};
