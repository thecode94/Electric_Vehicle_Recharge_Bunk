import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider"; // or your actual path
import AppRoutes from "./routes/AppRoutes"; // this renders all pages

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes /> {/* this handles all your routes */}
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>
);
