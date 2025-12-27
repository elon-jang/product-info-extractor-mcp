#!/usr/bin/env node

/**
 * Product Info Extractor MCP Server (HTTP/SSE)
 *
 * 원격 접근을 위한 HTTP + SSE (Server-Sent Events) 전송 방식
 * 로컬 stdio 대신 네트워크를 통해 MCP 프로토콜 지원
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import ProductExtractor from "./extractor.js";

// 전역 extractor 인스턴스
let extractor = null;

// Express 앱 생성
const app = express();

// 타임아웃 설정 (5분)
const SERVER_TIMEOUT = 5 * 60 * 1000;

// JSON body parser 추가 (MCP 메시지 처리를 위해 필수)
app.use(express.json());

// CORS 설정 (필요 시)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Cache-Control');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

/**
 * 서버 인스턴스 생성 함수
 * 각 SSE 연결마다 새로운 서버 인스턴스를 생성
 */
function createServer() {
  const server = new Server(
    {
      name: "product-info-extractor",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 도구 목록 핸들러 등록
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const timestamp = new Date().toISOString();
    console.log(`📋 [${timestamp}] List tools request received`);
    return {
      tools: [
        {
          name: "extract_product_info",
          description: "Extract comprehensive product information from e-commerce URLs including images, stock availability, product variants (color-by-size inventory), price, dimensions, and specifications",
          inputSchema: {
            type: "object",
            properties: {
              url: {
                type: "string",
                description: "Product URL to extract information from",
              },
              compact: {
                type: "boolean",
                description: "Enable compact mode for token optimization (87% reduction). Defaults to true.",
                default: true,
              },
            },
            required: ["url"],
          },
        },
      ],
    };
  });

  // 도구 실행 핸들러 등록
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    console.log(`📥 [${new Date().toISOString()}] Tool call:`, JSON.stringify(request, null, 2));

    if (request.params.name === "extract_product_info") {
      const args = request.params.arguments || {};

      // 다층 중첩 arguments 구조 대응
      // 클라이언트가 보내는 다양한 구조를 모두 처리
      let actualArgs = args;

      // arguments 또는 function_arguments 필드가 있으면 한 단계 들어감
      while (actualArgs.arguments || actualArgs.function_arguments) {
        actualArgs = actualArgs.arguments || actualArgs.function_arguments;
      }

      const url = actualArgs.url || actualArgs.URL;
      const compact = actualArgs.compact !== undefined ? actualArgs.compact : true;

      try {
        if (!url) {
          console.error('❌ Error: URL is missing in arguments. Received args:', JSON.stringify(args, null, 2));
          throw new Error('URL is required');
        }

        // Extractor 초기화 (전역 인스턴스 공유)
        if (!extractor) {
          console.log('🚀 Initializing extractor (shared)...');
          extractor = new ProductExtractor();
          await extractor.init();
        }

        console.log(`📦 Extracting: ${url}`);
        const result = await extractor.extract(url, { compact });
        console.log(`✅ Extraction complete: ${url}`);
        console.log(`📊 Result preview:`, JSON.stringify(result).substring(0, 500) + '...');

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        console.error(`❌ Extraction error: ${error.message}`);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: error.message,
              url: url,
              timestamp: new Date().toISOString(),
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
    throw new Error(`Unknown tool: ${request.params.name}`);
  });

  return server;
}

/**
 * MCP 엔드포인트 (Streamable HTTP)
 * SSE와 일반 HTTP 요청을 모두 처리하는 단일 엔드포인트
 */
app.all('/mcp', async (req, res) => {
  console.log(`📡 ${req.method} /mcp from:`, req.headers['user-agent']?.substring(0, 50));
  console.log('   Host:', req.headers.host);
  console.log('   Protocol:', req.protocol);
  console.log('   Session ID:', req.headers['mcp-session-id']);

  // GET 요청은 405 Method Not Allowed (POST만 허용)
  // Spring AI가 즉시 POST로 전환하도록 명확한 에러 반환
  if (req.method === 'GET') {
    console.log('⚠️  GET request - rejecting (POST required)');
    return res.status(405)
      .set('Allow', 'POST')
      .json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Method Not Allowed. Use POST for MCP requests.',
          data: {
            allowed_methods: ['POST'],
            endpoint: '/mcp'
          }
        },
        id: null
      });
  }

  // 타임아웃 설정
  req.setTimeout(SERVER_TIMEOUT);
  res.setTimeout(SERVER_TIMEOUT);

  try {
    console.log(`📝 Handling request in stateless mode`);
    console.log(`   Content-Type: ${req.headers['content-type']}`);
    console.log(`   Accept: ${req.headers['accept']}`);
    if (req.body) {
      console.log(`   Body:`, JSON.stringify(req.body).substring(0, 200));
    }

    // Stateless 모드: 매 요청마다 새 transport 생성
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,  // Stateless mode
      enableJsonResponse: true,  // JSON 응답 사용 (SSE 스트림 유지 방지)
    });

    // Transport 에러 핸들러
    transport.onerror = (error) => {
      console.error(`❌ Transport error:`, error.message);
      console.error(`   Stack:`, error.stack);
    };

    // 새 서버 인스턴스 생성 및 연결
    const server = createServer();
    await server.connect(transport);
    console.log(`✅ Server connected to transport`);

    // Transport에 요청 전달
    console.log(`📤 Handling request with transport...`);
    const startTime = Date.now();
    await transport.handleRequest(req, res, req.body);
    const elapsed = Date.now() - startTime;
    console.log(`✅ Request handled successfully (${elapsed}ms)`);

  } catch (error) {
    console.error('❌ Failed to handle MCP request:', error.message);
    console.error('   Stack:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * 헬스체크 엔드포인트
 */
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    extractor_initialized: extractor !== null,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

/**
 * 레거시 SSE 엔드포인트 - 명확한 에러 반환
 */
app.get('/sse', (_req, res) => {
  console.log('⚠️  Legacy /sse endpoint accessed - deprecated');
  res.status(410)  // 410 Gone
    .json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'SSE endpoint is deprecated. Use POST /mcp instead.',
        data: {
          new_endpoint: 'http://127.0.0.1:3000/mcp',
          method: 'POST',
          note: 'This server only supports POST requests for MCP communication.'
        }
      },
      id: null
    });
});

/**
 * 프로세스 종료 시 브라우저 정리
 */
async function cleanup() {
  console.log('\n🛑 Shutting down...');
  if (extractor) {
    await extractor.close();
  }
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

/**
 * 서버 시작
 */
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, async () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║   Product Info Extractor MCP Server (Streamable HTTP)       ║
╚═══════════════════════════════════════════════════════════════╝

🌐 Server running on: http://${HOST}:${PORT}
📡 MCP endpoint: http://${HOST}:${PORT}/mcp
❤️  Health check: http://${HOST}:${PORT}/health

ℹ️  Using Streamable HTTP transport (replaces deprecated SSE)
Press Ctrl+C to stop
  `);

  // Extractor 미리 초기화 (첫 요청 응답 시간 개선)
  if (!extractor) {
    console.log('🚀 Pre-initializing extractor...');
    try {
      extractor = new ProductExtractor();
      await extractor.init();
      console.log('✅ Extractor pre-initialized successfully');
    } catch (error) {
      console.error('⚠️  Failed to pre-initialize extractor:', error.message);
      console.error('   Extractor will be initialized on first request');
    }
  }
});
