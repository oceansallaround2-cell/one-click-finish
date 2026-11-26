import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Copy, MapPin, Users, X, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CityWorld } from "./scene/CityWorld";
import { PlayerAvatar } from "./scene/PlayerAvatar";
import {
  GtaHud,
  OUTFIT_CATALOG,
  WEAPON_CATALOG,
  type OutfitItem,
  type WeaponInfo,
  type MissionInfo,
} from "./GtaHud";
import {
  GtaCityFeatures,
  playBustedSiren,
  playGtaCoinChime,
} from "./scene/GtaCityFeatures";
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

const STORAGE_KEY = "our_city_solo_save_v2";

export const COUPLE_MISSIONS: MissionInfo[] = [
  {
    id: "sunset_drive",
    title: "Ocean Drive Sunset Rendezvous",
    description: "Meet at the oceanfront palm promenade for golden hour.",
    targetPos: [0, 0.9, 32],
    reward: 250,
  },
  {
    id: "rooftop_starlight",
    title: "Rooftop Starlight Lookout",
    description: "Ascend to the high downtown district observation deck.",
    targetPos: [28, 0.9, 12],
    reward: 350,
  },
  {
    id: "marina_yacht",
    title: "Marina Yacht Club Secret",
    description: "Find the private speedboat docks on the east lagoon.",
    targetPos: [-28, 0.9, 15],
    reward: 500,
  },
  {
    id: "neon_club",
    title: "Neon Vice Lounge",
    description: "Celebrate with music at the neon-lit club terrace.",
    targetPos: [15, 0.9, -24],
    reward: 600,
  },
  {
    id: "sanctuary_villa",
    title: "Hilltop Sanctuary Retreat",
    description: "Return together to the private villa infinity pool.",
    targetPos: [0, 0.9, 0],
    reward: 800,
  },
];

interface SoloSaveData {
  version: 2;
  character: CharacterId;
  position: [number, number, number];
  rotationY: number;
  cash: number;
  wantedLevel: number;
  activeOutfitId: string;
  ownedOutfitIds: string[];
  activeWeaponId: string;
  ownedWeaponIds: string[];
  missionIndex: number;
  collectedCoinIds: number[];
  lastSavedAt: number;
}

function loadSoloSave(): SoloSaveData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SoloSaveData>;
    if (
      parsed.version === 2 &&
      Array.isArray(parsed.position) &&
      parsed.position.length === 3 &&
      parsed.position.every((n) => typeof n === "number" && Number.isFinite(n)) &&
      typeof parsed.rotationY === "number" &&
      Number.isFinite(parsed.rotationY)
    ) {
      return parsed as SoloSaveData;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveSoloProgress(data: SoloSaveData): void {
  if (typeof window === "undefined") return null as unknown as void;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

// 3D Camera Follow Controller
function CameraRig({ targetPos }: { targetPos: [number, number, number] }) {
  const { camera } = useThree();
  const smoothed = useRef(new THREE.Vector3(targetPos[0], targetPos[1] + 4, targetPos[2] + 9));

  useFrame((_, delta) => {
    const desired = new THREE.Vector3(targetPos[0], targetPos[1] + 3.8, targetPos[2] + 8.2);
    smoothed.current.lerp(desired, Math.min(1, delta * 4.5));
    camera.position.copy(smoothed.current);
    camera.lookAt(targetPos[0], targetPos[1] + 1.2, targetPos[2]);
  });

  return null;
}

export function GameView() {
  const saved = useMemo(() => loadSoloSave(), []);

  // Player state
  const [character, setCharacter] = useState<CharacterId>(saved?.character ?? "mira");
  const [position, setPosition] = useState<[number, number, number]>(saved?.position ?? [0, 0.9, 0]);
  const [rotationY, setRotationY] = useState(saved?.rotationY ?? 0);
  const [speedKmh, setSpeedKmh] = useState(0);

  // Economy & Outfits
  const [cash, setCash] = useState(saved?.cash ?? 500);
  const [wantedLevel, setWantedLevel] = useState(saved?.wantedLevel ?? 0);
  const [activeOutfitId, setActiveOutfitId] = useState(saved?.activeOutfitId ?? "sunset");
  const [ownedOutfitIds, setOwnedOutfitIds] = useState<string[]>(
    saved?.ownedOutfitIds ?? ["sunset"]
  );
  const [activeWeaponId, setActiveWeaponId] = useState(saved?.activeWeaponId ?? "fists");
  const [ownedWeaponIds, setOwnedWeaponIds] = useState<string[]>(
    saved?.ownedWeaponIds ?? ["fists"]
  );
  const [collectedCoinIds, setCollectedCoinIds] = useState<number[]>(
    saved?.collectedCoinIds ?? []
  );

  // Missions
  const [missionIndex, setMissionIndex] = useState(saved?.missionIndex ?? 0);
  const currentMission = COUPLE_MISSIONS[missionIndex % COUPLE_MISSIONS.length]!;

  // Police & Busted Banner
  const [bustedBanner, setBustedBanner] = useState(false);
  const [bustedFine, setBustedFine] = useState(0);
  const policePosRef = useRef<[number, number, number]>([18, 0.9, 22]);

  // Online Multiplayer Co-op State
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState("");
  const [coopModalOpen, setCoopModalOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [partnerState, setPartnerState] = useState<RoomPlayerState | null>(null);
  const [hotspotNotice, setHotspotNotice] = useState<string | null>(null);

  // Controller inputs
  const inputRef = useRef<MovementInput>({
    moveX: 0,
    moveZ: 0,
    sprint: false,
    jump: false,
  });
  const motionAnimRef = useRef(0);
  const [sprintHeld, setSprintHeld] = useState(false);

  // Dynamic Avatar Palettes based on selected outfit
  const currentOutfit = useMemo(
    () => OUTFIT_CATALOG.find((o) => o.id === activeOutfitId) ?? OUTFIT_CATALOG[0]!,
    [activeOutfitId]
  );

  const miraPalette = useMemo(
    () => ({
      skin: "#e8b99b",
      hair: "#38251f",
      jacket: "#22272e",
      dress: currentOutfit.miraColor,
      shirt: "#f5eee5",
      jewelry: "#e8c46a",
      shoe: "#1f2937",
      eye: "#49332c",
    }),
    [currentOutfit]
  );

  const leoPalette = useMemo(
    () => ({
      skin: "#e8b99b",
      hair: "#38251f",
      jacket: currentOutfit.leoColor,
      dress: "#991b1b",
      shirt: currentOutfit.id === "glamour" ? "#f8fafc" : "#f5eee5",
      jewelry: "#e8c46a",
      shoe: "#1f2937",
      eye: "#49332c",
    }),
    [currentOutfit]
  );

  const currentWeapon = useMemo(
    () => WEAPON_CATALOG.find((w) => w.id === activeWeaponId) ?? WEAPON_CATALOG[0]!,
    [activeWeaponId]
  );

  // Auto-save to LocalStorage every 3 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      saveSoloProgress({
        version: 2,
        character,
        position,
        rotationY,
        cash,
        wantedLevel,
        activeOutfitId,
        ownedOutfitIds,
        activeWeaponId,
        ownedWeaponIds,
        missionIndex,
        collectedCoinIds,
        lastSavedAt: Date.now(),
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [
    character,
    position,
    rotationY,
    cash,
    wantedLevel,
    activeOutfitId,
    ownedOutfitIds,
    activeWeaponId,
    ownedWeaponIds,
    missionIndex,
    collectedCoinIds,
  ]);

  // Real-time distances in meters (approx 8m per world unit)
  const missionDistMeters = Math.round(
    Math.hypot(
      position[0] - currentMission.targetPos[0],
      position[2] - currentMission.targetPos[2]
    ) * 8
  );

  const policeDistMeters = Math.round(
    Math.hypot(
      position[0] - policePosRef.current[0],
      position[2] - policePosRef.current[2]
    ) * 8
  );

  const partnerDistMeters = partnerState
    ? Math.round(
        Math.hypot(
          position[0] - partnerState.position[0],
          position[2] - partnerState.position[2]
        ) * 8
      )
    : null;

  // Check mission target proximity
  useEffect(() => {
    if (missionDistMeters < 25) {
      playGtaCoinChime();
      setCash((c) => c + currentMission.reward);
      setWantedLevel(0);
      setHotspotNotice(`Mission Passed! +$${currentMission.reward}`);
      setMissionIndex((i) => i + 1);
      setTimeout(() => setHotspotNotice(null), 3500);
    }
  }, [missionDistMeters, currentMission]);

  // Handle Coin Collection
  const handleCollectCoin = useCallback((coinId: number, reward: number) => {
    setCollectedCoinIds((prev) => (prev.includes(coinId) ? prev : [...prev, coinId]));
    setCash((c) => c + reward);
    setHotspotNotice(`+$${reward} Stash Collected!`);
    setTimeout(() => setHotspotNotice(null), 2000);
  }, []);

  // Handle Busted / Police Arrest
  const handleBusted = useCallback(() => {
    if (bustedBanner) return;
    playBustedSiren();
    const fine = Math.min(cash, 100 + wantedLevel * 75);
    setBustedFine(fine);
    setCash((c) => Math.max(0, c - fine));
    setWantedLevel(0);
    setBustedBanner(true);

    setTimeout(() => {
      // Respawn at safe Villa
      setPosition([0, 0.9, 0]);
      setBustedBanner(false);
      setHotspotNotice("Respawned at Villa Sanctuary");
      setTimeout(() => setHotspotNotice(null), 3000);
    }, 3200);
  }, [bustedBanner, cash, wantedLevel]);

  // Cycle Equipped Weapon
  const handleCycleWeapon = useCallback(() => {
    const ownedWeapons = WEAPON_CATALOG.filter((w) => ownedWeaponIds.includes(w.id));
    const currIdx = ownedWeapons.findIndex((w) => w.id === activeWeaponId);
    const next = ownedWeapons[(currIdx + 1) % ownedWeapons.length];
    if (next) setActiveWeaponId(next.id);
  }, [ownedWeaponIds, activeWeaponId]);

  // Buy Outfit
  const handleBuyOutfit = useCallback(
    (outfit: OutfitItem) => {
      if (ownedOutfitIds.includes(outfit.id)) {
        setActiveOutfitId(outfit.id);
        return;
      }
      if (cash >= outfit.price) {
        setCash((c) => c - outfit.price);
        setOwnedOutfitIds((prev) => [...prev, outfit.id]);
        setActiveOutfitId(outfit.id);
        playGtaCoinChime();
      }
    },
    [cash, ownedOutfitIds]
  );

  // Buy Weapon
  const handleBuyWeapon = useCallback(
    (weapon: WeaponInfo) => {
      if (ownedWeaponIds.includes(weapon.id)) {
        setActiveWeaponId(weapon.id);
        return;
      }
      if (cash >= weapon.price) {
        setCash((c) => c - weapon.price);
        setOwnedWeaponIds((prev) => [...prev, weapon.id]);
        setActiveWeaponId(weapon.id);
        playGtaCoinChime();
      }
    },
    [cash, ownedWeaponIds]
  );

  // Switch Character between Mira and Leo
  const handleSwitchCharacter = useCallback(() => {
    setCharacter((c) => (c === "mira" ? "leo" : "mira"));
  }, []);

  // Online Multiplayer Supabase Realtime Channel
  useEffect(() => {
    if (!roomCode) return;

    const channelName = `our_city_room_${roomCode}`;
    const channel = supabase.channel(channelName);

    channel
      .on("broadcast", { event: "player_move" }, ({ payload }) => {
        if (payload && payload.id !== character) {
          setPartnerState(payload as RoomPlayerState);
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      setPartnerState(null);
    };
  }, [roomCode, character]);

  // Broadcast player movement to partner in room
  useEffect(() => {
    if (!roomCode) return;
    const channelName = `our_city_room_${roomCode}`;
    const channel = supabase.channel(channelName);

        const payload: RoomPlayerState = {
      id: character,
      name: character === "mira" ? "Mira" : "Leo",
      character,
      position,
      rotationY,
      wantedLevel,
      activity: wantedLevel > 0 ? "wanted" : "walking",
      missionIndex: activeMissionIdx,
      activeOutfitId: outfit,
      activeWeaponId: currentWeapon,
    };
    
    void channel.send({
      type: "broadcast",
      event: "player_move",
      payload,
    });
  }, [position, rotationY, roomCode, character, wantedLevel, activeMissionIdx, outfit, currentWeapon]);
  
  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "w" || e.key === "ArrowUp") inputRef.current.moveZ = -1;
      if (e.key === "s" || e.key === "ArrowDown") inputRef.current.moveZ = 1;
      if (e.key === "a" || e.key === "ArrowLeft") inputRef.current.moveX = -1;
      if (e.key === "d" || e.key === "ArrowRight") inputRef.current.moveX = 1;
      if (e.key === "Shift") {
        inputRef.current.sprint = true;
        setSprintHeld(true);
      }
      if (e.key === " ") inputRef.current.jump = true;
      if (e.key === "c" || e.key === "C") handleSwitchCharacter();
      if (e.key === "q" || e.key === "Q") handleCycleWeapon();
      if (e.key === "m" || e.key === "M") setMapOpen((m) => !m);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "w" || e.key === "ArrowUp" || e.key === "s" || e.key === "ArrowDown") {
        inputRef.current.moveZ = 0;
      }
      if (e.key === "a" || e.key === "ArrowLeft" || e.key === "d" || e.key === "ArrowRight") {
        inputRef.current.moveX = 0;
      }
      if (e.key === "Shift") {
        inputRef.current.sprint = false;
        setSprintHeld(false);
      }
      if (e.key === " ") inputRef.current.jump = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [handleSwitchCharacter, handleCycleWeapon]);

  // Virtual Joystick handlers for mobile
  const [touchActive, setTouchActive] = useState(false);
  const [touchPos, setTouchPos] = useState({ x: 0, y: 0 });
  const touchOriginRef = useRef({ x: 0, y: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchOriginRef.current = { x: touch.clientX, y: touch.clientY };
    setTouchActive(true);
    setTouchPos({ x: 0, y: 0 });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchActive) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = touch.clientX - touchOriginRef.current.x;
    const dy = touch.clientY - touchOriginRef.current.y;
    const maxRadius = 45;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const normX = (Math.cos(angle) * clampedDist) / maxRadius;
    const normY = (Math.sin(angle) * clampedDist) / maxRadius;

    setTouchPos({ x: normX * 35, y: normY * 35 });
    const clamped = clampJoystickInput({ x: normX, y: normY });
    inputRef.current.moveX = clamped.x;
    inputRef.current.moveZ = clamped.y;
  };

  const handleTouchEnd = () => {
    setTouchActive(false);
    setTouchPos({ x: 0, y: 0 });
    inputRef.current.moveX = 0;
    inputRef.current.moveZ = 0;
  };

  return (
    <main className="relative w-full h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 3D Scene Viewport */}
      <Canvas
        shadows
        camera={{ position: [position[0], position[1] + 4, position[2] + 8], fov: 60 }}
        className="w-full h-full"
      >
        <CameraRig targetPos={position} />
        <ambientLight intensity={0.75} />
        <directionalLight
          position={[40, 50, 30]}
          intensity={1.8}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />

        <CityWorld />

        <GtaCityFeatures
          playerPos={position}
          wantedLevel={wantedLevel}
          collectedCoinIds={collectedCoinIds}
          onCollectCoin={handleCollectCoin}
          onBusted={handleBusted}
          policePosRef={policePosRef}
        />

        {/* Local Player Character */}
        <group position={position} rotation={[0, rotationY, 0]}>
          <PlayerAvatar
            look={character}
            palette={character === "mira" ? miraPalette : leoPalette}
            motion={motionAnimRef}
          />
        </group>

        {/* Partner Character in Co-op */}
        {partnerState && (
          <group
            position={partnerState.position}
            rotation={[0, partnerState.rotationY, 0]}
          >
            <PlayerAvatar
              look={partnerState.character}
              palette={partnerState.character === "mira" ? miraPalette : leoPalette}
              motion={0.2}
            />
          </group>
        )}

        {/* Frame Physics / Step Loop */}
        <ScenePhysicsLoop
          inputRef={inputRef}
          position={position}
          setPosition={setPosition}
          setRotationY={setRotationY}
          setSpeedKmh={setSpeedKmh}
          motionAnimRef={motionAnimRef}
        />
      </Canvas>

      {/* GTA-Themed HUD (Top, Map, Weapons, Wanted, Missions) */}
      <GtaHud
        cash={cash}
        wantedLevel={wantedLevel}
        health={100}
        armor={100}
        currentWeapon={currentWeapon}
        onCycleWeapon={handleCycleWeapon}
        character={character}
        onSwitchCharacter={handleSwitchCharacter}
        activeRoom={roomCode}
        onOpenCoop={() => setCoopModalOpen(true)}
        onOpenMap={() => setMapOpen(true)}
        speedKmh={speedKmh}
        hotspotNotice={hotspotNotice}
        currentMission={currentMission}
        missionDistanceMeters={missionDistMeters}
        partnerDistanceMeters={partnerDistMeters}
        policeDistanceMeters={policeDistMeters}
        bustedBanner={bustedBanner}
        bustedFine={bustedFine}
        activeOutfitId={activeOutfitId}
        ownedOutfitIds={ownedOutfitIds}
        ownedWeaponIds={ownedWeaponIds}
        onBuyOutfit={handleBuyOutfit}
        onBuyWeapon={handleBuyWeapon}
      />

      {/* Mobile Touch Controls Overlay */}
      <div className="pointer-events-none absolute inset-0 z-30 flex justify-between items-end p-4 pb-6">
        {/* Virtual Joystick */}
        <div
          className="pointer-events-auto relative w-32 h-32 rounded-full bg-black/40 border border-white/20 backdrop-blur-md flex items-center justify-center touch-none shadow-xl"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-white/30 text-xs font-bold uppercase tracking-wider">
            Move
          </div>
          <div
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 shadow-lg border border-white/60 transition-transform"
            style={{
              transform: `translate(${touchPos.x}px, ${touchPos.y}px)`,
            }}
          />
        </div>

        {/* Action Buttons */}
        <div className="pointer-events-auto flex flex-col items-end gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSwitchCharacter}
              className="w-13 h-13 rounded-full bg-slate-900/80 border border-white/20 text-white font-bold text-xs uppercase flex items-center justify-center backdrop-blur-md active:scale-95 shadow-lg"
            >
              {character === "mira" ? "Leo" : "Mira"}
            </button>
            <button
              type="button"
              onClick={handleCycleWeapon}
              className="w-13 h-13 rounded-full bg-slate-900/80 border border-white/20 text-amber-400 font-bold text-xs uppercase flex items-center justify-center backdrop-blur-md active:scale-95 shadow-lg"
            >
              GUN
            </button>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onTouchStart={() => {
                inputRef.current.sprint = true;
                setSprintHeld(true);
              }}
              onTouchEnd={() => {
         inputRef.current.sprint = false;
                setSprintHeld(false);
              }}
              className={`w-16 h-16 rounded-full font-black text-sm uppercase flex items-center justify-center border shadow-xl backdrop-blur-md active:scale-95 ${
                sprintHeld
                  ? "bg-amber-500 text-black border-amber-300 ring-4 ring-amber-400/50"
                  : "bg-slate-900/80 text-white border-white/30"
              }`}
            >
              SPRINT
            </button>

            <button
              type="button"
              onClick={() => {
                inputRef.current.jump = true;
                setTimeout(() => {
                  inputRef.current.jump = false;
                }, 200);
              }}
              className="w-16 h-16 rounded-full bg-gradient-to-tr from-rose-600 to-amber-600 text-white font-black text-sm uppercase flex items-center justify-center border border-white/40 shadow-xl backdrop-blur-md active:scale-95"
            >
              JUMP
            </button>
          </div>
        </div>
      </div>

      {/* 2-Player Co-op Room Modal */}
{coopModalOpen && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-white/20 rounded-2xl p-6 text-white shadow-2xl relative">
            <button
              type="button"
              onClick={() => setCoopModalOpen(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3 text-rose-400 mb-2">
              <Users className="w-6 h-6" />
              <h2 className="text-xl font-black uppercase tracking-wider">Two-Player Co-Op</h2>
            </div>
            <p className="text-sm text-neutral-300 mb-6">
              Share the room code with your partner to explore Our City together in real-time.
            </p>

            {roomCode ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-black/50 border border-amber-400/30 flex items-center justify-between">
                  <div>
<div className="text-xs uppercase text-amber-400 font-bold tracking-wider">
                      Your Private Room Code
                    </div>
                    <div className="text-3xl font-black font-mono tracking-widest text-white mt-1">
                      {roomCode}
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      void navigator.clipboard.writeText(roomCode);
                      setCopyFeedback(true);
                      setTimeout(() => setCopyFeedback(false), 2000);
                    }}
                    className="bg-amber-500 hover:bg-amber-600 text-black font-bold"
                  >
                    {copyFeedback ? "Copied!" : <Copy className="w-4 h-4" />}
                  </Button>
                </div>

                <div className="text-xs text-emerald-400 font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {partnerState ? "Partner connected in city!" : "Waiting for partner to join..."}
                </div>

                <Button
                  onClick={() => {
                    setRoomCode(null);
                    setPartnerState(null);
                  }}
                  variant="outline"
className="w-full border-red-500 text-red-400 hover:bg-red-500/20"
                >
                  Leave Room
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Button
                  onClick={() => setRoomCode(createRoomCode())}
                  className="w-full h-12 bg-gradient-to-r from-amber-500 to-rose-500 text-black font-black uppercase tracking-wider"
                >
                  Create New Room
                </Button>

                <div className="relative flex items-center justify-center my-4">
                  <span className="bg-neutral-900 px-3 text-xs uppercase text-neutral-400">or</span>
                  <div className="absolute inset-0 flex items-center -z-10">
                    <div className="w-full border-t border-white/10" />
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="ENTER 4-LETTER CODE"
                    value={joinInput}
                    onChange={(e) => 
setJoinInput(e.target.value.toUpperCase())}
                    className="flex-1 bg-black/60 border border-white/20 rounded-xl px-4 text-center font-mono font-black text-lg text-white uppercase focus:border-amber-400 outline-none"
                    />
                  <Button
                    onClick={() => {
                      const code = normalizeRoomCode(joinInput);
                      if (code) {
                        setRoomCode(code);
                        setCoopModalOpen(false);
                      }
                    }}
                    className="bg-white hover:bg-white/90 text-black font-bold px-6"
                  >
                    Join
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
)}

      {/* Full City Satellite Map Overlay */}
      {mapOpen && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-lg p-4 sm:p-8 text-white">
          <div className="flex items-center justify-between border-b border-white/15 pb-4">
            <div className="flex items-center gap-3">
              <Compass className="w-7 h-7 text-amber-400" />
              <div>
                <h1 className="text-xl font-black uppercase tracking-wider">Satellite GPS Radar</h1>
                <p className="text-xs text-white/60">Our City – Vice Island Territory</p>
              </div>
            </div>
            <button
type="button"
              onClick={() => setMapOpen(false)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 my-6 flex items-center justify-center">
            <div className="relative w-full max-w-lg aspect-square rounded-2xl bg-neutral-900 border-2 border-white/20 overflow-hidden shadow-2xl flex items-center justify-center">
              {/* Radar Grid Lines */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15)_0,transparent_70%)]" />
              <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 border border-white/5 pointer-events-none" />

              {/* Player marker */}
              <div
className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_12px_rgba(34,211,238,1)] z-10"
                style={{
                  left: `${50 + (position[0] / 80) * 45}%`,
                  top: `${50 + (position[2] / 80) * 45}%`,
                }}
              />

              {/* Mission target marker */}
              <div
                className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 bg-amber-400 rotate-45 border-2 border-white shadow-[0_0_15px_rgba(251,191,36,1)] animate-bounce z-10"
                style={{
                  left: `${50 + (currentMission.targetPos[0] / 80) * 45}%`,
                  top: `${50 + (currentMission.targetPos[2] / 80) * 45}%`,
                }}
              />

              {/* Police car marker */}
              {wantedLevel > 0 && (
                <div
                  className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600 border-2 border-white shadow-[0_0_15px_rgba(239,68,68,1)] animate-ping z-10"
                  style={{
                    left: `${50 + (policePosRef.current[0] / 80) * 45}%`,
                    top: `${50 + (policePosRef.current[2] / 80) * 45}%`,
                  }}
                />
              )}

              {/* Partner marker */}
              {partnerState && (
                <div
                  className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-500 border-2 border-white shadow-[0_0_12px_rgba(236,72,153,1)] z-10"
                  style={{
                    left: `${50 + (partnerState.position[0] / 80) * 45}%`,
                    top: `${50 + (partnerState.position[2] / 80) * 45}%`,
                  }}
                />
              )}
            </div>
          </div>
        <div className="flex flex-wrap items-center justify-around gap-4 bg-white/5 p-4 rounded-xl border border-white/10 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-cyan-400" /> You ({character})
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rotate-45 bg-amber-400" /> Mission Target
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-600" /> Police Patrol
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-pink-500" /> Partner
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// Physics & Movement Step Runner
function ScenePhysicsLoop({
  inputRef,
  position,
  setPosition,
  setRotationY,
  setSpeedKmh,
  motionAnimRef,
}: {
  inputRef: React.MutableRefObject<MovementInput>;
  position: [number, number, number];
  setPosition: React.Dispatch<React.SetStateAction<[number, number, number]>>;
  setRotationY: React.Dispatch<React.SetStateAction<number>>;
  motionAnimRef: React.MutableRefObject<number>;
  setSpeedKmh: React.Dispatch<React.SetStateAction<number>>;
}) {
  const currentPos = useRef<[number, number, number]>(position);
  currentPos.current = position;

  const currentRotY = useRef(0);
  const currentSpeed = useRef(0);
  const currentVelocityY = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const step = computeMovementStep({
      currentPosition: currentPos.current,
      currentRotationY: currentRotY.current,
      currentSpeed: currentSpeed.current,
      velocityY: currentVelocityY.current,
      input: inputRef.current,
      deltaSeconds: dt,
    });

    currentRotY.current = step.nextRotationY;
    currentSpeed.current = step.nextSpeed;
    currentVelocityY.current = step.nextVelocityY;

    setPosition(step.nextPosition);
    setRotationY(step.nextRotationY);
    setSpeedKmh(Math.round(step.nextSpeed * 3.6));
    motionAnimRef.current = step.motion;
  });

  return null;
  }
