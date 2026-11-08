'use strict';
const minutes = (n) => `${Math.floor(n / 60)} ${Math.floor(n / 60) === 1 ? 'hour' : 'hours'}${n % 60 ? ` ${n % 60} minutes` : ''} per month`;
const freeText = (value, proposed) => value == null ? `Not configured · ${proposed}` : `${minutes(value)} included`;
const priceText = (value) => value == null ? 'Not configured yet · proposed per-minute billing will be shown before a paid session starts.' : `$${value.toFixed(4)} per minute`;
function kinds(config) {
    const configuredBrowser = freeText(config.browserFreeMinutes, '20 hours monthly allowance proposed');
    const price = priceText(config.pricePerMinute);
    return [
        { id: 'browser', name: 'Browser', badge: 'QUICK TASKS', for: 'A private browser for a task, an AI errand, or a shared screen.', runs: 'OpenVibe workers or your Link machines.', price: `Your Link machine: free · Cloud: ${configuredBrowser}; then ${price}`, available: true },
        { id: 'kept-browser', name: 'Kept browser', badge: 'YOUR SITES', for: 'A browser that stays signed in with an encrypted profile.', runs: 'OpenVibe workers or your Link machines.', price: `Your Link machine: free · Cloud: ${configuredBrowser}; then ${price}`, available: false },
        { id: 'desktop', name: 'Desktop', badge: 'FULL APPS', for: 'A full Linux desktop for apps and longer work.', runs: 'OpenVibe workers or Link.', price: `Your Link machine: free · ${freeText(config.desktopFreeMinutes, '1 free hour proposed')}; then ${price}`, available: false },
        { id: 'gpu-desktop', name: 'GPU desktop', badge: 'RENDER & PLAY', for: 'A graphics desktop for Blender, video, local models and games.', runs: 'Home GPU, rented GPU or a Link GPU.', price: 'GPU cost and allowance not configured · proposed', available: false },
        { id: 'always-on', name: 'Always-on', badge: 'FOR YOUR AGENT', for: 'A computer that stays ready between agent tasks.', runs: 'OpenVibe workers.', price: `Cloud: ${price}`, available: false },
        { id: 'your-computer', name: 'Your computer', badge: 'FROM ANYWHERE', for: 'Reach your own computer from anywhere.', runs: 'Link with Desktop capability.', price: 'Free on your own Link machine.', available: false },
        { id: 'throwaway', name: 'Throwaway', badge: 'NOTHING KEPT', for: 'A temporary computer that is wiped when it ends.', runs: 'OpenVibe workers.', price: `Cloud: ${configuredBrowser}; then ${price}`, available: false },
    ];
}
const templates = [
    { mark: '01', id: 'browser', name: 'Browser', text: 'A new browser desk for this session.', available: true },
    { mark: '02', id: 'kept-browser', name: 'Kept browser', text: 'Reuse a saved browser profile between sessions.', available: false },
    { mark: '03', id: 'throwaway', name: 'Throwaway', text: 'A fresh browser desk that ends with this session.', available: true },
];
/** The whole price in one sentence (it was repeated, half-configured, on every card). */
function priceLine(config) {
    const browser = config.browserFreeMinutes == null ? '20 hours of cloud browser a month (proposed)' : `${minutes(config.browserFreeMinutes)} of cloud browser`;
    const after = config.pricePerMinute == null ? 'then per minute at a price shown before any paid session starts' : `then $${config.pricePerMinute.toFixed(4)} a minute`;
    return `Free and unlimited on your own Link machines. In the cloud: ${browser}, ${after}.`;
}
module.exports = { kinds, templates, freeText, priceText, priceLine };
