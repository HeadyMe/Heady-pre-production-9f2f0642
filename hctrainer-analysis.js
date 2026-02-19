#!/usr/bin/env node

// HCTrainer Analysis Script
// Analyzes source code and generates comprehensive metrics

const fs = require('fs');
const path = require('path');

class HCTrainerAnalyzer {
    constructor(sourceDir) {
        this.sourceDir = sourceDir;
        this.results = {
            files: [],
            dependencies: {},
            complexity: {},
            patterns: {},
            recommendations: []
        };
    }

    analyze() {
        console.log('🧠 HCTrainer: Analyzing source code...');
        
        if (!fs.existsSync(this.sourceDir)) {
            console.error('Source directory not found:', this.sourceDir);
            return this.results;
        }

        this.scanFiles();
        this.analyzeDependencies();
        this.calculateComplexity();
        this.identifyPatterns();
        this.generateRecommendations();
        
        return this.results;
    }

    scanFiles() {
        const scanDirectory = (dir, relativePath = '') => {
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const itemRelativePath = path.join(relativePath, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                    scanDirectory(fullPath, itemRelativePath);
                } else if (stat.isFile() && this.isCodeFile(item)) {
                    this.analyzeFile(fullPath, itemRelativePath);
                }
            }
        };
        
        scanDirectory(this.sourceDir);
    }

    isCodeFile(filename) {
        const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rs'];
        return codeExtensions.some(ext => filename.endsWith(ext));
    }

    analyzeFile(filePath, relativePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n').length;
            const size = fs.statSync(filePath).size;
            
            const fileAnalysis = {
                path: relativePath,
                lines: lines,
                size: size,
                functions: this.extractFunctions(content),
                classes: this.extractClasses(content),
                imports: this.extractImports(content),
                complexity: this.calculateFileComplexity(content)
            };
            
            this.results.files.push(fileAnalysis);
        } catch (error) {
            console.warn(`Warning: Could not analyze file ${filePath}:`, error.message);
        }
    }

    extractFunctions(content) {
        const functions = [];
        
        // JavaScript/TypeScript functions
        const jsFunctionRegex = /(?:function\s+(\w+)|(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>)|const\s+(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>))/g;
        let match;
        
        while ((match = jsFunctionRegex.exec(content)) !== null) {
            const functionName = match[1] || match[2] || match[3];
            if (functionName) {
                functions.push(functionName);
            }
        }
        
        return functions;
    }

    extractClasses(content) {
        const classes = [];
        const classRegex = /class\s+(\w+)/g;
        let match;
        
        while ((match = classRegex.exec(content)) !== null) {
            classes.push(match[1]);
        }
        
        return classes;
    }

    extractImports(content) {
        const imports = [];
        
        // ES6 imports
        const es6ImportRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
        let match;
        
        while ((match = es6ImportRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }
        
        // CommonJS requires
        const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        
        while ((match = requireRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }
        
        return imports;
    }

    calculateFileComplexity(content) {
        let complexity = 0;
        
        // Count control structures
        const controlStructures = ['if', 'else', 'for', 'while', 'switch', 'case', 'try', 'catch'];
        for (const structure of controlStructures) {
            const regex = new RegExp(`\\b${structure}\\b`, 'g');
            const matches = content.match(regex);
            if (matches) {
                complexity += matches.length;
            }
        }
        
        // Count nested functions
        const functionRegex = /function\s+\w+|=>\s*{|=\s*function/g;
        const functions = content.match(functionRegex);
        if (functions) {
            complexity += functions.length * 2;
        }
        
        // Count operators
        const operators = ['&&', '||', '!', '===', '!==', '==', '!=', '>=', '<=', '>', '<'];
        for (const op of operators) {
            const regex = new RegExp(`\\${op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
            const matches = content.match(regex);
            if (matches) {
                complexity += matches.length;
            }
        }
        
        return complexity;
    }

    analyzeDependencies() {
        const dependencyMap = {};
        
        for (const file of this.results.files) {
            for (const importPath of file.imports) {
                if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
                    // External dependency
                    const packageName = importPath.split('/')[0];
                    dependencyMap[packageName] = (dependencyMap[packageName] || 0) + 1;
                }
            }
        }
        
        this.results.dependencies = dependencyMap;
    }

    calculateComplexity() {
        let totalComplexity = 0;
        let maxComplexity = 0;
        let avgComplexity = 0;
        
        for (const file of this.results.files) {
            totalComplexity += file.complexity;
            maxComplexity = Math.max(maxComplexity, file.complexity);
        }
        
        if (this.results.files.length > 0) {
            avgComplexity = Math.round(totalComplexity / this.results.files.length);
        }
        
        this.results.complexity = {
            total: totalComplexity,
            average: avgComplexity,
            maximum: maxComplexity,
            byFile: this.results.files.map(f => ({
                file: f.path,
                complexity: f.complexity
            }))
        };
    }

    identifyPatterns() {
        const patterns = {
            architectural: [],
            coding: [],
            structural: []
        };
        
        // Analyze architectural patterns
        const hasMVC = this.results.files.some(f => 
            f.path.includes('controller') || f.path.includes('model') || f.path.includes('view')
        );
        if (hasMVC) {
            patterns.architectural.push('MVC Pattern');
        }
        
        const hasComponentStructure = this.results.files.some(f => 
            f.classes.length > 0 && f.path.includes('component')
        );
        if (hasComponentStructure) {
            patterns.architectural.push('Component-based Architecture');
        }
        
        // Analyze coding patterns
        const totalFunctions = this.results.files.reduce((sum, f) => sum + f.functions.length, 0);
        const totalClasses = this.results.files.reduce((sum, f) => sum + f.classes.length, 0);
        
        if (totalClasses > 0 && totalFunctions / totalClasses > 3) {
            patterns.coding.push('Object-Oriented Programming');
        }
        
        if (this.results.files.some(f => f.imports.length > 5)) {
            patterns.coding.push('Heavy Dependency Usage');
        }
        
        // Analyze structural patterns
        if (this.results.files.length > 10) {
            patterns.structural.push('Large Codebase');
        }
        
        const avgFileSize = this.results.files.reduce((sum, f) => sum + f.size, 0) / this.results.files.length;
        if (avgFileSize > 10000) {
            patterns.structural.push('Large File Sizes');
        }
        
        this.results.patterns = patterns;
    }

    generateRecommendations() {
        const recommendations = [];
        
        // Complexity recommendations
        if (this.results.complexity.maximum > 50) {
            recommendations.push({
                type: 'complexity',
                priority: 'high',
                message: 'Consider refactoring files with high complexity (>50)',
                files: this.results.complexity.byFile.filter(f => f.complexity > 50).map(f => f.file)
            });
        }
        
        // Dependency recommendations
        const dependencyCount = Object.keys(this.results.dependencies).length;
        if (dependencyCount > 20) {
            recommendations.push({
                type: 'dependencies',
                priority: 'medium',
                message: 'High number of external dependencies detected',
                details: `Found ${dependencyCount} unique dependencies`
            });
        }
        
        // Architecture recommendations
        if (this.results.patterns.architectural.length === 0) {
            recommendations.push({
                type: 'architecture',
                priority: 'low',
                message: 'Consider adopting established architectural patterns'
            });
        }
        
        // File size recommendations
        const largeFiles = this.results.files.filter(f => f.lines > 500);
        if (largeFiles.length > 0) {
            recommendations.push({
                type: 'structure',
                priority: 'medium',
                message: 'Some files are quite large (>500 lines)',
                files: largeFiles.map(f => f.path)
            });
        }
        
        // Positive recommendations
        if (this.results.complexity.average < 20) {
            recommendations.push({
                type: 'positive',
                priority: 'info',
                message: 'Good average complexity maintained across codebase'
            });
        }
        
        if (this.results.files.length > 0 && this.results.files.every(f => f.functions.length > 0)) {
            recommendations.push({
                type: 'positive',
                priority: 'info',
                message: 'Good function distribution across files'
            });
        }
        
        this.results.recommendations = recommendations;
    }
}

// Main execution
if (require.main === module) {
    const sourceDir = process.argv[2] || process.cwd();
    const analyzer = new HCTrainerAnalyzer(sourceDir);
    const results = analyzer.analyze();
    
    console.log(JSON.stringify(results, null, 2));
}

module.exports = HCTrainerAnalyzer;
