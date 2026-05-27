import { engine, Material, GltfContainer, InputAction, MeshCollider, MeshRenderer, pointerEventsSystem, Transform, MaterialTransparencyMode, EasingFunction, Tween, TweenLoop, TweenSequence, Entity } from '@dcl/sdk/ecs'
import { Color3, Quaternion, Vector3 } from '@dcl/sdk/math'
import * as utils from '@dcl-sdk/utils'
import { movePlayerTo } from '~system/RestrictedActions'

export function createTeleport(parent: Entity) {
const myEntity = engine.addEntity()
MeshRenderer.setPlane(myEntity)

Transform.create(myEntity, {
	position: { x: 4, y: -1.0, z: -0.1 },
    scale: { x: 3.75, y: 3.75, z: 1 },
	parent: parent
})

Tween.create(myEntity, {
	mode: Tween.Mode.Rotate({
		start: Quaternion.fromEulerDegrees(0, 0, 0),
		end: Quaternion.fromEulerDegrees(0, 0, 180),
	}),
	duration: 2000,
	easingFunction: EasingFunction.EF_LINEAR,
})
TweenSequence.create(myEntity, {
	loop: TweenLoop.TL_RESTART,
	sequence: [
		{
			mode: Tween.Mode.Rotate({
				start: Quaternion.fromEulerDegrees(0, 0, 180),
				end: Quaternion.fromEulerDegrees(0, 0, 360),
			}),
			duration: 2000,
			easingFunction: EasingFunction.EF_LINEAR,
		},
	],
})

Material.setPbrMaterial(myEntity, {
    texture: Material.Texture.Common({
        src: 'assets/scene/PlasmaCircle.png',
    }),
	emissiveTexture: Material.Texture.Common({
        src: 'assets/scene/PlasmaCircle.png',
    }),
	emissiveColor: Color3.Purple(),
	emissiveIntensity: 1.0,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
})

utils.triggers.addTrigger(
    myEntity,
    1,
    1,
    [{ type: 'box', scale: {x:2,y:5,z:3}, position: Vector3.create(0, 0, 0) }],
    () => {
        console.log('Teleport trigger fired!')
        const playerTransform = Transform.getOrNull(engine.PlayerEntity)
        if (!playerTransform) {
            console.log('No player transform found')
            return
        }
        const p = playerTransform.position
        console.log('Player position: x=' + p.x + ' z=' + p.z)
        const dist = Math.sqrt((p.x - 22.7) ** 2 + (p.z - 8.6) ** 2)
        console.log('Distance to portal: ' + dist)
        if (dist < 4) {
            movePlayerTo({
                newRelativePosition: Vector3.create(-11, 46, 18),
                cameraTarget: Vector3.create(24.25, 30.0, 20.0),
                avatarTarget: Vector3.create(-3.0, 46.0, 18),
            })
        }
    },
    () => {},
    Color3.Yellow()
  )
       utils.triggers.enableDebugDraw(true)
}