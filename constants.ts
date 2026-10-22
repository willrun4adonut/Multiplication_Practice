export const CONFIG = {
  // Game Info
  title: {
    value: 'Step Multiply',
    type: 'string',
    label: 'Game Title',
    group: 'GAME',
  },
  baseCanvasWidth: {
    value: 1376,
    type: 'number',
    label: 'Base Canvas Width',
    group: 'GAME',
  },
  baseCanvasHeight: {
    value: 768,
    type: 'number',
    label: 'Base Canvas Height',
    group: 'GAME',
  },

  // System
  targetFPS: {
    value: 60,
    type: 'number',
    label: 'Target FPS',
    group: 'SYSTEM',
  },
  stepMs: {
    value: 1000 / 60,
    type: 'number',
    label: 'Step MS',
    group: 'SYSTEM',
  },
  maxSubSteps: {
    value: 5,
    type: 'number',
    label: 'Max Sub Steps',
    group: 'SYSTEM',
  },

  // Theme
  backgroundColor: {
    value: '#0f172a',
    type: 'color',
    label: 'Background Color',
    group: 'THEME',
  },
  primaryColor: {
    value: '#06b6d4',
    type: 'color',
    label: 'Primary Teal Color',
    group: 'THEME',
  },
  accentColor: {
    value: '#f59e0b',
    type: 'color',
    label: 'Accent Amber Color',
    group: 'THEME',
  },
  chalkboardBg: {
    value: '#1e293b',
    type: 'color',
    label: 'Board Background Color',
    group: 'THEME',
  },
  fontFamily: {
    value: 'Outfit, system-ui, sans-serif',
    type: 'string',
    label: 'Font Family',
    group: 'THEME',
  },

  // Rules & Gameplay
  totalProblemsPerRound: {
    value: 10,
    type: 'number',
    label: 'Problems per Round',
    group: 'Rules',
  },
  maxMistakesAllowed: {
    value: 3,
    type: 'number',
    label: 'Max Mistakes Allowed',
    group: 'Rules',
  },
  pointsPerCorrectStep: {
    value: 100,
    type: 'number',
    label: 'Points per Step',
    group: 'Rules',
  },
  bonusForNoMistakes: {
    value: 500,
    type: 'number',
    label: 'Bonus Clean Problem',
    group: 'Rules',
  },
  defaultDifficulty: {
    value: 1,
    type: 'number',
    label: 'Default Difficulty (1-3)',
    group: 'Rules',
  },
  autoPlaceZeroDefault: {
    value: false,
    type: 'boolean',
    label: 'Auto Place Tens Zero',
    group: 'Rules',
  },

  // Standard audio levels
  defaultMusicVolume: {
    value: 0.5,
    type: 'number',
    label: 'Default Music Volume',
    group: 'AUDIO',
  },
  defaultSfxVolume: {
    value: 0.7,
    type: 'number',
    label: 'Default SFX Volume',
    group: 'AUDIO',
  },

  // Assets
  assetBgAspect: {
    value: 1.79166,
    type: 'number',
    label: 'Classroom BG Aspect Ratio',
    group: 'ASSETS',
  },
  assetOwlAspect: {
    value: 0.93085,
    type: 'number',
    label: 'Owl Guide Aspect Ratio',
    group: 'ASSETS',
  },
  assetStarAspect: {
    value: 1.0424,
    type: 'number',
    label: 'Star Icon Aspect Ratio',
    group: 'ASSETS',
  },
  assetTrophyAspect: {
    value: 0.87556,
    type: 'number',
    label: 'Trophy Icon Aspect Ratio',
    group: 'ASSETS',
  },
};

// Merge customized config values if present (injected by Playground)
const {playgroundConfig} = globalThis as {
  playgroundConfig?: Record<string, unknown>;
};
if (playgroundConfig) {
  for (const [key, value] of Object.entries(playgroundConfig)) {
    if (key in CONFIG) {
      Object.assign(CONFIG[key as keyof typeof CONFIG], {value});
    }
  }
}

/** Type helper for reading values in game code. */
export type ConfigKey = keyof typeof CONFIG;

/**
 * Gets a configuration value by key.
 * @param key The configuration key.
 * @return The configuration value.
 */
export function getConfig<K extends ConfigKey>(
  key: K,
): (typeof CONFIG)[K]['value'] {
  return CONFIG[key].value;
}
