/**
 * MVP Avatar Configuration
 * Simple configuration for 4 predefined Ready Player Me avatars
 */

import { getEngineers, saveEngineer, generateId } from './localstorage-data';

export interface MVPAvatar {
  id: string;
  name: string;
  specialty: string;
  avatar_url: string;
  personality?: string;
  fish_voice_id?: string; // FishAudio voice ID for TTS
}

/**
 * Get the 4 MVP avatars from environment variables or defaults
 *
 * FishAudio Voice IDs:
 * Get voice IDs from: https://fish.audio/docs
 * Default: 802e3bc2b27e49c2995d23ef70e6ac89 (Energetic Male)
 */
export function getMVPAvatars(): MVPAvatar[] {
  const avatars: MVPAvatar[] = [];

  // FishAudio voice IDs - can be customized per avatar
  const defaultVoiceId = import.meta.env.VITE_FISHAUDIO_DEFAULT_VOICE_ID || '802e3bc2b27e49c2995d23ef70e6ac89';

  // Avatar 1 - Alex (Frontend) - Male
  const avatar1Url = import.meta.env.VITE_AVATAR_1_URL || 'https://models.readyplayer.me/69226336672cca15c2b4bb34.glb';
  avatars.push({
    id: 'mvp-avatar-1',
    name: 'Alex',
    specialty: 'frontend',
    avatar_url: avatar1Url,
    personality: 'Creative and detail-oriented frontend specialist',
    fish_voice_id: defaultVoiceId, // FishAudio voice ID
  });

  // Avatar 2 - Sam (Backend) - Female
  const avatar2Url = import.meta.env.VITE_AVATAR_2_URL || 'https://models.readyplayer.me/692264ba672cca15c2b4d588.glb';
  avatars.push({
    id: 'mvp-avatar-2',
    name: 'Sam',
    specialty: 'backend',
    avatar_url: avatar2Url,
    personality: 'Systematic and efficient backend engineer',
    fish_voice_id: defaultVoiceId, // FishAudio voice ID
  });

  // Avatar 3 - Jordan (Fullstack) - Male
  const avatar3Url = import.meta.env.VITE_AVATAR_3_URL || 'https://models.readyplayer.me/692264ba672cca15c2b4d588.glb';
  avatars.push({
    id: 'mvp-avatar-3',
    name: 'Jordan',
    specialty: 'fullstack',
    avatar_url: avatar3Url,
    personality: 'Versatile full-stack developer',
    fish_voice_id: defaultVoiceId, // FishAudio voice ID
  });

  // Avatar 4 - Casey (DevOps) - Female
  const avatar4Url = import.meta.env.VITE_AVATAR_4_URL || 'https://models.readyplayer.me/692264fcbcfe438b189c885c.glb';
  avatars.push({
    id: 'mvp-avatar-4',
    name: 'Casey',
    specialty: 'devops',
    avatar_url: avatar4Url,
    personality: 'Infrastructure and deployment expert',
    fish_voice_id: defaultVoiceId, // FishAudio voice ID
  });

  return avatars;
}

/**
 * Force-reset all MVP avatar voices to their correct assignments
 * This can be called to fix voice mismatches
 */
export function forceResetMVPVoices(): void {
  const mvpAvatars = getMVPAvatars();
  const existing = getEngineers();
  const existingByName = new Map(existing.map((e: any) => [e.name, e]));

  let updatedCount = 0;
  for (const avatar of mvpAvatars) {
    const existingEngineer = existingByName.get(avatar.name);
    if (existingEngineer) {
      const oldVoice = existingEngineer.fish_voice_id;
      existingEngineer.fish_voice_id = avatar.fish_voice_id || null;
      saveEngineer(existingEngineer);
      if (oldVoice !== existingEngineer.fish_voice_id) {
        console.log(`🔊 Force-reset ${avatar.name}'s voice ID: "${oldVoice}" → "${existingEngineer.fish_voice_id}"`);
        updatedCount++;
      }
    }
  }

  if (updatedCount > 0) {
    console.log(`✅ Force-reset ${updatedCount} engineer voice(s)`);
  } else {
    console.log(`✅ All MVP voices are already correct`);
  }
}

/**
 * Initialize MVP avatars in localStorage if they don't exist
 * Also updates existing engineers with correct voice assignments
 */
export function initializeMVPAvatars(): void {
  const mvpAvatars = getMVPAvatars();

  // Skip if no avatars configured
  if (mvpAvatars.length === 0) {
    return;
  }

  // Check existing engineers
  const existing = getEngineers();
  const existingByName = new Map(existing.map((e: any) => [e.name, e]));

  // Force-update existing MVP engineers with correct voice assignments
  // This ensures voices are always correct, even if they were previously set incorrectly
  for (const avatar of mvpAvatars) {
    const existingEngineer = existingByName.get(avatar.name);
    if (existingEngineer) {
      // Always update voice for MVP avatars to ensure correctness
      const oldVoice = existingEngineer.fish_voice_id;
        existingEngineer.fish_voice_id = avatar.fish_voice_id || null;
      if (oldVoice !== existingEngineer.fish_voice_id) {
        console.log(`🔊 Updating ${avatar.name}'s voice ID from "${oldVoice}" to "${existingEngineer.fish_voice_id}"`);
      }
      saveEngineer(existingEngineer);
    }
  }

  // Don't auto-create avatars - user must manually add them via the UI
  // This function now only updates existing MVP engineers with correct voice assignments
  console.log('ℹ️ MVP avatars initialization complete (no auto-creation - user must add manually)');
}

