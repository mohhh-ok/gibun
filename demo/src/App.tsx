import { useEffect, useState } from "react";
import "./App.css";
import { ChimeraPage } from "./chimera/ChimeraPage";
import { PresetPage } from "./preset/PresetPage";

function App() {
  const [hash, setHash] = useState(location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const isChimera = hash === "#/chimera";

  return (
    <div className="app-shell">
      <nav className="tab-bar">
        <button
          className={`tab-bar-item ${!isChimera ? "active" : ""}`}
          onClick={() => (location.hash = "#/")}
        >
          プリセット生成
        </button>
        <button
          className={`tab-bar-item ${isChimera ? "active" : ""}`}
          onClick={() => (location.hash = "#/chimera")}
        >
          キメラ 🧬
        </button>
      </nav>
      {isChimera ? <ChimeraPage /> : <PresetPage />}
    </div>
  );
}

export default App;
