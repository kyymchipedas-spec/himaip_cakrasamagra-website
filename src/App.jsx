import React, { useState, useEffect, useRef } from "react";

const SUPABASE_URL = "https://vwhfzqbpqrxonswzjbft.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3aGZ6cWJwcXJ4b25zd3pqYmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MTg4ODAsImV4cCI6MjA5ODQ5NDg4MH0.gyWUpVWyTaQL5Tr3lR5N1YxfjEak2IKci4pwkMPnBtM";
const ADMIN_CODE = "himaip2026";

const db = {
  async get(table, query = "") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?order=created_at.desc${query}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    return res.json();
  },
  async insert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async delete(table, id) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
  },
  async update(table, id, data) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
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
  const [loginError, setLoginError] = useState("");
  const [activeEvent, setActiveEvent] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [busy, setBusy] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventDesc, setNewEventDesc] = useState("");
  const [lpjTitle, setLpjTitle] = useState("");
  const [newMember, setNewMember] = useState({ name: "", npm: "", jabatan: "", semester: "", photo: "" });
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const photoInputRef = useRef(null);
  const lpjFileInputRef = useRef(null);
  const memberPhotoRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => { loadAll(); }, []);

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
      const mem = await db.get("members", "&order=created_at.asc");
      setMembers(Array.isArray(mem) ? mem : []);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  function tryLogin() {
    if (codeInput === ADMIN_CODE) { setIsAdmin(true); setShowLogin(false); setCodeInput(""); setLoginError(""); setShowWelcome(true); }
    else setLoginError("Kode salah. Coba lagi.");
  }
  function navigate(t) { setTab(t); setMenuOpen(false); setActiveEvent(null); window.scrollTo({ top: 0, behavior: "smooth" }); }
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
        const photo = { id: "p_" + Date.now() + Math.random().toString(36).slice(2,6), event_id: eventId, src, caption: "" };
        await db.insert("photos", photo);
        setPhotosByEvent(p => ({ ...p, [eventId]: [photo, ...(p[eventId] || [])] }));
      } catch(e) { console.error(e); }
    }
    setBusy(false);
  }
  async function deletePhoto(eventId, photoId) {
    await db.delete("photos", photoId);
    setPhotosByEvent(p => ({ ...p, [eventId]: (p[eventId] || []).filter(x => x.id !== photoId) }));
  }
  async function uploadLpjFiles(fileList) {
    setBusy(true);
    for (const file of Array.from(fileList)) {
      try {
        const isImage = file.type.startsWith("image/");
        const data_url = isImage ? await compressImage(file, 1000, 0.7) : await fileToDataUrl(file);
        const doc = { id: "d_" + Date.now() + Math.random().toString(36).slice(2,6), title: lpjTitle.trim() || file.name, name: file.name, type: file.type, is_image: isImage, data_url, date: new Date().toISOString().slice(0,10) };
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
  async function addMember() {
    if (!newMember.name.trim()) return;
    const m = { id: "m_" + Date.now(), ...newMember };
    await db.insert("members", m);
    setMembers(mem => [...mem, m]);
    setNewMember({ name: "", npm: "", jabatan: "", semester: "", photo: "" });
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
  function movePhoto(eventId, photoId, direction) {
    const photos = [...(photosByEvent[eventId] || [])];
    const idx = photos.findIndex(p => p.id === photoId);
    if (direction === "up" && idx > 0) [photos[idx-1], photos[idx]] = [photos[idx], photos[idx-1]];
    else if (direction === "down" && idx < photos.length - 1) [photos[idx], photos[idx+1]] = [photos[idx+1], photos[idx]];
    setPhotosByEvent(p => ({ ...p, [eventId]: photos }));
  }

  const totalPhotos = Object.values(photosByEvent).reduce((a, b) => a + b.length, 0);

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.headerLeft}>
          <button style={S.hamburger} onClick={() => setMenuOpen(!menuOpen)}>
            <span style={S.bar}/><span style={S.bar}/><span style={S.bar}/>
          </button>
          <button style={S.adminBtnHeader} onClick={() => isAdmin ? setShowLogoutConfirm(true) : setShowLogin(true)}>
            {isAdmin ? "Keluar Admin" : "Masuk Admin"}
          </button>
        </div>
        <div style={{...S.headerTitle, cursor:"pointer"}} onClick={() => navigate("beranda")}>
          WEBSITE ARSIP HIMA IP
        </div>
      </header>

      {menuOpen && (
        <div style={S.drawerOverlay} onClick={() => setMenuOpen(false)}>
          <div style={S.drawer} onClick={e => e.stopPropagation()}>
            <div style={S.drawerTitle}>HIMA IP</div>
            {[["beranda","Beranda"],["galeri","Galeri Kegiatan"],["anggota","Anggota"],["lpj","LPJ"]].map(([key,label]) => (
              <button key={key} style={{...S.drawerItem,...(tab===key?S.drawerItemActive:{})}} onClick={() => navigate(key)}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {showLogin && (
        <div style={S.modalOverlay} onClick={() => setShowLogin(false)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>Akses Admin</div>
            <div style={{position:"relative"}}>
              <input type={showPass ? "text" : "password"} value={codeInput} onChange={e => setCodeInput(e.target.value)} onKeyDown={e => e.key==="Enter" && tryLogin()} placeholder="Kode admin" style={{...S.input, paddingRight:44}} autoFocus />
              <button type="button" onClick={() => setShowPass(p => !p)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:18,opacity:0.6}}>{showPass ? "🙈" : "👁️"}</button>
            </div>
            {loginError && <div style={S.errorText}>{loginError}</div>}
            <div style={{display:"flex",gap:10,marginTop:14}}>
              <button onClick={tryLogin} style={S.primaryBtn}>Masuk</button>
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
            <button onClick={() => setShowWelcome(false)} style={S.primaryBtn}>Siap! 🚀</button>
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
              <button onClick={() => { setIsAdmin(false); setShowLogoutConfirm(false); }} style={S.primaryBtn}>Ya, Keluar</button>
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
            <input style={{...S.input,marginBottom:10}} placeholder="Nama" defaultValue={editingMember.name} onChange={e => setEditingMember(m => ({...m,name:e.target.value}))} />
            <input style={{...S.input,marginBottom:10}} placeholder="NPM" defaultValue={editingMember.npm} onChange={e => setEditingMember(m => ({...m,npm:e.target.value}))} />
            <input style={{...S.input,marginBottom:10}} placeholder="Jabatan" defaultValue={editingMember.jabatan} onChange={e => setEditingMember(m => ({...m,jabatan:e.target.value}))} />
            <input style={{...S.input,marginBottom:14}} placeholder="Semester" defaultValue={editingMember.semester} onChange={e => setEditingMember(m => ({...m,semester:e.target.value}))} />
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button style={S.primaryBtn} onClick={() => saveEditMember(editingMember.id,{name:editingMember.name,npm:editingMember.npm,jabatan:editingMember.jabatan,semester:editingMember.semester})}>Simpan</button>
              <button style={S.ghostBtn} onClick={() => setEditingMember(null)}>Batal</button>
            </div>
          </div>
        </div>
      )}
      {lightbox && (
        <div style={S.lightboxOverlay} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" style={S.lightboxImg} onClick={e => e.stopPropagation()} />
        </div>
      )}

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
                    <p style={S.visiText}>Logo <strong style={{color:C.gold}}>Cakra Samagra</strong> menggambarkan roda (cakra) yang berputar selaras — melambangkan pergerakan bersama seluruh elemen mahasiswa Ilmu Pemerintahan yang saling bersinergi demi kemajuan organisasi dan almamater.</p>
                    <p style={{...S.visiText,marginBottom:0}}>Warna <strong style={{color:C.gold}}>emas</strong> mencerminkan kemuliaan, integritas, dan semangat berkarya. Simbol roda mewakili gerak yang tak pernah berhenti — terus melangkah, terus berdampak.</p>
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
                      <div key={ev.id} style={S.eventCard} onClick={() => setActiveEvent(ev.id)}>
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
            <button style={S.backBtn} onClick={() => setActiveEvent(null)}>← Kembali ke Galeri</button>
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
                    {isAdmin && <div style={{position:"absolute",top:6,right:6,display:"flex",flexDirection:"column",gap:3}}><button style={{...S.photoDeleteBtn,width:22,height:22,fontSize:10}} onClick={() => movePhoto(activeEvent,p.id,"up")}>▲</button><button style={{...S.photoDeleteBtn,width:22,height:22,fontSize:10}} onClick={() => movePhoto(activeEvent,p.id,"down")}>▼</button><button style={{...S.photoDeleteBtn,width:22,height:22,fontSize:10}} onClick={() => deletePhoto(activeEvent,p.id)}>✕</button></div>}
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
                  {isAdmin && <div style={{display:"flex",gap:10,marginTop:8}}><button style={S.deleteLink} onClick={() => setEditingMember(m)}>Edit</button><button style={S.deleteLink} onClick={() => deleteMember(m.id)}>Hapus</button></div>}
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {tab === "lpj" && (
        <main style={S.main}>
          <SectionHeader eyebrow="PERTANGGUNGJAWABAN" title="Laporan Pertanggungjawaban (LPJ)" />
          {isAdmin && (
            <div style={S.formCard}>
              <div style={S.formCardTitle}>+ Unggah Berkas LPJ</div>
              <input style={S.input} placeholder="Judul berkas (opsional)" value={lpjTitle} onChange={e => setLpjTitle(e.target.value)} />
              <input ref={lpjFileInputRef} type="file" multiple style={{display:"none"}} onChange={e => e.target.files.length && uploadLpjFiles(e.target.files)} />
              <button style={{...S.primaryBtn,marginTop:12}} disabled={busy} onClick={() => lpjFileInputRef.current.click()}>{busy ? "Mengunggah…" : "Pilih Berkas / Foto"}</button>
            </div>
          )}
          {lpjDocs.length === 0 ? <div style={S.emptyState}>Belum ada berkas LPJ.</div> : (
            <div style={S.docGrid}>
              {lpjDocs.map(d => (
                <div key={d.id} style={S.docCard}>
                  {d.is_image ? <img src={d.data_url} alt={d.title} style={S.docThumb} onClick={() => setLightbox(d.data_url)} /> : <div style={S.docIconWrap} onClick={() => window.open(d.data_url,"_blank")}><DocIcon /></div>}
                  <div style={S.docBody}>
                    <div style={S.docTitle}>{d.title}</div>
                    <div style={S.docMeta}>{d.name} · {formatDate(d.date)}</div>
                    <div style={{display:"flex",gap:10,marginTop:6}}>
                      <a href={d.data_url} download={d.name} style={S.docLink}>Unduh</a>
                      {isAdmin && <button style={S.deleteLink} onClick={() => deleteLpjDoc(d.id)}>Hapus</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

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
          </div>
        </div>
        <div style={S.footerBottom}>© 2026 HIMA IP Cakra Samagra — STISIP Tasikmalaya</div>
      </footer>
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
function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

const C = { black:"#0A0A0A", gold:"#B68A3D", white:"#FFFFFF", offwhite:"#F5F0E8", red:"#8C2E33", navy:"#1B2A45", muted:"#666666" };

const S = {
  page:{minHeight:"100vh",background:C.offwhite,color:"#1F1B16",fontFamily:"'Inter',sans-serif"},
  header:{position:"fixed",top:0,left:0,right:0,zIndex:100,background:C.black,borderBottom:`2px solid ${C.gold}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",height:58,boxSizing:"border-box"},
  headerLeft:{display:"flex",alignItems:"center",gap:14},
  headerTitle:{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:13,color:C.gold,letterSpacing:2,textTransform:"uppercase"},
  hamburger:{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",gap:5,padding:4},
  bar:{display:"block",width:24,height:2,background:C.white,borderRadius:2},
  adminBtnHeader:{background:C.red,color:C.white,border:"none",fontWeight:600,fontSize:13,padding:"7px 14px",borderRadius:4,cursor:"pointer",fontFamily:"'Inter',sans-serif"},
  drawerOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:200},
  drawer:{position:"absolute",left:0,top:0,bottom:0,width:260,background:C.black,borderRight:`2px solid ${C.gold}`,paddingTop:60},
  drawerTitle:{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:18,color:C.gold,padding:"0 24px 20px",borderBottom:`1px solid rgba(182,138,61,0.3)`,marginBottom:10},
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
  statSection:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",background:"#e0d8c8",margin:0 -40px},
  statCard:{padding:"28px 20px",textAlign:"center",background:C.white},
  statNum:{fontFamily:"Georgia,serif",fontSize:36,fontWeight:700,color:C.gold,lineHeight:1},
  statLabel:{marginTop:6,fontSize:11,color:C.muted,letterSpacing:1,textTransform:"uppercase"},
  visiSection:{background:C.navy,padding:"70px 0"},
  visiInner:{maxWidth:800,margin:"0 auto",padding:"0 40px"},
  visiText:{fontSize:15.5,lineHeight:1.75,color:"rgba(255,255,255,0.85)",marginBottom:24,marginTop:0},
  misiList:{paddingLeft:20,color:"rgba(255,255,255,0.85)",lineHeight:2,fontSize:15.5,marginBottom:40},
  maknaLogoRow:{display:"flex",gap:32,alignItems:"flex-start",flexWrap:"wrap"},
  maknaLogoImgWrap:{flexShrink:0,width:160,height:160,background:"rgba(255,255,255,0.08)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid rgba(182,138,61,0.3)`},
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
  memberPhotoWrap:{width:"100%",height:160,background:"#f0ebe0",borderRadius:6,overflow:"hidden",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"center"},
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
  eventDesc:{fontSize:15,lineHeight:1.6,opacity:0.8,marginBottom:20},
  modalOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:20},
  modalBox:{background:"#FAF7F2",borderRadius:8,padding:30,maxWidth:380,width:"100%",textAlign:"center"},
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
};
