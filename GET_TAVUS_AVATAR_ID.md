# How to Get Your Tavus Avatar ID

## Method 1: From Tavus Dashboard (Easiest)

1. Go to [Tavus Dashboard](https://app.tavus.io/replicas)
2. Log in with your Tavus account
3. You'll see a list of your replicas/avatars
4. Click on the avatar you want to use
5. The **Replica ID** is shown in the URL or in the avatar details
   - It looks like: `replica_abc123xyz` or a UUID format

## Method 2: Using Tavus API

You can fetch all your available avatars using the Tavus API:

```bash
curl -X GET "https://api.tavus.io/v2/replicas" \
  -H "x-api-key: YOUR_TAVUS_API_KEY"
```

This will return a list of all your replicas with their IDs.

## Method 3: Check Browser Console

1. Open your browser's developer console (F12)
2. In the ChatTab component, the code will automatically try to use your avatar ID
3. If you have `VITE_TAVUS_API_KEY` in your `.env`, you can add this to your code temporarily:

```javascript
import { listTavusReplicas } from '@/lib/tavus';

// In your component or browser console:
const apiKey = import.meta.env.VITE_TAVUS_API_KEY;
const replicas = await listTavusReplicas(apiKey);
console.log('Available avatars:', replicas);
```

## Using the Avatar ID

Once you have your avatar ID, you can:

1. **Add to `.env` file:**
   ```bash
   VITE_TAVUS_DEFAULT_AVATAR_ID=your_replica_id_here
   ```

2. **Or add to Engineers tab:**
   - Go to Engineers tab in the app
   - Create/edit an engineer
   - Paste the avatar ID in the "Tavus Avatar ID" field

3. **Or add to Connections tab:**
   - The app will automatically use the first available avatar if configured

The video call feature will automatically use your avatar ID from any of these sources!

