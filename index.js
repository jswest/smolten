#!/usr/bin/env node

import program from './lib/cli.js';

process.stdout.write('\x1bc');

const cols = process.stdout.columns || 80;
const art = String.raw`                           
  ██████  ███▄ ▄███▓ ▒█████   ██▓    
▒██    ▒ ▓██▒▀█▀ ██▒▒██▒  ██▒▓██▒    
░ ▓██▄   ▓██    ▓██░▒██░  ██▒▒██░    
  ▒   ██▒▒██    ▒██ ▒██   ██░▒██░    
▒██████▒▒▒██▒   ░██▒░ ████▓▒░░██████▒
▒ ▒▓▒ ▒ ░░ ▒░   ░  ░░ ▒░▒░▒░ ░ ▒░▓  ░
░ ░▒  ░ ░░  ░      ░  ░ ▒ ▒░ ░ ░ ▒  ░
░  ░  ░  ░      ░   ░ ░ ░ ▒    ░ ░   
      ░         ░       ░ ░      ░  ░

s m o l
~ yes, it is molten ~
`;

// Center the banner
for (const line of art.split('\n')) {
  const pad = Math.max(Math.floor((cols - line.length) / 2), 0);
  console.log(' '.repeat(pad) + line);
}



// Parse command line arguments
program.parse();