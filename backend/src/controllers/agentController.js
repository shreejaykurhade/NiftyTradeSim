const { spawn } = require('child_process');
const path = require('path');

async function getAgentConsensus(req, res) {
  try {
    const symbol = req.params.symbol || 'TCS.NS';
    
    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send an initial handshake
    res.write(`data: ${JSON.stringify({ type: 'handshake', message: 'SSE Connection Established' })}\n\n`);

    const pythonScript = path.join(__dirname, '..', '..', 'scripts', 'run_agents.py');
    const process = spawn('python', [pythonScript, symbol]);

    console.log(`\n================= LIVE AGENT PIPELINE (${symbol}) =================`);
    
    process.stdout.on('data', (data) => {
      // The python script might output multiple JSONs in one chunk, split by newline
      const lines = data.toString().split('\n').filter(line => line.trim() !== '');
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'log') {
            console.log(`  [${parsed.log.agent}] ${parsed.log.message}`);
          } else if (parsed.type === 'result') {
            console.log('\n=================== FINAL 5D TENSOR & CONSENSUS ===================');
            console.log(`CONSENSUS: ${parsed.data.action} (${parsed.data.consensus_score}%)`);
            console.log(`REASONING: ${parsed.data.reasoning}`);
            console.log(`VECTOR 5D: [${parsed.data.vector?.map(v => v.toFixed(2)).join(', ')}]`);
            console.log('=================================================================\n');
          }
          // Forward exactly as received to the frontend SSE
          res.write(`data: ${JSON.stringify(parsed)}\n\n`);
        } catch (e) {
          // If not valid JSON, it might be a raw print error from python, just pass it
          console.error("Non-JSON output from python:", line);
        }
      }
    });

    process.stderr.on('data', (data) => {
      console.error(`Python stderr: ${data}`);
    });

    process.on('close', (code) => {
      console.log(`Agent pipeline closed with code ${code}`);
      res.end();
    });

  } catch (err) {
    console.error("Stream initialization error:", err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getAgentConsensus };
