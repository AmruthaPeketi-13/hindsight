const fs = require('fs');
const path = require('path');

const STITCH_DIR = path.join(__dirname, '..', 'stitch_cascadeflow_ai_ops_manager');
const CLIENT_DIR = path.join(__dirname, 'client');

function fixLinks(html) {
    // Sidebar replacements
    html = html.replace(/href="[^"]*"\s*>\s*<span[^>]*>terminal<\/span>\s*Console/g, 'href="/chat.html">\n<span class="material-symbols-outlined">terminal</span>\n            Console');
    html = html.replace(/href="[^"]*"\s*>\s*<span[^>]*>storage<\/span>\s*Vault/g, 'href="/vault.html">\n<span class="material-symbols-outlined">storage</span>\n            Vault');
    html = html.replace(/href="[^"]*"\s*>\s*<span[^>]*>query_stats<\/span>\s*Telemetry/g, 'href="/analytics.html">\n<span class="material-symbols-outlined">query_stats</span>\n            Telemetry');
    html = html.replace(/href="[^"]*"\s*>\s*<span[^>]*>settings_input_component<\/span>\s*Config/g, 'href="/settings.html">\n<span class="material-symbols-outlined">settings_input_component</span>\n            Config');
    
    return html;
}

const settingsHtmlPath = path.join(STITCH_DIR, 'system_settings_restyled', 'code.html');
if (fs.existsSync(settingsHtmlPath)) {
    let html = fs.readFileSync(settingsHtmlPath, 'utf8');
    html = fixLinks(html);
    fs.writeFileSync(path.join(CLIENT_DIR, 'settings.html'), html);
    console.log('✅ Generated settings.html');
} else {
    console.log('❌ Could not find system_settings_restyled');
}

// I also need to update the sidebars of the other files to point Config to /settings.html
const filesToUpdate = ['chat.html', 'vault.html', 'analytics.html'];
for (const file of filesToUpdate) {
    const fp = path.join(CLIENT_DIR, file);
    if (fs.existsSync(fp)) {
        let html = fs.readFileSync(fp, 'utf8');
        html = html.replace(/href="[^"]*"\s*>\s*<span[^>]*>settings_input_component<\/span>\s*Config/g, 'href="/settings.html">\n<span class="material-symbols-outlined" data-icon="settings">settings_input_component</span>\n            Config');
        fs.writeFileSync(fp, html);
    }
}
console.log('✅ Updated sidebar config links across all screens.');
