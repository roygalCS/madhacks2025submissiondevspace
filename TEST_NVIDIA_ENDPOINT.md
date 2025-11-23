# Testing NVIDIA Parakeet Endpoints

The current endpoint is returning 404. We need to find the correct endpoint for your NVIDIA API key.

## Try These Endpoints

Add one of these to your `.env` file and restart the server:

### Option 1: Standard NVIDIA API
```bash
VITE_PARAKET_API_URL=https://api.nvidia.com/v1/parakeet/stt
```

### Option 2: Alternative path
```bash
VITE_PARAKET_API_URL=https://api.nvidia.com/v1/stt
```

### Option 3: NVIDIA Integrate API
```bash
VITE_PARAKET_API_URL=https://integrate.api.nvidia.com/v1/speech/recognition/nvidia/parakeet_tt
```

### Option 4: NVIDIA NIM (if you have a function ID)
```bash
VITE_PARAKET_API_URL=https://api.nvcf.nvidia.com
VITE_PARAKET_FUNCTION_ID=your-function-id-here
```

## How to Find the Correct Endpoint

1. **Check NVIDIA Dashboard**: 
   - Log into https://build.nvidia.com or your NVIDIA account
   - Look for API documentation or endpoint URLs

2. **Check API Documentation**:
   - The API key format `nvapi-trym-...` suggests this is for NVIDIA's API services
   - Look for "Speech Recognition" or "Parakeet" in the documentation

3. **Contact NVIDIA Support**:
   - Ask them for the exact endpoint URL for Parakeet STT
   - Provide your API key format: `nvapi-trym-...`

## Current Configuration

The code is currently trying: `https://api.nvidia.com/v1/parakeet/stt`

If this doesn't work, update `VITE_PARAKET_API_URL` in your `.env` file with the correct endpoint from NVIDIA's documentation.

