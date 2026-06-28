const fs = require('fs');
const path = require('path');

const clientDir = path.join(__dirname, 'client');
const files = fs.readdirSync(clientDir).filter(f => f.endsWith('.html'));

// 1. Get the authoritative tailwind.config from chat.html
const chatHtml = fs.readFileSync(path.join(clientDir, 'chat.html'), 'utf8');
const tailwindConfigMatch = chatHtml.match(/<script id="tailwind-config">[\s\S]*?<\/script>/);
const tailwindConfig = tailwindConfigMatch ? tailwindConfigMatch[0] : '';

// 2. The universal font import
const fontImport = `@import url('https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=JetBrains+Mono:wght@100..800&display=swap');`;

for (const file of files) {
    const filePath = path.join(clientDir, file);
    let html = fs.readFileSync(filePath, 'utf8');

    // Replace the tailwind config
    if (tailwindConfig) {
        html = html.replace(/<script id="tailwind-config">[\s\S]*?<\/script>/, tailwindConfig);
    }
    
    // Ensure the font import is at the top of the style block (replace old imports or just inject)
    // First remove any existing @import for Geist/JetBrains inside <style>
    html = html.replace(/@import url\('[^']+'\);\s*/g, '');
    
    // Inject our clean font import right after <style>
    html = html.replace(/<style>/, `<style>\n${fontImport}\n`);
    
    // Remove old <link href="...fonts.googleapis.com..."> tags just in case, but only the Geist/JetBrains ones
    html = html.replace(/<link[^>]+family=(?:Geist|JetBrains|Jetbrains)[^>]+>/gi, '');

    fs.writeFileSync(filePath, html);
    console.log(`✅ Normalized CSS for ${file}`);
}
