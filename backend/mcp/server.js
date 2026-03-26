const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Models
const Group = require("../models/Group");
const CollabFile = require("../models/CollabFile");
const { chatWithGemini } = require("../gemini");

// Database connection
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.error("MCP Server: Connected to MongoDB");
}).catch(err => {
  console.error("MCP Server: MongoDB connection error:", err);
});

const server = new Server(
  {
    name: "group-app-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_groups",
        description: "List all collaboration groups in the application",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_group_files",
        description: "Get all files associated with a specific group",
        inputSchema: {
          type: "object",
          properties: {
            groupId: { type: "string", description: "The ID of the group" },
          },
          required: ["groupId"],
        },
      },
      {
        name: "gemini_query",
        description: "Ask a question to the integrated Gemini model",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "The question or prompt for Gemini" },
          },
          required: ["prompt"],
        },
      },
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_groups": {
        const groups = await Group.find().limit(20).lean();
        return {
          content: [{ type: "text", text: JSON.stringify(groups, null, 2) }],
        };
      }

      case "get_group_files": {
        const files = await CollabFile.find({ group: args.groupId }).lean();
        return {
          content: [{ type: "text", text: JSON.stringify(files, null, 2) }],
        };
      }

      case "gemini_query": {
        const response = await chatWithGemini(args.prompt);
        return {
          content: [{ type: "text", text: response }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server: Started with stdio transport");
}

main().catch((error) => {
  console.error("MCP Server: Fatal error", error);
  process.exit(1);
});
