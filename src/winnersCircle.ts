import {
  Entity,
  TextAlignMode,
  TextShape,
  Transform,
  engine,
  MeshRenderer,
  Material,
  MaterialTransparencyMode,
  InputAction,
  MeshCollider,
  pointerEventsSystem,
} from '@dcl/sdk/ecs'
import { Color4, Vector3 } from '@dcl/sdk/math'
import { openExternalUrl } from '~system/RestrictedActions'

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
      text: 'Retired Champions',
      fontSize: 8,
      textColor: Color4.Yellow(),
      width: 16,
      height: 3,
      textAlign: TextAlignMode.TAM_MIDDLE_LEFT,
    })

    // Single tall background for entire thumbnail column
    const thumbnailBg = engine.addEntity()
    Transform.create(thumbnailBg, {
      position: Vector3.create(1.5, 2.125, -0.09),
      scale: Vector3.create(1.2, 8.5, 1),
      parent: parent,
    })
    MeshRenderer.setPlane(thumbnailBg)
    Material.setPbrMaterial(thumbnailBg, {
      albedoColor: Color4.create(0.3, 0.3, 0.3, 1),
    })

    // Rows — start just below the title, spread across full panel height
    for (let i = 0; i < size; i++) {
      this.rows.push(new WinnersCircleRow(parent, i))
    }
  }

  updateBoard(winnerData: { name: string; score: string; week: string; prizeName?: string; prizeImageUrl?: string }[]) {
    for (let i = 0; i < this.rows.length; i++) {
      if (i < winnerData.length) {
        this.rows[i].updateValue(
          winnerData[i].name,
          winnerData[i].score,
          winnerData[i].week,
          winnerData[i].prizeName ?? '',
          winnerData[i].prizeImageUrl ?? ''
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
  private prizeName: string = ''

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
      textColor: Color4.Yellow(),
      width: 12,
      height: 1.5,
      textAlign: TextAlignMode.TAM_MIDDLE_LEFT,
    })

    this.scoreText = engine.addEntity()
    Transform.create(this.scoreText, {
      position: Vector3.create(-3, y, -0.1),
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
      position: Vector3.create(-0.75, y, -0.1),
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

    this.thumbnail = engine.addEntity()
    Transform.create(this.thumbnail, {
      position: Vector3.create(1.5, y, -0.1),
      scale: Vector3.create(0.65, 0.65, 1),
      parent: parent,
    })
    MeshRenderer.setPlane(this.thumbnail)
    MeshCollider.setPlane(this.thumbnail)

    // Set up pointer events for the prize thumbnail
    pointerEventsSystem.onPointerDown(
      {
        entity: this.thumbnail,
        opts: {
          hoverText: 'Prize',
          button: InputAction.IA_PRIMARY,
        },
      },
      () => {
        // Open Farcaster Pack collection
        openExternalUrl({
          url: 'https://decentraland.org/marketplace/collections/0xb0d0d31910da4a14d4e05a9d51b6e9a99a85d676',
        })
      }
    )

    Material.setPbrMaterial(this.thumbnail, {
      albedoColor: Color4.create(0.2, 0.2, 0.2, 1),
    })
  }

  updateValue(name: string, score: string, week: string, prizeName: string, prizeImageUrl: string) {
    TextShape.getMutable(this.nameText).text = name
    TextShape.getMutable(this.scoreText).text = score
    TextShape.getMutable(this.weekText).text = week
    this.prizeName = prizeName || 'Prize'

    // Update hover text to show the prize name
    pointerEventsSystem.onPointerDown(
      {
        entity: this.thumbnail,
        opts: {
          hoverText: this.prizeName,
          button: InputAction.IA_PRIMARY,
        },
      },
      () => {
        openExternalUrl({
          url: 'https://decentraland.org/marketplace/collections/0xb0d0d31910da4a14d4e05a9d51b6e9a99a85d676',
        })
      }
    )

    if (prizeImageUrl) {
      Material.setPbrMaterial(this.thumbnail, {
        albedoColor: Color4.White(),
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
