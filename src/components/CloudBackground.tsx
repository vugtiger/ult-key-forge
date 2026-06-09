import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

type ShapeKind = "sphere" | "box" | "torus" | "icosahedron";

interface ShapeProps {
  position: [number, number, number];
  rotationSpeed: [number, number, number];
  floatSpeed: number;
  floatAmplitude: number;
  scale: number;
  color: string;
  kind: ShapeKind;
}

const FloatingShape = ({ position, rotationSpeed, floatSpeed, floatAmplitude, scale, color, kind }: ShapeProps) => {
  const ref = useRef<THREE.Mesh>(null);
  const baseY = position[1];

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = baseY + Math.sin(t * floatSpeed) * floatAmplitude;
    ref.current.position.x = position[0] + Math.cos(t * floatSpeed * 0.7) * (floatAmplitude * 0.5);
    ref.current.rotation.x += rotationSpeed[0];
    ref.current.rotation.y += rotationSpeed[1];
    ref.current.rotation.z += rotationSpeed[2];
  });

  const geometry = useMemo(() => {
    switch (kind) {
      case "sphere": return <sphereGeometry args={[1, 48, 48]} />;
      case "box": return <boxGeometry args={[1.4, 1.4, 1.4]} />;
      case "torus": return <torusGeometry args={[0.9, 0.32, 24, 64]} />;
      case "icosahedron": return <icosahedronGeometry args={[1.1, 0]} />;
    }
  }, [kind]);

  return (
    <mesh ref={ref} position={position} scale={scale} castShadow>
      {geometry}
      <meshPhysicalMaterial
        color={color}
        roughness={0.25}
        metalness={0.1}
        clearcoat={0.8}
        clearcoatRoughness={0.2}
        transmission={0.15}
        thickness={0.5}
        envMapIntensity={1.2}
      />
    </mesh>
  );
};

const Scene = () => {
  const shapes = useMemo<ShapeProps[]>(() => {
    const kinds: ShapeKind[] = ["sphere", "box", "torus", "icosahedron"];
    // Mint green + peach orange palette
    const colors = ["#a8e6b5", "#ffcba0", "#c8f0d2", "#ffb893", "#86dba0", "#ffd9bd", "#b5ead7", "#ffc3a0"];
    return Array.from({ length: 14 }, (_, i) => ({
      position: [
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 6 - 2,
      ] as [number, number, number],
      rotationSpeed: [
        (Math.random() - 0.5) * 0.008,
        (Math.random() - 0.5) * 0.008,
        (Math.random() - 0.5) * 0.004,
      ] as [number, number, number],
      floatSpeed: 0.3 + Math.random() * 0.5,
      floatAmplitude: 0.3 + Math.random() * 0.6,
      scale: 0.4 + Math.random() * 0.7,
      color: colors[i % colors.length],
      kind: kinds[i % kinds.length],
    }));
  }, []);

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} color="#ffffff" />
      <directionalLight position={[-5, -3, 4]} intensity={0.6} color="#ffd9bd" />
      <pointLight position={[0, 0, 6]} intensity={0.8} color="#a8e6b5" />
      {shapes.map((s, i) => <FloatingShape key={i} {...s} />)}
    </>
  );
};

const CloudBackground = () => (
  <div className="fixed inset-0 z-0 pointer-events-none opacity-40" aria-hidden>
    <Canvas
      camera={{ position: [0, 0, 9], fov: 55 }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
      dpr={[1, 1.5]}
    >
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  </div>
);

export default CloudBackground;
