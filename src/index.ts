#!/usr/bin/env node

import { program } from 'commander';
import { readFileSync, createWriteStream, existsSync } from 'fs';
import { join, extname, basename } from 'path';
import axios from 'axios';
import open from 'open';
import { cwd } from 'process';
import * as readline from 'readline';

// Read version from package.json
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

// Supported domains
const SUPPORTED_DOMAINS = [
  'dropcode.tonary.app',
  'dc.tonary.app',
  'dropcode.lolkek.lol',
  'dc.lolkek.lol',
];

interface ApiResponse {
  file: {
    downloadUrl: string;
    [key: string]: any;
  };
}

/**
 * Extracts snippet ID from URL or returns the input if it's already an ID
 */
function extractSnippetId(input: string): { snippetId: string; baseUrl: string } | null {
  // If it looks like just an ID (no protocol, no slashes except maybe one at start)
  if (!input.includes('://') && !input.includes('/')) {
    // Determine base URL from the first supported domain
    return {
      snippetId: input,
      baseUrl: `https://${SUPPORTED_DOMAINS[0]}`,
    };
  }

  try {
    const urlObj = new URL(input);
    const hostname = urlObj.hostname;

    // Check if hostname matches any supported domain
    const matchedDomain = SUPPORTED_DOMAINS.find((domain) => hostname === domain);

    if (!matchedDomain) {
      return null;
    }

    // Extract snippet ID from pathname (remove leading slash)
    const pathname = urlObj.pathname;
    const snippetId = pathname.startsWith('/') ? pathname.slice(1) : pathname;

    if (!snippetId) {
      return null;
    }

    return {
      snippetId,
      baseUrl: `https://${matchedDomain}`,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Fetches file information from API
 */
async function fetchFileInfo(baseUrl: string, snippetId: string): Promise<ApiResponse> {
  const apiUrl = `${baseUrl}/api/files/${snippetId}`;
  const response = await axios.get<ApiResponse>(apiUrl);
  return response.data;
}

/**
 * Downloads file from URL to current directory
 */
async function downloadFile(downloadUrl: string, filename: string): Promise<void> {
  const response = await axios({
    method: 'GET',
    url: downloadUrl,
    responseType: 'stream',
  });

  const filePath = join(cwd(), filename);
  const writer = createWriteStream(filePath);

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

/**
 * Extracts filename from URL or uses default
 */
function getFilenameFromUrl(url: string, snippetId: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || `dropcode-${snippetId}`;
    return filename;
  } catch {
    return `dropcode-${snippetId}`;
  }
}

/**
 * Checks if a file exists in the current directory
 */
function fileExists(filename: string): boolean {
  const filePath = join(cwd(), filename);
  return existsSync(filePath);
}

/**
 * Generates a filename with an incremented number (e.g., App.tsx -> App (2).tsx)
 */
function generateNumberedFilename(originalFilename: string, directory: string = cwd()): string {
  const ext = extname(originalFilename);
  const nameWithoutExt = basename(originalFilename, ext);
  let counter = 2;
  let newFilename = `${nameWithoutExt} (${counter})${ext}`;
  
  while (existsSync(join(directory, newFilename))) {
    counter++;
    newFilename = `${nameWithoutExt} (${counter})${ext}`;
  }
  
  return newFilename;
}

/**
 * Creates a readline interface for user input
 */
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompts user for input
 */
function question(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

/**
 * Handles file name conflict by prompting user for action
 */
async function handleFileNameConflict(originalFilename: string): Promise<string | null> {
  const rl = createReadlineInterface();
  const autoNumberedName = generateNumberedFilename(originalFilename);
  
  try {
    while (true) {
      console.log(`\nFile "${originalFilename}" already exists in this directory.`);
      console.log('What would you like to do?');
      console.log('  1. Replace the existing file');
      console.log(`  2. Save as "${autoNumberedName}"`);
      console.log('  3. Enter a custom filename');
      console.log('  4. Cancel');
      
      const answer = await question(rl, '\nEnter your choice (1-4): ');
      const choice = answer.trim();
      
      switch (choice) {
        case '1':
          rl.close();
          return originalFilename;
          
        case '2':
          rl.close();
          return autoNumberedName;
          
        case '3': {
          let firstAttemptName: string | null = null;
          
          while (true) {
            const customName = await question(rl, 'Enter custom filename: ');
            const trimmedName = customName.trim();
            
            if (!trimmedName) {
              if (firstAttemptName === null) {
                console.log('Filename cannot be empty. Please try again.');
                continue;
              } else {
                // Empty input after error - return to main menu
                break;
              }
            }
            
            if (fileExists(trimmedName)) {
              if (firstAttemptName === null) {
                // First attempt with existing file
                firstAttemptName = trimmedName;
                console.log(`Error: File "${trimmedName}" already exists.`);
                console.log('Press Enter to return to main menu, or enter the same filename again to see options for this file.');
              } else if (trimmedName === firstAttemptName) {
                // Same name entered again - show options for this file
                rl.close();
                return await handleFileNameConflict(trimmedName);
              } else {
                // Different name, but also exists - reset and show error
                firstAttemptName = trimmedName;
                console.log(`Error: File "${trimmedName}" already exists.`);
                console.log('Press Enter to return to main menu, or enter the same filename again to see options for this file.');
              }
              continue;
            }
            
            // Valid filename that doesn't exist
            rl.close();
            return trimmedName;
          }
          // Return to main menu (continue outer loop)
          continue;
        }
        
        case '4':
          rl.close();
          return null;
          
        default:
          console.log('Invalid choice. Please enter 1, 2, 3, or 4.');
          continue;
      }
    }
  } catch (error) {
    rl.close();
    throw error;
  }
}

program
  .name('dropcode')
  .description('CLI tool for dropcode')
  .version(packageJson.version);

program
  .argument('<url-or-id>', 'Dropcode URL or snippet ID')
  .action(async (input: string) => {
    // Extract snippet ID
    const parsed = extractSnippetId(input);

    if (!parsed) {
      console.error(
        `Error: Invalid input. Please provide a valid URL from supported domains (${SUPPORTED_DOMAINS.join(', ')}) or a snippet ID.`
      );
      process.exit(1);
    }

    const { snippetId, baseUrl } = parsed;

    console.log(`Fetching snippet: ${snippetId}`);
    console.log(`Base URL: ${baseUrl}`);

    try {
      // Fetch file info from API
      const fileInfo = await fetchFileInfo(baseUrl, snippetId);

      if (!fileInfo.file || !fileInfo.file.downloadUrl) {
        console.error('Error: File information not found in API response');
        process.exit(1);
      }

      const downloadUrl = fileInfo.file.downloadUrl;
      let filename = getFilenameFromUrl(downloadUrl, snippetId);

      // Check if file already exists and handle conflict
      if (fileExists(filename)) {
        const resolvedFilename = await handleFileNameConflict(filename);
        
        if (resolvedFilename === null) {
          console.log('Download cancelled.');
          process.exit(0);
        }
        
        filename = resolvedFilename;
      }

      console.log(`Downloading file: ${filename}`);
      console.log(`From: ${downloadUrl}`);

      // Download file
      await downloadFile(downloadUrl, filename);

      console.log(`✓ File downloaded successfully: ${join(cwd(), filename)}`);
    } catch (error: any) {
      // Check if it's a network/access error (e.g., Cloudflare blocking)
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const apiUrl = `${baseUrl}/api/files/${snippetId}`;

        console.error(`Error: Failed to fetch file information (Status: ${statusCode || 'Network Error'})`);
        console.log(`Opening API URL in browser: ${apiUrl}`);

        try {
          await open(apiUrl);
          console.log('Please check the browser and download the file manually if needed.');
        } catch (openError) {
          console.error('Failed to open browser. Please visit:', apiUrl);
        }
      } else {
        console.error('Error:', error.message || 'Unknown error occurred');
      }

      process.exit(1);
    }
  });

program.parse();

