import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Terrain } from "./components/Terrain";
import * as THREE from "three";
import "./App.css";

const SKY_COLOR = "#b8d4e8";

function App() {
  const [stride, setStride] = useState(8);   // start conservative

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <div style={{
        position: "absolute", top: 12, left: 12, zIndex: 10,
        background: "#fff", padding: 8, borderRadius: 6,
        fontFamily: "monospace", fontSize: 13,
      }}>
        Stride:&nbsp;
        <select value={stride} onChange={(e) => setStride(Number(e.target.value))}>
          <option value={16}>16 (fastest, coarse)</option>
          <option value={8}>8  (fast)</option>
          <option value={4}>4  (balanced)</option>
          <option value={2}>2  (detailed, may lag)</option>
          <option value={1}>1  (full 30 m — heavy)</option>
        </select>
      </div>

      <Canvas
        camera={{ position: [0, 20_000, 25_000], fov: 45, near: 10, far: 120_000 }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color(SKY_COLOR);
          scene.fog = new THREE.Fog(SKY_COLOR, 30_000, 90_000);
        }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[20_000, 30_000, 20_000]} intensity={1.2} />
        <Terrain stride={stride} />
        <OrbitControls
          target={[0, 800, 0]}
          maxPolarAngle={Math.PI / 2.15}
          minDistance={500}
          maxDistance={80_000}
        />
      </Canvas>
    </div>
  );
}

export default App;