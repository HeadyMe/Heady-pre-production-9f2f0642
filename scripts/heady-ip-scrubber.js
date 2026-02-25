const fs = require('fs');
const path = require('path');

const TARGET_DIRS = [
    path.join(__dirname, '..', 'src'),
    path.join(__dirname, '..', 'sites'),
    path.join(__dirname, '..', 'extensions'),
    path.join(__dirname, '..', 'packages'),
];

// Map exact tokens to ensure clean replacement (longer ones first to avoid partial matches)
const REPLACEMENTS = {
    // Config & Env Vars (Maintain uppercase paradigm)
    'OPENAI_API_KEY': 'HEADY_COMPUTE_KEY',
    'CLAUDE_API_KEY': 'HEADY_JULES_KEY',
    'ANTHROPIC_API_KEY': 'HEADY_NEXUS_KEY',
    'GEMINI_API_KEY': 'HEADY_PYTHIA_KEY',
    'HUGGINGFACE_API_KEY': 'HEADY_HUB_KEY',
    'OLLAMA_HOST': 'HEADY_LOCAL_HOST',

    // Node Classes & Identifiers
    'HeadyClaude': 'HeadyJules',
    'HeadyGemini': 'HeadyPythia',
    'HeadyOpenAI': 'HeadyCompute',
    'HeadyCodex': 'HeadyBuilder',
    'HeadyGroq': 'HeadyFast',
    'HeadyPerplexity': 'HeadyResearch',

    // Raw Strings & Method Names (Case sensitive)
    'benchmarkClaude': 'benchmarkHeadyJules',
    'benchmarkGemini': 'benchmarkHeadyPythia',
    'benchmarkOpenAI': 'benchmarkHeadyCompute',
    'Anthropic': 'HeadyNexus',
    'Claude': 'HeadyJules',
    'OpenAI': 'HeadyCompute',
    'Gemini': 'HeadyPythia',
    'Ollama': 'HeadyLocal',
    'HuggingFace': 'HeadyHub',
    'Windsurf': 'HeadyAI-IDE',
    'HeadyStack': 'HeadyConductor',
    'Parrot': 'HeadyMesh',

    // Lowercase variants for URLs/strings
    'anthropic': 'headynexus',
    'claude': 'headyjules',
    'openai': 'headycompute',
    'gemini': 'headypythia',
    'ollama': 'headylocal',
    'huggingface': 'headyhub'
};

let matchCount = 0;
let fileCount = 0;

function processFile(filePath) {
    try {
        const ext = path.extname(filePath);
        if (!['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.md'].includes(ext)) return;

        // Skip compiled/vendored dirs
        if (filePath.includes('node_modules') || filePath.includes('dist') || filePath.includes('.next') || filePath.includes('build') || filePath.includes('archive')) return;

        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        for (const [target, replacement] of Object.entries(REPLACEMENTS)) {
            // Create a global regex.
            // For standard words, use word boundaries to avoid replacing parts of strings (like 'openai' in 'myopenai_id' unless intended)
            // But for some specific strings we just want global replace.
            let regex;
            if (target === target.toUpperCase() || target.startsWith('Heady') || target.startsWith('benchmark')) {
                regex = new RegExp(target, 'g');
            } else {
                regex = new RegExp(`\\b${target}\\b`, 'g');
            }

            const matches = content.match(regex);
            if (matches) {
                matchCount += matches.length;
                content = content.replace(regex, replacement);
                modified = true;
            }
        }

        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Scrubbed: ${filePath.replace(path.join(__dirname, '..'), '')}`);
            fileCount++;
        }
    } catch (err) {
        console.error(`❌ Failed on ${filePath}:`, err.message);
    }
}

function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scanDirectory(fullPath);
        } else {
            processFile(fullPath);
        }
    }
}

console.log("🚀 Starting Aggressive Heady IP Scrubber...");
TARGET_DIRS.forEach(dir => scanDirectory(dir));

// Also hit the root files
processFile(path.join(__dirname, '..', '.env'));
processFile(path.join(__dirname, '..', 'package.json'));

console.log(`\n🎉 Scrub Complete!`);
console.log(`Processed ${fileCount} files.`);
console.log(`Replaced ${matchCount} competitor / legacy infrastructure references.`);
