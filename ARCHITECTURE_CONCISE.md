# Prompt Perfect Backend - Architecture Overview

## 🎯 What It Does
Transforms vague prompts like "Create a dashboard" into detailed, platform-specific prompts optimized for GPT-5, Claude, or Gemini.

## 🏗️ System Flow

```
Chrome Extension → Express API → Supabase → Meta-Prompt Builder → Azure AI → Enhanced Prompt
```

---

## 📊 Complete Request Flow

### Step 1: Request Validation (Lines 33-50)
```javascript
const { platform, prompt } = req.body;
```
- Receives: `{ "platform": "GPT 5", "prompt": "Create a dashboard" }`
- Validates both fields exist
- Returns 400 error if missing

### Step 2: Fetch Guide from Supabase (Lines 52-74)
```javascript
const { data, error } = await supabase
    .from('prompt_guides')
    .select('guide_data')
    .eq('platform', platform)
    .maybeSingle();
```
- Queries database for platform-specific guide
- Retrieves JSON with principles, structural_elements, anti_patterns
- Returns 404 if guide not found

### Step 3: Build Meta-Prompt (Lines 78-114)
This is the **core intelligence**. Constructs a system prompt by combining:

**3.1 Base Instruction (Line 82)**
```
"You are an expert prompt engineer. Refine the user's prompt based on these key principles:"
```

**3.2 Top 5 Principles (Lines 84-91)**
```javascript
const topPrinciples = guide_data.guide.principles.slice(0, 5);
topPrinciples.forEach((principle, index) => {
    system_prompt_content += `${index + 1}. **${principle.title}**\n`;
    system_prompt_content += `   ${principle.content}\n\n`;
});
```
Example output:
```
1. **Prioritise Clarity and Avoid Contradiction**
   GPT-5 adheres to instructions with surgical precision...
```

**3.3 Top 2 Structural Elements (Lines 93-101)**
```
Key Structural Guidelines:
1. **Use Explicit Delimiters (XML Tags)**
   The most recommended method for structuring prompts is the 'XML sandwich'...
```

**3.4 Top 3 Anti-Patterns (Lines 103-111)**
```
Common Mistakes to Avoid:
1. **Avoid Vague and Contradictory Instructions**
   Do not use vague or poorly constructed prompts...
```

**3.5 Closing Instruction (Line 114)**
```
"Apply these principles to enhance the user's prompt..."
```

**Result**: ~1500-2000 character meta-prompt with platform-specific rules

### Step 4: Call Azure AI (Lines 118-138)
```javascript
const client = ModelClient(AI_ENDPOINT, new AzureKeyCredential(GITHUB_TOKEN));

const response = await client.path("/chat/completions").post({
    body: {
        messages: [
            { role: "system", content: system_prompt_content },  // Meta-prompt
            { role: "user", content: prompt }                     // Original prompt
        ],
        temperature: 1,
        top_p: 1,
        model: "openai/gpt-4.1"
    }
});
```
- **System message**: Teaches AI how to enhance prompts for this platform
- **User message**: The vague prompt to enhance
- AI applies the principles and generates detailed prompt

### Step 5: Return Enhanced Prompt (Lines 140-157)
```javascript
if (isUnexpected(response)) {
    return res.status(500).json({ error: 'AI model request failed' });
}

const enhancedPrompt = response.body.choices[0].message.content;
res.json({ enhanced_prompt: enhancedPrompt });
```
- Extracts AI's response
- Returns to Chrome extension

---

## 🎯 Example Transformation

**Input:**
```json
{ "platform": "GPT 5", "prompt": "Create a dashboard" }
```

**Meta-Prompt Built (1500 chars):**
```
You are an expert prompt engineer...
1. Prioritise Clarity and Avoid Contradiction...
2. Structure Your Prompt Using XML Tags...
[+ 3 more principles, 2 structural elements, 3 anti-patterns]
```

**Output:**
```json
{
  "enhanced_prompt": "Design a dashboard for tracking sales performance. Include:\n1. Key Metrics: total sales, trends, top products\n2. Visualizations: bar charts, line graphs, pie charts\n3. User Interactivity: filters by date, category, location\n4. Layout: easy readability\n5. Technology: Power BI, Tableau, or Google Data Studio..."
}
```

---

## 🔑 Key Components

### Configuration (Lines 12-15)
```javascript
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const AI_ENDPOINT = "https://models.github.ai/inference";
const AI_MODEL = "openai/gpt-4.1";
```

### Database Structure
```
Table: prompt_guides
- platform (text): "GPT 5", "Claude Sonnet 4", "Gemini 2.5"
- guide_data (jsonb): { principles[], structural_elements[], anti_patterns[] }
```

---

## 💡 Why This Works

1. **Platform-Specific**: Each AI gets tailored enhancement rules
2. **Dynamic**: Meta-prompt built fresh from database each time
3. **Layered**: Combines principles + structure + anti-patterns
4. **Teaching AI**: System message instructs AI how to be a prompt engineer

---

## 📡 API Reference

**Endpoint:** `POST /api/enhance`

**Request:**
```json
{ "platform": "GPT 5|Claude Sonnet 4|Gemini 2.5", "prompt": "string" }
```

**Response:**
```json
{ "enhanced_prompt": "detailed enhanced prompt..." }
```

**Errors:** 400 (missing fields), 404 (guide not found), 500 (AI/DB error)

---

## 🚀 Deployment

**Environment Variables:**
- `GITHUB_TOKEN`: GitHub Models API key
- `SUPABASE_URL`: Database URL
- `SUPABASE_KEY`: Database key

**Production:** https://prompt-perfect-backend.vercel.app

---

**Last Updated:** October 1, 2025

