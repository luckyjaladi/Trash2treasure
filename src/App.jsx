import { useEffect, useRef, useState } from "react";

const maps = (q) => `https://www.google.com/maps/search/${encodeURIComponent(q)}+near+me`;

function shrink(file, max = 768) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = img.width * s; c.height = img.height * s;
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.8));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

export default function App() {
  const [stats, setStats] = useState(() => {
    try { return JSON.parse(localStorage.getItem("t2t")) || { scan: 0, reuse: 0, rec: 0 }; }
    catch { return { scan: 0, reuse: 0, rec: 0 }; }
  });
  const [img, setImg] = useState(null);
  const [text, setText] = useState("");
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [logged, setLogged] = useState(false);
  const fileRef = useRef();

  useEffect(() => { try { localStorage.setItem("t2t", JSON.stringify(stats)); } catch {} }, [stats]);
  const bump = (k) => setStats((s) => ({ ...s, [k]: s[k] + 1 }));

  async function analyze(image = img, t = text) {
    if (!image && !t.trim()) return setErr("Upload a photo or type an item first.");
    setBusy(true); setErr(""); setData(null); setLogged(false);
    try {
      const r = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, text: t.trim() }),
      });
      if (!r.ok) throw new Error();
      setData(await r.json()); bump("scan");
    } catch { setErr("Couldn't analyze that. Try again."); }
    setBusy(false);
  }

  async function onFile(e) {
    const f = e.target.files[0]; if (!f) return;
    const d = await shrink(f); setImg(d); analyze(d, text);
  }

  return (
    <main>
      <h1>Trash<span>2</span>Treasure</h1>
      <p className="sub">Before you throw it away, let AI show you what it can become.</p>

      <div className="stats">
        {[["scan", "ITEMS SCANNED"], ["reuse", "REUSE ACTIONS"], ["rec", "RECYCLE REFERRALS"]].map(([k, l]) => (
          <div className="stat" key={k}><b>{stats[k]}</b><small>{l}</small></div>
        ))}
      </div>

      <div className="drop" onClick={() => fileRef.current.click()}>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        {img ? <img src={img} alt="uploaded item" /> : <>📷 <b>Upload a photo</b></>}
      </div>
      <div className="row">
        <input type="text" value={text} placeholder="…or type an item (e.g. old jeans)"
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && analyze()} />
        <button onClick={() => analyze()} disabled={busy}>{busy ? "…" : "Analyze"}</button>
      </div>

      <div className="res">
        {busy && <p className="msg">Identifying…</p>}
        {err && <p className="msg">{err}</p>}
        {data && (
          <>
            <div className="item">
              <span className="tag">AI IDENTIFIED</span>
              <h2>{data.item}</h2><div style={{ color: "var(--mute)" }}>{data.material}</div>
            </div>
            <div className="paths">
              <div className="path"><h3>♻ Upcycle</h3><p>{data.reuse}</p>
                <button className="ghost" disabled={logged} onClick={() => { bump("reuse"); setLogged(true); }}>
                  {logged ? "✓ Logged" : "I'll do this"}</button></div>
              <div className="path"><h3>🔄 Recycle</h3><p>{data.recycle}</p>
                <a href={maps(data.search?.recycle || `${data.material} recycling`)} target="_blank" rel="noopener"
                  onClick={() => bump("rec")}>Find nearby</a></div>
              <div className="path"><h3>₹ Resell</h3><p>{data.sell}</p>
                <a href={maps("second hand store")} target="_blank" rel="noopener">Find buyers</a></div>
              <div className="path"><h3>♥ Donate</h3><p>{data.donate}</p>
                <a href={maps(data.search?.donate || "donation centre NGO")} target="_blank" rel="noopener">Find NGOs</a></div>
            </div>
          </>
        )}
      </div>
      <p className="foot">TechTitans • Trash2Treasure</p>
    </main>
  );
}
