import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  Compass,
  Copy,
  Heart,
  MapPin,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CityWorld } from "./scene/CityWorld";
import { PlayerAvatar } from "./scene/PlayerAvatar";
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
      version: 1,
      character: "mira",
      position: [0, 0, 14],
      rotationY: 0,
      visitedHotspots: [],
      lastSavedAt: Date.now(),
    };
    const updated: SoloSaveData = {
      ...current,
      ...data,
      lastSavedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to write solo save:", err);
  }
}

// Discovery Locations around the Tropical Island
const DISCOVERY_HOTSPOTS = [
  { id: "cafe", name: "Sunset Seaside Café", pos: [22, 14] as const, radius: 8, desc: "Oceanfront deck with fresh drinks, lofi beats, and lounge seating." },
  { id: "beach", name: "Golden Sands Boardwalk", pos: [0, 38] as const, radius: 9, desc: "Soft coral sands, lounge chairs, and warm tropical sunset breeze." },
  { id: "pier", name: "Marina Pier & Yachts", pos: [0, 52] as const, radius: 8, desc: "Walk down the long jetty to watch the golden sun dip below the ocean." },
  { id: "plaza", name: "Central Clocktower Fountain", pos: [0, -6] as const, radius: 8, desc: "The vibrant heart of the city with neon reflection pools." },
  { id: "villa", name: "Luxury Rooftop Pool Villa", pos: [-20, -22] as const, radius: 9, desc: "Infinity pool overlooking the ocean archipelago." },
];

// -------------------------------------------------------------
// LOCAL PLAYER CONTROLLER
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
  const motionRef = useRef({ current: 0 });

  const playerPos = useRef<[number, number, number]>([...initialPosition]);
  const playerRotY = useRef<number>(initialRotation);
  const verticalVelocity = useRef<number>(0);
  const isGrounded = useRef<boolean>(true);
  const forwardAngleRef = useRef<number>(0);
  const saveTimerRef = useRef<number>(0);

  const camTarget = useRef(new THREE.Vector3(...initialPosition));
  const camPos = useRef(new THREE.Vector3(initialPosition[0], initialPosition[1] + 3.8, initialPosition[2] + 7.5));

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

    // Island Boundaries: keep player on island
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

    // Walking animation speed
    motionRef.current.current = THREE.MathUtils.lerp(
      motionRef.current.current,
      step.isMoving ? (input.sprint ? 1.4 : 1.0) : 0,
      dt * 10,
    );

    // Smooth Third-person Camera Follow
    const targetX = playerPos.current[0];
    const targetY = playerPos.current[1] + 1.45;
    const targetZ = playerPos.current[2];

    camTarget.current.x = THREE.MathUtils.lerp(camTarget.current.x, targetX, dt * 10);
    camTarget.current.y = THREE.MathUtils.lerp(camTarget.current.y, targetY, dt * 8);
    camTarget.current.z = THREE.MathUtils.lerp(camTarget.current.z, targetZ, dt * 10);

    const camDistance = 6.8;
    const camHeight = 3.4;
    const idealCamX = targetX - Math.sin(forwardAngleRef.current) * camDistance;
    const idealCamZ = targetZ - Math.cos(forwardAngleRef.current) * camDistance;
    const idealCamY = targetY + camHeight;

    camPos.current.x = THREE.MathUtils.lerp(camPos.current.x, idealCamX, dt * 7);
    camPos.current.y = THREE.MathUtils.lerp(camPos.current.y, idealCamY, dt * 7);
    camPos.current.z = THREE.MathUtils.lerp(camPos.current.z, idealCamZ, dt * 7);

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

    // Auto-save progress locally every 3.5s
    saveTimerRef.current += dt;
    if (saveTimerRef.current >= 3.5) {
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
// REMOTE PARTNER AVATAR (2-PLAYER CO-OP)
// -------------------------------------------------------------
function RemotePartnerAvatar({ partner }: { partner: RoomPlayerState }) {
  const groupRef = useRef<THREE.Group>(null);
  const motionRef = useRef({ current: 0 });
  const lastPos = useRef<[number, number, number]>([...partner.position]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.1);

    // Smooth position interpolation
    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, partner.position[0], dt * 10);
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, partner.position[1], dt * 10);
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, partner.position[2], dt * 10);

    // Smooth rotation
    let diff = partner.rotationY - groupRef.current.rotation.y;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    groupRef.current.rotation.y += diff * Math.min(1, dt * 10);

    // Calculate whether partner is moving for walking animation
    const dx = partner.position[0] - lastPos.current[0];
    const dz = partner.position[2] - lastPos.current[2];
    const isMoving = Math.hypot(dx, dz) > 0.02;
    lastPos.current = [...partner.position];

    motionRef.current.current = THREE.MathUtils.lerp(
      motionRef.current.current,
      isMoving ? 1.0 : 0,
      dt * 8,
    );
  });

  return (
    <group ref={groupRef} position={partner.position} rotation={[0, partner.rotationY, 0]}>
      {/* Ground marker indicator */}
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
// POINTER CAMERA ORBIT CONTROLLER
// -------------------------------------------------------------
function PointerLookController({ isEnabled }: { isEnabled: boolean }) {
  const { camera } = useThree();
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);
  const yawRef = useRef(0);

  useEffect(() => {
    if (!isEnabled) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest("button") ||
        target?.closest(".game-joystick") ||
        target?.closest(".game-topbar") ||
        target?.closest(".game-minimap") ||
        target?.closest("input")
      ) {
        return;
      }
      draggingRef.current = true;
      lastXRef.current = e.clientX;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - lastXRef.current;
      lastXRef.current = e.clientX;
      yawRef.current -= dx * 0.0055;
      camera.rotation.y = yawRef.current;
    };

    const handlePointerUp = () => {
      draggingRef.current = false;
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [camera, isEnabled]);

  return null;
}

// -------------------------------------------------------------
// MAIN GAMEVIEW COMPONENT
// -------------------------------------------------------------
export function GameView() {
  const savedData = useMemo(() => loadSoloSave(), []);
  const localPlayerId = useMemo(() => `p_${Math.random().toString(36).slice(2, 9)}`, []);

  const [activeChar, setActiveChar] = useState<CharacterId>(savedData?.character || "mira");
  const [mapOpen, setMapOpen] = useState(false);
  const [coopModalOpen, setCoopModalOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [nearbyHotspot, setNearbyHotspot] = useState<string | null>(null);
  const [playerCoords, setPlayerCoords] = useState<[number, number, number]>(
    savedData?.position || [0, 0, 14],
  );
  const [playerRotY, setPlayerRotY] = useState<number>(savedData?.rotationY || 0);
  const [playerSpeed, setPlayerSpeed] = useState<number>(0);

  // 2-Player Co-op State
  const [currentRoomCode, setCurrentRoomCode] = useState<string | null>(null);
  const [roomInput, setRoomInput] = useState("");
  const [coopStatus, setCoopStatus] = useState<string | null>(null);
  const [partnerState, setPartnerState] = useState<RoomPlayerState | null>(null);
  const broadcastTimerRef = useRef<number>(0);

  // Input State Refs
  const inputRef = useRef<MovementInput>({
    forward: 0,
    turn: 0,
    sprint: false,
    jump: false,
    interact: false,
  });

  const joystickActive = useRef(false);
  const joystickStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSprinting, setIsSprinting] = useState(false);

  // Online / Offline Status Listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Keyboard Controls
  useEffect(() => {
    const keysDown = new Set<string>();

    const updateFromKeys = () => {
      let forward = 0;
      let turn = 0;
      if (keysDown.has("KeyW") || keysDown.has("ArrowUp")) forward += 1;
      if (keysDown.has("KeyS") || keysDown.has("ArrowDown")) forward -= 1;
      if (keysDown.has("KeyD") || keysDown.has("ArrowRight")) turn += 1;
      if (keysDown.has("KeyA") || keysDown.has("ArrowLeft")) turn -= 1;

      inputRef.current.forward = forward;
      inputRef.current.turn = turn;
      inputRef.current.sprint = keysDown.has("ShiftLeft") || keysDown.has("ShiftRight");
      inputRef.current.jump = keysDown.has("Space");
      inputRef.current.interact = keysDown.has("KeyE");
      setIsSprinting(inputRef.current.sprint);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      keysDown.add(e.code);
      updateFromKeys();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysDown.delete(e.code);
      updateFromKeys();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // -------------------------------------------------------------
  // REAL-TIME 2-PLAYER SYNC VIA SUPABASE REALTIME
  // -------------------------------------------------------------
  useEffect(() => {
    if (!currentRoomCode) {
      setPartnerState(null);
      return;
    }

    const channelName = `room_${currentRoomCode.toLowerCase()}`;
    setCoopStatus(`Connecting to room ${currentRoomCode}...`);

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
      },
    });

    channel
      .on("broadcast", { event: "pos" }, (payload) => {
        const data = payload["payload"] as {
          id: string;
          character: CharacterId;
          x: number;
          y: number;
          z: number;
          ry: number;
        };

        if (data && data.id !== localPlayerId) {
          setPartnerState({
            id: data.id,
            name: data.character === "mira" ? "Mira" : "Leo",
            character: data.character,
            position: [data.x, data.y, data.z],
            rotationY: data.ry,
          });
          setCoopStatus("Partner Connected!");
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setCoopStatus(`Room ${currentRoomCode} Active. Share code with partner!`);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentRoomCode, localPlayerId]);

  // Position broadcast loop to partner
  const handlePositionUpdate = useCallback(
    (pos: [number, number, number], rotY: number, speed: number) => {
      setPlayerCoords(pos);
      setPlayerRotY(rotY);
      setPlayerSpeed(speed);

      if (!currentRoomCode) return;

      const now = performance.now();
      if (now - broadcastTimerRef.current > 75) {
        broadcastTimerRef.current = now;
        const channelName = `room_${currentRoomCode.toLowerCase()}`;
        void supabase.channel(channelName).send({
          type: "broadcast",
          event: "pos",
          payload: {
            id: localPlayerId,
            character: activeChar,
            x: Number(pos[0].toFixed(2)),
            y: Number(pos[1].toFixed(2)),
            z: Number(pos[2].toFixed(2)),
            ry: Number(rotY.toFixed(3)),
          },
        });
      }
    },
    [currentRoomCode, localPlayerId, activeChar],
  );

  // On-screen Touch Joystick Handlers
  const handleJoystickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    joystickActive.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    joystickStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleJoystickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!joystickActive.current) return;
    const maxRadius = 44;
    const dx = e.clientX - joystickStart.current.x;
    const dy = e.clientY - joystickStart.current.y;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;
    setKnobOffset({ x: knobX, y: knobY });

    const normalized = clampJoystickInput({
      x: knobX / maxRadius,
      y: -knobY / maxRadius,
    });

    inputRef.current.turn = normalized.x;
    inputRef.current.forward = normalized.y;
  };

  const handleJoystickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    joystickActive.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // safe fallback
    }
    setKnobOffset({ x: 0, y: 0 });
    inputRef.current.turn = 0;
    inputRef.current.forward = 0;
  };

  const switchCharacter = (char: CharacterId) => {
    setActiveChar(char);
    saveSoloProgress({ character: char });
  };

  const handleCreateRoom = () => {
    const code = createRoomCode();
    setCurrentRoomCode(code);
    setCoopModalOpen(false);
  };

  const handleJoinRoom = () => {
    const normalized = normalizeRoomCode(roomInput);
    if (normalized) {
      setCurrentRoomCode(normalized);
      setCoopModalOpen(false);
      setRoomInput("");
    } else {
      alert("Please enter a valid 4-letter room code (e.g. K7WP)");
    }
  };

  const handleLeaveRoom = () => {
    setCurrentRoomCode(null);
    setPartnerState(null);
    setCoopStatus(null);
  };

  const handleResetProgress = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  };

  // Distance to partner
  const partnerDistance = partnerState
    ? Math.round(
        Math.hypot(
          playerCoords[0] - partnerState.position[0],
          playerCoords[2] - partnerState.position[2],
        ),
      )
    : null;

  return (
    <main className="our-city relative w-full h-[100dvh] overflow-hidden select-none bg-neutral-950 font-sans text-white">
      {/* 3D WebGL Canvas */}
      <Canvas
        className="game-canvas w-full h-full"
        camera={{ fov: 50, near: 0.1, far: 850, position: [0, 5, 20] }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
      >
        <PointerLookController isEnabled={!mapOpen && !coopModalOpen} />

        {/* Sunset Lighting */}
        <color attach="background" args={["#f6b98b"]} />
        <ambientLight intensity={1.8} />
        <hemisphereLight args={["#dceeff", "#8caa78", 1.4]} />
        <directionalLight position={[35, 55, 25]} intensity={2.8} castShadow />
        <pointLight position={[0, 15, 0]} intensity={1.8} distance={150} />

        <CityWorld />

        <PlayerController
          character={activeChar}
          inputRef={inputRef}
          initialPosition={savedData?.position || [0, 0, 14]}
          initialRotation={savedData?.rotationY || 0}
          onPositionUpdate={handlePositionUpdate}
          onNearHotspot={setNearbyHotspot}
        />

        {partnerState && <RemotePartnerAvatar partner={partnerState} />}
      </Canvas>

      {/* Top HUD Bar */}
      <header className="game-topbar absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
        <div className="flex items-center gap-2">
          <div className="game-brand flex items-center gap-2.5 bg-neutral-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 shadow-lg pointer-events-auto">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold tracking-wider uppercase text-amber-200">
              OUR CITY
            </span>
            <span className="text-[10px] uppercase tracking-wider text-white/50 border-l border-white/10 pl-2">
              A World for Two
            </span>
          </div>

          <button
            type="button"
            onClick={() => setCoopModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 bg-neutral-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium text-white shadow-lg pointer-events-auto hover:bg-neutral-800 transition-all"
          >
            <Users className="w-3.5 h-3.5 text-rose-400" />
            {currentRoomCode ? (
              <span className="text-emerald-300 font-mono font-bold">Room: {currentRoomCode}</span>
            ) : (
              <span>2-Player Co-op</span>
            )}
          </button>
        </div>

        {/* Character Switcher & Quick Actions */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="bg-neutral-900/80 backdrop-blur-md p-1 rounded-full border border-white/10 flex items-center gap-1 shadow-lg">
            <button
              type="button"
              onClick={() => switchCharacter("mira")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                activeChar === "mira"
                  ? "bg-rose-500 text-white shadow-md shadow-rose-500/30"
                  : "text-white/70 hover:text-white"
              }`}
            >
              Mira
            </button>
            <button
              type="button"
              onClick={() => switchCharacter("leo")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                activeChar === "leo"
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/30"
                  : "text-white/70 hover:text-white"
              }`}
            >
              Leo
            </button>
          </div>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="w-8 h-8 rounded-full bg-neutral-900/80 backdrop-blur-md border border-white/10 text-white hover:bg-neutral-800"
            aria-label="Toggle Sound"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-300" /> : <VolumeX className="w-4 h-4 text-white/40" />}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => setMapOpen(true)}
            className="w-8 h-8 rounded-full bg-neutral-900/80 backdrop-blur-md border border-white/10 text-white hover:bg-neutral-800"
            aria-label="Open Map"
          >
            <Compass className="w-4 h-4 text-amber-300" />
          </Button>
        </div>
      </header>

      {/* Partner Distance Indicator if Connected */}
      {partnerState && partnerDistance !== null && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-rose-500/90 backdrop-blur-md px-4 py-1.5 rounded-full border border-rose-300/40 shadow-xl flex items-center gap-2 pointer-events-none z-20 animate-pulse">
          <Heart className="w-3.5 h-3.5 text-white fill-white" />
          <span className="text-xs font-bold text-white">
            {partnerState.name}: {partnerDistance}m away
          </span>
        </div>
      )}

      {/* Minimap (GTA Radar Style at bottom-left) */}
      <aside className="game-minimap absolute bottom-24 sm:bottom-6 left-3 w-32 h-32 rounded-2xl bg-neutral-950/85 backdrop-blur-md border border-white/15 overflow-hidden shadow-2xl pointer-events-auto z-20">
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Radar Grid Rings */}
          <div className="absolute inset-2 rounded-xl border border-white/10" />
          <div className="absolute inset-6 rounded-lg border border-dashed border-white/10" />

          {/* Compass labels */}
          <span className="absolute top-1 text-[8px] font-bold text-amber-300">N</span>
          <span className="absolute bottom-1 text-[8px] font-bold text-white/40">S</span>
          <span className="absolute left-1 text-[8px] font-bold text-white/40">W</span>
          <span className="absolute right-1 text-[8px] font-bold text-white/40">E</span>

          {/* Hotspot blips on minimap */}
          {DISCOVERY_HOTSPOTS.map((spot) => {
            const relX = ((spot.pos[0] - playerCoords[0]) / 70) * 45;
            const relY = ((spot.pos[1] - playerCoords[2]) / 70) * 45;
            const clampedX = Math.max(-50, Math.min(50, relX));
            const clampedY = Math.max(-50, Math.min(50, relY));
            return (
              <div
                key={spot.id}
                title={spot.name}
                style={{
                  transform: `translate(${clampedX}px, ${clampedY}px)`,
                }}
                className="absolute w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/40"
              />
            );
          })}

          {/* Partner Radar Blip */}
          {partnerState && (
            <div
              style={{
                transform: `translate(${Math.max(
                  -50,
                  Math.min(50, ((partnerState.position[0] - playerCoords[0]) / 70) * 45),
                )}px, ${Math.max(
                  -50,
                  Math.min(50, ((partnerState.position[2] - playerCoords[2]) / 70) * 45),
                )}px)`,
              }}
              className="absolute w-3 h-3 rounded-full bg-rose-400 ring-4 ring-rose-400/50 animate-ping"
            />
          )}

          {/* Center Player Pointer */}
          <div className="relative z-10 flex flex-col items-center">
            <div
              className={`w-3 h-3 rounded-full border-2 border-white shadow-md ${
                activeChar === "mira" ? "bg-rose-500" : "bg-sky-500"
              }`}
            />
          </div>

          {/* Speedometer readout */}
          <div className="absolute bottom-1 right-2 text-[9px] font-mono text-white/60">
            {Math.round(playerSpeed * 2.2)} km/h
          </div>
        </div>
      </aside>

      {/* Proximity Interaction Prompt Banner */}
      {nearbyHotspot && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 bg-neutral-900/90 backdrop-blur-md px-4 py-2 rounded-full border border-amber-400/30 shadow-xl flex items-center gap-2 pointer-events-none z-20 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span className="text-xs font-semibold text-amber-200">
            Near {nearbyHotspot}
          </span>
        </div>
      )}

      {/* On-screen Mobile Controls */}
      <div className="game-mobile-controls sm:hidden absolute bottom-5 left-3 right-3 flex items-end justify-between pointer-events-none z-20">
        {/* Joystick Base */}
        <div
          onPointerDown={handleJoystickPointerDown}
          onPointerMove={handleJoystickPointerMove}
          onPointerUp={handleJoystickPointerUp}
          onPointerCancel={handleJoystickPointerUp}
          className="game-joystick w-28 h-28 rounded-full bg-neutral-900/60 backdrop-blur-md border border-white/20 flex items-center justify-center touch-none pointer-events-auto active:bg-neutral-900/80"
        >
          <div
            style={{
              transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
            }}
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-400 to-rose-400 shadow-lg border border-white/30 pointer-events-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5 pointer-events-auto">
          <button
            type="button"
            onClick={() => setCoopModalOpen(true)}
            className="w-14 h-14 rounded-full font-bold text-[10px] uppercase flex flex-col items-center justify-center shadow-xl border border-white/20 bg-neutral-900/80 backdrop-blur-md text-white active:bg-rose-500"
          >
            <Users className="w-4 h-4 text-rose-300 mb-0.5" />
            Co-op
          </button>

          <button
            type="button"
            onPointerDown={() => {
              inputRef.current.sprint = true;
              setIsSprinting(true);
            }}
            onPointerUp={() => {
              inputRef.current.sprint = false;
              setIsSprinting(false);
            }}
            onPointerCancel={() => {
              inputRef.current.sprint = false;
              setIsSprinting(false);
            }}
            className={`w-14 h-14 rounded-full font-bold text-xs uppercase flex items-center justify-center shadow-xl border border-white/20 backdrop-blur-md transition-all ${
              isSprinting ? "bg-amber-400 text-neutral-950 scale-95" : "bg-neutral-900/70 text-white"
            }`}
          >
            Sprint
          </button>

          <button
            type="button"
            onClick={() => {
              inputRef.current.jump = true;
              setTimeout(() => {
                inputRef.current.jump = false;
              }, 120);
            }}
            className="w-14 h-14 rounded-full font-bold text-xs uppercase flex items-center justify-center shadow-xl border border-white/20 bg-neutral-900/70 backdrop-blur-md text-white active:bg-rose-500 active:scale-95 transition-all"
          >
            Jump
          </button>
        </div>
      </div>

      {/* 2-Player Co-op Modal */}
      {coopModalOpen && (
        <div className="fixed inset-0 bg-neutral-950/90 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setCoopModalOpen(false)}
              className="absolute top-4 right-4 text-white hover:bg-white/10 rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>

            <div className="flex items-center gap-2 mb-4">
              <Users className="w-6 h-6 text-rose-400" />
              <h2 className="text-lg font-bold">2-Player Online Co-op</h2>
            </div>

            <p className="text-xs text-white/70 mb-6 leading-relaxed">
              Play together in the same 3D tropical sunset city with your partner. One creates a room code, the other joins!
            </p>

            {currentRoomCode ? (
              <div className="bg-black/40 border border-emerald-500/30 rounded-xl p-4 text-center mb-6">
                <div className="text-xs text-white/60 uppercase tracking-wider mb-1">Your 4-Letter Room Code</div>
                <div className="text-3xl font-mono font-extrabold text-amber-300 tracking-widest my-2">
                  {currentRoomCode}
                </div>
                <div className="text-xs text-emerald-400 mt-2">{coopStatus}</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(currentRoomCode);
                    alert("Room code copied to clipboard!");
                  }}
                  className="mt-3 text-xs gap-1 border-white/20"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Code
                </Button>
                <div className="mt-4 pt-3 border-t border-white/10">
                  <Button variant="destructive" size="sm" onClick={handleLeaveRoom} className="w-full text-xs">
                    Leave Co-op Session
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Button
                  onClick={handleCreateRoom}
                  className="w-full bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold rounded-xl py-5"
                >
                  Create New Room (Host)
                </Button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-white/10" />
                  <span className="flex-shrink mx-4 text-xs text-white/40 uppercase">or join partner</span>
                  <div className="flex-grow border-t border-white/10" />
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="CODE"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                    className="flex-1 bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-center font-mono font-bold text-lg uppercase placeholder:text-white/20 text-amber-300 focus:outline-none focus:border-amber-400"
                  />
                  <Button onClick={handleJoinRoom} className="bg-sky-500 hover:bg-sky-600 rounded-xl px-6">
                    Join
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Map & Solo Progress Overlay Modal */}
      {mapOpen && (
        <div className="fixed inset-0 bg-neutral-950/90 backdrop-blur-xl z-50 flex flex-col p-4 sm:p-8 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold tracking-wide">Island Map & Solo Expedition Guide</h2>
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
              <h3 className="text-sm font-semibold text-amber-300 uppercase tracking-wider mb-3">
                Key Coastal Landmarks
              </h3>
              <ul className="space-y-3">
                {DISCOVERY_HOTSPOTS.map((spot) => (
                  <li key={spot.id} className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-sm font-bold text-white">{spot.name}</div>
                    <div className="text-xs text-white/60 mt-0.5">{spot.desc}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-neutral-900/70 rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-amber-300 uppercase tracking-wider mb-3">
                  Solo Progress & Save Data
                </h3>
                <p className="text-xs text-white/70 leading-relaxed mb-4">
                  Your character choice, coordinate position, and visited areas are automatically saved
                  locally to your browser device every few seconds. You can play completely offline as a
                  standalone PWA.
                </p>
                <div className="text-xs font-mono text-white/50 bg-black/40 p-2.5 rounded-lg border border-white/5">
                  Current Coords: X {playerCoords[0].toFixed(1)}, Z {playerCoords[2].toFixed(1)}
                </div>
              </div>

              <div className="pt-6">
                <Button
                  variant="destructive"
                  onClick={handleResetProgress}
                  className="w-full text-xs font-semibold rounded-xl"
                >
                  Reset Local Save & Respawn at Pier
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
