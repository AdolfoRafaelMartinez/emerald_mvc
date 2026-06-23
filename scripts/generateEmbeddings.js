import fs from "fs";
import path from "path";
import pdf from "pdf-parse-debugging-disabled";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION,
});

async function createEmbeddings(game) {
  try {
    const gameDir = path.join(process.cwd(), 'games', game);
    if (!fs.existsSync(gameDir)) {
      console.error(`❌ Game folder not found: ${gameDir}`);
      return;
    }

    let text_data = "";
    const files = fs.readdirSync(gameDir);
    
    // Find source files
    const pdfFile = files.find(f => f.toLowerCase().endsWith('.pdf'));
    if (pdfFile) {
      const pdfPath = path.join(gameDir, pdfFile);
      console.log(`📄 [${game}] Found PDF source: ${pdfPath}`);
      const dataBuffer = fs.readFileSync(pdfPath);
      const parsed = await pdf(dataBuffer);
      text_data = parsed.text;
    } else {
      const txtFile = files.find(f => f.toLowerCase().endsWith('.txt'));
      if (txtFile) {
        const txtPath = path.join(gameDir, txtFile);
        console.log(`📄 [${game}] Found text source: ${txtPath}`);
        text_data = fs.readFileSync(txtPath, 'utf8');
      } else {
        console.warn(`⚠️ [${game}] No source file (.txt or .pdf) found in game directory. Skipping.`);
        return;
      }
    }
    
    console.log(`📄 [${game}] Extracted ${text_data.length} characters from source`);
    const chunks = [];
    const chunkSize = 1000;
    for (let i = 0; i < text_data.length; i += chunkSize) {
      chunks.push(text_data.slice(i, i + chunkSize));
    }
    console.log(`📝 [${game}] Created ${chunks.length} text chunks`);
    
    const embeddings = [];
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      console.log(`🔄 [${game}] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} (${batchChunks.length} chunks)`);
      
      const response = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: batchChunks,
      });
      
      batchChunks.forEach((chunkText, idx) => {
        if (response.embeddings && response.embeddings[idx]) {
          embeddings.push({
            text: chunkText,
            embedding: response.embeddings[idx].values,
          });
        }
      });
      
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    
    const outputPath = path.join(gameDir, 'embeddings.json');
    fs.writeFileSync(outputPath, JSON.stringify(embeddings, null, 2));
    console.log(`✅ [${game}] Embeddings successfully created and saved to ${outputPath}`);
  } catch (error) {
    console.error(`❌ [${game}] Error creating embeddings:`, error.stack || error.message);
    throw error;
  }
}

async function run() {
  const args = process.argv.slice(2);
  const targetGame = args[0];

  const gamesPath = path.join(process.cwd(), 'games');
  if (!fs.existsSync(gamesPath)) {
    console.error("❌ Games directory not found!");
    process.exit(1);
  }

  // Get list of folders to process
  let games = [];
  if (targetGame) {
    games = [targetGame];
  } else {
    games = fs.readdirSync(gamesPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
  }

  console.log(`🔮 Starting embeddings generation for: ${games.join(', ')}`);
  
  for (const game of games) {
    console.log(`\n----------------------------------------\n🚀 Processing game: ${game}`);
    try {
      await createEmbeddings(game);
    } catch (e) {
      console.error(`❌ Failed to generate embeddings for ${game}:`, e.message);
    }
  }
  
  console.log("\n✨ Embeddings generation script complete.");
}

run().catch(err => {
  console.error("❌ Script execution failed:", err);
  process.exit(1);
});
