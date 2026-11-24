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
  jacket: "#334b68",
  dress: "#d987a8",
  shirt: "#f5eee5",
  jewelry: "#e8c46a",
  shoe: "#292b35",
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
  motion?: { current: number };
}) {
  const look = requestedLook ?? character ?? "mira";
  const palette = suppliedPalette ?? DEFAULT_AVATAR_PALETTE;
  const motion = suppliedMotion ?? { current: 0 };
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const female = look === "mira";

  useFrame(({ clock }, delta) => {
    const amount = motion.current;
    const swing = Math.sin(clock.elapsedTime * 10) * amount * 0.48;
    const ease = 1 - Math.exp(-8 * delta);
    if (leftLeg.current) leftLeg.current.rotation.x += (swing - leftLeg.current.rotation.x) * ease;
    if (rightLeg.current) rightLeg.current.rotation.x += (-swing - rightLeg.current.rotation.x) * ease;
    if (leftArm.current) leftArm.current.rotation.x += (-swing * 0.72 - leftArm.current.rotation.x) * ease;
    if (rightArm.current) rightArm.current.rotation.x += (swing * 0.72 - rightArm.current.rotation.x) * ease;
    if (torso.current) torso.current.position.y = 0.92 + Math.abs(swing) * 0.035;
  });

  return (
    <group>
      <group ref={torso} position={[0, 0.92, 0]}>
        <mesh castShadow position={[0, 0.08, 0]}>
          <capsuleGeometry args={[0.29, 0.49, 5, 12]} />
          <meshStandardMaterial color={female ? palette.dress : palette.jacket} roughness={0.78} />
        </mesh>
        <mesh castShadow position={[0, 0.36, 0]}>
          <capsuleGeometry args={[0.25, 0.18, 4, 12]} />
          <meshStandardMaterial color={palette.shirt} roughness={0.8} />
        </mesh>
        {female ? (
          <mesh castShadow position={[0, -0.24, 0]}>
            <coneGeometry args={[0.37, 0.56, 12]} />
            <meshStandardMaterial color={palette.dress} roughness={0.86} />
          </mesh>
        ) : (
          <mesh castShadow position={[0, 0.05, 0.2]}>
            <boxGeometry args={[0.48, 0.24, 0.035]} />
            <meshStandardMaterial color={palette.jewelry} metalness={0.45} roughness={0.38} />
          </mesh>
        )}
        <mesh castShadow position={[0, 0.69, 0]}>
          <sphereGeometry args={[0.24, 20, 18]} />
          <meshStandardMaterial color={palette.skin} roughness={0.82} />
        </mesh>
        <mesh castShadow position={[0, 0.86, -0.035]} scale={female ? [1.12, 0.76, 1.18] : [1.04, 0.7, 1.04]}>
          <sphereGeometry args={[0.24, 16, 14]} />
          <meshStandardMaterial color={palette.hair} roughness={0.9} />
        </mesh>
        {female ? (
          <>
            <mesh castShadow position={[-0.2, 0.48, -0.015]} scale={[0.13, 0.44, 0.16]}>
              <sphereGeometry args={[1, 14, 12]} />
              <meshStandardMaterial color={palette.hair} roughness={0.9} />
            </mesh>
            <mesh castShadow position={[0.2, 0.48, -0.015]} scale={[0.13, 0.44, 0.16]}>
              <sphereGeometry args={[1, 14, 12]} />
              <meshStandardMaterial color={palette.hair} roughness={0.9} />
            </mesh>
            <mesh position={[-0.205, 0.58, 0.18]}>
              <sphereGeometry args={[0.035, 10, 8]} />
              <meshStandardMaterial color={palette.jewelry} metalness={0.5} roughness={0.32} />
            </mesh>
            <mesh position={[0.205, 0.58, 0.18]}>
              <sphereGeometry args={[0.035, 10, 8]} />
              <meshStandardMaterial color={palette.jewelry} metalness={0.5} roughness={0.32} />
            </mesh>
          </>
        ) : (
          <mesh castShadow position={[0, 0.58, -0.005]} scale={[0.25, 0.2, 0.22]}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshStandardMaterial color={palette.hair} roughness={0.94} />
          </mesh>
        )}
        <mesh position={[-0.085, 0.7, 0.205]}>
          <sphereGeometry args={[0.024, 8, 8]} />
          <meshStandardMaterial color={palette.eye} />
        </mesh>
        <mesh position={[0.085, 0.7, 0.205]}>
          <sphereGeometry args={[0.024, 8, 8]} />
          <meshStandardMaterial color={palette.eye} />
        </mesh>
        <group ref={leftArm} position={[-0.34, 0.28, 0]}>
          <mesh castShadow position={[0, -0.2, 0]} rotation={[0.14, 0, -0.08]}>
            <capsuleGeometry args={[0.085, 0.35, 4, 8]} />
            <meshStandardMaterial color={female ? palette.dress : palette.jacket} roughness={0.8} />
          </mesh>
          <mesh castShadow position={[0, -0.43, 0]}>
            <sphereGeometry args={[0.075, 10, 8]} />
            <meshStandardMaterial color={palette.skin} roughness={0.86} />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.34, 0.28, 0]}>
          <mesh castShadow position={[0, -0.2, 0]} rotation={[0.14, 0, 0.08]}>
            <capsuleGeometry args={[0.085, 0.35, 4, 8]} />
            <meshStandardMaterial color={female ? palette.dress : palette.jacket} roughness={0.8} />
          </mesh>
          <mesh castShadow position={[0, -0.43, 0]}>
            <sphereGeometry args={[0.075, 10, 8]} />
            <meshStandardMaterial color={palette.skin} roughness={0.86} />
          </mesh>
        </group>
      </group>
      <group ref={leftLeg} position={[-0.13, 0.5, 0]}>
        <mesh castShadow position={[0, -0.26, 0]}>
          <capsuleGeometry args={[0.105, 0.34, 4, 8]} />
          <meshStandardMaterial color={female ? palette.dress : palette.jacket} roughness={0.84} />
        </mesh>
        <mesh castShadow position={[0, -0.5, 0.055]} scale={[1, 0.58, 1.45]}>
          <sphereGeometry args={[0.11, 10, 8]} />
          <meshStandardMaterial color={palette.shoe} roughness={0.76} />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.13, 0.5, 0]}>
        <mesh castShadow position={[0, -0.26, 0]}>
          <capsuleGeometry args={[0.105, 0.34, 4, 8]} />
          <meshStandardMaterial color={female ? palette.dress : palette.jacket} roughness={0.84} />
        </mesh>
        <mesh castShadow position={[0, -0.5, 0.055]} scale={[1, 0.58, 1.45]}>
          <sphereGeometry args={[0.11, 10, 8]} />
          <meshStandardMaterial color={palette.shoe} roughness={0.76} />
        </mesh>
      </group>
    </group>
  );
}
