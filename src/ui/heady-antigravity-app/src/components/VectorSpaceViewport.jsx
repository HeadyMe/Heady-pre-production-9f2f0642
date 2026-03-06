import React, { useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Html, Environment } from '@react-three/drei';
import * as THREE from 'three';
import MetatronsCube3D from './MetatronsCube3D';
import VectorNode from './VectorNode';
import SwarmOverlay from './SwarmOverlay';

/* ═══════════════════════════════════════════════════ */
/*        OCTANT ZONE WIREFRAME GRID                  */
/* ═══════════════════════════════════════════════════ */

const ZONE_META = [
    { id: 0, label: 'site-builder', signs: [-1, -1, -1], color: '#3b82f6' },
    { id: 1, label: 'code-processor', signs: [+1, -1, -1], color: '#10b981' },
    { id: 2, label: 'config-injector', signs: [-1, +1, -1], color: '#eab308' },
    { id: 3, label: 'api-handler', signs: [+1, +1, -1], color: '#06b6d4' },
    { id: 4, label: 'agent-spawner', signs: [-1, -1, +1], color: '#d946ef' },
    { id: 5, label: 'pipeline-runner', signs: [+1, -1, +1], color: '#f97316' },
    { id: 6, label: 'data-transformer', signs: [-1, +1, +1], color: '#8b5cf6' },
    { id: 7, label: 'infra-deployer', signs: [+1, +1, +1], color: '#ef4444' },
];

const OctantZone = ({ signs, color, label, size = 1.8 }) => {
    const center = signs.map(s => s * size / 2);
    return (
        <group position={center}>
            {/* Wireframe cube */}
            <mesh>
                <boxGeometry args={[size, size, size]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={0.04}
                    depthWrite={false}
                />
            </mesh>
            <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(size, size, size)]} />
                <lineBasicMaterial color={color} transparent opacity={0.12} />
            </lineSegments>

            {/* Zone label */}
            <Html
                position={[0, size * 0.42, 0]}
                center
                style={{ pointerEvents: 'none' }}
            >
                <div style={{
                    color,
                    fontSize: '8px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 600,
                    opacity: 0.5,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    whiteSpace: 'nowrap',
                }}>
                    {label}
                </div>
            </Html>
        </group>
    );
};

/* ═══════════════════════════════════════════════════ */
/*        AXIS LINES (X/Y/Z through origin)           */
/* ═══════════════════════════════════════════════════ */

const AxisLines = ({ length = 2.5 }) => {
    const axes = [
        { dir: [length, 0, 0], color: '#ef4444', label: 'X' },
        { dir: [0, length, 0], color: '#10b981', label: 'Y' },
        { dir: [0, 0, length], color: '#3b82f6', label: 'Z' },
    ];

    return (
        <group>
            {axes.map(({ dir, color, label }) => (
                <group key={label}>
                    <line>
                        <bufferGeometry>
                            <bufferAttribute
                                attach="attributes-position"
                                count={2}
                                array={new Float32Array([
                                    -dir[0], -dir[1], -dir[2],
                                    dir[0], dir[1], dir[2]
                                ])}
                                itemSize={3}
                            />
                        </bufferGeometry>
                        <lineBasicMaterial color={color} transparent opacity={0.2} />
                    </line>
                    <Html position={dir} center style={{ pointerEvents: 'none' }}>
                        <span style={{
                            color,
                            fontSize: '9px',
                            fontFamily: 'JetBrains Mono, monospace',
                            fontWeight: 700,
                            opacity: 0.6,
                        }}>
                            {label}
                        </span>
                    </Html>
                </group>
            ))}
        </group>
    );
};

/* ═══════════════════════════════════════════════════ */
/*        SAMPLE VECTOR NODES                         */
/* ═══════════════════════════════════════════════════ */

const SAMPLE_NODES = [
    { pos: [-0.6, -0.8, -0.4], zone: 0, label: 'landing/index.html' },
    { pos: [-0.9, -0.5, -0.7], zone: 0, label: 'landing/styles.css' },
    { pos: [0.7, -0.3, -0.5], zone: 1, label: 'hc_liquid.js' },
    { pos: [0.4, -0.9, -0.2], zone: 1, label: 'deep-research.js' },
    { pos: [-0.3, 0.6, -0.8], zone: 2, label: 'configs/proxy' },
    { pos: [0.5, 0.7, -0.4], zone: 3, label: 'mcp/colab-bridge' },
    { pos: [0.8, 0.4, -0.6], zone: 3, label: 'provider-connector' },
    { pos: [-0.4, -0.6, 0.7], zone: 4, label: 'bees/bee-factory' },
    { pos: [-0.7, -0.3, 0.5], zone: 4, label: 'bees/template-bee' },
    { pos: [0.6, -0.5, 0.8], zone: 5, label: 'services/autonomy' },
    { pos: [0.3, -0.7, 0.4], zone: 5, label: 'services/embedder' },
    { pos: [-0.5, 0.8, 0.3], zone: 6, label: 'vector-memory.js' },
    { pos: [-0.2, 0.5, 0.9], zone: 6, label: 'data/shards' },
    { pos: [0.9, 0.6, 0.5], zone: 7, label: 'Dockerfile' },
    { pos: [0.4, 0.3, 0.7], zone: 7, label: 'cloudflare/edge' },
];

/* ═══════════════════════════════════════════════════ */
/*        MAIN VIEWPORT COMPONENT                     */
/* ═══════════════════════════════════════════════════ */

/**
 * VectorSpaceViewport — The core 3D viewport for the Antigravity interface.
 * Renders 8 octant zones, Sacred Geometry, vector nodes, and swarm bees.
 */
const VectorSpaceViewport = ({
    vectorCoords = { x: 0, y: 0, z: 0 },
    beeCount = 12,
    swarmHealth = 100,
    onNodeInspect,
    isAuth = false,
}) => {
    const handleInspect = useCallback((nodeData) => {
        if (onNodeInspect) onNodeInspect(nodeData);
    }, [onNodeInspect]);

    return (
        <div className="relative w-full aspect-video rounded-3xl overflow-hidden border border-slate-800 bg-slate-950">
            {/* LIVE indicator */}
            <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] text-slate-500 font-mono">3D SPACE</span>
            </div>

            {/* Coordinate readout */}
            <div className="absolute top-3 right-3 z-20">
                <div className="text-[10px] font-mono text-slate-500 bg-slate-950/80 backdrop-blur px-2 py-1 rounded-lg border border-slate-800">
                    <span className="text-slate-600">X:</span>
                    <span className="text-blue-400">{vectorCoords.x}</span>
                    <span className="text-slate-700 mx-1">·</span>
                    <span className="text-slate-600">Y:</span>
                    <span className="text-emerald-400">{vectorCoords.y}</span>
                    <span className="text-slate-700 mx-1">·</span>
                    <span className="text-slate-600">Z:</span>
                    <span className="text-amber-400">{vectorCoords.z}</span>
                </div>
            </div>

            {/* Octant legend */}
            <div className="absolute bottom-3 left-3 z-20">
                <div className="text-[8px] font-mono text-slate-600 bg-slate-950/80 backdrop-blur px-2 py-1.5 rounded-lg border border-slate-800 flex items-center gap-1.5">
                    <span className="text-amber-500">⬡</span>
                    <span>Antigravity · 8 Octants</span>
                </div>
            </div>

            {/* Three.js Canvas */}
            <Canvas
                camera={{ position: [4, 3, 4], fov: 50 }}
                gl={{ antialias: true, alpha: true }}
                style={{ background: '#020617' }}
            >
                {/* Ambient light */}
                <ambientLight intensity={0.3} />
                <pointLight position={[5, 5, 5]} intensity={0.4} />

                {/* Star field background */}
                <Stars
                    radius={50}
                    depth={50}
                    count={2000}
                    factor={3}
                    saturation={0.1}
                    fade
                    speed={0.3}
                />

                {/* Orbit controls */}
                <OrbitControls
                    enableDamping
                    dampingFactor={0.05}
                    rotateSpeed={0.5}
                    zoomSpeed={0.8}
                    minDistance={2}
                    maxDistance={12}
                    autoRotate
                    autoRotateSpeed={0.3}
                />

                {/* Axis lines */}
                <AxisLines />

                {/* 8 Octant zones */}
                {ZONE_META.map((zone) => (
                    <OctantZone
                        key={zone.id}
                        signs={zone.signs}
                        color={zone.color}
                        label={zone.label}
                    />
                ))}

                {/* Metatron's Cube at origin */}
                <MetatronsCube3D scale={0.8} />

                {/* Vector memory nodes */}
                {isAuth && SAMPLE_NODES.map((node, i) => (
                    <VectorNode
                        key={i}
                        position={node.pos}
                        zone={node.zone}
                        label={node.label}
                        similarity={0.7 + Math.random() * 0.25}
                        onInspect={handleInspect}
                    />
                ))}

                {/* Swarm bees */}
                {isAuth && (
                    <SwarmOverlay
                        beeCount={beeCount}
                        swarmHealth={swarmHealth}
                    />
                )}
            </Canvas>
        </div>
    );
};

export default VectorSpaceViewport;
