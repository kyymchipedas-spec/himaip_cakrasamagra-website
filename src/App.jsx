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
        <video autoPlay loop muted playsInline style={styles.heroVideo}>
          <source src="/video-hima-ip.mp4" type="video/mp4" />
        </video>
        <div style={styles.heroOverlay} />
        <div style={styles.heroSealWrap}>{SEAL}</div>
        <div style={styles.heroEyebrow}>ARSIP RESMI ORGANISASI</div>
        <h1 style={styles.heroTitle}>Dokumentasi Kegiatan &amp;<br />Pertanggungjawaban HIMA IP</h1>
        <p style={styles.heroText}>
          Setiap kegiatan dicatat, setiap berkas diarsipkan. Ruang ini menyimpan jejak kerja
          Himpunan Mahasiswa Ilmu Pemerintahan — dari forum diskusi hingga malam keakraban,
          dari proposal hingga laporan akhir masa jabatan.
        </p>
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

function Doc
