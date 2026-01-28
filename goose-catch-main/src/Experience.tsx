import { Physics, RigidBody } from "@react-three/rapier";
import Container from "./components/Container";
import Items from "./components/Items";
import { useGameStore } from "./stores/useGameStore";
import { Attractor } from "@react-three/rapier-addons";
import Bag from "./components/Bag";
import Background from "./components/Background";
import SceneEnvironment from "./components/SceneEnvironment";
const Experience = () => {

    const gamePhase = useGameStore((state) => state.gamePhase);
    const attractorStrength = 0.1


    return <>


        <Physics debug={false} gravity={[0, 0, 0]} timeStep="vary" paused={gamePhase !== 'playing'} >
            <RigidBody type="fixed" colliders="cuboid">
                <Container />
                <Attractor position={[0, 0, 0]} strength={attractorStrength} range={20}
                />
            </RigidBody>


            <Items />
            <Bag />


            <ambientLight intensity={0.6} />
            <hemisphereLight intensity={0.45} groundColor="#bdbdbd" color="#ffffff" />
            <directionalLight position={[-5, 10, 2]} intensity={1.1} />

            <color args={['#d7d7d7']} attach="background" />
        </Physics>

    </>
    return (
        <>
            <Background />
            <SceneEnvironment />
            <Physics
                debug={false}
                gravity={[0, 0, 0]}
                timeStep="vary"
                paused={gamePhase !== 'playing'}
            >
                <RigidBody type="fixed" colliders="cuboid">
                    <Container />
                    <Attractor position={[0, 0, 0]} strength={attractorStrength} range={20} />
                </RigidBody>

                <Items />
                <Bag />
            </Physics>

            <ambientLight intensity={0.6} />
            <directionalLight position={[-5, 10, 2]} intensity={1.1} color="#ffffff" />
            <directionalLight position={[4, 6, -4]} intensity={0.35} color="#ffd9b3" />
        </>
    );
}

export default Experience
