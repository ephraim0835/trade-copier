const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'apps/web/src');

function walk(dir, callback) {
  fs.readdir(dir, function(err, list) {
    if (err) return callback(err);
    let pending = list.length;
    if (!pending) return callback(null);
    list.forEach(function(file) {
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            if (!--pending) callback(null);
          });
        } else {
          if (file.endsWith('.tsx') || file.endsWith('.ts')) {
             let content = fs.readFileSync(file, 'utf8');
             let original = content;
             
             // Replacements
             content = content.replace(/\bpill pill-success\b/g, 'plaiz-pill plaiz-pill-success');
             content = content.replace(/\bpill pill-neutral\b/g, 'plaiz-pill plaiz-pill-neutral');
             content = content.replace(/\bpill pill-destructive\b/g, 'plaiz-pill plaiz-pill-destructive');
             content = content.replace(/\bpill pill-interactive\b/g, 'plaiz-pill plaiz-pill-interactive');
             content = content.replace(/\bpill\b(?!-)/g, 'plaiz-pill');
             
             content = content.replace(/\bbtn-apple btn-secondary\b/g, 'plaiz-btn plaiz-btn-secondary');
             content = content.replace(/\bbtn-apple btn-primary\b/g, 'plaiz-btn plaiz-btn-primary');
             content = content.replace(/\bbtn-apple\b/g, 'plaiz-btn');
             content = content.replace(/\bbtn-primary\b/g, 'plaiz-btn-primary');
             content = content.replace(/\bbtn-secondary\b/g, 'plaiz-btn-secondary');
             
             content = content.replace(/\bdigital-card\b/g, 'plaiz-card');
             content = content.replace(/\bpremium-glass\b/g, 'plaiz-card');
             content = content.replace(/\bglass-panel\b/g, 'plaiz-card');
             content = content.replace(/\bhero-panel\b/g, 'plaiz-card bg-muted/50');
             content = content.replace(/\bsurface-matte\b/g, 'plaiz-card bg-secondary/30');

             if (content !== original) {
               fs.writeFileSync(file, content, 'utf8');
               console.log('Updated:', file);
             }
          }
          if (!--pending) callback(null);
        }
      });
    });
  });
}

walk(directoryPath, (err) => {
  if (err) console.error(err);
  console.log('Done.');
});
