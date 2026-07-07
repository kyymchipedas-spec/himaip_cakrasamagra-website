import React, { useState, useEffect, useRef } from "react";

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
  const [hofView, setHofView] = useState("ketua");
  const [hofIndex, setHofIndex] = useState(0);
  const [hofDir, setHofDir] = useState(1);
  const [hofFlipped, setHofFlipped] = useState(false);
  const [hofQuoteIdx, setHofQuoteIdx] = useState(0);
  const [hofScrollTarget, setHofScrollTarget] = useState(null);
  const [editingKetua, setEditingKetua] = useState(null);
  const [editingKabinet, setEditingKabinet] = useState(null);
  const [activeKabinetModal, setActiveKabinetModal] = useState(null);
  const hofTouchX = useRef(null);
  const kabinetRefs = useRef({});
  const ketuaFotoRef = useRef(null);
  const wakilFotoRef = useRef(null);
  const kabinetLogoRef = useRef(null);

  const searchResults = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results = [];
    events.forEach(ev => {
      if ((ev.name||"").toLowerCase().includes(q) || (ev.description||"").toLowerCase().includes(q)) {
        results.push({ key:"ev_"+ev.id, type:"Kegiatan", label: ev.name, onClick: () => { navigate("galeri"); setTimeout(() => openEvent(ev.id), 50); } });
      }
    });
    members.forEach(m => {
      if ((m.name||"").toLowerCase().includes(q) || (m.jabatan||"").toLowerCase().includes(q) || (m.npm||"").toLowerCase().includes(q)) {
        results.push({ key:"m_"+m.id, type:"Anggota", label: m.jabatan ? `${m.name} — ${m.jabatan}` : m.name, onClick: () => navigate("anggota") });
      }
    });
    announcements.forEach(a => {
      if ((a.title||"").toLowerCase().includes(q)) {
        results.push({ key:"a_"+a.id, type:"Pengumuman", label: a.title, onClick: () => { navigate("beranda"); setTimeout(scrollToAnnounce, 300); } });
      }
    });
    lpjDocs.forEach(d => {
      if ((d.title||"").toLowerCase().includes(q) || (d.name||"").toLowerCase().includes(q)) {
        results.push({ key:"d_"+d.id, type:"Berkas", label: d.title || d.name, onClick: () => { navigate("lpj"); if (d.folder_id) setTimeout(() => openFolder(d.folder_id), 50); } });
      }
    });
    berkasFolders.forEach(f => {
      if ((f.name||"").toLowerCase().includes(q)) {
        results.push({ key:"f_"+f.id, type:"Folder", label: f.name, onClick: () => { navigate("lpj"); setTimeout(() => openFolder(f.id), 50); } });
      }
    });
    return results.slice(0, 20);
  }, [searchQuery, events, members, announcements, lpjDocs, berkasFolders]);

  useEffect(() => {
    function onScroll() { setShowScrollTop(window.scrollY > 400); }
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setHofQuoteIdx(i => (i + 1) % LEADERSHIP_QUOTES.length), 6000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (tab === "hof" && hofView === "kabinet" && hofScrollTarget) {
      const el = kabinetRefs.current[hofScrollTarget];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHofScrollTarget(null);
      }
    }
  }, [tab, hofView, hofScrollTarget, hofKabinet]);

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
      setTab(st.tab || "beranda");
      setActiveEvent(st.activeEvent || null);
      setActiveFolder(st.activeFolder || null);
      setMenuOpen(false);
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
  function navigate(t) {
    setTab(t); setMenuOpen(false); setActiveEvent(null); setActiveFolder(null);
    window.history.pushState({ tab: t, activeEvent: null, activeFolder: null }, "");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    setHofIndex(0); setHofFlipped(false);
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

  const hofCards = React.useMemo(() => {
    const sorted = [...hofKetua].sort((a, b) => (b.urutan || 0) - (a.urutan || 0));
    const arr = [];
    sorted.forEach(p => { arr.push({ ...p, role: "ketua" }); arr.push({ ...p, role: "wakil" }); });
    return arr;
  }, [hofKetua]);
  const hofKabinetSorted = React.useMemo(() => [...hofKabinet].sort((a, b) => (b.urutan || 0) - (a.urutan || 0)), [hofKabinet]);
  const hofCurrent = hofCards[hofIndex] || null;

  function hofNext() {
    if (hofFlipped) { setHofFlipped(false); return; }
    if (hofCards.length === 0) return;
    setHofDir(1);
    setHofIndex(i => (i + 1) % hofCards.length);
  }
  function hofPrev() {
    if (hofFlipped) { setHofFlipped(false); return; }
    if (hofCards.length === 0) return;
    setHofDir(-1);
    setHofIndex(i => (i - 1 + hofCards.length) % hofCards.length);
  }
  function hofTouchStart(e) { hofTouchX.current = e.touches[0].clientX; }
  function hofTouchEnd(e) {
    if (hofTouchX.current === null) return;
    const dx = e.changedTouches[0].clientX - hofTouchX.current;
    hofTouchX.current = null;
    if (Math.abs(dx) < 40) return;
    dx < 0 ? hofNext() : hofPrev();
  }
  function goToKabinet(periode) {
    const found = hofKabinet.find(k => k.ketua_periode === periode);
    setTab("hof"); setHofView("kabinet"); setHofScrollTarget(found ? found.id : null);
    window.history.pushState({ tab: "hof" }, "");
  }

  const totalPhotos = Object.values(photosByEvent).reduce((a, b) => a + b.length, 0);

  const pageKey = tab + ":" + (activeEvent || "") + ":" + (activeFolder || "") + ":" + (tab === "hof" ? hofView : "");

  return (
    <div style={S.page}>
      <style>{`
        @keyframes pageFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .page-fade-wrap { animation: pageFadeIn 0.4s ease; }
        .music-link { color:#1DB954; font-weight:600; text-decoration:none; cursor:pointer; max-width:190px; display:inline-block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; vertical-align:bottom; transition:color 0.15s ease; }
        .music-link:hover { color:#2FE271; text-decoration:underline; }
        @keyframes hofSlideNext { from { opacity:0; transform:translateX(50px) scale(0.96); } to { opacity:1; transform:translateX(0) scale(1); } }
        @keyframes hofSlidePrev { from { opacity:0; transform:translateX(-50px) scale(0.96); } to { opacity:1; transform:translateX(0) scale(1); } }
        .hof-slide-next { animation: hofSlideNext 0.4s ease; }
        .hof-slide-prev { animation: hofSlidePrev 0.4s ease; }
      `}</style>
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
            {[["beranda","Beranda"],["galeri","Galeri Kegiatan"],["anggota","Anggota"],["tentang","Tentang HIMA IP"],["hof","Hall of Fame"],["lpj","BERKAS"]].map(([key,label]) => (
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
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:16,alignItems:"center"}}>
              <button style={S.primaryBtn} onClick={() => saveEditKetua(editingKetua.id, {periode:editingKetua.periode, ketua_nama:editingKetua.ketua_nama, ketua_npm:editingKetua.ketua_npm, ketua_foto:editingKetua.ketua_foto, wakil_nama:editingKetua.wakil_nama, wakil_npm:editingKetua.wakil_npm, wakil_foto:editingKetua.wakil_foto})}>Simpan</button>
              <button style={S.ghostBtn} onClick={() => setEditingKetua(null)}>Batal</button>
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
                <input ref={kabinetLogoRef} type="file" accept="image/*" style={{display:"none"}} onChange={e => e.target.files[0] && compressImage(e.target.files[0], 400, 0.85).then(src => setEditingKabinet(k => ({...k, logo: src})))} />
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

      {activeKabinetModal && (
        <div style={S.modalOverlay} onClick={() => setActiveKabinetModal(null)}>
          <div style={{...S.modalBox,maxWidth:340}} onClick={e => e.stopPropagation()}>
            <div style={S.hofKabinetModalBadge}>
              {activeKabinetModal.logo ? <img src={activeKabinetModal.logo} alt="" style={S.hofBackBadgeImg} /> : <div style={{fontSize:28}}>🛡️</div>}
            </div>
            <div style={S.hofKabinetModalPattern} />
            <div style={S.modalTitle}>{activeKabinetModal.nama_kabinet}</div>
            <div style={{fontSize:13,color:C.muted,fontStyle:"italic",marginBottom:14}}>{activeKabinetModal.periode ? "Periode " + activeKabinetModal.periode : ""}</div>
            <div style={{fontSize:14,lineHeight:1.7,color:"#333",textAlign:"left",whiteSpace:"pre-wrap"}}>{activeKabinetModal.filosofi || "Filosofi kabinet belum diisi."}</div>
            <button style={{...S.ghostBtn,marginTop:18}} onClick={() => setActiveKabinetModal(null)}>Tutup</button>
          </div>
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
                <div style={S.maknaLogoRow}>
                  <div style={S.maknaLogoImgWrap}>
                    <img src="/logo-kabinet.png" alt="Logo" style={S.maknaLogoImg} onError={e => e.target.style.display="none"} />
                  </div>
                  <div style={S.maknaLogoText}>
                    <p style={S.visiText}>Logo <strong style={{color:C.gold}}>Cakra Samagra</strong> merupakan representasi dari pusaran air (cakram) yang berputar menuju titik inti di bagian tengah sebagai simbol organisasi. Titik pusat menggambarkan HIMA IP sebagai inti yang menjadi pusat pergerakan, dikelilingi oleh pusaran yang mencerminkan dinamika organisasi. Lima pilar yang mengelilingi titik pusat melambangkan lima misi organisasi yang menjadi penopang sekaligus penjaga arah pergerakan HIMA IP. Garis lengkung pada bagian luar melambangkan pelindung yang membentuk pusaran terkuat, menggambarkan kekuatan dan kesatuan dalam menjaga keberlangsungan organisasi.</p>
                    <p style={{...S.visiText,marginBottom:0}}>Warna <strong style={{color:C.gold}}>emas</strong> pada logo melambangkan kemewahan, kekayaan, dan kemakmuran. Warna ini juga menjadi simbol kekuasaan yang mencerminkan kehormatan, kewibawaan, serta harapan agar HIMA IP mampu terus berkembang sebagai organisasi yang kuat, bermartabat, dan berpengaruh dalam menjalankan visi dan misinya.</p>
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

          <div style={S.hofToggleRow}>
            <button style={{...S.hofToggleBtn, ...(hofView === "ketua" ? S.hofToggleBtnActive : {})}} onClick={() => setHofView("ketua")}>Ketua</button>
            <button style={{...S.hofToggleBtn, ...(hofView === "kabinet" ? S.hofToggleBtnActive : {})}} onClick={() => setHofView("kabinet")}>Kabinet</button>
          </div>

          {hofView === "ketua" && (
            <div style={S.hofKetuaSection}>
              {hofCards.length === 0 ? (
                <div style={S.emptyState}>
                  Belum ada data Ketua &amp; Wakil.
                  {isAdmin && <div style={{marginTop:14}}><button style={S.primaryBtn} onClick={addKetuaPeriode}>+ Tambah Periode</button></div>}
                </div>
              ) : (
                <>
                  <div style={S.hofCardStage} onTouchStart={hofTouchStart} onTouchEnd={hofTouchEnd}>
                    <button style={{...S.hofArrowBtn,left:0}} onClick={hofPrev} aria-label="Sebelumnya">‹</button>
                    <div key={hofIndex} className={hofDir === 1 ? "hof-slide-next" : "hof-slide-prev"}>
                      <KetuaCard card={hofCurrent} flipped={hofFlipped} onFlip={() => setHofFlipped(f => !f)} onLihatKabinet={() => goToKabinet(hofCurrent.periode)} isAdmin={isAdmin} onEdit={() => setEditingKetua(hofCurrent)} />
                    </div>
                    <button style={{...S.hofArrowBtn,right:0}} onClick={hofNext} aria-label="Berikutnya">›</button>
                  </div>
                  <div style={S.hofDots}>
                    {hofCards.map((c, i) => (
                      <span key={i} style={{...S.hofDot, ...(i === hofIndex ? S.hofDotActive : {})}}>♦</span>
                    ))}
                  </div>
                  {isAdmin && (
                    <div style={{textAlign:"center",marginTop:16}}>
                      <button style={S.ghostBtn} onClick={addKetuaPeriode}>+ Tambah Periode Baru</button>
                    </div>
                  )}
                </>
              )}

              <div style={S.hofQuoteBar}>
                <div style={S.hofQuoteText}>"{LEADERSHIP_QUOTES[hofQuoteIdx]}"</div>
              </div>
            </div>
          )}

          {hofView === "kabinet" && (
            <div style={S.hofKabinetSection}>
              {isAdmin && (
                <div style={{textAlign:"center",marginBottom:24}}>
                  <button style={S.primaryBtn} onClick={addKabinet}>+ Tambah Kabinet</button>
                </div>
              )}
              {hofKabinetSorted.length === 0 ? (
                <div style={S.emptyState}>Belum ada data kabinet.</div>
              ) : (
                <div style={S.hofKabinetList}>
                  {hofKabinetSorted.map(k => (
                    <div key={k.id} ref={el => (kabinetRefs.current[k.id] = el)} style={S.hofKabinetItem}>
                      <div style={S.hofCardCorner1} />
                      <div style={S.hofCardCorner2} />
                      <div style={S.hofKabinetLogoWrap} onClick={() => setActiveKabinetModal(k)}>
                        {k.logo ? <img src={k.logo} alt={k.nama_kabinet} style={S.hofKabinetLogoImg} /> : <div style={S.hofKabinetLogoEmpty}>🛡️</div>}
                      </div>
                      <div style={S.hofKabinetInfo} onClick={() => setActiveKabinetModal(k)}>
                        <div style={S.hofKabinetName}>{k.nama_kabinet || "Nama Kabinet"}</div>
                        <div style={S.hofKabinetPeriode}>{k.periode ? "Periode " + k.periode : "-"}</div>
                        {isAdmin && (
                          <div style={{display:"flex",gap:14,marginTop:8}}>
                            <button style={S.deleteLink} onClick={e => { e.stopPropagation(); setEditingKabinet(k); }}>Edit</button>
                            <button style={S.deleteLink} onClick={e => { e.stopPropagation(); deleteKabinet(k.id); }}>Hapus</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
function KetuaCard({ card, flipped, onFlip, onLihatKabinet, isAdmin, onEdit }) {
  if (!card) return null;
  const nama = card.role === "ketua" ? card.ketua_nama : card.wakil_nama;
  const npm = card.role === "ketua" ? card.ketua_npm : card.wakil_npm;
  const foto = card.role === "ketua" ? card.ketua_foto : card.wakil_foto;
  const jabatanLabel = card.role === "ketua" ? "Ketua HIMA-IP" : "Wakil Ketua HIMA-IP";
  return (
    <div style={S.hofCardOuter}>
      <div style={{...S.hofCardInner, transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)"}}>
        <div style={{...S.hofCardFace, ...S.hofCardFront}} onClick={onFlip}>
          {isAdmin && (
            <button style={S.hofEditBtn} onClick={e => { e.stopPropagation(); onEdit(); }} title="Edit kartu">✎</button>
          )}
          <div style={S.hofCardCorner1} />
          <div style={S.hofCardCorner2} />
          <div style={S.hofPhotoWrap}>
            {foto ? <img src={foto} alt={nama || ""} style={S.hofPhotoImg} /> : <div style={S.hofPhotoEmpty}>👤</div>}
          </div>
          <div style={S.hofJabatan}>{jabatanLabel}</div>
          <div style={S.hofPeriodeSmall}>Periode {card.periode || "-"}</div>
          <div style={S.hofNama}>{nama || "Nama...."}</div>
          <div style={S.hofNpm}>NPM {npm || "...."}</div>
          <button style={S.hofLihatKabinetBtn} onClick={e => { e.stopPropagation(); onLihatKabinet(); }}>Lihat Kabinet</button>
          <div style={S.hofTapHint}>Ketuk kartu untuk membalik ↺</div>
        </div>
        <div style={{...S.hofCardFace, ...S.hofCardBack}} onClick={onFlip}>
          <img
            src="/hof-card-back.png"
            alt="Kartu Belakang"
            style={S.hofBackFullImg}
            onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "block"; }}
          />
          <div style={{...S.hofBackContent, display:"none"}}>
            <div style={S.hofBatikPattern} />
            <div style={S.hofBackEyebrow}>Himpunan Mahasiswa</div>
            <div style={S.hofBackTitle}>Ilmu Pemerintahan</div>
            <div style={S.hofBackSub}>STISIP Tasikmalaya</div>
            <div style={S.hofBackBadge}>
              <img src="/logo-kabinet.png" alt="Logo" style={S.hofBackBadgeImg} onError={e => e.target.style.display="none"} />
            </div>
          </div>
        </div>
      </div>
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
  maknaLogoRow:{display:"flex",gap:32,alignItems:"flex-start",flexWrap:"wrap"},
  maknaLogoImgWrap:{flexShrink:0,width:160,height:160,background:"rgba(255,255,255,0.08)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid rgba(182,138,61,0.3)"},
  maknaLogoImg:{width:130,height:130,objectFit:"contain"},
  maknaLogoText:{flex:1,minWidth:200},
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
  hofWrap:{paddingTop:58,background:C.offwhite,minHeight:"100vh"},
  hofHeroLabel:{textAlign:"center",padding:"36px 20px 0"},
  hofHeroEyebrow:{fontSize:12,letterSpacing:3,color:C.gold,fontWeight:700,textTransform:"uppercase"},
  hofHeroTitle:{fontFamily:"Georgia,serif",fontSize:"clamp(26px,4.5vw,40px)",fontWeight:700,color:C.navy,marginTop:6},
  hofToggleRow:{display:"flex",justifyContent:"center",gap:10,padding:"22px 20px 0"},
  hofToggleBtn:{background:"transparent",border:`1px solid ${C.navy}`,color:C.navy,padding:"9px 22px",borderRadius:30,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"},
  hofToggleBtnActive:{background:C.navy,color:C.white},
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
  hofKabinetModalBadge:{width:90,height:90,margin:"0 auto 4px",display:"flex",alignItems:"center",justifyContent:"center"},
  hofKabinetModalPattern:{height:14,margin:"0 -30px 18px",backgroundImage:"repeating-linear-gradient(45deg, transparent 0 6px, rgba(182,138,61,0.4) 6px 7px), repeating-linear-gradient(-45deg, transparent 0 6px, rgba(182,138,61,0.4) 6px 7px)",backgroundColor:C.red}
};
