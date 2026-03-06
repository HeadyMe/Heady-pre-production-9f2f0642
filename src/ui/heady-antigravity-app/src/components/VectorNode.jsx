import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';

/**
 * Zone color palette – matches vector-memory.js octant assignments.
 */
const ZONE_COLORS = {
    0: '#3b82f6', // site-builder — blue
    1: '#10b981', // code-processor — green
    2: '#eab308', // config-injector — yellow
    3: '#06b6d4', // api-handler — cyan
    4: '#d946ef', // agent-spawner — magenta
    5: '#f97316', // pipeline-runner — orange
    6: '#8b5cf6', // data-transformer — purple
    7: '#ef4444', // infra-deployer — red
};

const ZONE_LABELS = {
    0: 'site-builder',
    1: 'code-processor',
    2: 'config-injector',
    3: 'api-handler',
    4: 'agent-spawner',
    5: 'pipeline-runner',
    6: 'data-transformer',
    7: 'infra-deployer',
};

/**
 * VectorNode — 3D sphere representing a single memory vector in the space.
 * Positioned by its 3D coordinates (from PCA-lite projection).
 * Hover shows tooltip with metadata. Click triggers inspection.
 */
const VectorNode = ({
    position = [0, 0, 0],
    zone = 0,
    label = '',
    similarity = 0,
    onInspect,
    size = 0.08,
}) => {
    const meshRef = useRef();
    const [hovered, setHovered] = useState(false);
    const color = ZONE_COLORS[zone] || '#64748b';

    // Gentle floating animation
    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.position.y =
                position[1] + Math.sin(state.clock.elapsedTime * 0.8 + position[0]) * 0.02;
        }
    });

    return (
        <group>
            <mesh
                ref={meshRef}
                position={position}
                onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
                onPointerOut={() => setHovered(false)}
                onClick={(e) => {
                    e.stopPropagation();
                    if (onInspect) onInspect({ label, zone, similarity, position });
                }}
            >
                <sphereGeometry args={[hovered ? size * 1.5 : size, 12, 12]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={hovered ? 0.95 : 0.7}
                />
            </mesh>

            {/* Outer glow */}
            <mesh position={position}>
                <sphereGeometry args={[size * 2.5, 8, 8]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={hovered ? 0.15 : 0.05}
                />
            </mesh>

            {/* Tooltip on hover */}
            {hovered && (
                <Html
                    position={[position[0], position[1] + 0.2, position[2]]}
                    center
                    style={{ pointerEvents: 'none' }}
                >
                    <div style={{
                        background: 'rgba(2, 6, 23, 0.95)',
                        border: `1px solid ${color}40`,
                        borderRadius: '12px',
                        padding: '8px 12px',
                        color: '#f1f5f9',
                        fontSize: '10px',
                        fontFamily: 'JetBrains Mono, monospace',
                        whiteSpace: 'nowrap',
                        boxShadow: `0 0 20px ${color}20`,
                        backdropFilter: 'blur(8px)',
                    }}>
                        <div style={{ color, fontWeight: 700, marginBottom: 2 }}>
                            {ZONE_LABELS[zone]}
                        </div>
                        <div style={{ color: '#94a3b8' }}>{label || 'vector node'}</div>
                        {similarity > 0 && (
                            <div style={{ color: '#64748b', marginTop: 2 }}>
                                sim: {(similarity * 100).toFixed(1)}%
                            </div>
                        )}
                    </div>
                </Html>
            )}
        </group>
    );
};

export { ZONE_COLORS, ZONE_LABELS };
export default VectorNode;
