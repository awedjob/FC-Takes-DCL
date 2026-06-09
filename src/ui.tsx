import { UiEntity, Label, ReactEcs } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { score } from './target'
import { TheForgeUI } from './TheForge-SDK-UI'

export const uiMenu = () => [
    TheForgeUI(),
    Leaderboard()
]

export function Leaderboard() {
    return (
        <UiEntity uiTransform={{
            width: 'auto',
            height: 'auto',
            positionType: 'absolute',
            position: { top: "2%", right: 58 },
        }}>
            <UiEntity
                uiTransform={{
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: { top: 5, bottom: 5, left: 10, right: 10 },
                    display: score ? 'flex' : 'none',
                    minWidth: 250,
                }}
                uiBackground={{ color: Color4.White() }}
            >
                <UiEntity
                    uiTransform={{
                        width: 110,
                        height: 110,
                        margin: { bottom: 5 },
                    }}
                    uiBackground={{
                        textureMode: 'stretch',
                        texture: { src: 'assets/scene/JumpZone.png' }
                    }}
                />
                <Label
                    value="distance is"
                    color={Color4.Red()}
                    fontSize={30}
                    font="sans-serif"
                    textAlign="middle-center"
                />
                <Label
                    value={`${score} meters`}
                    color={Color4.Red()}
                    fontSize={40}
                    font="sans-serif"
                    textAlign="middle-center"
                />
            </UiEntity>
        </UiEntity>
    )
}