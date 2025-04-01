# Cron Server Deployment Guide

## 1. Prerequisites
- Node.js installed
- PM2 or similar process manager
- Database connection string

## 2. Deployment Options

### Option A: Render (Recommended)
1. Create new Web Service on Render
2. Connect your Git repository
3. Set environment variables:
   - `CRON_API_KEY`
   - `TWITTER_APP_KEY` 
   - `TWITTER_APP_SECRET`
   - `DATABASE_URL`
4. Set build command: `npm install && npm run build`
5. Set start command: `node index.js`

### Option B: DigitalOcean Droplet
```bash
# On your droplet:
git clone your-repo.git
cd cron-server
npm install
npm install -g pm2
pm2 start index.js --name "cron-server"
pm2 save
pm2 startup
```

### Option C: Railway.app
1. Create new project
2. Deploy from GitHub
3. Set environment variables
4. Set start command: `node index.js`

## 3. Environment Variables
Create `.env` file:
```
CRON_API_KEY=your_secure_key_here
CRON_PORT=4000
TWITTER_APP_KEY=xxx
TWITTER_APP_SECRET=xxx
DATABASE_URL=your_db_url
```

## 4. Maintenance
- Monitor logs: `pm2 logs`
- Restart: `pm2 restart cron-server`
- Update: `git pull && pm2 restart cron-server`
