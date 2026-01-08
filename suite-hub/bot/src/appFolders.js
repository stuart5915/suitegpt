// App name to workspace folder mapping
// Used by process-prompts.js to know which folder to work in for each app

export const APP_FOLDERS = {
    // Discord App Name -> Workspace Folder Name
    'LifeHub': 'life-hub-app',
    'DeFiKnowledge': 'defi-knowledge',
    'DealFinder': 'cambridge-deals',
    'SUITEHub': 'suite-hub',
    'TrueForm': 'trueform-expo',
    'OpticRep': 'opticrep-ai-workout-trainer',
    'REMcast': 'remcast',
    'Cheshbon': 'cheshbon-reflections',
    'FoodVitals': 'food-vitals-expo',
};

// Reverse lookup: folder name -> app name
export const FOLDER_TO_APP = Object.fromEntries(
    Object.entries(APP_FOLDERS).map(([app, folder]) => [folder, app])
);

// Apps that have EAS configured for OTA updates
export const EAS_ENABLED_APPS = [
    'cheshbon-reflections',
    'defi-knowledge',
    'opticrep-ai-workout-trainer',
    'remcast',
    'trueform-expo',
    'food-vitals-expo',
    'life-hub-app',
    'cambridge-deals',
];

export default APP_FOLDERS;
