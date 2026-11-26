import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export const INITIAL_COIN_LOCATIONS: [number, number, number][] = [
  [8, 0.6, 12],
  [-10, 0.6, 15],
  [14, 0.6, -18],
  [-16, 0.6, -12],
  [22, 0.6, 28],
  [-25, 0.6, 32],
  [30, 0.6, -20],
  [-5, 0.6, -30],
  [18, 0.6, 42],
  [-22, 0.6, -40],
  [35, 0.6, 10],
  [0, 0.6, 25],
];

// Synthesized audio using Web Audio API (zero external sound files needed)
export function playGtaCoinChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "triangle";

    // Classic arcade two-tone chime
    osc1.frequency.setValueAtTime(987.77, now);
    osc1.frequency.setValueAtTime(1318.51, now + 0.08);

    osc2.frequency.setValueAtTime(1480, now);
    osc2.frequency.setValueAtTime(1975, now + 0.08);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
  } catch {
    // Ignore audio permission blocks
  }
}

export function playBustedSiren() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(700, now);
    osc.frequency.linearRampToValueAtTime(950, now + 0.3);
    osc.frequency.linearRampToValueAtTime(600, now + 0.6);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.7);
  } catch {
    // Ignore audio permission blocks
  }
}

interface GtaCityFeaturesProps {
  playerPos: [number, number, number];
  wantedLevel: number;
  collectedCoinIds: number[];
  onCollectCoin: (coinId: number, reward: number) => void;
  onBusted: () => void;
  policePosRef: React.MutableRefObject<[number, number, number]>;
}

export function GtaCityFeatures({
  playerPos,
  wantedLevel,
  collectedCoinIds,
  onCollectCoin,
  onBusted,
  policePosRef,
}: GtaCityFeaturesProps) {
  const policeCarRef = useRef<THREE.Group>(null);
  const redLightRef = useRef<THREE.PointLight>(null);
  const blueLightRef = useRef<THREE.PointLight>(null);
  const collectedCoinIdsRef = useRef(new Set<number>(collectedCoinIds));

  React.useEffect(() => {
    collectedCoinIds.forEach((coinId) => collectedCoinIdsRef.current.add(coinId));
  }, [collectedCoinIds]);

  // Police cruiser position & angle state
  const policeState = useRef({
    x: 18,
    z: 22,
    angle: 0,
    speed: 0,
  });

  useFrame(({ clock }, delta) => {
    // 1. Animate spinning coins and check pickup
    const time = clock.elapsedTime;
    INITIAL_COIN_LOCATIONS.forEach((coinPos, idx) => {
      if (collectedCoinIdsRef.current.has(idx)) return;
      const dx = playerPos[0] - coinPos[0];
      const dz = playerPos[2] - coinPos[2];
      if (Math.hypot(dx, dz) < 1.6) {
        collectedCoinIdsRef.current.add(idx);
        playGtaCoinChime();
        onCollectCoin(idx, 50);
      }
    });

    // 2. Police Cruiser Siren Strobe Lights
    if (wantedLevel > 0) {
      const strobe = Math.sin(clock.elapsedTime * 15) > 0;
      if (redLightRef.current) redLightRef.current.intensity = strobe ? 8 : 0.2;
      if (blueLightRef.current) blueLightRef.current.intensity = strobe ? 0.2 : 8;

      // 3. Police Chase AI: steer towards player
      const dx = playerPos[0] - policeState.current.x;
      const dz = playerPos[2] - policeState.current.z;
      const distToPlayer = Math.sqrt(dx * dx + dz * dz);

      // Desired angle towards player
      const targetAngle = Math.atan2(dx, dz);
      let angleDiff = targetAngle - policeState.current.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      policeState.current.angle += angleDiff * Math.min(1, delta * 3.5);

      // Chase speed scales with wanted level
      const maxSpeed = 5.5 + wantedLevel * 1.5;
      policeState.current.speed = Math.min(maxSpeed, policeState.current.speed + delta * 5);
      policeState.current.x += Math.sin(policeState.current.angle) * policeState.current.speed * delta;
      policeState.current.z += Math.cos(policeState.current.angle) * policeState.current.speed * delta;

      // Check if Police BUSTS Player
      if (distToPlayer < 2.5) {
        playBustedSiren();
        onBusted();
        // Reset police back to station post-bust
        policeState.current.x = 25;
        policeState.current.z = 35;
        policeState.current.speed = 0;
      }
    } else {
      // Passive idle patrol
      if (redLightRef.current) redLightRef.current.intensity = 0;
      if (blueLightRef.current) blueLightRef.current.intensity = 0;
      policeState.current.speed = 0;
    }

    // Sync 3D Police car transform
    if (policeCarRef.current) {
      policeCarRef.current.position.set(policeState.current.x, 0.35, policeState.current.z);
      policeCarRef.current.rotation.y = policeState.current.angle;
    }

    // Update shared ref for minimap radar
    policePosRef.current = [policeState.current.x, 0.35, policeState.current.z];
  });

  return (
    <group>
      {/* 3D Gold Coins */}
      <group>
        {INITIAL_COIN_LOCATIONS.map((pos, idx) => {
          if (collectedCoinIds.includes(idx)) return null;
          return (
            <mesh key={idx} position={pos} rotation={[0, 0, Math.PI / 2]} castShadow>
              <CoinSpin time={time} index={idx} />
              <cylinderGeometry args={[0.38, 0.38, 0.08, 16]} />
              <meshStandardMaterial
                color="#f59e0b"
                roughness={0.2}
                metalness={0.9}
                emissive="#d97706"
                emissiveIntensity={0.4}
              />
            </mesh>
          );
        })}
      </group>

      {/* 3D Police Cruiser */}
      <group ref={policeCarRef} position={[18, 0.35, 22]}>
        {/* Main Body (Black & White Cruiser) */}
        <mesh position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[1.8, 0.6, 3.8]} />
          <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.5} />
        </mesh>
        {/* White Cabin & Doors */}
        <mesh position={[0, 0.75, -0.2]}>
          <boxGeometry args={[1.65, 0.55, 2.0]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.4} />
        </mesh>
        {/* Windshield & Windows */}
        <mesh position={[0, 0.78, -0.2]}>
          <boxGeometry args={[1.68, 0.45, 1.8]} />
          <meshStandardMaterial color="#0284c7" roughness={0.1} transparent opacity={0.6} />
        </mesh>
        {/* Police Roof Emergency Lightbar */}
        <mesh position={[0, 1.1, -0.2]}>
          <boxGeometry args={[1.1, 0.14, 0.3]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} />
        </mesh>
        {/* Red Strobe Dome */}
        <mesh position={[-0.35, 1.18, -0.2]}>
          <boxGeometry args={[0.3, 0.12, 0.2]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={wantedLevel > 0 ? 3 : 0.2} />
        </mesh>
        <pointLight ref={redLightRef} position={[-0.4, 1.3, -0.2]} color="#ef4444" distance={15} intensity={0} />
        {/* Blue Strobe Dome */}
        <mesh position={[0.35, 1.18, -0.2]}>
          <boxGeometry args={[0.3, 0.12, 0.2]} />
          <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={wantedLevel > 0 ? 3 : 0.2} />
        </mesh>
        <pointLight ref={blueLightRef} position={[0.4, 1.3, -0.2]} color="#3b82f6" distance={15} intensity={0} />
        {/* Headlights */}
        <mesh position={[-0.6, 0.35, 1.92]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={1.5} />
        </mesh>
        <mesh position={[0.6, 0.35, 1.92]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={1.5} />
        </mesh>
        {/* 4 Wheels */}
        {[[-0.95, 0.05, 1.1], [0.95, 0.05, 1.1], [-0.95, 0.05, -1.1], [0.95, 0.05, -1.1]].map((wp, i) => (
          <mesh key={i} position={wp as [number, number, number]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.35, 0.35, 0.22, 16]} />
            <meshStandardMaterial color="#1e293b" roughness={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  );
  }

function CoinSpin({ time, index }: { time: number; index: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += delta * 2.5;
    meshRef.current.position.y = 0.6 + Math.sin(time * 3 + index) * 0.12;
  });
  return <mesh ref={meshRef} />;
}
        
