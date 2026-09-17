import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

import dayMap from "@/assets/earth-day.jpg";
import nightMap from "@/assets/earth-night.jpg";

const EARTH_RADIUS = 2.6;

/** Additive fresnel shell that reads as a blue atmospheric rim. */
const atmosphereShader = {
  vertexShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vView;
    uniform vec3 uColor;
    uniform float uIntensity;
    uniform float uPower;
    void main() {
      float rim = 1.0 - max(dot(vNormal, vView), 0.0);
      float glow = pow(rim, uPower) * uIntensity;
      gl_FragColor = vec4(uColor * glow, glow);
    }
  `,
};

function Atmosphere() {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color("#4aa8ff") },
      uIntensity: { value: 0.85 },
      uPower: { value: 3.6 },
    }),
    [],
  );
  return (
    <mesh scale={1.03}>
      <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
      <shaderMaterial
        args={[
          {
            uniforms,
            vertexShader: atmosphereShader.vertexShader,
            fragmentShader: atmosphereShader.fragmentShader,
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            depthWrite: false,
          },
        ]}
      />
    </mesh>
  );
}

function OuterHaze() {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color("#2f7fd6") },
      uIntensity: { value: 0.4 },
      uPower: { value: 2.2 },
    }),
    [],
  );
  return (
    <mesh scale={1.12}>
      <sphereGeometry args={[EARTH_RADIUS, 48, 48]} />
      <shaderMaterial
        args={[
          {
            uniforms,
            vertexShader: atmosphereShader.vertexShader,
            fragmentShader: atmosphereShader.fragmentShader,
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            depthWrite: false,
          },
        ]}
      />
    </mesh>
  );
}

function Globe({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const textures = useTexture([dayMap, nightMap]) as THREE.Texture[];
  const day = textures[0] as THREE.Texture;
  const night = textures[1] as THREE.Texture;

  useMemo(() => {
    for (const tex of [day, night]) {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
    }
  }, [day, night]);

  // One revolution ≈ 75s, clockwise seen from the north pole:
  // +Y rotation carries the front-facing surface from left to right.
  useFrame((_, delta) => {
    if (!ref.current || reducedMotion) return;
    ref.current.rotation.y =
      (ref.current.rotation.y + delta * ((Math.PI * 2) / 75)) % (Math.PI * 2);
  });

  return (
    <mesh ref={ref} rotation={[0.32, 2.1, 0.14]}>
      <sphereGeometry args={[EARTH_RADIUS, 96, 96]} />
      <meshStandardMaterial
        map={day}
        emissiveMap={night}
        emissive={new THREE.Color("#ffcf8a")}
        emissiveIntensity={1.35}
        roughness={0.86}
        metalness={0.02}
      />
    </mesh>
  );
}

function Starfield({ count }: { count: number }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      // shell distribution so stars never sit inside the globe
      const r = 26 + Math.random() * 42;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      sizes[i] = 0.06 + Math.random() * 0.16;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, [count]);

  // Stars stay visually anchored; only the Earth rotates.
  const ref = useRef<THREE.Points>(null);

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        size={0.16}
        sizeAttenuation
        color="#dce8ff"
        transparent
        opacity={0.92}
        depthWrite={false}
      />
    </points>
  );
}

/**
 * Responsive rig: keeps the Earth horizon in the lower band of the viewport
 * at every breakpoint by scaling the globe and shifting it down, instead of
 * hardcoding a desktop framing.
 */
function ResponsiveRig({
  reducedMotion,
  showStars,
}: {
  reducedMotion: boolean;
  showStars: boolean;
}) {
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);

  const { scale, offsetY } = useMemo(() => {
    const w = size.width;
    const aspect = size.width / Math.max(size.height, 1);
    // Cinematic framing: a large Earth anchored near the bottom edge, its horizon
    // curving across the lower viewport at every breakpoint.
    if (w < 480) return { scale: 0.82, offsetY: -3.9 };
    if (w < 768) return { scale: 0.95, offsetY: -4.3 };
    if (w < 1200) return { scale: 1.15, offsetY: -4.8 };
    return { scale: aspect > 1.9 ? 1.5 : 1.32, offsetY: -5.3 };
  }, [size.width, size.height]);

  useMemo(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = size.width < 768 ? 58 : 46;
      camera.updateProjectionMatrix();
    }
  }, [camera, size.width]);

  return (
    <>
      <ambientLight intensity={0.28} color="#8fb6ff" />
      <directionalLight position={[-5, 2.4, 4.5]} intensity={2.1} color="#fff4e2" />
      <directionalLight position={[6, -1, -3]} intensity={0.35} color="#4c8dff" />
      {showStars ? <Starfield count={size.width < 768 ? 1400 : 3200} /> : null}
      <group position={[0, offsetY, 0]} scale={scale}>
        <Globe reducedMotion={reducedMotion} />
        <Atmosphere />
        <OuterHaze />
      </group>
    </>
  );
}

export default function EarthScene({ showStars = true }: { showStars?: boolean }) {
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <Canvas
      aria-hidden
      className="!absolute inset-0"
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 8.4], fov: 46, near: 0.1, far: 200 }}
    >
      <ResponsiveRig reducedMotion={reducedMotion} showStars={showStars} />
    </Canvas>
  );
}
