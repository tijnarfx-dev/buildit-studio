// src/editions/community/Community.tsx
import { useState, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { invoke } from "@tauri-apps/api/core";
import * as THREE from "three";
import { Terrain } from "../../core/Terrain";
import { useDem } from "../../core/DemContext";
import { sampleElevation, snapToGrid, worldToLonLat } from "../../core/dem";
import { BUILDINGS, findBuilding } from "./buildings";
import { Ghost } from "./Ghost";   // <-- NEW import
import { PlacedBuildings } from "./PlacedBuildings";

const SKY_COLOR = "#b8d4e8";
const GRID_SIZE = 30;   // meters — 30 m matches DEM resolution

export interface PlacedBuilding {
  id: string;
  typeId: string;
  worldX: number;
  worldZ: number;
  elevation: number;
  lon: number;
  lat: number;
  rotationY: number;
}

export function Community() {
  const { dem } = useDem();
  const [stride, setStride] = useState(8);
  const [selected, setSelected] = useState<string | null>(null);
  const [placed, setPlaced] = useState<PlacedBuilding[]>([]);
  const [cash, setCash] = useState(10_000);
  const [status, setStatus] = useState<string>("");

  // ghost position ref replaces old ghost state
  const ghostPos = useRef<{ x: number; y: number; z: number; active: boolean }>({
    x: 0, y: 0, z: 0, active: false,
  });

  const downPos = useRef<{ x: number; y: number } | null>(null);
  const DRAG_THRESHOLD_PX = 5;
  const [previewRotation, setPreviewRotation] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") {
        setPreviewRotation((r) => r + Math.PI / 2);
      }
      if (e.key === "Escape") {
        setSelected(null);
        ghostPos.current.active = false;
        setPreviewRotation(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { setPreviewRotation(0); }, [selected]);

  // ---- Terrain events ----
  const handlePointerDown = (e: React.PointerEvent) => {
    downPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!downPos.current) return;
    const dx = e.clientX - downPos.current.x;
    const dy = e.clientY - downPos.current.y;
    const wasDrag = Math.hypot(dx, dy) > DRAG_THRESHOLD_PX;
    downPos.current = null;
    if (wasDrag) ghostPos.current.active = false; // deactivate ghost if drag
  };

  const handlePointerMove = (world: THREE.Vector3) => {
    if (!dem || !selected) { ghostPos.current.active = false; return; }
    const x = snapToGrid(world.x, GRID_SIZE);
    const z = snapToGrid(world.z, GRID_SIZE);
    const y = sampleElevation(dem, x, z);
    ghostPos.current.x = x;
    ghostPos.current.y = y;
    ghostPos.current.z = z;
    ghostPos.current.active = true;
  };

  const handlePointerOut = () => { ghostPos.current.active = false; };

  const handleClick = (world: THREE.Vector3) => {
    if (!dem || !selected) return;
    const def = findBuilding(selected);
    if (!def) return;
    if (cash < def.cost) { setStatus(`Not enough cash for ${def.name}`); return; }

    const x = snapToGrid(world.x, GRID_SIZE);
    const z = snapToGrid(world.z, GRID_SIZE);
    const y = sampleElevation(dem, x, z);
    const { lon, lat } = worldToLonLat(dem.bounds, x, z);

    setPlaced((p) => [
      ...p,
      { id: crypto.randomUUID(), typeId: def.id, worldX: x, worldZ: z, elevation: y, lon, lat, rotationY: previewRotation },
    ]);
    setCash((c) => c - def.cost);
    setStatus(`Placed ${def.name} at (${x.toFixed(0)}, ${z.toFixed(0)})`);
  };

  const handleRightClick = (world: THREE.Vector3) => {
    const RADIUS = 30;
    let nearestIdx = -1;
    let nearestDist = RADIUS * RADIUS;
    for (let i = 0; i < placed.length; i++) {
      const b = placed[i];
      const dx = b.worldX - world.x;
      const dz = b.worldZ - world.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < nearestDist) { nearestDist = d2; nearestIdx = i; }
    }
    if (nearestIdx < 0) { setStatus("No building nearby to delete."); return; }
    const removed = placed[nearestIdx];
    const def = findBuilding(removed.typeId);
    setPlaced((p) => p.filter((_, i) => i !== nearestIdx));
    if (def) setCash((c) => c + Math.round(def.cost * 0.5));
    setStatus(`Removed ${def?.name ?? "building"} (+$${Math.round((def?.cost ?? 0) * 0.5)})`);
  };

  // ---- Persistence ----
  const saveCity = async () => {
    const payload = JSON.stringify({ version: 1, cash, buildings: placed });
    try {
      await invoke("save_city", { json: payload });
      setStatus(`Saved ${placed.length} buildings.`);
    } catch (e) {
      setStatus(`Save failed: ${e}`);
    }
  };

  const loadCity = async () => {
    try {
      const raw = await invoke<string | null>("load_city");
      if (!raw) { setStatus("No saved city found."); return; }
      const data = JSON.parse(raw);
      setPlaced(data.buildings ?? []);
      setCash(data.cash ?? 10_000);
      setStatus(`Loaded ${data.buildings?.length ?? 0} buildings.`);
    } catch (e) {
      setStatus(`Load failed: ${e}`);
    }
  };

  const clearCity = () => {
    if (!confirm("Clear all buildings?")) return;
    setPlaced([]);
    setStatus("City cleared.");
  };

  return (
    <div
      style={{ width: "100vw", height: "100vh", position: "relative" }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* ---- HUD ---- */}
      <div style={hudStyle}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Community Edition</div>
        <div style={{ marginBottom: 8, fontSize: 12 }}>
          Cash: <b>${cash.toLocaleString()}</b> · Buildings: <b>{placed.length}</b>
        </div>

        <div style={{ marginBottom: 8, fontSize: 12 }}>Build:</div>
        {BUILDINGS.map((b) => (
          <button
            key={b.id}
            onClick={() => setSelected(selected === b.id ? null : b.id)}
            style={{
              display: "block", width: "100%", textAlign: "left",
              marginBottom: 4, padding: "4px 8px",
              background: selected === b.id ? b.color : "#f3f3f3",
              color: selected === b.id ? "#fff" : "#111",
              border: "1px solid #ccc", borderRadius: 4,
            }}
          >
            {b.name} — ${b.cost}
          </button>
        ))}

        <hr style={{ margin: "10px 0" }} />

        <button onClick={saveCity} style={btnStyle}>Save</button>
        <button onClick={loadCity} style={btnStyle}>Load</button>
        <button onClick={clearCity} style={btnStyle}>Clear</button>

        <hr style={{ margin: "10px 0" }} />

        <div style={{ fontSize: 11, color: "#555" }}>
          Stride:&nbsp;
          <select value={stride} onChange={(e) => setStride(Number(e.target.value))}>
            <option value={16}>16</option>
            <option value={8}>8</option>
            <option value={4}>4</option>
            <option value={2}>2</option>
          </select>
        </div>

        {status && (
          <div style={{ marginTop: 8, fontSize: 11, color: "#333" }}>{status}</div>
        )}
      </div>

      {/* ---- 3D scene ---- */}
      <Canvas
        camera={{ position: [0, 8000, 8000], fov: 45, near: 10, far: 120_000 }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color(SKY_COLOR);
          scene.fog = new THREE.Fog(SKY_COLOR, 30_000, 90_000);
        }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[20_000, 30_000, 20_000]} intensity={1.2} />
        <Terrain
          stride={stride}
          onPointerMove={handlePointerMove}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
          onRightClick={handleRightClick}
        />

        {/* Placed buildings */}
        {placed.map((p) => {
          const def = findBuilding(p.typeId);
          if (!def) return null;
          return (
            <mesh key={p.id} position={[p.worldX, p.elevation + def.sizeY / 2, p.worldZ]} rotation={[0, p.rotationY, 0]}>
              <boxGeometry args={[def.sizeX, def.sizeY, def.sizeZ]} />
              <meshStandardMaterial color={def.color} />
            </mesh>
          );
        })}

        {/* Placed buildings */}
        <PlacedBuildings placed={placed} />

        {/* Ghost preview via Ghost component */}
        <Ghost posRef={ghostPos} typeId={selected} rotationY={previewRotation} />

        <OrbitControls
          target={[0, 800, 0]}
          maxPolarAngle={Math.PI / 2.15}
          minDistance={100}
          maxDistance={80_000}
        />
      </Canvas>
    </div>
  );
}

// ---- inline styles ----
const hudStyle: React.CSSProperties = {
  position: "absolute", top: 12, left: 12, zIndex: 10,
  background: "#fff", padding: 12, borderRadius: 6,
  fontFamily: "system-ui, sans-serif", fontSize: 13,
  width: 180, boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
};

const btnStyle: React.CSSProperties = {
  display: "block", width: "100%", marginBottom: 4,
  padding: "4px 8px", fontSize: 12, cursor: "pointer",
};