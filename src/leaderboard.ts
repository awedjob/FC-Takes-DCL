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

export class LeaderBoard {
  currentData: LeaderBoardRow[] = []

  constructor(parent: Entity, size: number) {

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
  }

  updateBoard(scoreData: any[]) {
    for (let i = 0; i < this.currentData.length; i++) {
      if (i < scoreData.length) {
        // update score data
        this.currentData[i].updateValue(scoreData[i].name, scoreData[i].score.toString())
      } else {
        // create empty line
        this.currentData[i].updateValue('----', '----')
      }
    }
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
      position: Vector3.create(3, (index * - 0.67) - 1.5, 0),
      parent: parent
    })
    TextShape.create(this.scoreText, {
      text: score,
      fontSize: 5,
      textColor: Color4.Green(),
      width: 20,
      height: 10,
      textAlign: TextAlignMode.TAM_MIDDLE_RIGHT
    })
  }

  updateValue(name: string, score: string) {
    TextShape.getMutable(this.nameText).text = name
    TextShape.getMutable(this.scoreText).text = score
  }
}
