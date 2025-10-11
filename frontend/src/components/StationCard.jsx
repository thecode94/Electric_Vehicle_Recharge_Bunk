// src/components/StationCard.jsx
import { Link } from "react-router-dom";

/**
 * Enhanced reusable station tile for lists and previews.
 * Accepts flexible field names; falls back sensibly.
 *
 * Props:
 * - station: object with flexible fields for EV station data
 * - to: optional custom link (defaults to `/stations/:id`)
 * - actions: optional React node to render action buttons (e.g., Book)
 * - compact: boolean to reduce padding and details
 * - showDetails: boolean to show/hide extended details (default: true)
 */
export default function StationCard({
    station = {},
    to,
    actions,
    compact = false,
    showDetails = true
}) {
    // Flexible field mapping
    const id = station.id || station._id || station.stationId || "";
    const name = station.name || station.title || station.stationName || "EV Station";
    const address = station.address || station.formattedAddress || station.location?.address || station.vicinity || "";
    const lat = station.lat || station.latitude || station.location?.lat;
    const lng = station.lng || station.longitude || station.location?.lng;
    const price = station.pricePerKwh ?? station.price ?? station.tariff;
    const rating = station.rating;
    const status = station.status || station.active;
    const ownerId = station.ownerId || station.owner || station.operatorId;

    // Additional details
    const description = station.description || station.notes;
    const phone = station.phone || station.phoneNumber || station.contact?.phone;
    const email = station.email || station.contact?.email;
    const website = station.website || station.url;
    const openingHours = station.openingHours || station.hours || station.availability;
    const amenities = station.amenities || station.facilities || [];
    const lastUpdated = station.lastUpdated || station.updatedAt || station.modifiedDate;
    const createdAt = station.createdAt || station.dateAdded;

    // Power and connector details
    const sockets = Array.isArray(station.sockets || station.connectors || station.ports)
        ? (station.sockets || station.connectors || station.ports)
        : [];
    const maxPower = station.maxPower || station.power ||
        Math.max(...sockets.map(s => s.power || 0).filter(Boolean)) || null;
    const totalSockets = sockets.reduce((sum, socket) => sum + (socket.count || 1), 0) || sockets.length;

    // Distance calculation if available
    const distance = station.distance || station.distanceKm;

    const link = to || (id ? `/stations/${encodeURIComponent(id)}` : undefined);

    // Status determination
    const getStatusInfo = () => {
        if (status === "active" || status === true) return { text: "Active", variant: "success" };
        if (status === "inactive" || status === false) return { text: "Inactive", variant: "warn" };
        if (status === "maintenance") return { text: "Maintenance", variant: "warn" };
        if (status === "coming-soon") return { text: "Coming Soon", variant: "info" };
        return { text: status || "Unknown", variant: "neutral" };
    };

    const statusInfo = getStatusInfo();

    return (
        <div
            className="card station-card"
            style={{
                padding: compact ? 12 : 20,
                display: "flex",
                flexDirection: "column",
                gap: compact ? 8 : 12,
                position: "relative",
                border: statusInfo.variant === "success" ? "2px solid #28a745" : undefined,
                borderLeft: statusInfo.variant === "success" ? "4px solid #28a745" :
                    statusInfo.variant === "warn" ? "4px solid #ffc107" : "4px solid #6c757d"
            }}
        >
            {/* Header Section */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <div style={{ fontWeight: 700, fontSize: compact ? 14 : 16 }}>{name}</div>
                        <StatusBadge variant={statusInfo.variant}>{statusInfo.text}</StatusBadge>
                        {typeof rating === "number" && (
                            <span className="muted small">★ {rating.toFixed(1)}</span>
                        )}
                    </div>

                    {address && (
                        <div className="muted small" style={{ marginBottom: 6 }}>
                            📍 {address}
                        </div>
                    )}

                    {distance && (
                        <div className="muted small" style={{ marginBottom: 6 }}>
                            📏 {typeof distance === 'number' ? `${distance.toFixed(1)} km away` : distance}
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    {actions}
                    {link && (
                        <Link to={link} className="btn-secondary">
                            {compact ? "View" : "View Details"}
                        </Link>
                    )}
                </div>
            </div>

            {/* Details Section */}
            {showDetails && !compact && (
                <div>
                    {/* Power & Pricing Info */}
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {price != null && (
                            <InfoBadge icon="💰">₹{price}/kWh</InfoBadge>
                        )}
                        {maxPower && (
                            <InfoBadge icon="⚡">{maxPower}kW Max</InfoBadge>
                        )}
                        {totalSockets > 0 && (
                            <InfoBadge icon="🔌">{totalSockets} Socket{totalSockets > 1 ? 's' : ''}</InfoBadge>
                        )}
                        {openingHours && (
                            <InfoBadge icon="🕒">{formatHours(openingHours)}</InfoBadge>
                        )}
                    </div>

                    {/* Connector Details */}
                    {sockets.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                            <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>Available Connectors:</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {formatConnectorsDetailed(sockets).map((connector, i) => (
                                    <ConnectorBadge key={i}>{connector}</ConnectorBadge>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Amenities */}
                    {amenities.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                            <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>Amenities:</div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {amenities.map((amenity, i) => (
                                    <AmenityBadge key={i}>{formatAmenity(amenity)}</AmenityBadge>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Contact Info */}
                    {(phone || email || website) && (
                        <div style={{ marginTop: 8 }}>
                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12 }}>
                                {phone && (
                                    <a href={`tel:${phone}`} style={{ color: "#007bff", textDecoration: "none" }}>
                                        📞 {phone}
                                    </a>
                                )}
                                {email && (
                                    <a href={`mailto:${email}`} style={{ color: "#007bff", textDecoration: "none" }}>
                                        ✉️ {email}
                                    </a>
                                )}
                                {website && (
                                    <a href={website} target="_blank" rel="noreferrer" style={{ color: "#007bff", textDecoration: "none" }}>
                                        🌐 Website
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    {description && (
                        <div style={{ marginTop: 8, fontSize: 12, color: "#666", lineHeight: 1.4 }}>
                            {description}
                        </div>
                    )}
                </div>
            )}

            {/* Quick Info Row for Compact Mode */}
            {compact && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {price != null && <Badge>₹{price}/kWh</Badge>}
                    {totalSockets > 0 && <Badge>{totalSockets} sockets</Badge>}
                    {maxPower && <Badge>{maxPower}kW</Badge>}
                </div>
            )}

            {/* Footer with Location & Meta Info */}
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 8,
                paddingTop: 8,
                borderTop: "1px solid #eee",
                fontSize: 11,
                color: "#666"
            }}>
                <div>
                    {(lat && lng) && (
                        <span>
                            📍 {lat.toFixed ? lat.toFixed(4) : lat}, {lng.toFixed ? lng.toFixed(4) : lng}
                            {" • "}
                            <a
                                href={`https://www.google.com/maps?q=${lat},${lng}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: "#007bff", textDecoration: "none" }}
                            >
                                Open in Maps
                            </a>
                        </span>
                    )}
                </div>
                <div>
                    {ownerId && <span>ID: {String(ownerId).slice(-8)}</span>}
                    {lastUpdated && (
                        <span style={{ marginLeft: 8 }}>
                            Updated: {formatDate(lastUpdated)}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

// Enhanced Badge Components
function StatusBadge({ children, variant }) {
    const styles = {
        success: { bg: "#d4edda", color: "#155724", border: "1px solid #c3e6cb" },
        warn: { bg: "#fff3cd", color: "#856404", border: "1px solid #ffeaa7" },
        info: { bg: "#d1ecf1", color: "#0c5460", border: "1px solid #b6d4d9" },
        neutral: { bg: "#f8f9fa", color: "#495057", border: "1px solid #dee2e6" }
    };
    const style = styles[variant] || styles.neutral;

    return (
        <span
            className="small"
            style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: 12,
                background: style.bg,
                color: style.color,
                border: style.border,
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase"
            }}
        >
            {children}
        </span>
    );
}

function InfoBadge({ children, icon }) {
    return (
        <span
            className="small"
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                borderRadius: 16,
                background: "rgba(0,123,255,0.1)",
                color: "#0056b3",
                fontSize: 11,
                fontWeight: 500,
                border: "1px solid rgba(0,123,255,0.2)"
            }}
        >
            {icon && <span>{icon}</span>}
            {children}
        </span>
    );
}

function ConnectorBadge({ children }) {
    return (
        <span
            className="small"
            style={{
                display: "inline-block",
                padding: "3px 8px",
                borderRadius: 8,
                background: "rgba(40,167,69,0.1)",
                color: "#1e7e34",
                fontSize: 10,
                fontWeight: 500,
                border: "1px solid rgba(40,167,69,0.2)"
            }}
        >
            🔌 {children}
        </span>
    );
}

function AmenityBadge({ children }) {
    return (
        <span
            className="small"
            style={{
                display: "inline-block",
                padding: "2px 6px",
                borderRadius: 6,
                background: "rgba(108,117,125,0.1)",
                color: "#495057",
                fontSize: 10,
                border: "1px solid rgba(108,117,125,0.2)"
            }}
        >
            {children}
        </span>
    );
}

function Badge({ children, variant }) {
    const bg = variant === "warn" ? "rgba(255, 193, 7, 0.18)" : "rgba(0,0,0,0.06)";
    const color = variant === "warn" ? "#7a5c00" : "inherit";
    return (
        <span
            className="small"
            style={{
                display: "inline-block",
                padding: "4px 8px",
                borderRadius: 999,
                background: bg,
                color,
                fontSize: 11
            }}
        >
            {children}
        </span>
    );
}

// Helper Functions
function formatConnectorsDetailed(arr) {
    return arr.map((c) => {
        if (typeof c === "string") return c;
        const type = c?.type || c?.name || "Standard";
        const power = c?.power ? `${c.power}kW` : "";
        const count = c?.count ? `×${c.count}` : "";
        return [type, power, count].filter(Boolean).join(" ");
    });
}

function formatAmenity(amenity) {
    if (typeof amenity === "string") return amenity;
    const icons = {
        parking: "🅿️ Parking",
        restroom: "🚻 Restroom",
        wifi: "📶 WiFi",
        food: "🍽️ Food",
        shopping: "🛒 Shopping",
        atm: "💳 ATM",
        covered: "🏠 Covered"
    };
    return icons[amenity.toLowerCase()] || amenity;
}

function formatHours(hours) {
    if (typeof hours === "string") return hours;
    if (hours === true) return "24/7";
    if (hours === false) return "Closed";
    return "Check hours";
}

function formatDate(date) {
    if (!date) return "";
    try {
        const d = new Date(date);
        return d.toLocaleDateString();
    } catch {
        return String(date).slice(0, 10);
    }
}
