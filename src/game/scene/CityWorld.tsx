import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { BoxGeometry, Color, CylinderGeometry, InstancedMesh, MeshStandardMaterial, Object3D } from "three";

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

type Building = { x: number; z: number; width: number; depth: number; height: number; tone: number };

function createBuildings(): Building[] {
  const result: Building[] = [];
  const blocks = [-66, -22, 22, 66];
  blocks.forEach((x, column) => {
    blocks.forEach((z, row) => {
      if (Math.abs(x) < 30 && Math.abs(z) < 30) return;
      for (let lot = 0; lot < 2; lot += 1) {
        const seed = column * 71 + row * 29 + lot * 17 + 13;
        result.push({
          x: x + (lot === 0 ? -10 : 10) + ((seed % 5) - 2),
          z: z + (lot === 0 ? 10 : -10) + (((seed * 3) % 5) - 2),
          width: 8.8 + (seed % 4),
          depth: 8.8 + ((seed * 7) % 4),
          height: 9 + ((seed * 11) % 22),
          tone: seed % 3,
        });
      }
    });
  });
  return result;
}

const BUILDINGS = createBuildings();
const TREE_POSITIONS: [number, number][] = [
  [-14, -8], [14, -8], [-15, 9], [15, 9], [-35, -5], [35, -5], [-42, 35], [42, 35],
  [-72, 0], [72, 0], [-6, -48], [6, -48], [-32, -74], [32, -74], [-62, 68], [62, 68],
  [-82, 94], [-52, 94], [-22, 94], [8, 94], [38, 94], [68, 94],
];

function MatrixInstances({
  count,
  setMatrices,
  color,
  geometry,
}: {
  count: number;
  setMatrices: (mesh: InstancedMesh) => void;
  color: string;
  geometry: BoxGeometry | CylinderGeometry;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const material = useMemo(() => new MeshStandardMaterial({ color, roughness: 0.9 }), [color]);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    setMatrices(mesh.current);
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [setMatrices]);
  return (
    <instancedMesh ref={mesh} args={[geometry, material, count]} />
  );
}

export function CityWorld({ palette }: { palette: CityPalette }) {
  const beacon = useRef<Object3D | null>(null);
  const buildings = useMemo(() => BUILDINGS, []);
  const treePoints = useMemo(() => TREE_POSITIONS, []);
  const boxGeometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const windowGeometry = useMemo(() => new BoxGeometry(0.78, 1.12, 0.12), []);
  const trunkGeometry = useMemo(() => new CylinderGeometry(0.2, 0.32, 5.2, 7), []);
  const leafGeometry = useMemo(() => new CylinderGeometry(0.03, 0.28, 3.5, 6), []);
  const scratch = useMemo(() => new Object3D(), []);

  const buildingMatrices = useMemo(
    () => (mesh: InstancedMesh) => {
      buildings.forEach((item, index) => {
        scratch.position.set(item.x, item.height / 2 - 0.12, item.z);
        scratch.scale.set(item.width, item.height, item.depth);
        scratch.rotation.set(0, 0, 0);
        scratch.updateMatrix();
        mesh.setMatrixAt(index, scratch.matrix);
        const tone = item.tone === 0 ? palette.buildingA : item.tone === 1 ? palette.buildingB : palette.buildingC;
        mesh.setColorAt(index, new Color(tone));
      });
    },
    [buildings, palette, scratch],
  );

  const windowPlacements = useMemo(() => {
    const entries: { x: number; y: number; z: number; side: number }[] = [];
    buildings.forEach((item) => {
      const floors = Math.floor((item.height - 2) / 3.2);
      const across = Math.max(2, Math.floor(item.width / 2.1));
      for (let floor = 0; floor < floors; floor += 1) {
        for (let column = 0; column < across; column += 1) {
          const offset = (column - (across - 1) / 2) * 2.05;
          const y = 1.6 + floor * 3.2;
          entries.push({ x: item.x + offset, y, z: item.z + item.depth / 2 + 0.08, side: 0 });
          entries.push({ x: item.x + item.width / 2 + 0.08, y, z: item.z + offset, side: 1 });
        }
      }
    });
    return entries;
  }, [buildings]);

  const windowMatrices = useMemo(
    () => (mesh: InstancedMesh) => {
      windowPlacements.forEach((window, index) => {
        scratch.position.set(window.x, window.y, window.z);
        scratch.rotation.set(0, window.side === 0 ? 0 : Math.PI / 2, 0);
        scratch.scale.set(1, 1, 1);
        scratch.updateMatrix();
        mesh.setMatrixAt(index, scratch.matrix);
        mesh.setColorAt(index, new Color(window.side === 0 ? palette.window : palette.coral));
      });
    },
    [palette, scratch, windowPlacements],
  );

  const roadMatrices = useMemo(() => (mesh: InstancedMesh) => {
    const positions = [-88, -44, 0, 44, 88];
    let index = 0;
    positions.forEach((line) => {
      scratch.position.set(line, -0.12, 0);
      scratch.scale.set(8.2, 0.16, 220);
      scratch.rotation.set(0, 0, 0);
      scratch.updateMatrix();
      mesh.setMatrixAt(index, scratch.matrix);
      index += 1;
      scratch.position.set(0, -0.12, line);
      scratch.scale.set(220, 0.16, 8.2);
      scratch.updateMatrix();
      mesh.setMatrixAt(index, scratch.matrix);
      index += 1;
    });
  }, [scratch]);

  const laneMatrices = useMemo(() => (mesh: InstancedMesh) => {
    const roads = [-88, -44, 0, 44, 88];
    let index = 0;
    roads.forEach((line) => {
      for (let mark = -100; mark <= 100; mark += 12) {
        scratch.position.set(line, -0.025, mark);
        scratch.scale.set(0.16, 0.025, 4.2);
        scratch.rotation.set(0, 0, 0);
        scratch.updateMatrix();
        mesh.setMatrixAt(index, scratch.matrix);
        index += 1;
        scratch.position.set(mark, -0.025, line);
        scratch.scale.set(4.2, 0.025, 0.16);
        scratch.updateMatrix();
        mesh.setMatrixAt(index, scratch.matrix);
        index += 1;
      }
    });
  }, [scratch]);

  const treeMatrices = useMemo(() => (mesh: InstancedMesh) => {
    treePoints.forEach(([x, z], index) => {
      scratch.position.set(x, 2.5, z);
      scratch.rotation.set(0, (index % 5) * 0.7, 0);
      scratch.scale.set(1 + (index % 3) * 0.08, 1, 1 + (index % 2) * 0.1);
      scratch.updateMatrix();
      mesh.setMatrixAt(index, scratch.matrix);
    });
  }, [scratch, treePoints]);

  const leafMatrices = useMemo(() => (mesh: InstancedMesh) => {
    treePoints.forEach(([x, z], treeIndex) => {
      for (let leaf = 0; leaf < 7; leaf += 1) {
        const index = treeIndex * 7 + leaf;
        scratch.position.set(x, 4.95, z);
        scratch.rotation.set(0.94, (leaf / 7) * Math.PI * 2 + treeIndex * 0.37, 0.28);
        scratch.scale.set(1, 1, 0.82);
        scratch.updateMatrix();
        mesh.setMatrixAt(index, scratch.matrix);
      }
    });
  }, [scratch, treePoints]);

  useFrame((_, delta) => {
    if (beacon.current) beacon.current.rotation.y += delta * 0.5;
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]} receiveShadow>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial color={palette.ground} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.28, 145]}>
        <planeGeometry args={[300, 80]} />
        <meshStandardMaterial color={palette.water} roughness={0.28} metalness={0.1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 101]}>
        <planeGeometry args={[300, 10]} />
        <meshStandardMaterial color={palette.shore} roughness={1} />
      </mesh>
      <MatrixInstances count={10} setMatrices={roadMatrices} color={palette.road} geometry={boxGeometry} />
      <MatrixInstances count={170} setMatrices={laneMatrices} color={palette.roadMark} geometry={boxGeometry} />
      <MatrixInstances count={buildings.length} setMatrices={buildingMatrices} color={palette.buildingA} geometry={boxGeometry} />
      <MatrixInstances count={windowPlacements.length} setMatrices={windowMatrices} color={palette.window} geometry={windowGeometry} />
      <MatrixInstances count={treePoints.length} setMatrices={treeMatrices} color={palette.trunk} geometry={trunkGeometry} />
      <MatrixInstances count={treePoints.length * 7} setMatrices={leafMatrices} color={palette.foliage} geometry={leafGeometry} />
      <group position={[0, 0.12, -73]} ref={beacon}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.1, 0.11, 10, 48]} />
          <meshStandardMaterial color={palette.coral} emissive={palette.coral} emissiveIntensity={0.18} />
        </mesh>
        <mesh position={[0, 1.6, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 3.2, 8]} />
          <meshStandardMaterial color={palette.coral} emissive={palette.coral} emissiveIntensity={0.12} transparent opacity={0.6} />
        </mesh>
      </group>
      <group position={[-9, 0.02, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[2.6, 32]} />
          <meshStandardMaterial color={palette.shore} roughness={0.95} />
        </mesh>
      </group>
    </group>
  );
}