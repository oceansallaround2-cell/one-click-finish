import { Canvas, useFrame } from "@react-three/fiber";
import { Button } from "@/components/ui/button";
import { CityWorld, type CityPalette } from "@/game/scene/CityWorld";
import { PlayerAvatar, type AvatarPalette, type PlayerLook } from "@/game/scene/PlayerAvatar";
import { cameraRelativeDirection, moveFromJoystick, moveFromKeyboard, type MoveInput } from "@/game/sim/movement";
import {
  ArrowUpRight,
  Check,
  ChevronUp,
  Heart,
  Map as MapIcon,
  MapPin,
  Navigation,
  RotateCcw,
  Sparkles,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group, Vector3 } from "three";

type GamePalette = CityPalette & AvatarPalette & { sun: string };
type GameCamera = { yaw: number; pitch: number };
type HudSnapshot = { x: number; z: number; distance: number; canInteract: boolean };

interface SoloSaveData {
  look: PlayerLook;
  completed: boolean;
  position: { x: number; z: number };
  savedAt: number;
}

const STORAGE_KEY = "our_city_solo_save_v1";
const GOAL = { x: 0, z: -73 };

function loadSoloSave(): SoloSaveData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SoloSaveData;
  } catch {
    return null;
  }
}

function saveSoloProgress(data: Partial<SoloSaveData>) {
  if (typeof window === "undefined") return;
  try {
    const existing = loadSoloSave() || {
      look: "mira" as PlayerLook,
      completed: false,
      position: { x: 0, z: 12 },
      savedAt: Date.now(),
    };
    const updated: SoloSaveData = {
      ...existing,
      ...data,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Storage might be full or restricted
  }
}

function cssSwatch(name: string): string {
  if (typeof document === "undefined") return "#ffffff";
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return getComputedStyle(document.documentElement).color || "#ffffff";
  context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#ffffff";
  context.fillRect(0, 0, 1, 1);
  const pixel = context.getImageData(0, 0, 1, 1).data;
  return `#${[pixel[0], pixel[1], pixel[2]].map((part) => (part ?? 0).toString(16).padStart(2, "0")).join("")}`;
}

function readPalette(): GamePalette {
  return {
    sky: cssSwatch("--game-scene-sky") || "#f48c68",
    ground: cssSwatch("--game-scene-ground") || "#1b2432",
    road: cssSwatch("--game-scene-road") || "#151b24",
    roadMark: cssSwatch("--game-scene-road-mark") || "#ffd166",
    buildingA: cssSwatch("--game-scene-building-a") || "#2e3846",
    buildingB: cssSwatch("--game-scene-building-b") || "#3f4d5f",
    buildingC: cssSwatch("--game-scene-building-c") || "#ef476f",
    window: cssSwatch("--game-scene-window") || "#ffd166",
    foliage: cssSwatch("--game-scene-foliage") || "#06d6a0",
    trunk: cssSwatch("--game-scene-trunk") || "#8d5b4c",
    water: cssSwatch("--game-scene-water") || "#118ab2",
    shore: cssSwatch("--game-scene-shore") || "#f9d77e",
    coral: cssSwatch("--game-coral") || "#ff758f",
    skin: cssSwatch("--game-scene-skin") || "#f4c29f",
    hair: cssSwatch("--game-scene-hair") || "#2b2d42",
    jacket: cssSwatch("--game-scene-jacket") || "#ef476f",
    dress: cssSwatch("--game-scene-dress") || "#ff758f",
    shirt: cssSwatch("--game-scene-shirt") || "#ffffff",
    jewelry: cssSwatch("--game-scene-jewelry") || "#ffd166",
    shoe: cssSwatch("--game-scene-shoe") || "#1b2432",
    eye: cssSwatch("--game-scene-eye") || "#1b2432",
    sun: cssSwatch("--game-scene-sun") || "#ffa07a",
  };
}

function PlayerController({
  palette,
  look,
  initialPosition,
  movement,
  sprinting,
  jumpPending,
  cameraRig,
  missionDone,
  onHud,
}: {
  palette: GamePalette;
  look: PlayerLook;
  initialPosition: { x: number; z: number };
  movement: { current: MoveInput };
  sprinting: { current: boolean };
  jumpPending: { current: boolean };
  cameraRig: { current: GameCamera };
  missionDone: { current: boolean };
  onHud: (snapshot: HudSnapshot) => void;
}) {
  const player = useRef<Group>(null);
  const verticalSpeed = useRef(0);
  const motion = useRef(0);
  const elapsed = useRef(0);
  const saveInterval = useRef(0);
  const cameraTarget = useMemo(() => new Vector3(), []);
  const desiredCamera = useMemo(() => new Vector3(), []);
  const direction = useMemo(() => new Vector3(), []);

  useEffect(() => {
    if (player.current) {
      player.current.position.x = initialPosition.x;
      player.current.position.z = initialPosition.z;
    }
  }, [initialPosition]);

  useFrame(({ camera }, frameDelta) => {
    const delta = Math.min(frameDelta, 0.05);
    const actor = player.current;
    if (!actor) return;

    const facing = cameraRig.current;
    const input = movement.current;
    const move = cameraRelativeDirection(input, facing.yaw);
    const active = Math.hypot(input.x, input.y) > 0.05;
    const pace = sprinting.current ? 7.3 : 4.25;
    motion.current = active ? (sprinting.current ? 1.35 : 0.9) : 0;

    if (active) {
      direction.set(move.x, 0, move.z);
      actor.position.x = Math.max(-105, Math.min(105, actor.position.x + direction.x * pace * delta));
      actor.position.z = Math.max(-108, Math.min(108, actor.position.z + direction.z * pace * delta));
      const targetRotation = Math.atan2(direction.x, direction.z);
      const angleDelta = Math.atan2(Math.sin(targetRotation - actor.rotation.y), Math.cos(targetRotation - actor.rotation.y));
      actor.rotation.y += angleDelta * (1 - Math.exp(-12 * delta));
    }

    if (jumpPending.current) {
      if (actor.position.y <= 0.02) verticalSpeed.current = 6.4;
      jumpPending.current = false;
    }
    verticalSpeed.current -= 17 * delta;
    actor.position.y = Math.max(0, actor.position.y + verticalSpeed.current * delta);
    if (actor.position.y === 0) verticalSpeed.current = 0;

    cameraTarget.set(actor.position.x, actor.position.y + 1.02, actor.position.z);
    const radius = 8.8;
    desiredCamera.set(
      cameraTarget.x + Math.sin(facing.yaw) * radius,
      cameraTarget.y + 3.7 + facing.pitch * 4.4,
      cameraTarget.z + Math.cos(facing.yaw) * radius,
    );
    camera.position.lerp(desiredCamera, 1 - Math.exp(-5.5 * delta));
    camera.lookAt(cameraTarget);

    elapsed.current += delta;
    if (elapsed.current > 0.18) {
      elapsed.current = 0;
      const distance = Math.hypot(actor.position.x - GOAL.x, actor.position.z - GOAL.z);
      onHud({
        x: actor.position.x,
        z: actor.position.z,
        distance,
        canInteract: distance < 4.5 && !missionDone.current,
      });
    }

    // Auto-save player coordinates to local storage every ~3 seconds
    saveInterval.current += delta;
    if (saveInterval.current > 3.0) {
      saveInterval.current = 0;
      saveSoloProgress({ position: { x: actor.position.x, z: actor.position.z } });
    }
  });

  return (
    <group ref={player} position={[initialPosition.x, 0, initialPosition.z]}>
      <PlayerAvatar look={look} palette={palette} motion={motion} />
    </group>
  );
}

function PointerLook({
  cameraRig,
  children,
}: {
  cameraRig: { current: GameCamera };
  children: React.ReactNode;
}) {
  const pointerId = useRef<number | null>(null);
  const lastPoint = useRef({ x: 0, y: 0 });

  return (
    <div
      className="game-look-layer"
      aria-hidden="true"
      onPointerDown={(event) => {
        pointerId.current = event.pointerId;
        lastPoint.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (pointerId.current !== event.pointerId) return;
        const deltaX = event.clientX - lastPoint.current.x;
        const deltaY = event.clientY - lastPoint.current.y;
        lastPoint.current = { x: event.clientX, y: event.clientY };
        cameraRig.current.yaw -= deltaX * 0.006;
        cameraRig.current.pitch = Math.max(-0.18, Math.min(0.65, cameraRig.current.pitch + deltaY * 0.003));
      }}
      onPointerUp={(event) => {
        pointerId.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        pointerId.current = null;
      }}
    >
      {children}
    </div>
  );
}

export function GameView() {
  const palette = useMemo(() => readPalette(), []);
  const movement = useRef<MoveInput>({ x: 0, y: 0 });
  const keys = useRef(new Set<string>());
  const sprinting = useRef(false);
  const jumpPending = useRef(false);
  const cameraRig = useRef<GameCamera>({ yaw: 0, pitch: 0.16 });
  const missionDone = useRef(false);

  // Restore saved offline progress
  const [initialData] = useState(() => loadSoloSave());
  const initialPos = initialData?.position || { x: 0, z: 12 };

  const hudRef = useRef<HudSnapshot>({
    x: initialPos.x,
    z: initialPos.z,
    distance: Math.hypot(initialPos.x - GOAL.x, initialPos.z - GOAL.z),
    canInteract: false,
  });

  const [look, setLook] = useState<PlayerLook>(initialData?.look || "mira");
  const [hud, setHud] = useState(hudRef.current);
  const [completed, setCompleted] = useState(Boolean(initialData?.completed));
  const [mapOpen, setMapOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const stickPointer = useRef<number | null>(null);
  const stickElement = useRef<HTMLDivElement>(null);

  // Sync mission done ref
  useEffect(() => {
    missionDone.current = completed;
  }, [completed]);

  // Online / Offline listener
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

  const onHud = useCallback((snapshot: HudSnapshot) => {
    hudRef.current = snapshot;
    setHud(snapshot);
  }, []);

  const completeMission = useCallback(() => {
    if (!hudRef.current.canInteract || missionDone.current) return;
    missionDone.current = true;
    setCompleted(true);
    saveSoloProgress({ completed: true });
    setHud((current) => ({ ...current, canInteract: false }));
  }, []);

  const handleLookChange = (nextLook: PlayerLook) => {
    setLook(nextLook);
    saveSoloProgress({ look: nextLook });
  };

  const resetSoloProgress = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
      keys.current.add(event.code);
      movement.current = moveFromKeyboard(keys.current);
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") sprinting.current = true;
      if (event.code === "Space" && !event.repeat) jumpPending.current = true;
      if (event.code === "KeyE" && !event.repeat) completeMission();
      if (event.code === "KeyM" && !event.repeat) setMapOpen((open) => !open);
      if (event.code === "Escape") setMapOpen(false);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keys.current.delete(event.code);
      movement.current = moveFromKeyboard(keys.current);
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") sprinting.current = false;
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [completeMission]);

  const updateStick = (clientX: number, clientY: number) => {
    const element = stickElement.current;
    if (!element) return;
    const bounds = element.getBoundingClientRect();
    const rawX = (clientX - (bounds.left + bounds.width / 2)) / (bounds.width * 0.34);
    const rawY = (bounds.top + bounds.height / 2 - clientY) / (bounds.height * 0.34);
    const next = moveFromJoystick(rawX, rawY);
    movement.current = next;
    setStick(next);
  };

  const mapPlayerLeft = Math.max(3, Math.min(97, 50 + (hud.x / 220) * 100));
  const mapPlayerTop = Math.max(3, Math.min(97, 50 + (hud.z / 220) * 100));
  const mapGoalTop = Math.max(3, Math.min(97, 50 + (GOAL.z / 220) * 100));

  return (
    <main className="our-city" aria-label="Our City playable world">
      <div className="game-canvas" data-scene-ready={ready ? "true" : undefined}>
        <Canvas
          shadows
          dpr={[1, 1.35]}
          camera={{ position: [0, 5, 21], fov: 56, near: 0.1, far: 250 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.setClearColor(palette.sky);
            setReady(true);
          }}
        >
          <color attach="background" args={[palette.sky]} />
          <fog attach="fog" args={[palette.sky, 92, 220]} />
          <hemisphereLight intensity={1.25} color={palette.sun} groundColor={palette.ground} />
          <ambientLight intensity={0.66} />
          <directionalLight
            position={[-48, 55, 34]}
            color={palette.sun}
            intensity={2.45}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-left={-70}
            shadow-camera-right={70}
            shadow-camera-top={70}
            shadow-camera-bottom={-70}
          />
          <CityWorld palette={palette} />
          <PlayerController
            palette={palette}
            look={look}
            initialPosition={initialPos}
            movement={movement}
            sprinting={sprinting}
            jumpPending={jumpPending}
            cameraRig={cameraRig}
            missionDone={missionDone}
            onHud={onHud}
          />
        </Canvas>
      </div>

      <PointerLook cameraRig={cameraRig}>
        <div className="game-look-indicator">
          <RotateCcw aria-hidden="true" /> <span>LOOK</span>
        </div>
      </PointerLook>

      <header className="game-topbar">
        <div className="game-brand-lockup">
          <div className="game-brand-mark">
            <Heart aria-hidden="true" fill="currentColor" />
          </div>
          <div className="game-brand-type">
            <span>OUR CITY</span>
            <small>A WORLD FOR TWO</small>
          </div>
        </div>

        {/* Solo & Offline/Online Status Badge */}
        <div className="game-evening-badge">
          <span className="game-live-dot" />
          <span>SOLO MODE</span>
          <i />
          <small className="flex items-center gap-1">
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3 inline" /> ONLINE
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 inline" /> OFFLINE READY
              </>
            )}
          </small>
        </div>

        <div className="game-top-actions">
          <div className="game-character-switch" role="group" aria-label="Choose a character">
            <Button
              type="button"
              variant="ghost"
              aria-pressed={look === "mira"}
              className={`game-character-option${look === "mira" ? " is-selected" : ""}`}
              onClick={() => handleLookChange("mira")}
            >
              Mira
            </Button>
            <Button
              type="button"
              variant="ghost"
              aria-pressed={look === "leo"}
              className={`game-character-option${look === "leo" ? " is-selected" : ""}`}
              onClick={() => handleLookChange("leo")}
            >
              Leo
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="game-icon-button"
            aria-label="Open city map"
            title="Open city map"
            onClick={() => setMapOpen(true)}
          >
            <MapIcon aria-hidden="true" />
          </Button>
        </div>
      </header>

      <section className="game-minimap" aria-label="Mini-map showing your position and the lookout">
        <div className="game-minimap-ring" />
        <div className="game-map-blocks" />
        <div className="game-map-route" />
        <div className="game-map-destination" style={{ left: "50%", top: `${mapGoalTop}%` }} />
        <div className="game-map-player" style={{ left: `${mapPlayerLeft}%`, top: `${mapPlayerTop}%` }} />
        <span className="game-minimap-north">N</span>
        <span className="game-minimap-name">SP</span>
      </section>

      <section className={`game-mission${completed ? " is-complete" : ""}`} aria-live="polite">
        <div className="game-mission-heading">
          <span className="game-mission-index">01</span>
          <span className="game-mission-kicker">SOLO EXPEDITION</span>
          {completed ? (
            <Check className="game-mission-complete" aria-label="Complete" />
          ) : (
            <Sparkles className="game-mission-spark" aria-hidden="true" />
          )}
        </div>
        <h1>{completed ? "Lookout reached & saved." : "Meet me at the lookout."}</h1>
        <p>
          {completed
            ? "Your progress is saved locally. Explore freely!"
            : hud.canInteract
            ? "A little closer now."
            : "Follow the lights above the water."}
        </p>
        {!completed && hud.canInteract && (
          <Button type="button" variant="default" className="game-arrive-button" onClick={completeMission}>
            Arrive together <ArrowUpRight aria-hidden="true" />
          </Button>
        )}
      </section>

      <div className="game-mobile-controls" aria-label="Touch controls">
        <div
          ref={stickElement}
          className={`game-joystick${stickPointer.current !== null ? " is-active" : ""}`}
          role="application"
          aria-label="Movement joystick"
          onPointerDown={(event) => {
            event.preventDefault();
            stickPointer.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
            updateStick(event.clientX, event.clientY);
          }}
          onPointerMove={(event) => {
            if (stickPointer.current === event.pointerId) updateStick(event.clientX, event.clientY);
          }}
          onPointerUp={(event) => {
            if (stickPointer.current !== event.pointerId) return;
            stickPointer.current = null;
            movement.current = { x: 0, y: 0 };
            setStick({ x: 0, y: 0 });
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            stickPointer.current = null;
            movement.current = { x: 0, y: 0 };
            setStick({ x: 0, y: 0 });
          }}
        >
          <span className="game-joystick-center">
            <span style={{ left: `${50 + stick.x * 27}%`, top: `${50 - stick.y * 27}%` }} />
          </span>
          <span className="game-joystick-arrow">
            <ChevronUp aria-hidden="true" />
          </span>
        </div>
        <div className="game-action-controls">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={'game-action-button game-sprint-button${sprinting.current ? " is-pressed" : ""}`}

            aria-label="Sprint"

            title="Sprint"

            onPointerDown={(event) => {

              event.preventDefault();

              sprinting.current = true;

            }}

            onPointerUp={() => {

              sprinting.current = false;

            }}

            onPointerLeave={() => {

              sprinting.current = false;

            }}

            onPointerCancel={() => {

              sprinting.current = false;

            }}

          >

            <Zap aria-hidden="true" />

          </Button>

          <Button

            type="button"

            variant="ghost"

            size="icon"

            className="game-action-button game-jump-button"

            aria-label="Jump"

            title="Jump"

            onClick={() => {

              jumpPending.current = true;

            }}

          >

            <ChevronUp aria-hidden="true" />

          </Button>

          {hud.canInteract && (

            <Button

              type="button"

              variant="default"

              size="icon"

              className="game-action-button game-interact-button"

              aria-label="Arrive together"

              title="Arrive together"

              onClick={completeMission}

            >

              <Heart aria-hidden="true" />

            </Button>

          )}

        </div>

      </div>



      {mapOpen && (

        <div

          className="game-map-overlay"

          role="presentation"

          onMouseDown={(event) => {

            if (event.target === event.currentTarget) setMapOpen(false);

          }}

        >

          <section className="game-map-panel" role="dialog" aria-modal="true" aria-labelledby="game-map-title">

            <div className="game-map-panel-heading">

              <div>

                <span className="game-map-eyebrow">CITY GUIDE · SOUTHPOINT</span>

                <h2 id="game-map-title">The waterfront</h2>

              </div>

              <Button

                type="button"

                variant="ghost"

                size="icon"

                className="game-icon-button"

                aria-label="Close map"

                onClick={() => setMapOpen(false)}

              >

                <X aria-hidden="true" />

              </Button>

            </div>

            <div className="game-large-map">

              <div className="game-large-map-grid" />

              <div className="game-large-map-road game-large-map-road-a" />

              <div className="game-large-map-road game-large-map-road-b" />

              <div className="game-large-map-road game-large-map-road-c" />

              <div className="game-large-map-water" />

              <div className="game-large-map-route" />

              <div className="game-large-map-pin game-large-map-pin-start">

                <Navigation aria-hidden="true" />

              </div>

              <div className="game-large-map-pin game-large-map-pin-goal">

                <MapPin aria-hidden="true" />

              </div>

              <span className="game-large-map-label label-district">SOUTHPOINT</span>

              <span className="game-large-map-label label-marina">THE MARINA</span>

              <span className="game-large-map-label label-lookout">SUNSET LOOKOUT</span>

            </div>

            <div className="game-map-legend">

              <span>

                <i className="legend-player" /> YOU

              </span>

              <span>

                <i className="legend-destination" /> TONIGHT’S PLAN

              </span>

              <span className="game-map-distance">{Math.max(0, Math.round(hud.distance))} m away</span>

            </div>



            <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center text-xs text-white/60">

              <span>Solo save: Auto-saved</span>

              <button

                type="button"

                onClick={resetSoloProgress}

                className="text-red-400 hover:underline cursor-pointer"

              >

                Reset Solo Progress

              </button>

            </div>

          </section>

        </div>

      )}

    </main>

  );

  }
