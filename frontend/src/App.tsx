import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./components/Home";
import { Admin } from "./components/Admin";
import type { GamePhase } from "./game/types";
import { INITIAL_PHASE } from "./game";

function App() {
  useState<GamePhase>(INITIAL_PHASE);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
