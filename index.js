require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { TwitterApi } = require('twitter-api-v2');

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
        const twitterClient = new TwitterApi({
          appKey: process.env.TWITTER_APP_KEY,
          appSecret: process.env.TWITTER_APP_SECRET,
          accessToken: post.account.accessToken,
          accessSecret: post.account.accessTokenSecret
        });

        // Post the tweet
        const tweetParams = { text: post.content };
        if (post.mediaIds && post.mediaIds.length > 0) {
          tweetParams.media = { media_ids: post.mediaIds };
        }
        const tweetResponse = await twitterClient.v2.tweet(tweetParams);

        // Get media URL from tweet response if media was attached
        let mediaUrl = null;
        if (post.mediaIds && post.mediaIds.length > 0) {
          try {
            const tweetDetails = await twitterClient.v2.singleTweet(
              tweetResponse.data.id,
              { 
                "expansions": "attachments.media_keys",
                "media.fields": "url,preview_image_url" 
              }
            );
            
            if (tweetDetails.includes?.media?.[0]?.url) {
              mediaUrl = tweetDetails.includes.media[0].url;
            }
          } catch (err) {
            console.error("Error fetching tweet details:", err);
          }
        }

        // Update post with status, posted time, and media URL
        await prisma.scheduledPost.update({
          where: { id: post.id },
          data: { 
            status: 'published',
            postedAt: new Date(),
            mediaUrl
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
