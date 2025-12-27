#!/usr/bin/env node

/**
 * Product Info Extractor MCP Server (HTTP/SSE)
 *
 * 원격 접근을 위한 HTTP + SSE (Server-Sent Events) 전송 방식
 * 로컬 stdio 대신 네트워크를 통해 MCP 프로토콜 지원
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import ProductExtractor from "./extractor.js";

// 전역 extractor 인스턴스 및 transport 맵
let extractor = null;
const transports = new Map();

// Express 앱 생성
const app = express();

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
 * SSE 엔드포인트
 */
app.get('/sse', async (req, res) => {
  console.log('📡 New SSE connection from:', req.headers['user-agent']?.substring(0, 50));

  // 각 연결마다 독립적인 MCP Server 인스턴스 생성
  // (SDK의 Server 클래스가 단일 transport만 지원하기 때문)
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
      // 1단계: args.arguments가 있으면 사용
      let actualArgs = args.arguments || args;

      // 2단계: actualArgs.arguments가 또 있으면 한 단계 더 들어감 (Spring AI 등)
      if (actualArgs.arguments) {
        actualArgs = actualArgs.arguments;
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

  const transport = new SSEServerTransport('/message', res);

  try {
    await server.connect(transport);
    console.log('✅ MCP server connected to transport');

    if (transport.sessionId) {
      transports.set(transport.sessionId, transport);
      console.log(`📝 Session registered: ${transport.sessionId}`);
    }
  } catch (error) {
    console.error('❌ Failed to connect transport:', error.message);
    res.end();
    return;
  }

  req.on('close', () => {
    console.log('🔌 SSE connection closed');
    if (transport.sessionId) {
      transports.delete(transport.sessionId);
      console.log(`🗑️ Session removed: ${transport.sessionId}`);
    }
  });
});

/**
 * 헬스체크 엔드포인트
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    extractor_initialized: extractor !== null,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

/**
 * 메시지 엔드포인트 (POST)
 * Claude Code/Desktop이 MCP 요청을 보내는 엔드포인트
 */
app.post('/message', async (req, res) => {
  const sessionId = req.query.sessionId;

  if (!sessionId) {
    console.warn('⚠️ Received message without sessionId');
    return res.status(400).send('Session ID required');
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    console.warn(`⚠️ No transport found for session: ${sessionId}`);
    return res.status(404).send('Session not found');
  }

  console.log(`📨 Received MCP message for session: ${sessionId}`);

  try {
    await transport.handlePostMessage(req, res);
  } catch (error) {
    console.error(`❌ Error handling POST message: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
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

app.listen(PORT, HOST, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║   Product Info Extractor MCP Server (HTTP/SSE)               ║
╚═══════════════════════════════════════════════════════════════╝

🌐 Server running on: http://${HOST}:${PORT}
📡 SSE endpoint: http://${HOST}:${PORT}/sse
❤️  Health check: http://${HOST}:${PORT}/health

Press Ctrl+C to stop
  `);
});
