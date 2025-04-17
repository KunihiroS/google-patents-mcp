#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ListPromptsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';
import child_process from 'child_process';
import * as dotenv from 'dotenv';
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as fs from 'fs';
import os from 'os'; // Import the os module
// import axios from 'axios'; // Remove axios
import fetch from 'node-fetch'; // Import node-fetch

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★ デバッグ用ログを追加 ★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★
console.log(`--- MCP Server Startup ---`);
console.log(`[DEBUG] Node version: ${process.version}`);
console.log(`[DEBUG] Script path: ${__filename}`);
console.log(`[DEBUG] SERPAPI_API_KEY check: ${process.env.SERPAPI_API_KEY ? 'Exists (set)' : 'MISSING!'}`);
console.log(`-------------------------`);
// ★★★★★★★★★★★★★★★★★★★★★★★★★★

// ロガーのフォーマット設定を共通化
const createLoggerFormat = () => {
  return winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] [${level}] ${message}`;
    })
  );
};

// 初期ロガーの設定（.envの読み込み前に最小限のロガーを設定）
const initialLogger = winston.createLogger({
  level: 'info',
  format: createLoggerFormat(),
  transports: [
    new winston.transports.Console()
  ]
});

// MCP Hostからの環境変数を優先し、.envファイルはフォールバックとして扱う
// MCP Hostからの環境変数を優先し、.envファイルはフォールバックとして扱う
// .env ファイルの読み込みロジックは削除済み
// SERPAPI_API_KEY は環境変数からのみ取得する

// ログレベルの明示的な確認（デバッグ用）
// console.log(`Environment variable LOG_LEVEL: ${process.env.LOG_LEVEL}`); // Temporarily commented out
initialLogger.debug(`Current initial logger level: ${initialLogger.level}`);

// ログファイルパスを決定するシンプルな方法
let logFilePath: string | null = null;

// 1. まずプロジェクトルートに書き込みを試みる
try {
  const projectLogPath = path.resolve(__dirname, '../../google-patents-server.log');
  initialLogger.debug(`Attempting to write to project root log: ${projectLogPath}`);
  fs.writeFileSync(projectLogPath, `# Log file initialization at ${new Date().toISOString()}\n`, { flag: 'a' });
  logFilePath = projectLogPath;
  console.log(`Created log file in project root: ${logFilePath}`);
  initialLogger.debug(`Successfully created/accessed log file at: ${logFilePath}`);
} catch (err) {
  console.error(`Error writing to project root: ${err instanceof Error ? err.message : String(err)}`);
  initialLogger.debug(`Failed to write to project root log with error: ${err instanceof Error ? err.stack : String(err)}`);

  // 2. 次にホームディレクトリに試みる
  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (homeDir) {
      const homeLogPath = path.resolve(homeDir, '.google-patents-server.log');
      initialLogger.debug(`Attempting to write to home directory log: ${homeLogPath}`);
      fs.writeFileSync(homeLogPath, `# Log file initialization at ${new Date().toISOString()}\n`, { flag: 'a' });
      console.log(`Created log file in home directory: ${homeLogPath}`);
      logFilePath = homeLogPath;
      initialLogger.debug(`Successfully created/accessed log file at: ${logFilePath}`);
    }
  } catch (err2) {
    console.error(`Error writing to home directory: ${err2 instanceof Error ? err2.message : String(err2)}`);
    initialLogger.debug(`Failed to write to home directory log with error: ${err2 instanceof Error ? err2.stack : String(err2)}`);

    // 3. 最後に/tmpに試す
    try {
      const tmpPath = '/tmp/google-patents-server.log';
      initialLogger.debug(`Attempting to write to temp directory log: ${tmpPath}`);
      fs.writeFileSync(tmpPath, `# Log file initialization at ${new Date().toISOString()}\n`, { flag: 'a' });
      logFilePath = tmpPath;
      console.log(`Created log file in temp directory: ${logFilePath}`);
      initialLogger.debug(`Successfully created/accessed log file at: ${logFilePath}`);
    } catch (err3) {
      console.error('All log file paths failed. Logs will be console-only.');
      initialLogger.debug(`Failed to write to temp directory log with error: ${err3 instanceof Error ? err3.stack : String(err3)}`);
      logFilePath = null;
    }
  }
}

// 環境変数からログレベルを確実に取得
const logLevel = process.env.LOG_LEVEL || 'info';
console.log(`Setting log level to: ${logLevel}`);
initialLogger.debug(`Configured log level from environment: ${logLevel}`);

// Winstonロガーの設定
const logger = winston.createLogger({
  // 環境変数からログレベルを設定
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] [${level}] ${message}`;
    })
  ),
  transports: [
    // コンソールトランスポートもログレベル設定を継承
    new winston.transports.Console({ level: logLevel })
  ]
});

logger.debug('Winston logger created with console transport');

// ファイルトランスポートの追加
if (logFilePath) {
  try {
    // ファイルトランスポートを作成
    const fileTransport = new winston.transports.File({
      filename: logFilePath,
      // 明示的にログレベルを設定
      level: logLevel,
      options: { flags: 'a' }
    });

    // ファイルトランスポート追加
    logger.add(fileTransport);
    console.log(`Added log file: ${logFilePath}`);
    logger.debug(`File transport added to logger with level: ${logLevel}`);

    // 同期書き込みテスト - シンプルな起動メッセージのみに置き換え
    fs.appendFileSync(logFilePath, `# System startup - ${new Date().toISOString()}\n`);
    logger.debug(`Wrote startup marker to log file`);
  } catch (err) {
    console.error('File transport setup error:', err);
    logger.debug(`Failed to setup file transport: ${err instanceof Error ? err.stack : String(err)}`);
  }
}

// 起動時にシンプルなログを書き込み
logger.info('=== Google Patents Server started ===');
logger.debug('Server initialization sequence started');

// ファイル情報の診断 - デバッグモードでのみ詳細表示
if (logFilePath && logLevel === 'debug') {
  try {
    const stats = fs.statSync(logFilePath);
    logger.debug(`Log file information (${logFilePath}): size=${stats.size} bytes, mode=${stats.mode.toString(8)}, uid=${stats.uid}, gid=${stats.gid}`);
  } catch (err) {
    logger.error('Failed to get file information:', err);
  }
}

// ログフラッシュ関数をシンプル化
const flushLog = () => {
  logger.debug('Flushing logs to disk');

  if (logFilePath) {
    try {
      // 同期的に書き込み
      fs.appendFileSync(logFilePath, `\n# Process terminated: ${new Date().toISOString()}\n`);
      logger.debug('Wrote termination marker to log file');
    } catch (appendErr) {
      console.error('Error writing log on termination:', appendErr);
      logger.debug(`Failed to write termination marker: ${appendErr instanceof Error ? appendErr.stack : String(appendErr)}`);
    }
  }

  try {
    // Winstonのクローズを試みる（エラーを無視）
    logger.debug('Closing Winston logger');
    logger.close();
  } catch (err) {
    // 無視
    logger.debug(`Error while closing logger: ${err instanceof Error ? err.message : String(err)}`);
  }
};

// プロセス終了時にログを確実にフラッシュ
process.on('exit', () => {
  logger.debug('Process exit event detected');
  flushLog();
});

// SIGINT (Ctrl+C) 処理
process.on('SIGINT', () => {
  logger.info('Received SIGINT. Shutting down.');
  logger.debug('SIGINT handler triggered');
  flushLog();
  process.exit(0);
});

// 未処理の例外をキャッチ
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught exception: ${err.message}`);
  logger.error(err.stack);
  logger.debug('Uncaught exception handler triggered');
  flushLog();
  process.exit(1);
});

// SerpApi APIキーを環境変数 SERPAPI_API_KEY から取得
const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY;

if (!SERPAPI_API_KEY) {
    logger.error('Error: SERPAPI_API_KEY environment variable is not set.');
    logger.debug('Missing required SERPAPI_API_KEY environment variable, exiting');
    process.exit(1);
} else {
    logger.info('SERPAPI_API_KEY found.');
    logger.debug('SERPAPI_API_KEY is set (value hidden for security).');
}

// Base64 エンコード／デコード ヘルパー関数
function encodeText(text: string): string {
    return Buffer.from(text, 'utf8').toString('base64');
}

function decodeText(encoded: string): string {
    return Buffer.from(encoded, 'base64').toString('utf8');
}

class GooglePatentsServer {
  private server: Server;

  constructor() {
    logger.debug('Initializing Google Patents Server');
    this.server = new Server(
      {
        name: 'google-patents-server',
        version: '0.2.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
          prompts: {}, // Declare prompts capability
        },
      }
    );

    logger.debug('Setting up tool handlers');
    this.setupToolHandlers();

    // Register handlers for standard MCP list methods required by some clients
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));

    this.server.onerror = (error: any) => {
      logger.error('[MCP Error]', error);
      logger.debug(`MCP server error details: ${error instanceof Error ? error.stack : JSON.stringify(error)}`);
    };

    process.on('SIGINT', async () => {
      logger.debug('SIGINT received in server handler');
      await this.server.close();
      process.exit(0);
    });

    logger.debug('Google Patents Server initialization completed');
  }

  private setupToolHandlers() {
    // ツールリストの設定
    logger.debug('Registering ListTools request handler');
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug('ListTools handler called');
      return {
        tools: [
          {
            name: 'search_patents',
            description: 'Searches Google Patents using SerpApi. Allows filtering by date, inventor, assignee, country, language, status, type, and sorting.',
            inputSchema: {
              type: 'object',
              properties: {
                q: { type: 'string', description: "Search query (required). Although optional in SerpApi docs, a non-empty query is practically needed. Use semicolon (;) to separate multiple terms. Advanced syntax like '(Coffee) OR (Tea);(A47J)' is supported. See 'About Google Patents' for details." },
                page: { type: 'integer', description: 'Page number for pagination (default: 1).', default: 1 },
                num: { type: 'integer', description: 'Number of results per page (default: 10). **IMPORTANT: Must be 10 or greater (up to 100).**', default: 10, minimum: 10, maximum: 100 },
                sort: { type: 'string', enum: ['relevance', 'new', 'old'], description: "Sorting method. 'relevance' (default), 'new' (newest by filing/publication date), 'old' (oldest by filing/publication date).", default: 'relevance' },
                before: { type: 'string', description: "Maximum date filter (e.g., 'publication:20231231', 'filing:20220101'). Format: type:YYYYMMDD where type is 'priority', 'filing', or 'publication'." },
                after: { type: 'string', description: "Minimum date filter (e.g., 'publication:20230101', 'filing:20220601'). Format: type:YYYYMMDD where type is 'priority', 'filing', or 'publication'." },
                inventor: { type: 'string', description: 'Filter by inventor names. Separate multiple names with a comma (,).' },
                assignee: { type: 'string', description: 'Filter by assignee names. Separate multiple names with a comma (,).' },
                country: { type: 'string', description: "Filter by country codes (e.g., 'US', 'WO,JP'). Separate multiple codes with a comma (,)." },
                language: { type: 'string', description: "Filter by language (e.g., 'ENGLISH', 'JAPANESE,GERMAN'). Separate multiple languages with a comma (,). Supported: ENGLISH, GERMAN, CHINESE, FRENCH, SPANISH, ARABIC, JAPANESE, KOREAN, PORTUGUESE, RUSSIAN, ITALIAN, DUTCH, SWEDISH, FINNISH, NORWEGIAN, DANISH." },
                status: { type: 'string', enum: ['GRANT', 'APPLICATION'], description: "Filter by patent status: 'GRANT' or 'APPLICATION'." },
                type: { type: 'string', enum: ['PATENT', 'DESIGN'], description: "Filter by patent type: 'PATENT' or 'DESIGN'." },
                scholar: { type: 'boolean', description: 'Include Google Scholar results (default: false).', default: false }
              },
              required: ['q']
            }
          }
        ]
      };
    });

    // ツール実行リクエスト処理 - ここで search_patents を実装する
    logger.debug('Registering CallTool request handler');
    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      // ハンドラが呼び出されたことをログ出力 (winston)
      logger.debug('<<<< CallToolRequestSchema handler invoked (winston) >>>>');
      logger.debug(`Received request object: ${JSON.stringify(request, null, 2)}`); // リクエスト全体もログ出力
      const { name, arguments: args } = request.params;
      logger.debug(`CallTool handler called for tool: ${name} with args: ${JSON.stringify(args, null, 2)}`);

      if (name === 'search_patents') {
        // --- 元のコードに戻す ---
        const { q, ...otherParams } = args; // q は必須、その他はオプション
        if (!q) {
          logger.error('Missing required argument "q" for search_patents');
          throw new McpError(400, 'Missing required argument: q');
        }
        if (!SERPAPI_API_KEY) {
          logger.error('SERPAPI_API_KEY is not configured.');
          throw new McpError(500, 'Server configuration error: SERPAPI_API_KEY is missing.');
        }

        const controller = new AbortController(); // AbortController を try の前に移動
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

        try {
          console.log('[DEBUG] Entered API call try block'); // tryブロック開始
          // パラメータを構築 (必須パラメータ)
          const searchParams = new URLSearchParams({
            engine: 'google_patents',
            q: q,
            api_key: SERPAPI_API_KEY
          });
          // オプションパラメータを安全に追加
          for (const [key, value] of Object.entries(otherParams)) {
            if (value !== undefined) {
              searchParams.append(key, String(value)); // 値を文字列に変換
            }
          }
          const apiUrl = `https://serpapi.com/search.json?${searchParams.toString()}`;
          // console.log(`[DEBUG] Calling SerpApi URL: ${apiUrl}`); // デバッグ用console.log削除
          logger.info(`Calling SerpApi: ${apiUrl.replace(SERPAPI_API_KEY, '****')}`); // ログにはAPIキーを隠す

          // Use node-fetch with AbortController for timeout (controller と timeoutId は上で定義済み)
            const response = await fetch(apiUrl, { signal: controller.signal });

            if (!response.ok) {
              // Handle HTTP errors (like 4xx, 5xx)
              let errorBody = 'Could not retrieve error body.'; // Default error message
              try {
                errorBody = await response.text(); // Try to get error body
              } catch (bodyError) {
                logger.warn(`Failed to read error response body: ${bodyError instanceof Error ? bodyError.message : String(bodyError)}`);
              }
              logger.error(`SerpApi request failed with status ${response.status} ${response.statusText}. Response body: ${errorBody}`); // Log the actual error body
              throw new McpError(response.status, `SerpApi request failed: ${response.statusText}. Body: ${errorBody}`); // Include body in error
            }

            const data = await response.json(); // Parse JSON response
            logger.info(`SerpApi request successful for query: "${q}"`);
            logger.debug(`SerpApi response status: ${response.status}`);
            // レスポンスを type: 'text' の JSON 文字列として返す
            clearTimeout(timeoutId); // 成功時もタイマーをクリア
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };

        } catch (error: any) {
          clearTimeout(timeoutId); // エラー発生時もタイマーをクリア
          if (error.name === 'AbortError') {
            logger.error(`SerpApi request timed out after 30 seconds for query "${q}"`);
            throw new McpError(408, 'SerpApi request timed out');
          }
          // Handle other network errors or JSON parsing errors
          logger.error(`Error during fetch or JSON parsing for query "${q}": ${error.message}`);
          logger.error(`Unexpected error: ${error.stack}`);
          throw new McpError(500, `An unexpected error occurred: ${error.message}`);
        } finally {
           // finally は不要になったので削除 (clearTimeout は try の最後と catch の最初で行う)
           // clearTimeout(timeoutId); // try の最後でクリアするか、catch の最初でクリアする
        }
        // --- 元のコードここまで ---
      } else { // This else corresponds to 'if (name === 'search_patents')'
        logger.warn(`Received request for unknown tool: ${name}`);
        throw new McpError(404, `Unknown tool: ${name}`);
      }
    });
  }

  async run() {
    // ★★★ run() メソッド開始直後 ★★★
    console.log('[DEBUG] Server run() method started');
    logger.debug('Starting Google Patents MCP server');
    const transport = new StdioServerTransport();
    logger.debug('Created StdioServerTransport');
    // ★★★ connect() 呼び出し直前 ★★★
    console.log('[DEBUG] Calling server.connect(transport)');
    await this.server.connect(transport);
    // ★★★ connect() 呼び出し直後 ★★★
    console.log('[DEBUG] server.connect(transport) completed');
    logger.info("Google Patents MCP server running on stdio");
    logger.debug('Server connected to transport and ready to process requests');
  }
}

const server = new GooglePatentsServer();
server.run().catch((err) => {
  logger.error('Failed to start server:', err);
  logger.debug(`Server start failure details: ${err instanceof Error ? err.stack : String(err)}`);
  console.error(err);
});