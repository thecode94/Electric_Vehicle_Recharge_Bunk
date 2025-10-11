// src/components/Spinner.jsx
export default function Spinner({ size = 20 }) {
    const style = {
        width: size,
        height: size,
        border: "2px solid #ddd",
        borderTopColor: "currentColor",
        borderRadius: "50%",
        display: "inline-block",
        animation: "spin 0.8s linear infinite",
        verticalAlign: "middle",
    };
    return <span style={style} aria-label="loading" />;
}
