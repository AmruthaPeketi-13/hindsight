const fs = require('fs');
const path = require('path');

const clientDir = path.join(__dirname, 'client');
const files = fs.readdirSync(clientDir).filter(f => f.endsWith('.html'));

for (const file of files) {
    const filePath = path.join(clientDir, file);
    let html = fs.readFileSync(filePath, 'utf8');

    // 1. Fix duplicate href="#" in top navs
    html = html.replace(/href="#"\s*href="([^"]+)"/g, 'href="$1"');
    html = html.replace(/href="([^"]+)"\s*href="#"/g, 'href="$1"');
    
    // 2. Fix sidebar links by matching the <span> text
    // Example: <a class="..." href="#"> <span ...>chat</span> Chat </a>
    // We can replace the href attribute of any <a> tag that contains 'chat</span>' with '/chat.html'
    
    // Chat
    html = html.replace(/<a([^>]+href=)"#"(>[\s\S]*?<span[^>]*>chat<\/span>)/g, '<a$1"/chat.html"$2');
    
    // Memory (database)
    html = html.replace(/<a([^>]+href=)"#"(>[\s\S]*?<span[^>]*>database<\/span>)/g, '<a$1"/vault.html"$2');
    
    // Analytics (monitoring)
    html = html.replace(/<a([^>]+href=)"#"(>[\s\S]*?<span[^>]*>monitoring<\/span>)/g, '<a$1"/analytics.html"$2');
    
    // Settings (settings)
    html = html.replace(/<a([^>]+href=)"#"(>[\s\S]*?<span[^>]*>settings<\/span>)/g, '<a$1"/settings.html"$2');
    
    fs.writeFileSync(filePath, html);
    console.log(`✅ Fixed links in ${file}`);
}
