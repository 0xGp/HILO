import { Effects } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Particles } from './particles.jsx';
import { VignetteShader } from './shaders/vignetteShader.js';

const DEFAULTS = {
  speed: 1.0,
  noiseScale: 0.6,
  noiseIntensity: 0.52,
  timeScale: 1,
  focus: 3.8,
  aperture: 1.79,
  pointSize: 10.0,
  opacity: 0.8,
  planeScale: 10.0,
  size: 512,
  vignetteDarkness: 1.5,
  vignetteOffset: 0.4,
};

export function GL({ hovering = false }) {
  return (
    <div id="webgl" aria-hidden="true">
      <Canvas
        camera={{
          position: [1.2629783123314589, 2.664606471394044, -1.8178993743288914],
          fov: 50,
          near: 0.01,
          far: 300,
        }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#000']} />
        <Particles
          speed={DEFAULTS.speed}
          aperture={DEFAULTS.aperture}
          focus={DEFAULTS.focus}
          size={DEFAULTS.size}
          noiseScale={DEFAULTS.noiseScale}
          noiseIntensity={DEFAULTS.noiseIntensity}
          timeScale={DEFAULTS.timeScale}
          pointSize={DEFAULTS.pointSize}
          opacity={DEFAULTS.opacity}
          planeScale={DEFAULTS.planeScale}
          introspect={hovering}
        />
        <Effects multisamping={0} disableGamma>
          <shaderPass
            args={[VignetteShader]}
            uniforms-darkness-value={DEFAULTS.vignetteDarkness}
            uniforms-offset-value={DEFAULTS.vignetteOffset}
          />
        </Effects>
      </Canvas>
    </div>
  );
}
