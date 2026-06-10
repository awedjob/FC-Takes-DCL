import { AudioSource, ColliderLayer, engine, Entity, GltfContainer, Transform } from '@dcl/sdk/ecs'
import * as utils from '@dcl-sdk/utils'
import { Color3, Vector3 } from '@dcl/sdk/math'
import { createCombinedBoard } from './combinedBoard'
import { fetchScores, publishScore, fetchWinners, fetchCurrentPrize } from './serverHandler'
import { uiMenu } from './ui'
import { ACTION_ID, sendGenericAction } from './TheForge'

export let score: string = ""

// Flag: only true when the LOCAL player has entered the arch jump zone
let localPlayerJumping = false

// Flag: only true when the LOCAL player has passed through the secondary trigger (mid-fall)
let passedSecondaryTrigger = false

export function target() {
    let playerPos = Vector3.create(0, 0, 0)
    
// this can be named better but for now I don't want to break anything. It correctly calculates the distance from the center the way it is now.
const target = engine.addEntity()
GltfContainer.create(target, {
  src: 'models/target.glb',
  visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS,
  invisibleMeshesCollisionMask: ColliderLayer.CL_NONE,
})
Transform.create(target, {
  position: { x: 8, y: 0, z: 32 },
  scale: { x: 1, y: 1, z: 1 }
})

const { leaderboard, winnersCircle, updateCurrentPrize } = createCombinedBoard()

const arch = engine.addEntity()

Transform.create(arch, {
  position: { x: 0, y: 0, z: 32 },
  scale: { x: 1, y: 1, z: 1 }
})

// Arch trigger - created at start
utils.triggers.addTrigger(
    arch,
    1,
    1,
    [{ type: 'box', scale: {x:5,y:8,z:31}, position: Vector3.create(-17, 43.42, 15) }],
    () => {
        const localPos = Transform.get(engine.PlayerEntity).position
        const dx = Math.abs(localPos.x - (-17))
        const dy = Math.abs(localPos.y - 43.42)
        const dz = Math.abs(localPos.z - 47)
        if (dx < 2.5 && dy < 4 && dz < 15.5) {
            localPlayerJumping = true
            console.log('Local player entered jump zone - ready to record score')
        } else {
            console.log('Arch trigger fired by another player, not setting jump flag')
        }

        // Create secondary trigger when arch is triggered
        const secondaryTrigger = engine.addEntity()
        Transform.create(secondaryTrigger, {
            position: { x: 8, y: 3, z: 32 },
            scale: { x: 1, y: 1, z: 1 }
        })

        utils.triggers.addTrigger(
            secondaryTrigger,
            1,
            1,
            [{ type: 'box', scale: {x:30,y:0.5,z:30} }],
            () => {
                const localPos = Transform.get(engine.PlayerEntity).position
                const dx = Math.abs(localPos.x - 8)
                const dz = Math.abs(localPos.z - 32)
                if (dx < 15 && dz < 15 && localPlayerJumping) {
                    passedSecondaryTrigger = true
                    console.log('Local player passed secondary trigger - confirmed falling')

                    // Remove secondary trigger since it's no longer needed
                    engine.removeEntity(secondaryTrigger)

                    // Create target trigger when secondary is triggered
                    utils.triggers.oneTimeTrigger(
                        target,
                        utils.LAYER_2,
                        utils.LAYER_1,
                        [{ type: 'box' ,scale: {x:30,y:2,z:30}}],
                        () => {
                            if (!localPlayerJumping) {
                                console.log('Score ignored - local player did not jump')
                                return
                            }
                            if (!passedSecondaryTrigger) {
                                console.log('Score ignored - local player did not pass through secondary trigger')
                                return
                            }

                            localPlayerJumping = false
                            passedSecondaryTrigger = false

                            playerPos = Transform.get(engine.PlayerEntity).position
                            const targetPos = Transform.get(target).position
                            const distanceFromCenter = compareToCenter(playerPos, targetPos)
                            publishScore(distanceFromCenter, leaderboard)
                            fetchScores(leaderboard)
                            sendGenericAction(ACTION_ID, [
                              {id:"2838e6c9-f364-4ae2-bcff-d828eb92df76", value: distanceFromCenter},
                            ])
                            sendGenericAction("action_1755279382754_b5azxqqq2", [])
                        },
                        Color3.Yellow()
                    )
                }
            },
            () => {},
            Color3.Yellow()
        )
    },
    () => {},
    Color3.Yellow()
)

utils.triggers.enableDebugDraw(true)

    // Fetch leaderboard on load and refresh every 30s
    fetchScores(leaderboard)
    utils.timers.setInterval(() => {
      fetchScores(leaderboard)
    }, 30000)

    // Fetch Winners Circle data on load and refresh every 5 minutes
    fetchWinners(winnersCircle)
    fetchCurrentPrize((name, imageUrl) => {
      updateCurrentPrize(name, imageUrl)
    })
    utils.timers.setInterval(() => {
      fetchWinners(winnersCircle)
      fetchCurrentPrize((name, imageUrl) => {
        updateCurrentPrize(name, imageUrl)
      })
    }, 300000)

}
export function compareToCenter(posOne: Vector3, posTwo: Vector3): number {
    // Calculate the distance between two positions in the x-z plane
    // toFixed(3) will round the result to 3 decimal places
    // and parseFloat will convert it back to a number
    let diffX = posOne.x - posTwo.x
    let diffZ = posOne.z - posTwo.z
    let distance = Math.sqrt(diffX ** 2 + diffZ ** 2).toFixed(3)
    score = distance
     utils.timers.setTimeout(() => {
      score = ""
    }, 5000)   
    return parseFloat(distance)
}