import { useState, useEffect, useCallback, useRef } from "react";

const COLS = 8, ROWS = 8;
const CANDIES = ["🍬","🍭","🍫","🍊","🍇","⭐"];
const COLORS = ["#E24B4A","#E879F9","#92400E","#F97316","#7C3AED","#EAB308"];
const LIGHT  = ["#FCEBEB","#FDF4FF","#FEF3C7","#FFF7ED","#F5F3FF","#FEFCE8"];

const GOALS = [
  { target: 500,  moves: 20 },
  { target: 1000, moves: 18 },
  { target: 2000, moves: 15 },
];

function randCandy() { return Math.floor(Math.random() * CANDIES.length); }

function makeGrid() {
  let g = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, randCandy));
  // avoid initial matches
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    while (
      (c >= 2 && g[r][c] === g[r][c-1] && g[r][c] === g[r][c-2]) ||
      (r >= 2 && g[r][c] === g[r-1][c] && g[r][c] === g[r-2][c])
    ) g[r][c] = randCandy();
  }
  return g;
}

function findMatches(g) {
  const matched = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS - 2; c++)
    if (g[r][c] === g[r][c+1] && g[r][c] === g[r][c+2]) matched[r][c] = matched[r][c+1] = matched[r][c+2] = true;
  for (let r = 0; r < ROWS - 2; r++) for (let c = 0; c < COLS; c++)
    if (g[r][c] === g[r+1][c] && g[r][c] === g[r+2][c]) matched[r][c] = matched[r+1][c] = matched[r+2][c] = true;
  return matched;
}

function countMatched(m) { return m.flat().filter(Boolean).length; }

function applyGravity(g) {
  const ng = g.map(r => [...r]);
  for (let c = 0; c < COLS; c++) {
    let empty = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (ng[r][c] !== null) { ng[empty][c] = ng[r][c]; if (empty !== r) ng[r][c] = null; empty--; }
    }
    for (let r = empty; r >= 0; r--) ng[r][c] = randCandy();
  }
  return ng;
}

function removeMatched(g, matched) {
  return g.map((row, r) => row.map((v, c) => matched[r][c] ? null : v));
}

function hasAnyMove(g) {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const dirs = [[0,1],[1,0]];
    for (const [dr,dc] of dirs) {
      const nr = r+dr, nc = c+dc;
      if (nr >= ROWS || nc >= COLS) continue;
      const ng = g.map(row => [...row]);
      [ng[r][c], ng[nr][nc]] = [ng[nr][nc], ng[r][c]];
      const m = findMatches(ng);
      if (countMatched(m) > 0) return true;
    }
  }
  return false;
}

export default function CandyCrush() {
  const [grid, setGrid] = useState(makeGrid);
  const [selected, setSelected] = useState(null);
  const [matched, setMatched] = useState(null);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(GOALS[0].moves);
  const [level, setLevel] = useState(0);
  const [phase, setPhase] = useState("playing"); // playing | clearing | dropping | levelup | gameover
  const [combo, setCombo] = useState(0);
  const [particles, setParticles] = useState([]);
  const [hint, setHint] = useState(null);
  const hintTimer = useRef(null);
  const comboRef = useRef(0);

  const goal = GOALS[Math.min(level, GOALS.length - 1)];

  // Auto-clear matches
  useEffect(() => {
    if (phase !== "playing") return;
    const m = findMatches(grid);
    if (countMatched(m) > 0) {
      setMatched(m);
      setPhase("clearing");
    }
  }, [grid, phase]);

  useEffect(() => {
    if (phase === "clearing") {
      const t = setTimeout(() => {
        const pts = countMatched(matched) * 10 * (comboRef.current + 1);
        setScore(s => s + pts);
        setCombo(c => c + 1);
        comboRef.current += 1;
        setGrid(g => applyGravity(removeMatched(g, matched)));
        setMatched(null);
        setPhase("dropping");
      }, 400);
      return () => clearTimeout(t);
    }
    if (phase === "dropping") {
      const t = setTimeout(() => {
        comboRef.current = 0;
        setCombo(0);
        setPhase("playing");
      }, 300);
      return () => clearTimeout(t);
    }
  }, [phase, matched]);

  // Level up / game over
  useEffect(() => {
    if (phase !== "playing") return;
    if (score >= goal.target) { setPhase("levelup"); return; }
    if (moves <= 0) { setPhase("gameover"); return; }
  }, [score, moves, phase]);

  // Hint after 3s idle
  useEffect(() => {
    if (phase !== "playing") return;
    clearTimeout(hintTimer.current);
    setHint(null);
    hintTimer.current = setTimeout(() => {
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const dirs = [[0,1],[1,0]];
        for (const [dr,dc] of dirs) {
          const nr = r+dr, nc = c+dc;
          if (nr >= ROWS || nc >= COLS) continue;
          const ng = grid.map(row => [...row]);
          [ng[r][c], ng[nr][nc]] = [ng[nr][nc], ng[r][c]];
          if (countMatched(findMatches(ng)) > 0) { setHint([[r,c],[nr,nc]]); return; }
        }
      }
    }, 3000);
    return () => clearTimeout(hintTimer.current);
  }, [grid, phase]);

  function isHinted(r, c) {
    return hint && hint.some(([hr,hc]) => hr === r && hc === c);
  }

  function swap(r1,c1,r2,c2) {
    const ng = grid.map(row => [...row]);
    [ng[r1][c1], ng[r2][c2]] = [ng[r2][c2], ng[r1][c1]];
    const m = findMatches(ng);
    if (countMatched(m) > 0) {
      setGrid(ng);
      setMoves(mv => mv - 1);
      setSelected(null);
      setHint(null);
    } else {
      // Shake (just deselect)
      setSelected(null);
    }
  }

  function handleCell(r, c) {
    if (phase !== "playing") return;
    if (!selected) { setSelected([r,c]); return; }
    const [sr,sc] = selected;
    if (sr === r && sc === c) { setSelected(null); return; }
    const adj = Math.abs(sr-r) + Math.abs(sc-c) === 1;
    if (adj) swap(sr,sc,r,c);
    else setSelected([r,c]);
  }

  function nextLevel() {
    setLevel(l => l + 1);
    setGrid(makeGrid());
    setMoves(GOALS[Math.min(level+1, GOALS.length-1)].moves);
    setScore(0);
    setPhase("playing");
    setSelected(null);
    setMatched(null);
    setCombo(0);
  }

  function restart() {
    setLevel(0);
    setGrid(makeGrid());
    setMoves(GOALS[0].moves);
    setScore(0);
    setPhase("playing");
    setSelected(null);
    setMatched(null);
    setCombo(0);
  }

  const pct = Math.min(100, Math.round((score / goal.target) * 100));

  return (
    <div style={{ padding:"1rem 0", fontFamily:"var(--font-sans)", maxWidth:420, margin:"0 auto" }}>
      <h2 style={{ fontSize:18, fontWeight:500, margin:"0 0 2px", color:"var(--color-text-primary)" }}>Candy Crush</h2>
      <p style={{ fontSize:13, color:"var(--color-text-secondary)", margin:"0 0 12px" }}>
        Match 3 or more candies • Level {level+1}
      </p>

      {/* HUD */}
      <div style={{ display:"flex", gap:10, marginBottom:10, alignItems:"center" }}>
        <div style={{ flex:1, background:"var(--color-background-secondary)", borderRadius:999, height:12, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${pct}%`, background:"linear-gradient(90deg,#E24B4A,#E879F9)", borderRadius:999, transition:"width 0.4s" }}/>
        </div>
        <div style={{ fontSize:13, color:"var(--color-text-secondary)", whiteSpace:"nowrap" }}>{score} / {goal.target}</div>
        <div style={{ background:"#E24B4A", color:"#fff", borderRadius:999, padding:"3px 12px", fontSize:13, fontWeight:500 }}>
          {moves} 💣
        </div>
      </div>

      {combo > 1 && phase === "clearing" && (
        <div style={{ textAlign:"center", fontSize:20, fontWeight:500, color:"#E879F9", marginBottom:6, animation:"pulse 0.3s" }}>
          {combo}x Combo! 🎉
        </div>
      )}

      {/* Grid */}
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${COLS}, 1fr)`, gap:3, background:"#1a0030", padding:6, borderRadius:"var(--border-radius-lg)", border:"2px solid #7C3AED", boxShadow:"0 0 24px rgba(124,58,237,0.3)" }}>
        {grid.map((row, r) => row.map((candy, c) => {
          const isSel = selected && selected[0]===r && selected[1]===c;
          const isMatch = matched && matched[r][c];
          const isHint = isHinted(r,c);
          return (
            <div key={`${r}-${c}`}
              onClick={() => handleCell(r,c)}
              style={{
                aspectRatio:"1",
                borderRadius:10,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize: "clamp(18px, 4vw, 26px)",
                cursor:"pointer",
                background: isSel ? COLORS[candy] : isMatch ? LIGHT[candy] : "rgba(255,255,255,0.07)",
                border: isSel ? `2px solid #fff` : isHint ? `2px solid #EAB308` : "2px solid transparent",
                transform: isSel ? "scale(1.15)" : isMatch ? "scale(0.85)" : "scale(1)",
                opacity: isMatch ? 0.4 : 1,
                transition: "all 0.18s",
                boxShadow: isSel ? `0 0 12px ${COLORS[candy]}` : isHint ? "0 0 10px #EAB308" : "none",
                userSelect:"none",
              }}>
              {CANDIES[candy]}
            </div>
          );
        }))}
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, fontSize:12, color:"var(--color-text-secondary)" }}>
        <span>Tap a candy, then tap an adjacent one to swap</span>
        <button onClick={restart} style={{ fontSize:12, padding:"2px 10px", borderRadius:999 }}>Restart</button>
      </div>

      {/* Level Up overlay */}
      {phase === "levelup" && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ background:"var(--color-background-primary)", borderRadius:20, padding:"2rem", textAlign:"center", border:"2px solid #E879F9", boxShadow:"0 0 40px rgba(232,121,249,0.4)" }}>
            <div style={{ fontSize:52 }}>🎊</div>
            <div style={{ fontSize:22, fontWeight:500, color:"#E879F9", marginTop:8 }}>Level {level+1} Complete!</div>
            <div style={{ fontSize:14, color:"var(--color-text-secondary)", margin:"8px 0 20px" }}>Score: {score}</div>
            {level + 1 < GOALS.length
              ? <button onClick={nextLevel} style={{ padding:"10px 28px", fontSize:15, fontWeight:500, borderRadius:999, background:"linear-gradient(135deg,#E24B4A,#E879F9)", color:"#fff", border:"none", cursor:"pointer" }}>Next Level →</button>
              : <><div style={{ fontSize:15, color:"#EAB308", marginBottom:12 }}>🏆 You beat all levels!</div><button onClick={restart} style={{ padding:"10px 28px", fontSize:15, fontWeight:500, borderRadius:999, background:"#EAB308", color:"#412402", border:"none", cursor:"pointer" }}>Play Again</button></>
            }
          </div>
        </div>
      )}

      {/* Game Over overlay */}
      {phase === "gameover" && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ background:"var(--color-background-primary)", borderRadius:20, padding:"2rem", textAlign:"center", border:"2px solid #E24B4A" }}>
            <div style={{ fontSize:52 }}>💔</div>
            <div style={{ fontSize:22, fontWeight:500, color:"#E24B4A", marginTop:8 }}>Out of Moves!</div>
            <div style={{ fontSize:14, color:"var(--color-text-secondary)", margin:"8px 0 4px" }}>Score: {score}</div>
            <div style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:20 }}>Goal was {goal.target}</div>
            <button onClick={restart} style={{ padding:"10px 28px", fontSize:15, fontWeight:500, borderRadius:999, background:"#E24B4A", color:"#fff", border:"none", cursor:"pointer" }}>Try Again</button>
          </div>
        </div>
      )}
    </div>
  );
}
