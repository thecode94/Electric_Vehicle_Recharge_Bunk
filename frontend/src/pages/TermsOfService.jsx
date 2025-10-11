// src/pages/TermsOfService.jsx
export default function TermsOfService() {
    return (
        <div className="page" style={{ padding: 24 }}>
            <h1>Terms of Service</h1>
            <p>These terms govern the use of the EV Recharge application.</p>
            <ul style={{ lineHeight: 1.7 }}>
                <li>Use of services is subject to local laws and station policies.</li>
                <li>Bookings may be canceled per station-specific rules.</li>
                <li>Payments are processed by integrated payment gateways.</li>
            </ul>
        </div>
    );
}
