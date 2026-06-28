const fs = require('fs');
const path = require('path');

const clientDir = path.join(__dirname, 'client');
const files = ['chat.html', 'vault.html', 'analytics.html', 'settings.html'];

// 1. Extract Master Sidebar from chat.html
let chatHtml = fs.readFileSync(path.join(clientDir, 'chat.html'), 'utf8');
const sidebarRegex = /<aside id="mobile-menu"[\s\S]*?<\/aside>/;
const sidebarMatch = chatHtml.match(sidebarRegex);

if (!sidebarMatch) {
    console.error("Could not find master sidebar in chat.html!");
    process.exit(1);
}

const rawMasterSidebar = sidebarMatch[0];

// The active classes we want to move around
const activeClass = "flex items-center gap-md px-md py-sm text-primary-fixed-dim bg-primary/10 rounded-lg font-label-mono text-label-mono transition-transform translate-x-1";
const inactiveClass = "flex items-center gap-md px-md py-sm text-outline hover:bg-white/5 hover:text-on-surface rounded-lg font-label-mono text-label-mono transition-all";

for (const file of files) {
    const filePath = path.join(clientDir, file);
    let html = fs.readFileSync(filePath, 'utf8');

    // 1. Strip redundant top header
    // Some files have a <header class="fixed top-0 w-full z-50...">
    html = html.replace(/<header class="fixed top-0 w-full z-50[\s\S]*?<\/header>/i, '');

    // 2. Strip redundant bottom mobile nav
    // <nav class="md:hidden fixed bottom-0 left-0 w-full bg-surface-container-low/80 backdrop-blur-xl z-50...
    html = html.replace(/<nav class="md:hidden fixed bottom-0[\s\S]*?<\/nav>/i, '');
    html = html.replace(/<nav class="md:hidden fixed bottom-0[\s\S]*?<\/nav>/i, ''); // Sometimes two variations

    // 3. Inject Master Sidebar
    let newSidebar = rawMasterSidebar;

    // Reset all links in the Master Sidebar to INACTIVE
    newSidebar = newSidebar.replace(new RegExp(activeClass.replace(/\//g, '\\/'), 'g'), inactiveClass);

    // Find the link for the CURRENT file and set it to ACTIVE
    // E.g. if file is 'analytics.html', find href="/analytics.html" and change its class
    const linkRegex = new RegExp('(<a class=")([^"]+)(" href="/' + file + '")');
    newSidebar = newSidebar.replace(linkRegex, '$1' + activeClass + '$3');

    // Replace the existing sidebar in the file with the newly generated one
    html = html.replace(sidebarRegex, newSidebar);

    fs.writeFileSync(filePath, html);
    console.log(`✅ Unified navigation in ${file}`);
}
