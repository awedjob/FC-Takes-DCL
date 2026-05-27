import { engine, Transform, MeshRenderer, Material, MeshCollider, pointerEventsSystem, InputAction } from "@dcl/sdk/ecs"
import * as utils from '@dcl-sdk/utils'
import { toggleArtReward } from "./artreward"
import { Color4, Quaternion } from "@dcl/sdk/math"
import { openExternalUrl } from "~system/RestrictedActions"

let timer = 0
let viewingArt = false
// set the required viewing time to 5 minutes
let recviewingTime = 30


export function artTimer(dt: number) {
    // Update art-related entities or logic here
    // console.log('Art timer running with dt:', dt)
    if (viewingArt) {
        timer += dt
        console.log('Art timer running:', timer)
        if (timer > recviewingTime) {
            console.log('Art viewing time exceeded:', timer)
            // Reset the timer and stop viewing art after 5 minutes
            timer = 0
            viewingArt = false
            // remove the timer and stop counting
            engine.removeSystem(artTimer)

            // call toggleArtReward
            toggleArtReward()
        }
    }
}

export function createArtTriggers() {
    // Create triggers for art-related interactions 
    let artTrigger01 = engine.addEntity()
    Transform.create(artTrigger01, {
        position: { x: -9.5, y: 2, z: 46.5 },
        scale: { x: 2.75, y: 10, z: 1 }
    })

    // MeshRenderer.setBox(artTrigger01)
    utils.triggers.addTrigger(artTrigger01, utils.NO_LAYERS, utils.LAYER_1, [{ type: 'box', scale: { x: 2.75, y: 10, z: 1 } }], () => {

        viewingArt = !viewingArt
    },)
    
    let artTrigger02 = engine.addEntity()
    Transform.create(artTrigger02, {
        position: { x: -9.5, y: 2, z: 18 },
        scale: { x: 2.75, y: 10, z: 1 }
    })

    // MeshRenderer.setBox(artTrigger02)
    utils.triggers.addTrigger(artTrigger02, utils.NO_LAYERS, utils.LAYER_1, [{ type: 'box', scale: { x: 2.75, y: 10, z: 1 } }], () => {

        viewingArt = !viewingArt
    },)

     let artTrigger03 = engine.addEntity()
    Transform.create(artTrigger03, {
        position: { x: -10.5, y: 39, z: 32.3 },
        scale: { x: 2, y: 3, z: 7 }
    })

    // MeshRenderer.setBox(artTrigger03)
    utils.triggers.addTrigger(artTrigger03, utils.NO_LAYERS, utils.LAYER_1, [{ type: 'box', scale: { x: 2, y: 3, z: 7 } }], () => {

        viewingArt = !viewingArt
    },)
}


let artEntities = [
    ////////////////// SOUTH GALLERY //////////////////

    // Floor #00 South Leg
    {
        transform: {position: {x: -10, y: 3.1, z: 22.13}, 
        scale: {x: 1, y: 1, z: 1}},
        artwork: [
            {link: 'https://app.manifold.xyz/c/bloomwoven-thought-fluttering-realities', 
                name: 'Fluttering Realities', 
                src: 'assets/scene/Bloomwoven_Thought_Fluttering_Realities.png', 
                transform: {
                    rotation: Quaternion.fromEulerDegrees(0, -90, 0), 
                    position: {x: -6.14, y: 0, z: -0.125}, 
                    scale: {x: 5, y: 5, z: 1}}},
        ]
    },
    ///////////////////////////////////////////////////////////////////////

    // Floor #01 South Leg
    {
        transform: {position: {x: -10, y: 7, z: 22.13}, 
        scale: {x: 1, y: 1, z: 1}},
        artwork: [
            {link: 'https://exchange.art/single/6wQfog9hqxYFc2DcNo1wH8NMn2GdHGTAiwf9kZkjBK1M', 
                name: 'Galactic Nebula', 
                src: 'assets/scene/Universe_Vogue_Galactic_Nebula.png', 
                transform: {
                    rotation: Quaternion.fromEulerDegrees(0, 90, 0), 
                    position: {x: 7.0, y: 0, z: -0.125}, 
                    scale: {x: 5, y: 5, z: 1}}},
        ]
    },
    ///////////////////////////////////////////////////////////////////////

    // Floor #02 South Leg
    {
        transform: {position: {x: -10, y: 11.5, z: 22.13}, 
        scale: {x: 1, y: 1, z: 1}},
        artwork: [
            {link: 'https://exchange.art/single/FeuNmFPZEMwSLVHBhiLpxDPvyKJfeqHxyV6e2qYcajWC', 
                name: 'Plumed Rhapsody', 
                src: 'assets/scene/Raven_Requiem_Plumed_Rhapsody.png', 
                transform: {
                    rotation: Quaternion.fromEulerDegrees(0, -90, 0), 
                    position: {x: -6.14, y: 0, z: 0}, 
                    scale: {x: 5, y: 5, z: 1}}},
        ]
    },
    ///////////////////////////////////////////////////////////////////////

        // Floor #03 South Leg
    {
        transform: {position: {x: -10, y: 15.5, z: 22.13}, 
        scale: {x: 1, y: 1, z: 1}},
        artwork: [
            {link: 'https://www.syky.com/piece/BASE/0xec3832f85d547de2e22e66314b6f7d07519c67ed/3000668/gothic-bloom-apparition-in-this-dress-i-speak-in-tongues', 
                name: 'Gothic Bloom', 
                src: 'assets/scene/Gothic_Bloom_Apparition_In_This_Dress_I_Speak_in_Tongues.png', 
                transform: {
                    rotation: Quaternion.fromEulerDegrees(0, 90, 0), 
                    position: {x: 7.0, y: 0, z: 0}, 
                    scale: {x: 4, y: 6.14, z: 1}}},
        ]
    },
    ///////////////////////////////////////////////////////////////////////

        // Floor #04 South Leg
    {
        transform: {position: {x: -10, y: 18, z: 22.13}, 
        scale: {x: 1, y: 1, z: 1}},
        artwork: [
            {link: 'https://www.transient.xyz/mint/base-creators', 
                name: 'Base Creators 1/13', 
                src: 'assets/scene/base_creators.png', 
                transform: {
                    rotation: Quaternion.fromEulerDegrees(0, -90, 0), 
                    position: {x: -6.14, y: 0, z: 2.25}, 
                    scale: {x: 2, y: 3, z: 1}}},
        ]
    },
    ///////////////////////////////////////////////////////////////////////

        // Floor #05 South Leg
    {
        transform: {position: {x: -10, y: 23, z: 22.13}, 
        scale: {x: 1, y: 1, z: 1}},
        artwork: [
            {link: 'https://exchange.art/single/2KVdF94sY7xcNZy1s4LYSYZ3oJo3FzXF9LhQ4E65LYbH', 
                name: 'Forest Pulse', 
                src: 'assets/scene/Forest_Pulse_Colorful_Contrast.png', 
                transform: {
                    rotation: Quaternion.fromEulerDegrees(0, 90, 0), 
                    position: {x: 7.0, y: 0, z: 0}, 
                    scale: {x: 5, y: 2.83, z: 1}}},
        ]
    },
    ///////////////////////////////////////////////////////////////////////

        // Floor #06 South Leg
    {
        transform: {position: {x: -10, y: 26, z: 22.13}, 
        scale: {x: 1, y: 1, z: 1}},
        artwork: [
            {link: 'https://highlight.xyz/mint/base:0x8FB8d3Ab682997Ae8006b7D72974E48DeB16BF43:0', 
                name: 'Life in Art', 
                src: 'assets/scene/Transformation_Seen_Life_in_Art.png', 
                transform: {
                    rotation: Quaternion.fromEulerDegrees(0, -90, 0), 
                    position: {x: -6.14, y: 0, z: 0}, 
                    scale: {x: 4.5, y: 7.7, z: 1}}},
        ]
    },
    ///////////////////////////////////////////////////////////////////////

        // Floor #07 South Leg
    {
        transform: {position: {x: -10, y: 29, z: 22.13}, 
        scale: {x: 1, y: 1, z: 1}},
        artwork: [
            {link: 'https://objkt.com/tokens/KT1Nn81b1r4D2uBxX2M1SNCEWC6YKU1wFnR2/1', 
                name: 'Ethereal Resonance', 
                src: 'assets/scene/Aurora_Notes_Ethereal_Resonance.png', 
                transform: {
                    rotation: Quaternion.fromEulerDegrees(0, 90, 0), 
                    position: {x: 7.0, y: 0, z: 0}, 
                    scale: {x: 4.5, y: 4.5, z: 1}}},
        ]
    },
    ///////////////////////////////////////////////////////////////////////

    ////////////////// CENTER GALLERY //////////////////

        // East Facing Center Gallery
    {
        transform: {position: {x: -10, y: 32.5, z: 32}, 
        scale: {x: 1, y: 1, z: 1}},
        artwork: [
            {link: 'https://exchange.art/single/6yrtbSwnVJTkSbv3FQxvKznzbDsHneHUJW6apQZ2AV5i', 
                name: 'Surreal Waltz', 
                src: 'assets/scene/Fantasys_Grace_Surreal_Waltz.png', 
                transform: {
                    rotation: Quaternion.fromEulerDegrees(0, 90, 0), 
                    position: {x: 7.0, y: 0, z: 0.5}, 
                    scale: {x: 4, y: 4, z: 1}}},
        ]
    },
    ///////////////////////////////////////////////////////////////////////

        // West Facing Center Gallery
    {
        transform: {position: {x: -10, y: 35, z: 32}, 
        scale: {x: 1, y: 1, z: 1}},
        artwork: [
            {link: 'https://exchange.art/single/42iQDj1wPBx9swDw3TNrKufTaE94UVBh6Yh1JJLq3hxa', 
                name: 'Papillon Dream', 
                src: 'assets/scene/Floral_Whisper_Papillon_Dream.png', 
                transform: {
                    rotation: Quaternion.fromEulerDegrees(0, -90, 0), 
                    position: {x: -6.14, y: 0, z: 0}, 
                    scale: {x: 7.7, y: 7.7, z: 1}}},
        ]
    },
    ///////////////////////////////////////////////////////////////////////

    ////////////////// NORTH GALLERY //////////////////

    // Floor #00 North Leg
    {
        transform: {position: {x: -10, y: 3.1, z: 42.6}, 
        scale: {x: 1, y: 1, z: 1}},
        artwork: [
            {link: 'https://objkt.com/tokens/KT1Nn81b1r4D2uBxX2M1SNCEWC6YKU1wFnR2/0', 
                name: 'Data Diva', 
                src: 'assets/scene/Cybernetic_Muse_Data_Diva.png', 
                transform: {
                    rotation: Quaternion.fromEulerDegrees(0, -90, 0), 
                    position: {x: -6.14, y: 0, z: -0.125}, 
                    scale: {x: 5, y: 5, z: 1}}},
        ]
    },
    ///////////////////////////////////////////////////////////////////////

    // Floor #01 North Leg
    {
        transform: {position: {x: -10, y: 6.25, z: 42.6}, 
        scale: {x: 1, y: 1, z: 1}},
        artwork: [
            {link: 'https://zora.co/coin/base:0x295ae049d08fde69d677a10a16490522dec408fd?referrer=0x4dd4512c786a569f9faf05a82ee616a13fe24732', 
                name: 'Be Fearless', 
                src: 'assets/scene/Be_Fearless.png', 
                transform: {
                    rotation: Quaternion.fromEulerDegrees(0, 90, 0), 
                    position: {x: 7.0, y: 0, z: -0.125}, 
                    scale: {x: 4.1, y: 6.14, z: 1}}},
        ]
    },
    ///////////////////////////////////////////////////////////////////////

    // Floor #02 North Leg
    {
        transform: {position: {x: -10, y: 11.5, z: 42.6}, 
        scale: {x: 1, y: 1, z: 1}},
        artwork: [
            {link: 'https://objkt.com/tokens/KT1MQm9a16ZkKhu7SdxdnFm8GwtqSnGXpCvF/0', 
                name: 'Skull Regalia', 
                src: 'assets/scene/Eclipse_Tiara_Skull_Regalia.png', 
                transform: {
                    rotation: Quaternion.fromEulerDegrees(0, -90, 0), 
                    position: {x: -6.14, y: 0, z: -0.125}, 
                    scale: {x: 3.84, y: 5, z: 1}}},
        ]
    },
    ///////////////////////////////////////////////////////////////////////

        // Floor #03 North Leg
    {
        transform: {position: {x: -10, y: 15.5, z: 42.6}, 
        scale: {x: 1, y: 1, z: 1}},
        artwork: [
            {link: 'https://zora.co/coin/base:0x749325903af76ac17b78622ba7c6690a5c034316?referrer=0x4dd4512c786a569f9faf05a82ee616a13fe24732', 
                name: 'Velvet Benediction', 
                src: 'assets/scene/Velvet_Benediction.png', 
                transform: {
                    rotation: Quaternion.fromEulerDegrees(0, 90, 0), 
                    position: {x: 7.0, y: 0, z: 0}, 
                    scale: {x: 4, y: 6.14, z: 1}}},
        ]
    },
    ///////////////////////////////////////////////////////////////////////

        // Floor #04 North Leg
    {
        transform: {position: {x: -10, y: 18, z: 42.6}, 
        scale: {x: 1, y: 1, z: 1}},
        artwork: [
            {link: 'https://www.transient.xyz/mint/base-creators', 
                name: 'Base Creators 4/13', 
                src: 'assets/scene/base_creators02.png', 
                transform: {
                    rotation: Quaternion.fromEulerDegrees(0, -90, 0), 
                    position: {x: -6.14, y: 0, z: -2.25}, 
                    scale: {x: 2, y: 3, z: 1}}},
        ]
    },
    ///////////////////////////////////////////////////////////////////////

        // Floor #05 North Leg
    {
        transform: {position: {x: -10, y: 23, z: 42.6}, 
        scale: {x: 1, y: 1, z: 1}},
        artwork: [
            {link: 'https://highlight.xyz/mint/base:0x4b54DffD86Aa71895AA9C505ACf8a95aBDfc5419', 
                name: 'Abundance Abound', 
                src: 'assets/scene/Living_in_Pronoia_Abundance_Abound.png', 
                transform: {
                    rotation: Quaternion.fromEulerDegrees(0, 90, 0), 
                    position: {x: 7.0, y: 0, z: 0}, 
                    scale: {x: 5, y: 2.83, z: 1}}},
        ]
    },
    ///////////////////////////////////////////////////////////////////////

        // Floor #06 North Leg
    {
        transform: {position: {x: -10, y: 25.5, z: 42.6}, 
        scale: {x: 1, y: 1, z: 1}},
        artwork: [
            {link: 'https://highlight.xyz/mint/base:0x8FB8d3Ab682997Ae8006b7D72974E48DeB16BF43:0', 
                name: 'Oracles in Bloom', 
                src: 'assets/scene/Oracles_in_Bloom_Dressed_for_the_Uprising.png', 
                transform: {
                    rotation: Quaternion.fromEulerDegrees(0, -90, 0), 
                    position: {x: -6.14, y: 0, z: -0.10}, 
                    scale: {x: 4.1, y: 6.14, z: 1}}},
        ]
    },
    ///////////////////////////////////////////////////////////////////////

        // Floor #07 North Leg
    {
        transform: {position: {x: -10, y: 29, z: 42.6}, 
        scale: {x: 1, y: 1, z: 1}},
        artwork: [
            {link: 'https://www.syky.com/piece/BASE/0xec3832f85d547de2e22e66314b6f7d07519c67ed/3000666/seer-of-the-shattered-pattern-pin-me-to-the-cross-stitch', 
                name: 'Seer of the Shattered', 
                src: 'assets/scene/Seer_of_the_Shattered_Pattern_Pin_Me_to_the_Cross-Stitch.png', 
                transform: {
                    rotation: Quaternion.fromEulerDegrees(0, 90, 0), 
                    position: {x: 7.0, y: 0, z: 0}, 
                    scale: {x: 4.1, y: 6.14, z: 1}}},
        ]
    },
    ///////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////

]
export function createArt(){
    artEntities.forEach(entity => {
        const artEntity = engine.addEntity()
        Transform.create(artEntity, entity.transform)
        // MeshRenderer.setBox(artEntity)
    

        entity.artwork.forEach(artwork => {
            const artPiece = engine.addEntity()
            Transform.create(artPiece, { ...artwork.transform, parent: artEntity })
            MeshRenderer.setPlane(artPiece)
            MeshCollider.setPlane(artPiece)

            pointerEventsSystem.onPointerDown({
                entity: artPiece,
                opts: {
                    hoverText: artwork.name,
                    button: InputAction.IA_PRIMARY,
                }
            },
            () => {
                openExternalUrl({
                    url: artwork.link
                })
            })

            Material.setPbrMaterial(artPiece, {
                texture: Material.Texture.Common({ src: artwork.src }),
                emissiveTexture: Material.Texture.Common({ src: artwork.src }),
                emissiveIntensity: 1,
                emissiveColor: Color4.White()
            })
        })
    })
}

