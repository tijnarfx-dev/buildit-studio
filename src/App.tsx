// src/App.tsx
import * as THREE from "three";
import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { TerrainScene } from "./components/TerrainScene";
import "./App.css";


function App() {
  const [zoom, setZoom] = useState(11);

  const SKY_COLOR = "#b8d4e8";       // pale blue
  const FOG_NEAR = 15_000;            // start fading at 8 km
  const FOG_FAR = 60_000;            // fully fogged at 20 km (= cull radius)

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
      
      {/* <Canvas
        camera={{ position: [0, 2_500, 4_500], fov: 45, near: 10, far: 60_000 }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color(SKY_COLOR);
          // scene.fog = new THREE.Fog(SKY_COLOR, FOG_NEAR, FOG_FAR);
        }}
      >
        <ambientLight intensity={0.65} />
        <directionalLight position={[8_000, 15_000, 8_000]} intensity={1.15} />
        <TerrainScene zoom={zoom} />
        <OrbitControls
          target={[44_000, 800, -35_000]}   // Imphal city, world coords
          maxPolarAngle={Math.PI / 2.15}   // don't let camera go below horizon
          minDistance={200}
          maxDistance={55_000}
        />
      </Canvas> */}
      <Canvas
        camera={{ position: [0, 15_000, 1], fov: 45, near: 10, far: 120_000 }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color(SKY_COLOR);
          scene.fog = new THREE.Fog(SKY_COLOR, FOG_NEAR, FOG_FAR);
        }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[5_000, 20_000, 5_000]} intensity={1.1} />
        <TerrainScene zoom={zoom} />
        <OrbitControls
          target={[0, 800, 0]}
          // allow straight-down view — remove maxPolarAngle temporarily
          minDistance={100}
          maxDistance={30_000}
        />
      </Canvas>
    </div>
  );
}

export default App;