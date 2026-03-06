import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ZONE_COLORS } from './VectorNode';

/**
 * SwarmOverlay — Renders active headybees as animated icosahedrons in the 3D space.
 * Position is based on their assigned zone, with jitter for visual spread.
 * Connection lines link bees to their task targets.
 */
const SwarmOverlay = ({ beeCount = 12, swarmHealth = 100 }) => {
    const groupRef = useRef();

    // Generate bee positions based on octant zones (evenly distributed)
    const bees = useMemo(() => {
        const result = [];
        for (let i = 0; i < beeCount; i++) {
            const zone = i % 8;
            // Octant center + jitter
            const signs = [
                (zone & 1) ? 1 : -1,
                (zone & 2) ? 1 : -1,
                (zone & 4) ? 1 : -1,
            ];
            result.push({
                id: i,
                zone,
                position: [
                    signs[0] * (0.8 + Math.random() * 0.6),
                    signs[1] * (0.8 + Math.random() * 0.6),
                    signs[2] * (0.8 + Math.random() * 0.6),
                ],
                speed: 0.5 + Math.random() * 1.5,
                phase: Math.random() * Math.PI * 2,
            });
        }
        return result;
    }, [beeCount]);

    // Animate bees
    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.children.forEach((child, i) => {
                if (i < bees.length && child.type === 'Mesh') {
                    const bee = bees[i];
                    const t = state.clock.elapsedTime * bee.speed + bee.phase;
                    child.position.x = bee.position[0] + Math.sin(t) * 0.1;
                    child.position.y = bee.position[1] + Math.cos(t * 0.7) * 0.08;
                    child.position.z = bee.position[2] + Math.sin(t * 1.3) * 0.06;
                    child.rotation.x = t * 0.5;
                    child.rotation.z = t * 0.3;
                }
            });
        }
    });

    // Trail lines connecting bees to origin (representing task connections)
    const trailGeometry = useMemo(() => {
        const points = [];
        bees.forEach(bee => {
            points.push(
                new THREE.Vector3(...bee.position),
                new THREE.Vector3(0, 0, 0)
            );
        });
        return new THREE.BufferGeometry().setFromPoints(points);
    }, [bees]);

    const healthOpacity = swarmHealth / 100;

    return (
        <group ref={groupRef}>
            {/* Bee icosahedrons */}
            {bees.map((bee) => (
                <mesh key={bee.id} position={bee.position}>
                    <icosahedronGeometry args={[0.04, 0]} />
                    <meshBasicMaterial
                        color={ZONE_COLORS[bee.zone] || '#f59e0b'}
                        transparent
                        opacity={0.8 * healthOpacity}
                        wireframe
                    />
                </mesh>
            ))}

            {/* Connection trails to origin */}
            <lineSegments geometry={trailGeometry}>
                <lineBasicMaterial
                    color="#f59e0b"
                    transparent
                    opacity={0.06 * healthOpacity}
                    depthWrite={false}
                />
            </lineSegments>
        </group>
    );
};

export default SwarmOverlay;
