import { useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  type MeshStandardMaterialParameters,
  SphereGeometry,
} from "three";

export type CityPalette = {
  oceanSurface: string;
  oceanDepth: string;
  sand: string;
  grass: string;
  concrete: string;
  asphalt: string;
  buildingWhite: string;
  buildingPeach: string;
  buildingCoral: string;
  buildingTeal: string;
  glass: string;
  woodDeck: string;
  roofTile: string;
  palmTrunk: string;
  palmFrond: string;
  warmLight: string;
  neonCyan: string;
  neonMagenta: string;
  goldAccent: string;
};

export const DEFAULT_CITY_PALETTE: CityPalette = {
  oceanSurface: "#1a8ca8",
  oceanDepth: "#0f4c64",
  sand: "#ecd6be",
  grass: "#7ea368",
  concrete: "#b0b4b8",
  asphalt: "#24272c",
  buildingWhite: "#f5f0eb",
  buildingPeach: "#e89882",
  buildingCoral: "#dc6866",
  buildingTeal: "#387a80",
  glass: "#88c4d8",
  woodDeck: "#a87550",
  roofTile: "#c2543e",
  palmTrunk: "#5e4334",
  palmFrond: "#4d783e",
  warmLight: "#ffdd80",
  neonCyan: "#5ce6e6",
  neonMagenta: "#f06292",
  goldAccent: "#f4b942",
};

export interface BuildingPlot {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  floors: number;
  color: string;
  roofType: "flat" | "terrace" | "peaked";
  hasPool?: boolean;
}

export const CITY_BUILDINGS: BuildingPlot[] = [
  // West Luxury District
  { x: -32, z: -20, w: 14, d: 12, h: 22, floors: 6, color: "#f5f0eb", roofType: "terrace", hasPool: true },
  { x: -32, z: 4, w: 12, d: 12, h: 16, floors: 4, color: "#e89882", roofType: "flat" },
  { x: -32, z: 24, w: 14, d: 10, h: 12, floors: 3, color: "#f5f0eb", roofType: "peaked" },

  // Downtown Core (North)
  { x: -10, z: -30, w: 12, d: 12, h: 32, floors: 9, color: "#387a80", roofType: "flat" },
  { x: 10, z: -30, w: 14, d: 12, h: 38, floors: 11, color: "#f5f0eb", roofType: "terrace", hasPool: true },

  // East Promenade & Boutique Resorts
  { x: 32, z: -20, w: 12, d: 12, h: 18, floors: 5, color: "#dc6866", roofType: "flat" },
  { x: 32, z: 4, w: 14, d: 10, h: 14, floors: 4, color: "#f5f0eb", roofType: "terrace" },
  { x: 32, z: 24, w: 12, d: 12, h: 10, floors: 2, color: "#e89882", roofType: "peaked" },

  // Central Plaza Borders
  { x: -16, z: -6, w: 8, d: 8, h: 10, floors: 2, color: "#f5f0eb", roofType: "flat" },
  { x: 16, z: -6, w: 8, d: 8, h: 10, floors: 2, color: "#387a80", roofType: "flat" },
];

export interface PalmTreePlot {
  x: number;
  z: number;
  scale: number;
  tilt: number;
}

export const PALM_TREES: PalmTreePlot[] = [
  // Beach Boardwalk Palm Line
  { x: -28, z: 38, scale: 1.1, tilt: 0.12 },
  { x: -20, z: 39, scale: 0.95, tilt: -0.08 },
  { x: -12, z: 38.5, scale: 1.05, tilt: 0.15 },
  { x: -4, z: 39, scale: 1.2, tilt: -0.1 },
  { x: 4, z: 38.5, scale: 1.15, tilt: 0.05 },
  { x: 12, z: 39, scale: 0.9, tilt: -0.12 },
  { x: 20, z: 38.5, scale: 1.25, tilt: 0.14 },
  { x: 28, z: 39, scale: 1.0, tilt: -0.06 },

  // Central Promenade Avenue
  { x: -4.5, z: 20, scale: 1.0, tilt: 0.05 },
  { x: 4.5, z: 20, scale: 1.05, tilt: -0.05 },
  { x: -4.5, z: 8, scale: 1.1, tilt: -0.08 },
  { x: 4.5, z: 8, scale: 0.95, tilt: 0.08 },
  { x: -4.5, z: -8, scale: 1.0, tilt: 0.06 },
  { x: 4.5, z: -8, scale: 1.15, tilt: -0.06 },
  { x: -4.5, z: -20, scale: 0.9, tilt: -0.05 },
  { x: 4.5, z: -20, scale: 1.05, tilt: 0.05 },

  // Café & Pier Gardens
  { x: 18, z: 12, scale: 1.2, tilt: 0.18 },
  { x: 26, z: 10, scale: 1.1, tilt: -0.12 },
  { x: 20, z: 6, scale: 0.85, tilt: 0.08 },
  { x: -18, z: 12, scale: 1.15, tilt: -0.15 },
  { x: -24, z: 8, scale: 0.95, tilt: 0.1 },
];

export interface StreetLightPlot {
  x: number;
  z: number;
  rotationY: number;
}

export const STREET_LIGHTS: StreetLightPlot[] = [
  { x: -5.5, z: 24, rotationY: Math.PI / 2 },
  { x: 5.5, z: 24, rotationY: -Math.PI / 2 },
  { x: -5.5, z: 12, rotationY: Math.PI / 2 },
  { x: 5.5, z: 12, rotationY: -Math.PI / 2 },
  { x: -5.5, z: 0, rotationY: Math.PI / 2 },
  { x: 5.5, z: 0, rotationY: -Math.PI / 2 },
  { x: -5.5, z: -12, rotationY: Math.PI / 2 },
  { x: 5.5, z: -12, rotationY: -Math.PI / 2 },
  { x: -5.5, z: -24, rotationY: Math.PI / 2 },
  { x: 5.5, z: -24, rotationY: -Math.PI / 2 },
  { x: -20, z: -5.5, rotationY: 0 },
  { x: -10, z: -5.5, rotationY: 0 },
  { x: 10, z: -5.5, rotationY: 0 },
  { x: 20, z: -5.5, rotationY: 0 },
];

function InstancedGrid({
  count,
  setMatrices,
  color,
  geometry,
  roughness,
  metalness,
  emissive,
  emissiveIntensity,
}: {
  count: number;
  setMatrices: (mesh: InstancedMesh) => void;
  color: string;
  geometry: BoxGeometry | CylinderGeometry | SphereGeometry;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
}) {
  const meshRef = useRef<InstancedMesh>(null);
    const material = useMemo(() => {
    const params: MeshStandardMaterialParameters = { color };
    if (roughness !== undefined) params.roughness = roughness;
    if (metalness !== undefined) params.metalness = metalness;
    if (emissiveIntensity !== undefined) params.emissiveIntensity = emissiveIntensity;
    if (emissive) params.emissive = new Color(emissive);
    return new MeshStandardMaterial(params);
  }, [color, roughness, metalness, emissive, emissiveIntensity]);

    const params: MeshStandardMaterialParameters = {
      color,
      roughness,
      metalness,
      emissiveIntensity,
    };
    if (emissive) {
      params.emissive = new Color(emissive);
    }
    return new MeshStandardMaterial(params);
  }, [color, roughness, metalness, emissive, emissiveIntensity]);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    setMatrices(meshRef.current);
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [setMatrices]);

  return <instancedMesh ref={meshRef} args={[geometry, material, count]} castShadow receiveShadow />;
}

// -------------------------------------------------------------
// CAFE INTERIOR & SEASIDE TERRACE
// -------------------------------------------------------------
function SeasideCafe({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Wooden Deck Floor */}
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[18, 0.16, 14]} />
        <meshStandardMaterial color="#8f5e38" roughness={0.7} />
      </mesh>

      {/* Modern Open-Air Glass & Wood Pavilion */}
      <group position={[0, 0, -3]}>
        <mesh position={[0, 3.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[16, 0.3, 7.5]} />
          <meshStandardMaterial color="#f5f0eb" roughness={0.4} />
        </mesh>
        <mesh position={[-7.5, 1.5, -3.4]}>
          <boxGeometry args={[0.3, 3, 0.3]} />
          <meshStandardMaterial color="#2d3142" />
        </mesh>
        <mesh position={[7.5, 1.5, -3.4]}>
          <boxGeometry args={[0.3, 3, 0.3]} />
          <meshStandardMaterial color="#2d3142" />
        </mesh>
        <mesh position={[-7.5, 1.5, 3.4]}>
          <boxGeometry args={[0.3, 3, 0.3]} />
          <meshStandardMaterial color="#2d3142" />
        </mesh>
        <mesh position={[7.5, 1.5, 3.4]}>
          <boxGeometry args={[0.3, 3, 0.3]} />
          <meshStandardMaterial color="#2d3142" />
        </mesh>
        <mesh position={[0, 1.5, -3.5]}>
          <boxGeometry args={[15.6, 3, 0.1]} />
          <meshStandardMaterial color="#e89882" roughness={0.6} />
        </mesh>
        <mesh position={[0, 3.6, 3.8]}>
          <boxGeometry args={[10, 0.6, 0.2]} />
          <meshStandardMaterial color="#e63946" roughness={0.3} />
        </mesh>
      </group>

      {/* Espresso & Smoothie Bar Counter */}
      <group position={[0, 0, -3.5]}>
        <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[10, 1.1, 1.2]} />
          <meshStandardMaterial color="#f4f1de" roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.12, 0]} castShadow>
          <boxGeometry args={[10.4, 0.08, 1.4]} />
          <meshStandardMaterial color="#222222" roughness={0.2} metalness={0.4} />
        </mesh>
        <mesh position={[-2, 1.4, 0]} castShadow>
          <boxGeometry args={[1.2, 0.6, 0.7]} />
          <meshStandardMaterial color="#999999" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[2, 1.35, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 0.4, 16]} />
          <meshStandardMaterial color="#a8dadc" roughness={0.1} />
        </mesh>
        {[-3.2, -1.6, 0, 1.6, 3.2].map((x, i) => (
          <group key={`stool-${i}`} position={[x, 0, 1.3]}>
            <mesh position={[0, 0.4, 0]} castShadow>
              <cylinderGeometry args={[0.04, 0.04, 0.8, 8]} />
              <meshStandardMaterial color="#333" metalness={0.8} />
            </mesh>
            <mesh position={[0, 0.8, 0]} castShadow>
              <cylinderGeometry args={[0.3, 0.3, 0.08, 16]} />
              <meshStandardMaterial color="#e76f51" roughness={0.5} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Patio Dining Tables */}
      {([
        [-5.5, 2.5],
        [0, 3.5],
        [5.5, 2.5],
        [-5.5, -1],
        [5.5, -1],
      ] as const).map(([tx, tz], i) => (
        <group key={`cafe-table-${i}`} position={[tx, 0.16, tz]}>
          <mesh position={[0, 0.4, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.18, 0.8, 12]} />
            <meshStandardMaterial color="#111" metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.9, 0.9, 0.06, 24]} />
            <meshStandardMaterial color="#ecd6be" roughness={0.5} />
          </mesh>
          <mesh position={[0, 1.6, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 2.8, 8]} />
            <meshStandardMaterial color="#444" />
          </mesh>
          <mesh position={[0, 2.7, 0]} castShadow>
            <coneGeometry args={[1.6, 0.6, 16]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#e76f51" : "#2a9d8f"} roughness={0.7} />
          </mesh>
          {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, ci) => (
            <mesh
              key={`chair-${ci}`}
              position={[Math.cos(angle) * 1.1, 0.28, Math.sin(angle) * 1.1]}
              castShadow
            >
              <boxGeometry args={[0.42, 0.5, 0.42]} />
              <meshStandardMaterial color="#264653" roughness={0.6} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Decorative Planters */}
      {[-8.5, 8.5].map((px, idx) => (
        <group key={`planter-${idx}`} position={[px, 0.16, 2]}>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[0.8, 0.9, 8]} />
            <meshStandardMaterial color="#2d3142" roughness={0.8} />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <boxGeometry args={[0.65, 0.6, 7.8]} />
            <meshStandardMaterial color="#4d783e" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// -------------------------------------------------------------
// CENTRAL PLAZA FOUNTAIN & MONUMENT
// -------------------------------------------------------------
function CentralPlazaFountain({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.25, 0]} receiveShadow>
        <cylinderGeometry args={[7, 7.4, 0.5, 32]} />
        <meshStandardMaterial color="#d8d5db" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.4, 0]} receiveShadow>
        <cylinderGeometry args={[6.2, 6.2, 0.35, 32]} />
        <meshStandardMaterial color="#2a9d8f" roughness={0.1} />
      </mesh>
      <mesh position={[0, 1.4, 0]} castShadow>
        <cylinderGeometry args={[3, 3.4, 1.6, 24]} />
        <meshStandardMaterial color="#f5f0eb" roughness={0.3} />
      </mesh>
      <mesh position={[0, 2.5, 0]} castShadow>
        <cylinderGeometry args={[1.2, 1.4, 1.0, 16]} />
        <meshStandardMaterial color="#e9c46a" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 3.7, 0]} castShadow>
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshStandardMaterial color="#f4a261" metalness={0.6} roughness={0.2} />
      </mesh>
      <mesh position={[0, 4.6, 0]}>
        <cylinderGeometry args={[0.2, 0.5, 0.8, 12]} />
        <meshStandardMaterial color="#a8dadc" roughness={0.1} />
      </mesh>
      <pointLight position={[0, 3.5, 0]} color="#f4a261" intensity={2} distance={18} />
    </group>
  );
}

// -------------------------------------------------------------
// SEASIDE BOARDWALK & MARINA PIER
// -------------------------------------------------------------
function SeasideBoardwalk() {
  return (
    <group>
      <mesh position={[0, 0.12, 38]} receiveShadow>
        <boxGeometry args={[74, 0.24, 8]} />
        <meshStandardMaterial color="#9b6a47" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.45, 41.9]} castShadow>
        <boxGeometry args={[74, 0.7, 0.15]} />
        <meshStandardMaterial color="#e5e5e5" metalness={0.5} roughness={0.4} />
      </mesh>
      <group position={[0, 0.08, 52]}>
        <mesh position={[0, 0, 0]} receiveShadow>
          <boxGeometry args={[7, 0.24, 22]} />
          <meshStandardMaterial color="#7a5134" roughness={0.9} />
        </mesh>
        {[-3.4, 3.4].map((px) => (
          <mesh key={`pier-rail-${px}`} position={[px, 0.45, 0]} castShadow>
            <boxGeometry args={[0.15, 0.7, 22]} />
            <meshStandardMaterial color="#f1faee" metalness={0.4} />
          </mesh>
        ))}
        {[-8, -2, 4, 8].map((pz, idx) => (
          <group key={`boat-berth-${idx}`} position={[5.5, -0.4, pz]}>
            <mesh position={[0, 0.35, 0]} rotation={[0, 0.1, 0]} castShadow>
              <boxGeometry args={[4.2, 1.1, 2.2]} />
              <meshStandardMaterial color={idx % 2 === 0 ? "#1d3557" : "#e63946"} roughness={0.3} />
            </mesh>
            <mesh position={[-0.4, 0.95, 0]} rotation={[0, 0.1, 0]}>
              <boxGeometry args={[2, 0.7, 1.8]} />
              <meshStandardMaterial color="#f1faee" roughness={0.4} />
            </mesh>
          </group>
        ))}
        <group position={[0, 1.6, 10.5]}>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 3.2, 8]} />
            <meshStandardMaterial color="#333" metalness={0.8} />
          </mesh>
          <mesh position={[0, 1.6, 0]}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color="#ffbe0b" emissive={new Color("#ffbe0b")} emissiveIntensity={2} />
          </mesh>
          <pointLight position={[0, 1.8, 0]} color="#ffbe0b" intensity={3} distance={20} />
        </group>
      </group>
    </group>
  );
}

// -------------------------------------------------------------
// LUXURY RESIDENTIAL VILLA WITH ROOFTOP INFINITY POOL
// -------------------------------------------------------------
function LuxuryVilla({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 4.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[14, 9, 12]} />
        <meshStandardMaterial color="#f8f9fa" roughness={0.3} />
      </mesh>
      <mesh position={[0, 4.5, 6.05]}>
        <boxGeometry args={[11, 6.8, 0.15]} />
        <meshStandardMaterial color="#457b9d" roughness={0.1} metalness={0.8} />
      </mesh>
      <mesh position={[0, 9.4, 0]} receiveShadow>
        <boxGeometry args={[14.8, 0.4, 12.8]} />
        <meshStandardMaterial color="#e9ecef" roughness={0.4} />
      </mesh>
      <group position={[0, 9.8, 1.5]}>
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[9.5, 0.8, 5.5]} />
          <meshStandardMaterial color="#dee2e6" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.65, 0]}>
          <boxGeometry args={[8.8, 0.4, 4.8]} />
          <meshStandardMaterial color="#00b4d8" roughness={0.05} />
        </mesh>
        <mesh position={[0, 1.1, 2.7]}>
          <boxGeometry args={[9.5, 0.8, 0.1]} />
          <meshStandardMaterial color="#caf0f8" roughness={0.1} />
        </mesh>
        {[-2.5, 0, 2.5].map((lx, idx) => (
          <mesh key={`lounger-${idx}`} position={[lx, 0.95, -1.8]} rotation={[0, 0.15, 0]} castShadow>
            <boxGeometry args={[1.8, 0.25, 0.7]} />
            <meshStandardMaterial color="#ffb703" roughness={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// -------------------------------------------------------------
// PROCEDURAL CITY BUILDINGS
// -------------------------------------------------------------
function ProceduralBuildings({ buildings }: { buildings: BuildingPlot[] }) {
  const geomBox = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const matWindows = useMemo(
    () => new MeshStandardMaterial({ color: "#8ecae6", roughness: 0.1, metalness: 0.7 }),
    [],
  );

  return (
    <group>
      {buildings.map((b, i) => (
        <group key={`bld-${i}`} position={[b.x, 0, b.z]}>
          <mesh position={[0, b.h / 2, 0]} geometry={geomBox} scale={[b.w, b.h, b.d]} castShadow receiveShadow>
            <meshStandardMaterial color={b.color} roughness={0.4} />
          </mesh>

          {/* Roof Accents */}
          {b.roofType === "terrace" && (
            <group position={[0, b.h, 0]}>
              <mesh position={[0, 0.5, 0]} castShadow>
                <boxGeometry args={[b.w - 1, 1, b.d - 1]} />
                <meshStandardMaterial color="#2d3142" roughness={0.5} />
              </mesh>
              {b.hasPool && (
                <mesh position={[0, 0.8, 0]}>
                  <boxGeometry args={[b.w - 4, 0.2, b.d - 4]} />
                  <meshStandardMaterial color="#00b4d8" roughness={0.1} />
                </mesh>
              )}
            </group>
          )}

          {b.roofType === "peaked" && (
            <mesh position={[0, b.h + 2.5, 0]} castShadow>
              <coneGeometry args={[Math.min(b.w, b.d) * 0.7, 5, 4]} />
              <meshStandardMaterial color="#c2543e" roughness={0.6} />
            </mesh>
          )}

          {/* Window Strips on Building Facades */}
          {Array.from({ length: b.floors }).map((_, f) => {
            const floorY = (f + 1) * (b.h / (b.floors + 1));
            return (
              <group key={`floor-${f}`} position={[0, floorY, 0]}>
                <mesh position={[0, 0, b.d / 2 + 0.05]} scale={[b.w * 0.75, 1.2, 0.05]} material={matWindows} />
                <mesh position={[0, 0, -b.d / 2 - 0.05]} scale={[b.w * 0.75, 1.2, 0.05]} material={matWindows} />
              </group>
            );
          })}
        </group>
      ))}
    </group>
  );
}

// -------------------------------------------------------------
// PALM TREES & VEGETATION
// -------------------------------------------------------------
function ProceduralPalmTrees({ palms }: { palms: PalmTreePlot[] }) {
  return (
    <group>
      {palms.map((p, i) => (
        <group key={`palm-${i}`} position={[p.x, 0, p.z]} scale={p.scale}>
          <mesh position={[0, 2.5, 0]} rotation={[p.tilt, 0, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.38, 5, 7]} />
            <meshStandardMaterial color="#5e4334" roughness={0.9} />
          </mesh>
          <group position={[0, 4.8, 0]}>
            {[0, 0.9, 1.8, 2.7, 3.6, 4.5, 5.4].map((rad, fIdx) => (
              <mesh
                key={`frond-${fIdx}`}
                position={[Math.cos(rad) * 1.5, -0.4, Math.sin(rad) * 1.5]}
                rotation={[0.3, rad, 0.4]}
                castShadow
              >
                <coneGeometry args={[0.6, 3.2, 5]} />
                <meshStandardMaterial color="#4d783e" roughness={0.6} />
              </mesh>
            ))}
            <mesh position={[0, 0.2, 0]}>
              <sphereGeometry args={[0.7, 8, 8]} />
              <meshStandardMaterial color="#3e6331" roughness={0.7} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

// -------------------------------------------------------------
// STREET LAMPS WITH WARM SUNSET GLOW
// -------------------------------------------------------------
function StreetLights({ lights }: { lights: StreetLightPlot[] }) {
  return (
    <group>
      {lights.map((l, i) => (
        <group key={`light-${i}`} position={[l.x, 0, l.z]} rotation={[0, l.rotationY, 0]}>
          <mesh position={[0, 2.2, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.1, 4.4, 8]} />
            <meshStandardMaterial color="#1f2421" metalness={0.8} />
          </mesh>
          <mesh position={[0.6, 4.3, 0]} rotation={[0, 0, Math.PI / 4]}>
            <cylinderGeometry args={[0.05, 0.05, 1.2, 8]} />
            <meshStandardMaterial color="#1f2421" metalness={0.8} />
          </mesh>
          <mesh position={[1.1, 4.5, 0]}>
            <sphereGeometry args={[0.22, 12, 12]} />
            <meshStandardMaterial color="#ffea79" emissive={new Color("#ffea79")} emissiveIntensity={3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// -------------------------------------------------------------
// ROADS & PEDESTRIAN CROSSINGS
// -------------------------------------------------------------
function RoadNetwork() {
  return (
    <group position={[0, 0.015, 0]}>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[9, 78]} />
        <meshStandardMaterial color="#222629" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, -6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[78, 9]} />
        <meshStandardMaterial color="#222629" roughness={0.9} />
      </mesh>
      {[-32, -20, -8, 8, 20, 32].map((z, idx) => (
        <mesh key={`dash-v-${idx}`} position={[0, 0.005, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.35, 3.5]} />
          <meshStandardMaterial color="#e9ecef" roughness={0.4} />
        </mesh>
      ))}
      {[-32, -20, 20, 32].map((x, idx) => (
        <mesh key={`dash-h-${idx}`} position={[x, 0.005, -6]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3.5, 0.35]} />
          <meshStandardMaterial color="#e9ecef" roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}
// -------------------------------------------------------------
// BEACH LIFEGUARD TOWER & SUNBEDS
// -------------------------------------------------------------
function BeachDecorations() {
  return (
    <group position={[-16, 0.05, 45]}>
      {[-1.2, 1.2].map((lx) =>
        [-1.2, 1.2].map((lz) => (
          <mesh key={`lg-leg-${lx}-${lz}`} position={[lx, 0.7, lz]}>
            <cylinderGeometry args={[0.08, 0.08, 1.6, 8]} />
            <meshStandardMaterial color="#e63946" />
          </mesh>
        )),
      )}
      <mesh position={[0, 2.6, 0]}>
        <boxGeometry args={[2.4, 1.8, 2.4]} />
        <meshStandardMaterial color="#f1faee" roughness={0.5} />
      </mesh>
      <mesh position={[0, 3.8, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[2.2, 0.8, 4]} />
        <meshStandardMaterial color="#e63946" />
      </mesh>
    </group>
  );
}
// -------------------------------------------------------------
// MAIN CITYWORLD EXPORT
// -------------------------------------------------------------
export function CityWorld({
  palette = DEFAULT_CITY_PALETTE,
}: {
  palette?: CityPalette;
}) {
  return (
    <group name="tropical-island-city">
      {/* 1. Surrounding Ocean */}
      <mesh position={[0, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color={palette.oceanSurface} roughness={0.08} metalness={0.2} />
      </mesh>
         {/* 2. Sandy Beach Perimeter */}
      <mesh position={[0, -0.05, 12]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[96, 96]} />
        <meshStandardMaterial color={palette.sand} roughness={0.9} />
      </mesh>
{/* 3. Main City Island Ground */}
      <mesh position={[0, 0, -6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[84, 84]} />
        <meshStandardMaterial color={palette.grass} roughness={0.8} />
      </mesh>

      {/* Concrete Promenade Sidewalks */}
      <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 78]} />
        <meshStandardMaterial color={palette.concrete} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.008, -6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[78, 14]} />
        <meshStandardMaterial color={palette.concrete} roughness={0.7} />
      </mesh>

      {/* Roads and Crossings */}
      <RoadNetwork />

      {/* Procedural Buildings */}
      <ProceduralBuildings buildings={CITY_BUILDINGS} />

      {/* Luxury Penthouse Villa with Rooftop Pool */}
      <LuxuryVilla position={[-20, 0, -22]} />
{/* Central Plaza Fountain */}
      <CentralPlazaFountain position={[0, 0, -6]} />

      {/* Seaside Boardwalk & Marina Berths */}
      <SeasideBoardwalk />

      {/* Beach Lifeguard Post */}
      <BeachDecorations />

      {/* Seaside Open-Air Cafe */}
      <SeasideCafe position={[22, 0, 14]} />

      {/* Palm Trees throughout Island */}
      <ProceduralPalmTrees palms={PALM_TREES} />

      {/* Street Lighting Along Roads */}
      <StreetLights lights={STREET_LIGHTS} />
    </group>
  );
      }
