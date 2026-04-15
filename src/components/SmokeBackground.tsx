import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const SmokeParticle = ({ position, speed, scale, opacity }: { position: [number, number, number]; speed: number; scale: number; opacity: number }) => {
  const ref = useRef<THREE.Mesh>(null);
  const startY = position[1];

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * speed;
    ref.current.position.y = startY + Math.sin(t) * 0.5 + (t % 8) * 0.3;
    ref.current.position.x = position[0] + Math.sin(t * 0.7) * 0.8;
    ref.current.rotation.z = t * 0.1;
    const cycle = (t % 8) / 8;
    ref.current.material.opacity = cycle < 0.3 ? cycle / 0.3 * opacity : cycle > 0.7 ? (1 - cycle) / 0.3 * opacity : opacity;
  });

  return (
    <mesh ref={ref} position={position}>
      <planeGeometry args={[scale, scale]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
};

const SmokeField = () => {
  const particles = useMemo(() => 
    Array.from({ length: 25 }, (_, i) => ({
      position: [
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 8 - 2,
        (Math.random() - 0.5) * 4,
      ] as [number, number, number],
      speed: 0.15 + Math.random() * 0.25,
      scale: 2 + Math.random() * 4,
      opacity: 0.015 + Math.random() * 0.03,
    })),
    []
  );

  return (
    <>
      {particles.map((p, i) => (
        <SmokeParticle key={i} {...p} />
      ))}
    </>
  );
};

const SmokeBackground = () => (
  <div className="fixed inset-0 z-0 pointer-events-none">
    <Canvas camera={{ position: [0, 0, 8], fov: 60 }} gl={{ alpha: true, antialias: false }} style={{ background: "transparent" }}>
      <SmokeField />
    </Canvas>
  </div>
);

export default SmokeBackground;
