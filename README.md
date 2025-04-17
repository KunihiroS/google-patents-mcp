# Google Patents MCP Server (`google-patents-mcp`)

[![npm version](https://badge.fury.io/js/%40kunihiros%2Fgoogle-patents-mcp.svg)](https://badge.fury.io/js/%40kunihiros%2Fgoogle-patents-mcp)

This project provides a Model Context Protocol (MCP) server that allows searching Google Patents information via the [SerpApi Google Patents API](https://serpapi.com/google-patents-api).

## Changelog

### v0.2.0 (2025-04-17)

*   **Fix:** Implemented empty handlers for `resources/list` and `prompts/list` MCP methods.
*   **Fix:** Declared `prompts` capability in server initialization.
*   **Chore:** Updated dependencies.

These changes aim to improve compatibility with MCP clients like Claude Desktop which may require these standard endpoints, though direct testing with Claude Desktop has not yet been performed.

## Features

*   Provides an MCP tool `search_patents` to search Google Patents.
*   Uses SerpApi as the backend.
*   Can be run directly using `npx` without local installation.

## Prerequisites

*   **Node.js:** Version 18 or higher is recommended.
*   **npm:** Required to run the `npx` command.
*   **SerpApi API Key:** You need a valid API key from [SerpApi](https://serpapi.com/) to use the Google Patents API.

## Quick Start (Using npx)

The easiest way to run this server is using `npx`. This command downloads (if necessary) and runs the server directly.

```bash
npx @kunihiros/google-patents-mcp
```

**Note:** Replace `@kunihiros/google-patents-mcp` with the actual published package name if it differs.

The server will start and listen for MCP requests on standard input/output.

## Configuration

The server requires your SerpApi API key. You can provide it in one of the following ways:

1.  **Environment Variable (Recommended for MCP Hosts):**
    Set the `SERPAPI_API_KEY` environment variable when running the server. MCP Host configurations often allow setting environment variables for servers.

    Example MCP Host configuration snippet (`config.json` or similar):
    ```json
    {
      "mcpServers": {
        "google-patents-mcp": {
          "command": "npx",
          "args": [
            "-y", // Skips confirmation if the package isn't installed locally
            "@kunihiros/google-patents-mcp" // Use the correct package name
          ],
          "env": {
            "SERPAPI_API_KEY": "YOUR_ACTUAL_SERPAPI_KEY"
            // Optional: Set log level
            // "LOG_LEVEL": "debug"
          }
        }
      }
    }
    ```

2.  **.env File:**
    Create a `.env` file in the directory where you run the `npx` command (for local testing or if not using an MCP Host), or in your home directory (`~/.google-patents-mcp.env`), with the following content:

    ```dotenv
    SERPAPI_API_KEY=YOUR_ACTUAL_SERPAPI_KEY
    # Optional: Set log level (e.g., debug, info, warn, error)
    # LOG_LEVEL=debug
    ```
    **Note:** While using a `.env` file is convenient for local testing, for production or integration with MCP Hosts, setting the environment variable directly via the host configuration is the recommended and more secure approach. The primary intended use case is execution via `npx`, where environment variables are typically managed by the calling process or MCP Host.

The server searches for `.env` files in the following order:
    *   `./.env` (relative to where `npx` is run)
    *   `~/.google-patents-mcp.env` (in your home directory)

## Provided MCP Tool

### `search_patents`

Searches Google Patents via SerpApi.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "q": {
      "type": "string",
      "description": "Search query (required). Although optional in SerpApi docs, a non-empty query is practically needed. Use semicolon (;) to separate multiple terms. Advanced syntax like '(Coffee) OR (Tea);(A47J)' is supported. See 'About Google Patents' for details."
    },
    "page": {
      "type": "integer",
      "description": "Page number for pagination (default: 1).",
      "default": 1
    },
    "num": {
      "type": "integer",
      "description": "Number of results per page (default: 10). **IMPORTANT: Must be 10 or greater (up to 100).**",
      "default": 10,
      "minimum": 10,
      "maximum": 100
    },
    "sort": {
      "type": "string",
      "enum": ["relevance", "new", "old"],
      "description": "Sorting method. 'relevance' (default), 'new' (newest by filing/publication date), 'old' (oldest by filing/publication date).",
      "default": "relevance"
    },
    "before": {
      "type": "string",
      "description": "Maximum date filter (e.g., 'publication:20231231', 'filing:20220101'). Format: type:YYYYMMDD where type is 'priority', 'filing', or 'publication'."
    },
    "after": {
      "type": "string",
      "description": "Minimum date filter (e.g., 'publication:20230101', 'filing:20220601'). Format: type:YYYYMMDD where type is 'priority', 'filing', or 'publication'."
    },
    "inventor": {
      "type": "string",
      "description": "Filter by inventor names. Separate multiple names with a comma (,)."
    },
    "assignee": {
      "type": "string",
      "description": "Filter by assignee names. Separate multiple names with a comma (,)."
    },
    "country": {
      "type": "string",
      "description": "Filter by country codes (e.g., 'US', 'WO,JP'). Separate multiple codes with a comma (,)."
    },
    "language": {
      "type": "string",
      "description": "Filter by language (e.g., 'ENGLISH', 'JAPANESE,GERMAN'). Separate multiple languages with a comma (,). Supported: ENGLISH, GERMAN, CHINESE, FRENCH, SPANISH, ARABIC, JAPANESE, KOREAN, PORTUGUESE, RUSSIAN, ITALIAN, DUTCH, SWEDISH, FINNISH, NORWEGIAN, DANISH."
    },
    "status": {
      "type": "string",
      "enum": ["GRANT", "APPLICATION"],
      "description": "Filter by patent status: 'GRANT' or 'APPLICATION'."
    },
    "type": {
      "type": "string",
      "enum": ["PATENT", "DESIGN"],
      "description": "Filter by patent type: 'PATENT' or 'DESIGN'."
    },
    "scholar": {
      "type": "boolean",
      "description": "Include Google Scholar results (default: false).",
      "default": false
    }
  },
  "required": ["q"]
}
```

**Output:**

Returns a JSON object containing the search results from SerpApi. The structure follows the SerpApi response format.

**Example Usage (MCP Request):**

```json
{
  "mcp_version": "1.0",
  "type": "CallToolRequest",
  "id": "req-123",
  "server_name": "google-patents-mcp",
  "params": {
    "name": "search_patents",
    "arguments": {
      "q": "organic light emitting diode",
      "num": 10,
      "language": "ENGLISH",
      "status": "GRANT",
      "after": "publication:20230101"
    }
  }
}
```

## Development

1.  **Clone the repository (if needed for development):**
    ```bash
    # git clone <repository-url>
    # cd google-patents-mcp
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Create `.env` file:**
    Copy `.env.example` to `.env` and add your `SERPAPI_API_KEY`.
4.  **Build:**
    ```bash
    npm run build
    ```
5.  **Run locally:**
    ```bash
    npm start
    ```
    Or for development with auto-rebuild:
    ```bash
    npm run dev
    ```

## Logging

*   Logs are output to standard error.
*   Log level can be controlled via the `LOG_LEVEL` environment variable (`error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`). Defaults to `info`.
*   A log file is attempted to be created in the project root (`google-patents-server.log`), user's home directory (`~/.google-patents-server.log`), or `/tmp/google-patents-server.log`.

## License

MIT License (See LICENSE file)
