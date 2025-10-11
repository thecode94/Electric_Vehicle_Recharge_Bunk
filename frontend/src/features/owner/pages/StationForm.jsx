// src/features/owner/pages/StationForm.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import http from "../../../utils/http";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";

const ACCEPT_TYPES = ["image/jpeg", "image/png", "image/jpg"];
const MAX_SIZE_MB = 5;

export default function StationForm() {
    const navigate = useNavigate();
    const { state } = useLocation();
    const { stationId: stationIdParam } = useParams();

    // Prefer editId from route state, else fallback to :stationId
    const editId = state?.editId || stationIdParam || null;

    const [loading, setLoading] = useState(!!editId);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const onCloseToast = () => setToast((t) => ({ ...t, open: false }));

    const [form, setForm] = useState({
        name: "",
        address: "",
        lat: "",
        lng: "",
        pricePerKwh: "",
        active: true,
        sockets: [{ type: "CCS2", power: 30, count: 1 }],
        amenities: ["Parking"],
        phone: "",
        hours: "",
    });

    // Local image state
    const [files, setFiles] = useState([]); // [{file, src, progress, error}]
    const [uploading, setUploading] = useState(false);

    // Load existing station if editing
    useEffect(() => {
        let ignore = false;
        async function load() {
            if (!editId) return;
            try {
                setLoading(true);
                const res = await http.get(`/stations/${encodeURIComponent(editId)}`);
                if (ignore) return;
                const s = res.data || {};
                setForm({
                    name: s.name || s.title || "",
                    address: s.address || s.formattedAddress || s.location?.address || "",
                    lat: s.lat || s.latitude || s.location?.lat || "",
                    lng: s.lng || s.longitude || s.location?.lng || "",
                    pricePerKwh: s.pricePerKwh ?? s.price ?? s.tariff ?? "",
                    active: s.active ?? true,
                    sockets: normalizeSockets(s.sockets || s.connectors || s.ports || []),
                    amenities: Array.isArray(s.amenities) ? s.amenities : [],
                    phone: s.phone || s.contact || "",
                    hours: s.openHours || s.hours || "",
                });
            } catch (err) {
                setToast({ open: true, type: "error", message: err.message || "Failed to load station" });
            } finally {
                setLoading(false);
            }
        }
        load();
        return () => { ignore = true; };
    }, [editId]); // [attached_file:1]

    const heading = useMemo(() => (editId ? "Edit Station" : "Add Station"), [editId]);

    function onChange(e) {
        const { name, value, type, checked } = e.target;
        setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
    }

    function updateSocket(i, key, value) {
        setForm((f) => {
            const sockets = [...f.sockets];
            sockets[i] = { ...sockets[i], [key]: key === "power" || key === "count" ? num(value) : value };
            return { ...f, sockets };
        });
    }
    function addSocket() {
        setForm((f) => ({ ...f, sockets: [...f.sockets, { type: "", power: 7.4, count: 1 }] }));
    }
    function removeSocket(i) {
        setForm((f) => ({ ...f, sockets: f.sockets.filter((_, idx) => idx !== i) }));
    }

    function onAmenitiesChange(e) {
        const val = e.target.value;
        const list = val.split(",").map((s) => s.trim()).filter(Boolean);
        setForm((f) => ({ ...f, amenities: list }));
    }

    // Image handlers
    function validateAndPreview(file) {
        if (!ACCEPT_TYPES.includes(file.type)) return { ok: false, error: "Only JPG and PNG are allowed." };
        if (file.size > MAX_SIZE_MB * 1024 * 1024) return { ok: false, error: `Max file size ${MAX_SIZE_MB} MB.` };
        const src = URL.createObjectURL(file);
        return { ok: true, src };
    }
    function onPickFiles(e) {
        const list = Array.from(e.target.files || []);
        const next = [];
        list.forEach((f) => {
            const { ok, src, error } = validateAndPreview(f);
            next.push({ file: f, src, progress: 0, error: ok ? null : error });
        });
        setFiles((prev) => [...prev, ...next]);
        e.target.value = "";
    }
    function removeLocalFile(idx) {
        setFiles((prev) => {
            const copy = [...prev];
            const [removed] = copy.splice(idx, 1);
            if (removed?.src) URL.revokeObjectURL(removed.src);
            return copy;
        });
    }

    async function uploadImages(stationId) {
        if (!files.length) return [];
        setUploading(true);
        const uploaded = [];
        for (let i = 0; i < files.length; i++) {
            const item = files[i];
            if (item.error) continue;
            const formData = new FormData();
            formData.append("image", item.file);
            try {
                const res = await http.post(`/stations/${encodeURIComponent(stationId)}/images`, formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                    onUploadProgress: (evt) => {
                        if (!evt.total) return;
                        const pct = Math.round((evt.loaded * 100) / evt.total);
                        setFiles((prev) => {
                            const cp = [...prev];
                            cp[i] = { ...cp[i], progress: pct };
                            return cp;
                        });
                    },
                });
                uploaded.push(res.data?.url);
            } catch (err) {
                setFiles((prev) => {
                    const cp = [...prev];
                    cp[i] = { ...cp[i], error: err.response?.data?.error || err.message || "Upload failed" };
                    return cp;
                });
            }
        }
        setUploading(false);
        return uploaded;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.name.trim()) return showErr("Name is required");
        if (!form.address.trim()) return showErr("Address is required");
        if (!isNum(form.lat) || !isNum(form.lng)) return showErr("Latitude and longitude must be numbers");
        if (form.pricePerKwh === "" || isNaN(Number(form.pricePerKwh))) return showErr("Tariff (price per kWh) must be a number");

        const payload = {
            name: form.name.trim(),
            address: form.address.trim(),
            lat: Number(form.lat),
            lng: Number(form.lng),
            pricePerKwh: Number(form.pricePerKwh),
            active: !!form.active,
            sockets: form.sockets.map((s) => ({
                type: s.type,
                power: Number(s.power),
                count: Number(s.count || 1),
            })),
            amenities: form.amenities,
            phone: form.phone?.trim() || undefined,
            openHours: form.hours?.trim() || undefined,
        };

        try {
            setSaving(true);
            let stationId = editId;

            if (editId) {
                await http.patch(`/stations/${encodeURIComponent(editId)}`, payload);
            } else {
                const res = await http.post("/stations", payload);
                const created = res.data || {};
                stationId = created.id || created._id || created.stationId;
                if (!stationId) setToast({ open: true, type: "warning", message: "Station created but ID not returned; images skipped." });
            }

            if (stationId) {
                const urls = await uploadImages(stationId);
                if (urls.length) setToast({ open: true, type: "success", message: `Uploaded ${urls.length} image(s)` });
            }

            setToast({ open: true, type: "success", message: editId ? "Station updated" : "Station created" });
            setTimeout(() => navigate("/owner/stations"), 500);
        } catch (err) {
            showErr(err.response?.data?.error || err.message || "Save failed");
        } finally {
            setSaving(false);
        }
    }

    function showErr(message) {
        setToast({ open: true, type: "error", message });
    }

    return (
        <div className="page" style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
            <h1>{heading}</h1>

            {loading ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <Spinner /> <span>Loading…</span>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="form" style={{ marginTop: 12 }}>
                    <div className="card" style={{ padding: 16 }}>
                        <label htmlFor="name">Station Name</label>
                        <input id="name" name="name" type="text" value={form.name} onChange={onChange} required />

                        <label htmlFor="address" style={{ marginTop: 12 }}>Address</label>
                        <input id="address" name="address" type="text" value={form.address} onChange={onChange} required />

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                            <div>
                                <label htmlFor="lat">Latitude</label>
                                <input id="lat" name="lat" type="number" step="any" value={form.lat} onChange={onChange} required />
                            </div>
                            <div>
                                <label htmlFor="lng">Longitude</label>
                                <input id="lng" name="lng" type="number" step="any" value={form.lng} onChange={onChange} required />
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                            <div>
                                <label htmlFor="pricePerKwh">Tariff (₹ / kWh)</label>
                                <input id="pricePerKwh" name="pricePerKwh" type="number" step="0.01" value={form.pricePerKwh} onChange={onChange} required />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20 }}>
                                <input id="active" name="active" type="checkbox" checked={form.active} onChange={onChange} />
                                <label htmlFor="active">Active</label>
                            </div>
                        </div>

                        <label style={{ marginTop: 12 }}>Connectors</label>
                        <div className="card" style={{ padding: 12 }}>
                            {form.sockets.map((s, i) => (
                                <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, alignItems: "center", marginBottom: 8 }}>
                                    <input type="text" placeholder="Type (e.g., CCS2, Type2, CHAdeMO)" value={s.type} onChange={(e) => updateSocket(i, "type", e.target.value)} />
                                    <input type="number" step="0.1" placeholder="Power (kW)" value={s.power} onChange={(e) => updateSocket(i, "power", e.target.value)} />
                                    <input type="number" step="1" placeholder="Count" value={s.count || 1} onChange={(e) => updateSocket(i, "count", e.target.value)} />
                                    <button type="button" className="btn-danger" onClick={() => removeSocket(i)}>Remove</button>
                                </div>
                            ))}
                            <button type="button" onClick={addSocket} className="btn-secondary">+ Add connector</button>
                        </div>

                        <label htmlFor="amenities" style={{ marginTop: 12 }}>Amenities (comma‑separated)</label>
                        <input id="amenities" type="text" value={form.amenities.join(", ")} onChange={onAmenitiesChange} placeholder="Parking, Restroom, Café" />

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                            <div>
                                <label htmlFor="phone">Contact Phone (optional)</label>
                                <input id="phone" name="phone" type="tel" value={form.phone} onChange={onChange} />
                            </div>
                            <div>
                                <label htmlFor="hours">Open Hours (optional)</label>
                                <input id="hours" name="hours" type="text" value={form.hours} onChange={onChange} placeholder="e.g., 24x7 or 9am–9pm" />
                            </div>
                        </div>

                        {/* Image uploader */}
                        <div style={{ marginTop: 16 }}>
                            <label>Photos (JPG/PNG, up to {MAX_SIZE_MB} MB each)</label>
                            <input type="file" accept="image/png,image/jpeg" multiple onChange={onPickFiles} style={{ display: "block", marginTop: 8 }} />

                            {!!files.length && (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12, marginTop: 12 }}>
                                    {files.map((item, idx) => (
                                        <div key={idx} className="card" style={{ padding: 8, position: "relative" }}>
                                            {item.src ? (
                                                <img src={item.src} alt="" style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 8 }} />
                                            ) : (
                                                <div style={{ height: 90, display: "grid", placeItems: "center" }} className="muted">No preview</div>
                                            )}
                                            {item.error ? (
                                                <div className="small" style={{ color: "var(--danger)", marginTop: 6 }}>{item.error}</div>
                                            ) : (
                                                item.progress > 0 && <div className="small" style={{ marginTop: 6 }}>Upload: {item.progress}%</div>
                                            )}
                                            <button type="button" className="btn-secondary" onClick={() => removeLocalFile(idx)} disabled={uploading} style={{ position: "absolute", top: 6, right: 6 }}>
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                            <button type="submit" disabled={saving || uploading}>{saving ? <Spinner size={16} /> : (editId ? "Save Changes" : "Create Station")}</button>
                            <button type="button" className="btn-secondary" onClick={() => navigate("/owner/stations")}>Cancel</button>
                        </div>
                    </div>
                </form>
            )}

            {toast.open && <Toast type={toast.type} onClose={onCloseToast}>{toast.message}</Toast>}
        </div>
    );
}

function isNum(v) {
    return v !== "" && !isNaN(Number(v));
}
function num(v) {
    const n = Number(v);
    return isNaN(n) ? "" : n;
}
function normalizeSockets(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return [{ type: "CCS2", power: 30, count: 1 }];
    return arr.map((x) =>
        typeof x === "string"
            ? { type: x, power: 7.4, count: 1 }
            : { type: x.type || "", power: x.power ?? 7.4, count: x.count ?? 1 }
    );
}
