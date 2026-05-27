import { engine, 
        Material, 
        MeshRenderer, 
        Transform, 
        MaterialTransparencyMode, 
        Entity,
        pointerEventsSystem,
        InputAction,
        MeshCollider} from '@dcl/sdk/ecs'
import { LeaderBoard } from './leaderboard'
import { Color4 } from '@dcl/ecs-math/dist/Color4'
import { Quaternion } from '@dcl/sdk/math'
import { ForgeConnect } from './TheForge'

export function createLogo(parentEntity: Entity) {
const myEntity = engine.addEntity()
MeshRenderer.setPlane(myEntity)

Transform.create(myEntity, {
    parent: parentEntity,
    position: { x: 4, y: 2.75, z: -0.1 },
    scale: { x: 4, y: 4, z: 1 },
    rotation: Quaternion.fromEulerDegrees(0, 0, 0),
})



Material.setPbrMaterial(myEntity, {
    texture: Material.Texture.Common({
        src: 'assets/scene/JumpZone.png',
    }),
    emissiveTexture: Material.Texture.Common({
        src: 'assets/scene/JumpZone.png',
    }),
        emissiveColor: Color4.White(),
        emissiveIntensity: 1.0,
        metallic: 0.0,
        roughness: 1.0,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
})

const forgeLogo = engine.addEntity()
MeshRenderer.setPlane(forgeLogo)
MeshCollider.setPlane(forgeLogo)

Transform.create(forgeLogo, {
    parent: parentEntity,
    rotation: Quaternion.fromEulerDegrees(0, 0, 0),
    position: { x: -5.75, y: -2.25, z: -0.1 },
    scale: { x: 0.75, y: 0.75, z: 1 },
})

pointerEventsSystem.onPointerDown({
    entity: forgeLogo,
    opts: {
        button: InputAction.IA_PRIMARY,
        hoverText: 'Open Forge',
        maxDistance: 10
    },
}   
,
 () => {
        console.log('Forge logo clicked')
        ForgeConnect()
    }
)


Material.setPbrMaterial(forgeLogo, {
    texture: Material.Texture.Common({
        src: 'assets/scene/forge_icon.jpg',
    }),
        emissiveTexture: Material.Texture.Common({
        src: 'assets/scene/forge_icon.jpg',
    }),
        emissiveColor: Color4.White(),
        emissiveIntensity: 1.0,
        metallic: 0.0,
        roughness: 1.0,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
})
}