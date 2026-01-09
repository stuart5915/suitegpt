import { config } from '../config.js';

/**
 * GitHub API integration for direct commits
 * Uses GitHub REST API to read and write files directly
 */

const GITHUB_API = 'https://api.github.com';

/**
 * Get files from a GitHub repo
 * @param {string} repoSlug - App slug that maps to a repo
 * @param {string[]} filePaths - Array of file paths to fetch
 * @returns {Promise<Object>} Map of path -> content
 */
export async function getRepoFiles(repoSlug, filePaths) {
    const repoName = config.appRepos[repoSlug];
    if (!repoName) {
        throw new Error(`Unknown app: ${repoSlug}`);
    }

    if (!config.githubToken) {
        throw new Error('GITHUB_TOKEN not configured');
    }

    const files = {};

    for (const filePath of filePaths) {
        try {
            const response = await fetch(
                `${GITHUB_API}/repos/${config.githubOwner}/${repoName}/contents/${filePath}`,
                {
                    headers: {
                        'Authorization': `Bearer ${config.githubToken}`,
                        'Accept': 'application/vnd.github.v3+json',
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                // Content is base64 encoded
                files[filePath] = {
                    content: Buffer.from(data.content, 'base64').toString('utf-8'),
                    sha: data.sha
                };
            }
        } catch (error) {
            console.error(`Failed to fetch ${filePath}:`, error.message);
        }
    }

    return files;
}

/**
 * Get list of files in a repo directory
 * @param {string} repoSlug - App slug
 * @param {string} dirPath - Directory path (e.g., 'src' or 'app')
 */
export async function listRepoFiles(repoSlug, dirPath = '') {
    const repoName = config.appRepos[repoSlug];
    if (!repoName || !config.githubToken) {
        throw new Error('Missing repo or token');
    }

    const response = await fetch(
        `${GITHUB_API}/repos/${config.githubOwner}/${repoName}/contents/${dirPath}`,
        {
            headers: {
                'Authorization': `Bearer ${config.githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
            }
        }
    );

    if (!response.ok) {
        throw new Error(`Failed to list files: ${response.statusText}`);
    }

    const data = await response.json();
    return data.map(item => ({
        path: item.path,
        type: item.type,
        sha: item.sha
    }));
}

/**
 * Recursively fetch ALL code files from a repo
 * @param {string} repoSlug - App slug
 * @param {number} maxFiles - Maximum files to fetch (default 50)
 * @returns {Promise<Object>} Map of path -> { content, sha }
 */
export async function getAllRepoFiles(repoSlug, maxFiles = 50) {
    const repoName = config.appRepos[repoSlug];
    if (!repoName || !config.githubToken) {
        throw new Error('Missing repo or token');
    }

    // Extensions to include
    const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.html'];

    // Directories to skip
    const skipDirs = ['node_modules', '.git', '.expo', 'dist', 'build', '.next', 'coverage'];

    const allFiles = {};
    let fileCount = 0;

    async function fetchDir(dirPath = '') {
        if (fileCount >= maxFiles) return;

        try {
            const response = await fetch(
                `${GITHUB_API}/repos/${config.githubOwner}/${repoName}/contents/${dirPath}`,
                {
                    headers: {
                        'Authorization': `Bearer ${config.githubToken}`,
                        'Accept': 'application/vnd.github.v3+json',
                    }
                }
            );

            if (!response.ok) return;

            const items = await response.json();

            for (const item of items) {
                if (fileCount >= maxFiles) break;

                // Skip unwanted directories
                if (item.type === 'dir') {
                    if (!skipDirs.some(skip => item.name === skip || item.path.includes(skip))) {
                        await fetchDir(item.path);
                    }
                    continue;
                }

                // Skip non-code files
                const ext = '.' + item.name.split('.').pop();
                if (!codeExtensions.includes(ext)) continue;

                // Skip large files (package-lock.json, etc)
                if (item.name === 'package-lock.json') continue;

                // Fetch file content
                try {
                    const fileResponse = await fetch(item.url, {
                        headers: {
                            'Authorization': `Bearer ${config.githubToken}`,
                            'Accept': 'application/vnd.github.v3+json',
                        }
                    });

                    if (fileResponse.ok) {
                        const fileData = await fileResponse.json();
                        const content = Buffer.from(fileData.content, 'base64').toString('utf-8');

                        // Skip very large files (>50KB)
                        if (content.length < 50000) {
                            allFiles[item.path] = { content, sha: fileData.sha };
                            fileCount++;
                        }
                    }
                } catch (err) {
                    console.log(`Skipping ${item.path}: ${err.message}`);
                }
            }
        } catch (err) {
            console.log(`Error fetching ${dirPath}: ${err.message}`);
        }
    }

    await fetchDir('');
    console.log(`📂 Fetched ${fileCount} files from ${repoName}`);
    return allFiles;
}

/**
 * Commit changes to a GitHub repo
 * @param {string} repoSlug - App slug
 * @param {Object} files - Map of path -> { content, sha (optional) }
 * @param {string} commitMessage - Commit message
 * @returns {Promise<Object>} Commit result with sha and url
 */
export async function commitChangesToRepo(repoSlug, files, commitMessage) {
    const repoName = config.appRepos[repoSlug];
    if (!repoName) {
        throw new Error(`Unknown app: ${repoSlug}`);
    }

    if (!config.githubToken) {
        throw new Error('GITHUB_TOKEN not configured - add to Railway env vars');
    }

    const results = [];

    for (const [filePath, fileData] of Object.entries(files)) {
        const body = {
            message: commitMessage,
            content: Buffer.from(fileData.content).toString('base64'),
        };

        // If we have the file's SHA, include it for update
        if (fileData.sha) {
            body.sha = fileData.sha;
        }

        const response = await fetch(
            `${GITHUB_API}/repos/${config.githubOwner}/${repoName}/contents/${filePath}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${config.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body)
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to commit ${filePath}: ${error}`);
        }

        const result = await response.json();
        results.push({
            path: filePath,
            sha: result.commit.sha,
            url: result.content.html_url
        });
    }

    return {
        success: true,
        files: results,
        repoUrl: `https://github.com/${config.githubOwner}/${repoName}`
    };
}

/**
 * Get recent commits for rollback reference
 * @param {string} repoSlug - App slug
 * @param {number} count - Number of commits to fetch
 */
export async function getRecentCommits(repoSlug, count = 5) {
    const repoName = config.appRepos[repoSlug];
    if (!repoName || !config.githubToken) {
        throw new Error('Missing repo or token');
    }

    const response = await fetch(
        `${GITHUB_API}/repos/${config.githubOwner}/${repoName}/commits?per_page=${count}`,
        {
            headers: {
                'Authorization': `Bearer ${config.githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
            }
        }
    );

    if (!response.ok) {
        throw new Error(`Failed to get commits: ${response.statusText}`);
    }

    const data = await response.json();
    return data.map(commit => ({
        sha: commit.sha,
        message: commit.commit.message,
        date: commit.commit.author.date,
        url: commit.html_url
    }));
}

/**
 * Revert a file to a previous commit's version
 * @param {string} repoSlug - App slug
 * @param {string} filePath - File to revert
 * @param {string} targetSha - Commit SHA to revert to
 */
export async function revertFile(repoSlug, filePath, targetSha) {
    const repoName = config.appRepos[repoSlug];
    if (!repoName || !config.githubToken) {
        throw new Error('Missing repo or token');
    }

    // Get file content at target commit
    const response = await fetch(
        `${GITHUB_API}/repos/${config.githubOwner}/${repoName}/contents/${filePath}?ref=${targetSha}`,
        {
            headers: {
                'Authorization': `Bearer ${config.githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
            }
        }
    );

    if (!response.ok) {
        throw new Error(`Failed to get file at ${targetSha}: ${response.statusText}`);
    }

    const oldData = await response.json();
    const oldContent = Buffer.from(oldData.content, 'base64').toString('utf-8');

    // Get current file SHA
    const currentResponse = await fetch(
        `${GITHUB_API}/repos/${config.githubOwner}/${repoName}/contents/${filePath}`,
        {
            headers: {
                'Authorization': `Bearer ${config.githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
            }
        }
    );

    if (!currentResponse.ok) {
        throw new Error('Failed to get current file');
    }

    const currentData = await currentResponse.json();

    // Commit the old content
    return commitChangesToRepo(repoSlug, {
        [filePath]: { content: oldContent, sha: currentData.sha }
    }, `Revert ${filePath} to ${targetSha.slice(0, 7)}`);
}

/**
 * Write a completion file for the completion watcher to pick up
 * @param {string} type - Completion type (feature_added, bug_fixed, etc.)
 * @param {Object} data - Completion data
 */
export async function writeCompletionFile(type, data) {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const completionsDir = path.join(__dirname, '../../../completions');

    // Ensure directory exists
    await fs.mkdir(completionsDir, { recursive: true });

    const filename = `completed_${Date.now()}.json`;
    const filePath = path.join(completionsDir, filename);

    const completion = {
        type,
        ...data,
        timestamp: new Date().toISOString()
    };

    await fs.writeFile(filePath, JSON.stringify(completion, null, 2));
    console.log(`✅ Wrote completion file: ${filename}`);

    return filename;
}
