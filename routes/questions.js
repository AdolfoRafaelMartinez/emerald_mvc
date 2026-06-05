import fs from "fs";
import pdf from "pdf-parse-debugging-disabled";
import dotenv from "dotenv";
import express from 'express';
import { GoogleGenAI } from "@google/genai";

var router = express.Router();

dotenv.config();

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION,
});

async function getAnswer(question) {
  console.log(`🤔 Question: ${question}`);
  try {
    if (!fs.existsSync("./games/clue/embeddings.json")) {
      return "❌ No embeddings found! Please run createEmbeddings() first.";
    }
    const embeddings = JSON.parse(fs.readFileSync("./games/clue/embeddings.json", "utf8"));
    console.log(`📚 Loaded ${embeddings.length} embeddings`);
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
      .slice(0, 3);
    console.log("🔍 Most relevant chunks found:");
    topChunks.forEach((chunk, i) => {
      console.log(`  ${i + 1}. Similarity: ${chunk.similarity.toFixed(3)}`);
    });
    const context = topChunks.map((chunk) => chunk.text).join("\n\n");
    const prompt = `Based on this context from the document, answer the question as though I am 10 years old:

Context:
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
    console.error("❌ Error getting answer:", error.message);
    return "Sorry, I couldn't generate an answer due to an error.";
  }
}

async function createEmbeddings() {
  try {
    const text_data = fs.readFileSync('./games/clue/clue.txt', 'utf8');
    console.log(`📄 Extracted ${text_data.length} characters from text file`);
    const chunks = [];
    const chunkSize = 1000;
    for (let i = 0; i < text_data.length; i += chunkSize) {
      chunks.push(text_data.slice(i, i + chunkSize));
    }
    console.log(`📝 Created ${chunks.length} text chunks`);
    const embeddings = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`🔄 Processing chunk ${i + 1}/${chunks.length}`);
      const response = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: chunks[i],
      });
      embeddings.push({
        text: chunks[i],
        embedding: response.embeddings[0].values,
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    fs.writeFileSync("./games/clue/embeddings.json", JSON.stringify(embeddings, null, 2));
    console.log("✅ Embeddings created and saved to embeddings.json");
  } catch (error) {
    console.error("❌ Error creating embeddings:", error.message);
  }
}

router.post('/', async function(req, res, next) {
  const question = req.body.question;
  if (!fs.existsSync("./games/clue/embeddings.json")) {
    console.log("\n1️⃣ First time setup - Creating embeddings...");
    await createEmbeddings();
  } else {
    console.log("\n✅ Embeddings already exist, skipping creation");
  }

  const answer = await getAnswer(question);
  console.log(`🤗 Answer: ${answer}`);
  res.render('answer', { answer: answer });
});

export default router; 

