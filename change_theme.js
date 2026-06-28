const fs = require('fs');
const path = require('path');

const clientDir = path.join(__dirname, 'client');
const files = fs.readdirSync(clientDir).filter(f => f.endsWith('.html'));

const replacements = [
    // Main primary color (Emerald to Cyan/Blue)
    { from: /#00ff85/g, to: '#00aaff' },
    { from: /0, 255, 133/g, to: '0, 170, 255' },
    { from: /0x00ff85/g, to: '0x00aaff' }, // Three.js
    
    // Gradients & Borders (Darker shades)
    { from: /#00cc6a/g, to: '#0077cc' },
    { from: /#008f4a/g, to: '#004488' },
    
    // Tailwind config colors
    { from: /"#00391c"/g, to: '"#001133"' }, // on-primary
    { from: /"#00522b"/g, to: '"#003366"' }, // primary-container
    { from: /"#9efbc0"/g, to: '"#b3e0ff"' }, // on-primary-container
    
    // Update the "glow-emerald" class name to something neutral just in case,
    // although leaving the class name as glow-emerald but changing the CSS color is fine.
];

for (const file of files) {
    const fp = path.join(clientDir, file);
    let html = fs.readFileSync(fp, 'utf8');
    
    for (const r of replacements) {
        html = html.replace(r.from, r.to);
    }
    
    fs.writeFileSync(fp, html);
    console.log(`✅ Updated theme in ${file}`);
}
