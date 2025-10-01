// Import required libraries
const express = require('express');
require('dotenv').config();
const supabase = require('./supabaseClient');
const ModelClient = require('@azure-rest/ai-inference').default;
const { isUnexpected } = require('@azure-rest/ai-inference');
const { AzureKeyCredential } = require('@azure/core-auth');

// Create Express application
const app = express();

// Azure AI Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const AI_ENDPOINT = "https://models.github.ai/inference";
const AI_MODEL = "openai/gpt-4.1";

// Middleware to parse JSON requests
app.use(express.json());

// Middleware to parse URL-encoded requests
app.use(express.urlencoded({ extended: true }));

// Basic health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'success',
        message: 'Prompt Perfect Backend Server is running!',
        timestamp: new Date().toISOString()
    });
});

// POST API endpoint for prompt enhancement
app.post('/api/enhance', async (req, res) => {
    try {
        // Extract platform and prompt from request body
        const { platform, prompt } = req.body;
        
        // Validate that platform is provided
        if (!platform) {
            return res.status(400).json({
                error: 'Platform is required in the request body'
            });
        }
        
        // Validate that prompt is provided
        if (!prompt) {
            return res.status(400).json({
                error: 'Prompt is required in the request body'
            });
        }
        
        console.log(`🔍 Searching for guide: ${platform}`);
        
        // Query the prompt_guides table for the specified platform
        const { data, error } = await supabase
            .from('prompt_guides')
            .select('guide_data')
            .eq('platform', platform)
            .maybeSingle();
        
        if (error) {
            console.error('Supabase query error:', error);
            return res.status(500).json({
                error: 'Database query failed'
            });
        }
        
        // Check if a guide was found
        if (!data) {
            console.log(`❌ No guide found for platform: ${platform}`);
            return res.status(404).json({
                error: 'Guide not found for the specified platform'
            });
        }
        
        console.log(`✅ Guide found for platform: ${platform}`);
        
        // Construct the meta-prompt (system prompt) from the guide data
        const guide_data = data.guide_data;
        
        // Start with a base instruction
        let system_prompt_content = "You are an expert prompt engineer. Refine the user's prompt based on these key principles:\n\n";
        
        // Helper function: Select relevant principles based on detection patterns
        function selectRelevantPrinciples(userPrompt, allPrinciples) {
            const relevantPrinciples = [];
            const promptLower = userPrompt.toLowerCase();
            
            // Find principles whose detection patterns match the prompt
            allPrinciples.forEach(principle => {
                if (principle.detection_patterns) {
                    const isRelevant = principle.detection_patterns.some(pattern => 
                        promptLower.includes(pattern.toLowerCase())
                    );
                    
                    if (isRelevant) {
                        relevantPrinciples.push({ ...principle, matched: true });
                    }
                }
            });
            
            // Sort by priority if available, otherwise keep order
            // Create a copy to avoid mutating the original array
            const sortedPrinciples = [...allPrinciples].sort((a, b) => {
                const priorityA = a.priority || 999;
                const priorityB = b.priority || 999;
                return priorityA - priorityB;
            });
            
            // If we have few relevant matches, add top priority principles
            if (relevantPrinciples.length < 3) {
                const additionalPrinciples = sortedPrinciples
                    .filter(p => !relevantPrinciples.find(rp => rp.title === p.title))
                    .slice(0, 5 - relevantPrinciples.length);
                relevantPrinciples.push(...additionalPrinciples);
            }
            
            return relevantPrinciples.slice(0, 5);
        }
        
        // Add the most relevant principles (context-aware selection)
        if (guide_data.guide && guide_data.guide.principles) {
            const topPrinciples = selectRelevantPrinciples(prompt, guide_data.guide.principles);
            
            topPrinciples.forEach((principle, index) => {
                system_prompt_content += `${index + 1}. **${principle.title}**\n`;
                system_prompt_content += `   ${principle.content}\n\n`;
            });
        }
        
        // Add key structural elements (top 2)
        if (guide_data.guide && guide_data.guide.structural_elements) {
            system_prompt_content += "Key Structural Guidelines:\n\n";
            const topStructural = guide_data.guide.structural_elements.slice(0, 2);
            topStructural.forEach((element, index) => {
                system_prompt_content += `${index + 1}. **${element.title}**\n`;
                system_prompt_content += `   ${element.content}\n\n`;
            });
        }
        
        // Add anti-patterns to avoid (top 3)
        if (guide_data.guide && guide_data.guide.anti_patterns) {
            system_prompt_content += "Common Mistakes to Avoid:\n\n";
            const topAntiPatterns = guide_data.guide.anti_patterns.slice(0, 3);
            topAntiPatterns.forEach((antiPattern, index) => {
                system_prompt_content += `${index + 1}. **${antiPattern.title}**\n`;
                system_prompt_content += `   ${antiPattern.content}\n\n`;
            });
        }
        
        // Helper function: Detect task type from prompt
        function detectTaskType(userPrompt) {
            const promptLower = userPrompt.toLowerCase();
            
            // Check for code generation
            if (/(code|function|api|debug|fix|script|program|algorithm|implement|bug)/.test(promptLower) ||
                /(javascript|python|java|react|node|sql|html|css)/.test(promptLower)) {
                return 'code_generation';
            }
            
            // Check for formal writing
            if (/(write|email|document|report|letter|memo|proposal|essay|article)/.test(promptLower) ||
                /(formal|professional|business|academic)/.test(promptLower)) {
                return 'formal_writing';
            }
            
            // Check for creative writing
            if (/(story|narrative|poem|creative|fiction|character|plot|dialogue)/.test(promptLower) ||
                /(imagine|invent|brainstorm|ideate)/.test(promptLower)) {
                return 'creative_writing';
            }
            
            // Check for data analysis
            if (/(analyze|data|csv|json|statistics|chart|graph|evaluate|compare)/.test(promptLower) ||
                /(dataset|metrics|insights|trends|visualize)/.test(promptLower)) {
                return 'data_analysis';
            }
            
            // Check for reasoning/analysis
            if (/(reasoning|logic|solve|calculate|math|problem|think|analyze)/.test(promptLower)) {
                return 'reasoning_and_analysis';
            }
            
            return 'general';
        }
        
        // Add task-specific guidelines if applicable
        const taskType = detectTaskType(prompt);
        
        if (taskType !== 'general' && guide_data.guide && guide_data.guide.task_specific_guides && guide_data.guide.task_specific_guides[taskType]) {
            system_prompt_content += "\n## Task-Specific Guidelines:\n\n";
            const taskGuides = guide_data.guide.task_specific_guides[taskType];
            
            taskGuides.forEach((guide, index) => {
                system_prompt_content += `${index + 1}. **${guide.title}**\n`;
                system_prompt_content += `   ${guide.content}\n`;
                
                // Add example if available
                if (guide.example) {
                    system_prompt_content += `   \n   Example Transformation:\n`;
                    system_prompt_content += `   Before: "${guide.example.before}"\n`;
                    system_prompt_content += `   After: "${guide.example.after}"\n`;
                }
                system_prompt_content += `\n`;
            });
        }
        
        // Add a closing instruction
        system_prompt_content += "\nApply these principles to enhance the user's prompt, making it more specific, structured, and effective for the target AI platform.";
        
        // Initialize the Azure AI client
        const client = ModelClient(
            AI_ENDPOINT,
            new AzureKeyCredential(GITHUB_TOKEN)
        );
        
        // Make the API call to enhance the prompt
        const response = await client.path("/chat/completions").post({
            body: {
                messages: [
                    { role: "system", content: system_prompt_content },
                    { role: "user", content: prompt }
                ],
                temperature: 1,
                top_p: 1,
                model: AI_MODEL
            }
        });
        
        // Check if the response is unexpected (error)
        if (isUnexpected(response)) {
            console.error('AI model error:', response.body.error);
            return res.status(500).json({
                error: 'AI model request failed',
                details: response.body.error
            });
        }
        
        // Extract the enhanced prompt from the response
        const enhancedPrompt = response.body.choices[0].message.content;
        
        // Return only the enhanced prompt
        res.json({
            enhanced_prompt: enhancedPrompt
        });
        
    } catch (error) {
        console.error('Error in /api/enhance endpoint:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

// Get the port from environment variables or default to 3001
const PORT = process.env.PORT || 3001;

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Prompt Perfect Backend Server is running on port ${PORT}`);
    console.log(`📡 Health check available at: http://localhost:${PORT}`);
    console.log(`🔧 API endpoint available at: http://localhost:${PORT}/api/enhance`);
    console.log(`⏰ Server started at: ${new Date().toISOString()}`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    process.exit(0);
});
