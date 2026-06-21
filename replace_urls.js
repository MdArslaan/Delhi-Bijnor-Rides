const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'frontend', 'src');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.js') || file.endsWith('.jsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(srcDir);
let replacedFiles = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace 'http://localhost:5000' with (import.meta.env.VITE_API_URL || 'http://localhost:5000')
    const singleQuoteRegex = /'http:\/\/localhost:5000([^']*)'/g;
    const doubleQuoteRegex = /"http:\/\/localhost:5000([^"]*)"/g;
    const backtickRegex = /`http:\/\/localhost:5000([^`]*)`/g;

    const replaceFunc = (match, p1) => {
        return `\`\${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${p1}\``;
    };

    let original = content;
    content = content.replace(singleQuoteRegex, replaceFunc);
    content = content.replace(doubleQuoteRegex, replaceFunc);
    content = content.replace(backtickRegex, replaceFunc);

    const plainRegex = /'http:\/\/localhost:5000'/g;
    content = content.replace(plainRegex, "(import.meta.env.VITE_API_URL || 'http://localhost:5000')");
    
    // For SocketContext io('http://localhost:5000') -> io(import.meta.env.VITE_API_URL || 'http://localhost:5000')
    const ioRegex = /io\('http:\/\/localhost:5000'\)/g;
    content = content.replace(ioRegex, "io(import.meta.env.VITE_API_URL || 'http://localhost:5000')");
    
    // Fallback if there are any remaining plain strings like 'http://localhost:5000'
    const finalRegex = /'http:\/\/localhost:5000'/g;
    content = content.replace(finalRegex, "(import.meta.env.VITE_API_URL || 'http://localhost:5000')");

    if (original !== content) {
        fs.writeFileSync(file, content, 'utf8');
        replacedFiles++;
        console.log(`Replaced in ${file}`);
    }
});

console.log(`Finished replacing in ${replacedFiles} files.`);
