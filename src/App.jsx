import React, { useState, useEffect, useRef } from "react";

const ADMIN_CODE = "himaip2026";

const SEAL = (
  <svg viewBox="0 0 100 100" className="w-full h-full">
    <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="1" />
    <path id="sealCircle" d="M 50,12 A 38,38 0 1 1 49.9,12" fill="none" />
    <text fontSize="7.2" fill="currentColor" letterSpacing="2">
      <textPath href="#sealCircle" startOffset="2%">
        HIMPUNAN MAHASISWA ILMU PEMERINTAHAN • STISIP TASIKMALAYA •
      </textPath>
    </text>
    <text x="50" y="46" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor">HIMA</text>
    <text x="50" y="60" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor">IP</text>
  </svg>
);

function compressImage(file, maxW = 1000, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function storeGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function storeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    alert("Penyimpanan browser penuh. Coba hapus beberapa foto/berkas lama.");
    return false;
  }
}

export default function App() {
  const [tab, setTab] = useState("beranda");
  const [events, setEvents] = useState([]);
  const [photosByEvent, setPhotosByEvent] = useState({});
  const [lpjDocs, setLpjDocs] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeEvent, setActiveEvent] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [busy, setBusy] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventDesc, setNewEventDesc] = useState("");
  const photoInputRef = useRef(null);
  const lpjFileInputRef = useRef(null);
  const [lpjTitle, setLpjTitle] = useState("");

  useEffect(() => {
    const evs = storeGet("events:list") || [];
    setEvents(evs);
    const photoMap = {};
    for (const ev of evs) {
      photoMap[ev.id] = storeGet(`photos:${ev.id}`) || [];
    }
    setPhotosByEvent(photoMap);
    const lpj = storeGet("lpj:list") || [];
    setLpjDocs(lpj);
    const mem = storeGet("members:list") || [];
    setMembers(mem);
    setLoading(false);
  }, []);

  function tryLogin() {
    if (codeInput === ADMIN_CODE) {
      setIsAdmin(true); setShowLogin(false); setCodeInput(""); setLoginError("");
    } else { setLoginError("Kode salah. Coba lagi."); }
  }

  function addEvent() {
    if (!newEventName.trim()) return;
    const ev = { id: "ev_" + Date.now(), name: newEventName.trim(), date: newEventDate || "", desc: newEventDesc.trim() };
    const updated = [ev, ...events];
    setEvents(updated);
    setPhotosByEvent((p) => ({ ...p, [ev.id]: [] }));
    setNewEventName(""); setNewEventDate(""); setNewEventDesc("");
    storeSet("events:list", updated);
  }

  function deleteEvent(id) {
    if (!confirm("Hapus kegiatan ini beserta semua fotonya?")) return;
    const updated = events.filter((e) => e.id !== id);
    setEvents(updated);
    storeSet("events:list", updated);
    localStorage.removeItem(`photos:${id}`);
    if (activeEvent === id) setActiveEvent(null);
  }

  async function uploadPhotos(eventId, fileList) {
    setBusy(true);
    const existing = photosByEvent[eventId] || [];
    const newPhotos = [];
    for (const file of Array.from(fileList)) {
      try {
        const dataUrl = await compressImage(file);
        newPhotos.push({ id: "p_" + Date.now() + Math.random().toString(36).slice(2, 7), src: dataUrl, caption: "" });
      } catch (e) { console.error("Gagal kompres foto", e); }
    }
    const updated = [...newPhotos, ...existing];
    setPhotosByEvent((p) => ({ ...p, [eventId]: updated }));
    storeSet(`photos:${eventId}`, updated);
    setBusy(false);
  }

  function deletePhoto(eventId, photoId) {
    const updated = (photosByEvent[eventId] || []).filter((p) => p.id !== photoId);
    setPhotosByEvent((p) => ({ ...p, [eventId]: updated }));
    storeSet(`photos:${eventId}`, updated);
  }

  async function uploadLpjFiles(fileList) {
    setBusy(true);
    const additions = [];
    for (const file of Array.from(fileList)) {
      try {
        const isImage = file.type.startsWith("image/");
        const dataUrl = isImage ? await compressImage(file, 1400, 0.78) : await fileToDataUrl(file);
        additions.push({ id: "d_" + Date.now() + Math.random().toString(36).slice(2, 7), title: lpjTitle.trim() || file.name, name: file.name, type: file.type, isImage, dataUrl, date: new Date().toISOString().slice(0, 10) });
      } catch (e) { console.error("Gagal unggah berkas", e); }
    }
    const updated = [...additions, ...lpjDocs];
    setLpjDocs(updated);
    storeSet("lpj:list", updated);
    setLpjTitle("");
    setBusy(false);
  }

  function deleteLpjDoc(id) {
    const updated = lpjDocs.filter((d) => d.id !== id);
    setLpjDocs(updated); storeSet("lpj:list", updated);
  }

  async function addMember(name, position, division, photoFile) {
    setBusy(true);
    let photoUrl = null;
    if (photoFile) {
      try { photoUrl = await compressImage(photoFile, 600, 0.8); } catch (e) { console.error(e); }
    }
    const member = { id: "m_" + Date.now() + Math.random().toString(36).slice(2, 7), name: name.trim(), position: position.trim(), division: division.trim(), photoUrl };
    const updated = [...members, member];
    setMembers(updated); storeSet("members:list", updated);
    setBusy(false);
  }

  function deleteMember(id) {
    if (!confirm("Hapus anggota ini?")) return;
    const updated = members.filter((m) => m.id !== id);
    setMembers(updated); storeSet("members:list", updated);
  }

  const totalPhotos = Object.values(photosByEvent).reduce((a, b) => a + b.length, 0);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.brandRow}>
            <div style={styles.logoWrap}>
              <img src="/logo-himaip.png" alt="Logo HIMA IP" style={styles.logoImg}
                onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "block"; }} />
              <div style={{ display: "none", width: 40, height: 40, color: "white" }}><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2"/><text x="50" y="55" textAnchor="middle" fontSize="20" fontWeight="700" fill="currentColor">IP</text></svg></div>
            </div>
            <div>
              <div style={styles.brandTitle}>Cakra Samagra</div>
              <div style={styles.brandSub}>Himpunan Mahasiswa Ilmu Pemerintahan — STISIP Tasikmalaya</div>
            </div>
          </div>
          <nav style={styles.nav}>
            {[["beranda","Beranda"],["galeri","Galeri Kegiatan"],["anggota","Anggota"],["lpj","LPJ"]].map(([key, label]) => (
              <button key={key} onClick={() => { setTab(key); setActiveEvent(null); }}
                style={{ ...styles.navBtn, ...(tab === key ? styles.navBtnActive : {}) }}>{label}</button>
            ))}
            <button onClick={() => (isAdmin ? setIsAdmin(false) : setShowLogin(true))} style={styles.adminBtn}>
              {isAdmin ? "Keluar Admin" : "Masuk Admin"}
            </button>
          </nav>
        </div>
      </header>

      {showLogin && (
        <div style={styles.modalOverlay} onClick={() => setShowLogin(false)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Akses Admin</div>
            <p style={styles.modalText}>Masukkan kode admin.</p>
            <input type="password" value={codeInput} onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && tryLogin()} placeholder="Kode admin" style={styles.input} autoFocus />
            {loginError && <div style={styles.errorText}>{loginError}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={tryLogin} style={styles.primaryBtn}>Masuk</button>
              <button onClick={() => setShowLogin(false)} style={styles.ghostBtn}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div style={styles.lightboxOverlay} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" style={styles.lightboxImg} onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <main style={styles.main}>
        {loading ? <div style={styles.loadingText}>Memuat arsip…</div> : (
          <>
            {tab === "beranda" && <Beranda eventsCount={events.length} photosCount={totalPhotos} lpjCount={lpjDocs.length} onGoGaleri={() => setTab("galeri")} onGoLpj={() => setTab("lpj")} />}
            {tab === "galeri" && !activeEvent && <GaleriList events={events} photosByEvent={photosByEvent} isAdmin={isAdmin} onOpen={setActiveEvent} onDelete={deleteEvent} newEventName={newEventName} setNewEventName={setNewEventName} newEventDate={newEventDate} setNewEventDate={setNewEventDate} newEventDesc={newEventDesc} setNewEventDesc={setNewEventDesc} addEvent={addEvent} />}
            {tab === "galeri" && activeEvent && <EventDetail event={events.find((e) => e.id === activeEvent)} photos={photosByEvent[activeEvent] || []} isAdmin={isAdmin} busy={busy} onBack={() => setActiveEvent(null)} onUpload={(files) => uploadPhotos(activeEvent, files)} onDeletePhoto={(pid) => deletePhoto(activeEvent, pid)} onLightbox={setLightbox} photoInputRef={photoInputRef} />}
            {tab === "anggota" && <AnggotaSection members={members} isAdmin={isAdmin} busy={busy} onAdd={addMember} onDelete={deleteMember} onLightbox={setLightbox} />}
            {tab === "lpj" && <LpjSection docs={lpjDocs} isAdmin={isAdmin} busy={busy} lpjTitle={lpjTitle} setLpjTitle={setLpjTitle} onUpload={uploadLpjFiles} onDelete={deleteLpjDoc} onLightbox={setLightbox} fileInputRef={lpjFileInputRef} />}
          </>
        )}
      </main>

      <footer style={styles.footer}>
        <div style={{ fontWeight: 600 }}>Cakra Samagra — HIMA IP</div>
        <div style={{ opacity: 0.7, fontSize: 13 }}>Himpunan Mahasiswa Ilmu Pemerintahan STISIP Tasikmalaya · Periode 2026–2027</div>
      </footer>
    </div>
  );
}

function Beranda({ eventsCount, photosCount, lpjCount, onGoGaleri, onGoLpj }) {
  return (
    <section>
      <div style={styles.hero}>
        <video autoPlay loop muted playsInline style={styles.heroVideo}>
          <source src="/video-himaip.mp4" type="video/mp4" />
        </video>
        <div style={styles.heroOverlay} />
        <div style={styles.heroKabinetLogo}>
          <img src="/logo-kabinet.png" alt="Logo Kabinet"
            style={{ width: "100%", height: "100%", objectFit: "contain", opacity: 0.25 }}
            onError={(e) => { e.target.style.display = "none"; }} />
        </div>
        <div style={styles.heroEyebrow}>HIMPUNAN MAHASISWA ILMU PEMERINTAHAN STISIP TASIKMALAYA</div>
        <h1 style={styles.heroTitle}>Cakra Samagra<br />Periode 2026–2027</h1>
        <p style={styles.heroText}>Setiap kegiatan dicatat, setiap berkas diarsipkan. Ruang ini menyimpan jejak kerja Himpunan Mahasiswa Ilmu Pemerintahan — dari forum diskusi hingga malam keakraban, dari proposal hingga laporan akhir masa jabatan.</p>
        <div style={{ position: "relative", zIndex: 2, display: "flex", gap: 12, flexWrap: "wrap", marginTop: 26 }}>
          <button style={styles.primaryBtn} onClick={onGoGaleri}>Lihat Galeri Kegiatan</button>
          <button style={styles.ghostBtnLight} onClick={onGoLpj}>Buka LPJ</button>
        </div>
      </div>
      <div style={styles.statRow}>
        <StatCard num={eventsCount} label="Kegiatan Terdokumentasi" />
        <StatCard num={photosCount} label="Foto Tersimpan" />
        <StatCard num={lpjCount} label="Berkas LPJ" />
      </div>
    </section>
  );
}

function StatCard({ num, label }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statNum}>{String(num).padStart(2, "0")}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function AnggotaSection({ members, isAdmin, busy, onAdd, onDelete, onLightbox }) {
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [division, setDivision] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const memberPhotoRef = useRef(null);

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!name.trim() || !position.trim()) return;
    await onAdd(name, position, division, photoFile);
    setName(""); setPosition(""); setDivision(""); setPhotoFile(null); setPhotoPreview(null);
    if (memberPhotoRef.current) memberPhotoRef.current.value = "";
  }

  const grouped = {};
  for (const m of members) {
    const key = m.division || "Umum";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  }

  return (
    <section>
      <div style={styles.sectionHeader}>
        <div style={styles.eyebrow}>KABINET CAKRA SAMAGRA</div>
        <h2 style={styles.sectionTitle}>Daftar Anggota</h2>
        <div style={styles.sectionRule} />
      </div>

      {isAdmin && (
        <div style={styles.formCard}>
          <div style={styles.formCardTitle}>+ Tambah Anggota</div>
          <div style={styles.formRow}>
            <input style={styles.input} placeholder="Nama lengkap *" value={name} onChange={(e) => setName(e.target.value)} />
            <input style={styles.input} placeholder="Jabatan * (mis. Ketua Umum)" value={position} onChange={(e) => setPosition(e.target.value)} />
          </div>
          <input style={{ ...styles.input, marginTop: 10 }} placeholder="Divisi (mis. Divisi Acara)" value={division} onChange={(e) => setDivision(e.target.value)} />
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
            <input ref={memberPhotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
            <button style={styles.ghostBtn} onClick={() => memberPhotoRef.current.click()}>{photoFile ? "Ganti Foto" : "Upload Foto"}</button>
            {photoPreview && <img src={photoPreview} alt="preview" style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", border: "2px solid #c0392b" }} />}
          </div>
          <button style={{ ...styles.primaryBtn, marginTop: 14 }} disabled={busy} onClick={handleSubmit}>
            {busy ? "Menyimpan…" : "Simpan Anggota"}
          </button>
        </div>
      )}

      {members.length === 0 ? (
        <div style={styles.emptyState}>{isAdmin ? "Belum ada anggota. Tambahkan anggota pertama di atas." : "Belum ada data anggota."}</div>
      ) : (
        Object.entries(grouped).map(([div, divMembers]) => (
          <div key={div} style={{ marginBottom: 36 }}>
            <div style={styles.divisionLabel}>{div}</div>
            <div style={styles.memberGrid}>
              {divMembers.map((m) => (
                <div key={m.id} style={styles.memberCard}>
                  <div style={styles.memberPhotoWrap} onClick={() => m.photoUrl && onLightbox(m.photoUrl)}>
                    {m.photoUrl
                      ? <img src={m.photoUrl} alt={m.name} style={styles.memberPhoto} />
                      : <div style={styles.memberPhotoPlaceholder}>{m.name.charAt(0).toUpperCase()}</div>}
                  </div>
                  <div style={styles.memberName}>{m.name}</div>
                  <div style={styles.memberPosition}>{m.position}</div>
                  {isAdmin && <button style={{ ...styles.deleteLink, marginTop: 6 }} onClick={() => onDelete(m.id)}>Hapus</button>}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

function GaleriList({ events, photosByEvent, isAdmin, onOpen, onDelete, newEventName, setNewEventName, newEventDate, setNewEventDate, newEventDesc, setNewEventDesc, addEvent }) {
  return (
    <section>
      <div style={styles.sectionHeader}>
        <div style={styles.eyebrow}>ARSIP VISUAL</div>
        <h2 style={styles.sectionTitle}>Galeri Kegiatan</h2>
        <div style={styles.sectionRule} />
      </div>
      {isAdmin && (
        <div style={styles.formCard}>
          <div style={styles.formCardTitle}>+ Tambah Kegiatan Baru</div>
          <div style={styles.formRow}>
            <input style={styles.input} placeholder="Nama kegiatan" value={newEventName} onChange={(e) => setNewEventName(e.target.value)} />
            <input style={styles.input} type="date" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} />
          </div>
          <textarea style={{ ...styles.input, marginTop: 10, minHeight: 60, resize: "vertical" }} placeholder="Deskripsi singkat (opsional)" value={newEventDesc} onChange={(e) => setNewEventDesc(e.target.value)} />
          <button style={{ ...styles.primaryBtn, marginTop: 12 }} onClick={addEvent}>Simpan Kegiatan</button>
        </div>
      )}
      {events.length === 0
        ? <div style={styles.emptyState}>{isAdmin ? "Belum ada kegiatan." : "Belum ada kegiatan yang diarsipkan."}</div>
        : <div style={styles.eventGrid}>
            {events.map((ev) => {
              const photos = photosByEvent[ev.id] || [];
              const cover = photos[0]?.src;
              return (
                <div key={ev.id} style={styles.eventCard} onClick={() => onOpen(ev.id)}>
                  <div style={styles.eventCover}>
                    {cover ? <img src={cover} alt={ev.name} style={styles.eventCoverImg} /> : <div style={styles.eventCoverEmpty}>Belum ada foto</div>}
                    <div style={styles.eventCoverBadge}>{photos.length} foto</div>
                  </div>
                  <div style={styles.eventCardBody}>
                    <div style={styles.eventCardName}>{ev.name}</div>
                    {ev.date && <div style={styles.eventCardDate}>{formatDate(ev.date)}</div>}
                    {isAdmin && <button style={styles.deleteLink} onClick={(e) => { e.stopPropagation(); onDelete(ev.id); }}>Hapus</button>}
                  </div>
                </div>
              );
            })}
          </div>}
    </section>
  );
}

function EventDetail({ event, photos, isAdmin, busy, onBack, onUpload, onDeletePhoto, onLightbox, photoInputRef }) {
  if (!event) return null;
  return (
    <section>
      <button style={styles.backBtn} onClick={onBack}>← Kembali ke Galeri</button>
      <div style={styles.sectionHeader}>
        <div style={styles.eyebrow}>{event.date ? formatDate(event.date) : "KEGIATAN"}</div>
        <h2 style={styles.sectionTitle}>{event.name}</h2>
        <div style={styles.sectionRule} />
      </div>
      {event.desc && <p style={styles.eventDesc}>{event.desc}</p>}
      {isAdmin && (
        <div style={styles.uploadBar}>
          <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => e.target.files.length && onUpload(e.target.files)} />
          <button style={styles.primaryBtn} disabled={busy} onClick={() => photoInputRef.current.click()}>{busy ? "Mengunggah…" : "+ Unggah Foto"}</button>
        </div>
      )}
      {photos.length === 0
        ? <div style={styles.emptyState}>Belum ada foto untuk kegiatan ini.</div>
        : <div style={styles.photoGrid}>
            {photos.map((p) => (
              <div key={p.id} style={styles.photoTile}>
                <img src={p.src} alt="" style={styles.photoImg} onClick={() => onLightbox(p.src)} />
                {isAdmin && <button style={styles.photoDeleteBtn} onClick={() => onDeletePhoto(p.id)}>✕</button>}
              </div>
            ))}
          </div>}
    </section>
  );
}

function LpjSection({ docs, isAdmin, busy, lpjTitle, setLpjTitle, onUpload, onDelete, onLightbox, fileInputRef }) {
  return (
    <section>
      <div style={styles.sectionHeader}>
        <div style={styles.eyebrow}>PERTANGGUNGJAWABAN</div>
        <h2 style={styles.sectionTitle}>Laporan Pertanggungjawaban (LPJ)</h2>
        <div style={styles.sectionRule} />
      </div>
      {isAdmin && (
        <div style={styles.formCard}>
          <div style={styles.formCardTitle}>+ Unggah Berkas LPJ</div>
          <input style={styles.input} placeholder="Judul berkas (opsional)" value={lpjTitle} onChange={(e) => setLpjTitle(e.target.value)} />
          <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => e.target.files.length && onUpload(e.target.files)} />
          <button style={{ ...styles.primaryBtn, marginTop: 12 }} disabled={busy} onClick={() => fileInputRef.current.click()}>{busy ? "Mengunggah…" : "Pilih Berkas / Foto"}</button>
        </div>
      )}
      {docs.length === 0
        ? <div style={styles.emptyState}>{isAdmin ? "Belum ada berkas LPJ." : "Belum ada berkas LPJ yang diarsipkan."}</div>
        : <div style={styles.docGrid}>
            {docs.map((d) => (
              <div key={d.id} style={styles.docCard}>
                {d.isImage
                  ? <img src={d.dataUrl} alt={d.title} style={styles.docThumb} onClick={() => onLightbox(d.dataUrl)} />
                  : <div style={styles.docIconWrap} onClick={() => window.open(d.dataUrl, "_blank")}><svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2"><rect x="8" y="4" width="32" height="40" rx="3"/><path d="M16 16h16M16 24h16M16 32h10"/></svg></div>}
                <div style={styles.docBody}>
                  <div style={styles.docTitle}>{d.title}</div>
                  <div style={styles.docMeta}>{d.name} · {formatDate(d.date)}</div>
                  <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                    <a href={d.dataUrl} download={d.name} style={styles.docLink}>Unduh</a>
                    {isAdmin && <button style={styles.deleteLink} onClick={() => onDelete(d.id)}>Hapus</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>}
    </section>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

const C = { navy: "#0f2044", navyDark: "#0a1628", red: "#c0392b", gold: "#d4a017", white: "#ffffff", offWhite: "#f5f6f8", text: "#1a1a2e", muted: "#6b7280", border: "#e2e8f0" };

const styles = {
  page: { minHeight: "100vh", fontFamily: "'Segoe UI', Arial, sans-serif", background: C.offWhite, color: C.text },
  header: { background: C.navyDark, color: C.white, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" },
  headerInner: { maxWidth: 1100, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, gap: 16 },
  brandRow: { display: "flex", alignItems: "center", gap: 12 },
  logoWrap: { width: 40, height: 40, flexShrink: 0 },
  logoImg: { width: 40, height: 40, objectFit: "contain" },
  brandTitle: { fontSize: 16, fontWeight: 700, color: C.white },
  brandSub: { fontSize: 11, opacity: 0.7, color: C.white },
  nav: { display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" },
  navBtn: { background: "none", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", padding: "6px 12px", fontSize: 14, borderRadius: 6 },
  navBtnActive: { color: C.white, background: "rgba(255,255,255,0.12)", fontWeight: 600 },
  adminBtn: { background: C.red, color: C.white, border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginLeft: 8 },
  main: { maxWidth: 1100, margin: "0 auto", padding: "0 20px 60px" },
  loadingText: { textAlign: "center", padding: 80, color: C.muted },
  hero: { position: "relative", borderRadius: 16, overflow: "hidden", marginTop: 32, minHeight: 400, display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px 48px", color: C.white },
  heroVideo: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 },
  heroOverlay: { position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(10,22,40,0.88) 0%, rgba(10,22,40,0.65) 100%)", zIndex: 1 },
  heroKabinetLogo: { position: "absolute", right: 40, top: "50%", transform: "translateY(-50%)", width: 200, height: 200, zIndex: 2 },
  heroEyebrow: { position: "relative", zIndex: 2, fontSize: 11, letterSpacing: 3, fontWeight: 600, color: C.gold, textTransform: "uppercase", marginBottom: 14 },
  heroTitle: { position: "relative", zIndex: 2, fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, lineHeight: 1.15, margin: "0 0 18px", color: C.white },
  heroText: { position: "relative", zIndex: 2, fontSize: 15, lineHeight: 1.7, maxWidth: 540, color: "rgba(255,255,255,0.85)", margin: 0 },
  statRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", background: C.white, borderRadius: "0 0 16px 16px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", marginBottom: 40 },
  statCard: { padding: "28px 24px", borderLeft: "3px solid #c0392b", margin: "16px 0" },
  statNum: { fontSize: 36, fontWeight: 800, color: C.navy, lineHeight: 1 },
  statLabel: { fontSize: 13, color: C.muted, marginTop: 6 },
  sectionHeader: { paddingTop: 40, marginBottom: 28 },
  eyebrow: { fontSize: 11, letterSpacing: 3, fontWeight: 700, color: C.red, textTransform: "uppercase", marginBottom: 8 },
  sectionTitle: { fontSize: 28, fontWeight: 800, color: C.navy, margin: "0 0 16px" },
  sectionRule: { width: 48, height: 3, background: C.red, borderRadius: 2 },
  divisionLabel: { fontSize: 13, fontWeight: 700, color: C.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16, paddingBottom: 8, borderBottom: "1px solid #e2e8f0" },
  memberGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 20 },
  memberCard: { background: C.white, borderRadius: 12, padding: "20px 16px", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0" },
  memberPhotoWrap: { width: 80, height: 80, borderRadius: "50%", overflow: "hidden", margin: "0 auto 12px", cursor: "pointer", border: "3px solid #0f2044" },
  memberPhoto: { width: "100%", height: "100%", objectFit: "cover" },
  memberPhotoPlaceholder: { width: "100%", height: "100%", background: "#0f2044", color: C.white, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700 },
  memberName: { fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 4 },
  memberPosition: { fontSize: 12, color: C.muted },
  eventGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 },
  eventCard: { background: C.white, borderRadius: 12, overflow: "hidden", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0" },
  eventCover: { position: "relative", height: 160, background: C.navy },
  eventCoverImg: { width: "100%", height: "100%", objectFit: "cover" },
  eventCoverEmpty: { display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "rgba(255,255,255,0.4)", fontSize: 13 },
  eventCoverBadge: { position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.6)", color: C.white, fontSize: 11, padding: "3px 8px", borderRadius: 20 },
  eventCardBody: { padding: "14px 16px" },
  eventCardName: { fontSize: 15, fontWeight: 700, color: C.navy, marginBottom: 4 },
  eventCardDate: { fontSize: 12, color: C.muted },
  eventDesc: { fontSize: 14, color: C.muted, lineHeight: 1.7, marginBottom: 20 },
  uploadBar: { marginBottom: 20 },
  photoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 },
  photoTile: { position: "relative", borderRadius: 8, overflow: "hidden", aspectRatio: "1", background: "#e2e8f0" },
  photoImg: { width: "100%", height: "100%", objectFit: "cover", cursor: "pointer", display: "block" },
  photoDeleteBtn: { position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", color: C.white, border: "none", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", fontSize: 12 },
  docGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 },
  docCard: { background: C.white, borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column" },
  docThumb: { width: "100%", height: 160, objectFit: "cover", cursor: "pointer" },
  docIconWrap: { height: 120, display: "flex", alignItems: "center", justifyContent: "center", background: C.offWhite, color: C.navy, cursor: "pointer" },
  docBody: { padding: "14px 16px" },
  docTitle: { fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 4 },
  docMeta: { fontSize: 12, color: C.muted },
  docLink: { fontSize: 13, color: C.red, fontWeight: 600, textDecoration: "none" },
  formCard: { background: C.white, borderRadius: 12, padding: "20px 24px", marginBottom: 28, border: "1px solid #e2e8f0" },
  formCardTitle: { fontSize: 15, fontWeight: 700, color: C.navy, marginBottom: 14 },
  formRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  input: { width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, color: C.text, background: C.white, boxSizing: "border-box" },
  primaryBtn: { background: C.red, color: C.white, border: "none", borderRadius: 8, padding: "10px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  ghostBtn: { background: "transparent", color: C.navy, border: "1.5px solid #0f2044", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  ghostBtnLight: { background: "transparent", color: C.white, border: "1.5px solid rgba(255,255,255,0.7)", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", position: "relative", zIndex: 2 },
  backBtn: { background: "none", border: "none", color: C.red, fontWeight: 600, cursor: "pointer", fontSize: 14, padding: "8px 0", marginTop: 24 },
  deleteLink: { background: "none", border: "none", color: C.red, fontSize: 13, cursor: "pointer", padding: 0, fontWeight: 600 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" },
  modalBox: { background: C.white, borderRadius: 16, padding: "32px 28px", maxWidth: 380, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" },
  modalTitle: { fontSize: 20, fontWeight: 800, color: C.navy, marginBottom: 8, textAlign: "center" },
  modalText: { fontSize: 14, color: C.muted, textAlign: "center", marginBottom: 16 },
  errorText: { color: C.red, fontSize: 13, marginTop: 8 },
  lightboxOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" },
  lightboxImg: { maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, objectFit: "contain" },
  footer: { background: C.navyDark, color: C.white, padding: "28px 40px", display: "flex", flexDirection: "column", gap: 4 },
  emptyState: { textAlign: "center", padding: "48px 20px", color: C.muted, fontSize: 14, border: "1.5px dashed #e2e8f0", borderRadius: 12 },
};
