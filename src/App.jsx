import React, { useState, useEffect, useRef } from "react";

const ADMIN_CODE = "himaip2026";

function storeGet(key) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; }
  catch(e) { return null; }
}
function storeSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch(e) { alert("Penyimpanan penuh."); return false; }
}
function formatDate(d) {
  if (!d) return "";
  try { return new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return d; }
}
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}
async function uploadToCloudinary(file, folder) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", folder);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: formData });
  const data = await res.json();
  return data.secure_url;
}

export default function App() {
  const [tab, setTab] = useState("beranda");
  const [menuOpen, setMenuOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [photosByEvent, setPhotosByEvent] = useState({});
  const [lpjDocs, setLpjDocs] = useState([]);
  const [members, setMembers] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeEvent, setActiveEvent] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [busy, setBusy] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventDesc, setNewEventDesc] = useState("");
  const [lpjTitle, setLpjTitle] = useState("");
  const [newMember, setNewMember] = useState({ name: "", npm: "", jabatan: "", semester: "" });
  const [memberPhotoFile, setMemberPhotoFile] = useState(null);
  const [memberPhotoPreview, setMemberPhotoPreview] = useState(null);
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editMemberFields, setEditMemberFields] = useState({});
  const [editMemberPhotoFile, setEditMemberPhotoFile] = useState(null);
  const [editMemberPhotoPreview, setEditMemberPhotoPreview] = useState(null);
  const photoInputRef = useRef(null);
  const lpjFileInputRef = useRef(null);
  const memberPhotoRef = useRef(null);
  const editMemberPhotoRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    const evs = storeGet("events:list") || [];
    setEvents(evs);
    const photoMap = {};
    for (const ev of evs) photoMap[ev.id] = storeGet(`photos:${ev.id}`) || [];
    setPhotosByEvent(photoMap);
    setLpjDocs(storeGet("lpj:list") || []);
    setMembers(storeGet("members:list") || []);
  }, []);

  function tryLogin() {
    if (codeInput === ADMIN_CODE) {
      setIsAdmin(true); setShowLogin(false); setCodeInput(""); setLoginError(""); setShowPassword(false);
    } else setLoginError("Kode salah. Coba lagi.");
  }
  function tryLogout() {
    if (confirm("Apakah Anda yakin ingin keluar dari mode Admin?")) setIsAdmin(false);
  }
  function navigate(t) { setTab(t); setMenuOpen(false); setActiveEvent(null); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function scrollToContent() { contentRef.current?.scrollIntoView({ behavior: "smooth" }); }

  function addEvent() {
    if (!newEventName.trim()) return;
    const ev = { id: "ev_" + Date.now(), name: newEventName.trim(), date: newEventDate || "", desc: newEventDesc.trim() };
    const updated = [ev, ...events];
    setEvents(updated); setPhotosByEvent(p => ({ ...p, [ev.id]: [] }));
    setNewEventName(""); setNewEventDate(""); setNewEventDesc("");
    storeSet("events:list", updated);
  }
  function deleteEvent(id) {
    if (!confirm("Hapus kegiatan ini?")) return;
    const updated = events.filter(e => e.id !== id);
    setEvents(updated); storeSet("events:list", updated);
    localStorage.removeItem(`photos:${id}`);
    if (activeEvent === id) setActiveEvent(null);
  }
  async function uploadPhotos(eventId, fileList) {
    setBusy(true);
    const existing = photosByEvent[eventId] || [];
    const newPhotos = [];
    for (const file of Array.from(fileList)) {
      try {
        const url = await uploadToCloudinary(file, `himaip/galeri/${eventId}`);
        newPhotos.push({ id: "p_" + Date.now() + Math.random().toString(36).slice(2,7), src: url });
      } catch(e) { console.error("Gagal upload foto", e); }
    }
    const updated = [...newPhotos, ...existing];
    setPhotosByEvent((p) => ({ ...p, [eventId]: updated }));
    storeSet(`photos:${eventId}`, updated);
    setBusy(false);
  }
  function deletePhoto(eventId, photoId) {
    const updated = (photosByEvent[eventId] || []).filter(p => p.id !== photoId);
    setPhotosByEvent(p => ({ ...p, [eventId]: updated }));
    storeSet(`photos:${eventId}`, updated);
  }
  async function uploadLpjFiles(fileList) {
    setBusy(true);
    const additions = [];
    for (const file of Array.from(fileList)) {
      try {
        const isImage = file.type.startsWith("image/");
        const dataUrl = isImage
          ? await uploadToCloudinary(file, "himaip/lpj")
          : await fileToDataUrl(file);
        additions.push({ id: "d_" + Date.now() + Math.random().toString(36).slice(2,7), title: lpjTitle.trim() || file.name, name: file.name, type: file.type, isImage, dataUrl, date: new Date().toISOString().slice(0,10) });
      } catch(e) {}
    }
    const updated = [...additions, ...lpjDocs];
    setLpjDocs(updated); storeSet("lpj:list", updated); setLpjTitle(""); setBusy(false);
  }
  function deleteLpjDoc(id) { const u = lpjDocs.filter(d => d.id !== id); setLpjDocs(u); storeSet("lpj:list", u); }

  async function addMember() {
    if (!newMember.name.trim()) return;
    setBusy(true);
    let photoUrl = null;
    if (memberPhotoFile) {
      try { photoUrl = await uploadToCloudinary(memberPhotoFile, "himaip/anggota"); }
      catch(e) { console.error(e); }
    }
    const m = { id: "m_" + Date.now(), ...newMember, photo: photoUrl || "" };
    const updated = [...members, m];
    setMembers(updated); storeSet("members:list", updated);
    setNewMember({ name: "", npm: "", jabatan: "", semester: "" });
    setMemberPhotoFile(null); setMemberPhotoPreview(null);
    if (memberPhotoRef.current) memberPhotoRef.current.value = "";
    setBusy(false);
  }

  function startEditMember(m) {
    setEditingMemberId(m.id);
    setEditMemberFields({ name: m.name, npm: m.npm||"", jabatan: m.jabatan||"", semester: m.semester||"" });
    setEditMemberPhotoPreview(m.photo || null);
    setEditMemberPhotoFile(null);
  }

  async function saveEditMember(id) {
    setBusy(true);
    let photoUrl = members.find(m => m.id === id)?.photo || "";
    if (editMemberPhotoFile) {
      try { photoUrl = await uploadToCloudinary(editMemberPhotoFile, "himaip/anggota"); }
      catch(e) { console.error(e); }
    }
    const updated = members.map(m => m.id === id ? { ...m, ...editMemberFields, photo: photoUrl } : m);
    setMembers(updated); storeSet("members:list", updated);
    setEditingMemberId(null); setBusy(false);
  }

  function deleteMember(id) { const u = members.filter(m => m.id !== id); setMembers(u); storeSet("members:list", u); }

  const totalPhotos = Object.values(photosByEvent).reduce((a, b) => a + b.length, 0);

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.headerLeft}>
          <button style={S.hamburger} onClick={() => setMenuOpen(!menuOpen)}>
            <span style={S.bar}/><span style={S.bar}/><span style={S.bar}/>
          </button>
          <button style={S.adminBtnHeader} onClick={() => isAdmin ? tryLogout() : setShowLogin(true)}>
            {isAdmin ? "Keluar" : "Masuk Admin"}
          </button>
        </div>
        <div style={S.headerTitle}>WEBSITE ARSIP HIMA IP</div>
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
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={codeInput}
                onChange={e => setCodeInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && tryLogin()}
                placeholder="Kode admin" style={{ ...S.input, paddingRight: 44 }} autoFocus
              />
              <button onClick={() => setShowPassword(v => !v)} style={S.eyeBtn}>{showPassword ? "🙈" : "👁️"}</button>
            </div>
            {loginError && <div style={S.errorText}>{loginError}</div>}
            <div style={{display:"flex",gap:10,marginTop:14}}>
              <button onClick={tryLogin} style={S.primaryBtn}>Masuk</button>
              <button onClick={() => { setShowLogin(false); setCodeInput(""); setLoginError(""); }} style={S.ghostBtn}>Batal</button>
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
                <p style={S.visiText}>Logo Cakra Samagra menggambarkan roda (cakra) yang berputar selaras — melambangkan pergerakan bersama seluruh elemen mahasiswa Ilmu Pemerintahan yang saling bersinergi demi kemajuan organisasi dan almamater. Warna emas mencerminkan kemuliaan, integritas, dan semangat berkarya.</p>
              </div>
            </div>
            <div style={S.statSection}>
              <StatCard num={events.length} label="Kegiatan" />
              <StatCard num={totalPhotos} label="Foto" />
              <StatCard num={lpjDocs.length} label="Berkas LPJ" />
              <StatCard num={members.length} label="Anggota" />
            </div>
          </div>
        </>
      )}

      {tab === "galeri" && !activeEvent && (
        <main style={S.main}>
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
          {events.length === 0 ? <div style={S.emptyState}>Belum ada kegiatan yang diarsipkan.</div> : (
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
                      {isAdmin && <button style={S.deleteLink} onClick={e => { e.stopPropagation(); deleteEvent(ev.id); }}>Hapus</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {tab === "galeri" && activeEvent && (
        <main style={S.main}>
          {(() => {
            const event = events.find(e => e.id === activeEvent);
            const photos = photosByEvent[activeEvent] || [];
            if (!event) return null;
            return (
              <>
                <button style={S.backBtn} onClick={() => setActiveEvent(null)}>← Kembali ke Galeri</button>
                <SectionHeader eyebrow={event.date ? formatDate(event.date) : "KEGIATAN"} title={event.name} />
                {event.desc && <p style={S.eventDesc}>{event.desc}</p>}
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
                        {isAdmin && <button style={S.photoDeleteBtn} onClick={() => deletePhoto(activeEvent, p.id)}>✕</button>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </main>
      )}

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
              <div style={{marginTop:10,display:"flex",alignItems:"center",gap:12}}>
                <input ref={memberPhotoRef} type="file" accept="image/*" style={{display:"none"}} onChange={e => {
                  const file = e.target.files[0]; if (!file) return;
                  setMemberPhotoFile(file);
                  const reader = new FileReader(); reader.onload = ev => setMemberPhotoPreview(ev.target.result); reader.readAsDataURL(file);
                }} />
                <button style={S.ghostBtn} onClick={() => memberPhotoRef.current.click()}>{memberPhotoFile ? "Foto dipilih ✓" : "Pilih Foto"}</button>
                {memberPhotoPreview && <img src={memberPhotoPreview} alt="preview" style={{width:50,height:66,objectFit:"cover",borderRadius:4,border:"2px solid #8C2E33"}} />}
              </div>
              <button style={{...S.primaryBtn,marginTop:12}} disabled={busy} onClick={addMember}>{busy ? "Menyimpan…" : "Simpan Anggota"}</button>
            </div>
          )}
          {members.length === 0 ? <div style={S.emptyState}>Belum ada anggota yang ditambahkan.</div> : (
            <div style={S.memberGrid}>
              {members.map(m => (
                <div key={m.id} style={S.memberCard}>
                  {editingMemberId === m.id ? (
                    <>
                      <div style={{...S.memberPhotoWrap,cursor:"pointer",position:"relative"}} onClick={() => editMemberPhotoRef.current.click()}>
                        {editMemberPhotoPreview
                          ? <img src={editMemberPhotoPreview} alt="" style={S.memberPhoto} />
                          : <div style={S.memberPhotoEmpty}>📷</div>}
                        <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,0.5)",color:"#fff",textAlign:"center",fontSize:11,padding:"4px 0"}}>Ganti Foto</div>
                      </div>
                      <input ref={editMemberPhotoRef} type="file" accept="image/*" style={{display:"none"}} onChange={e => {
                        const file = e.target.files[0]; if (!file) return;
                        setEditMemberPhotoFile(file);
                        const reader = new FileReader(); reader.onload = ev => setEditMemberPhotoPreview(ev.target.result); reader.readAsDataURL(file);
                      }} />
                      <input style={{...S.input,marginBottom:6,fontSize:13}} placeholder="Nama" value={editMemberFields.name} onChange={e => setEditMemberFields(f=>({...f,name:e.target.value}))} />
                      <input style={{...S.input,marginBottom:6,fontSize:13}} placeholder="NPM" value={editMemberFields.npm} onChange={e => setEditMemberFields(f=>({...f,npm:e.target.value}))} />
                      <input style={{...S.input,marginBottom:6,fontSize:13}} placeholder="Jabatan" value={editMemberFields.jabatan} onChange={e => setEditMemberFields(f=>({...f,jabatan:e.target.value}))} />
                      <input style={{...S.input,marginBottom:10,fontSize:13}} placeholder="Semester" value={editMemberFields.semester} onChange={e => setEditMemberFields(f=>({...f,semester:e.target.value}))} />
                      <div style={{display:"flex",gap:6}}>
                        <button style={{...S.primaryBtn,fontSize:12,padding:"7px 14px"}} disabled={busy} onClick={() => saveEditMember(m.id)}>{busy?"Menyimpan…":"Simpan"}</button>
                        <button style={{...S.ghostBtn,fontSize:12,padding:"7px 14px"}} onClick={() => setEditingMemberId(null)}>Batal</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={S.memberPhotoWrap}>
                        {m.photo ? <img src={m.photo} alt={m.name} style={S.memberPhoto} onClick={() => setLightbox(m.photo)} /> : <div style={S.memberPhotoEmpty}>📷</div>}
                      </div>
                      <div style={S.memberName}>{m.name}</div>
                      <div style={S.memberRow}><span style={S.memberLabel}>NPM</span><span>{m.npm||"-"}</span></div>
                      <div style={S.memberRow}><span style={S.memberLabel}>Jabatan</span><span>{m.jabatan||"-"}</span></div>
                      <div style={S.memberRow}><span style={S.memberLabel}>Semester</span><span>{m.semester||"-"}</span></div>
                      {isAdmin && (
                        <div style={{display:"flex",gap:10,marginTop:8}}>
                          <button style={{...S.deleteLink,color:"#1B2A45"}} onClick={() => startEditMember(m)}>Edit</button>
                          <button style={S.deleteLink} onClick={() => deleteMember(m.id)}>Hapus</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {tab === "lpj" && (
        <main style={S.main}>
          <SectionHeader eyebrow="PERTANGGUNGJAWABAN" title="Laporan Pertanggungjawaban (LPJ)" />
          {!isAdmin ? (
            <div style={S.lpjLocked}>
              <div style={{fontSize:48,marginBottom:16}}>🔒</div>
              <h2 style={{fontFamily:"Georgia,serif",fontSize:22,color:"#1B2A45",marginBottom:12}}>Akses Terbatas</h2>
              <p style={{fontSize:15,color:"#666",lineHeight:1.7,maxWidth:400,margin:"0 auto"}}>Mohon maaf, Anda bukan admin. Silahkan pastikan bahwa Anda yang berwenang dalam mengakses surat-surat ini.</p>
            </div>
          ) : (
            <>
              <div style={S.formCard}>
                <div style={S.formCardTitle}>+ Unggah Berkas LPJ</div>
                <input style={S.input} placeholder="Judul berkas (opsional)" value={lpjTitle} onChange={e => setLpjTitle(e.target.value)} />
                <input ref={lpjFileInputRef} type="file" multiple style={{display:"none"}} onChange={e => e.target.files.length && uploadLpjFiles(e.target.files)} />
                <button style={{...S.primaryBtn,marginTop:12}} disabled={busy} onClick={() => lpjFileInputRef.current.click()}>{busy ? "Mengunggah…" : "Pilih Berkas / Foto"}</button>
              </div>
              {lpjDocs.length === 0 ? <div style={S.emptyState}>Belum ada berkas LPJ.</div> : (
                <div style={S.docGrid}>
                  {lpjDocs.map(d => (
                    <div key={d.id} style={S.docCard}>
                      {d.isImage ? <img src={d.dataUrl} alt={d.title} style={S.docThumb} onClick={() => setLightbox(d.dataUrl)} /> : <div style={S.docIconWrap} onClick={() => window.open(d.dataUrl,"_blank")}><DocIcon /></div>}
                      <div style={S.docBody}>
                        <div style={S.docTitle}>{d.title}</div>
                        <div style={S.docMeta}>{d.name} · {formatDate(d.date)}</div>
                        <div style={{display:"flex",gap:10,marginTop:6}}>
                          <a href={d.dataUrl} download={d.name} style={S.docLink}>Unduh</a>
                          <button style={S.deleteLink} onClick={() => deleteLpjDoc(d.id)}>Hapus</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      )}

      <footer style={S.footer}>
        <div style={S.footerTop}>
          <div>
            <div style={S.footerTitle}>HIMA IP — CAKRA SAMAGRA</div>
            <div style={S.footerSub}>Himpunan Mahasiswa Ilmu Pemerintahan STISIP Tasikmalaya · 2026–2027</div>
          </div>
          <div style={S.footerSocials}>
            <a href="https://instagram.com/hima_ip_stisiptasik" target="_blank" rel="noreferrer" style={S.socialLink}>Instagram</a>
            <a href="https://tiktok.com/@hima_ip_stisiptasik" target="_blank" rel="noreferrer" style={S.socialLink}>TikTok</a>
            <a href="mailto:himaipstisiptasik@gmail.com" target="_blank" rel="noreferrer" style={S.socialLink}>Email</a>
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
  eyeBtn:{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:18},
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
  kabinetSection:{background:C.white,padding:"70px 40px",textAlign:"center",borderBottom:"1px solid #eee"},
  kabinetEyebrow:{fontSize:12,letterSpacing:3,color:C.gold,fontWeight:700,marginBottom:24,textTransform:"uppercase"},
  kabinetLogoRow:{display:"flex",alignItems:"center",justifyContent:"center",gap:24,marginBottom:24,flexWrap:"wrap"},
  kabinetLogo:{width:80,height:80,objectFit:"contain"},
  kabinetName:{fontFamily:"Georgia,serif",fontSize:"clamp(24px,4vw,38px)",fontWeight:700,color:C.navy,letterSpacing:2},
  kabinetPeriode:{fontFamily:"Georgia,serif",fontSize:20,fontStyle:"italic",color:C.muted,marginTop:4},
  kabinetQuote:{fontSize:15,lineHeight:1.8,color:C.muted,maxWidth:560,margin:"0 auto",fontStyle:"italic"},
  visiSection:{background:C.navy,padding:"70px 0"},
  visiInner:{maxWidth:800,margin:"0 auto",padding:"0 40px"},
  visiText:{fontSize:15.5,lineHeight:1.75,color:"rgba(255,255,255,0.85)",marginBottom:40,marginTop:0},
  misiList:{paddingLeft:20,color:"rgba(255,255,255,0.85)",lineHeight:2,fontSize:15.5,marginBottom:40},
  statSection:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",background:C.black},
  statCard:{padding:"32px 24px",borderRight:`1px solid rgba(182,138,61,0.2)`,textAlign:"center"},
  statNum:{fontFamily:"Georgia,serif",fontSize:42,fontWeight:700,color:C.gold,lineHeight:1},
  statLabel:{marginTop:8,fontSize:12,color:"rgba(255,255,255,0.6)",letterSpacing:1,textTransform:"uppercase"},
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
  memberCard:{background:C.white,border:"1px solid #e0d8c8",borderRadius:8,padding:16,position:"relative"},
  memberPhotoWrap:{width:"100%",height:200,background:"#f0ebe0",borderRadius:6,overflow:"hidden",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"},
  memberPhoto:{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top",cursor:"pointer"},
  memberPhotoEmpty:{fontSize:36,opacity:0.4},
  memberName:{fontFamily:"Georgia,serif",fontWeight:700,fontSize:15.5,color:C.navy,marginBottom:10},
  memberRow:{display:"flex",gap:8,fontSize:13,marginBottom:5,color:"#444"},
  memberLabel:{fontWeight:600,color:C.muted,minWidth:70},
  lpjLocked:{textAlign:"center",padding:"80px 20px",maxWidth:500,margin:"0 auto"},
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
  modalBox:{background:"#FAF7F2",borderRadius:8,padding:30,maxWidth:360,width:"100%",textAlign:"center",position:"relative"},
  modalTitle:{fontFamily:"Georgia,serif",fontWeight:700,fontSize:20,color:C.navy,marginBottom:16},
  errorText:{color:C.red,fontSize:13,marginTop:8},
  lightboxOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:600,padding:24,cursor:"zoom-out"},
  lightboxImg:{maxWidth:"100%",maxHeight:"100%",borderRadius:4},
  footer:{background:C.black,borderTop:`2px solid ${C.gold}`,padding:"40px 40px 24px"},
  footerTop:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:24,marginBottom:30},
  footerTitle:{fontWeight:700,fontSize:15,color:C.gold,letterSpacing:1,marginBottom:6},
  footerSub:{fontSize:13,color:"rgba(255,255,255,0.6)"},
  footerSocials:{display:"flex",flexDirection:"column",gap:8},
  socialLink:{color:"rgba(255,255,255,0.7)",fontSize:13,textDecoration:"none",fontWeight:500},
  footerBottom:{borderTop:"1px solid rgba(255,255,255,0.1)",paddingTop:20,fontSize:12,color:"rgba(255,255,255,0.4)",textAlign:"center"},
};
