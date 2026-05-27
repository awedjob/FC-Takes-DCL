import { LeaderBoard } from './leaderboard'
import { executeTask } from '@dcl/sdk/ecs'
import { getPlayer } from '@dcl/sdk/src/players'
import { signedFetch } from '~system/SignedFetch'

// SQLite server URL - update this to your server URL
// const serverBaseUrl = 'http://localhost:3000/'
const serverBaseUrl = 'https://fartarget-production.up.railway.app/'

// get latest scores from SQLite server
// if there is a new #1 score, there will be an announcement using admin smart object.
export function fetchScores(leaderboard: LeaderBoard) {
  executeTask(async () => {
    try {
      const response = await signedFetch({
        url: serverBaseUrl + 'get-scores',
        init: {
          headers: { 'Content-Type': 'application/json' },
          method: 'GET'
        }
      })

      if (!response.body) {
        throw new Error('Invalid response')
      }

      let json = await JSON.parse(response.body)

      console.log('Response received: ', json)

      if (!json.valid) {
        throw new Error('Does not pass validation check')
      }

      const allScores = await json.topTen

      leaderboard.updateBoard(allScores)
    } catch (e) {
      console.log('error fetching scores from server: ' + e)
    }
  })
}

// get player data
var userData: any

export function setUserData() {
  let response = getPlayer()
  userData = response!
}

setUserData()

// add score to leaderboard
export function publishScore(score: number, leaderboard: LeaderBoard) {
  executeTask(async () => {
    if (!userData) {
      setUserData()
    }

    try {
      const response = await signedFetch({
        url: serverBaseUrl + 'publish-score',
        init: {
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
          body: JSON.stringify({
            id: userData.userId,
            name: userData.name,
            score: score,
            wallet: userData.userId // Using userId as wallet address
          })
        }
      })

      if (!response.body) {
        throw new Error('Invalid response')
      }

      let json = await JSON.parse(response.body)

      console.log('Response received: ', json)

      if (!json.valid) {
        throw new Error('Does not pass validation check')
      }

      console.log('published score')
      fetchScores(leaderboard)
    } catch (e) {
      console.log('error posting to server: ' + e)
    }
  })
}

// get user's best score
export function getUserScore(leaderboard: LeaderBoard) {
  executeTask(async () => {
    if (!userData) {
      setUserData()
    }

    try {
      const response = await signedFetch({
        url: serverBaseUrl + 'user-score/' + userData.userId,
        init: {
          headers: { 'Content-Type': 'application/json' },
          method: 'GET'
        }
      })

      if (!response.body) {
        throw new Error('Invalid response')
      }

      let json = await JSON.parse(response.body)

      console.log('User score response: ', json)

      if (!json.valid) {
        throw new Error('Does not pass validation check')
      }

      if (json.score) {
        console.log('User best score: ', json.score.score)
        return json.score.score
      } else {
        console.log('No score found for user')
        return 0
      }
    } catch (e) {
      console.log('error fetching user score: ' + e)
      return 0
    }
  })
}