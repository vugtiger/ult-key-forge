import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import * as THREE from "three";

const Shape = ({ position, geometry, speed, rotAxis }: { position: [number, number, number]; geometry: "torus" | "octahedron" | "icosahedron" | "ring"; speed: number; rotAxis: [number, number, number] }) => {
  const ref = useRef<THREE.Mesh>(null);
  const initialY = position[1];

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.rotation.x += rotAxis[0] * speed * 0.008;
    ref.current.rotation.y += rotAxis[1] * speed * 0.008;
    ref.current.rotation.z += rotAxis[2] * speed * 0.008;
    ref.current.position.y = initialY + Math.sin(t * speed * 0.5) * 0.3;
  });

  const geo = useMemo(() => {
    switch (geometry) {
      case "torus": return new THREE.TorusGeometry(0.4, 0.15, 12, 32);
      case "octahedron": return new THREE.OctahedronGeometry(0.35);
      case "icosahedron": return new THREE.IcosahedronGeometry(0.3);
      case "ring": return new THREE.TorusGeometry(0.5, 0.05, 8, 32);
    }
  }, [geometry]);

  return (
    <mesh ref={ref} position={position} geometry={geo}>
      <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.06} />
    </mesh>
  );
};

const shapes: { position: [number, number, number]; geometry: "torus" | "octahedron" | "icosahedron" | "ring"; speed: number; rotAxis: [number, number, number] }[] = [
  { position: [-3.5, 2, -2], geometry: "torus", speed: 0.7, rotAxis: [1, 0.5, 0] },
  { position: [4, -1.5, -3], geometry: "octahedron", speed: 0.9, rotAxis: [0.5, 1, 0.3] },
  { position: [-2, -2.5, -1.5], geometry: "icosahedron", speed: 0.5, rotAxis: [0, 1, 0.5] },
  { position: [3, 2.5, -2.5], geometry: "ring", speed: 0.6, rotAxis: [1, 0, 0.8] },
  { position: [0, 3, -4], geometry: "octahedron", speed: 0.4, rotAxis: [0.3, 0.7, 1] },
  { position: [-4, 0.5, -3], geometry: "ring", speed: 0.8, rotAxis: [0, 1, 0] },
];

const FloatingShapes = () => (
  <div className="fixed inset-0 pointer-events-none z-0" style={{ opacity: 0.7 }}>
    <Canvas camera={{ position: [0, 0, 5], fov: 60 }} gl={{ alpha: true, antialias: false }} dpr={1}>
      <ambientLight intensity={0.5} />
      {shapes.map((s, i) => (
        <Shape key={i} {...s} />
      ))}
    </Canvas>
  </div>
);

export default FloatingShapes;
