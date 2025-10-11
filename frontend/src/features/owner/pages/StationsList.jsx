import { Link } from "react-router-dom";

export default function StationsList({ stations }) {
    if (!stations || stations.length === 0) {
        return <p>No stations available.</p>;
    }

    return (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {stations.map((station, idx) => {
                const id = station.id || station._id || `station_${idx}`;
                const name = station.name || "Station";
                const address = station.address || "";
                const status = station.status || (station.active ? "active" : "inactive");

                return (
                    <li
                        key={id}
                        style={{
                            padding: "12px 0",
                            borderTop: idx === 0 ? "none" : "1px solid rgba(0,0,0,0.08)",
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            gap: 12,
                            alignItems: "center",
                        }}
                    >
                        <div>
                            <div style={{ fontWeight: 600 }}>{name}</div>
                            {address && <div className="muted small">{address}</div>}
                            <div className="muted small">Status: {status}</div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <Link to={`/stations/${encodeURIComponent(id)}`} className="btn-secondary">View</Link>
                            <Link to={`/owner/stations/new`} state={{ editId: id }} className="btn-secondary">Edit</Link>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
