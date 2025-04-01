// Script to concatenate all source files with filename headers
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Output file path
const outputFile = path.join(__dirname, 'all_source_code.txt');

// Directory to scan (relative to this script)
const srcDir = path.join(__dirname, 'src');

// CSS and TypeScript file extensions to include
const fileExtensions = ['.ts', '.tsx', '.js', '.jsx', '.css'];

// Files to skip
const skipFiles = ['vite-env.d.ts'];

// Function to recursively get all files
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      fileList = getAllFiles(filePath, fileList);
    } else {
      // Only include specified file extensions and skip unwanted files
      const ext = path.extname(file);
      if (fileExtensions.includes(ext) && !skipFiles.includes(file)) {
        fileList.push(filePath);
      }
    }
  });
  
  return fileList;
}

// Get all files
const allFiles = getAllFiles(srcDir);

// Helper function to get relative path from project root
function getRelativePath(filePath) {
  return filePath.replace(__dirname + '/', '');
}

// Clear output file if it exists
fs.writeFileSync(outputFile, '');

// Read package.json for dependencies
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Write package.json dependencies to output
fs.appendFileSync(outputFile, '/*****************************\n');
fs.appendFileSync(outputFile, ' * PROJECT DEPENDENCIES\n');
fs.appendFileSync(outputFile, ' *****************************/\n\n');
fs.appendFileSync(outputFile, '// package.json dependencies:\n');
fs.appendFileSync(outputFile, JSON.stringify(packageJson.dependencies, null, 2) + '\n\n');
fs.appendFileSync(outputFile, '// package.json devDependencies:\n');
fs.appendFileSync(outputFile, JSON.stringify(packageJson.devDependencies, null, 2) + '\n\n');

// Write each file to the output
for (const file of allFiles) {
  const relativePath = getRelativePath(file);
  const content = fs.readFileSync(file, 'utf8');
  
  fs.appendFileSync(outputFile, '/*****************************\n');
  fs.appendFileSync(outputFile, ` * FILE: ${relativePath}\n`);
  fs.appendFileSync(outputFile, ' *****************************/\n\n');
  fs.appendFileSync(outputFile, content);
  fs.appendFileSync(outputFile, '\n\n');
}

console.log(`All source files concatenated to ${outputFile}`);