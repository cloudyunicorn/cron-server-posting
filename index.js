require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || process.env.CRON_PORT || 4000;

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/', (_, res) => { res.status(200).json({ status: 'running' }) });

// Secure API Key verification
const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.CRON_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Scheduled job endpoint
app.post('/schedule', authenticate, async (req, res) => {
  const { postId, scheduledAt, mediaIds } = req.body;
  
  try {
    // Store in database
    const scheduledPost = await prisma.scheduledPost.update({
      where: { id: postId },
      data: { 
        scheduledAt: new Date(scheduledAt),
        status: 'scheduled',
        mediaIds: mediaIds || undefined
      }
    });

    res.json({ success: true, post: scheduledPost });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process scheduled posts
const processPosts = async () => {
  try {
    const now = new Date();
    const duePosts = await prisma.scheduledPost.findMany({
      where: {
        scheduledAt: { lte: now },
        status: 'scheduled'
      },
      include: { account: true }
    });

    for (const post of duePosts) {
      try {
        // Call the app's API to post the tweet
        const response = await axios.post(`${process.env.APP_URL}/api/twitter/post`, {
          content: post.content,
          mediaIds: post.mediaIds,
          accountId: post.account.id
        }, {
          headers: {
            'x-api-key': process.env.CRON_API_KEY
          }
        });

        // Update post status based on API response
        await prisma.scheduledPost.update({
          where: { id: post.id },
          data: { 
            status: response.data.success ? 'completed' : 'failed',
            postedAt: new Date(),
            ...(response.data.tweetId && { tweetId: response.data.tweetId })
          }
        });

      } catch (error) {
        console.error(`Failed to post ${post.id}:`, error);
        await prisma.scheduledPost.update({
          where: { id: post.id },
          data: { status: 'failed' }
        });
      }
    }
  } catch (error) {
    console.error('Processing error:', error);
  }
};

// Schedule job to run every minute
cron.schedule('* * * * *', processPosts);

// Start server
app.listen(PORT, () => {
  console.log(`Cron server running on port ${PORT}`);
});
