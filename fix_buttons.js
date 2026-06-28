const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, 'client', 'index.html');
if (fs.existsSync(indexHtmlPath)) {
    let html = fs.readFileSync(indexHtmlPath, 'utf8');
    
    // Fix duplicate hrefs in the top navigation
    html = html.replace(/href="#"\s*href="\/chat\.html"/g, 'href="/chat.html"');
    html = html.replace(/href="#"\s*href="\/vault\.html"/g, 'href="/vault.html"');
    html = html.replace(/href="#"\s*href="\/analytics\.html"/g, 'href="/analytics.html"');
    
    // Fix duplicate hrefs if they got injected differently
    html = html.replace(/<a([^>]+)href="#"([^>]+)href="([^"]+)"/g, '<a$1$2href="$3"');
    html = html.replace(/<a([^>]+)href="([^"]+)"([^>]+)href="#"/g, '<a$1href="$2"$3');
    
    fs.writeFileSync(indexHtmlPath, html);
    console.log('✅ Fixed index.html buttons and links');
}
