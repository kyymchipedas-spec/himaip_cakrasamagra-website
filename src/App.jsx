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

// ---- localStorage helpers (menggantikan window.storage) ----
function storeGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("Gagal membaca localStorage", key, e);
    return null;
  }
}
function storeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error("Gagal menyimpan localStorage (mungkin penuh)", key, e);
    alert("Penyimpanan browser penuh atau gagal. Coba hapus beberapa foto/berkas lama, atau gunakan foto dengan ukuran lebih kecil.");
    return false;
  }
}

export default function App() {
  const [tab, setTab] = useState("beranda");
  const [events, setEvents] = useState([]);
  const [photosByEvent, setPhotosByEvent] = useState({});
  const [lpjDocs, setLpjDocs] = useState([]);
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
    setLoading(false);
  }, []);

  function tryLogin() {
    if (codeInput === ADMIN_CODE) {
      setIsAdmin(true);
      setShowLogin(false);
      setCodeInput("");
      setLoginError("");
    } else {
      setLoginError("Kode salah. Coba lagi.");
    }
  }

  function addEvent() {
    if (!newEventName.trim()) return;
    const ev = {
      id: "ev_" + Date.now(),
      name: newEventName.trim(),
      date: newEventDate || "",
      desc: newEventDesc.trim(),
    };
    const updated = [ev, ...events];
    setEvents(updated);
    setPhotosByEvent((p) => ({ ...p, [ev.id]: [] }));
    setNewEventName("");
    setNewEventDate("");
    setNewEventDesc("");
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
      } catch (e) {
        console.error("Gagal kompres foto", e);
      }
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
    const existing = lpjDocs;
    const additions = [];
    for (const file of Array.from(fileList)) {
      try {
        const isImage = file.type.startsWith("image/");
        const dataUrl = isImage ? await compressImage(file, 1400, 0.78) : await fileToDataUrl(file);
        additions.push({
          id: "d_" + Date.now() + Math.random().toString(36).slice(2, 7),
          title: lpjTitle.trim() || file.name,
          name: file.name,
          type: file.type,
          isImage,
          dataUrl,
          date: new Date().toISOString().slice(0, 10),
        });
      } catch (e) {
        console.error("Gagal unggah berkas", e);
      }
    }
    const updated = [...additions, ...existing];
    setLpjDocs(updated);
    storeSet("lpj:list", updated);
    setLpjTitle("");
    setBusy(false);
  }

  function deleteLpjDoc(id) {
    const updated = lpjDocs.filter((d) => d.id !== id);
    setLpjDocs(updated);
    storeSet("lpj:list", updated);
  }

  const totalPhotos = Object.values(photosByEvent).reduce((a, b) => a + b.length, 0);

  return (
    <div style={styles.page}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.brandRow}>
            <div style={styles.sealSmall}>{SEAL}</div>
            <div>
              <div style={styles.brandTitle}>HIMA IP</div>
              <div style={styles.brandSub}>Himpunan Mahasiswa Ilmu Pemerintahan — STISIP Tasikmalaya</div>
            </div>
          </div>
          <nav style={styles.nav}>
            {[
              ["beranda", "Beranda"],
              ["galeri", "Galeri Kegiatan"],
              ["lpj", "LPJ"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setTab(key); setActiveEvent(null); }}
                style={{ ...styles.navBtn, ...(tab === key ? styles.navBtnActive : {}) }}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => (isAdmin ? setIsAdmin(false) : setShowLogin(true))}
              style={styles.adminBtn}
            >
              {isAdmin ? "Keluar Admin" : "Masuk Admin"}
            </button>
          </nav>
        </div>
      </header>

      {/* LOGIN MODAL */}
      {showLogin && (
        <div style={styles.modalOverlay} onClick={() => setShowLogin(false)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalSeal}>{SEAL}</div>
            <div style={styles.modalTitle}>Akses Admin</div>
            <p style={styles.modalText}>Masukkan kode admin untuk mengunggah foto dan berkas LPJ.</p>
            <input
              type="password"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && tryLogin()}
              placeholder="Kode admin"
              style={styles.input}
              autoFocus
            />
            {loginError && <div style={styles.errorText}>{loginError}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={tryLogin} style={styles.primaryBtn}>Masuk</button>
              <button onClick={() => setShowLogin(false)} style={styles.ghostBtn}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightbox && (
        <div style={styles.lightboxOverlay} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" style={styles.lightboxImg} onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <main style={styles.main}>
        {loading ? (
          <div style={styles.loadingText}>Memuat arsip…</div>
        ) : (
          <>
            {tab === "beranda" && (
              <Beranda
                eventsCount={events.length}
                photosCount={totalPhotos}
                lpjCount={lpjDocs.length}
                onGoGaleri={() => setTab("galeri")}
                onGoLpj={() => setTab("lpj")}
              />
            )}

            {tab === "galeri" && !activeEvent && (
              <GaleriList
                events={events}
                photosByEvent={photosByEvent}
                isAdmin={isAdmin}
                onOpen={(id) => setActiveEvent(id)}
                onDelete={deleteEvent}
                newEventName={newEventName}
                setNewEventName={setNewEventName}
                newEventDate={newEventDate}
                setNewEventDate={setNewEventDate}
                newEventDesc={newEventDesc}
                setNewEventDesc={setNewEventDesc}
                addEvent={addEvent}
              />
            )}

            {tab === "galeri" && activeEvent && (
              <EventDetail
                event={events.find((e) => e.id === activeEvent)}
                photos={photosByEvent[activeEvent] || []}
                isAdmin={isAdmin}
                busy={busy}
                onBack={() => setActiveEvent(null)}
                onUpload={(files) => uploadPhotos(activeEvent, files)}
                onDeletePhoto={(pid) => deletePhoto(activeEvent, pid)}
                onLightbox={setLightbox}
                photoInputRef={photoInputRef}
              />
            )}

            {tab === "lpj" && (
              <LpjSection
                docs={lpjDocs}
                isAdmin={isAdmin}
                busy={busy}
                lpjTitle={lpjTitle}
                setLpjTitle={setLpjTitle}
                onUpload={uploadLpjFiles}
                onDelete={deleteLpjDoc}
                onLightbox={setLightbox}
                fileInputRef={lpjFileInputRef}
              />
            )}
          </>
        )}
      </main>

      <footer style={styles.footer}>
        <div style={styles.footerSeal}>{SEAL}</div>
        <div>
          <div style={{ fontWeight: 600 }}>HIMA IP — Ilmu Pemerintahan</div>
          <div style={{ opacity: 0.7, fontSize: 13 }}>Arsip kegiatan & pertanggungjawaban organisasi</div>
        </div>
      </footer>
    </div>
  );
}

function Beranda({ eventsCount, photosCount, lpjCount, onGoGaleri, onGoLpj }) {
  return (
    <section>
      <div style={styles.hero}>
        <div style={styles.heroSealWrap}>{SEAL}</div>
        <div style={styles.heroEyebrow}>ARSIP RESMI ORGANISASI</div>
        <h1 style={styles.heroTitle}>Dokumentasi Kegiatan &amp;<br />Pertanggungjawaban HIMA IP</h1>
        <p style={styles.heroText}>
          Setiap kegiatan dicatat, setiap berkas diarsipkan. Ruang ini menyimpan jejak kerja
          Himpunan Mahasiswa Ilmu Pemerintahan — dari forum diskusi hingga malam keakraban,
          dari proposal hingga laporan akhir masa jabatan.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 26 }}>
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

function GaleriList({
  events, photosByEvent, isAdmin, onOpen, onDelete,
  newEventName, setNewEventName, newEventDate, setNewEventDate, newEventDesc, setNewEventDesc, addEvent,
}) {
  return (
    <section>
      <SectionHeader eyebrow="ARSIP VISUAL" title="Galeri Kegiatan" />

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

      {events.length === 0 ? (
        <EmptyState text={isAdmin ? "Belum ada kegiatan. Tambahkan kegiatan pertama di atas." : "Belum ada kegiatan yang diarsipkan."} />
      ) : (
        <div style={styles.eventGrid}>
          {events.map((ev) => {
            const photos = photosByEvent[ev.id] || [];
            const cover = photos[0]?.src;
            return (
              <div key={ev.id} style={styles.eventCard} onClick={() => onOpen(ev.id)}>
                <div style={styles.eventCover}>
                  {cover ? (
                    <img src={cover} alt={ev.name} style={styles.eventCoverImg} />
                  ) : (
                    <div style={styles.eventCoverEmpty}>Belum ada foto</div>
                  )}
                  <div style={styles.eventCoverBadge}>{photos.length} foto</div>
                </div>
                <div style={styles.eventCardBody}>
                  <div style={styles.eventCardName}>{ev.name}</div>
                  {ev.date && <div style={styles.eventCardDate}>{formatDate(ev.date)}</div>}
                  {isAdmin && (
                    <button
                      style={styles.deleteLink}
                      onClick={(e) => { e.stopPropagation(); onDelete(ev.id); }}
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function EventDetail({ event, photos, isAdmin, busy, onBack, onUpload, onDeletePhoto, onLightbox, photoInputRef }) {
  if (!event) return null;
  return (
    <section>
      <button style={styles.backBtn} onClick={onBack}>← Kembali ke Galeri</button>
      <SectionHeader eyebrow={event.date ? formatDate(event.date) : "KEGIATAN"} title={event.name} />
      {event.desc && <p style={styles.eventDesc}>{event.desc}</p>}

      {isAdmin && (
        <div style={styles.uploadBar}>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => e.target.files.length && onUpload(e.target.files)}
          />
          <button style={styles.primaryBtn} disabled={busy} onClick={() => photoInputRef.current.click()}>
            {busy ? "Mengunggah…" : "+ Unggah Foto"}
          </button>
        </div>
      )}

      {photos.length === 0 ? (
        <EmptyState text="Belum ada foto untuk kegiatan ini." />
      ) : (
        <div style={styles.photoGrid}>
          {photos.map((p) => (
            <div key={p.id} style={styles.photoTile}>
              <img src={p.src} alt="" style={styles.photoImg} onClick={() => onLightbox(p.src)} />
              {isAdmin && (
                <button style={styles.photoDeleteBtn} onClick={() => onDeletePhoto(p.id)} title="Hapus foto">✕</button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function LpjSection({ docs, isAdmin, busy, lpjTitle, setLpjTitle, onUpload, onDelete, onLightbox, fileInputRef }) {
  return (
    <section>
      <SectionHeader eyebrow="PERTANGGUNGJAWABAN" title="Laporan Pertanggungjawaban (LPJ)" />
      <p style={{ ...styles.eventDesc, maxWidth: 640 }}>
        Berkas dan foto kegiatan untuk laporan pertanggungjawaban akhir masa jabatan pengurus HIMA IP.
      </p>

      {isAdmin && (
        <div style={styles.formCard}>
          <div style={styles.formCardTitle}>+ Unggah Berkas LPJ</div>
          <input
            style={styles.input}
            placeholder="Judul berkas (opsional, mis. 'LPJ Divisi Acara')"
            value={lpjTitle}
            onChange={(e) => setLpjTitle(e.target.value)}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(e) => e.target.files.length && onUpload(e.target.files)}
          />
          <button style={{ ...styles.primaryBtn, marginTop: 12 }} disabled={busy} onClick={() => fileInputRef.current.click()}>
            {busy ? "Mengunggah…" : "Pilih Berkas / Foto"}
          </button>
        </div>
      )}

      {docs.length === 0 ? (
        <EmptyState text={isAdmin ? "Belum ada berkas LPJ. Unggah berkas pertama di atas." : "Belum ada berkas LPJ yang diarsipkan."} />
      ) : (
        <div style={styles.docGrid}>
          {docs.map((d) => (
            <div key={d.id} style={styles.docCard}>
              {d.isImage ? (
                <img src={d.dataUrl} alt={d.title} style={styles.docThumb} onClick={() => onLightbox(d.dataUrl)} />
              ) : (
                <div style={styles.docIconWrap} onClick={() => window.open(d.dataUrl, "_blank")}>
                  <DocIcon />
                </div>
              )}
              <div style={styles.docBody}>
                <div style={styles.docTitle}>{d.title}</div>
                <div style={styles.docMeta}>{d.name} · {formatDate(d.date)}</div>
                <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                  <a href={d.dataUrl} download={d.name} style={styles.docLink}>Unduh</a>
                  {isAdmin && (
                    <button style={styles.deleteLink} onClick={() => onDelete(d.id)}>Hapus</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
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

function SectionHeader({ eyebrow, title }) {
  return (
    <div style={styles.sectionHeader}>
      <div style={styles.eyebrow}>{eyebrow}</div>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <div style={styles.rule} />
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptySeal}>{SEAL}</div>
      <div>{text}</div>
    </div>
  );
}

function formatDate(d) {
  if (!d) return "";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return d;
  }
}

const colors = {
  navy: "#1B2A45",
  navyDeep: "#10192C",
  parchment: "#EFE8D8",
  parchmentDark: "#E2D8C0",
  maroon: "#8C2E33",
  brass: "#B68A3D",
  ink: "#1F1B16",
};

const styles = {
  page: {
    minHeight: "100vh",
    background: colors.parchment,
    color: colors.ink,
    fontFamily: "'Inter', sans-serif",
  },
  header: {
    background: colors.navy,
    color: colors.parchment,
    borderBottom: `3px solid ${colors.brass}`,
    position: "sticky",
    top: 0,
    zIndex: 20,
  },
  headerInner: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "14px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  brandRow: { display: "flex", alignItems: "center", gap: 12 },
  sealSmall: { width: 40, height: 40, color: colors.brass, flexShrink: 0 },
  brandTitle: {
    fontFamily: "'Source Serif 4', serif",
    fontWeight: 700,
    fontSize: 19,
    letterSpacing: 0.5,
    lineHeight: 1.1,
  },
  brandSub: { fontSize: 11.5, opacity: 0.75, marginTop: 2 },
  nav: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  navBtn: {
    background: "transparent",
    border: "none",
    color: colors.parchment,
    opacity: 0.75,
    fontFamily: "'Inter', sans-serif",
    fontSize: 14,
    fontWeight: 500,
    padding: "8px 12px",
    cursor: "pointer",
    borderRadius: 4,
  },
  navBtnActive: { opacity: 1, background: "rgba(182,138,61,0.18)" },
  adminBtn: {
    marginLeft: 6,
    background: colors.brass,
    color: colors.navyDeep,
    border: "none",
    fontWeight: 600,
    fontSize: 13,
    padding: "8px 14px",
    borderRadius: 4,
    cursor: "pointer",
  },
  main: { maxWidth: 1100, margin: "0 auto", padding: "44px 20px 80px" },
  loadingText: { textAlign: "center", padding: "80px 0", opacity: 0.6, fontFamily: "'Source Serif 4', serif", fontSize: 18 },

  hero: {
    position: "relative",
    background: colors.navy,
    color: colors.parchment,
    borderRadius: 8,
    padding: "56px 40px",
    overflow: "hidden",
  },
  heroSealWrap: {
    position: "absolute",
    right: -40,
    top: -40,
    width: 260,
    height: 260,
    color: "rgba(182,138,61,0.14)",
  },
  heroEyebrow: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    letterSpacing: 3,
    color: colors.brass,
    marginBottom: 14,
  },
  heroTitle: {
    fontFamily: "'Source Serif 4', serif",
    fontSize: "clamp(28px, 4vw, 44px)",
    lineHeight: 1.15,
    fontWeight: 700,
    maxWidth: 680,
    margin: 0,
  },
  heroText: {
    marginTop: 18,
    maxWidth: 560,
    fontSize: 15.5,
    lineHeight: 1.65,
    color: "rgba(239,232,216,0.85)",
  },

  statRow: { display: "flex", gap: 16, marginTop: 28, flexWrap: "wrap" },
  statCard: {
    flex: "1 1 160px",
    background: "#fff",
    border: `1px solid ${colors.parchmentDark}`,
    borderLeft: `4px solid ${colors.maroon}`,
    borderRadius: 4,
    padding: "20px 22px",
  },
  statNum: { fontFamily: "'Source Serif 4', serif", fontSize: 36, fontWeight: 700, color: colors.navy, lineHeight: 1 },
  statLabel: { marginTop: 8, fontSize: 13, opacity: 0.65, fontWeight: 500 },

  sectionHeader: { marginBottom: 30 },
  eyebrow: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: 3, color: colors.maroon, marginBottom: 8 },
  sectionTitle: { fontFamily: "'Source Serif 4', serif", fontSize: 32, fontWeight: 700, margin: 0, color: colors.navy },
  rule: { height: 2, background: colors.navy, width: 64, marginTop: 14 },

  formCard: {
    background: "#fff",
    border: `1px solid ${colors.parchmentDark}`,
    borderRadius: 6,
    padding: 22,
    marginBottom: 30,
  },
  formCardTitle: { fontWeight: 700, marginBottom: 14, fontFamily: "'Source Serif 4', serif", fontSize: 17, color: colors.navy },
  formRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  input: {
    flex: "1 1 200px",
    border: `1px solid ${colors.parchmentDark}`,
    background: colors.parchment,
    borderRadius: 4,
    padding: "10px 12px",
    fontSize: 14,
    fontFamily: "'Inter', sans-serif",
    color: colors.ink,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },

  eventGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 },
  eventCard: { background: "#fff", border: `1px solid ${colors.parchmentDark}`, borderRadius: 6, overflow: "hidden", cursor: "pointer", transition: "transform .15s" },
  eventCover: { position: "relative", height: 150, background: colors.parchmentDark },
  eventCoverImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  eventCoverEmpty: { display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 13, opacity: 0.5, fontStyle: "italic" },
  eventCoverBadge: { position: "absolute", bottom: 8, right: 8, background: "rgba(27,42,69,0.85)", color: colors.parchment, fontSize: 11, padding: "3px 8px", borderRadius: 3, fontFamily: "'JetBrains Mono', monospace" },
  eventCardBody: { padding: "14px 16px" },
  eventCardName: { fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 16.5, color: colors.navy },
  eventCardDate: { fontSize: 12.5, opacity: 0.6, marginTop: 4 },

  backBtn: { background: "none", border: "none", color: colors.maroon, fontWeight: 600, fontSize: 14, cursor: "pointer", padding: 0, marginBottom: 20 },
  eventDesc: { fontSize: 15, lineHeight: 1.6, opacity: 0.8, marginBottom: 20 },
  uploadBar: { marginBottom: 26 },
  photoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 },
  photoTile: { position: "relative", borderRadius: 6, overflow: "hidden", border: `1px solid ${colors.parchmentDark}` },
  photoImg: { width: "100%", height: 180, objectFit: "cover", display: "block", cursor: "pointer" },
  photoDeleteBtn: { position: "absolute", top: 6, right: 6, background: "rgba(140,46,51,0.9)", color: "#fff", border: "none", borderRadius: 4, width: 26, height: 26, cursor: "pointer", fontSize: 13 },

  docGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 },
  docCard: { display: "flex", gap: 14, background: "#fff", border: `1px solid ${colors.parchmentDark}`, borderRadius: 6, padding: 14, alignItems: "flex-start" },
  docThumb: { width: 64, height: 64, objectFit: "cover", borderRadius: 4, cursor: "pointer", flexShrink: 0 },
  docIconWrap: { width: 64, height: 64, background: colors.parchment, border: `1px solid ${colors.parchmentDark}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: colors.navy, cursor: "pointer", flexShrink: 0 },
  docBody: { flex: 1, minWidth: 0 },
  docTitle: { fontWeight: 700, fontSize: 14.5, color: colors.navy, wordBreak: "break-word" },
  docMeta: { fontSize: 12, opacity: 0.6, marginTop: 3 },
  docLink: { fontSize: 13, color: colors.maroon, fontWeight: 600, textDecoration: "none" },

  primaryBtn: { background: colors.maroon, color: "#fff", border: "none", padding: "11px 20px", borderRadius: 4, fontWeight: 600, fontSize: 14, cursor: "pointer" },
  ghostBtn: { background: "transparent", color: colors.navy, border: `1px solid ${colors.parchmentDark}`, padding: "11px 20px", borderRadius: 4, fontWeight: 600, fontSize: 14, cursor: "pointer" },
  ghostBtnLight: { background: "transparent", color: colors.parchment, border: `1px solid rgba(239,232,216,0.4)`, padding: "11px 20px", borderRadius: 4, fontWeight: 600, fontSize: 14, cursor: "pointer" },
  deleteLink: { background: "none", border: "none", color: colors.maroon, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, marginTop: 8 },

  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "60px 0", opacity: 0.6, textAlign: "center" },
  emptySeal: { width: 70, height: 70, color: colors.navy, opacity: 0.3 },

  modalOverlay: { position: "fixed", inset: 0, background: "rgba(16,25,44,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 },
  modalBox: { background: colors.parchment, borderRadius: 8, padding: 30, maxWidth: 360, width: "100%", textAlign: "center", border: `1px solid ${colors.brass}` },
  modalSeal: { width: 60, height: 60, color: colors.navy, margin: "0 auto 14px" },
  modalTitle: { fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 20, color: colors.navy },
  modalText: { fontSize: 13.5, opacity: 0.7, marginTop: 8, marginBottom: 16 },
  errorText: { color: colors.maroon, fontSize: 13, marginTop: 8 },

  lightboxOverlay: { position: "fixed", inset: 0, background: "rgba(16,25,44,0.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 24, cursor: "zoom-out" },
  lightboxImg: { maxWidth: "100%", maxHeight: "100%", borderRadius: 4, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" },

  footer: { borderTop: `1px solid ${colors.parchmentDark}`, padding: "30px 20px", display: "flex", alignItems: "center", gap: 14, maxWidth: 1100, margin: "0 auto", color: colors.navy },
  footerSeal: { width: 40, height: 40, color: colors.navy, opacity: 0.6 },
};
