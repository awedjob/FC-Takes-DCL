import { engine, Material, GltfContainer, InputAction, MeshCollider, MeshRenderer, pointerEventsSystem, Transform, MaterialTransparencyMode, EasingFunction, Tween, TweenLoop, TweenSequence } from '@dcl/sdk/ecs'
import { Color3, Quaternion, Vector3 } from '@dcl/sdk/math'
import * as utils from '@dcl-sdk/utils'
import { movePlayerTo } from '~system/RestrictedActions'

export function createArchTeleport() {
const myEntity = engine.addEntity()
MeshRenderer.setBox(myEntity)

Transform.create(myEntity, {
	position: { x: -10, y: 3, z: 32 },
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
    console.log('Player entered Arch Teleport trigger')

    movePlayerTo({
			newRelativePosition: Vector3.create(-9, 50, 32),
			cameraTarget: Vector3.create(-16 , 55.0, 40.0),
			avatarTarget: Vector3.create(-9.0 , 50.0, 18),
		})

        },
           


    () => {

    },
    Color3.Yellow()
  )
    //   utils.triggers.enableDebugDraw(true)
}
