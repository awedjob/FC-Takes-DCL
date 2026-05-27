@echo off
echo 🚀 Starting Decentraland Leaderboard Server
echo 📊 Using SQLite database: leaderboard.db
echo.

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

REM Build the project
echo 🔨 Building TypeScript...
call npm run build

REM Start the server
echo 🌐 Starting server on port 3000...
echo 📊 API Endpoints:
echo    GET  /get-scores     - Get top 10 scores
echo    POST /publish-score  - Submit a new score
echo    GET  /user-score/:id - Get user's best score
echo    GET  /health         - Health check
echo.
echo 🎮 Your Decentraland scene can now connect to: http://localhost:3000
echo.

call npm start 