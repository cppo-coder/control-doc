---
name: Enterprise Guide to NotebookLM and Gemini Integration
description: Comprehensive guide on integrating Google NotebookLM and Gemini within an enterprise context, focusing on knowledge management, research, and agentic workflows.
---

# Enterprise Guide: NotebookLM and Gemini Integration

This skill empowers the agent to assist enterprises in leveraging the combined power of NotebookLM and Gemini for advanced research, centralized knowledge management, and automated workflows.

## 核心 Capabilities & Concepts

### 1. The "Goldie Triple Stack" Framework
- **NotebookLM**: Grounded AI for deep research and source-specific Q&A.
- **Gemini Enterprise**: Broad AI orchestration platform for discovery, multi-agent management, and cross-application automation.
- **Google Workspace / Studio**: The action layer where insights are transformed into documents, spreadsheets, and presentations.

### 2. NotebookLM Enterprise Features
- **Grounded AI**: Responses are strictly limited to provided sources with direct citations.
- **Privacy & Security**: Data is NOT used to train public models; it remains within the enterprise's security boundary.
- **Diverse Source Support**: Integration with Google Drive, Docs, Slides, PDFs, URLs, YouTube transcripts, and Audio/Video files.
- **Audio Overviews**: Generation of podcast-like summaries for quick comprehension.

### 3. Gemini Integration Points
- **Discovery**: Use Gemini Enterprise to find relevant documents across the organization (Google Drive, Slack, Salesforce, etc.) and feed them into specialized NotebookLM notebooks.
- **Agentic Workflows**: Deployment of NotebookLM as a specialized "Research Agent" within the broader Gemini Enterprise orchestration.
- **Cross-Platform Actions**: Using Gemini to synthesize insights from multiple notebooks and trigger actions like creating SEO reports or updating dashboards.

## Implementation Guidelines for this Agent

When the USER asks to utilize this integration or "acquire this skill," the agent should use the following `notebooklm` MCP tools to assist:

### A. Initializing Research
- **[mcp_notebooklm_research_start](tool_call:mcp_notebooklm_research_start)**: Start deep research on a topic to find new sources.
- **[mcp_notebooklm_notebook_create](tool_call:mcp_notebooklm_notebook_create)**: Create a dedicated notebook for a specific project or department (e.g., "HR Policies," "Mining Regulations").

### B. Building the Knowledge Base
- **[mcp_notebooklm_notebook_add_drive](tool_call:mcp_notebooklm_notebook_add_drive)**: Add internal company documents from Google Drive.
- **[mcp_notebooklm_notebook_add_url](tool_call:mcp_notebooklm_notebook_add_url)**: Add public documentation, regulatory websites, or YouTube training videos.

### C. Synthesis and Action
- **[mcp_notebooklm_notebook_query](tool_call:mcp_notebooklm_notebook_query)**: Ask specific questions grounded in the notebook.
- **[mcp_notebooklm_audio_overview_create](tool_call:mcp_notebooklm_audio_overview_create)**: Generate audio summaries for stakeholders.
- **[mcp_notebooklm_report_create](tool_call:mcp_notebooklm_report_create)**: Generate briefing docs, study guides, or blog posts from the research.

## Best Practices for Enterprise Q&A
1. **Source Grounding**: Always prioritize answers that cite specific sources from the Notebook.
2. **Contextual Discovery**: If a question cannot be answered by the current notebook, suggest using Gemini Enterprise to discover more sources.
3. **Multi-Notebook Organization**: Encourage the creation of distinct notebooks for different domain-specific tasks to maintain clarity and precision.
