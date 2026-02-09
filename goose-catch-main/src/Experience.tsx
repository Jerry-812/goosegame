import Items from "./components/Items";
import { useGameStore } from "./stores/useGameStore";
import Bag from "./components/Bag";
import Background from "./components/Background";
import SceneEnvironment from "./components/SceneEnvironment";
import Goose from "./components/Goose";
const Experience = () => {

    const visualStyle = useGameStore((state) => state.visualStyle);
    const ambientIntensity = visualStyle === 'toon' ? 0.95 : 0.6;
    const keyLightIntensity = visualStyle === 'toon' ? 0.8 : 1.1;
    const fillLightIntensity = visualStyle === 'toon' ? 0.45 : 0.35;

    return (
        <>
            <Background />
            <SceneEnvironment />
            <Items />
            <Bag />
            <Goose />

            <ambientLight intensity={ambientIntensity} />
            <directionalLight position={[-5, 10, 2]} intensity={keyLightIntensity} color="#ffffff" />
            <directionalLight position={[4, 6, -4]} intensity={fillLightIntensity} color="#ffd9b3" />
        </>
    );
}

export default Experience
