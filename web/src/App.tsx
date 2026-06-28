import { NavLink, Route, Routes } from "react-router-dom";
import Submit from "./pages/Submit.tsx";
import Dashboard from "./pages/Dashboard.tsx";

function Nav() {
  const base = "px-4 py-2 rounded-lg text-sm font-medium transition-colors";
  const active = "bg-white text-brand-dark shadow-sm";
  const idle = "text-white/90 hover:bg-white/10";
  return (
    <header className="bg-brand-dark">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2 mr-auto">
          <div className="h-8 w-8 rounded-lg bg-white/15 grid place-items-center text-white font-bold">HSE</div>
          <div className="text-white">
            <div className="font-semibold leading-tight">HSE Report Review</div>
            <div className="text-[11px] text-white/70 leading-tight">Al-Essa · Aramco compliance pilot</div>
          </div>
        </div>
        <nav className="flex gap-1 bg-black/10 p-1 rounded-xl">
          <NavLink to="/" end className={({ isActive }) => `${base} ${isActive ? active : idle}`}>
            Submit Report
          </NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => `${base} ${isActive ? active : idle}`}>
            Manager Dashboard
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Submit />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>
      <footer className="max-w-6xl mx-auto px-4 py-6 text-xs text-slate-400">
        Pilot MVP · findings cited to Saudi Aramco General Instructions (GI), CSM &amp; CSSP.
      </footer>
    </div>
  );
}
