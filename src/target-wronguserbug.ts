// @ts-nocheck
import { AudioSource, engine, Entity, GltfContainer, Transform } from '@dcl/sdk/ecs'
import * as utils from '@dcl-sdk/utils'
import { Color3, Vector3 } from '@dcl/sdk/math'
import { LeaderBoard } from './leaderboard'
import { fetchScores, publishScore } from './serverHandler'
import { uiMenu } from './ui'
import { ACTION_ID, sendGenericAction } from './TheForge'

export let score: string = ""

export function target() {
    let playerPos = Vector3.create(0, 0, 0)
    
// this can be named better but for now I don't want to break anything. It correctly calculates the distance from the center the way it is now.
const target = engine.addEntity()
GltfContainer.create(target, { src: 'models/target.glb' })
Transform.create(target, {
  position: { x: 16, y: 0, z: 16 },
  scale: { x: 1, y: 1, z: 1 }
})

const leaderboard = new LeaderBoard(
    {
      position: Vector3.create(1, 2.5, 9.5),
      scale: Vector3.create(1.845, 1.845, 6)
    },
    10
  )

const arch = engine.addEntity()

Transform.create(arch, {
  position: { x: 16, y: 0, z: 16 },
  scale: { x: 1, y: 1, z: 1 }
})

// this will be a repeatable trigger. everytime they get to the ledge at the top of the arch it will make the target ready to be used.
utils.triggers.addTrigger(
    arch,
    1,
    1,
    [{ type: 'box', scale: {x:5,y:8,z:31}, position: Vector3.create(-17, 43.42, 15) }],
    () => {
    console.log('Player entered the trigger Jumparea')

        utils.triggers.oneTimeTrigger(
            target,
            utils.LAYER_2,
            utils.LAYER_1,
            [{ type: 'box' ,scale: {x:30,y:2,z:30}}],
            () => {
                playerPos = Transform.get(engine.PlayerEntity).position
                console.log('Player position:', playerPos)
                console.log('Distance from center:', compareToCenter(playerPos, Transform.get(target).position))
                publishScore( compareToCenter(playerPos, Transform.get(target).position), leaderboard)
                fetchScores(leaderboard)
                // Send distance score
                sendGenericAction(ACTION_ID, [
                  {id:"2838e6c9-f364-4ae2-bcff-d828eb92df76", value: compareToCenter(playerPos, Transform.get(target).position)},

                ])

                // Give out JZONE Tokens
                sendGenericAction("action_1755279382754_b5azxqqq2", [
                  

                ])
                
            },
            Color3.Yellow()
        )

    },
    () => {

    },
    Color3.Yellow()
  )
    // utils.triggers.enableDebugDraw(true)

    // refresh the leaderboard every 30 seconds (30000 milliseconds)
    fetchScores(leaderboard)
    utils.timers.setInterval(() => {
      fetchScores(leaderboard)
    }, 10000)

}
export function compareToCenter(posOne: Vector3, posTwo: Vector3): number {
    // Calculate the distance between two positions in the x-z plane
    // toFixed(3) will round the result to 3 decimal places
    // and parseFloat will convert it back to a number
    let diffX = posOne.x - posTwo.x
    let diffZ = posOne.z - posTwo.z
    let distance = Math.sqrt(diffX ** 2 + diffZ ** 2).toFixed(3)
    score = "Your Score is: " + distance
     utils.timers.setInterval(() => {
      score = ""
    }, 5000)   
    return parseFloat(distance)
}   
