import { engine, UiCanvasInformation } from '@dcl/sdk/ecs'
import ReactEcs, { Input, Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'
import { ForgeConnect, forgeConnected, player, serverUrl, setShowChatIcon, setShowLoginSplashScreen, showChatIcon, showForgeUI, showLoginSplashScreen, token, showLeaderboard, leaderboardData, leaderboardError, isLoadingLeaderboard, leaderboardDisplayMode, leaderboardWidth, leaderboardHeight, showLeaderboardBackground, showLeaderboardRowBackground, leaderboardWorldPosition, leaderboardWorldRotation, leaderboardWorldScale } from './TheForge'
import { Color4 } from '@dcl/sdk/math'
import { Leaderboard } from './ui'
import { ArtReward } from './artreward'

let uiTimer = 0   
let showChatMessages = false
let displayChatIcon = false
let selectedConversationId: string = ""
let inputValue:string = ""

export let userConversations: any[] = []
export let loadedConversations = new Set<string>() // Track which conversations have loaded messages
export let isLoadingMessages = new Set<string>() // Track which conversations are currently loading//

// Reactive conversation messages with auto UI updates
export let conversationMessages: { [conversationId: string]: any[] } = new Proxy({}, {
    set(target: any, property: string, value: any) {
        target[property] = value
        // Auto-refresh UI when conversation messages change
        if (property === selectedConversationId) {
            console.log(`🔄 Auto-refreshing UI for conversation: ${property}`)
            // Force a re-render by updating a timestamp that's used in keys
            messagesUpdateTimestamp = Date.now()
        }
        return true
    }
})

let messagesUpdateTimestamp = 0

export function setForgeUI() {
    ReactEcsRenderer.setUiRenderer(TheForgeUIComponent)
}

function startResizer(){
    engine.addSystem(uiSizer)
}
startResizer()

export const TheForgeUIComponent:any = () => {
    console.log("🎮 UI Component render - Display mode:", leaderboardDisplayMode)
    return [
        TheForgeUI(),
        leaderboardDisplayMode === "screen" ? LeaderboardScreenUI() : null,
        Leaderboard(),
        ArtReward()
    ]
}

export let dimensions:any = {
    width:0,
    height:0
  }

export function uiSizer(dt:number){
  if(uiTimer > 0){
    uiTimer -= dt
  }
  else{
    uiTimer = 3
    let canvas = UiCanvasInformation.get(engine.RootEntity)
    dimensions.aspect = canvas.devicePixelRatio
    dimensions.width = canvas.width
    dimensions.height = canvas.height
  }
}

function sizeFont(large:number, small:number){
    return dimensions.width > 2000 ? large : small
}


// Chat system functions
export async function fetchUserConversations() {
    if (!token) {
        console.log("No token available for fetching conversations")
        return
    }
    
    try {
        console.log("Fetching user conversations...")
        let response = await fetch(`${serverUrl}/rest-client/message/conversations`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })
        
        let data = await response.json()
        console.log("USER CONVERSATIONS", data)
        if (data.conversations) {
            userConversations = data.conversations
            console.log(`Loaded ${userConversations.length} conversations`)
            console.log(JSON.stringify(userConversations))
            
            // Sort conversations by last message timestamp (most recent first)
            userConversations.sort((a: any, b: any) => {
                const aTime = new Date(a.serverTimestamp || 0).getTime()
                const bTime = new Date(b.serverTimestamp || 0).getTime()
                return bTime - aTime
            })
        }
    } catch (e: any) {
        console.error("Error fetching conversations:", e)
    }
}

async function fetchConversationMessages(conversationId: string, limit: number = 50) {
    if (!token) {
        console.log("No token available for fetching messages")
        return []
    }
    
    if (isLoadingMessages.has(conversationId)) {
        console.log(`Already loading messages for conversation ${conversationId}`)
        return conversationMessages[conversationId] || []
    }
    
    try {
        console.log(`Fetching messages for conversation ${conversationId}`)
        isLoadingMessages.add(conversationId)
        
        let response = await fetch(`${serverUrl}/rest-client/message/conversation/${conversationId}?limit=${limit}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })
        
        let data = await response.json()
        if (data.messages) {
            // Server messages should be in chronological order (oldest first, newest last)
            conversationMessages[conversationId] = [...data.messages]
            loadedConversations.add(conversationId)
            console.log(`Loaded ${data.messages.length} messages for conversation ${conversationId}`)
            console.log(JSON.stringify(data.messages))
            return data.messages
        }
    } catch (e: any) {
        console.error(`Error fetching messages for conversation ${conversationId}:`, e)
    } finally {
        isLoadingMessages.delete(conversationId)
    }
    
    return []
}

// Main function to get conversation messages - checks cache first, then fetches if needed
async function getConversationMessages(conversationId: string): Promise<any[]> {
    // If messages are already loaded, return them
    if (loadedConversations.has(conversationId) && conversationMessages[conversationId]) {
        console.log(`Returning cached messages for conversation ${conversationId}`)
        return conversationMessages[conversationId]
    }
    
    // If not loaded and not currently loading, fetch them
    if (!isLoadingMessages.has(conversationId)) {
        return await fetchConversationMessages(conversationId)
    }
    
    // If currently loading, return empty array (or you could wait)
    return []
}

// Helper function to get conversation by ID
function getConversationById(conversationId: string) {
    return userConversations.find(conv => conv.conversationId === conversationId)
}

// Helper function to get unread message count for a conversation
function getUnreadCount(conversationId: string): number {
    const conversation = getConversationById(conversationId)
    return conversation?.unreadCount || 0
}

// Helper function to extract recipient ID from conversation ID
function getRecipientIdFromConversation(conversationId: string): string | null {
    if (!conversationId || !player.userId) return null
    
    // Conversation ID format is "user1_user2" (sorted alphabetically)
    const participants = conversationId.split('_')
    if (participants.length !== 2) return null
    
    // Return the participant that is NOT the current player
    return participants[0].toLowerCase() === player.userId.toLowerCase() 
        ? participants[1] 
        : participants[0]
}

// Send a message to a conversation
async function sendMessage(recipientId: string, content: string, type: string = "text") {
    if (!token) {
        console.log("No token available for sending message")
        return false
    }
    
    try {
        console.log(`Sending message to ${recipientId}`)
        let response = await fetch(`${serverUrl}/rest-client/message/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                recipientId,
                content,
                type
            })
        })
        
        let data = await response.json()
        if (data.success) {
            console.log("Message sent successfully")
            
            // Update local cache with the sent message using reactive helper
            const conversationId = [player.userId, recipientId].sort().join('_')
            const sentMessage = data.message || {
                senderId: player.userId,
                recipientId,
                content,
                type,
                serverTimestamp: new Date().toISOString(),
                messageId: `temp-${Date.now()}` // Temporary ID until server confirms
            }
            
            addMessageToConversation(conversationId, sentMessage)
            
            return true
        } else {
            console.error("Failed to send message:", data.error)
            return false
        }
    } catch (e: any) {
        console.error("Error sending message:", e)
        return false
    }
}

// Mark a message as read
async function markMessageAsRead(messageId: string) {
    if (!token) {
        console.log("No token available for marking message as read")
        return false
    }
    
    try {
        let response = await fetch(`${serverUrl}/rest-client/message/read`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                messageId
            })
        })
        
        let data = await response.json()
        if (data.success) {
            console.log(`Message ${messageId} marked as read`)
            return true
        } else {
            console.error("Failed to mark message as read:", data.error)
            return false
        }
    } catch (e: any) {
        console.error("Error marking message as read:", e)
        return false
    }
}

// Refresh conversations (useful for checking for new messages)
async function refreshConversations() {
    await fetchUserConversations()
}

// Helper function to add a message to a conversation (triggers auto UI update)
export function addMessageToConversation(conversationId: string, message: any) {
    if (!conversationMessages[conversationId]) {
        conversationMessages[conversationId] = []
    }
    
    // Add to the end (newest at bottom, like typical chat apps)
    conversationMessages[conversationId].push(message)
    
    // Trigger the Proxy by reassigning the array
    conversationMessages[conversationId] = [...conversationMessages[conversationId]]
    
    console.log(`📨 Added message to conversation ${conversationId}`)
}

// Force UI refresh for chat messages (now handled automatically by the Proxy)
export function refreshChatUIForConversation(conversationId: string) {//
    // Auto-refresh is now handled by the conversationMessages Proxy
    // This function is kept for backward compatibility
    console.log(`🔄 Refresh requested for conversation: ${conversationId}`)
}
  

export function TheForgeUI(){
    return(
        <UiEntity
            key={"dcl::theforge::ui"}
            uiTransform={{
                flexDirection: 'column',
                alignItems: 'center',
                display: showForgeUI ? 'flex' : 'none',
                justifyContent: 'center',
                width: dimensions.width,
                height: dimensions.height,
                positionType: 'absolute',
            }}
        >

            {/* forge icon */}
            {/* <UiEntity
                uiTransform={{
                    width: dimensions.width * .025,
                    height: dimensions.height * .05,
                    positionType: 'absolute',
                    position: { right: '1%', top:'2%' },
                }}
                uiBackground={{color:Color4.create(19/255, 24/255, 38/255, 1)}}
            /> */}

            {/* forge panel */}
            {/* <UiEntity
                uiTransform={{
                    width: dimensions.width * .15,
                    height: dimensions.height * .5,
                    // display: forgeConnected && showForgeUI && !showChatIcon && !showChatMessages ? 'flex' : 'none',
                    justifyContent: 'flex-start',
                    flexDirection: 'column',
                    alignItems: 'center',
                    positionType: 'absolute',
                    position: { right: 0, top:'10%'},
                }}
                uiBackground={{color:Color4.create(19/255, 24/255, 38/255, 1)}}
            /> */}

            {/* Login splash screen */}
            <UiEntity
                uiTransform={{
                    width: '100%',
                    height: '100%',
                    display: showLoginSplashScreen && !forgeConnected ? 'flex' : 'none',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    flexDirection: 'column',
                }}
                uiBackground={{color:Color4.create(47/255,27/255,20/255, 1)}}

            >

            <UiEntity
                uiTransform={{
                    width: '100%',
                    height: '100%',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    flexDirection: 'column',
                    positionType: 'absolute',
                }}
                uiBackground={{
                    texture: {
                        src: 'https://dclstreams.com/media/images/f00f8fce-3bc5-4df1-965f-d470429d0fd3.jpg'
                    },
                }}
            />

        <UiEntity
        uiTransform={{
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: dimensions.width * .1,
            height: dimensions.height * .05,
            margin: {bottom:'1%'},
            borderRadius: 10,
            borderWidth: 1,
            borderColor: Color4.create(83/255, 255/255, 214/255, 1),
        }}
        uiBackground={{color:Color4.create(83/255, 255/255, 214/255, 1)}}
        uiText={{value: "Login", fontSize: 15, color:Color4.create(0,0,0, 1)}}
        onMouseDown={()=>{
            ForgeConnect()
        }}
        />
        
        <UiEntity
        uiTransform={{
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: dimensions.width * .1,
            height: dimensions.height * .05,
            margin: {bottom:'5%'},
            borderRadius: 10,
            borderWidth: 1,
            borderColor: Color4.create(19/255, 24/255, 38/255, 1),
        }}
        uiBackground={{color:Color4.create(19/255, 24/255, 38/255, 1)}}
        uiText={{value: "Skip", fontSize: 15, color:Color4.create(1,1,1, 1)}}
        onMouseDown={()=>{
            setShowLoginSplashScreen(false)
        }}
        />
            </UiEntity>

            {/* Chat icon */}
            <UiEntity
                uiTransform={{
                    width: dimensions.width * .025,
                    height: dimensions.height * .05,
                    display: forgeConnected && showForgeUI && displayChatIcon ? 'flex' : 'none',
                    justifyContent: 'center',
                    alignItems: 'center',
                    positionType: 'absolute',
                    position: { right: '1%', bottom:'5%' },
                    borderRadius: 25,
                    borderWidth: 1,
                    borderColor: Color4.create(83/255, 255/255, 214/255, 1),
                }}
                uiBackground={{color:Color4.create(28/255, 34/255, 54/255, 1)}}
                onMouseDown={()=>{
                    displayChatIcon = !displayChatIcon
                }}
            />   


            {/* Chat list */}
            <UiEntity
                uiTransform={{
                    width: dimensions.width * .15,
                    height: dimensions.height * .45,
                    display: forgeConnected && showForgeUI && showChatIcon && !displayChatIcon && !showChatMessages ? 'flex' : 'none',
                    justifyContent: 'flex-start',
                    flexDirection: 'column',
                    alignItems: 'center',
                    positionType: 'absolute',
                    position: { right: '1%', bottom:'2%' },
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: Color4.create(83/255, 255/255, 214/255, 1),
                }}
                onMouseDown={()=>{}}

                uiBackground={{color:Color4.create(19/255, 24/255, 38/255, 1)}}
            >
                <UiEntity
                    uiTransform={{
                        width: dimensions.width * .02,
                        height: dimensions.height * .03,
                        justifyContent: 'center',
                        alignItems: 'center',
                        positionType: 'absolute',
                        position: { right: '1%', top:'1%' },
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: Color4.create(83/255, 255/255, 214/255, 1),
                    }}
                    uiBackground={{color:Color4.create(19/255, 24/255, 38/255, 1)}}
                    uiText={{textAlign:'middle-center', textWrap:'nowrap', value: '<', fontSize: sizeFont(25,20) }}
                    onMouseDown={()=>{
                        setShowChatIcon(!showChatIcon)
                    }}
                    />

                <UiEntity
                        uiTransform={{
                            width: '95%',
                            height: '10%',
                            justifyContent: 'center',
                            alignItems: 'center',
                            padding: {left:'5%'},
                            margin: {top:'1%', bottom:'1%'}
                        }}
                        uiText={{textAlign:'middle-center', textWrap:'nowrap', value: 'Forge Chat', fontSize: sizeFont(25,20) }}
                    />

                {userConversations.map((conversation: any) => (
                    <UiEntity
                        key={conversation.conversationId}
                        uiTransform={{
                            width: '95%',
                            height: '10%',
                            justifyContent: 'center',
                            borderColor:Color4.create(28/255, 34/255, 54/255, 1),
                            borderWidth: 1,
                            borderRadius: 10,
                            alignItems: 'center',
                            padding: {left:'5%'},
                            margin: {top:'1%', bottom:'1%'}
                        }}
                        uiBackground={{color:Color4.create(28/255, 34/255, 54/255, 1)}}
                        uiText={{textAlign:'middle-left', textWrap:'nowrap', value: conversation.otherUserName, fontSize: 15, color:Color4.create(1,1,1, 1) }}
                        onMouseDown={async ()=>{
                             //set the conversation id
                             //set the conversation messages//
                             selectedConversationId = conversation.conversationId
                             
                             // Load messages for this conversation if not already loaded
                             await getConversationMessages(conversation.conversationId)
                             
                             showChatMessages = !showChatMessages
                         }}
                    />
                ))}
            </UiEntity>

            {/* Chat messages */}
            <UiEntity
                key={`chat-messages-${messagesUpdateTimestamp}`}
                uiTransform={{
                    width: dimensions.width * .15,
                    height: dimensions.height * .45,
                    display: forgeConnected && showForgeUI && !displayChatIcon && showChatMessages ? 'flex' : 'none',
                    justifyContent: 'flex-start',
                    flexDirection: 'column',
                    alignItems: 'center',
                    positionType: 'absolute',
                    position: { right: '1%', bottom:'2%' },
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: Color4.create(83/255, 255/255, 214/255, 1),
                }}
                onMouseDown={()=>{
                    // showChatMessages = !showChatMessages
                }}

                uiBackground={{color:Color4.create(19/255, 24/255, 38/255, 1)}}
            >
                <UiEntity
                    uiTransform={{
                        width: dimensions.width * .02,
                        height: dimensions.height * .03,
                        justifyContent: 'center',
                        alignItems: 'center',
                        positionType: 'absolute',
                        position: { right: '1%', top:'1%' },
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: Color4.create(83/255, 255/255, 214/255, 1),
                    }}
                    uiBackground={{color:Color4.create(19/255, 24/255, 38/255, 1)}}
                    uiText={{textAlign:'middle-center', textWrap:'nowrap', value: '<', fontSize: sizeFont(25,20) }}
                    onMouseDown={()=>{
                        showChatMessages = !showChatMessages
                        selectedConversationId = ""
                    }}
                    />

                <UiEntity
                        uiTransform={{
                            width: '95%',
                            height: '10%',
                            justifyContent: 'center',
                            alignItems: 'center',
                            margin: {top:'1%', bottom:'1%'},
                        }}
                        uiText={{textAlign:'middle-center', textWrap:'nowrap', value: selectedConversationId ? 
                             getConversationById(selectedConversationId)?.otherUserName || 'Chat' : 'Select a Chat', fontSize: sizeFont(25,20) }}
                    />

                                 {selectedConversationId && conversationMessages[selectedConversationId] ? 
                     conversationMessages[selectedConversationId].slice(-9).map((message: any, index: number) => (
                         <UiEntity
                             key={`${message.messageId}-${messagesUpdateTimestamp}-${index}`}
                             uiTransform={{
                                 width: 'auto',
                                 height: 'auto',
                                 justifyContent: 'center',
                                 alignItems: 'center',
                                 alignSelf: message.senderId === player.userId ? 'flex-end' : 'flex-start', // Right for me, left for others
                                 padding: {left:'5%', right:'5%'},
                                 margin: {
                                   top:'1%', 
                                   bottom:'1%',
                                   // Add horizontal margin to create spacing from edges
                                   left: message.senderId === player.userId ? '20%' : '2%',   // Push my messages away from left edge
                                   right: message.senderId === player.userId ? '2%' : '20%'   // Push other messages away from right edge
                                 },
                                 borderColor: message.senderId === player.userId ? Color4.create(83/255, 255/255, 214/255, 1) : Color4.create(28/255, 34/255, 54/255, 1),
                                 borderWidth: 1,
                                 borderRadius: 10,
                             }}
                             uiBackground={{color: message.senderId === player.userId ? Color4.create(83/255, 255/255, 214/255, 1) : Color4.create(28/255, 34/255, 54/255, 1)}}
                             uiText={{textAlign: message.senderId === player.userId ? 'middle-right' : 'middle-left', textWrap:'wrap', value: `${message.content}`, fontSize: 12, color: message.senderId === player.userId ? Color4.create(0, 0, 0, 1) : Color4.create(255/255, 255/255, 255/255, 1) }}
                         />
                     )) : []
                 }

                 <UiEntity
                    uiTransform={{
                        width: '95%',
                        height: '10%',
                        justifyContent: 'center',
                        alignItems: 'center',
                        flexDirection:'row',
                        positionType: 'absolute',
                        position: {bottom: 0},
                    }}
                    >
                    <Input
                        uiTransform={{
                            width: '80%',
                            height: '100%',
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderColor: Color4.create(83/255, 255/255, 214/255, 1),
                            borderWidth: 0,
                        }}
                        color={Color4.create(255/255, 255/255, 255/255, 1)}
                        placeholderColor={Color4.create(255/255, 255/255, 255/255, 1)}
                        placeholder="Message"
                        onChange={(value:string)=>{
                            inputValue = value.trim()
                        }}
                        onSubmit={(value:string)=>{
                            inputValue = value.trim()
                            // Extract recipient ID from conversation ID
                            const recipientId = getRecipientIdFromConversation(selectedConversationId)
                            if (recipientId) {
                                sendMessage(recipientId, inputValue, "text")
                            }
                            inputValue = ""
                        }}

                    />
                    <UiEntity
                        uiTransform={{
                            width: '20%',
                            height: '100%',
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderColor: Color4.create(83/255, 255/255, 214/255, 1),
                            borderWidth: 1,
                            borderRadius: 10,
                            margin:{left:'1%'}
                        }}
                        uiText={{value: 'Send', fontSize: 15, color:Color4.create(0,0,0, 1) }}
                        uiBackground={{color:Color4.create(83/255, 255/255, 214/255, 1)}}
                        onMouseDown={()=>{
                            // Extract recipient ID from conversation ID
                            const recipientId = getRecipientIdFromConversation(selectedConversationId)
                            if (recipientId) {
                                sendMessage(recipientId, inputValue, "text")
                            }
                            inputValue = ""
                        }}
                    />
                    </UiEntity>


            </UiEntity>

        </UiEntity>
    )
}

// Define screen positions for leaderboard
const SCREEN_POSITIONS: {[key: string]: [number, number, number]} = {
    'Top Left': [0.12, 0.34, 0],
    'Top Center': [0.5, 0.34, 0],
    'Top Right': [0.87, 0.34, 0],
    'Middle Left': [0.12, 0.5, 0],
    'Middle Center': [0.5, 0.5, 0],
    'Middle Right': [0.6, 0.5, 0],
    'Bottom Left': [0.12, 0.66, 0],
    'Bottom Center': [0.5, 0.66, 0],
    'Bottom Right': [0.87, 0.66, 0],
}

// Leaderboard colors
const LEADERBOARD_COLORS = {
    PRIMARY: Color4.create(0/255, 255/255, 213/255, 1),      // Cyber teal
    SECONDARY: Color4.create(255/255, 0/255, 170/255, 1),    // Cyber pink
    BACKGROUND: Color4.create(13/255, 17/255, 23/255, 1),    // Dark background
    CARD_BG: Color4.create(22/255, 27/255, 34/255, 1),      // Card background
    TEXT_BRIGHT: Color4.create(240/255, 246/255, 252/255, 1), // Bright text
    TEXT_MEDIUM: Color4.create(201/255, 209/255, 217/255, 1), // Medium text
    TEXT_DIM: Color4.create(139/255, 148/255, 158/255, 1),   // Dim text
    SUCCESS: Color4.create(0/255, 255/255, 157/255, 1),      // Success green
    WARNING: Color4.create(255/255, 174/255, 0/255, 1),      // Warning orange
    ERROR: Color4.create(255/255, 56/255, 100/255, 1),       // Error red
    GOLD: Color4.create(255/255, 215/255, 0/255, 1),         // Gold for 1st place
    SILVER: Color4.create(192/255, 192/255, 192/255, 1),     // Silver for 2nd place
    BRONZE: Color4.create(205/255, 127/255, 50/255, 1)       // Bronze for 3rd place
}

// Format score/value for display
function formatScore(value: any): string {
    if (typeof value !== 'number') return value.toString()
    
    if (value >= 1000000) {
        return (value / 1000000).toFixed(1) + 'M'
    } else if (value >= 1000) {
        return (value / 1000).toFixed(1) + 'K'
    } else {
        return value.toLocaleString()
    }
}

// Get rank color based on position
function getRankColor(index: number): Color4 {
    if (index === 0) return LEADERBOARD_COLORS.GOLD
    else if (index === 1) return LEADERBOARD_COLORS.SILVER
    else if (index === 2) return LEADERBOARD_COLORS.BRONZE
    return LEADERBOARD_COLORS.TEXT_BRIGHT
}

// Screen-based Leaderboard UI Component
export function LeaderboardScreenUI() {
    if (!showLeaderboard) return null
    
    const calculatedWidth = Math.max(dimensions.width * leaderboardWidth, 300) // Minimum 300px width
    const calculatedHeight = Math.max(dimensions.height * leaderboardHeight, 400) // Minimum 400px height


    // const position = SCREEN_POSITIONS[leaderboardPosition] || SCREEN_POSITIONS['Middle Right']
    // const adjustedPosition = [
    //     position[0] + leaderboardXOffset,
    //     position[1] + leaderboardYOffset,
    //     position[2]
    // ]

    return (
        <UiEntity
            key="dcl::leaderboard::ui"
            uiTransform={{
                width: calculatedWidth,
                height: calculatedHeight,
                display: showLeaderboard ? 'flex' : 'none',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                alignItems: 'center',
                positionType: 'absolute',
                position: { 
                    right: `1%`, 
                    bottom: `2%` 
                },
                borderRadius: showLeaderboardBackground ? 10 : 0,
                borderWidth: showLeaderboardBackground ? 2 : 0,
                borderColor: showLeaderboardBackground ? LEADERBOARD_COLORS.PRIMARY : Color4.create(0,0,0,0),
            }}
            uiBackground={ showLeaderboardBackground ? {
                color: showLeaderboardBackground ? LEADERBOARD_COLORS.CARD_BG : Color4.create(0,0,0,0)
            } : {
            }}
        >
                {/* Title */}
                <UiEntity
                    uiTransform={{
                        width: '95%',
                        height: '10%',
                        justifyContent: 'center',
                        alignItems: 'center',
                        margin: { bottom: '2%' }
                    }}
                    uiText={{
                        value: leaderboardData?.name || 'LEADERBOARD',
                        fontSize: sizeFont(30, 24),
                        color: LEADERBOARD_COLORS.PRIMARY,
                        textAlign: 'middle-center'
                    }}
                />

                {/* Content area */}
                <UiEntity
                    uiTransform={{
                        width: '95%',
                        height: '95%',
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        alignItems: 'center',
                    }}
                >
                    {/* Loading state */}
                    {isLoadingLeaderboard && (
                        <UiEntity
                            uiTransform={{
                                width: '85%',
                                height: '10%',
                                justifyContent: 'center',
                                alignItems: 'center',
                                margin: { top: '10%' }
                            }}
                            uiText={{
                                value: 'Loading...',
                                fontSize: sizeFont(20, 16),
                                color: LEADERBOARD_COLORS.TEXT_MEDIUM,
                                textAlign: 'middle-center'
                            }}
                        />
                    )}

                    {/* Error state */}
                    {leaderboardError && !isLoadingLeaderboard && (
                        <UiEntity
                            uiTransform={{
                                width: '85%',
                                height: '10%',
                                justifyContent: 'center',
                                alignItems: 'center',
                                margin: { top: '10%' }
                            }}
                            uiText={{
                                value: leaderboardError,
                                fontSize: sizeFont(16, 12),
                                color: LEADERBOARD_COLORS.ERROR,
                                textAlign: 'middle-center'
                            }}
                        />
                    )}

                    {/* Leaderboard entries */}
                    {leaderboardData?.entries && leaderboardData.entries.length > 0 && !isLoadingLeaderboard && !leaderboardError && 
                        leaderboardData.entries.map((entry: any, index: number) => {
                            const uniqueKey = `${entry.rank || index}-${entry.username || entry.displayName || index}-${index}`
                            return (
                                <LeaderboardEntry
                                    key={uniqueKey}
                                    entry={entry}
                                    index={index}
                                />
                            )
                        })
                    }

                    {/* No entries message */}
                    {leaderboardData?.entries && leaderboardData.entries.length === 0 && !isLoadingLeaderboard && !leaderboardError && (
                        <UiEntity
                            uiTransform={{
                                width: '85%',
                                height: '10%',
                                justifyContent: 'center',
                                alignItems: 'center',
                                margin: { top: '10%' }
                            }}
                            uiText={{
                                value: 'No entries available',
                                fontSize: sizeFont(16, 14),
                                color: LEADERBOARD_COLORS.TEXT_DIM,
                                textAlign: 'middle-center'
                            }}
                        />
                    )}
                </UiEntity>
        </UiEntity>
    )
}

// World-based Leaderboard UI Component (3D Billboard)
// This component doesn't render any UI - the 3D entities are managed in TheForge.ts
export function LeaderboardWorldUI() {
    // For world mode, we don't render any screen UI
    // The 3D TextShape entities are created and managed in TheForge.ts
    return null
}

// Individual leaderboard entry component for screen mode
function LeaderboardEntry({ entry, index, key }: { entry: any, index: number, key: string }) {
    const isTopThree = index < 3
    const rankColor = getRankColor(index)

    return (
        <UiEntity
            uiTransform={{
                width: '95%',
                height: '8%',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '2%',
                margin: { bottom: '1%' },
                borderRadius: showLeaderboardRowBackground ? 5 : 0,
                borderWidth: showLeaderboardRowBackground && isTopThree ? 1 : 0,
                borderColor: showLeaderboardRowBackground ? rankColor : Color4.create(0,0,0,0),
            }}
            uiBackground={{
                color: showLeaderboardRowBackground && isTopThree ? 
                    LEADERBOARD_COLORS.BACKGROUND : Color4.create(0,0,0,0)
            }}
        >
            {/* Rank */}
            <UiEntity
                uiTransform={{
                    width: '15%',
                    height: '80%',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
                uiText={{
                    value: `#${entry.rank}`,
                    fontSize: sizeFont(18, 14),
                    color: rankColor,
                    textAlign: 'middle-center'
                }}
            />

            {/* Player name */}
            <UiEntity
                uiTransform={{
                    width: '55%',
                    height: '80%',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                }}
                uiText={{
                    value: entry.displayName || entry.username || 'Unknown Player',
                    fontSize: sizeFont(14, 12),
                    color: LEADERBOARD_COLORS.TEXT_BRIGHT,
                    textAlign: 'middle-left'
                }}
            />

            {/* Score */}
            <UiEntity
                uiTransform={{
                    width: '25%',
                    height: '80%',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                }}
                uiText={{
                    value: formatScore(entry.balance || entry.score || entry.value || 0),
                    fontSize: sizeFont(14, 12),
                    color: LEADERBOARD_COLORS.PRIMARY,
                    textAlign: 'middle-right'
                }}
            />
        </UiEntity>
    )
}

