import fs from "fs";
import path from "path";
import pdf from "pdf-parse-debugging-disabled";
import dotenv from "dotenv";
import express from 'express';
import { GoogleGenAI } from "@google/genai";
import { getGameInfo } from "../utils/gameHelper.js";

var router = express.Router();

dotenv.config();

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION,
});

function formatMarkdown(text) {
  // Convert basic markdown to HTML
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  // Bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  
  // Bullet points
  html = html.replace(/^\s*[\*\-]\s+(.*)$/gm, "<li>$1</li>");
  
  // Wrap consecutive list items in <ul>
  html = html.replace(/(?:<li>(?:(?!<li>).)*?<\/li>\s*)+/gs, (match) => {
    return `<ul>\n${match.trim()}\n</ul>`;
  });
  
  // Parse lines to build clean paragraphs and separate list tags
  const lines = html.split(/\r?\n/);
  let result = [];
  let currentParagraph = [];
  
  for (let line of lines) {
    let trimmed = line.trim();
    if (!trimmed) {
      if (currentParagraph.length > 0) {
        result.push(`<p>${currentParagraph.join("<br/>")}</p>`);
        currentParagraph = [];
      }
      continue;
    }
    
    // Check if line is part of a list structure
    if (trimmed.startsWith("<ul>") || trimmed.startsWith("<li>") || trimmed.startsWith("</ul>")) {
      if (currentParagraph.length > 0) {
        result.push(`<p>${currentParagraph.join("<br/>")}</p>`);
        currentParagraph = [];
      }
      result.push(trimmed);
    } else {
      currentParagraph.push(trimmed);
    }
  }
  
  if (currentParagraph.length > 0) {
    result.push(`<p>${currentParagraph.join("<br/>")}</p>`);
  }
  
  return result.join("\n");
}

async function getAnswer(game, question) {
  console.log(`🤔 Game: ${game} | Question: ${question}`);
  try {
    const gameDir = `./games/${game}`;
    const embeddingsPath = `${gameDir}/embeddings.json`;
    
    if (!fs.existsSync(embeddingsPath)) {
      return `❌ No embeddings found for ${game}!`;
    }
    const embeddings = JSON.parse(fs.readFileSync(embeddingsPath, "utf8"));
    console.log(`📚 Loaded ${embeddings.length} embeddings for ${game}`);
    
    const questionResponse = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: question,
    });
    
    const questionEmbedding = questionResponse.embeddings[0].values;
    const similarities = embeddings.map((item) => {
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < questionEmbedding.length; i++) {
        dotProduct += questionEmbedding[i] * item.embedding[i];
        normA += questionEmbedding[i] * questionEmbedding[i];
        normB += item.embedding[i] * item.embedding[i];
      }
      const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
      return {
        text: item.text,
        similarity: similarity,
      };
    });
    
    const topChunks = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
      
    console.log("🔍 Most relevant chunks found:");
    topChunks.forEach((chunk, i) => {
      console.log(`  ${i + 1}. Similarity: ${chunk.similarity.toFixed(3)}`);
    });
    
    const context = topChunks.map((chunk) => chunk.text).join("\n\n");
    const gameInfo = getGameInfo(game);
    
    const prompt = `You are a knowledgeable and friendly tabletop game master at the Emerald Tavern.
Based on the following rulebook context for the game "${gameInfo.name}", answer the user's question.
If the answer is not in the context, use your general knowledge of the game to answer, but indicate that this is general knowledge.
Keep the explanation clear and friendly (as if explaining to a 10-year-old or casual player, but keeping the rule details accurate).

Context from the rulebook:
${context}

Question: ${question}

Answer:`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    console.log("✅ Answer generated!");
    return response.text;
  } catch (error) {
    console.error("❌ Error getting answer:", error.stack || error.message);
    return "Sorry, I couldn't generate an answer due to an error.";
  }
}

async function createEmbeddings(game) {
  try {
    const gameDir = `./games/${game}`;
    let text_data = "";
    const files = fs.readdirSync(gameDir);
    
    // Find files
    const pdfFile = files.find(f => f.toLowerCase().endsWith('.pdf'));
    if (pdfFile) {
      const pdfPath = path.join(gameDir, pdfFile);
      console.log(`📄 Found PDF source: ${pdfPath}`);
      const dataBuffer = fs.readFileSync(pdfPath);
      const parsed = await pdf(dataBuffer);
      text_data = parsed.text;
    } else {
      const txtFile = files.find(f => f.toLowerCase().endsWith('.txt'));
      if (txtFile) {
        const txtPath = path.join(gameDir, txtFile);
        console.log(`📄 Found text source: ${txtPath}`);
        text_data = fs.readFileSync(txtPath, 'utf8');
      } else {
        throw new Error(`No source file (.txt or .pdf) found in game directory: ${gameDir}`);
      }
    }
    
    console.log(`📄 Extracted ${text_data.length} characters from game source`);
    const chunks = [];
    const chunkSize = 1000;
    for (let i = 0; i < text_data.length; i += chunkSize) {
      chunks.push(text_data.slice(i, i + chunkSize));
    }
    console.log(`📝 Created ${chunks.length} text chunks`);
    
    const embeddings = [];
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      console.log(`🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} (${batchChunks.length} chunks)`);
      
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
    
    fs.writeFileSync(`${gameDir}/embeddings.json`, JSON.stringify(embeddings, null, 2));
    console.log(`✅ Embeddings created and saved to ${gameDir}/embeddings.json`);
  } catch (error) {
    console.error("❌ Error creating embeddings:", error.stack || error.message);
    throw error;
  }
}

router.post('/', async function(req, res, next) {
  const gameName = req.body.game || 'clue';
  const question = req.body.question;
  
  const gameDir = `./games/${gameName}`;
  if (!fs.existsSync(gameDir)) {
    return res.status(404).render('error', { message: 'Game folder not found', error: { status: 404 } });
  }
  
  const embeddingsPath = `${gameDir}/embeddings.json`;
  if (!fs.existsSync(embeddingsPath)) {
    console.log(`\n1️⃣ First time setup for ${gameName} - Creating embeddings...`);
    try {
      await createEmbeddings(gameName);
    } catch (e) {
      return res.status(500).render('error', { message: 'Failed to create embeddings: ' + e.message, error: e });
    }
  } else {
    console.log(`\n✅ Embeddings already exist for ${gameName}, skipping creation`);
  }

  const answer = await getAnswer(gameName, question);
  const answerHtml = formatMarkdown(answer);
  const gameInfo = getGameInfo(gameName);
  
  res.render('answer', { 
    game: gameInfo, 
    question: question, 
    answerHtml: answerHtml 
  });
});

export default router;
