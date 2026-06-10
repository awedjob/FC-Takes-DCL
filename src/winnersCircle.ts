import {
  Entity,
  TextAlignMode,
  TextShape,
  Transform,
  engine,
  MeshRenderer,
  Material,
  MaterialTransparencyMode,
} from '@dcl/sdk/ecs'
import { Color4, Vector3 } from '@dcl/sdk/math'

export class WinnersCircle {
  private rows: WinnersCircleRow[] = []

  constructor(parent: Entity, size: number) {

    // Title — single line, left-justified
    const titleText = engine.addEntity()
    Transform.create(titleText, {
      position: Vector3.create(-7.5, 7.33, -0.1),
      parent: parent,
    })
    TextShape.create(titleText, {
      text: 'Winners Circle',
      fontSize: 8,
      textColor: Color4.Yellow(),
      width: 16,
      height: 3,
      textAlign: TextAlignMode.TAM_MIDDLE_LEFT,
    })

    // Rows — start just below the title, spread across full panel height
    for (let i = 0; i < size; i++) {
      this.rows.push(new WinnersCircleRow(parent, i))
    }
  }

  updateBoard(winnerData: { name: string; score: string; week: string; prizeImageUrl?: string; prizeName?: string }[]) {
    for (let i = 0; i < this.rows.length; i++) {
      if (i < winnerData.length) {
        this.rows[i].updateValue(
          winnerData[i].name,
          winnerData[i].score,
          winnerData[i].week,
          winnerData[i].prizeImageUrl ?? '',
          winnerData[i].prizeName ?? ''
        )
      } else {
        this.rows[i].updateValue('----', '----', '----', '', '')
      }
    }
  }
}

class WinnersCircleRow {
  private nameText: Entity
  private scoreText: Entity
  private weekText: Entity
  private thumbnail: Entity
  private thumbnailBackground: Entity
  private prizeNameText: Entity

  constructor(parent: Entity, index: number) {
    // 12 rows from y=5.83 down, step 0.67 — matches Leaderboard row positions exactly
    const y = 5.83 - index * 0.67

    this.nameText = engine.addEntity()
    Transform.create(this.nameText, {
      position: Vector3.create(-7.5, y, -0.1),
      parent: parent,
    })
    TextShape.create(this.nameText, {
      text: '----',
      fontSize: 4.5,
      textColor: Color4.White(),
      width: 12,
      height: 1.5,
      textAlign: TextAlignMode.TAM_MIDDLE_LEFT,
    })

    this.scoreText = engine.addEntity()
    Transform.create(this.scoreText, {
      position: Vector3.create(-1.5, y, -0.1),
      parent: parent,
    })
    TextShape.create(this.scoreText, {
      text: '----',
      fontSize: 4,
      textColor: Color4.Yellow(),
      width: 5,
      height: 1.5,
      textAlign: TextAlignMode.TAM_MIDDLE_CENTER,
    })

    this.weekText = engine.addEntity()
    Transform.create(this.weekText, {
      position: Vector3.create(2.5, y, -0.1),
      parent: parent,
    })
    TextShape.create(this.weekText, {
      text: '----',
      fontSize: 3.5,
      textColor: Color4.create(0.6, 0.6, 0.6, 1),
      width: 6,
      height: 1.5,
      textAlign: TextAlignMode.TAM_MIDDLE_CENTER,
    })

    // Dark gray background behind thumbnail
    this.thumbnailBackground = engine.addEntity()
    Transform.create(this.thumbnailBackground, {
      position: Vector3.create(7.8, y, -0.11),
      scale: Vector3.create(1.2, 0.8, 1),
      parent: parent,
    })
    MeshRenderer.setPlane(this.thumbnailBackground)
    Material.setPbrMaterial(this.thumbnailBackground, {
      albedoColor: Color4.create(0.3, 0.3, 0.3, 1),
    })

    this.thumbnail = engine.addEntity()
    Transform.create(this.thumbnail, {
      position: Vector3.create(7.8, y, -0.1),
      scale: Vector3.create(0.65, 0.65, 1),
      parent: parent,
    })
    MeshRenderer.setPlane(this.thumbnail)
    Material.setPbrMaterial(this.thumbnail, {
      albedoColor: Color4.create(0.2, 0.2, 0.2, 1),
    })

    // Prize name text (tooltip on hover effect)
    this.prizeNameText = engine.addEntity()
    Transform.create(this.prizeNameText, {
      position: Vector3.create(7.8, y - 0.6, -0.1),
      parent: parent,
    })
    TextShape.create(this.prizeNameText, {
      text: '',
      fontSize: 2.5,
      textColor: Color4.White(),
      width: 5,
      height: 1,
      textAlign: TextAlignMode.TAM_MIDDLE_CENTER,
    })
  }

  updateValue(name: string, score: string, week: string, prizeImageUrl: string, prizeName?: string) {
    TextShape.getMutable(this.nameText).text = name
    TextShape.getMutable(this.scoreText).text = score
    TextShape.getMutable(this.weekText).text = week
    TextShape.getMutable(this.prizeNameText).text = prizeName ?? ''
    if (prizeImageUrl) {
      Material.setPbrMaterial(this.thumbnail, {
        texture: Material.Texture.Common({ src: prizeImageUrl }),
        emissiveTexture: Material.Texture.Common({ src: prizeImageUrl }),
        emissiveIntensity: 0.8,
        transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
      })
    } else {
      Material.setPbrMaterial(this.thumbnail, {
        albedoColor: Color4.create(0.2, 0.2, 0.2, 1),
      })
    }
  }
}
