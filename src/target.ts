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

// Target entity - always visible in the scene
const targetEntity = engine.addEntity()
GltfContainer.create(targetEntity, {
  src: 'models/target.glb',
  visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS,
  invisibleMeshesCollisionMask: ColliderLayer.CL_NONE,
})
Transform.create(targetEntity, {
  position: { x: 8, y: 0, z: 32 },
  scale: { x: 1, y: 1, z: 1 }
})

const { leaderboard, winnersCircle, updateCurrentPrize } = createCombinedBoard()

const arch = engine.addEntity()

Transform.create(arch, {
  position: { x: 0, y: 0, z: 32 },
  scale: { x: 1, y: 1, z: 1 }
})

// Native TriggerAreas fire for EVERY avatar in the scene, including remote
// players on a deployed realm. The library passes the entity that entered the
// area to the callback, so each stage ignores anything but engine.PlayerEntity.
//
// All three triggers are STATIC — created once here and never added or removed
// again. Creating/destroying TriggerAreas mid-fall forced a physics rebuild on
// the deployed client and froze the avatar mid-air for 1-2s. The cascade order
// (arch → secondary → target) is enforced purely by the two flags.

// Arch trigger: marks the local player as having started a jump
utils.triggers.addTrigger(
    arch,
    1,
    1,
    [{ type: 'box', scale: {x:5,y:8,z:31}, position: Vector3.create(-17, 43.42, 15) }],
    (enteredEntity) => {
        if (enteredEntity !== engine.PlayerEntity) return

        localPlayerJumping = true
        passedSecondaryTrigger = false
        console.log('Local player entered jump zone - ready to record score')
    },
    () => {},
    Color3.Yellow()
)

// Secondary trigger: thin sheet at y=3 over the target area confirms the
// local player is falling toward the target after passing the arch
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
    (fallingEntity) => {
        if (fallingEntity !== engine.PlayerEntity) return
        if (!localPlayerJumping) return

        passedSecondaryTrigger = true
        console.log('Local player passed secondary trigger - confirmed falling')
    },
    () => {},
    Color3.Yellow()
)

// Target trigger: records the score only when the full arch → secondary
// sequence was completed by the local player, then clears the flags so a
// new jump is required for the next score
utils.triggers.addTrigger(
    targetEntity,
    utils.LAYER_2,
    utils.LAYER_1,
    [{ type: 'box' ,scale: {x:30,y:2,z:30}}],
    (landingEntity) => {
        if (landingEntity !== engine.PlayerEntity) return
        if (!localPlayerJumping || !passedSecondaryTrigger) {
            console.log('Score ignored - jump sequence not completed')
            return
        }

        localPlayerJumping = false
        passedSecondaryTrigger = false

        playerPos = Transform.get(engine.PlayerEntity).position
        const targetPos = Transform.get(targetEntity).position
        const distanceFromCenter = compareToCenter(playerPos, targetPos)
        publishScore(distanceFromCenter, leaderboard)
        fetchScores(leaderboard)
        sendGenericAction(ACTION_ID, [
          {id:"2838e6c9-f364-4ae2-bcff-d828eb92df76", value: distanceFromCenter},
        ])
        sendGenericAction("action_1755279382754_b5azxqqq2", [])
    },
    () => {},
    Color3.Yellow()
)

// utils.triggers.enableDebugDraw(true)

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