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
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group, Vector3 } from "three";

type GamePalette = CityPalette & AvatarPalette & { sun: string };
type GameCamera = { yaw: number; pitch: number };
type HudSnapshot = { x: number; z: number; distance: number; canInteract: boolean };

const GOAL = { x: 0, z: -73 };

function cssSwatch(name: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return getComputedStyle(document.documentElement).color;
  context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  context.fillRect(0, 0, 1, 1);
  const pixel = context.getImageData(0, 0, 1, 1).data;
  return `#${[pixel[0], pixel[1], pixel[2]].map((part) => (part ?? 0).toString(16).padStart(2, "0")).join("")}`;
}

function readPalette(): GamePalette {
  return {
    sky: cssSwatch("--game-scene-sky"),
    ground: cssSwatch("--game-scene-ground"),
    road: cssSwatch("--game-scene-road"),
    roadMark: cssSwatch("--game-scene-road-mark"),
    buildingA: cssSwatch("--game-scene-building-a"),
    buildingB: cssSwatch("--game-scene-building-b"),
    buildingC: cssSwatch("--game-scene-building-c"),
    window: cssSwatch("--game-scene-window"),
    foliage: cssSwatch("--game-scene-foliage"),
    trunk: cssSwatch("--game-scene-trunk"),
    water: cssSwatch("--game-scene-water"),
    shore: cssSwatch("--game-scene-shore"),
    coral: cssSwatch("--game-coral"),
    skin: cssSwatch("--game-scene-skin"),
    hair: cssSwatch("--game-scene-hair"),
    jacket: cssSwatch("--game-scene-jacket"),
    dress: cssSwatch("--game-scene-dress"),
    shirt: cssSwatch("--game-scene-shirt"),
    jewelry: cssSwatch("--game-scene-jewelry"),
    shoe: cssSwatch("--game-scene-shoe"),
    eye: cssSwatch("--game-scene-eye"),
    sun: cssSwatch("--game-scene-sun"),
  };
}

function PlayerController({
  palette,
  look,
  movement,
  sprinting,
  jumpPending,
  cameraRig,
  missionDone,
  onHud,
}: {
  palette: GamePalette;
  look: PlayerLook;
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
  const cameraTarget = useMemo(() => new Vector3(), []);
  const desiredCamera = useMemo(() => new Vector3(), []);
  const direction = useMemo(() => new Vector3(), []);

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
  });

  return (
    <group ref={player} position={[0, 0, 12]}>
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
  const hudRef = useRef<HudSnapshot>({ x: 0, z: 12, distance: 85, canInteract: false });
  const [look, setLook] = useState<PlayerLook>("mira");
  const [hud, setHud] = useState(hudRef.current);
  const [completed, setCompleted] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const stickPointer = useRef<number | null>(null);
  const stickElement = useRef<HTMLDivElement>(null);

  const onHud = useCallback((snapshot: HudSnapshot) => {
    hudRef.current = snapshot;
    setHud(snapshot);
  }, []);

  const completeMission = useCallback(() => {
    if (!hudRef.current.canInteract || missionDone.current) return;
    missionDone.current = true;
    setCompleted(true);
    setHud((current) => ({ ...current, canInteract: false }));
  }, []);

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
    const rawY = ((bounds.top + bounds.height / 2) - clientY) / (bounds.height * 0.34);
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
        <div className="game-look-indicator"><RotateCcw aria-hidden="true" /> <span>LOOK</span></div>
      </PointerLook>

      <header className="game-topbar">
        <div className="game-brand-lockup">
          <div className="game-brand-mark"><Heart aria-hidden="true" fill="currentColor" /></div>
          <div className="game-brand-type">
            <span>OUR CITY</span>
            <small>A WORLD FOR TWO</small>
          </div>
        </div>
        <div className="game-evening-badge">
          <span className="game-live-dot" />
          <span>SOUTHPOINT</span>
          <i />
          <small>GOLDEN HOUR</small>
        </div>
        <div className="game-top-actions">
          <div className="game-character-switch" role="group" aria-label="Choose a character">
            <Button
              type="button"
              variant="ghost"
              aria-pressed={look === "mira"}
              className={`game-character-option${look === "mira" ? " is-selected" : ""}`}
              onClick={() => setLook("mira")}
            >
              Mira
            </Button>
            <Button
              type="button"
              variant="ghost"
              aria-pressed={look === "leo"}
              className={`game-character-option${look === "leo" ? " is-selected" : ""}`}
              onClick={() => setLook("leo")}
            >
              Leo
            </Button>
          </div>
          <Button type="button" variant="ghost" size="icon" className="game-icon-button" aria-label="Open city map" title="Open city map" onClick={() => setMapOpen(true)}>
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
          <span className="game-mission-kicker">AN EVENING FOR TWO</span>
          {completed ? <Check className="game-mission-complete" aria-label="Complete" /> : <Sparkles className="game-mission-spark" aria-hidden="true" />}
        </div>
        <h1>{completed ? "The view was worth it." : "Meet me at the lookout."}</h1>
        <p>{completed ? "Southpoint is yours for the evening." : hud.canInteract ? "A little closer now." : "Follow the lights above the water."}</p>
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
          <span className="game-joystick-center"><span style={{ left: `${50 + stick.x * 27}%`, top: `${50 - stick.y * 27}%` }} /></span>
          <span className="game-joystick-arrow"><ChevronUp aria-hidden="true" /></span>
        </div>
        <div className="game-action-controls">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`game-action-button game-sprint-button${sprinting.current ? " is-pressed" : ""}`}
            aria-label="Sprint"
            title="Sprint"
            onPointerDown={(event) => {
              event.preventDefault();
              sprinting.current = true;
            }}
            onPointerUp={() => { sprinting.current = false; }}
            onPointerLeave={() => { sprinting.current = false; }}
            onPointerCancel={() => { sprinting.current = false; }}
          >
            <Zap aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="game-action-button game-jump-button" aria-label="Jump" title="Jump" onClick={() => { jumpPending.current = true; }}>
            <ChevronUp aria-hidden="true" />
          </Button>
          {hud.canInteract && (
            <Button type="button" variant="default" size="icon" className="game-action-button game-interact-button" aria-label="Arrive together" title="Arrive together" onClick={completeMission}>
              <Heart aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {mapOpen && (
        <div className="game-map-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMapOpen(false); }}>
          <section className="game-map-panel" role="dialog" aria-modal="true" aria-labelledby="game-map-title">
            <div className="game-map-panel-heading">
              <div>
                <span className="game-map-eyebrow">CITY GUIDE · SOUTHPOINT</span>
                <h2 id="game-map-title">The waterfront</h2>
              </div>
              <Button type="button" variant="ghost" size="icon" className="game-icon-button" aria-label="Close map" onClick={() => setMapOpen(false)}>
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
              <div className="game-large-map-pin game-large-map-pin-start"><Navigation aria-hidden="true" /></div>
              <div className="game-large-map-pin game-large-map-pin-goal"><MapPin aria-hidden="true" /></div>
              <span className="game-large-map-label label-district">SOUTHPOINT</span>
              <span className="game-large-map-label label-marina">THE MARINA</span>
              <span className="game-large-map-label label-lookout">SUNSET LOOKOUT</span>
            </div>
            <div className="game-map-legend">
              <span><i className="legend-player" /> YOU</span>
              <span><i className="legend-destination" /> TONIGHT’S PLAN</span>
              <span className="game-map-distance">{Math.max(0, Math.round(hud.distance))} m away</span>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
