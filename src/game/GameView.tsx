
import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
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
        senderName: character === "mira" ? "Mira" : "Leo",
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
      name: character === "mira" ? "Mira" : "Leo",
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
        onOpenCoop={() => setCoopModalOpen(true
