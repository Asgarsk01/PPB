// Import required modules
const fs = require('fs');
const path = require('path');
const supabase = require('../supabaseClient');

// Function to seed the prompt guides data
async function seedPromptGuides() {
    try {
        console.log('🌱 Starting seed process...');
        
        // Read the Gemini guide JSON file
        const geminiGuidePath = path.join(__dirname, 'guides', 'gemini_guide.json');
        console.log(`📖 Reading guide from: ${geminiGuidePath}`);
        
        // Check if file exists
        if (!fs.existsSync(geminiGuidePath)) {
            throw new Error(`Guide file not found at: ${geminiGuidePath}`);
        }
        
        // Read and parse the JSON data
        const guideData = JSON.parse(fs.readFileSync(geminiGuidePath, 'utf8'));
        console.log(`✅ Successfully loaded guide data for platform: ${guideData.platform}`);
        
        // Extract platform and version from the JSON
        const platform = guideData.platform;
        const version = guideData.version;
        
        // Prepare the data for insertion
        const insertData = {
            platform: platform,
            version: version,
            guide_data: guideData.guide // Store the entire guide object
        };
        
        console.log(`📝 Inserting data into prompt_guides table...`);
        console.log(`   Platform: ${platform}`);
        console.log(`   Version: ${version}`);
        
        // Insert the data into Supabase
        const { data, error } = await supabase
            .from('prompt_guides')
            .insert([insertData])
            .select();
        
        if (error) {
            throw new Error(`Supabase insertion error: ${error.message}`);
        }
        
        console.log('🎉 Success! Prompt guide data has been inserted into the database.');
        console.log(`📊 Inserted record ID: ${data[0].id}`);
        console.log(`🕒 Created at: ${data[0].created_at}`);
        
    } catch (error) {
        console.error('❌ Error during seed process:', error.message);
        process.exit(1);
    }
}

// Function to seed all available guides
async function seedAllGuides() {
    try {
        console.log('🌱 Starting comprehensive seed process...');
        
        const guidesDir = path.join(__dirname, 'guides');
        const guideFiles = fs.readdirSync(guidesDir).filter(file => file.endsWith('.json'));
        
        console.log(`📚 Found ${guideFiles.length} guide files to process`);
        
        for (const file of guideFiles) {
            console.log(`\n📖 Processing: ${file}`);
            
            const guidePath = path.join(guidesDir, file);
            const guideData = JSON.parse(fs.readFileSync(guidePath, 'utf8'));
            
            const insertData = {
                platform: guideData.platform,
                version: guideData.version,
                guide_data: guideData.guide
            };
            
            // Check if this guide already exists
            const { data: existing } = await supabase
                .from('prompt_guides')
                .select('id')
                .eq('platform', guideData.platform)
                .eq('version', guideData.version)
                .single();
            
            if (existing) {
                console.log(`⚠️  Guide for ${guideData.platform} v${guideData.version} already exists, skipping...`);
                continue;
            }
            
            const { data, error } = await supabase
                .from('prompt_guides')
                .insert([insertData])
                .select();
            
            if (error) {
                console.error(`❌ Error inserting ${file}:`, error.message);
                continue;
            }
            
            console.log(`✅ Successfully inserted ${guideData.platform} v${guideData.version}`);
            console.log(`   Record ID: ${data[0].id}`);
        }
        
        console.log('\n🎉 All guides have been processed!');
        
    } catch (error) {
        console.error('❌ Error during comprehensive seed process:', error.message);
        process.exit(1);
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--all')) {
        await seedAllGuides();
    } else {
        await seedPromptGuides();
    }
    
    console.log('\n✨ Seed process completed successfully!');
    process.exit(0);
}

// Run the script
main();
