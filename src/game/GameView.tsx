import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Copy, MapPin, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CityWorld } from "./scene/CityWorld";
import { PlayerAvatar } from "./scene/PlayerAvatar";
import { GtaHud, type WeaponInfo } from "./GtaHud";
import { CoinPickups } from "./scene/CoinPickups";
import { PoliceCar } from "./scene/PoliceCar";
import {
  clampJoystickInput,
  computeMovementStep,
  type MovementInput,
} from "./sim/movement";
import {
  createRoomCode,
  normalizeRoomCode,
  type CharacterId,
  type RoomPlayerState,
} from "./net/room";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "our_city_solo_save_v1";

interface SoloSaveData {
  version: 1;
  character: CharacterId;
  position: [number, number, number];
  rotationY: number;
  visitedHotspots: string[];
  cash: number;
  wantedLevel: number;
  lastSavedAt: number;
}

function loadSoloSave(): SoloSaveData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 1) return parsed as SoloSaveData;
  } catch (err) {
    console.warn("Failed to read solo save:", err);
  }
  return null;
}

function saveSoloProgress(data: Partial<SoloSaveData>) {
  if (typeof window === "undefined") return;
  try {
    const current = loadSoloSave() || {
      version: 1 as const,
      character: "mira" as CharacterId,
      position: [0, 0, 14] as [number, number, number],
      rotationY: 0,
      visitedHotspots: [],
      cash: 24873,
      wantedLevel: 0,
      lastSavedAt: Date.now(),
    };
    const updated = {
      ...current,
      ...data,
      lastSavedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to write solo save:", err);
  }
}

const DISCOVERY_HOTSPOTS = [
  { id: "pier", name: "Sunset Boardwalk", pos: [0, 14], radius: 6, desc: "Ocean pier & golden-hour breeze" },
  { id: "cafe", name: "La Brisa Sunset Café", pos: [12, -4], radius: 6, desc: "Outdoor seaside espresso & music" },
  { id: "plaza", name: "Plaza Mayor Fountain", pos: [0, -12], radius: 7, desc: "Civic center with palm roundabouts" },
  { id: "marina", name: "West Bay Marina", pos: [-24, 6], radius: 7, desc: "Speedboat docks & lighthouse lookout" },
  { id: "villa", name: "Hilltop Couple's Villa", pos: [22, -22], radius: 8, desc: "Private terrace with panorama" },
];

const WEAPONS: WeaponInfo[] = [
  { id: "pistol", name: "Pistol 9mm", ammo: 17, reserve: 93 },
  { id: "smg", name: "Micro SMG", ammo: 30, reserve: 120 },
  { id: "fists", name: "Unarmed", ammo: 0, reserve: 0 },
];

// -------------------------------------------------------------
// LOCAL PLAYER CONTROLLER (With Fixed Camera Framing & Motion)
// -------------------------------------------------------------
interface PlayerControllerProps {
  character: CharacterId;
  inputRef: React.MutableRefObject<MovementInput>;
  onPositionUpdate: (pos: [number, number, number], rotY: number, speed: number) => void;
  onNearHotspot: (hotspotName: string | null) => void;
  initialPosition?: [number, number, number];
  initialRotation?: number;
}

function PlayerController({
  character,
  inputRef,
  onPositionUpdate,
  onNearHotspot,
  initialPosition = [0, 0, 14],
  initialRotation = 0,
}: PlayerControllerProps) {
  const { camera } = useThree();
  const avatarGroupRef = useRef<THREE.Group>(null);
  const motionRef = useRef<number>(0);

  const playerPos = useRef<[number, number, number]>([...initialPosition]);
  const playerRotY = useRef<number>(initialRotation);
  const verticalVelocity = useRef<number>(0);
  const isGrounded = useRef<boolean>(true);
  const forwardAngleRef = useRef<number>(0);
  const saveTimerRef = useRef<number>(0);

  const camTarget = useRef(new THREE.Vector3(...initialPosition));
  const camPos = useRef(
    new THREE.Vector3(initialPosition[0], initialPosition[1] + 3.2, initialPosition[2] + 6.5)
  );

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.08);
    const input = inputRef.current;

    const lookDir = new THREE.Vector3();
    camera.getWorldDirection(lookDir);
    forwardAngleRef.current = Math.atan2(lookDir.x, lookDir.z);

    const step = computeMovementStep(
      playerPos.current,
      input,
      forwardAngleRef.current,
      dt,
    );

    // Gravity & Ground Logic
    const baseGroundY = 0.0;
    if (input.jump && isGrounded.current) {
      verticalVelocity.current = 7.5;
      isGrounded.current = false;
    }

    if (!isGrounded.current) {
      verticalVelocity.current -= 19.6 * dt;
      playerPos.current[1] += verticalVelocity.current * dt;
      if (playerPos.current[1] <= baseGroundY) {
        playerPos.current[1] = baseGroundY;
        verticalVelocity.current = 0;
        isGrounded.current = true;
      }
    } else {
      playerPos.current[1] = baseGroundY;
    }

    // Island Boundaries
    playerPos.current[0] = Math.max(-60, Math.min(60, step.nextPosition[0]));
    playerPos.current[2] = Math.max(-60, Math.min(60, step.nextPosition[2]));

    // Smooth character rotation towards movement angle
    if (step.facingAngle !== null) {
      let diff = step.facingAngle - playerRotY.current;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      playerRotY.current += diff * Math.min(1, dt * 14);
    }

    // Update avatar mesh position & rotation
    if (avatarGroupRef.current) {
      avatarGroupRef.current.position.set(
        playerPos.current[0],
        playerPos.current[1],
        playerPos.current[2],
      );
      avatarGroupRef.current.rotation.y = playerRotY.current;
    }

    // Smooth walking motion value (number, avoiding any object/NaN issues)
    motionRef.current = THREE.MathUtils.lerp(
      motionRef.current,
      step.isMoving ? (input.sprint ? 1.4 : 1.0) : 0,
      dt * 10,
    );

    // Third-person camera follow directly behind player
    const targetX = playerPos.current[0];
    const targetY = playerPos.current[1] + 1.4;
    const targetZ = playerPos.current[2];

    camTarget.current.x = THREE.MathUtils.lerp(camTarget.current.x, targetX, dt * 10);
    camTarget.current.y = THREE.MathUtils.lerp(camTarget.current.y, targetY, dt * 8);
    camTarget.current.z = THREE.MathUtils.lerp(camTarget.current.z, targetZ, dt * 10);

    const camDistance = 5.8;
    const camHeight = 2.8;
    const idealCamX = targetX - Math.sin(forwardAngleRef.current) * camDistance;
    const idealCamZ = targetZ - Math.cos(forwardAngleRef.current) * camDistance;
    const idealCamY = targetY + camHeight;

    camPos.current.x = THREE.MathUtils.lerp(camPos.current.x, idealCamX, dt * 8);
    camPos.current.y = THREE.MathUtils.lerp(camPos.current.y, idealCamY, dt * 8);
    camPos.current.z = THREE.MathUtils.lerp(camPos.current.z, idealCamZ, dt * 8);

    camera.position.copy(camPos.current);
    camera.lookAt(camTarget.current);

    onPositionUpdate(playerPos.current, playerRotY.current, step.currentSpeed);

    // Check proximity to discovery hotspots
    let foundHotspot: string | null = null;
    for (const spot of DISCOVERY_HOTSPOTS) {
      const dx = playerPos.current[0] - spot.pos[0];
      const dz = playerPos.current[2] - spot.pos[1];
      if (Math.hypot(dx, dz) <= spot.radius) {
        foundHotspot = spot.name;
        break;
      }
    }
    onNearHotspot(foundHotspot);

    // Auto-save locally every 3s
    saveTimerRef.current += dt;
    if (saveTimerRef.current >= 3.0) {
      saveTimerRef.current = 0;
      saveSoloProgress({
        character,
        position: playerPos.current,
        rotationY: playerRotY.current,
      });
    }
  });

  return (
    <group ref={avatarGroupRef}>
      <PlayerAvatar character={character} motion={motionRef} />
    </group>
  );
}

// -------------------------------------------------------------
// REMOTE PARTNER AVATAR (2-Player Co-op)
// -------------------------------------------------------------
function RemotePartnerAvatar({ partner }: { partner: RoomPlayerState }) {
  const groupRef = useRef<THREE.Group>(null);
  const motionRef = useRef<number>(0);
  const lastPos = useRef<[number, number, number]>([...partner.position]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.1);

    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, partner.position[0], dt * 10);
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, partner.position[1], dt * 10);
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, partner.position[2], dt * 10);

    let diff = partner.rotationY - groupRef.current.rotation.y;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    groupRef.current.rotation.y += diff * Math.min(1, dt * 10);

    const dx = partner.position[0] - lastPos.current[0];
    const dz = partner.position[2] - lastPos.current[2];
    const isMoving = Math.hypot(dx, dz) > 0.02;
    lastPos.current = [...partner.position];

    motionRef.current = THREE.MathUtils.lerp(
      motionRef.current,
      isMoving ? 1.0 : 0,
      dt * 8,
    );
  });

  return (
    <group ref={groupRef} position={partner.position} rotation={[0, partner.rotationY, 0]}>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.65, 0.8, 24]} />
        <meshBasicMaterial
          color={partner.character === "mira" ? "#f43f5e" : "#0ea5e9"}
          side={THREE.DoubleSide}
        />
      </mesh>
      <PlayerAvatar character={partner.character} motion={motionRef} />
    </group>
  );
}

// -------------------------------------------------------------
// MAIN GAMEVIEW
// -------------------------------------------------------------
export default function GameView() {
  const savedData = useMemo(() => loadSoloSave(), []);
  const [activeChar, setActiveChar] = useState<CharacterId>(savedData?.character || "mira");
  const [cash, setCash] = useState<number>(savedData?.cash ?? 24873);
  const [wantedLevel, setWantedLevel] = useState<number>(savedData?.wantedLevel ?? 0);
  const [weaponIdx, setWeaponIdx] = useState<number>(0);
  const [health, setHealth] = useState<number>(100);
  const [armor, setArmor] = useState<number>(75);
  const [collectedCoins, setCollectedCoins] = useState<string[]>([]);

  const [playerCoords, setPlayerCoords] = useState<[number, number, number]>(
    savedData?.position || [0, 0, 14],
  );
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number>(0);
  const [currentHotspot, setCurrentHotspot] = useState<string | null>(null);

  // 2-Player Co-op
  const [coopOpen, setCoopOpen] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [partnerState, setPartnerState] = useState<RoomPlayerState | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const [mapOpen, setMapOpen] = useState(false);

  // Movement input
  const inputRef = useRef<MovementInput>({
    forward: 0,
    turn: 0,
    sprint: false,
    jump: false,
    interact: false,
  });

  // Touch joystick
  const joystickCenter = useRef<{ x: number; y: number } | null>(null);
  const [joystickThumb, setJoystickThumb] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          inputRef.current.forward = 1;
          break;
        case "KeyS":
        case "ArrowDown":
          inputRef.current.forward = -1;
          break;
        case "KeyA":
        case "ArrowLeft":
          inputRef.current.turn = -1;
          break;
        case "KeyD":
        case "ArrowRight":
          inputRef.current.turn = 1;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          inputRef.current.sprint = true;
          break;
        case "Space":
          inputRef.current.jump = true;
          break;
        case "KeyE":
          inputRef.current.interact = true;
          break;
        case "KeyM":
          setMapOpen((prev) => !prev);
          break;
        case "Tab":
          e.preventDefault();
          setWeaponIdx((prev) => (prev + 1) % WEAPONS.length);
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
        case "KeyS":
        case "ArrowDown":
          inputRef.current.forward = 0;
          break;
        case "KeyA":
        case "ArrowLeft":
        case "KeyD":
        case "ArrowRight":
          inputRef.current.turn = 0;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          inputRef.current.sprint = false;
          break;
        case "Space":
          inputRef.current.jump = false;
          break;
        case "KeyE":
          inputRef.current.interact = false;
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Co-op realtime room connection
  useEffect(() => {
    if (!activeRoom) return;

    const channel = supabase.channel(`city-room-${activeRoom}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "player-move" }, ({ payload }) => {
        if (payload && payload.character !== activeChar) {
          setPartnerState(payload as RoomPlayerState);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeRoom, activeChar]);

  const handlePositionUpdate = useCallback(
    (pos: [number, number, number], rotY: number, speed: number) => {
      setPlayerCoords(pos);
      setCurrentSpeedKmh(speed * 3.6);

      if (activeRoom) {
        supabase.channel(`city-room-${activeRoom}`).send({
          type: "broadcast",
          event: "player-move",
          payload: {
            character: activeChar,
            position: pos,
            rotationY: rotY,
            action: inputRef.current.sprint ? "sprint" : speed > 0.2 ? "run" : "idle",
            timestamp: Date.now(),
          },
        });
      }
    },
    [activeRoom, activeChar],
  );

  const handleCollectCoin = useCallback((coinId: string, value: number) => {
    setCollectedCoins((prev) => [...prev, coinId]);
    setCash((prev) => {
      const updated = prev + value;
      saveSoloProgress({ cash: updated });
      return updated;
    });
  }, []);

  const handleCycleWeapon = useCallback(() => {
    setWeaponIdx((prev) => (prev + 1) % WEAPONS.length);
  }, []);

  const handleSwitchCharacter = useCallback(() => {
    const next = activeChar === "mira" ? "leo" : "mira";
    setActiveChar(next);
    saveSoloProgress({ character: next });
  }, [activeChar]);

  const handleCreateRoom = () => {
    const code = createRoomCode();
    setActiveRoom(code);
    setCoopOpen(false);
  };

  const handleJoinRoom = () => {
    const code = normalizeRoomCode(roomCodeInput);
    if (code.length === 4) {
      setActiveRoom(code);
      setCoopOpen(false);
    }
  };

  const handleCopyInvite = () => {
    if (!activeRoom) return;
    navigator.clipboard?.writeText?.(activeRoom);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <main className="relative w-full h-screen overflow-hidden bg-gradient-to-b from-sky-400 via-orange-300 to-rose-400 select-none">
      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 4, 20], fov: 50, near: 0.1, far: 300 }}
        className="w-full h-full block"
      >
        <ambientLight intensity={1.2} color="#ffe8d6" />
        <directionalLight position={[35, 55, 25]} intensity={2.8} castShadow />
        <pointLight position={[0, 15, 0]} intensity={1.8} distance={150} />

        <CityWorld />

        {/* 3D Gold Coins floating along streets */}
        <CoinPickups
          playerPos={playerCoords}
          collectedIds={collectedCoins}
          onCollect={handleCollectCoin}
        />

        {/* Police Patrol & Pursuit Cruiser */}
        <PoliceCar playerPos={playerCoords} wantedLevel={wantedLevel} />

        {/* Player Character Controller */}
        <PlayerController
          character={activeChar}
          inputRef={inputRef}
          initialPosition={savedData?.position || [0, 0, 14]}
          initialRotation={savedData?.rotationY || 0}
          onPositionUpdate={handlePositionUpdate}
          onNearHotspot={setCurrentHotspot}
        />

        {/* Remote Partner in 2-Player Co-op */}
        {partnerState && <RemotePartnerAvatar partner={partnerState} />}
      </Canvas>

      {/* GTA HUD Overlay */}
      <GtaHud
        cash={cash}
        wantedLevel={wantedLevel}
        health={health}
        armor={armor}
        currentWeapon={WEAPONS[weaponIdx] || WEAPONS[0]!}
        onCycleWeapon={handleCycleWeapon}
        character={activeChar}
        onSwitchCharacter={handleSwitchCharacter}
        activeRoom={activeRoom}
        onOpenCoop={() => setCoopOpen(true)}
        onOpenMap={() => setMapOpen(true)}
        speedKmh={currentSpeedKmh}
        hotspotNotice={currentHotspot}
      />

      {/* Touch On-Screen Controls */}
      <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-end p-4">
        <div className="flex items-end justify-between">
          {/* Virtual Touch Joystick */}
          <div
            className="pointer-events-auto relative w-32 h-32 rounded-full bg-black/40 backdrop-blur-md border border-white/20 touch-none flex items-center justify-center shadow-2xl"
            onTouchStart={(e) => {
              const touch = e.touches[0];
              if (!touch) return;
              joystickCenter.current = { x: touch.clientX, y: touch.clientY };
            }}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              if (!touch || !joystickCenter.current) return;
              const dx = touch.clientX - joystickCenter.current.x;
              const dy = touch.clientY - joystickCenter.current.y;
              const dist = Math.hypot(dx, dy);
              const maxDist = 48;
              const angle = Math.atan2(dy, dx);
              const clampedDist = Math.min(dist, maxDist);

              const thumbX = Math.cos(angle) * clampedDist;
              const thumbY = Math.sin(angle) * clampedDist;
              setJoystickThumb({ x: thumbX, y: thumbY });

              const norm = clampJoystickInput(thumbX / maxDist, thumbY / maxDist);
              inputRef.current.turn = norm.x;
              inputRef.current.forward = -norm.y;
            }}
            onTouchEnd={() => {
              joystickCenter.current = null;
              setJoystickThumb({ x: 0, y: 0 });
              inputRef.current.forward = 0;
              inputRef.current.turn = 0;
            }}
          >
            <div
              className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-rose-400 border border-white/40 shadow-lg"
              style={{
                transform: `translate3d(${joystickThumb.x}px, ${joystickThumb.y}px, 0)`,
                transition: joystickCenter.current ? "none" : "transform 0.15s ease-out",
              }}
            />
          </div>

          {/*Action Buttons */}
          <div className="pointer-events-auto flex flex-col items-end gap-2.5">
            <button
              type="button"
              onClick={() => setWantedLevel((prev) => (prev >= 5 ? 0 : prev + 1))}
              className="h-10 px-3.5 rounded-full bg-black/60 hover:bg-black/80 border border-amber-400/40 text-amber-300 font-bold text-xs shadow-lg"
            >
              ⭐ Wanted: {wantedLevel}★
            </button>

            <button
              type="button"
              onTouchStart={() => (inputRef.current.sprint = true)}
              onTouchEnd={() => (inputRef.current.sprint = false)}
              className="w-14 h-14 rounded-full bg-black/60 active:bg-amber-500 border border-white/20 text-white font-extrabold text-xs shadow-xl flex items-center justify-center"
            >
              RUN
            </button>

            <button
              type="button"
              onTouchStart={() => (inputRef.current.jump = true)}
              onTouchEnd={() => (inputRef.current.jump = false)}
              className="w-14 h-14 rounded-full bg-black/60 active:bg-rose-500 border border-white/20 text-white font-extrabold text-xs shadow-xl flex items-center justify-center"
            >
              JUMP
            </button>
          </div>
        </div>
      </div>

      {/* 2-Player Co-op Room Modal */}
      {coopOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/10 w-full max-w-sm rounded-3xl p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">2-Player Online Co-op</h3>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setCoopOpen(false)}
                className="text-white hover:bg-white/10 rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {activeRoom ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Your 4-Letter Room Code</div>
                  <div className="font-mono text-3xl font-black text-amber-400 tracking-widest">{activeRoom}</div>
                </div>

                <Button
                  onClick={handleCopyInvite}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {isCopied ? "Copied Code!" : "Copy Room Code"}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setActiveRoom(null)}
                  className="w-full border-white/10 text-white hover:bg-white/10 rounded-xl"
                >
                  Leave Room & Return Solo
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Button
                  onClick={handleCreateRoom}
                  className="w-full bg-gradient-to-r from-amber-500 to-rose-500 text-black font-extrabold rounded-xl py-6"
                >
                  Create New Room
                </Button>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="ROOM CODE"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    className="flex-1 bg-black/60 border border-white/20 rounded-xl px-4 py-3 font-mono text-center tracking-widest uppercase text-white focus:outline-none focus:border-amber-400"
                  />
                  <Button
                    onClick={handleJoinRoom}
                    disabled={roomCodeInput.trim().length !== 4}
                    className="bg-sky-500 hover:bg-sky-400 text-black font-bold rounded-xl px-6 py-3"
                  >
                    Join
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Map Overlay Modal */}
      {mapOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-lg flex flex-col p-6 text-white">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold">Island Map & Coordinates</h2>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setMapOpen(false)}
              className="text-white hover:bg-white/10 rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto py-6 grid sm:grid-cols-2 gap-4">
            <div className="bg-neutral-900/70 rounded-2xl p-4 border border-white/10">
              <h3 className="text-sm font-semibold text-amber-300 uppercase tracking-wider mb-3">Hotspots</h3>
              <ul className="space-y-2">
                {DISCOVERY_HOTSPOTS.map((spot) => (
                  <li key={spot.id} className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-sm font-bold">{spot.name}</div>
                    <div className="text-xs text-white/60">{spot.desc}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-neutral-900/70 rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-amber-300 uppercase tracking-wider mb-3">Status</h3>
                <div className="text-xs font-mono text-white/70 bg-black/40 p-3 rounded-xl space-y-1">
                  <div>X: {playerCoords[0].toFixed(1)}, Z: {playerCoords[2].toFixed(1)}</div>
                  <div>Cash: ${cash}</div>
                  <div>Wanted: {wantedLevel}★</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
                }
