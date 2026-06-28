const fs = require('fs');
const path = require('path');

const clientDir = path.join(__dirname, 'client');
const files = ['chat.html', 'vault.html', 'analytics.html', 'settings.html'];

const standardLeftSidebar = 'fixed left-0 -translate-x-full md:translate-x-0 transition-transform duration-300 top-0 h-full w-64 flex flex-col p-md z-40 bg-surface-container-low/60 dark:bg-surface-container-low/60 backdrop-blur-2xl border-r border-white/5 shadow-2xl';
const standardRightSidebar = 'hidden xl:block fixed right-0 top-0 h-full w-[320px] bg-surface-container-lowest/40 backdrop-blur-xl border-l border-white/5 p-lg z-40 flex flex-col overflow-y-auto custom-scrollbar';

const mainWithRightSidebar = 'flex-1 flex flex-col w-full min-h-screen md:ml-64 xl:mr-[320px] relative z-10 transition-all pt-20 md:pt-0';
const mainWithoutRightSidebar = 'flex-1 flex flex-col w-full min-h-screen md:ml-64 relative z-10 transition-all p-lg pt-20 md:pt-lg';

for (const file of files) {
    const filePath = path.join(clientDir, file);
    if (!fs.existsSync(filePath)) continue;
    
    let html = fs.readFileSync(filePath, 'utf8');

    // 1. Normalize Left Sidebar (the one with 'mobile-menu' or the first aside)
    // We replace its entire class string.
    html = html.replace(/<aside([^>]+class=")[^"]+(")/i, `<aside$1${standardLeftSidebar}$2`);

    // 2. Normalize Right Sidebar (the second aside, if it exists)
    // chat and vault have a second aside
    let asideCount = (html.match(/<aside/gi) || []).length;
    if (asideCount > 1) {
        // Replace the second aside's class
        let firstAsideIdx = html.indexOf('<aside');
        let secondAsideIdx = html.indexOf('<aside', firstAsideIdx + 1);
        
        let beforeSecond = html.substring(0, secondAsideIdx);
        let afterSecond = html.substring(secondAsideIdx);
        afterSecond = afterSecond.replace(/<aside([^>]+class=")[^"]+(")/i, `<aside$1${standardRightSidebar}$2`);
        html = beforeSecond + afterSecond;
    }

    // 3. Normalize Main Content Canvas
    // If it has a right sidebar, use the right sidebar margin layout
    if (asideCount > 1) {
        html = html.replace(/<main([^>]+class=")[^"]+(")/i, `<main$1${mainWithRightSidebar}$2`);
    } else {
        html = html.replace(/<main([^>]+class=")[^"]+(")/i, `<main$1${mainWithoutRightSidebar}$2`);
    }

    // Also, remove weird inline styles or layout-breaking wrappers if necessary
    // E.g. analytics had `m-lg h-[calc(100vh-48px)]` - we removed that by entirely replacing the class!

    fs.writeFileSync(filePath, html);
    console.log(`✅ Normalized layout for ${file}`);
}
