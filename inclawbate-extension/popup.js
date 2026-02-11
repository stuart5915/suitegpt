// Popup settings page

const fields = ['tone', 'persona', 'goals', 'topics', 'maxLength', 'style', 'apiUrl'];

const defaults = {
    tone: 'casual',
    persona: '',
    goals: '',
    topics: '',
    maxLength: 280,
    style: '',
    apiUrl: 'https://inclawbate.com/api/inclawbate/generate-reply'
};

// Load saved settings
chrome.storage.sync.get(defaults, (settings) => {
    fields.forEach(field => {
        const el = document.getElementById(field);
        if (el) el.value = settings[field];
    });
});

// Save settings
document.getElementById('save').addEventListener('click', () => {
    const settings = {};
    fields.forEach(field => {
        const el = document.getElementById(field);
        settings[field] = field === 'maxLength' ? parseInt(el.value) || 280 : el.value;
    });

    chrome.storage.sync.set(settings, () => {
        const toast = document.getElementById('toast');
        toast.textContent = 'Settings saved!';
        setTimeout(() => { toast.textContent = ''; }, 2000);
    });
});
