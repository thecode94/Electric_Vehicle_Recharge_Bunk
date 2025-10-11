// Keep ONE default
export default function PrivacyPolicy() {
    return (
        <div className="page" style={{ padding: 24 }}>
            <h1>Privacy Policy</h1>
            <p>This page describes how data is handled.</p>
        </div>
    );
}

// Change the rest to named exports (remove "default")
export function TermsOfService() {
    return (
        <div className="page" style={{ padding: 24 }}>
            <h1>Terms of Service</h1>
            <p>These are the terms of service.</p>
        </div>
    );
}

export function Help() {
    return (
        <div className="page" style={{ padding: 24 }}>
            <h1>Help</h1>
            <p>Find FAQs and support information here.</p>
        </div>
    );
}

export function About() {
    return (
        <div className="page" style={{ padding: 24 }}>
            <h1>About</h1>
            <p>EV Recharge helps locate and book charging stations.</p>
        </div>
    );
}

export function NotFound() {
    return (
        <div className="page" style={{ padding: 24 }}>
            <h1>404</h1>
            <p>Page not found.</p>
        </div>
    );
}

export function Home() {
    return (
        <div className="page" style={{ padding: 24 }}>
            <h1>Welcome</h1>
            <p>Search for stations and start booking.</p>
        </div>
    );
}