import { engine, Material, GltfContainer, InputAction, MeshCollider, MeshRenderer, pointerEventsSystem, Transform, MaterialTransparencyMode, EasingFunction, Tween, TweenLoop, TweenSequence } from '@dcl/sdk/ecs'
import { Color3, Quaternion, Vector3 } from '@dcl/sdk/math'
import * as utils from '@dcl-sdk/utils'
import { movePlayerTo } from '~system/RestrictedActions'

export function createArchTeleport() {
const myEntity = engine.addEntity()
MeshRenderer.setBox(myEntity)

Transform.create(myEntity, {
	position: { x: -26, y: 3, z: 48 },
    scale: { x: 0, y: 5, z: 5 },
})

MeshRenderer.setBox(myEntity)
Tween.create(myEntity, {
	mode: Tween.Mode.Rotate({
		start: Quaternion.fromEulerDegrees(0, 0, 0),
		end: Quaternion.fromEulerDegrees(180, 0, 0),
	}),
	duration: 3000,
	easingFunction: EasingFunction.EF_LINEAR,
})
TweenSequence.create(myEntity, {
	loop: TweenLoop.TL_RESTART,
	sequence: [
		{
			mode: Tween.Mode.Rotate({
				start: Quaternion.fromEulerDegrees(180, 0, 0),
				end: Quaternion.fromEulerDegrees(360, 0, 0),
			}),
			duration: 3000,
			easingFunction: EasingFunction.EF_LINEAR,
		},
	],
})

Material.setPbrMaterial(myEntity, {
    texture: Material.Texture.Common({
        src: 'assets/scene/PlasmaCircle.png',
    }),
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
})

utils.triggers.addTrigger(
    myEntity,
    1,
    1,
    [{ type: 'box', scale: {x:2,y:5,z:3}, position: Vector3.create(0, 0, 0) }],
    () => {
    const playerTransform = Transform.getOrNull(engine.PlayerEntity)
    if (!playerTransform) return
    const p = playerTransform.position
    const dist = Math.sqrt((p.x - (-26)) ** 2 + (p.z - 48) ** 2)
    if (dist < 4) {
        movePlayerTo({
            newRelativePosition: Vector3.create(-25, 50, 48),
            cameraTarget: Vector3.create(-32, 55.0, 56.0),
            avatarTarget: Vector3.create(-25.0, 50.0, 34),
        })
    }
},
    () => {},
    Color3.Yellow()
  )
      // utils.triggers.enableDebugDraw(true)
}