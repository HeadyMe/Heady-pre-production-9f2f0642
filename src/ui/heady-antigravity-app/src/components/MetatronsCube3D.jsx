import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PHI = (1 + Math.sqrt(5)) / 2; // Golden ratio

/**
 * Metatron's Cube — procedural 3D Sacred Geometry
 * Renders at the origin of the vector space as a slowly rotating structure.
 * Vertices are scaled by the Golden Ratio (φ) for sacred proportions.
 */
const MetatronsCube3D = ({ scale = 1.5, color = '#f59e0b', opacity = 0.25 }) => {
    const groupRef = useRef();

    // Slowly rotate
    useFrame((_, delta) => {
        if (groupRef.current) {
            groupRef.current.rotation.y += delta * 0.08;
            groupRef.current.rotation.x += delta * 0.03;
        }
    });

    // Metatron's Cube vertices: 13 points (center + inner hexagon + outer hexagon)
    const { innerHex, outerHex, connections } = useMemo(() => {
        const r1 = 1 * scale;         // Inner radius
        const r2 = PHI * scale;       // Outer radius (golden ratio)
        const inner = [];
        const outer = [];

        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 2;
            inner.push(new THREE.Vector3(
                Math.cos(angle) * r1,
                Math.sin(angle) * r1,
                0
            ));
            outer.push(new THREE.Vector3(
                Math.cos(angle) * r2,
                Math.sin(angle) * r2,
                0
            ));
        }

        // All connections: every vertex to every other vertex (Metatron's pattern)
        const allPoints = [new THREE.Vector3(0, 0, 0), ...inner, ...outer];
        const conns = [];
        for (let i = 0; i < allPoints.length; i++) {
            for (let j = i + 1; j < allPoints.length; j++) {
                conns.push([allPoints[i], allPoints[j]]);
            }
        }

        return { innerHex: inner, outerHex: outer, connections: conns };
    }, [scale]);

    // Create line geometry for all connections
    const lineGeometry = useMemo(() => {
        const points = [];
        connections.forEach(([a, b]) => {
            points.push(a, b);
        });
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        return geo;
    }, [connections]);

    // Vertex spheres
    const allVertices = useMemo(() => {
        return [new THREE.Vector3(0, 0, 0), ...innerHex, ...outerHex];
    }, [innerHex, outerHex]);

    return (
        <group ref={groupRef}>
            {/* Connection lines */}
            <lineSegments geometry={lineGeometry}>
                <lineBasicMaterial
                    color={color}
                    transparent
                    opacity={opacity * 0.6}
                    depthWrite={false}
                />
            </lineSegments>

            {/* Vertex glow spheres */}
            {allVertices.map((pos, i) => (
                <mesh key={i} position={pos}>
                    <sphereGeometry args={[0.06 * scale, 8, 8]} />
                    <meshBasicMaterial
                        color={i === 0 ? '#3b82f6' : color}
                        transparent
                        opacity={i === 0 ? 0.9 : 0.5}
                    />
                </mesh>
            ))}

            {/* Center glow */}
            <mesh position={[0, 0, 0]}>
                <sphereGeometry args={[0.3 * scale, 16, 16]} />
                <meshBasicMaterial
                    color="#3b82f6"
                    transparent
                    opacity={0.08}
                />
            </mesh>

            {/* Inner hexagon ring */}
            <line>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={7}
                        array={new Float32Array([...innerHex, innerHex[0]].flatMap(v => [v.x, v.y, v.z]))}
                        itemSize={3}
                    />
                </bufferGeometry>
                <lineBasicMaterial color={color} transparent opacity={opacity * 1.5} />
            </line>

            {/* Outer hexagon ring */}
            <line>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={7}
                        array={new Float32Array([...outerHex, outerHex[0]].flatMap(v => [v.x, v.y, v.z]))}
                        itemSize={3}
                    />
                </bufferGeometry>
                <lineBasicMaterial color={color} transparent opacity={opacity} />
            </line>
        </group>
    );
};

export default MetatronsCube3D;
