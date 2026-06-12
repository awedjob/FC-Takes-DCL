import {
  Entity,
  TextAlignMode,
  TextShape,
  Transform,
  engine,
  Material,
  MeshRenderer,
} from '@dcl/sdk/ecs'
import { Color4, 
        Quaternion, 
        Vector3 
} from '@dcl/sdk/math'
import { createLogo } from './logo'
import { createTeleport } from './teleport'

// Names of retired champions (past Winners Circle winners). Their leaderboard
// rows render gold with a star so other players know those scores are not
// competing for this week's prize.
let retiredChampions = new Set<string>()
let activeBoard: LeaderBoard | null = null

export function setRetiredChampions(names: string[]) {
  retiredChampions = new Set(names)
  if (activeBoard) activeBoard.refresh()
}

export class LeaderBoard {
  currentData: LeaderBoardRow[] = []
  lastScoreData: any[] = []

  constructor(parent: Entity, size: number) {
    activeBoard = this

    createLogo(parent)
    createTeleport(parent)

    const titleText = engine.addEntity()
    Transform.create(titleText, {
      position: Vector3.create(-2, 4.33, -0.1),
      rotation: Quaternion.fromEulerDegrees(0, 0, 0),
      scale: Vector3.create(1, 1, 1),
      parent: parent
    })
    TextShape.create(titleText, {
      text: 'Leaderboard',
      fontSize: 8,
      textColor: Color4.White(),
      width: 20,
      height: 10,
      textAlign: TextAlignMode.TAM_MIDDLE_CENTER,
    })

    for (let i = 0; i < size; i++) {
      this.currentData.push(new LeaderBoardRow(titleText, i, '----', '----'))
    }

    // Legend at the bottom of the board explaining the star marker
    const legendText = engine.addEntity()
    Transform.create(legendText, {
      // x matches the player name column's left anchor (titleText x -2 + row x -3)
      position: Vector3.create(-5, -5.25, -0.1),
      parent: parent
    })
    TextShape.create(legendText, {
      text: '★ Retired Champions may play but are ineligible to win this week.',
      fontSize: 2,
      textColor: Color4.Yellow(),
      width: 20,
      height: 2,
      textAlign: TextAlignMode.TAM_MIDDLE_LEFT,
    })
  }

  updateBoard(scoreData: any[]) {
    this.lastScoreData = scoreData
    for (let i = 0; i < this.currentData.length; i++) {
      if (i < scoreData.length) {
        // update score data
        const retired = retiredChampions.has(scoreData[i].name)
        this.currentData[i].updateValue(scoreData[i].name, scoreData[i].score.toString(), retired)
      } else {
        // create empty line
        this.currentData[i].updateValue('----', '----', false)
      }
    }
  }

  // Re-apply the last fetched scores, e.g. after the retired champions list arrives
  refresh() {
    this.updateBoard(this.lastScoreData)
  }
}

export class LeaderBoardRow {
  nameText: Entity
  scoreText: Entity

  constructor(parent: Entity, index: number, name: string, score: string) {
    this.nameText = engine.addEntity()
    Transform.create(this.nameText, {
      position: Vector3.create(-3, (index * - 0.67) - 1.5, 0),
      parent: parent
    })
    TextShape.create(this.nameText, {
      text: name,
      fontSize: 5,
      textColor: Color4.White(),
      width: 20,
      height: 10,
      textAlign: TextAlignMode.TAM_MIDDLE_LEFT
    })

    this.scoreText = engine.addEntity()
    Transform.create(this.scoreText, {
      position: Vector3.create(4, (index * - 0.67) - 1.5, 0),
      parent: parent
    })
    TextShape.create(this.scoreText, {
      text: score,
      fontSize: 5,
      textColor: Color4.White(),
      width: 20,
      height: 10,
      textAlign: TextAlignMode.TAM_MIDDLE_RIGHT
    })
  }

  updateValue(name: string, score: string, retired: boolean) {
    const nameShape = TextShape.getMutable(this.nameText)
    const scoreShape = TextShape.getMutable(this.scoreText)
    nameShape.text = retired ? '★ ' + name : name
    nameShape.textColor = retired ? Color4.Yellow() : Color4.White()
    scoreShape.text = score
    scoreShape.textColor = retired ? Color4.Yellow() : Color4.White()
  }
}
