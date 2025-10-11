import React from "react";

export default function SafeElement({ Component, props = {} }) {
    try {
        // Render the element synchronously
        const node = <Component {...props} />;
        // If someone accidentally made Component async and it returned a Promise,
        // React will try to render a Promise. Convert that to a fallback element.
        if (node && typeof node.then === "function") {
            // It’s a Promise-like — render nothing or a lightweight fallback
            return null; // or return <div />;
        }
        return node;
    } catch (e) {
        // As a last resort, avoid breaking the whole tree
        console.error("SafeElement render error:", e);
        return null;
    }
}
