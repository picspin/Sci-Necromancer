# Sci-Necromancer 🧙‍♂️

> AI-powered academic abstract generation system for medical imaging research

An intelligent assistant for generating conference-ready abstracts (ISMRM, RSNA, JACC, ER) with automated analysis, structured formatting, and figure generation capabilities.

## ✨ Features

- **Smart Analysis**: Automatically extract categories, keywords, impact statements, and synopsis from your research
- **Multi-Conference Support**: ISMRM, RSNA, JACC, and ER abstract formats
- **Spec-Compliant Generation**: Follows conference-specific guidelines and word limits
- **Figure Generation**: Create scientific figures via SiliconFlow or MCP tools
- **Multiple AI Providers**: Google AI (Gemini) and OpenAI-compatible APIs
- **MCP Tools Integration**: Extensible tool system for databases, image generation, and more
- **Export Options**: Markdown, PDF, and JSON formats

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- API key from Google AI or OpenAI-compatible provider

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd sci-necromancer

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will open at `http://localhost:5173`

### First-Time Setup

1. Click the **Settings** icon (⚙️) in the top right
2. Choose your AI provider:
   - **Google AI**: Enter your Gemini API key
   - **OpenAI Compatible**: Enter API key and base URL
3. Configure models (or use defaults)
4. Click **Save Settings**

## 📖 Usage

### Generate an Abstract

1. **Input**: Paste your research text or upload a file (.txt)
2. **Analyze**: Click "Analyze" to extract categories and keywords
3. **Review**: Edit the generated Impact and Synopsis if needed
4. **Select Type**: Choose the recommended abstract type
5. **Generate**: Click "Generate" to create your spec-compliant abstract
6. **Export**: Download as Markdown, PDF, or JSON

### Generate a Figure

1. Switch to **Figure Generation** tab
2. Choose mode:
   - **Standard**: Upload an image and add specifications
   - **Creative**: Generate from abstract context
3. Add your specifications/guidelines
4. Click **Generate Figure**
5. Download the generated image

## 🔧 Configuration

### AI Providers

**Google AI (Recommended)**
- Get API key: [Google AI Studio](https://aistudio.google.com/app/apikey)
- Models: `gemini-2.5-flash`, `gemini-2.5-pro`

**OpenAI Compatible**
- Supports: OpenAI, SiliconFlow, and other compatible APIs
- SiliconFlow: `https://api.siliconflow.cn`
- Models: `gpt-4o`, `Qwen/Qwen2.5-72B-Instruct`, etc.

### MCP Tools (Optional)

Enable advanced features in the **MCP Tools** tab:

- **Supabase**: Cloud database for storing abstracts
- **Image Generation**: Generate figures via MCP platforms
- **Custom Tools**: Add your own via JSON configuration

See [MCP_TOOLS_GUIDE.md](MCP_TOOLS_GUIDE.md) for details.

## 📚 Documentation

### User Guides
- [Quick Reference](QUICK_REFERENCE.md) - Common tasks and shortcuts
- [Workflow Guide](WORKFLOW.md) - Detailed workflow explanation
- [Configuration Guide](CONFIGURATION.md) - Advanced settings
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions

### Image Generation
- [Quick Start](QUICK_START_IMAGE_GENERATION.md) - Setup guide
- [Architecture](IMAGE_GENERATION_ARCHITECTURE.md) - Technical details
- [Flow Diagram](IMAGE_GENERATION_FLOW.md) - Visual workflow

### Advanced
- [MCP Tools Guide](MCP_TOOLS_GUIDE.md) - Extensible tool system
- [Model Configuration](MODEL_CONFIGURATION_GUIDE.md) - Provider setup
- [Testing Guide](TESTING_GUIDE.md) - Quality assurance
- [Agent Guide](agent.md) - Development guidelines

## 🏗️ Architecture

```
Sci-Necromancer/
├── components/          # React UI components
├── lib/
│   ├── llm/            # AI provider integrations
│   ├── file/           # File processing
│   └── utils/          # Utilities
├── context/            # React context providers
├── services/           # Business logic
├── public/             # Static assets & guidelines
└── types.ts            # TypeScript definitions
```

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Build**: Vite
- **AI**: Google Gemini, OpenAI API
- **State**: React Context + Jotai
- **Styling**: Tailwind CSS + Custom themes

## 🤝 Contributing

Contributions welcome! Please follow the guidelines in [agent.md](agent.md).

### Development Workflow

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📝 License

[Your License Here]

## 🙏 Acknowledgments

- ISMRM for abstract guidelines
- Google AI for Gemini models
- SiliconFlow for image generation models

## 📧 Support

- Issues: [GitHub Issues](your-repo-url/issues)
- Documentation: See `/docs` folder
- Email: [your-email]

---

**Made with ❤️ for the medical imaging research community**
