import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

export type PlayerLook = "mira" | "leo";

export type AvatarPalette = {
  skin: string;
  hair: string;
  jacket: string;
  dress: string;
  shirt: string;
  jewelry: string;
  shoe: string;
  eye: string;
};

const DEFAULT_AVATAR_PALETTE: AvatarPalette = {
  skin: "#e8b99b",
  hair: "#38251f",
  jacket: "#22272e",
  dress: "#781b2b",
  shirt: "#f5eee5",
  jewelry: "#e8c46a",
  shoe: "#1f2937",
  eye: "#49332c",
};

export function PlayerAvatar({
  look: requestedLook,
  character,
  palette: suppliedPalette,
  motion: suppliedMotion,
}: {
  look?: PlayerLook;
  character?: PlayerLook;
  palette?: AvatarPalette;
  motion?: { current: number } | { current: { current: number } } | number;
}) {
  const look = requestedLook ?? character ?? "mira";
  const palette = suppliedPalette ?? DEFAULT_AVATAR_PALETTE;
  const sidrah = look === "mira";
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const torso = useRef<Group>(null);

  useFrame(({ clock }, delta) => {
    let amount = 0;
    if (typeof suppliedMotion === "number") {
      amount = suppliedMotion;
    } else if (suppliedMotion && typeof suppliedMotion.current === "number") {
      amount = suppliedMotion.current;
    } else if (suppliedMotion && typeof suppliedMotion.current === "object") {
      amount = suppliedMotion.current.current;
    }

    if (!Number.isFinite(amount)) amount = 0;

    const swing = Math.sin(clock.elapsedTime * 10) * amount * 0.48;
    const ease = 1 - Math.exp(-8 * Math.min(delta, 0.1));

    if (leftLeg.current) leftLeg.current.rotation.x += (swing - leftLeg.current.rotation.x) * ease;
    if (rightLeg.current) rightLeg.current.rotation.x += (-swing - rightLeg.current.rotation.x) * ease;
    if (leftArm.current) leftArm.current.rotation.x += (-swing * 0.72 - leftArm.current.rotation.x) * ease;
    if (rightArm.current) rightArm.current.rotation.x += (swing * 0.72 - rightArm.current.rotation.x) * ease;
    if (torso.current) torso.current.position.y = 0.92 + Math.abs(swing) * 0.035;
  });

  return (
    <group>
      <group ref={torso} position={[0, 0.92, 0]}>
        {/* Sidrah's maroon embroidered dress / Priyanshu's black jacket */}
        <mesh castShadow position={[0, 0.08, 0]}>
          <capsuleGeometry args={[0.29, 0.49, 5, 12]} />
          <meshStandardMaterial color={sidrah ? palette.dress : palette.jacket} roughness={0.78} />
        </mesh>
        <mesh castShadow position={[0, 0.36, 0]}>
          <capsuleGeometry args={[0.25, 0.18, 4, 12]} />
          <meshStandardMaterial color={sidrah ? palette.dress : palette.shirt} roughness={0.8} />
        </mesh>

        {sidrah ? (
          <>
            <mesh castShadow position={[0, -0.24, 0]}>
              <coneGeometry args={[0.37, 0.56, 12]} />
              <meshStandardMaterial color={palette.dress} roughness={0.86} />
            </mesh>

            {/* Gold embroidery across the bodice and the front of the skirt */}
            <group>
              {Array.from({ length: 7 }, (_, index) => {
                const x = (index - 3) * 0.045;
                const y = 0.28 + Math.abs(index - 3) * 0.018;
                return (
                  <mesh key={`bodice-${index}`} position={[x, y, 0.267]} scale={[0.8, 1.35, 0.7]}>
                    <sphereGeometry args={[0.025, 8, 6]} />
                    <meshStandardMaterial color={palette.jewelry} metalness={0.48} roughness={0.34} />
                  </mesh>
                );
              })}
              {[-0.37, -0.46].flatMap((y, row) =>
                [-0.15, -0.075, 0, 0.075, 0.15].map((x, column) => {
                  const frontDepth = 0.37 * ((0.04 - y) / 0.56) + 0.014;
                  return (
                    <mesh
                      key={`skirt-${row}-${column}`}
                      position={[x, y, frontDepth]}
                      scale={[1, 1.2, 0.6]}
                    >
                      <sphereGeometry args={[0.022, 8, 6]} />
                      <meshStandardMaterial color={palette.jewelry} metalness={0.48} roughness={0.34} />
                    </mesh>
                  );
                })
              )}
              <mesh position={[0, 0.31, 0.255]}>
                <torusGeometry args={[0.145, 0.012, 6, 24]} />
                <meshStandardMaterial color={palette.jewelry} metalness={0.55} roughness={0.3} />
              </mesh>
            </group>
          </>
        ) : (
          <>
            {/* Open-jacket front, pockets, silver zip and chain */}
            <mesh position={[-0.13, 0.24, 0.244]} rotation={[0, 0, -0.12]}>
              <boxGeometry args={[0.105, 0.34, 0.025]} />
              <meshStandardMaterial color={palette.jacket} roughness={0.62} />
            </mesh>
            <mesh position={[0.13, 0.24, 0.244]} rotation={[0, 0, 0.12]}>
              <boxGeometry args={[0.105, 0.34, 0.025]} />
              <meshStandardMaterial color={palette.jacket} roughness={0.62} />
            </mesh>
            <mesh position={[0.21, 0.08, 0.256]}>
              <boxGeometry args={[0.13, 0.09, 0.018]} />
              <meshStandardMaterial color={palette.jacket} roughness={0.6} />
            </mesh>
            <mesh position={[0.205, 0.25, 0.263]}>
              <boxGeometry args={[0.014, 0.29, 0.012]} />
              <meshStandardMaterial color={palette.jewelry} metalness={0.62} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.29, 0.268]}>
              <torusGeometry args={[0.13, 0.011, 6, 24]} />
              <meshStandardMaterial color={palette.jewelry} metalness={0.7} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.14, 0.295]}>
              <boxGeometry args={[0.055, 0.075, 0.018]} />
              <meshStandardMaterial color={palette.jewelry} metalness={0.68} roughness={0.28} />
            </mesh>
          </>
        )}

        {/* Head */}
        <mesh castShadow position={[0, 0.69, 0]}>
          <sphereGeometry args={[0.24, 20, 18]} />
          <meshStandardMaterial color={palette.skin} roughness={0.82} />
        </mesh>

        {/* Hair silhouette and distinctive styling */}
        <mesh castShadow position={[0, 0.86, -0.035]} scale={sidrah ? [1.12, 0.76, 1.18] : [1.04, 0.76, 1.04]}>
          <sphereGeometry args={[0.24, 16, 14]} />
          <meshStandardMaterial color={palette.hair} roughness={0.9} />
        </mesh>
        {sidrah ? (
          <>
            {/* Long, loose dark hair falling behind her shoulders */}
            <mesh castShadow position={[0, 0.08, -0.14]} scale={[0.32, 0.56, 0.2]}>
              <sphereGeometry args={[1, 16, 14]} />
              <meshStandardMaterial color={palette.hair} roughness={0.92} />
            </mesh>
            <mesh castShadow position={[-0.21, 0.14, 0.18]} rotation={[0, 0, -0.08]}>
              <capsuleGeometry args={[0.105, 0.58, 6, 10]} />
              <meshStandardMaterial color={palette.hair} roughness={0.9} />
            </mesh>
            <mesh castShadow position={[0.21, 0.14, 0.18]} rotation={[0, 0, 0.08]}>
              <capsuleGeometry args={[0.105, 0.58, 6, 10]} />
              <meshStandardMaterial color={palette.hair} roughness={0.9} />
            </mesh>
            {/* Deep-maroon hair bow and pearl-drop earrings */}
            <mesh castShadow position={[-0.22, 0.69, -0.15]} scale={[0.18, 0.13, 0.07]}>
              <sphereGeometry args={[1, 12, 10]} />
              <meshStandardMaterial color={palette.dress} roughness={0.82} />
            </mesh>
            <mesh castShadow position={[-0.31, 0.7, -0.15]} scale={[0.1, 0.14, 0.065]} rotation={[0, 0, -0.45]}>
              <sphereGeometry args={[1, 12, 10]} />
              <meshStandardMaterial color={palette.dress} roughness={0.82} />
            </mesh>
            {[-0.205, 0.205].map((x) => (
              <group key={`earring-${x}`} position={[x, 0.58, 0.18]}>
                <mesh>
                  <sphereGeometry args={[0.026, 10, 8]} />
                  <meshStandardMaterial color={palette.jewelry} metalness={0.52} roughness={0.3} />
                </mesh>
                <mesh position={[0, -0.055, 0]}>
                  <coneGeometry args={[0.035, 0.085, 8]} />
                  <meshStandardMaterial color={palette.jewelry} metalness={0.52} roughness={0.3} />
                </mesh>
                <mesh position={[0, -0.11, 0.006]}>
                  <sphereGeometry args={[0.024, 10, 8]} />
                  <meshStandardMaterial color={palette.shirt} roughness={0.3} />
                </mesh>
              </group>
            ))}
          </>
        ) : (
          <>
            {/* Short, softly tousled dark hair */}
            {[-0.13, 0, 0.13].map((x, index) => (
              <mesh
                key={`hair-wave-${index}`}
                castShadow
                position={[x, 0.91 + (index === 1 ? 0.035 : 0), 0.035]}
                scale={[0.62, 0.4, 0.48]}
              >
                <sphereGeometry args={[0.17, 12, 10]} />
                <meshStandardMaterial color={palette.hair} roughness={0.9} />
              </mesh>
            ))}
            {/* Subtle beard and sideburns */}
            <mesh castShadow position={[0, 0.535, 0.16]} scale={[0.76, 0.34, 0.34]}>
              <sphereGeometry args={[0.17, 14, 10]} />
              <meshStandardMaterial color={palette.hair} roughness={0.96} />
            </mesh>
            {[-0.205, 0.205].map((x) => (
              <mesh key={`sideburn-${x}`} position={[x, 0.61, 0.06]} scale={[0.45, 0.8, 0.5]}>
                <sphereGeometry args={[0.07, 10, 8]} />
                <meshStandardMaterial color={palette.hair} roughness={0.94} />
              </mesh>
            ))}
          </>
        )}

        {/* Eyes */}
        <mesh position={[-0.085, 0.7, 0.205]}>
          <sphereGeometry args={[0.024, 8, 8]} />
          <meshStandardMaterial color={palette.eye} />
        </mesh>
        <mesh position={[0.085, 0.7, 0.205]}>
          <sphereGeometry args={[0.024, 8, 8]} />
          <meshStandardMaterial color={palette.eye} />
        </mesh>

        {/* Left Arm */}
        <group ref={leftArm} position={[-0.34, 0.28, 0]}>
          <mesh castShadow position={[0, -0.2, 0]} rotation={[0.14, 0, -0.08]}>
            <capsuleGeometry args={[0.085, 0.35, 4, 8]} />
            <meshStandardMaterial color={sidrah ? palette.dress : palette.jacket} roughness={0.8} />
          </mesh>
          <mesh castShadow position={[0, -0.43, 0]}>
            <sphereGeometry args={[0.075, 10, 8]} />
            <meshStandardMaterial color={palette.skin} roughness={0.86} />
          </mesh>
        </group>

        {/* Right Arm */}
        <group ref={rightArm} position={[0.34, 0.28, 0]}>
          <mesh castShadow position={[0, -0.2, 0]} rotation={[0.14, 0, 0.08]}>
            <capsuleGeometry args={[0.085, 0.35, 4, 8]} />
            <meshStandardMaterial color={sidrah ? palette.dress : palette.jacket} roughness={0.8} />
          </mesh>
          <mesh castShadow position={[0, -0.43, 0]}>
            <sphereGeometry args={[0.075, 10, 8]} />
            <meshStandardMaterial color={palette.skin} roughness={0.86} />
          </mesh>
        </group>
      </group>

      {/* Legs */}
      <group ref={leftLeg} position={[-0.13, 0.5, 0]}>
        <mesh castShadow position={[0, -0.26, 0]}>
          <capsuleGeometry args={[0.105, 0.34, 4, 8]} />
          <meshStandardMaterial color={sidrah ? palette.dress : palette.jacket} roughness={0.84} />
        </mesh>
        <mesh castShadow position={[0, -0.5, 0.055]} scale={[1, 0.58, 1.45]}>
          <sphereGeometry args={[0.11, 10, 8]} />
          <meshStandardMaterial color={palette.shoe} roughness={0.76} />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.13, 0.5, 0]}>
        <mesh castShadow position={[0, -0.26, 0]}>
          <capsuleGeometry args={[0.105, 0.34, 4, 8]} />
          <meshStandardMaterial color={sidrah ? palette.dress : palette.jacket} roughness={0.84} />
        </mesh>
        <mesh castShadow position={[0, -0.5, 0.055]} scale={[1, 0.58, 1.45]}>
          <sphereGeometry args={[0.11, 10, 8]} />
          <meshStandardMaterial color={palette.shoe} roughness={0.76} />
        </mesh>
      </group>
    </group>
  );
}