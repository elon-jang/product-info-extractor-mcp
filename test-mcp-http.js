#!/usr/bin/env node

/**
 * MCP HTTP Server Test Client
 * Tests the extract_product_info tool via SSE connection
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const SERVER_URL = process.env.MCP_SERVER_URL || 'http://127.0.0.1:8080/sse';
const TEST_URL = process.argv[2] || 'https://www.ugg.com/women-slippers/cozy-slipper/1117659.html';

console.log(`🧪 Testing MCP Server at: ${SERVER_URL}`);
console.log(`📦 Product URL: ${TEST_URL}\n`);

async function testMCP() {
    const transport = new SSEClientTransport(new URL(SERVER_URL));
    const client = new Client({
        name: 'test-client',
        version: '1.0.0',
    }, {
        capabilities: {}
    });

    try {
        console.log('🔌 Connecting to MCP server...');
        await client.connect(transport);
        console.log('✅ Connected!\n');

        console.log('📋 Listing available tools...');
        const { tools } = await client.listTools();
        console.log(`Found ${tools.length} tool(s):`);
        tools.forEach(tool => {
            console.log(`  - ${tool.name}: ${tool.description}`);
        });
        console.log('');

        console.log('🚀 Calling extract_product_info...');
        const result = await client.callTool({
            name: 'extract_product_info',
            arguments: {
                url: TEST_URL,
                compact: true
            }
        });

        console.log('\n=== EXTRACTION RESULT ===');
        console.log(JSON.stringify(result.content[0].text, null, 2));

        await client.close();
        console.log('\n✅ Test completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

testMCP();
