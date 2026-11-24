import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
} from "three";

export type CityPalette = {
  sky: string;
  ground: string;
  road: string;
  roadMark: string;
  buildingA: string;
  buildingB: string;
  buildingC: string;
  window: string;
  foliage: string;
  trunk: string;
  water: string;
  shore: string;
  coral: string;
};
const DEFAULT_CITY_PALETTE: CityPalette = {
  sky: "#f6b98b",
  ground: "#8caa78",
  road: "#343943",
  roadMark: "#f5e6bd",
  buildingA: "#e8cbb0",
  buildingB: "#c8d6dc",
  buildingC: "#d9b8a0",
  window: "#ffe5a3",
  foliage: "#397a50",
  trunk: "#765037",
  water: "#168fa5",
  shore: "#58c3bd",
  coral: "#ff806d",
};
// -------------------------------------------------------------
// PROCEDURAL LAYOUT DEFINITIONS
// -------------------------------------------------------------

type BuildingSpec = {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  tone: number;
  hasAwning?: boolean;
};

function generateCityBlocks(): BuildingSpec[] {
  const list: BuildingSpec[] = [];
  const coords = [-75, -45, -15, 15, 45, 75];

  coords.forEach((x, cIdx) => {
    coords.forEach((z, rIdx) => {
      // Reserve center plaza and coastal zones for Cafe, Villa, Park & Beach
      const distFromCenter = Math.sqrt(x * x + z * z);
      if (distFromCenter < 28) return;
      // Reserve south beach zone (z > 60) for boardwalk & beach
      if (z > 55) return;
      // Reserve west seaside zone (x < -50 && z > 0) for the Villa
      if (x < -40 && z > 10 && z < 60) return;
      // Reserve east zone (x > 35 && z > 10 && z < 55) for the Seaside Cafe
      if (x > 30 && z > 15 && z < 55) return;

      const seed = (cIdx * 97 + rIdx * 41 + 17) % 1000;
      const isHighRise = Math.abs(x) < 35 && z < 10;
      const height = isHighRise ? 18 + (seed % 22) : 7 + (seed % 14);

      list.push({
        x: x + ((seed % 7) - 3) * 0.8,
        z: z + (((seed * 3) % 7) - 3) * 0.8,
        width: 10 + (seed % 4),
        depth: 10 + ((seed * 5) % 4),
        height,
        tone: seed % 3,
        hasAwning: seed % 2 === 0 && height < 14,
      });
    });
  });

  return list;
}

const CITY_BUILDINGS = generateCityBlocks();

// Palm tree placements (coastal promenade, park boulevard, cafe garden)
const PALM_LOCATIONS: [number, number][] = [
  // Beach promenade
  [-90, 68], [-70, 68], [-50, 68], [-30, 68], [-10, 68], [10, 68], [30, 68], [50, 68], [70, 68], [90, 68],
  [-80, 78], [-60, 78], [-40, 78], [-20, 78], [0, 78], [20, 78], [40, 78], [60, 78], [80, 78],
  // Villa garden
  [-62, 28], [-64, 42], [-50, 48], [-46, 22],
  // Seaside Cafe garden
  [58, 25], [60, 45], [44, 48], [38, 20],
  // Central Park boulevard
  [-16, -12], [16, -12], [-16, 12], [16, 12],
  [-28, 0], [28, 0], [0, -26], [0, 26],
  // Northern residential avenue
  [-60, -65], [-20, -65], [20, -65], [60, -65],
  [-80, -40], [80, -40],
];

// Streetlamp positions lining main avenues
const STREETLAMP_POSITIONS: [number, number, number][] = [
  // North-South Main Ave (X = -28 & X = 28)
  [-25, 0, -80], [-25, 0, -40], [-25, 0, 0], [-25, 0, 40],
  [25, 0, -80], [25, 0, -40], [25, 0, 0], [25, 0, 40],
  // East-West Grand Blvd (Z = 0)
  [-80, 0, -4], [-40, 0, -4], [40, 0, -4], [80, 0, -4],
  [-80, 0, 4], [-40, 0, 4], [40, 0, 4], [80, 0, 4],
  // Beach Boardwalk Promenade (Z = 64)
  [-80, 0, 64], [-50, 0, 64], [-20, 0, 64], [10, 0, 64], [40, 0, 64], [70, 0, 64],
];

// Helper to batch-render instanced meshes with a shared material
function InstancedGeometry({
  count,
  setMatrices,
  color,
  geometry,
  roughness = 0.85,
  metalness = 0.1,
  emissive,
  emissiveIntensity = 0,
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
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color,
        roughness,
        metalness,
        emissive: emissive ? new Color(emissive) : undefined,
        emissiveIntensity,
      }),
    [color, roughness, metalness, emissive, emissiveIntensity],
  );

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    setMatrices(meshRef.current);
    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.computeBoundingSphere();
  }, [setMatrices]);

  return <instancedMesh ref={meshRef} args={[geometry, material, count]} castShadow receiveShadow />;
}

// -------------------------------------------------------------
// FURNISHED SEASIDE CAFÉ COMPONENT
// Located at X = 48, Z = 32
// -------------------------------------------------------------
function SeasideCafe({ palette }: { palette: CityPalette }) {
  return (
    <group position={[48, 0, 32]}>
      {/* Wooden Deck Patio */}
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[22, 0.16, 18]} />
        <meshStandardMaterial color="#8b5a2b" roughness={0.7} />
      </mesh>

      {/* Main Bar / Counter Building Structure (Open Front) */}
      <group position={[0, 2.2, -5.5]}>
        {/* Back Wall */}
        <mesh position={[0, 0, -2.5]} receiveShadow>
          <boxGeometry args={[16, 4.2, 0.4]} />
          <meshStandardMaterial color="#f8eedb" roughness={0.9} />
        </mesh>
        {/* Left Side Wall */}
        <mesh position={[-7.8, 0, 0]} receiveShadow>
          <boxGeometry args={[0.4, 4.2, 5.2]} />
          <meshStandardMaterial color="#f8eedb" roughness={0.9} />
        </mesh>
        {/* Right Side Wall */}
        <mesh position={[7.8, 0, 0]} receiveShadow>
          <boxGeometry args={[0.4, 4.2, 5.2]} />
          <meshStandardMaterial color="#f8eedb" roughness={0.9} />
        </mesh>
        {/* Roof Pergola / Ceiling */}
        <mesh position={[0, 2.2, 0]} castShadow>
          <boxGeometry args={[18, 0.3, 7.5]} />
          <meshStandardMaterial color="#3a2518" roughness={0.7} />
        </mesh>
        {/* Striped Beach Awning */}
        <mesh position={[0, 1.8, 4.4]} rotation={[0.25, 0, 0]} castShadow>
          <boxGeometry args={[18.4, 0.15, 3.2]} />
          <meshStandardMaterial color={palette.coral} roughness={0.5} />
        </mesh>
        {/* Cafe Signboard */}
        <mesh position={[0, 2.8, 3.8]}>
          <boxGeometry args={[8, 0.8, 0.2]} />
          <meshStandardMaterial color="#1a1c23" emissive="#ff8e6e" emissiveIntensity={0.25} />
        </mesh>
        {/* Espresso Counter */}
        <mesh position={[0, -1.1, 1.2]} castShadow receiveShadow>
          <boxGeometry args={[11, 1.1, 1.4]} />
          <meshStandardMaterial color="#3f271d" roughness={0.6} />
        </mesh>
        {/* Espresso Machine on counter */}
        <mesh position={[-3, -0.3, 1.2]} castShadow>
          <boxGeometry args={[1.4, 0.7, 0.8]} />
          <meshStandardMaterial color="#silver" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Menu Chalkboard on back wall */}
        <mesh position={[2, 0.4, -2.2]}>
          <boxGeometry args={[3.2, 1.8, 0.1]} />
          <meshStandardMaterial color="#1f2421" roughness={0.9} />
        </mesh>
      </group>

      {/* Patio Dining Tables with Chairs & Sun Umbrellas */}
      {[
        [-5.5, 2.5],
        [0, 3.5],
        [5.5, 2.5],
        [-5.5, -1],
        [5.5, -1],
      ].map(([tx, tz], i) => (
        <group key={`cafe-table-${i}`} position={[tx, 0.16, tz]}>
          {/* Table Pedestal */}
          <mesh position={[0, 0.4, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.18, 0.8, 12]} />
            <meshStandardMaterial color="#111" metalness={0.7} />
          </mesh>
          {/* Table Top */}
          <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.9, 0.9, 0.06, 24]} />
            <meshStandardMaterial color="#ecd6be" roughness={0.5} />
          </mesh>
          {/* Sun Umbrella */}
          <mesh position={[0, 1.6, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 2.8, 8]} />
            <meshStandardMaterial color="#444" metalness={0.6} />
          </mesh>
          <mesh position={[0, 2.6, 0]} castShadow>
            <coneGeometry args={[1.5, 0.65, 16]} />
            <meshStandardMaterial color={i % 2 === 0 ? palette.coral : "#f6d55c"} roughness={0.6} />
          </mesh>
          {/* 2 Chairs around table */}
          {[-0.8, 0.8].map((cx, ci) => (
            <group key={`chair-${ci}`} position={[cx, 0, 0]}>
              <mesh position={[0, 0.25, 0]} castShadow>
                <boxGeometry args={[0.42, 0.5, 0.42]} />
                <meshStandardMaterial color="#3a2518" roughness={0.7} />
              </mesh>
              <mesh position={[cx > 0 ? 0.18 : -0.18, 0.65, 0]} castShadow>
                <boxGeometry args={[0.08, 0.5, 0.42]} />
                <meshStandardMaterial color="#3a2518" roughness={0.7} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* Decorative Perimeter Planters */}
      {[-9, 9].map((px) => (
        <group key={`planter-${px}`} position={[px, 0.3, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.8, 0.6, 14]} />
            <meshStandardMaterial color="#4b5563" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.35, 0]}>
            <boxGeometry args={[0.6, 0.4, 13.6]} />
            <meshStandardMaterial color="#2d5a27" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// -------------------------------------------------------------
// FURNISHED MODERN COASTAL VILLA
// Located at X = -52, Z = 34
// -------------------------------------------------------------
function CoastalVilla({ palette }: { palette: CityPalette }) {
  return (
    <group position={[-52, 0, 34]}>
      {/* Stone Foundation Terrace */}
      <mesh position={[0, 0.2, 0]} receiveShadow>
        <boxGeometry args={[26, 0.4, 22]} />
        <meshStandardMaterial color="#dcd3c8" roughness={0.8} />
      </mesh>

      {/* Modern Main Living Room Pavilion */}
      <group position={[-2, 2.5, -4]}>
        {/* Back Wall */}
        <mesh position={[0, 0, -4.5]} receiveShadow>
          <boxGeometry args={[18, 4.8, 0.4]} />
          <meshStandardMaterial color="#ffffff" roughness={0.3} />
        </mesh>
        {/* Left Wall with Window Cutout */}
        <mesh position={[-8.8, 0, 0]} receiveShadow>
          <boxGeometry args={[0.4, 4.8, 9]} />
          <meshStandardMaterial color="#ffffff" roughness={0.3} />
        </mesh>
        {/* Cantilevered Modern Flat Roof */}
        <mesh position={[1, 2.5, 1]} castShadow>
          <boxGeometry args={[22, 0.4, 13]} />
          <meshStandardMaterial color="#1e222a" roughness={0.5} />
        </mesh>
        {/* Tinted Floor-to-Ceiling Glass Panels */}
        <mesh position={[0, 0, 4.3]}>
          <boxGeometry args={[16, 4.4, 0.08]} />
          <meshStandardMaterial color="#88bbdd" transparent opacity={0.35} roughness={0.1} />
        </mesh>

        {/* Interior Furniture: Modern L-Sofa Lounge */}
        <group position={[-3, -1.8, -1]}>
          <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[4.2, 0.6, 1.8]} />
            <meshStandardMaterial color="#2c3038" roughness={0.8} />
          </mesh>
          <mesh position={[1.4, 0.3, 1.6]} castShadow receiveShadow>
            <boxGeometry args={[1.4, 0.6, 1.6]} />
            <meshStandardMaterial color="#2c3038" roughness={0.8} />
          </mesh>
          {/* Back Cushions */}
          <mesh position={[0, 0.8, -0.7]}>
            <boxGeometry args={[4.2, 0.5, 0.4]} />
            <meshStandardMaterial color="#3a3f4b" />
          </mesh>
          {/* Coffee Table */}
          <mesh position={[0, 0.25, 1.8]} castShadow>
            <boxGeometry args={[2.2, 0.35, 1.2]} />
            <meshStandardMaterial color="#111" metalness={0.5} roughness={0.3} />
          </mesh>
          {/* Floor Rug */}
          <mesh position={[0, 0.02, 1.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[4.8, 3.8]} />
            <meshStandardMaterial color={palette.coral} roughness={0.9} />
          </mesh>
        </group>

        {/* Ambient Warm Interior Chandelier Light */}
        <mesh position={[0, 1.8, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#fff0d0" emissive="#ffdd99" emissiveIntensity={0.8} />
        </mesh>
      </group>

      {/* Oceanfront Sun Deck with Loungers & Private Infinity Plunge Pool */}
      <group position={[1, 0.4, 5.5]}>
        {/* Glass Guard Railing overlooking the ocean */}
        <mesh position={[0, 0.55, 4.8]}>
          <boxGeometry args={[22, 1.1, 0.08]} />
          <meshStandardMaterial color="#a0c8e0" transparent opacity={0.4} roughness={0.1} />
        </mesh>

        {/* Plunge Pool basin */}
        <mesh position={[5.5, 0.05, 0]} receiveShadow>
          <boxGeometry args={[8, 0.3, 6]} />
          <meshStandardMaterial color="#387780" roughness={0.3} />
        </mesh>
        <mesh position={[5.5, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[7.4, 5.4]} />
          <meshStandardMaterial color="#2ba4b8" roughness={0.1} metalness={0.3} transparent opacity={0.85} />
        </mesh>

        {/* 2 Chaise Sun Loungers */}
        {[-4.5, -1.8].map((lx, idx) => (
          <group key={`lounger-${idx}`} position={[lx, 0.1, 0]} rotation={[0, 0.1, 0]}>
            <mesh position={[0, 0.15, 0]} castShadow>
              <boxGeometry args={[1.2, 0.25, 3.2]} />
              <meshStandardMaterial color="#f0f2f5" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.45, -1.1]} rotation={[0.4, 0, 0]} castShadow>
              <boxGeometry args={[1.2, 0.2, 1.2]} />
              <meshStandardMaterial color="#ffffff" roughness={0.7} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

// -------------------------------------------------------------
// BEACH BOARDWALK & MARINA PIER
// Located along the south shoreline (Z = 68 - 110)
// -------------------------------------------------------------
function BeachAndBoardwalk({ palette }: { palette: CityPalette }) {
  return (
    <group position={[0, 0, 72]}>
      {/* Main Boardwalk Planks Runway */}
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[210, 0.24, 8]} />
        <meshStandardMaterial color="#9c6644" roughness={0.8} />
      </mesh>

      {/* Boardwalk Safety Railings */}
      {[-1, 1].map((side) => (
        <group key={`boardwalk-rail-${side}`} position={[0, 0.6, side * 3.8]}>
          <mesh>
            <boxGeometry args={[210, 0.08, 0.08]} />
            <meshStandardMaterial color="#582f0e" roughness={0.7} />
          </mesh>
          {Array.from({ length: 22 }).map((_, pi) => (
            <mesh key={`post-${pi}`} position={[-100 + pi * 9.5, -0.3, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 0.8, 8]} />
              <meshStandardMaterial color="#582f0e" roughness={0.7} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Long Pier Extending Deep into the Ocean */}
      <group position={[0, 0, 24]}>
        <mesh position={[0, 0.1, 0]} receiveShadow>
          <boxGeometry args={[10, 0.24, 40]} />
          <meshStandardMaterial color="#7f4f24" roughness={0.85} />
        </mesh>
        {/* Pier Support Stilts in Water */}
        {[-14, -6, 2, 10, 18].map((pz, idx) => (
          <group key={`stilt-${idx}`} position={[0, -1.2, pz]}>
            <mesh position={[-4.5, 0, 0]}>
              <cylinderGeometry args={[0.22, 0.22, 2.6, 8]} />
              <meshStandardMaterial color="#3d2613" roughness={0.9} />
            </mesh>
            <mesh position={[4.5, 0, 0]}>
              <cylinderGeometry args={[0.22, 0.22, 2.6, 8]} />
              <meshStandardMaterial color="#3d2613" roughness={0.9} />
            </mesh>
          </group>
        ))}

        {/* Pier Gazebo / Lookout Pavilion at the Ocean Tip */}
        <group position={[0, 1.8, 18]}>
          <mesh position={[0, 1.8, 0]} castShadow>
            <coneGeometry args={[4.2, 1.6, 8]} />
            <meshStandardMaterial color={palette.coral} roughness={0.6} />
          </mesh>
          {[-3, 3].map((gx) =>
            [-3, 3].map((gz) => (
              <mesh key={`gz-pillar-${gx}-${gz}`} position={[gx * 0.8, 0, gz * 0.8]}>
                <cylinderGeometry args={[0.12, 0.12, 3.4, 8]} />
                <meshStandardMaterial color="#ffffff" roughness={0.4} />
              </mesh>
            )),
          )}
          {/* Romantic Lovers' Bench at end of the pier */}
          <group position={[0, -1.3, 1]}>
            <mesh position={[0, 0.25, 0]} castShadow>
              <boxGeometry args={[1.8, 0.45, 0.6]} />
              <meshStandardMaterial color="#4a2810" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.6, -0.25]}>
              <boxGeometry args={[1.8, 0.5, 0.1]} />
              <meshStandardMaterial color="#4a2810" roughness={0.7} />
            </mesh>
          </group>
        </group>
      </group>

      {/* Colorful Beach Umbrella Sets on Sandy Shoreline */}
      {[-65, -35, 35, 65].map((bx, bi) => (
        <group key={`beach-set-${bi}`} position={[bx, -0.05, 12]}>
          {/* Umbrella */}
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 2.4, 8]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          <mesh position={[0, 2.2, 0]} castShadow>
            <coneGeometry args={[1.8, 0.7, 16]} />
            <meshStandardMaterial color={bi % 2 === 0 ? "#ff5a5f" : "#00a896"} roughness={0.6} />
          </mesh>
          {/* Beach Towel on Sand */}
          <mesh position={[0.7, 0.02, 0.5]} rotation={[-Math.PI / 2, 0, 0.2]} receiveShadow>
            <planeGeometry args={[1.1, 2.1]} />
            <meshStandardMaterial color={bi % 2 === 0 ? "#f6d55c" : "#ff8e6e"} roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Lifeguard Lookout Tower */}
      <group position={[-85, 0, 16]}>
        <mesh position={[0, 1.6, 0]}>
          <boxGeometry args={[2.8, 0.2, 2.8]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
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
        <mesh position={[0, 3.8, 0]} castShadow>
          <coneGeometry args={[2.2, 0.8, 4]} rotation={[0, Math.PI / 4, 0]} />
          <meshStandardMaterial color="#e63946" />
        </mesh>
      </group>
    </group>
  );
}

// -------------------------------------------------------------
// MAIN CITYWORLD EXPORT
// -------------------------------------------------------------
export function CityWorld({ palette }: { palette: CityPalette }) {
  const beacon = useRef<Object3D | null>(null);
  const buildings = useMemo(() => CITY_BUILDINGS, []);
  const palmPoints = useMemo(() => PALM_LOCATIONS, []);
  const lampPoints = useMemo(() => STREETLAMP_POSITIONS, []);

  const boxGeometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const windowGeometry = useMemo(() => new BoxGeometry(0.85, 1.25, 0.12), []);
  const trunkGeometry = useMemo(() => new CylinderGeometry(0.24, 0.38, 5.5, 8), []);
  const leafGeometry = useMemo(() => new CylinderGeometry(0.04, 0.32, 4.0, 6), []);
  const streetlampGeometry = useMemo(() => new CylinderGeometry(0.09, 0.14, 5.2, 8), []);
  const bulbGeometry = useMemo(() => new SphereGeometry(0.3, 12, 12), []);
  const benchGeometry = useMemo(() => new BoxGeometry(1.9, 0.45, 0.65), []);
  const scratch = useMemo(() => new Object3D(), []);

  // Building transformation batching
  const buildingMatrices = useMemo(
    () => (mesh: InstancedMesh) => {
      buildings.forEach((item, index) => {
        scratch.position.set(item.x, item.height / 2, item.z);
        scratch.scale.set(item.width, item.height, item.depth);
        scratch.rotation.set(0, 0, 0);
        scratch.updateMatrix();
        mesh.setMatrixAt(index, scratch.matrix);

        const toneColor =
          item.tone === 0 ? palette.buildingA : item.tone === 1 ? palette.buildingB : palette.buildingC;
        mesh.setColorAt(index, new Color(toneColor));
      });
    },
    [buildings, palette, scratch],
  );

  // Window placement batching
  const windowPlacements = useMemo(() => {
    const list: { x: number; y: number; z: number; isFacingX: boolean }[] = [];
    buildings.forEach((item) => {
      const floors = Math.max(1, Math.floor((item.height - 2.5) / 3.4));
      const cols = Math.max(2, Math.floor(item.width / 2.3));

      for (let floor = 0; floor < floors; floor += 1) {
        for (let col = 0; col < cols; col += 1) {
          const offset = (col - (cols - 1) / 2) * 2.1;
          const y = 2.0 + floor * 3.4;
          // Front window
          list.push({ x: item.x + offset, y, z: item.z + item.depth / 2 + 0.08, isFacingX: false });
          // Side window
          list.push({ x: item.x + item.width / 2 + 0.08, y, z: item.z + offset, isFacingX: true });
        }
      }
    });
    return list;
  }, [buildings]);

  const windowMatrices = useMemo(
    () => (mesh: InstancedMesh) => {
      windowPlacements.forEach((win, index) => {
        scratch.position.set(win.x, win.y, win.z);
        scratch.scale.set(1, 1, 1);
        scratch.rotation.set(0, win.isFacingX ? Math.PI / 2 : 0, 0);
        scratch.updateMatrix();
        mesh.setMatrixAt(index, scratch.matrix);
      });
    },
    [windowPlacements, scratch],
  );

  // Road surfaces
  const roadMatrices = useMemo(
    () => (mesh: InstancedMesh) => {
      const mainAvenues = [-60, -25, 0, 25, 60];
      let idx = 0;
      mainAvenues.forEach((pos) => {
        // North-South thoroughfare
        scratch.position.set(pos, 0.015, 0);
        scratch.scale.set(9.2, 0.04, 230);
        scratch.rotation.set(0, 0, 0);
        scratch.updateMatrix();
        mesh.setMatrixAt(idx++, scratch.matrix);

        // East-West thoroughfare
        scratch.position.set(0, 0.015, pos);
        scratch.scale.set(230, 0.04, 9.2);
        scratch.rotation.set(0, 0, 0);
        scratch.updateMatrix();
        mesh.setMatrixAt(idx++, scratch.matrix);
      });
    },
    [scratch],
  );

  // White lane dashes
  const laneMatrices = useMemo(
    () => (mesh: InstancedMesh) => {
      const mainAvenues = [-60, -25, 0, 25, 60];
      let idx = 0;
      mainAvenues.forEach((pos) => {
        for (let step = -105; step <= 105; step += 12) {
          // NS lane line
          scratch.position.set(pos, 0.038, step);
          scratch.scale.set(0.2, 0.01, 4.5);
          scratch.rotation.set(0, 0, 0);
          scratch.updateMatrix();
          mesh.setMatrixAt(idx++, scratch.matrix);

          // EW lane line
          scratch.position.set(step, 0.038, pos);
          scratch.scale.set(4.5, 0.01, 0.2);
          scratch.rotation.set(0, 0, 0);
          scratch.updateMatrix();
          mesh.setMatrixAt(idx++, scratch.matrix);
        }
      });
    },
    [scratch],
  );

  // Palm trees
  const palmTrunkMatrices = useMemo(
    () => (mesh: InstancedMesh) => {
      palmPoints.forEach(([x, z], i) => {
        scratch.position.set(x, 2.7, z);
        // Gentle organic palm curve
        scratch.rotation.set(0.08, (i % 6) * 1.05, 0.06);
        scratch.scale.set(1 + (i % 3) * 0.06, 1, 1 + (i % 2) * 0.08);
        scratch.updateMatrix();
        mesh.setMatrixAt(i, scratch.matrix);
      });
    },
    [palmPoints, scratch],
  );

  const palmLeafMatrices = useMemo(
    () => (mesh: InstancedMesh) => {
      palmPoints.forEach(([x, z], treeIdx) => {
        for (let leaf = 0; leaf < 8; leaf += 1) {
          const slot = treeIdx * 8 + leaf;
          scratch.position.set(x, 5.4, z);
          scratch.rotation.set(0.92, (leaf / 8) * Math.PI * 2 + treeIdx * 0.4, 0.22);
          scratch.scale.set(1, 1, 0.9);
          scratch.updateMatrix();
          mesh.setMatrixAt(slot, scratch.matrix);
        }
      });
    },
    [palmPoints, scratch],
  );

  // Streetlamps
  const streetlampPoles = useMemo(
    () => (mesh: InstancedMesh) => {
      lampPoints.forEach(([x, y, z], idx) => {
        scratch.position.set(x, y + 2.6, z);
        scratch.scale.set(1, 1, 1);
        scratch.rotation.set(0, 0, 0);
        scratch.updateMatrix();
        mesh.setMatrixAt(idx, scratch.matrix);
      });
    },
    [lampPoints, scratch],
  );

  const streetlampBulbs = useMemo(
    () => (mesh: InstancedMesh) => {
      lampPoints.forEach(([x, y, z], idx) => {
        scratch.position.set(x, y + 5.3, z);
        scratch.scale.set(1, 1, 1);
        scratch.rotation.set(0, 0, 0);
        scratch.updateMatrix();
        mesh.setMatrixAt(idx, scratch.matrix);
      });
    },
    [lampPoints, scratch],
  );

  // Sidewalk Benches
  const benchLocations: [number, number, number, number][] = useMemo(
    () => [
      [-19, 0.22, 0, 0],
      [19, 0.22, 0, 0],
      [0, 0.22, -19, Math.PI / 2],
      [0, 0.22, 19, Math.PI / 2],
      [-22, 0.22, 35, 0],
      [22, 0.22, 35, 0],
      [-75, 0.22, 60, 0],
      [75, 0.22, 60, 0],
    ],
    [],
  );

  const benchMatrices = useMemo(
    () => (mesh: InstancedMesh) => {
      benchLocations.forEach(([x, y, z, rot], idx) => {
        scratch.position.set(x, y, z);
        scratch.scale.set(1, 1, 1);
        scratch.rotation.set(0, rot, 0);
        scratch.updateMatrix();
        mesh.setMatrixAt(idx, scratch.matrix);
      });
    },
    [benchLocations, scratch],
  );

  useFrame((_, delta) => {
    if (beacon.current) beacon.current.rotation.y += delta * 0.45;
  });

  return (
    <group>
      {/* ---------------- 1. SURROUNDING OCEAN (DEPTH-SORTED TO PREVENT FLICKER) ---------------- */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.45, 0]}>
        <planeGeometry args={[3000, 3000]} />
        <meshStandardMaterial color={palette.water} roughness={0.12} metalness={0.25} />
      </mesh>

      {/* Shallow Turquoise Coastal Reef Shoreline */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <planeGeometry args={[270, 270]} />
        <meshStandardMaterial color={palette.shore} roughness={0.35} metalness={0.1} />
      </mesh>

      {/* Main Island Ground Surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial color={palette.ground} roughness={0.98} />
      </mesh>

      {/* Sandy Beach Strip in the South */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 80]} receiveShadow>
        <planeGeometry args={[220, 48]} />
        <meshStandardMaterial color="#eed7a1" roughness={0.95} />
      </mesh>

      {/* ---------------- 2. ROAD NETWORK & HIGHWAYS ---------------- */}
      <InstancedGeometry count={10} setMatrices={roadMatrices} color={palette.road} geometry={boxGeometry} />
      <InstancedGeometry count={190} setMatrices={laneMatrices} color={palette.roadMark} geometry={boxGeometry} />

      {/* ---------------- 3. CITY BUILDINGS & WINDOW LIGHTS ---------------- */}
      <InstancedGeometry
        count={buildings.length}
        setMatrices={buildingMatrices}
        color={palette.buildingA}
        geometry={boxGeometry}
      />
      <InstancedGeometry
        count={windowPlacements.length}
        setMatrices={windowMatrices}
        color={palette.window}
        geometry={windowGeometry}
        roughness={0.2}
        metalness={0.7}
      />

      {/* ---------------- 4. STREET FURNITURE (LAMPS, BENCHES, PALMS) ---------------- */}
      <InstancedGeometry
        count={palmPoints.length}
        setMatrices={palmTrunkMatrices}
        color={palette.trunk}
        geometry={trunkGeometry}
      />
      <InstancedGeometry
        count={palmPoints.length * 8}
        setMatrices={palmLeafMatrices}
        color={palette.foliage}
        geometry={leafGeometry}
        roughness={0.6}
      />
      <InstancedGeometry
        count={lampPoints.length}
        setMatrices={streetlampPoles}
        color="#2b2d42"
        geometry={streetlampGeometry}
        metalness={0.8}
        roughness={0.3}
      />
      <InstancedGeometry
        count={lampPoints.length}
        setMatrices={streetlampBulbs}
        color="#fff1c5"
        geometry={bulbGeometry}
        emissive="#ffcc66"
        emissiveIntensity={1.2}
      />
      <InstancedGeometry
        count={benchLocations.length}
        setMatrices={benchMatrices}
        color="#4a3728"
        geometry={benchGeometry}
      />

      {/* ---------------- 5. WALK-IN FURNISHED LOCATIONS ---------------- */}
      <SeasideCafe palette={palette} />
      <CoastalVilla palette={palette} />
      <BeachAndBoardwalk palette={palette} />

      {/* ---------------- 6. ROTATING CITY CENTER BEACON / MONUMENT ---------------- */}
      <group position={[0, 0.15, 0]} ref={beacon}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[3.2, 0.16, 12, 64]} />
          <meshStandardMaterial color={palette.coral} emissive={palette.coral} emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[0, 2.8, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 5.6, 12]} />
          <meshStandardMaterial
            color={palette.coral}
            emissive={palette.coral}
            emissiveIntensity={0.25}
            transparent
            opacity={0.7}
          />
        </mesh>
      </group>
    </group>
  );
}
