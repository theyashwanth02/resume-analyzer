require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const Groq = require('groq-sdk');

console.log('Starting server...');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(cors());
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/analyze', upload.single('resume'), async (req, res) => {
  try {
    const buffer = req.file.buffer;
    const uint8Array = new Uint8Array(buffer);

    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;

    let resumeText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      resumeText += content.items.map(item => item.str).join(' ') + '\n';
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'user',
          content: `You are an expert resume reviewer. Analyze this resume and provide:
1. Overall Score (out of 100)
2. Strengths (3-4 points)
3. Weaknesses (3-4 points)
4. Missing Sections (what should be added)
5. Improvement Tips (3-4 actionable tips)
6. ATS Compatibility (is it ATS friendly? why?)

Resume Content:
${resumeText}

Format your response clearly with proper headings.`
        }
      ]
    });

    const analysis = completion.choices[0].message.content;
    res.json({ success: true, analysis });

  } catch (error) {
    console.log('Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Resume Analyzer running at http://localhost:3000');
});