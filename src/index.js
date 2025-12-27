#!/usr/bin/env node

/**
 * Product Info Extractor MCP Server
 *
 * MCP (Model Context Protocol) 서버로 동작하여
 * LLM이 상품 정보를 효율적으로 추출할 수 있도록 지원합니다.
 *
 * 주요 개선사항:
 * - 브라우저 인스턴스 재사용 (5-10배 성능 향상)
 * - 직접 함수 호출 (stdout 파싱 불필요)
 * - 명확한 에러 핸들링
 * - 세션 관리 및 캐싱 지원
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import ProductExtractor from "./extractor.js";

// 전역 extractor 인스턴스 (브라우저 재사용)
let extractor = null;

// MCP Server 초기화
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

/**
 * 도구 목록 반환
 */
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

/**
 * 도구 실행
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "extract_product_info") {
    const { url, compact = true } = request.params.arguments;

    try {
      // Extractor 초기화 (최초 1회만)
      if (!extractor) {
        extractor = new ProductExtractor();
        await extractor.init();
      }

      // 상품 정보 추출
      const result = await extractor.extract(url, { compact });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: error.message,
              url: url,
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

/**
 * 프로세스 종료 시 브라우저 정리
 */
async function cleanup() {
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
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Product Info Extractor MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
