// src/utils/useDebounce.js

import { useState, useEffect } from "react";

/**
 * Debounce a changing value (e.g. search input).
 *
 * @param {any} value - The value to debounce.
 * @param {number} delay - Delay in milliseconds (default: 500ms).
 * @returns {any} debounced value
 *
 * Example:
 * const [query, setQuery] = useState("");
 * const debouncedQuery = useDebounce(query, 400);
 * useEffect(() => { fetchResults(debouncedQuery); }, [debouncedQuery]);
 */
export default function useDebounce(value, delay = 500) {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debounced;
}
