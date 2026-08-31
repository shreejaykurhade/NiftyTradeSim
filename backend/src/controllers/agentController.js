const { spawn } = require('child_process');
const path = require('path');
const {
  buildMemoryContext,
  getActorId,
  recordAgentRun,
} = require('../services/agentMemoryService');

async function getAgentConsensus(req, res) {
  let childProcess = null;

  try {
    const symbol = req.params.symbol || 'TCS.NS';
    const userId = getActorId(req);
    const memoryContext = await buildMemoryContext({ userId, symbol });
    const runLogs = [];
    let finalResult = null;
    
    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    
    // Send an initial handshake
    res.write(`data: ${JSON.stringify({ type: 'handshake', message: 'SSE Connection Established' })}\n\n`);

    const pythonScript = path.join(__dirname, '..', '..', 'scripts', 'run_agents.py');
    const pythonCommand = process.env.PYTHON_BIN || 'python';
    childProcess = spawn(pythonCommand, [pythonScript, symbol, JSON.stringify(memoryContext)]);
    let stdoutBuffer = '';
    let stderrBuffer = '';

    console.log(`\n================= LIVE AGENT PIPELINE (${symbol}) =================`);
    
    const forwardLines = (lines) => {
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'log') {
            runLogs.push(parsed.log);
            console.log(`  [${parsed.log.agent}] ${parsed.log.message}`);
          } else if (parsed.type === 'result') {
            finalResult = parsed.data;
            console.log('\n=================== FINAL 10D STATE & CONSENSUS ===================');
            console.log(`CONSENSUS: ${parsed.data.action} (${parsed.data.consensus_score}%)`);
            console.log(`REASONING: ${parsed.data.reasoning}`);
            console.log(`TECHNICAL 5D: [${parsed.data.technical_vector?.map(v => v.toFixed(2)).join(', ') || 'n/a'}]`);
            console.log(`PERCEPTION 5D: [${parsed.data.perception_vector?.map(v => v.toFixed(2)).join(', ') || 'n/a'}]`);
            console.log(`STATE 10D: [${parsed.data.state_vector?.map(v => v.toFixed(2)).join(', ') || 'n/a'}]`);
            console.log(`MEMORY ADJUSTMENT: ${(parsed.data.memory_adjustment || 0).toFixed(2)}`);
            console.log('=================================================================\n');
          }
          // Forward exactly as received to the frontend SSE
          res.write(`data: ${JSON.stringify(parsed)}\n\n`);
        } catch (e) {
          // If not valid JSON, it might be a raw print error from python, just pass it
          console.error("Non-JSON output from python:", line);
        }
      }
    };

    childProcess.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || '';
      forwardLines(lines.filter((line) => line.trim() !== ''));
    });

    childProcess.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
      console.error(`Python stderr: ${data}`);
    });

    childProcess.on('error', (err) => {
      stderrBuffer += err.message;
      console.error('Failed to start agent pipeline:', err.message);
    });

    childProcess.on('close', (code) => {
      if (stdoutBuffer.trim()) forwardLines([stdoutBuffer]);

      if (!finalResult) {
        const detail = stderrBuffer.trim().split(/\r?\n/).pop();
        finalResult = {
          action: 'Error',
          consensus_score: 0,
          reasoning: detail || `Agent pipeline exited with code ${code} before producing a result.`,
          technical_vector: [],
          perception_vector: [],
          state_vector: [],
          scenarios: [],
        };
        res.write(`data: ${JSON.stringify({ type: 'result', data: finalResult })}\n\n`);
      }

      console.log(`Agent pipeline closed with code ${code}`);
      recordAgentRun({
        userId,
        symbol,
        result: finalResult,
        logs: runLogs,
        memoryContext,
      }).catch((err) => {
        console.error('Failed to persist agent memory:', err.message);
      }).finally(() => res.end());
    });

    res.on('close', () => {
      if (!res.writableEnded && childProcess && !childProcess.killed) childProcess.kill();
    });

  } catch (err) {
    console.error("Stream initialization error:", err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getAgentConsensus };
