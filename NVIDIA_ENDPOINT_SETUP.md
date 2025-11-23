# NVIDIA Parakeet Endpoint Configuration

## Current Error
The endpoint `/v1/speech/transcribe` is returning 404. We need to find the correct NVIDIA Parakeet endpoint.

## Possible Endpoints

### Option 1: NVIDIA Integrate API
```
https://integrate.api.nvidia.com/v1/speech/recognition/nvidia/parakeet_tt
```

### Option 2: NVIDIA NIM (NVIDIA Inference Microservices)
If you have a function ID:
```
https://api.nvcf.nvidia.com/v1/nvcf/pexec/functions/{function_id}
```

### Option 3: Custom Endpoint
If NVIDIA provided you with a specific endpoint URL, add it to `.env`:
```bash
VITE_PARAKET_API_URL=https://your-custom-endpoint.com/v1/transcribe
```

## How to Find Your Endpoint

1. **Check NVIDIA Dashboard**: Log into your NVIDIA account and check the API documentation or dashboard for the Parakeet endpoint.

2. **Check API Key Documentation**: The API key format `nvapi-trym-...` suggests this might be for a specific NVIDIA service. Check the documentation that came with your API key.

3. **Try Different Endpoints**: Update `vite.config.ts` to test different endpoint paths.

## Quick Fix

Add one of these to your `.env` file:

**For NVIDIA Integrate API:**
```bash
VITE_PARAKET_API_URL=https://integrate.api.nvidia.com
```

**For NVIDIA NIM (if you have a function ID):**
```bash
VITE_PARAKET_FUNCTION_ID=your-function-id-here
```

**For Custom Endpoint:**
```bash
VITE_PARAKET_API_URL=https://your-endpoint.com/v1/transcribe
```

## Testing

After updating, restart your dev server and try the video call again. Check the browser console for the actual endpoint being called.

