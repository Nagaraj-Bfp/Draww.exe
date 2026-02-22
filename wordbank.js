/* ═══════════════════════════════════════════
   WORD BANK — wordbank.js
   All Bipolar Factory internal terms
   ═══════════════════════════════════════════ */

   const wordBank = {
    "Dev Tools": [
      "FastAPI", "Docker", "Git", "GitHub", "VS Code", "Cursor",
      "PostgreSQL", "Redis", "Nginx", "Terminal", "SSH", "Linux",
      "Python", "Node.js", "TypeScript"
    ],
    "Engineering": [
      "API", "Webhook", "Microservice", "Load Balancer", "CI/CD",
      "Deployment", "Debug", "Hotfix", "Pull Request", "Merge Conflict",
      "Code Review", "Tech Debt", "Refactor", "Unit Test", "Pipeline",
      "Database", "Cache", "Queue", "Server", "Cloud"
    ],
    "AI & ML": [
      "LLM", "Prompt Engineering", "AI Pipeline", "Fine-tuning",
      "Embedding", "Vector Database", "RAG", "Inference",
      "Neural Network", "Training Data", "GPT", "Claude", "Gemini",
      "Chatbot", "Token"
    ],
    "Team & Process": [
      "Sprint", "Standup", "Backlog", "Kanban", "Agile", "Retrospective",
      "Roadmap", "Stakeholder", "MVP", "Hackathon", "Demo Day", "OKR",
      "Deadline", "Milestone", "Blocker"
    ],
    "Tools & Comms": [
      "Slack", "Notion", "Figma", "Loom", "Zoom", "Jira",
      "Google Meet", "Linear", "Miro", "Confluence",
      "Trello", "Postman", "Vercel", "Railway"
    ],
    "Factory Specials": [
      "Hack the Factory", "Ship It", "Move Fast", "Vibe Code",
      "Break Things", "Question Systems", "Bold Experiment",
      "One Person", "Full Ownership", "Ship Boldly"
    ]
  };
  
  // Flat list for random picking
  function getAllWords() {
    return Object.entries(wordBank).flatMap(([cat, words]) =>
      words.map(word => ({ word, category: cat }))
    );
  }
  
  // Pick N random words (no repeats)
  function pickWords(n, usedWords = []) {
    const all = getAllWords().filter(w => !usedWords.includes(w.word));
    const shuffled = all.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  }
  
  // Get category for a word
  function getCategory(word) {
    for (const [cat, words] of Object.entries(wordBank)) {
      if (words.includes(word)) return cat;
    }
    return 'Unknown';
  }
  
  module.exports = { wordBank, getAllWords, pickWords, getCategory };