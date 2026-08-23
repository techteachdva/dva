/**
 * ITEM 2025 + MN ELA standards catalogs and text-evidence alignment for WriteFlow.
 */
(() => {
  "use strict";

  const CATALOG_IDS = {
    item: "item",
    mn_ela: "mn_ela",
  };

  const CATALOG_LABELS = {
    item: "ITEM 2025",
    mn_ela: "MN ELA",
  };

  const SIGNAL_PRESETS = {
    inquiry: {
      keywords: ["research", "question", "topic", "inquiry", "investigate", "explore", "wonder", "curious", "hypothesis", "focus"],
      metrics: { story: 0.5, mechanics: 0.2, semantics: 0.3 },
      minWords: 35,
    },
    sources: {
      keywords: ["source", "website", "article", "database", "encyclopedia", "primary", "secondary", "reference", "citation", "link", "search", "keyword"],
      metrics: { story: 0.45, mechanics: 0.25, semantics: 0.3 },
      minWords: 40,
    },
    evaluate: {
      keywords: ["credible", "credibility", "reliable", "bias", "perspective", "authority", "accurate", "fact", "opinion", "misinformation", "fake", "verify", "trust"],
      metrics: { story: 0.55, mechanics: 0.2, semantics: 0.25 },
      minWords: 45,
    },
    gather: {
      keywords: ["gather", "organize", "record", "note", "paraphrase", "summarize", "quote", "cite", "plagiarism", "information", "evidence", "data"],
      metrics: { mechanics: 0.35, story: 0.4, semantics: 0.25 },
      minWords: 50,
    },
    share: {
      keywords: ["conclusion", "synthesize", "finding", "share", "audience", "reflect", "improve", "evaluate", "feedback", "revise", "publish", "present"],
      metrics: { story: 0.6, mechanics: 0.25, semantics: 0.15 },
      minWords: 45,
    },
    digitalIdentity: {
      keywords: ["digital", "footprint", "reputation", "online", "identity", "profile", "post", "comment", "respect", "kind", "responsible"],
      metrics: { story: 0.55, mechanics: 0.25, semantics: 0.2 },
      minWords: 40,
    },
    digitalImpact: {
      keywords: ["technology", "impact", "community", "family", "world", "artificial intelligence", "ai", "social media", "device", "screen"],
      metrics: { story: 0.6, mechanics: 0.2, semantics: 0.2 },
      minWords: 40,
    },
    digitalExchange: {
      keywords: ["cyberbully", "trolling", "policy", "acceptable use", "ethical", "legal", "exchange", "communicate", "message", "chat"],
      metrics: { story: 0.55, mechanics: 0.25, semantics: 0.2 },
      minWords: 40,
    },
    ip: {
      keywords: ["copyright", "plagiarism", "intellectual property", "creative commons", "fair use", "credit", "attribute", "license", "remix", "original"],
      metrics: { mechanics: 0.35, story: 0.35, semantics: 0.3 },
      minWords: 40,
    },
    privacy: {
      keywords: ["privacy", "security", "password", "phishing", "scam", "hack", "permission", "cookie", "tracking", "identity theft", "safe"],
      metrics: { story: 0.5, mechanics: 0.25, semantics: 0.25 },
      minWords: 40,
    },
    mediaLiteracy: {
      keywords: ["misinformation", "misleading", "decode", "media", "message", "advertisement", "verify", "snopes", "false", "truth"],
      metrics: { story: 0.5, mechanics: 0.25, semantics: 0.25 },
      minWords: 40,
    },
    techKnowledge: {
      keywords: ["program", "app", "software", "device", "tool", "purpose", "simulate", "technology", "digital tool", "feature"],
      metrics: { story: 0.45, semantics: 0.35, mechanics: 0.2 },
      minWords: 35,
    },
    troubleshoot: {
      keywords: ["problem", "error", "fix", "troubleshoot", "restart", "refresh", "connectivity", "hardware", "software", "update", "cache", "cookie"],
      metrics: { story: 0.5, mechanics: 0.3, semantics: 0.2 },
      minWords: 35,
    },
    tools: {
      keywords: ["document", "slide", "presentation", "video", "edit", "collaborate", "google docs", "spreadsheet", "create", "design", "multimedia", "image"],
      metrics: { story: 0.4, mechanics: 0.25, semantics: 0.35 },
      minWords: 40,
    },
    design: {
      keywords: ["layout", "font", "color", "image", "caption", "theme", "template", "visual", "audio", "heading", "audience", "communicate"],
      metrics: { story: 0.35, semantics: 0.4, mechanics: 0.25 },
      minWords: 40,
    },
    typing: {
      keywords: ["type", "keyboard", "finger", "posture", "ergonomic", "touch typing", "home row"],
      metrics: { typing: 0.6, mechanics: 0.2, story: 0.2 },
      minWords: 25,
    },
    designProcess: {
      keywords: ["design", "prototype", "test", "improve", "iterate", "problem", "solution", "plan", "create", "debug", "idea"],
      metrics: { story: 0.55, mechanics: 0.25, semantics: 0.2 },
      minWords: 45,
    },
    computational: {
      keywords: ["algorithm", "decompose", "pattern", "abstraction", "debug", "loop", "conditional", "sequence", "event", "code", "program", "tinker"],
      metrics: { story: 0.45, semantics: 0.35, mechanics: 0.2 },
      minWords: 40,
    },
    collaborate: {
      keywords: ["collaborate", "peer", "group", "team", "share", "comment", "permission", "role", "purpose", "discuss", "exchange", "together"],
      metrics: { story: 0.55, mechanics: 0.25, semantics: 0.2 },
      minWords: 40,
    },
    readerIdentity: {
      keywords: ["reader", "reading", "genre", "prefer", "interest", "motivation", "identity", "experience", "like", "dislike", "habit"],
      metrics: { story: 0.6, mechanics: 0.2, semantics: 0.2 },
      minWords: 40,
    },
    literacyCommunity: {
      keywords: ["recommend", "review", "award", "catalog", "perspective", "culture", "community", "connect", "respond", "diverse", "identity", "text"],
      metrics: { story: 0.6, mechanics: 0.2, semantics: 0.2 },
      minWords: 45,
    },
    generic: {
      keywords: ["because", "reason", "example", "evidence", "explain", "describe", "think", "learn"],
      metrics: { story: 0.4, mechanics: 0.3, semantics: 0.3 },
      minWords: 30,
    },
    elaReading: {
      keywords: ["read", "text", "quote", "cite", "evidence", "inference", "summary", "comprehend", "analyze", "author", "perspective", "character", "theme"],
      metrics: { story: 0.5, semantics: 0.3, mechanics: 0.2 },
      minWords: 40,
    },
    elaPhonics: {
      keywords: ["phonics", "decode", "syllable", "word", "fluency", "accuracy", "expression", "sound"],
      metrics: { mechanics: 0.45, story: 0.35, semantics: 0.2 },
      minWords: 25,
    },
    elaTheme: {
      keywords: ["theme", "central idea", "inference", "detail", "summary", "quote", "explicit", "convey", "develop"],
      metrics: { story: 0.55, semantics: 0.25, mechanics: 0.2 },
      minWords: 45,
    },
    elaStructure: {
      keywords: ["structure", "chapter", "scene", "stanza", "sequence", "paragraph", "section", "organize", "layout"],
      metrics: { story: 0.5, semantics: 0.3, mechanics: 0.2 },
      minWords: 40,
    },
    elaAuthor: {
      keywords: ["author", "perspective", "bias", "fact", "fiction", "compare", "contrast", "viewpoint", "identity", "dakota", "anishinaabe"],
      metrics: { story: 0.55, semantics: 0.25, mechanics: 0.2 },
      minWords: 45,
    },
    elaVocabulary: {
      keywords: ["word", "vocabulary", "meaning", "tone", "connotation", "denotation", "figurative", "phrase", "nuance"],
      metrics: { semantics: 0.5, story: 0.35, mechanics: 0.15 },
      minWords: 35,
    },
    elaMedia: {
      keywords: ["source", "credible", "credibility", "perspective", "bias", "relevant", "valid", "format", "media", "digital"],
      metrics: { story: 0.5, semantics: 0.3, mechanics: 0.2 },
      minWords: 40,
    },
    elaWritingMechanics: {
      keywords: ["punctuation", "spelling", "capitalization", "grammar", "sentence", "clause", "phrase", "verb", "noun"],
      metrics: { mechanics: 0.65, syntax: 0.25, story: 0.1 },
      minWords: 30,
    },
    elaWritingProcess: {
      keywords: ["draft", "revise", "edit", "publish", "plan", "audience", "purpose", "voice", "tone", "precise"],
      metrics: { story: 0.5, mechanics: 0.3, semantics: 0.2 },
      minWords: 40,
    },
    elaArgument: {
      keywords: ["claim", "argument", "evidence", "reason", "persuade", "counter", "opinion", "support", "valid", "relevant"],
      metrics: { story: 0.55, mechanics: 0.25, semantics: 0.2 },
      minWords: 50,
    },
    elaInform: {
      keywords: ["inform", "explain", "topic", "detail", "organize", "structure", "vocabulary", "domain", "convey", "integrate"],
      metrics: { story: 0.5, semantics: 0.35, mechanics: 0.15 },
      minWords: 50,
    },
    elaNarrative: {
      keywords: ["narrative", "story", "dialogue", "character", "plot", "poetry", "figurative", "sensory", "voice", "tone", "mood", "pacing"],
      metrics: { story: 0.45, detail: 0.25, voice: 0.2, mechanics: 0.1 },
      minWords: 45,
    },
    elaResearch: {
      keywords: ["research", "question", "inquiry", "source", "cite", "paraphrase", "quote", "summarize", "plagiarism", "synthesize"],
      metrics: { story: 0.4, mechanics: 0.3, semantics: 0.3 },
      minWords: 45,
    },
    elaSpeaking: {
      keywords: ["discuss", "collaborate", "listen", "feedback", "present", "audience", "communicate", "digital", "exchange", "cooperate"],
      metrics: { story: 0.55, mechanics: 0.25, semantics: 0.2 },
      minWords: 35,
    },
  };

  function elaSignalFor(code = "") {
    const parts = String(code).split(".");
    const major = parts[1];
    const minor = parts[2];
    if (major === "1") {
      if (minor === "9") return SIGNAL_PRESETS.elaMedia;
      if (minor === "8") return SIGNAL_PRESETS.elaVocabulary;
      if (minor === "7") return SIGNAL_PRESETS.elaArgument;
      if (minor === "6") return SIGNAL_PRESETS.elaAuthor;
      if (minor === "5") return SIGNAL_PRESETS.elaStructure;
      if (minor === "1") return SIGNAL_PRESETS.elaPhonics;
      return SIGNAL_PRESETS.elaReading;
    }
    if (major === "2") {
      if (minor === "1") return SIGNAL_PRESETS.elaWritingMechanics;
      if (minor === "4") return SIGNAL_PRESETS.elaArgument;
      if (minor === "5") return SIGNAL_PRESETS.elaInform;
      if (minor === "6") return SIGNAL_PRESETS.elaNarrative;
      if (minor === "7" || minor === "8") return SIGNAL_PRESETS.elaResearch;
      return SIGNAL_PRESETS.elaWritingProcess;
    }
    if (major === "3") return SIGNAL_PRESETS.elaSpeaking;
    return SIGNAL_PRESETS.generic;
  }

  function enrichElaStandard(raw) {
    const base = elaSignalFor(raw.code);
    const signal = mergeSignalWithBenchmark(base, raw.benchmark, raw.code, CATALOG_IDS.mn_ela);
    return {
      ...raw,
      catalog: CATALOG_IDS.mn_ela,
      connections: raw.connections || "",
      signal,
    };
  }

  function enrichItemStandard(raw) {
    const signal = mergeSignalWithBenchmark(raw.signal || SIGNAL_PRESETS.generic, raw.benchmark, raw.code, CATALOG_IDS.item);
    return { ...raw, catalog: CATALOG_IDS.item, signal };
  }

  const ITEM_2025_STANDARDS = [
    {
      code: "8.1.1.1",
      grade: 8,
      strand: "Information Literacy and Research",
      anchorStandard: "IL1. Initiate and guide inquiry by selecting meaningful topics and research questions, considering personal interest, societal needs, and academic requirements.",
      benchmark: "Determine a final topic, using a variety of pre-research strategies (connections to prior knowledge, background knowledge, subtopics, peer/teacher feedback).",
      connections: "",
      shortTitle: "Determine a final topic",
      signal: SIGNAL_PRESETS.inquiry,
    },
    {
      code: "8.1.1.2",
      grade: 8,
      strand: "Information Literacy and Research",
      anchorStandard: "IL1. Initiate and guide inquiry by selecting meaningful topics and research questions, considering personal interest, societal needs, and academic requirements.",
      benchmark: "Independently ask questions about their research topic that are relevant to personal interest or societal needs and meet academic requirements.",
      connections: "MN ELA 6–8.2.7.1 — self-generated questions that guide inquiry.",
      shortTitle: "Ask research questions",
      signal: SIGNAL_PRESETS.inquiry,
    },
    {
      code: "8.1.1.3",
      grade: 8,
      strand: "Information Literacy and Research",
      anchorStandard: "IL1. Initiate and guide inquiry by selecting meaningful topics and research questions, considering personal interest, societal needs, and academic requirements.",
      benchmark: "Refine and clarify questions to guide inquiry (remove irrelevant questions, combine similar ones, identify missing information).",
      connections: "MN ELA 6–8.2.7.1",
      shortTitle: "Refine research questions",
      signal: SIGNAL_PRESETS.inquiry,
    },
    {
      code: "8.1.2.1",
      grade: 8,
      strand: "Information Literacy and Research",
      anchorStandard: "IL2. Identify and use a variety of sources from multiple perspectives, employing advanced search strategies.",
      benchmark: "Identify specific sources that could answer questions on a topic (authorities, brief database/AI searches, browsing print and digital materials).",
      connections: "",
      shortTitle: "Identify potential sources",
      signal: SIGNAL_PRESETS.sources,
    },
    {
      code: "8.1.2.2",
      grade: 8,
      strand: "Information Literacy and Research",
      anchorStandard: "IL2. Identify and use a variety of sources from multiple perspectives, employing advanced search strategies.",
      benchmark: "Use search strategies including keywords, search phrases, filters, and sorts to find possible sources.",
      connections: "",
      shortTitle: "Advanced search strategies",
      signal: SIGNAL_PRESETS.sources,
    },
    {
      code: "8.1.2.3",
      grade: 8,
      strand: "Information Literacy and Research",
      anchorStandard: "IL2. Identify and use a variety of sources from multiple perspectives, employing advanced search strategies.",
      benchmark: "Identify sources that include multiple perspectives on the research topic (e.g. pro and con for an issue).",
      connections: "",
      shortTitle: "Multiple perspectives in sources",
      signal: SIGNAL_PRESETS.evaluate,
    },
    {
      code: "8.1.2.4",
      grade: 8,
      strand: "Information Literacy and Research",
      anchorStandard: "IL2. Identify and use a variety of sources from multiple perspectives, employing advanced search strategies.",
      benchmark: "Identify and access a wide variety of source types (books, encyclopedias, websites, databases, AI, primary/secondary sources, data collections).",
      connections: "MN SS 6.4.20.1 — evaluate primary and secondary sources.",
      shortTitle: "Variety of source types",
      signal: SIGNAL_PRESETS.sources,
    },
    {
      code: "8.1.3.1",
      grade: 8,
      strand: "Information Literacy and Research",
      anchorStandard: "IL3. Evaluate sources for credibility, accuracy, authority, relevance, and purpose.",
      benchmark: "Determine if a source is relevant for the personal or academic purpose.",
      connections: "MN ELA 6–8.1.9.2 — evaluate perspective, credibility, relevancy.",
      shortTitle: "Source relevance",
      signal: SIGNAL_PRESETS.evaluate,
    },
    {
      code: "8.1.3.2",
      grade: 8,
      strand: "Information Literacy and Research",
      anchorStandard: "IL3. Evaluate sources for credibility, accuracy, authority, relevance, and purpose.",
      benchmark: "Determine credibility and authority of a source (author, domain, AI vs human-generated, credentials).",
      connections: "MN ELA 6–8.1.9.2",
      shortTitle: "Credibility and authority",
      signal: SIGNAL_PRESETS.evaluate,
    },
    {
      code: "8.1.3.3",
      grade: 8,
      strand: "Information Literacy and Research",
      anchorStandard: "IL3. Evaluate sources for credibility, accuracy, authority, relevance, and purpose.",
      benchmark: "Determine if a source is reliable, accurate, and current (verify with additional sources, compare AI to human info, identify fake news, fact vs opinion).",
      connections: "",
      shortTitle: "Reliability and accuracy",
      signal: SIGNAL_PRESETS.evaluate,
    },
    {
      code: "8.1.3.4",
      grade: 8,
      strand: "Information Literacy and Research",
      anchorStandard: "IL3. Evaluate sources for credibility, accuracy, authority, relevance, and purpose.",
      benchmark: "Select information and sources that represent diverse perspectives (identify perspectives, examine creator background, describe bias, compare viewpoints).",
      connections: "MN ELA 8.1.9.2",
      shortTitle: "Diverse perspectives in sources",
      signal: SIGNAL_PRESETS.evaluate,
    },
    {
      code: "8.1.4.1",
      grade: 8,
      strand: "Information Literacy and Research",
      anchorStandard: "IL4. Gather and organize information using strategies to find relevant information within sources.",
      benchmark: "Gather information from a variety of sources that answer specific questions or meet information needs.",
      connections: "MN ELA 8.1.9.1 — access information from a wide variety of sources.",
      shortTitle: "Gather information",
      signal: SIGNAL_PRESETS.gather,
    },
    {
      code: "8.1.4.2",
      grade: 8,
      strand: "Information Literacy and Research",
      anchorStandard: "IL4. Gather and organize information using strategies to find relevant information within sources.",
      benchmark: "Record information from sources with key identifiers (title, author, year, format/link); quote, paraphrase, summarize; avoid plagiarism.",
      connections: "MN ELA 8.2.8.1 — cite print and digital sources.",
      shortTitle: "Record and cite sources",
      signal: SIGNAL_PRESETS.gather,
    },
    {
      code: "8.1.4.3",
      grade: 8,
      strand: "Information Literacy and Research",
      anchorStandard: "IL4. Gather and organize information using strategies to find relevant information within sources.",
      benchmark: "Use a system to organize gathered information and determine if more information is needed.",
      connections: "",
      shortTitle: "Organize gathered information",
      signal: SIGNAL_PRESETS.gather,
    },
    {
      code: "8.1.5.1",
      grade: 8,
      strand: "Information Literacy and Research",
      anchorStandard: "IL5. Share findings through ethically produced information products.",
      benchmark: "Synthesize information to new conclusions or understandings and share findings with a wide audience.",
      connections: "",
      shortTitle: "Synthesize and share findings",
      signal: SIGNAL_PRESETS.share,
    },
    {
      code: "8.1.5.2",
      grade: 8,
      strand: "Information Literacy and Research",
      anchorStandard: "IL5. Share findings through ethically produced information products.",
      benchmark: "Reflect on the effectiveness of completed research (self-evaluate, peer evaluation, rubric, identify improvements, ask additional questions).",
      connections: "",
      shortTitle: "Reflect on research process",
      signal: SIGNAL_PRESETS.share,
    },
    {
      code: "8.2.1.1",
      grade: 8,
      strand: "Digital Citizenship",
      anchorStandard: "Analyze the impact of media and technology on individuals and society, including media literacy and digital identity.",
      benchmark: "Reflect on digital identity and reputation (digital footprint), describing impact of digital actions on self and others.",
      connections: "",
      shortTitle: "Digital identity and footprint",
      signal: SIGNAL_PRESETS.digitalIdentity,
    },
    {
      code: "8.2.1.2",
      grade: 8,
      strand: "Digital Citizenship",
      anchorStandard: "Analyze the impact of media and technology on individuals and society.",
      benchmark: "Reflect on how technology (including AI) impacts self, families, communities, and the world.",
      connections: "",
      shortTitle: "Impact of technology",
      signal: SIGNAL_PRESETS.digitalImpact,
    },
    {
      code: "8.2.1.3",
      grade: 8,
      strand: "Digital Citizenship",
      anchorStandard: "Analyze the impact of media and technology on individuals and society.",
      benchmark: "Describe how people exchange ideas digitally (social/emotional impacts, school policies, AI vs human info, legal/ethical considerations).",
      connections: "",
      shortTitle: "Exchanging ideas online",
      signal: SIGNAL_PRESETS.digitalExchange,
    },
    {
      code: "8.2.2.1",
      grade: 8,
      strand: "Digital Citizenship",
      anchorStandard: "Safely and responsibly use technology considering privacy, intellectual property, and media messages.",
      benchmark: "Describe legal and ethical concepts (intellectual property, plagiarism, Creative Commons, fair use).",
      connections: "",
      shortTitle: "IP and ethical use",
      signal: SIGNAL_PRESETS.ip,
    },
    {
      code: "8.2.2.2",
      grade: 8,
      strand: "Digital Citizenship",
      anchorStandard: "Safely and responsibly use technology considering privacy, intellectual property, and media messages.",
      benchmark: "Use and share others' intellectual property legally and ethically (record sources, credit others/AI, Creative Commons, citation lists).",
      connections: "MN ELA 8.2.8.1",
      shortTitle: "Credit and share IP ethically",
      signal: SIGNAL_PRESETS.ip,
    },
    {
      code: "8.2.2.3",
      grade: 8,
      strand: "Digital Citizenship",
      anchorStandard: "Safely and responsibly use technology considering privacy, intellectual property, and media messages.",
      benchmark: "Describe digital privacy and security threats (account security, scams, data collection, phishing, identity theft).",
      connections: "ISTE 2.d — protect digital privacy and manage personal data.",
      shortTitle: "Privacy and security threats",
      signal: SIGNAL_PRESETS.privacy,
    },
    {
      code: "8.2.2.4",
      grade: 8,
      strand: "Digital Citizenship",
      anchorStandard: "Safely and responsibly use technology considering privacy, intellectual property, and media messages.",
      benchmark: "Safely find and use information online (identify false/misleading info, decode media/AI messages, responsibly exchange information).",
      connections: "",
      shortTitle: "Safe use of online information",
      signal: SIGNAL_PRESETS.mediaLiteracy,
    },
    {
      code: "8.3.1.1",
      grade: 8,
      strand: "Technology and Innovation",
      anchorStandard: "Demonstrate knowledge of technology and how digital tools work and relate to each other.",
      benchmark: "Describe the purpose of common academic programs/devices (including AI) and how they support personal or academic goals.",
      connections: "",
      shortTitle: "Purpose of digital tools",
      signal: SIGNAL_PRESETS.techKnowledge,
    },
    {
      code: "8.3.1.2",
      grade: 8,
      strand: "Technology and Innovation",
      anchorStandard: "Demonstrate knowledge of technology and how digital tools work and relate to each other.",
      benchmark: "Describe technology problems in detail using accurate technology terminology.",
      connections: "",
      shortTitle: "Describe tech problems",
      signal: SIGNAL_PRESETS.troubleshoot,
    },
    {
      code: "8.3.1.3",
      grade: 8,
      strand: "Technology and Innovation",
      anchorStandard: "Demonstrate knowledge of technology and how digital tools work and relate to each other.",
      benchmark: "Use strategies to solve technology problems (retry, restart, connectivity/hardware/software checks, cache, settings, guides).",
      connections: "2-CS-03 (6-8) — identify and fix problems with computing devices.",
      shortTitle: "Troubleshooting strategies",
      signal: SIGNAL_PRESETS.troubleshoot,
    },
    {
      code: "8.3.2.1",
      grade: 8,
      strand: "Technology and Innovation",
      anchorStandard: "Select and use digital tools to complete personal and academic tasks.",
      benchmark: "Select appropriate technology for the task and purpose (communication, collaboration, creativity tools and features).",
      connections: "2-CS-02, 2-NI-04 (6-8)",
      shortTitle: "Select appropriate tools",
      signal: SIGNAL_PRESETS.tools,
    },
    {
      code: "8.3.2.2",
      grade: 8,
      strand: "Technology and Innovation",
      anchorStandard: "Select and use digital tools to complete personal and academic tasks.",
      benchmark: "Create content using technology tools (documents, presentations, video/multimedia, images).",
      connections: "",
      shortTitle: "Create digital content",
      signal: SIGNAL_PRESETS.tools,
    },
    {
      code: "8.3.2.3",
      grade: 8,
      strand: "Technology and Innovation",
      anchorStandard: "Select and use digital tools to complete personal and academic tasks.",
      benchmark: "Use foundational design elements for effective communication (visual, text, layout, audio/multimedia).",
      connections: "",
      shortTitle: "Design for communication",
      signal: SIGNAL_PRESETS.design,
    },
    {
      code: "8.3.2.4",
      grade: 8,
      strand: "Technology and Innovation",
      anchorStandard: "Select and use digital tools to complete personal and academic tasks.",
      benchmark: "Type to communicate using strategies (finger placement, posture, ergonomics).",
      connections: "",
      shortTitle: "Keyboarding strategies",
      signal: SIGNAL_PRESETS.typing,
    },
    {
      code: "8.3.3.1",
      grade: 8,
      strand: "Technology and Innovation",
      anchorStandard: "Design solutions to problems using a design process and computational thinking.",
      benchmark: "Create artifacts or solve open-ended problems using a design process (identify, generate, prototype, test, improve).",
      connections: "ISTE 1.4.a — deliberate design process.",
      shortTitle: "Design process",
      signal: SIGNAL_PRESETS.designProcess,
    },
    {
      code: "8.3.3.2",
      grade: 8,
      strand: "Technology and Innovation",
      anchorStandard: "Design solutions to problems using a design process and computational thinking.",
      benchmark: "Solve problems using computational thinking (decomposition, patterns, abstraction, algorithms, debugging, collaboration).",
      connections: "",
      shortTitle: "Computational thinking",
      signal: SIGNAL_PRESETS.computational,
    },
    {
      code: "8.3.3.3",
      grade: 8,
      strand: "Technology and Innovation",
      anchorStandard: "Design solutions to problems using a design process and computational thinking.",
      benchmark: "Create programs with algorithms, sequences, loops, events, conditionals, and nested loops.",
      connections: "CSTA 2-AP-12",
      shortTitle: "Algorithms and control flow",
      signal: SIGNAL_PRESETS.computational,
    },
    {
      code: "8.3.4.1",
      grade: 8,
      strand: "Technology and Innovation",
      anchorStandard: "Collaborate and connect using tools and strategies for working together.",
      benchmark: "Collaborate with peers using technology (real-time collaboration, comments, sharing permissions).",
      connections: "",
      shortTitle: "Tech collaboration tools",
      signal: SIGNAL_PRESETS.collaborate,
    },
    {
      code: "8.3.4.2",
      grade: 8,
      strand: "Technology and Innovation",
      anchorStandard: "Collaborate and connect using tools and strategies for working together.",
      benchmark: "Collaborate with peers to create new knowledge (roles, discuss ideas, share work, group purpose, perspectives).",
      connections: "",
      shortTitle: "Collaborative knowledge building",
      signal: SIGNAL_PRESETS.collaborate,
    },
    {
      code: "8.4.1.1",
      grade: 8,
      strand: "Literacy Engagement",
      anchorStandard: "Construct an identity as a reader using strategies to discover and engage with literary materials.",
      benchmark: "Reflect on identity as a reader (preferences, motivations, past experiences, role of reading in life).",
      connections: "",
      shortTitle: "Reader identity",
      signal: SIGNAL_PRESETS.readerIdentity,
    },
    {
      code: "8.4.1.2",
      grade: 8,
      strand: "Literacy Engagement",
      anchorStandard: "Construct an identity as a reader using strategies to discover and engage with literary materials.",
      benchmark: "Describe characteristics of age-appropriate genres and formats and how they relate to needs and preferences.",
      connections: "",
      shortTitle: "Genres and formats",
      signal: SIGNAL_PRESETS.readerIdentity,
    },
    {
      code: "8.4.1.3",
      grade: 8,
      strand: "Literacy Engagement",
      anchorStandard: "Construct an identity as a reader using strategies to discover and engage with literary materials.",
      benchmark: "Select and access materials using strategies (browsing, catalog, curated lists, awards, reviews).",
      connections: "",
      shortTitle: "Select reading materials",
      signal: SIGNAL_PRESETS.literacyCommunity,
    },
    {
      code: "8.4.2.1",
      grade: 8,
      strand: "Literacy Engagement",
      anchorStandard: "Engage with literacy communities and diverse perspectives, including Dakota and Anishinaabe peoples.",
      benchmark: "Share responses to reading experiences with an audience, connecting to preferences, experiences, other materials, and community.",
      connections: "",
      shortTitle: "Share reading responses",
      signal: SIGNAL_PRESETS.literacyCommunity,
    },
    {
      code: "8.4.2.2",
      grade: 8,
      strand: "Literacy Engagement",
      anchorStandard: "Engage with literacy communities and diverse perspectives, including Dakota and Anishinaabe peoples.",
      benchmark: "Identify, engage with, and respond to materials representing diverse perspectives, including Dakota and Anishinaabe peoples.",
      connections: "MN ELA 6–8.1.2.3 — texts representing multiple perspectives and identities.",
      shortTitle: "Diverse perspectives in texts",
      signal: SIGNAL_PRESETS.literacyCommunity,
    },
  ];

  const MN_ELA_STANDARDS = (window.WriteFlowMnElaStandardsData || []).map(enrichElaStandard);
  const ITEM_2025_STANDARDS_ENRICHED = ITEM_2025_STANDARDS.map(enrichItemStandard);

  const ALL_STANDARDS = [...ITEM_2025_STANDARDS_ENRICHED, ...MN_ELA_STANDARDS];

  const CATALOG_BY_KEY = Object.fromEntries(
    ALL_STANDARDS.map((s) => [`${s.catalog}:${s.code}`, s])
  );

  const STRANDS_BY_CATALOG = {
    item: [...new Set(ITEM_2025_STANDARDS_ENRICHED.map((s) => s.strand))],
    mn_ela: [...new Set(MN_ELA_STANDARDS.map((s) => s.strand))],
  };

  const GRADES_BY_CATALOG = {
    item: [...new Set(ITEM_2025_STANDARDS_ENRICHED.map((s) => s.grade))].sort((a, b) => a - b),
    mn_ela: [...new Set(MN_ELA_STANDARDS.map((s) => s.grade))].sort((a, b) => a - b),
  };

  function shortTitleFromBenchmark(benchmark = "") {
    const line = String(benchmark).split("\n")[0].trim();
    return line.length > 72 ? `${line.slice(0, 69)}…` : line;
  }

  function getCatalog(catalogId = CATALOG_IDS.item) {
    if (catalogId === CATALOG_IDS.mn_ela) return MN_ELA_STANDARDS;
    return ITEM_2025_STANDARDS_ENRICHED;
  }

  function getByCode(code, catalog = null) {
    if (catalog) return CATALOG_BY_KEY[`${catalog}:${code}`] || null;
    const item = CATALOG_BY_KEY[`${CATALOG_IDS.item}:${code}`];
    const ela = CATALOG_BY_KEY[`${CATALOG_IDS.mn_ela}:${code}`];
    if (item && ela) return null;
    return item || ela || null;
  }

  function getStrands(catalogId = CATALOG_IDS.item) {
    return STRANDS_BY_CATALOG[catalogId] || STRANDS_BY_CATALOG.item;
  }

  function getGrades(catalogId = CATALOG_IDS.item) {
    return GRADES_BY_CATALOG[catalogId] || GRADES_BY_CATALOG.item;
  }

  function getCatalogLabel(catalogId = "") {
    return CATALOG_LABELS[catalogId] || catalogId || "Custom";
  }

  function normalizeAttached(entry = {}) {
    if (!entry || !entry.code) return null;
    const catalog = entry.catalog || null;
    const catalogEntry = getByCode(entry.code, catalog || undefined);
    if (catalogEntry) {
      return {
        code: catalogEntry.code,
        catalog: catalogEntry.catalog,
        catalogLabel: getCatalogLabel(catalogEntry.catalog),
        grade: catalogEntry.grade,
        strand: catalogEntry.strand,
        anchorStandard: catalogEntry.anchorStandard,
        benchmark: catalogEntry.benchmark,
        connections: catalogEntry.connections || "",
        shortTitle: catalogEntry.shortTitle,
        custom: false,
      };
    }
    if (entry.custom) {
      return {
        code: String(entry.code).trim(),
        catalog: entry.catalog || "custom",
        catalogLabel: getCatalogLabel(entry.catalog) || "Custom",
        grade: entry.grade || null,
        strand: entry.strand || "Custom",
        anchorStandard: entry.anchorStandard || "",
        benchmark: entry.benchmark || entry.label || "",
        connections: entry.connections || "",
        shortTitle: entry.shortTitle || entry.label || shortTitleFromBenchmark(entry.benchmark),
        custom: true,
      };
    }
    return null;
  }

  function resolveAttachedList(list = []) {
    return (list || []).map(normalizeAttached).filter(Boolean);
  }

  const BENCHMARK_STOP = new Set([
    "about", "after", "again", "also", "another", "any", "are", "because", "been", "before",
    "being", "between", "both", "but", "can", "could", "during", "each", "from", "have", "having",
    "including", "into", "just", "like", "more", "most", "not", "only", "other", "over", "same",
    "should", "some", "such", "than", "that", "their", "them", "these", "they", "this", "those",
    "through", "under", "using", "very", "were", "what", "when", "where", "which", "while", "will",
    "with", "would", "your", "write", "writing", "students", "student", "text", "texts",
  ]);

  function extractBenchmarkTerms(text = "") {
    const words = String(text).toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/);
    const terms = [];
    for (const w of words) {
      const clean = w.replace(/'/g, "");
      if (clean.length >= 5 && !BENCHMARK_STOP.has(clean)) terms.push(clean);
    }
    return [...new Set(terms)].slice(0, 14);
  }

  function inferStructurePatterns(code = "", catalog = "") {
    const parts = String(code).split(".");
    const major = parts[1];
    const minor = parts[2];
    const patterns = [];
    const add = (label, re) => patterns.push({ label, re });

    if (major === "2" && minor === "4") {
      add("Claim or opinion", /\b(i think|i believe|in my opinion|claim|argue|should|must|we should|my opinion)\b/gi);
      add("Reasoning", /\b(because|since|therefore|so that|as a result|reason|however|although)\b/gi);
      add("Support", /\b(for example|for instance|evidence|according to|such as|shows that|proves)\b/gi);
    }
    if (major === "2" && (minor === "7" || minor === "8")) {
      add("Questions", /\?/g);
      add("Inquiry", /\b(wonder|question|research|investigate|inquiry|explore|narrow|broaden)\b/gi);
      add("Sources", /\b(source|cite|citation|quote|paraphrase|summarize|plagiarism|reference)\b/gi);
    }
    if (major === "2" && minor === "5") {
      add("Explain", /\b(explain|describe|define|means|clarify|inform|detail)\b/gi);
      add("Organization", /\b(first|second|third|next|finally|another|additionally|overall)\b/gi);
    }
    if (major === "2" && minor === "6") {
      add("Voice", /\b(i |my |we |our |felt|thought|voice|myself)\b/gi);
      add("Sensory detail", /\b(saw|heard|felt|smelled|bright|loud|quiet|warm|cold|scary|beautiful|exciting)\b/gi);
      add("Dialogue/craft", /\b(dialogue|character|plot|stanza|scene|figurative|metaphor|simile)\b/gi);
    }
    if (major === "2" && minor === "1") {
      add("Conventions", /[.!?]|,/g);
      add("Sentence craft", /\b(sentence|capital|punctuation|grammar|spelling|clause|phrase)\b/gi);
    }
    if (major === "2" && minor === "2") {
      add("Reflection", /\b(i |my |reflect|learned|realized|identity|experience|feel|grown|changed)\b/gi);
    }
    if (major === "1" && minor === "4") {
      add("Text evidence", /["'“”]|\b(quote|states|shows|according to|the text says|cite)\b/gi);
      add("Theme/idea", /\b(theme|central idea|main idea|message|develops|convey|inference)\b/gi);
    }
    if (major === "1" && (minor === "6" || minor === "7")) {
      add("Perspective", /\b(author|perspective|viewpoint|compare|contrast|bias|fact|fiction|opinion)\b/gi);
    }
    if (major === "1" && minor === "9") {
      add("Source evaluation", /\b(credible|credibility|reliable|bias|perspective|relevant|valid|verify|source)\b/gi);
    }
    if (major === "3") {
      add("Discussion", /\b(discuss|collaborate|listen|feedback|respond|exchange|peer|audience|present)\b/gi);
    }
    if (major === "1" && minor === "1") {
      add("Inquiry/topic", /\b(topic|question|research|focus|background|prior knowledge|subtopic)\b/gi);
    }
    if (catalog === CATALOG_IDS.item && major === "2") {
      add("Digital citizenship", /\b(digital|online|privacy|copyright|plagiarism|footprint|cyber|respect|ethical|intelligence|media)\b/gi);
    }
    return patterns;
  }

  function mergeSignalWithBenchmark(baseSignal, benchmark = "", code = "", catalog = "") {
    const terms = extractBenchmarkTerms(benchmark);
    const keywords = [...new Set([...(baseSignal.keywords || []), ...terms])];
    const patterns = inferStructurePatterns(code, catalog);
    return { ...baseSignal, keywords, patterns };
  }

  function parseLookFors(benchmark = "") {
    const fors = [];
    for (const line of String(benchmark).split(/\n/)) {
      const m = line.match(/^\s*[a-z][.)]\s*(.+)/i) || line.match(/^\s*\d+[.)]\s*(.+)/);
      if (m?.[1]) fors.push(m[1].trim());
    }
    return fors.slice(0, 6);
  }

  function countKeywordHits(text, keywords = []) {
    const lower = text.toLowerCase();
    const hits = [];
    for (const kw of keywords) {
      const pattern = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (pattern.test(lower)) hits.push(kw);
    }
    return hits;
  }

  function extractEvidenceSnippets(text, keywords = [], max = 3) {
    const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 8);
    const snippets = [];
    for (const sent of sentences) {
      const lower = sent.toLowerCase();
      const matched = keywords.some((kw) => lower.includes(kw.toLowerCase()));
      if (matched) {
        snippets.push(sent.length > 140 ? `${sent.slice(0, 137)}…` : sent);
        if (snippets.length >= max) break;
      }
    }
    return snippets;
  }

  function scoreFromMetrics(metrics = {}, metricScores = {}) {
    let total = 0;
    let weightSum = 0;
    for (const [key, weight] of Object.entries(metrics)) {
      const val = metricScores[key];
      if (val != null && weight > 0) {
        total += val * weight;
        weightSum += weight;
      }
    }
    return weightSum > 0 ? Math.round(total / weightSum) : null;
  }

  function countPatternHits(text, patterns = []) {
    const hits = [];
    for (const p of patterns) {
      const matches = text.match(p.re);
      if (matches?.length) hits.push({ label: p.label, count: matches.length });
    }
    return hits;
  }

  function promptAlignmentScore(text, prompt = "") {
    const terms = extractBenchmarkTerms(prompt).slice(0, 10);
    if (!terms.length) return 0;
    const lower = text.toLowerCase();
    let hits = 0;
    for (const t of terms) {
      if (lower.includes(t)) hits += 1;
    }
    return Math.min(100, Math.round((hits / terms.length) * 100));
  }

  function structureScoreFromHits(patternHits = []) {
    if (!patternHits.length) return 0;
    const variety = patternHits.length;
    const volume = patternHits.reduce((s, p) => s + Math.min(p.count, 4), 0);
    return Math.min(100, variety * 22 + volume * 8);
  }

  function computeConfidence(score, keywordHits, patternHits, evidence, metricScore) {
    const textSignals = keywordHits.length + patternHits.length;
    if (score >= 75 && evidence.length && textSignals >= 2) return "strong";
    if (score >= 50 && textSignals >= 1) return "moderate";
    if (score >= 50 && metricScore >= 68 && textSignals === 0) return "metrics_only";
    return "weak";
  }

  function confidenceLabel(confidence) {
    return {
      strong: "Strong text match",
      moderate: "Partial text match",
      metrics_only: "Writing quality only — few benchmark terms in text",
      weak: "Limited match",
    }[confidence] || confidence;
  }

  function levelFromScore(score, signalQuality = {}) {
    const { keywordHits = [], patternHits = [], evidence = [] } = signalQuality;
    const textSignals = keywordHits.length + patternHits.length;
    const hasEvidence = evidence.length > 0 || textSignals >= 1;
    if (score >= 75 && hasEvidence && textSignals >= 2) return "demonstrated";
    if (score >= 75 && !hasEvidence) return "developing";
    if (score >= 50) return "developing";
    return "not_evident";
  }

  function levelLabel(level) {
    return {
      demonstrated: "Demonstrated",
      developing: "Developing",
      not_evident: "Not evident",
    }[level] || level;
  }

  function analyzeStandard(text, standard, metricScores = {}, context = {}) {
    const signal = standard.signal || SIGNAL_PRESETS.generic;
    const wordCount = context.wordCount || 0;
    const keywords = signal.keywords || SIGNAL_PRESETS.generic.keywords;
    const benchmarkTerms = extractBenchmarkTerms(standard.benchmark || "");
    const keywordHits = countKeywordHits(text, keywords);
    const benchmarkHits = benchmarkTerms.filter((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
    const allKeywordHits = [...new Set([...keywordHits, ...benchmarkHits])];
    const keywordScore = Math.min(100, Math.round((allKeywordHits.length / Math.max(keywords.length * 0.12, 3)) * 100));
    const patternHits = countPatternHits(text, signal.patterns || []);
    const structureScore = structureScoreFromHits(patternHits);
    const metricScore = scoreFromMetrics(signal.metrics, metricScores);
    const promptBonus = promptAlignmentScore(text, context.assignmentPrompt || "");
    const minWords = signal.minWords || 30;
    const volumeFactor = wordCount >= minWords ? 1 : Math.max(0.35, wordCount / minWords);

    let combined = metricScore != null
      ? Math.round(metricScore * 0.42 + keywordScore * 0.33 + structureScore * 0.25)
      : Math.round(keywordScore * 0.6 + structureScore * 0.4);
    if (promptBonus >= 40) combined = Math.min(100, combined + 6);
    combined = Math.round(combined * volumeFactor);
    combined = Math.max(0, Math.min(100, combined));

    const evidence = extractEvidenceSnippets(text, allKeywordHits.length ? allKeywordHits : keywords.slice(0, 8));
    const level = levelFromScore(combined, { keywordHits: allKeywordHits, patternHits, evidence });
    const confidence = computeConfidence(combined, allKeywordHits, patternHits, evidence, metricScore ?? 0);
    const lookFors = parseLookFors(standard.benchmark || "");

    return {
      code: standard.code,
      shortTitle: standard.shortTitle,
      strand: standard.strand,
      benchmark: standard.benchmark,
      score: combined,
      level,
      levelLabel: levelLabel(level),
      confidence,
      confidenceLabel: confidenceLabel(confidence),
      keywordHits: allKeywordHits,
      benchmarkHits,
      patternHits,
      lookFors,
      scoreBreakdown: {
        keyword: keywordScore,
        structure: structureScore,
        metrics: metricScore,
        promptAlignment: promptBonus,
        volumeFactor: Math.round(volumeFactor * 100),
      },
      evidence,
      recommendation: buildRecommendation(standard, level, combined, allKeywordHits, patternHits, evidence, confidence),
      conferencePrompt: buildConferencePrompt(standard, level, lookFors),
    };
  }

  function buildConferencePrompt(standard, level, lookFors = []) {
    if (level === "demonstrated") {
      return `Ask: “What part of your writing best shows ${standard.code}?” Push for one more specific example.`;
    }
    if (lookFors.length) {
      return `Conference focus: ${lookFors[0].slice(0, 90)}${lookFors[0].length > 90 ? "…" : ""}`;
    }
    return `Revisit the benchmark for ${standard.code} with a short model and sentence frame.`;
  }

  function buildRecommendation(standard, level, score, keywordHits, patternHits, evidence, confidence) {
    const patternNote = patternHits.length
      ? ` Structure signals: ${patternHits.map((p) => p.label).join(", ")}.`
      : "";
    if (level === "demonstrated") {
      return `Text and craft align with ${standard.code} (${confidenceLabel(confidence)}). Terms: ${keywordHits.slice(0, 5).join(", ") || "see evidence"}.${patternNote}`;
    }
    if (level === "developing") {
      if (confidence === "metrics_only") {
        return `Writing quality is solid but the draft uses few benchmark-specific words for ${standard.code}. Ask the student to name examples using the benchmark vocabulary.`;
      }
      return `Approaching ${standard.code}. In revision, target: ${keywordHits.slice(0, 3).join(", ") || "benchmark vocabulary"} or add a sentence that directly addresses the benchmark.${patternNote}`;
    }
    if (!evidence.length) {
      return `Little language from ${standard.code} appears in this draft. Use a short re-teach or oral conference before expecting this benchmark in writing.`;
    }
    return `Needs support for ${standard.code} (${score}/100). Model one sentence that meets the benchmark, then let the student try again.${patternNote}`;
  }

  function analyzeAttachedStandards(text, attachedList = [], metricScores = {}, context = {}) {
    const resolved = resolveAttachedList(attachedList);
    if (!resolved.length) {
      return { attached: [], demonstrated: [], developing: [], notEvident: [], all: [], summary: null };
    }
    const all = resolved.map((std) => {
      const catalog = getByCode(std.code, std.catalog);
      const withSignal = catalog
        ? { ...std, signal: catalog.signal }
        : { ...std, signal: mergeSignalWithBenchmark(SIGNAL_PRESETS.generic, std.benchmark || "", std.code, std.catalog || "") };
      return analyzeStandard(text, withSignal, metricScores, context);
    });
    const summary = {
      demonstrated: all.filter((r) => r.level === "demonstrated").length,
      developing: all.filter((r) => r.level === "developing").length,
      notEvident: all.filter((r) => r.level === "not_evident").length,
      strongMatch: all.filter((r) => r.confidence === "strong").length,
      metricsOnly: all.filter((r) => r.confidence === "metrics_only").length,
    };
    return {
      attached: resolved,
      all,
      demonstrated: all.filter((r) => r.level === "demonstrated"),
      developing: all.filter((r) => r.level === "developing"),
      notEvident: all.filter((r) => r.level === "not_evident"),
      summary,
    };
  }

  function searchCatalog(query = "", grade = null, strand = "", catalogId = CATALOG_IDS.item) {
    const q = String(query).trim().toLowerCase();
    const pool = getCatalog(catalogId);
    return pool.filter((s) => {
      if (grade && Number(s.grade) !== Number(grade)) return false;
      if (strand && s.strand !== strand) return false;
      if (!q) return true;
      return (
        s.code.toLowerCase().includes(q)
        || s.shortTitle.toLowerCase().includes(q)
        || s.benchmark.toLowerCase().includes(q)
        || s.strand.toLowerCase().includes(q)
        || (s.anchorStandard && s.anchorStandard.toLowerCase().includes(q))
        || (s.connections && s.connections.toLowerCase().includes(q))
      );
    });
  }

  window.WriteFlowItemStandards = {
    CATALOG_IDS,
    CATALOG_LABELS,
    ITEM_2025_STANDARDS: ITEM_2025_STANDARDS_ENRICHED,
    MN_ELA_STANDARDS,
    getCatalog,
    getByCode,
    getStrands,
    getGrades,
    getCatalogLabel,
    normalizeAttached,
    resolveAttachedList,
    analyzeAttachedStandards,
    searchCatalog,
    shortTitleFromBenchmark,
    levelLabel,
    confidenceLabel,
    parseLookFors,
  };
})();
