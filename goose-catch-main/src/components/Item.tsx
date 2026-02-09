import * as THREE from 'three';
import { useState, useEffect, useMemo, useRef } from "react";
import { RigidBody, RapierRigidBody } from "@react-three/rapier";
import { gsap } from 'gsap';
import type { GLTF } from 'three-stdlib';

import { useGameStore } from '../stores/useGameStore';
import { cloneWithStyle } from '../utils/visualStyle';
import type { VisualStyle } from '../stores/useGameStore';

const HIGHLIGHT_CACHE_KEY = '__gooseHighlightState';

interface ItemComponentProps {
    id: number;
    position: [number, number, number];
    object: GLTF | undefined;
    delay: number;
    type: number;
    scale?: number;
    bagScale?: number;
}

const cloneForBag = (source: THREE.Object3D, style: VisualStyle) => {
    const cloned = cloneWithStyle(source, style);
    cloned.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.frustumCulled = false;
        if (Array.isArray(child.material)) {
            child.material = child.material.map((mat) => {
                const next = mat.clone();
                next.depthTest = false;
                next.depthWrite = false;
                next.transparent = false;
                next.opacity = 1;
                return next;
            });
        } else if (child.material) {
            const next = child.material.clone();
            next.depthTest = false;
            next.depthWrite = false;
            next.transparent = false;
            next.opacity = 1;
            child.material = next;
        }
        child.renderOrder = 20;
    });
    return cloned;
};

const applyItemHighlight = (root: THREE.Object3D, active: boolean) => {
    root.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
            if (!mat || !('emissive' in mat)) return;
            const target = mat as THREE.MeshStandardMaterial;
            if (!target.emissive?.isColor) return;

            if (!target.userData[HIGHLIGHT_CACHE_KEY]) {
                target.userData[HIGHLIGHT_CACHE_KEY] = {
                    emissive: target.emissive.clone(),
                    emissiveIntensity: target.emissiveIntensity ?? 0,
                };
            }

            const cached = target.userData[HIGHLIGHT_CACHE_KEY] as {
                emissive: THREE.Color;
                emissiveIntensity: number;
            };

            if (active) {
                target.emissive.set('#f59e0b');
                target.emissiveIntensity = Math.max(cached.emissiveIntensity ?? 0, 0.75);
            } else {
                target.emissive.copy(cached.emissive);
                target.emissiveIntensity = cached.emissiveIntensity ?? 0;
            }
            target.needsUpdate = true;
        });
    });
};

const Item = ({ id, position, object, delay, type, scale = 1, bagScale }: ItemComponentProps) => {
    const [hovered, setHover] = useState(false);
    const [visible, setVisible] = useState(false);
    const bodyRef = useRef<RapierRigidBody>(null);
    const worldRef = useRef<THREE.Group>(null);
    
    const bagItems = useGameStore((state) => state.bagItems);
    const slotPositions = useGameStore((state) => state.slotPositions);
    const isPicked = useGameStore((state) => state.pickedIds.includes(id));
    const isRemoved = useGameStore((state) => state.removedIds.includes(id));
    const hintId = useGameStore((state) => state.hintId);
    const pickItem = useGameStore((state) => state.pickItem);
    const gamePhase = useGameStore((state) => state.gamePhase);
    const registerItemRef = useGameStore((state) => state.registerItemRef);
    const registerWorldItemRef = useGameStore((state) => state.registerWorldItemRef);
    const bagTargets = useGameStore((state) => state.bagTargets);
    const visualStyle = useGameStore((state) => state.visualStyle);


    const targetRef = useRef(new THREE.Vector3(0, -10, 0));
    const bagModelRef = useRef<THREE.Object3D | null>(null);

   

    // 选取动画相关引用
    const animRef = useRef<THREE.Group>(null);
    const startPosRef = useRef(new THREE.Vector3());
    const tweenRef = useRef<gsap.core.Tween | null>(null);

    // 克隆模型以避免引用同一个实例
    const model = useMemo(() => {
        if (!object) return undefined;
        const gltf = Array.isArray(object) ? object[0] : object;
        if (!gltf?.scene) return undefined;
        const cloned = cloneWithStyle(gltf.scene, visualStyle);
        cloned.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh) {
                child.frustumCulled = false;
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach((mat) => {
                    if (mat) {
                        mat.side = THREE.DoubleSide;
                        mat.needsUpdate = true;
                    }
                });
            }
        });
        return cloned;
    }, [object, visualStyle]);
    const sourceScene = useMemo(() => {
        if (!object) return null;
        const gltf = Array.isArray(object) ? object[0] : object;
        return gltf?.scene ?? null;
    }, [object]);

    //实现逐渐生成
    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(true);
        }, delay);
        return () => clearTimeout(timer);
    }, [delay]);

    // hover 变色
    useEffect(() => {
        if (!worldRef.current) return;

        const shouldHighlight = hovered || hintId === id;
        const root = worldRef.current;

        applyItemHighlight(root, shouldHighlight);
        return () => {
            applyItemHighlight(root, false);
        };
    }, [hovered, hintId, id]);

    const moveToTarget = (
        tweenRef: React.MutableRefObject<gsap.core.Tween | null>,
        animRef: React.RefObject<THREE.Group | null>,
        target: THREE.Vector3 = targetRef.current
    ) => {
        if (!animRef.current) return;
        tweenRef.current?.kill();
        tweenRef.current = gsap.to(animRef.current.position, {
            x: target.x,
            y: target.y,
            z: target.z,
            duration: 0.2,
            ease: 'power3.inOut',
        });


    }

    // 拾取动画
    useEffect(() => {
        if (!isPicked || !animRef.current) return;
        const target = bagTargets[id];
        if (target) {
            targetRef.current.copy(target);
        }
        moveToTarget(tweenRef, animRef, targetRef.current);

        return () => {
            tweenRef.current?.kill();
        };
    }, [isPicked, bagTargets, id, model]);


    useEffect(() => {
        // 当 bagItems 变化时，更新场景中物体位置
        if (!isPicked) return;
        bagItems.forEach((item, index) => {
            if (item.meshRef && item.meshRef.current) {
                const targetPos = slotPositions[index];

                gsap.to(item.meshRef.current.position, {
                    x: targetPos.x,
                    y: targetPos.y,
                    z: targetPos.z,
                    duration: 0.2,
                    ease: 'power3.inOut',
                });

            }
        });
    }, [bagItems, isPicked, slotPositions]);


    // 组件卸载时清理
    useEffect(() => {
        return () => {
            tweenRef.current?.kill();
            if (model) {
                model.traverse((child: any) => {
                    if (child.isMesh) {
                        child.geometry?.dispose();
                        if (Array.isArray(child.material)) {
                            child.material.forEach((m: THREE.Material) => m.dispose());
                        } else {
                            child.material?.dispose();
                        }
                    }
                });
            }
            if (bagModelRef.current) {
                bagModelRef.current.traverse((child: any) => {
                    if (child.isMesh) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach((m: THREE.Material) => m.dispose());
                        } else {
                            child.material?.dispose();
                        }
                    }
                });
            }
        };
    }, [model]);

    useEffect(() => {
        bagModelRef.current = null;
    }, [model]);

    useEffect(() => {
        registerItemRef(id, animRef);
    }, [id, registerItemRef]);

    useEffect(() => {
        registerWorldItemRef(id, worldRef);
    }, [id, registerWorldItemRef]);

    if (!visible || isRemoved) {
        return null;
    }
    if (isPicked) {
        if (!bagModelRef.current && sourceScene) {
            bagModelRef.current = cloneForBag(sourceScene, visualStyle);
        }
        const bagModel = bagModelRef.current ?? null;
        return (
            <group
                ref={animRef}
                scale={bagScale ?? scale * 0.6}
                position={[startPosRef.current.x, startPosRef.current.y, startPosRef.current.z]}
                renderOrder={22}
            >
                {bagModel ? <primitive object={bagModel} /> : null}
            </group>
        );
    }
    return (


        <RigidBody
            position={position}
            colliders="cuboid"
            ref={bodyRef}
            linearDamping={1.2}
            angularDamping={1.0}
            gravityScale={0}
            canSleep
        >

            {object &&
                <group
                    ref={worldRef}
                    onPointerEnter={(e) => {
                        e.stopPropagation();
                        setHover(true);

                    }}
                    onPointerOut={() => { setHover(false) }}
                    // onPointerDown={(e) => { e.stopPropagation(); }}
                    onPointerUp={(e) => {

                        e.stopPropagation();
                        if (gamePhase !== 'playing') return;

                        const api = bodyRef.current;
                        if (api) {
                            const t = api.translation();
                            startPosRef.current.set(t.x, t.y, t.z);
                        } else if (worldRef.current) {
                            worldRef.current.getWorldPosition(startPosRef.current);
                        }
                        const nextPosition = pickItem({ id, type, meshRef: animRef })
                        if (nextPosition) {
                            targetRef.current.set(nextPosition.x, nextPosition.y, nextPosition.z);
                        }
                    }}
                >
                    {model ? <primitive object={model} scale={scale}  >

                    </primitive> : null}
                </group>
            }

        </RigidBody>
    );
}

export default Item;
