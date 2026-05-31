import cron from 'node-cron';
import { fetchSportsData } from '../utils/api'; // Ensure this points to your API utility
import { client } from '../index'; // You'll need to export your client from index.ts

// This runs every minute
cron.schedule('* * * * *', async () => {
    try {
        const liveMatches = await fetchSportsData('/fixtures?live=all');
        if (!liveMatches?.length) return;

        // Logic to send messages to configured channel
        // You should fetch the saved channel ID from your database here
        const channelId = 'YOUR_SAVED_CHANNEL_ID'; 
        const channel = await client.channels.fetch(channelId);
        
        if (channel && channel.isTextBased()) {
            liveMatches.forEach((match: any) => {
                channel.send(`🔴 **LIVE MATCH:** ${match.teams.home.name} vs ${match.teams.away.name}`);
            });
        }
    } catch (error) {
        console.error('Task Error:', error);
    }
});