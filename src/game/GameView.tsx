import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { getCharacterDisplayName } from "./net/room";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  CharacterId,
  RoomPlayerState,
  createRoomCode,
  normalizeRoomCode,
  canJoinRoom,
  parseRoomPlayer,
} from "./net/room";
import {
  MovementInput,
  computeMovementStep,
  clampJoystickInput,
  createInitialMovementInput,
} from "./sim/movement";
import { PlayerAvatar } from "./scene/PlayerAvatar";
import { CityWorld } from "./scene/CityWorld";
import {
  GtaCityFeatures,
  playGunshotSound,
  playChatNotificationSound,
} from "./scene/GtaCityFeatures";
import {
  GtaHud,
  OUTFIT_CATALOG,
  WEAPON_CATALOG,
  OutfitItem,
  WeaponInfo,
  MissionInfo,
} from "./GtaHud";
import { CoopChat, ChatMessage } from "./CoopChat";
import { supabase } from "@/integrations/supabase/client";
import { Users, X, Copy, Navigation, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "our_city_solo_save_v2";

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

const COUPLE_MISSIONS: MissionInfo[] = [
  {
    id: "sunset_drive",
    title: "Ocean Drive Sunset Rendezvous",
    description: "Drive along the palm coastline to the sunset overlook terrace.",
    targetPos: [28, 0.6, 25],
    reward: 250,
  },
  {
    id: "cafe_date",
    title: "Neon Café Espresso Break",
    description: "Meet your partner at the sidewalk patio for tropical mocktails.",
    targetPos: [-15, 0.6, 12],
    reward: 300,
  },
  {
    id: "penthouse_escape",
    title: "Villa Sanctuary Sanctuary",
    description: "Head to the private beach villa to lay low from the police patrol.",
    targetPos: [0, 0.6, -30],
    reward: 450,
  },
  {
    id: "boardwalk_stroll",
    title: "Marina Boardwalk Stroll",
    description: "Walk together by the harbor yachts and collect the gold bounty.",
    targetPos: [32, 0.6, -15],
    reward: 500,
  },
  {
    id: "skyline_overlook",
    title: "Emerald Plaza Rooftop Summit",
    description: "Reach the central high-rise district overlooking all of Our City.",
    targetPos: [-22, 0.6, -20],
    reward: 750,
  },
];

function loadSoloSave(): SoloSaveData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SoloSaveData>;
    if (
      parsed.version === 2 &&
      (parsed.character === "mira" || parsed.character === "leo") &&
      Array.isArray(parsed.position) &&
      parsed.position.length === 3 &&
      parsed.position.every((n) => typeof n === "number" && Number.isFinite(n)) &&
      typeof parsed.rotationY === "number" &&
      Number.isFinite(parsed.rotationY)
    ) {
      return parsed as SoloSaveData;
    }
  } catch {}
  return null;
}

function saveSoloProgress(data: SoloSaveData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

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
  const [bustedFine, setBustedFine] = useState(100);
  const policePosRef = useRef<[number, number, number]>([18, 0.35, 22]);

  // Drivable Sports Car state
  const carPosRef = useRef<[number, number, number]>([8, 0.35, 16]);
  const [isDrivingCar, setIsDrivingCar] = useState(false);

  // Online Multiplayer Co-op State
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomInput, setRoomInput] = useState("");
  const [coopModalOpen, setCoopModalOpen] = useState(false);
  const [partnerState, setPartnerState] = useState<RoomPlayerState | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Co-Op Live Chat State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [lastChatMessage, setLastChatMessage] = useState<ChatMessage | null>(null);

  // UI Modals
  const [mapOpen, setMapOpen] = useState(false);
  const [hotspotNotice, setHotspotNotice] = useState<string | null>(null);

  // Controls & Physics
  const inputRef = useRef<MovementInput>(createInitialMovementInput());
  const motionAnimRef = useRef<number>(0);
  const [touchPos, setTouchPos] = useState({ x: 0, y: 0 });
  const [touchActive, setTouchActive] = useState(false);
  const [sprintHeld, setSprintHeld] = useState(false);
  const touchOriginRef = useRef({ x: 0, y: 0 });

  const currentOutfit = useMemo(
    () => OUTFIT_CATALOG.find((o) => o.id === activeOutfitId) ?? OUTFIT_CATALOG[0]!,
    [activeOutfitId]
  );

  const miraPalette = useMemo(
    () => ({
      skin: "#f4c29f",
      hair: "#1a120b",
      dress: currentOutfit.miraColor,
      jacket: "#22272e",
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
      shirt: currentOutfit.id === "glamour" ? "#f8fafc" : "#18181b",
      jewelry: currentOutfit.id === "glamour" ? "#e8c46a" : "#c4c9d0",
      shoe: "#1f2937",
      eye: "#49332c",
    }),
    [currentOutfit]
  );

  const currentWeapon = useMemo(
    () => WEAPON_CATALOG.find((w) => w.id === activeWeaponId) ?? WEAPON_CATALOG[0]!,
    [activeWeaponId]
  );

  // Auto-save to LocalStorage
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

  // Distance calculations
  const missionDistMeters = useMemo(() => {
    const dx = position[0] - currentMission.targetPos[0];
    const dz = position[2] - currentMission.targetPos[2];
    return Math.hypot(dx, dz);
  }, [position, currentMission]);

  const partnerDistMeters = useMemo(() => {
    if (!partnerState) return null;
    const dx = position[0] - partnerState.position[0];
    const dz = position[2] - partnerState.position[2];
    return Math.hypot(dx, dz);
  }, [position, partnerState]);

  const policeDistMeters = useMemo(() => {
    const dx = position[0] - policePosRef.current[0];
    const dz = position[2] - policePosRef.current[2];
    return Math.hypot(dx, dz);
  }, [position]);

  // Car proximity
  const distToCar = useMemo(() => {
    const dx = position[0] - carPosRef.current[0];
    const dz = position[2] - carPosRef.current[2];
    return Math.hypot(dx, dz);
  }, [position]);

  const isNearCar = distToCar < 3.2 && !isDrivingCar;

  const handleToggleCar = useCallback(() => {
    if (isDrivingCar) {
      setIsDrivingCar(false);
      setHotspotNotice("Exited Sports Car");
      setTimeout(() => setHotspotNotice(null), 1800);
    } else if (isNearCar) {
      setIsDrivingCar(true);
      setHotspotNotice("Entered Sports Car (45 KM/H)");
      setTimeout(() => setHotspotNotice(null), 1800);
    }
  }, [isDrivingCar, isNearCar]);

  // Weapon Firing
  const handleShoot = useCallback(() => {
    if (currentWeapon.id === "fists") return;
    playGunshotSound();

    if (Math.random() > 0.6) {
      setWantedLevel((prev) => Math.min(5, prev + 1));
    }

    if (roomCode) {
      const channelName = `our_city_room_${roomCode}`;
      const channel = supabase.channel(channelName);
      void channel.send({
        type: "broadcast",
        event: "player_shoot",
        payload: { sender: character },
      });
    }
  }, [currentWeapon, roomCode, character]);

  // Mission Objective Check
  useEffect(() => {
    if (missionDistMeters < 3.5) {
      setCash((c) => c + currentMission.reward);
      setMissionIndex((idx) => idx + 1);
      setHotspotNotice(`Mission Completed! +$${currentMission.reward}`);
      setTimeout(() => setHotspotNotice(null), 3000);
    }
  }, [missionDistMeters, currentMission]);

  // Coin Pickup Handler
  const handleCollectCoin = useCallback((coinId: number, reward: number) => {
    setCash((c) => c + reward);
    setCollectedCoinIds((prev) => (prev.includes(coinId) ? prev : [...prev, coinId]));
    setHotspotNotice(`+$${reward} Bounty Found!`);
    setTimeout(() => setHotspotNotice(null), 1500);
  }, []);

  // Police Busted Handler
  const handleBusted = useCallback(() => {
    setBustedBanner(true);
    const fine = Math.min(cash, 150);
    setBustedFine(fine);
    setCash((c) => Math.max(0, c - fine));
    setWantedLevel(0);
    setIsDrivingCar(false);

    setTimeout(() => {
      setPosition([0, 0.9, -30]);
      setBustedBanner(false);
    }, 3200);
  }, [cash]);

  // Chat Send Handler
  const handleSendChatMessage = useCallback(
    (text: string) => {
      const newMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        sender: character,
        senderName: getCharacterDisplayName(character),
        text,
        timestamp: Date.now(),
      };
      setChatMessages((prev) => [...prev, newMsg]);

      if (roomCode) {
        const channelName = `our_city_room_${roomCode}`;
        const channel = supabase.channel(channelName);
        void channel.send({
          type: "broadcast",
          event: "chat_message",
          payload: newMsg,
        });
      }
    },
    [character, roomCode]
  );

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
      .on("broadcast", { event: "chat_message" }, ({ payload }) => {
        if (payload && payload.sender !== character) {
          const msg = payload as ChatMessage;
          setChatMessages((prev) => [...prev, msg]);
          playChatNotificationSound();
          setLastChatMessage(msg);
          setUnreadChatCount((prev) => prev + 1);
        }
      })
      .on("broadcast", { event: "player_shoot" }, ({ payload }) => {
        if (payload && payload.sender !== character) {
          playGunshotSound();
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
      name: getCharacterDisplayName(character),
      character,
      position,
      rotationY,
      wantedLevel,
      activity: isDrivingCar ? "walking" : wantedLevel > 0 ? "wanted" : "walking",
      missionIndex,
      activeOutfitId,
      activeWeaponId,
    };

    void channel.send({
      type: "broadcast",
      event: "player_move",
      payload,
    });
  }, [
    position,
    rotationY,
    roomCode,
    character,
    wantedLevel,
    isDrivingCar,
    missionIndex,
    activeOutfitId,
    activeWeaponId,
  ]);

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
      if (e.key === " " && !inputRef.current.jump) {
        inputRef.current.jump = true;
        setTimeout(() => {
          inputRef.current.jump = false;
        }, 200);
      }
      if (e.key === "e" || e.key === "E") {
        handleToggleCar();
      }
      if (e.key === "f" || e.key === "F") {
        handleShoot();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
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
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [handleToggleCar, handleShoot]);

  const handleSwitchCharacter = () => {
    setCharacter((c) => (c === "mira" ? "leo" : "mira"));
  };

  const handleCycleWeapon = () => {
    const idx = WEAPON_CATALOG.findIndex((w) => w.id === activeWeaponId);
    const nextIdx = (idx + 1) % WEAPON_CATALOG.length;
    setActiveWeaponId(WEAPON_CATALOG[nextIdx]!.id);
  };

  const handleBuyOutfit = (outfit: OutfitItem) => {
    if (!ownedOutfitIds.includes(outfit.id)) {
      if (cash < outfit.price) return;
      setCash((c) => c - outfit.price);
      setOwnedOutfitIds((prev) => [...prev, outfit.id]);
    }
    setActiveOutfitId(outfit.id);
  };

  const handleBuyWeapon = (weapon: WeaponInfo) => {
    if (!ownedWeaponIds.includes(weapon.id)) {
      if (cash < weapon.price) return;
      setCash((c) => c - weapon.price);
      setOwnedWeaponIds((prev) => [...prev, weapon.id]);
    }
    setActiveWeaponId(weapon.id);
  };

  // Touch Joystick
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchOriginRef.current = { x: touch.clientX, y: touch.clientY };
    setTouchActive(true);
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
          isDrivingCar={isDrivingCar}
          playerRotationY={rotationY}
          carPosRef={carPosRef}
        />

        {/* Local Player Character (hidden when inside closed car) */}
        {!isDrivingCar && (
          <group position={position} rotation={[0, rotationY, 0]}>
            <PlayerAvatar
              look={character}
              palette={character === "mira" ? miraPalette : leoPalette}
              motion={motionAnimRef}
            />
          </group>
        )}

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
          isDrivingCar={isDrivingCar}
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
        onOpenChat={() => {
          setChatOpen(true);
          setUnreadChatCount(0);
        }}
        unreadChatCount={unreadChatCount}
        isNearCar={isNearCar}
        isDrivingCar={isDrivingCar}
        onToggleCar={handleToggleCar}
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

        {/* Action Button Cluster */}
        <div className="pointer-events-auto flex flex-col gap-3 items-end">
          <div className="flex gap-2">
            {/* Drive / Exit Car Button */}
            {(isNearCar || isDrivingCar) && (
              <button
                type="button"
                onClick={handleToggleCar}
                className="w-13 h-13 rounded-full bg-sky-600 border border-sky-400 text-white font-black text-xs uppercase flex items-center justify-center backdrop-blur-md active:scale-95 shadow-xl animate-pulse"
              >
                {isDrivingCar ? "EXIT" : "DRIVE"}
              </button>
            )}

            {/* Fire Button (When Weapon Equipped) */}
            {currentWeapon.id !== "fists" && (
              <button
                type="button"
                onClick={handleShoot}
                className="w-13 h-13 rounded-full bg-rose-600 border border-rose-400 text-white font-black text-xs uppercase flex items-center justify-center backdrop-blur-md active:scale-95 shadow-xl"
              >
                FIRE
              </button>
            )}

            <button
              type="button"
              onClick={handleSwitchCharacter}
              className="w-13 h-13 rounded-full bg-slate-900/80 border border-white/20 text-white font-bold text-xs uppercase flex items-center justify-center backdrop-blur-md active:scale-95 shadow-lg"
            >
              {character === "mira" ? "Priyanshu" : "Sidrah"}
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

      {/* 2-Player Co-op Chat Overlay */}
      <CoopChat
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        character={character}
        activeRoom={roomCode}
        messages={chatMessages}
        onSendMessage={handleSendChatMessage}
        unreadCount={unreadChatCount}
        onOpen={() => {
          setChatOpen(true);
          setUnreadChatCount(0);
        }}
        lastMessage={lastChatMessage}
      />

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
                  onClick={() => {
                    const code = createRoomCode();
                    setRoomCode(code);
                  }}
                  className="w-full bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold py-6 text-base shadow-lg"
                >
                  Create New Room
                </Button>

                <div className="relative flex items-center justify-center my-4">
                  <div className="absolute inset-0 flex items-center -z-10">
                    <div className="w-full border-t border-white/20" />
                  </div>
                  <span className="bg-neutral-900 px-3 text-xs uppercase tracking-wider text-neutral-400">
                    or join partner
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={4}
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                    placeholder="ENTER 4-LETTER CODE"
                    className="flex-1 bg-black/60 border border-white/20 rounded-xl px-4 text-center font-mono font-black text-lg text-white uppercase focus:border-amber-400 outline-none"
                  />
                  <Button
                    onClick={() => {
                      const normalized = normalizeRoomCode(roomInput);
                      if (normalized) {
                        setRoomCode(normalized);
                        setRoomInput("");
                      }
                    }}
                    disabled={!normalizeRoomCode(roomInput)}
                    className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-6"
                  >
                    Join
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Screen GPS Map Overlay */}
      {mapOpen && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md text-white">
          <div className="relative w-full max-w-2xl bg-zinc-900 border border-white/20 rounded-2xl p-6 shadow-2xl flex flex-col h-[85vh]">
            <div className="flex items-center justify-between border-b border-white/15 pb-4">
              <div className="flex items-center gap-3">
                <Navigation className="w-6 h-6 text-amber-400" />
                <h2 className="text-xl font-black uppercase tracking-wider">Satellite GPS Radar</h2>
              </div>
              <button
                type="button"
                onClick={() => setMapOpen(false)}
                className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 my-6 flex items-center justify-center">
              <div className="relative w-full max-w-lg aspect-square rounded-2xl bg-neutral-900 border-2 border-white/20 overflow-hidden shadow-2xl flex items-center justify-center">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15)_0,transparent_70%)]" />

                {/* Grid Lines */}
                <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 border border-white/5 pointer-events-none">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} className="border border-white/5" />
                  ))}
                </div>

                {/* You */}
                <div
                  className="absolute w-4 h-4 rounded-full bg-emerald-400 border-2 border-white shadow-[0_0_12px_rgba(52,211,153,1)] transform -translate-x-1/2 -translate-y-1/2 z-30"
                  style={{
                    left: `${50 + (position[0] / 80) * 40}%`,
                    top: `${50 + (position[2] / 80) * 40}%`,
                  }}
                />

                {/* Partner in Co-op */}
                {partnerState && (
                  <div
                    className="absolute w-4 h-4 rounded-full bg-pink-500 border-2 border-white shadow-[0_0_12px_rgba(236,72,153,1)] transform -translate-x-1/2 -translate-y-1/2 z-30 animate-pulse"
                    style={{
                      left: `${50 + (partnerState.position[0] / 80) * 40}%`,
                      top: `${50 + (partnerState.position[2] / 80) * 40}%`,
                    }}
                  />
                )}

                {/* Police Cruiser */}
                {wantedLevel > 0 && (
                  <div
                    className="absolute w-4 h-4 rounded-full bg-red-600 border-2 border-white shadow-[0_0_14px_rgba(239,68,68,1)] transform -translate-x-1/2 -translate-y-1/2 z-30 animate-ping"
                    style={{
                      left: `${50 + (policePosRef.current[0] / 80) * 40}%`,
                      top: `${50 + (policePosRef.current[2] / 80) * 40}%`,
                    }}
                  />
                )}

                {/* Sports Car */}
                <div
                  className="absolute w-3 h-3 rounded-full bg-sky-400 border border-white shadow-[0_0_8px_rgba(56,189,248,1)] transform -translate-x-1/2 -translate-y-1/2 z-20"
                  style={{
                    left: `${50 + (carPosRef.current[0] / 80) * 40}%`,
                    top: `${50 + (carPosRef.current[2] / 80) * 40}%`,
                  }}
                />

                {/* Mission Objective */}
                <div
                  className="absolute w-4 h-4 rounded-full bg-amber-400 border-2 border-white shadow-[0_0_12px_rgba(251,191,36,1)] transform -translate-x-1/2 -translate-y-1/2 z-20 animate-bounce"
                  style={{
                    left: `${50 + (currentMission.targetPos[0] / 80) * 40}%`,
                    top: `${50 + (currentMission.targetPos[2] / 80) * 40}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-around gap-4 bg-white/5 p-4 rounded-xl border border-white/10 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
                <span>You</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-pink-500" />
                <span>Partner (💖)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <span>Mission Objective</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-sky-400" />
                <span>Sports Car</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-600" />
                <span>Police Pursuit</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ScenePhysicsLoop({
  inputRef,
  position,
  setPosition,
  setRotationY,
  setSpeedKmh,
  motionAnimRef,
  isDrivingCar,
}: {
  inputRef: React.MutableRefObject<MovementInput>;
  position: [number, number, number];
  setPosition: React.Dispatch<React.SetStateAction<[number, number, number]>>;
  setRotationY: React.Dispatch<React.SetStateAction<number>>;
  motionAnimRef: React.MutableRefObject<number>;
  setSpeedKmh: React.Dispatch<React.SetStateAction<number>>;
  isDrivingCar: boolean;
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

    const speedMultiplier = isDrivingCar ? 2.4 : 1;
    const finalSpeed = step.nextSpeed * speedMultiplier;

    currentRotY.current = step.nextRotationY;
    currentSpeed.current = step.nextSpeed;
    currentVelocityY.current = step.nextVelocityY;

    if (isDrivingCar && (inputRef.current.moveX !== 0 || inputRef.current.moveZ !== 0)) {
      const forwardX = Math.sin(step.nextRotationY) * finalSpeed * dt;
      const forwardZ = Math.cos(step.nextRotationY) * finalSpeed * dt;
      setPosition([
        currentPos.current[0] + forwardX,
        step.nextPosition[1],
        currentPos.current[2] + forwardZ,
      ]);
    } else {
      setPosition(step.nextPosition);
    }

    setRotationY(step.nextRotationY);
    setSpeedKmh(Math.round(finalSpeed * 3.6));
    motionAnimRef.current = step.motion;
  });

  return null;
}
