import { AudioSource, engine, Entity, GltfContainer, Transform } from '@dcl/sdk/ecs'
import * as utils from '@dcl-sdk/utils'
import { Color3, Vector3 } from '@dcl/sdk/math'

export function target() {
    let playerPos = Vector3.create(0, 0, 0)
    
// this can be named better but for now I don't want to break anything. It correctly calculates the distance from the center the way it is now.
const target = engine.addEntity()
GltfContainer.create(target, { src: 'models/target.glb' })
Transform.create(target, {
  position: { x: 16, y: 0, z: 16 },
  scale: { x: 1, y: 1, z: 1 }
})
// this is a null entity, it's center position was returning incorrect position informtion. We need the center position of the target and not the null.
const centerPos = engine.addEntity()
Transform.create(centerPos, {
    parent: target,
    position: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
})
// this will be a repeatable trigger. everytime they get to the ledge at the top of the arch it will make the target ready to be used.
utils.triggers.addTrigger(
    target,
    1,
    1,
    [{ type: 'box', scale: {x:5,y:8,z:31}, position: Vector3.create(-17, 43.42, 15) }],
    () => {
    console.log('Player entered the trigger Jumparea')

        utils.triggers.oneTimeTrigger(
            centerPos,
            utils.LAYER_2,
            utils.LAYER_1,
            [{ type: 'box' ,scale: {x:30,y:2,z:30}}],
            () => {
                playerPos = Transform.get(engine.PlayerEntity).position
                console.log('Player position:', playerPos)
                console.log('Distance from center:', compareToCenter(playerPos, Transform.get(target).position))
                
            },
            Color3.Yellow()
        )

    },
    () => {

    },
    Color3.Yellow()
  )
    utils.triggers.enableDebugDraw(true)
}
export function compareToCenter(posOne: Vector3, posTwo: Vector3): number {
    // Calculate the distance between two positions in the x-z plane
    let diffX = posOne.x - posTwo.x
    let diffZ = posOne.z - posTwo.z
    let distance = Math.sqrt(diffX ** 2 + diffZ ** 2)
    return distance
}   
