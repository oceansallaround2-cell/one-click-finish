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
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "triangle";

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
  } catch {}
}

export function playBustedSiren() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
  } catch {}
}

export function playGunshotSound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.14);
    oscGain.gain.setValueAtTime(0.25, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);

    const bufferSize = Math.floor(ctx.sampleRate * 0.12);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.22, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
  } catch {}
}

export function playChatNotificationSound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880, now + 0.08);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  } catch {}
}

function SingleCoin({
  position,
  index,
}: {
  position: [number, number, number];
  index: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.z += delta * 2.5;
    meshRef.current.position.y =
      position[1] + Math.sin(clock.elapsedTime * 3 + index) * 0.12;
  });

  return (
    <mesh ref={meshRef} position={position} rotation={[0, 0, Math.PI / 2]} castShadow>
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
}

interface GtaCityFeaturesProps {
  playerPos: [number, number, number];
  wantedLevel: number;
  collectedCoinIds: number[];
  onCollectCoin: (coinId: number, reward: number) => void;
  onBusted: () => void;
  policePosRef: React.MutableRefObject<[number, number, number]>;
  isDrivingCar?: boolean;
  playerRotationY?: number;
  carPosRef?: React.MutableRefObject<[number, number, number]>;
}

export function GtaCityFeatures({
  playerPos,
  wantedLevel,
  collectedCoinIds,
  onCollectCoin,
  onBusted,
  policePosRef,
  isDrivingCar = false,
  playerRotationY = 0,
  carPosRef,
}: GtaCityFeaturesProps) {
  const policeCarRef = useRef<THREE.Group>(null);
  const sportsCarRef = useRef<THREE.Group>(null);
  const redLightRef = useRef<THREE.PointLight>(null);
  const blueLightRef = useRef<THREE.PointLight>(null);
  const collectedCoinIdsRef = useRef(new Set<number>(collectedCoinIds));

  // Parked sports car initial position
  const parkedCarState = useRef({
    x: 8,
    y: 0.35,
    z: 16,
    angle: 0.2,
  });

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
    // Check coin proximity pickup
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

    // Update Drivable Sports Car
    if (sportsCarRef.current) {
      if (isDrivingCar) {
        sportsCarRef.current.position.set(playerPos[0], 0.35, playerPos[2]);
        sportsCarRef.current.rotation.y = playerRotationY;
        if (carPosRef) {
          carPosRef.current = [playerPos[0], 0.35, playerPos[2]];
        }
      } else {
        sportsCarRef.current.position.set(
          parkedCarState.current.x,
          parkedCarState.current.y,
          parkedCarState.current.z
        );
        sportsCarRef.current.rotation.y = parkedCarState.current.angle;
        if (carPosRef) {
          carPosRef.current = [
            parkedCarState.current.x,
            parkedCarState.current.y,
            parkedCarState.current.z,
          ];
        }
      }
    }

    // Police Cruiser Siren Strobe Lights
    if (wantedLevel > 0) {
      const strobe = Math.sin(clock.elapsedTime * 15) > 0;
      if (redLightRef.current) redLightRef.current.intensity = strobe ? 8 : 0.2;
      if (blueLightRef.current) blueLightRef.current.intensity = strobe ? 0.2 : 8;

      // Police Chase AI: steer towards player
      const dx = playerPos[0] - policeState.current.x;
      const dz = playerPos[2] - policeState.current.z;
      const distToPlayer = Math.sqrt(dx * dx + dz * dz);

      const targetAngle = Math.atan2(dx, dz);
      let angleDiff = targetAngle - policeState.current.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      policeState.current.angle += angleDiff * Math.min(1, delta * 3.5);

      const maxSpeed = 5.5 + wantedLevel * 1.5;
      policeState.current.speed = Math.min(maxSpeed, policeState.current.speed + delta * 5);
      policeState.current.x += Math.sin(policeState.current.angle) * policeState.current.speed * delta;
      policeState.current.z += Math.cos(policeState.current.angle) * policeState.current.speed * delta;

      // Check if Police BUSTS Player
      if (distToPlayer < 2.5) {
        playBustedSiren();
        onBusted();
        policeState.current.x = 25;
        policeState.current.z = 35;
        policeState.current.speed = 0;
      }
    } else {
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
          return <SingleCoin key={idx} position={pos} index={idx} />;
        })}
      </group>

      {/* 3D Drivable Sports Convertible (Vice City Red & Gold) */}
      <group ref={sportsCarRef} position={[8, 0.35, 16]}>
        {/* Sleek Chassis */}
        <mesh position={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[1.7, 0.5, 3.6]} />
          <meshStandardMaterial color="#dc2626" roughness={0.2} metalness={0.7} />
        </mesh>
        {/* Hood Scoop / Aerodynamic Nose */}
        <mesh position={[0, 0.42, 1.1]}>
          <boxGeometry args={[1.2, 0.2, 1.2]} />
          <meshStandardMaterial color="#b91c1c" roughness={0.2} metalness={0.6} />
        </mesh>
        {/* Luxury Interior Cockpit */}
        <mesh position={[0, 0.48, -0.2]}>
          <boxGeometry args={[1.4, 0.35, 1.5]} />
          <meshStandardMaterial color="#1c1917" roughness={0.7} />
        </mesh>
        {/* Tinted Curved Windshield */}
        <mesh position={[0, 0.72, 0.5]} rotation={[-0.45, 0, 0]}>
          <boxGeometry args={[1.45, 0.4, 0.08]} />
          <meshStandardMaterial color="#38bdf8" transparent opacity={0.6} roughness={0.1} />
        </mesh>
        {/* Rear Racing Spoiler */}
        <mesh position={[0, 0.7, -1.6]}>
          <boxGeometry args={[1.6, 0.08, 0.3]} />
          <meshStandardMaterial color="#991b1b" roughness={0.3} metalness={0.5} />
        </mesh>
        {/* Dual Neon Headlights */}
        <mesh position={[-0.6, 0.3, 1.82]}>
          <sphereGeometry args={[0.13, 8, 8]} />
          <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={1.8} />
        </mesh>
        <mesh position={[0.6, 0.3, 1.82]}>
          <sphereGeometry args={[0.13, 8, 8]} />
          <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={1.8} />
        </mesh>
        {/* Taillights */}
        <mesh position={[-0.65, 0.35, -1.82]}>
          <boxGeometry args={[0.25, 0.12, 0.05]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.5} />
        </mesh>
        <mesh position={[0.65, 0.35, -1.82]}>
          <boxGeometry args={[0.25, 0.12, 0.05]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.5} />
        </mesh>
        {/* 4 Alloy Wheels */}
        {[
          [-0.92, 0.05, 1.0],
          [0.92, 0.05, 1.0],
          [-0.92, 0.05, -1.0],
          [0.92, 0.05, -1.0],
        ].map((wp, i) => (
          <mesh key={i} position={wp as [number, number, number]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.34, 0.34, 0.2, 16]} />
            <meshStandardMaterial color="#0f172a" roughness={0.7} metalness={0.8} />
          </mesh>
        ))}
      </group>

      {/* 3D Police Cruiser */}
      <group ref={policeCarRef} position={[18, 0.35, 22]}>
        <mesh position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[1.8, 0.6, 3.8]} />
          <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.75, -0.2]}>
          <boxGeometry args={[1.65, 0.55, 2.0]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.78, -0.2]}>
          <boxGeometry args={[1.68, 0.45, 1.8]} />
          <meshStandardMaterial color="#0284c7" roughness={0.1} transparent opacity={0.6} />
        </mesh>
        <mesh position={[0, 1.1, -0.2]}>
          <boxGeometry args={[1.1, 0.14, 0.3]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} />
        </mesh>
        <mesh position={[-0.35, 1.18, -0.2]}>
          <boxGeometry args={[0.3, 0.12, 0.2]} />
          <meshStandardMaterial
            color="#ef4444"
            emissive="#ef4444"
            emissiveIntensity={wantedLevel > 0 ? 3 : 0.2}
          />
        </mesh>
        <pointLight
          ref={redLightRef}
          position={[-0.4, 1.3, -0.2]}
          color="#ef4444"
          distance={15}
          intensity={0}
        />
        <mesh position={[0.35, 1.18, -0.2]}>
          <boxGeometry args={[0.3, 0.12, 0.2]} />
          <meshStandardMaterial
            color="#3b82f6"
            emissive="#3b82f6"
            emissiveIntensity={wantedLevel > 0 ? 3 : 0.2}
          />
        </mesh>
        <pointLight
          ref={blueLightRef}
          position={[0.4, 1.3, -0.2]}
          color="#3b82f6"
          distance={15}
          intensity={0}
        />
        <mesh position={[-0.6, 0.35, 1.92]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={1.5} />
        </mesh>
        <mesh position={[0.6, 0.35, 1.92]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={1.5} />
        </mesh>
        {[
          [-0.95, 0.05, 1.1],
          [0.95, 0.05, 1.1],
          [-0.95, 0.05, -1.1],
          [0.95, 0.05, -1.1],
        ].map((wp, i) => (
          <mesh key={i} position={wp as [number, number, number]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.35, 0.35, 0.22, 16]} />
            <meshStandardMaterial color="#1e293b" roughness={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  );
  }
    
