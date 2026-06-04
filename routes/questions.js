import fs from "fs";
import express from 'express';
var router = express.Router();

/* GET users listing. */
router.post('/', async function(req, res, next) {
  console.log("=" * 50);
  console.log("🎯 RAG DEMO - Two Simple Functions");
  console.log("=" * 50);

  // Check if embeddings exist
  if (!fs.existsSync("embeddings.json")) {
    console.log("\n1️⃣ First time setup - Creating embeddings...");
    await createEmbeddings();
  } else {
    console.log("\n✅ Embeddings already exist, skipping creation");
  }

  console.log("\n2️⃣ Now asking questions...");

  // Ask some questions
  const questions = ["What do some characters look like?"];

  for (const question of questions) {
    console.log("\n" + "-".repeat(40));
    const answer = await getAnswer(question);
    console.log(`💡 Answer: ${answer}`);
  }
  res.render('answer', { answer: 'ta da!' });
});

export default router; 

