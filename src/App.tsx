// src/App.tsx
import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { TerrainScene } from "./components/TerrainScene";
import "./App.css";

function App() {
  const [zoom, setZoom] = useState(11);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <div style={{ position: "absolute", top: 12, left: 12, zIndex: 10, background: "#fff", padding: 8, borderRadius: 6 }}>
        <label>
          Zoom:&nbsp;
          <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
            {[10, 11, 12, 13].map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>
      </div>

      <Canvas
        camera={{ position: [0, 4000, 4000], fov: 50, near: 10, far: 50_000 }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[5000, 10_000, 5000]} intensity={1.3} />
        <TerrainScene zoom={zoom} />
        <OrbitControls target={[0, 800, 0]} />
      </Canvas>
    </div>
  );
}

export default App;