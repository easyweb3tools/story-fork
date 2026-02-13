import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
} from "remotion";

/* ── colour tokens ── */
const BG = "#0A0A0A";
const BG_CARD = "#141414";
const BLUE = "#0071E3";
const GREEN = "#34C759";
const ORANGE = "#FF9500";
const WHITE = "#FFFFFF";
const GRAY = "#86868B";
const LIGHT_GRAY = "#AEAEB2";

/* ── shared fade helpers ── */
const fadeIn = (frame: number, start = 0, dur = 15) =>
  interpolate(frame, [start, start + dur], [0, 1], { extrapolateRight: "clamp" });

const fadeOut = (frame: number, end: number, dur = 15) =>
  interpolate(frame, [end - dur, end], [1, 0], { extrapolateLeft: "clamp" });

const slideUp = (frame: number, fps: number, delay = 0) =>
  spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 120 } });

/* ════════════════════════════════════════════════════════════
   Scene 1 — Title Card
   ════════════════════════════════════════════════════════════ */
const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = slideUp(frame, fps, 10);
  const subtitleProgress = slideUp(frame, fps, 25);
  const tagProgress = slideUp(frame, fps, 40);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 40%, #1a1a2e 0%, ${BG} 70%)`,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Decorative grid */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.05 }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute", left: `${i * 5}%`, top: 0, bottom: 0,
            width: 1, background: WHITE,
          }} />
        ))}
      </div>

      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 24,
        transform: `translateY(${interpolate(titleProgress, [0, 1], [60, 0])}px)`,
        opacity: titleProgress,
      }}>
        <div style={{
          fontSize: 110, fontWeight: 800, color: WHITE,
          fontFamily: "SF Pro Display, -apple-system, Helvetica Neue, sans-serif",
          letterSpacing: -3,
        }}>
          Story-Fork
        </div>
      </div>

      <div style={{
        position: "absolute", top: "55%",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
        transform: `translateY(${interpolate(subtitleProgress, [0, 1], [40, 0])}px)`,
        opacity: subtitleProgress,
      }}>
        <div style={{
          fontSize: 36, fontWeight: 400, color: BLUE,
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
        }}>
          Pay to Vote the Narrative
        </div>
      </div>

      <div style={{
        position: "absolute", top: "66%",
        display: "flex", gap: 16, alignItems: "center",
        opacity: tagProgress,
        transform: `translateY(${interpolate(tagProgress, [0, 1], [30, 0])}px)`,
      }}>
        {["x402-stacks", "Stacks Blockchain", "AI Agent"].map((tag) => (
          <div key={tag} style={{
            padding: "8px 20px", borderRadius: 20,
            border: `1px solid ${GRAY}`, color: LIGHT_GRAY,
            fontSize: 18, fontFamily: "SF Pro Text, -apple-system, sans-serif",
          }}>
            {tag}
          </div>
        ))}
      </div>

      <div style={{
        position: "absolute", bottom: 60,
        fontSize: 20, color: GRAY,
        fontFamily: "SF Pro Text, -apple-system, sans-serif",
        opacity: fadeIn(frame, 50, 20),
      }}>
        Built for the x402 Stacks Challenge Hackathon
      </div>
    </AbsoluteFill>
  );
};

/* ════════════════════════════════════════════════════════════
   Scene 2 — Problem / Concept
   ════════════════════════════════════════════════════════════ */
const ConceptScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lines = [
    { text: "What if readers didn't just consume stories —", delay: 5 },
    { text: "they funded the direction?", delay: 25, highlight: true },
  ];

  const bullets = [
    { icon: "📖", text: "Pay micro-STX to unlock story branches", delay: 60 },
    { icon: "🗳️", text: "Vote with STX for your favorite plot direction", delay: 75 },
    { icon: "👑", text: "Highest-funded branch becomes Canon (the official story)", delay: 90 },
    { icon: "🤖", text: "AI Agent generates new branches every 10 minutes", delay: 105 },
  ];

  return (
    <AbsoluteFill style={{ background: BG, justifyContent: "center", padding: "0 140px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 60 }}>
        {lines.map(({ text, delay, highlight }, i) => {
          const p = slideUp(frame, fps, delay);
          return (
            <div key={i} style={{
              fontSize: highlight ? 56 : 48,
              fontWeight: highlight ? 700 : 400,
              color: highlight ? BLUE : WHITE,
              fontFamily: "SF Pro Display, -apple-system, sans-serif",
              opacity: p,
              transform: `translateY(${interpolate(p, [0, 1], [30, 0])}px)`,
            }}>
              {text}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {bullets.map(({ icon, text, delay }, i) => {
          const p = slideUp(frame, fps, delay);
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 20,
              opacity: p,
              transform: `translateX(${interpolate(p, [0, 1], [40, 0])}px)`,
            }}>
              <div style={{ fontSize: 36 }}>{icon}</div>
              <div style={{
                fontSize: 28, color: LIGHT_GRAY,
                fontFamily: "SF Pro Text, -apple-system, sans-serif",
              }}>
                {text}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ════════════════════════════════════════════════════════════
   Scene 3 — Homepage Screenshot
   ════════════════════════════════════════════════════════════ */
const ScreenshotScene: React.FC<{
  src: string;
  title: string;
  subtitle: string;
}> = ({ src, title, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const labelP = slideUp(frame, fps, 5);
  const imgP = slideUp(frame, fps, 20);

  return (
    <AbsoluteFill style={{ background: BG }}>
      {/* Top label */}
      <div style={{
        position: "absolute", top: 50, left: 80,
        opacity: labelP,
        transform: `translateY(${interpolate(labelP, [0, 1], [20, 0])}px)`,
      }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: BLUE, letterSpacing: 2,
          textTransform: "uppercase",
          fontFamily: "SF Pro Text, -apple-system, sans-serif",
          marginBottom: 8,
        }}>
          {subtitle}
        </div>
        <div style={{
          fontSize: 40, fontWeight: 700, color: WHITE,
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
        }}>
          {title}
        </div>
      </div>

      {/* Screenshot */}
      <div style={{
        position: "absolute", top: 170, left: 80, right: 80, bottom: 50,
        display: "flex", justifyContent: "center", alignItems: "flex-start",
        opacity: imgP,
        transform: `translateY(${interpolate(imgP, [0, 1], [40, 0])}px) scale(${interpolate(imgP, [0, 1], [0.95, 1])})`,
      }}>
        <div style={{
          borderRadius: 16, overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,113,227,0.2), 0 0 0 1px rgba(255,255,255,0.1)",
          maxHeight: "100%",
        }}>
          <Img src={staticFile(src)} style={{
            maxWidth: "100%", maxHeight: 840, objectFit: "contain",
          }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ════════════════════════════════════════════════════════════
   Scene 4 — x402 Payment Flow
   ════════════════════════════════════════════════════════════ */
const PaymentFlowScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const steps = [
    { label: "1. Request", desc: "GET /branches/:id/read", color: WHITE, delay: 15 },
    { label: "2. HTTP 402", desc: "Server returns PaymentRequirements", color: ORANGE, delay: 40 },
    { label: "3. Sign", desc: "Wallet signs STX transfer", color: BLUE, delay: 65 },
    { label: "4. Verify", desc: "Facilitator validates payment", color: BLUE, delay: 90 },
    { label: "5. Settle", desc: "Transaction broadcast on-chain", color: GREEN, delay: 115 },
    { label: "6. Unlock", desc: "Content delivered to reader", color: GREEN, delay: 140 },
  ];

  const titleP = slideUp(frame, fps, 0);

  return (
    <AbsoluteFill style={{ background: BG, padding: "60px 100px" }}>
      <div style={{
        fontSize: 14, fontWeight: 600, color: BLUE, letterSpacing: 2,
        textTransform: "uppercase", marginBottom: 8,
        fontFamily: "SF Pro Text, -apple-system, sans-serif",
        opacity: titleP,
      }}>
        x402 Protocol
      </div>
      <div style={{
        fontSize: 44, fontWeight: 700, color: WHITE, marginBottom: 60,
        fontFamily: "SF Pro Display, -apple-system, sans-serif",
        opacity: titleP,
        transform: `translateY(${interpolate(titleP, [0, 1], [20, 0])}px)`,
      }}>
        HTTP 402 Payment Flow
      </div>

      {/* Flow diagram */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20, position: "relative" }}>
        {/* Vertical line */}
        <div style={{
          position: "absolute", left: 24, top: 0, bottom: 0, width: 2,
          background: `linear-gradient(to bottom, ${BLUE}44, ${GREEN}44)`,
        }} />

        {steps.map(({ label, desc, color, delay }, i) => {
          const p = slideUp(frame, fps, delay);
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 24,
              opacity: p,
              transform: `translateX(${interpolate(p, [0, 1], [60, 0])}px)`,
            }}>
              <div style={{
                width: 50, height: 50, borderRadius: 25,
                background: `${color}22`, border: `2px solid ${color}`,
                display: "flex", justifyContent: "center", alignItems: "center",
                fontSize: 20, fontWeight: 700, color,
                fontFamily: "SF Mono, monospace",
                flexShrink: 0, zIndex: 1,
              }}>
                {i + 1}
              </div>
              <div style={{
                background: BG_CARD, borderRadius: 12, padding: "16px 28px",
                border: `1px solid ${color}33`, flex: 1,
              }}>
                <div style={{
                  fontSize: 22, fontWeight: 600, color,
                  fontFamily: "SF Pro Display, -apple-system, sans-serif",
                  marginBottom: 4,
                }}>
                  {label}
                </div>
                <div style={{
                  fontSize: 18, color: LIGHT_GRAY,
                  fontFamily: "SF Pro Text, -apple-system, sans-serif",
                }}>
                  {desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Entities at right */}
      <div style={{
        position: "absolute", right: 100, top: 160, display: "flex",
        flexDirection: "column", gap: 24,
        opacity: slideUp(frame, fps, 30),
      }}>
        {[
          { name: "Browser + Wallet", icon: "🌐" },
          { name: "Next.js Server", icon: "⚡" },
          { name: "x402 Facilitator", icon: "🔐" },
          { name: "Stacks Blockchain", icon: "⛓️" },
        ].map(({ name, icon }) => (
          <div key={name} style={{
            background: BG_CARD, borderRadius: 12, padding: "12px 20px",
            border: `1px solid ${GRAY}33`,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{ fontSize: 24 }}>{icon}</div>
            <div style={{
              fontSize: 16, color: LIGHT_GRAY,
              fontFamily: "SF Pro Text, -apple-system, sans-serif",
            }}>
              {name}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/* ════════════════════════════════════════════════════════════
   Scene 5 — Canon Voting
   ════════════════════════════════════════════════════════════ */
const CanonScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleP = slideUp(frame, fps, 0);

  // Animated funding bars
  const branches = [
    { name: "Burn-Key Freedom", funding: 300, isCanon: true, color: BLUE },
    { name: "Sovereign Takeover", funding: 150, isCanon: false, color: GRAY },
  ];

  // After frame 120, swap Canon
  const swapped = frame > 120;
  const displayBranches = swapped
    ? [
        { name: "Burn-Key Freedom", funding: 300, isCanon: false, color: GRAY },
        { name: "Sovereign Takeover", funding: 350, isCanon: true, color: BLUE },
      ]
    : branches;

  return (
    <AbsoluteFill style={{ background: BG, padding: "60px 100px" }}>
      <div style={{
        fontSize: 14, fontWeight: 600, color: BLUE, letterSpacing: 2,
        textTransform: "uppercase", marginBottom: 8,
        fontFamily: "SF Pro Text, -apple-system, sans-serif",
        opacity: titleP,
      }}>
        Dynamic Canon
      </div>
      <div style={{
        fontSize: 44, fontWeight: 700, color: WHITE, marginBottom: 20,
        fontFamily: "SF Pro Display, -apple-system, sans-serif",
        opacity: titleP,
      }}>
        Readers Vote → Canon Shifts
      </div>
      <div style={{
        fontSize: 22, color: LIGHT_GRAY, marginBottom: 60,
        fontFamily: "SF Pro Text, -apple-system, sans-serif",
        opacity: slideUp(frame, fps, 10),
      }}>
        The highest-funded branch becomes the official storyline.
        <br />Canon can change at any time with a single vote.
      </div>

      {/* Parent node */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 40,
      }}>
        <div style={{
          background: BG_CARD, borderRadius: 16, padding: "20px 40px",
          border: `1px solid ${GRAY}33`,
          opacity: slideUp(frame, fps, 20),
        }}>
          <div style={{ fontSize: 24, fontWeight: 600, color: WHITE, fontFamily: "SF Pro Display, sans-serif" }}>
            Chapter 1: Eve of Quantum Collapse
          </div>
          <div style={{ fontSize: 16, color: GRAY, fontFamily: "SF Pro Text, sans-serif", marginTop: 4 }}>
            Root branch (free) — D0
          </div>
        </div>

        {/* Connector lines */}
        <div style={{ display: "flex", gap: 120, alignItems: "flex-start" }}>
          {displayBranches.map(({ name, funding, isCanon, color }, i) => {
            const p = slideUp(frame, fps, 40 + i * 15);
            const fundWidth = interpolate(
              frame,
              [40 + i * 15, 80 + i * 15],
              [0, funding / 3.5],
              { extrapolateRight: "clamp" }
            );

            // Animate the swap
            const swapP = swapped ? slideUp(frame, fps, 125) : 0;

            return (
              <div key={i} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                opacity: p,
                transform: `translateY(${interpolate(p, [0, 1], [30, 0])}px)`,
              }}>
                <div style={{
                  width: 2, height: 40,
                  background: isCanon ? BLUE : `${GRAY}44`,
                }} />
                <div style={{
                  background: BG_CARD, borderRadius: 16, padding: "24px 32px",
                  border: `2px solid ${isCanon ? BLUE : `${GRAY}33`}`,
                  width: 380,
                  transition: "border-color 0.3s",
                }}>
                  {isCanon && (
                    <div style={{
                      fontSize: 12, fontWeight: 700, color: BLUE,
                      textTransform: "uppercase", letterSpacing: 2, marginBottom: 8,
                      fontFamily: "SF Pro Text, sans-serif",
                    }}>
                      ● CANON
                    </div>
                  )}
                  {!isCanon && (
                    <div style={{
                      fontSize: 12, fontWeight: 600, color: GRAY,
                      textTransform: "uppercase", letterSpacing: 2, marginBottom: 8,
                      fontFamily: "SF Pro Text, sans-serif",
                    }}>
                      ○ Alternative
                    </div>
                  )}
                  <div style={{
                    fontSize: 20, fontWeight: 600, color: WHITE,
                    fontFamily: "SF Pro Display, sans-serif", marginBottom: 12,
                  }}>
                    {name}
                  </div>
                  <div style={{
                    height: 8, borderRadius: 4,
                    background: `${GRAY}22`, overflow: "hidden",
                    marginBottom: 8,
                  }}>
                    <div style={{
                      height: "100%", borderRadius: 4,
                      background: isCanon
                        ? `linear-gradient(90deg, ${BLUE}, ${BLUE}cc)`
                        : `linear-gradient(90deg, ${GRAY}88, ${GRAY}44)`,
                      width: `${fundWidth}%`,
                    }} />
                  </div>
                  <div style={{
                    fontSize: 16, color: isCanon ? BLUE : GRAY,
                    fontFamily: "SF Mono, monospace",
                  }}>
                    {funding} uSTX
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Vote event */}
        {swapped && (
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            opacity: slideUp(frame, fps, 130),
            transform: `translateY(${interpolate(slideUp(frame, fps, 130), [0, 1], [20, 0])}px)`,
          }}>
            <div style={{
              fontSize: 20, color: GREEN,
              fontFamily: "SF Pro Text, sans-serif",
            }}>
              ✦ New vote received → Canon shifted to "Sovereign Takeover"
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/* ════════════════════════════════════════════════════════════
   Scene 6 — AI Agent
   ════════════════════════════════════════════════════════════ */
const AIAgentScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleP = slideUp(frame, fps, 0);

  const steps = [
    { label: "Fetch", desc: "Get active stories & branch tree", icon: "📡", delay: 20 },
    { label: "Analyze", desc: "Find leaf nodes, trace Canon path", icon: "🔍", delay: 45 },
    { label: "Generate", desc: "LLM creates 2 opposing continuations", icon: "✍️", delay: 70 },
    { label: "Publish", desc: "POST new branches to API", icon: "📤", delay: 95 },
    { label: "Sleep", desc: "Wait 10 minutes, then repeat", icon: "⏱️", delay: 120 },
  ];

  return (
    <AbsoluteFill style={{ background: BG, padding: "60px 100px" }}>
      <div style={{
        fontSize: 14, fontWeight: 600, color: GREEN, letterSpacing: 2,
        textTransform: "uppercase", marginBottom: 8,
        fontFamily: "SF Pro Text, -apple-system, sans-serif",
        opacity: titleP,
      }}>
        Autonomous AI
      </div>
      <div style={{
        fontSize: 44, fontWeight: 700, color: WHITE, marginBottom: 16,
        fontFamily: "SF Pro Display, -apple-system, sans-serif",
        opacity: titleP,
      }}>
        OpenClaw — The Story Never Stops
      </div>
      <div style={{
        fontSize: 22, color: LIGHT_GRAY, marginBottom: 50,
        fontFamily: "SF Pro Text, sans-serif",
        opacity: slideUp(frame, fps, 10),
      }}>
        An autonomous AI agent generates bilingual story branches
        <br />with ideological contrast — every 10 minutes.
      </div>

      {/* Circular flow */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
        {steps.map(({ label, desc, icon, delay }, i) => {
          const p = slideUp(frame, fps, delay);
          return (
            <React.Fragment key={i}>
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                opacity: p,
                transform: `translateY(${interpolate(p, [0, 1], [40, 0])}px)`,
              }}>
                <div style={{
                  width: 80, height: 80, borderRadius: 40,
                  background: `${GREEN}15`, border: `2px solid ${GREEN}44`,
                  display: "flex", justifyContent: "center", alignItems: "center",
                  fontSize: 36,
                }}>
                  {icon}
                </div>
                <div style={{
                  fontSize: 20, fontWeight: 600, color: WHITE,
                  fontFamily: "SF Pro Display, sans-serif",
                }}>
                  {label}
                </div>
                <div style={{
                  fontSize: 15, color: LIGHT_GRAY, textAlign: "center",
                  fontFamily: "SF Pro Text, sans-serif",
                  maxWidth: 180,
                }}>
                  {desc}
                </div>
              </div>
              {i < steps.length - 1 && (
                <div style={{
                  display: "flex", alignItems: "center",
                  fontSize: 28, color: `${GREEN}66`,
                  opacity: p,
                  paddingTop: 20,
                }}>
                  →
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Features */}
      <div style={{
        display: "flex", gap: 30, marginTop: 60, justifyContent: "center",
        opacity: slideUp(frame, fps, 140),
      }}>
        {[
          "Bilingual (ZH/EN)",
          "Burn-Key Freedom vs Sovereign Takeover",
          "Paid-vote gate",
        ].map((feature) => (
          <div key={feature} style={{
            padding: "10px 24px", borderRadius: 24,
            background: `${GREEN}15`, border: `1px solid ${GREEN}33`,
            fontSize: 16, color: GREEN,
            fontFamily: "SF Pro Text, sans-serif",
          }}>
            {feature}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/* ════════════════════════════════════════════════════════════
   Scene 7 — Tech Stack
   ════════════════════════════════════════════════════════════ */
const TechStackScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleP = slideUp(frame, fps, 0);

  const stack = [
    { layer: "Frontend", tech: "Next.js 15 · React 19 · Tailwind CSS 4", color: BLUE, delay: 20 },
    { layer: "Backend", tech: "Next.js API Routes · Prisma 6.3", color: BLUE, delay: 35 },
    { layer: "Database", tech: "PostgreSQL 16", color: ORANGE, delay: 50 },
    { layer: "Blockchain", tech: "Stacks (STX) · @stacks/connect", color: ORANGE, delay: 65 },
    { layer: "Payments", tech: "x402-stacks · HTTP 402 Protocol", color: GREEN, delay: 80 },
    { layer: "AI Agent", tech: "OpenClaw · OpenAI-compatible LLM", color: GREEN, delay: 95 },
    { layer: "Deploy", tech: "Docker Compose (app + db + agent)", color: GRAY, delay: 110 },
  ];

  return (
    <AbsoluteFill style={{ background: BG, padding: "60px 100px" }}>
      <div style={{
        fontSize: 14, fontWeight: 600, color: ORANGE, letterSpacing: 2,
        textTransform: "uppercase", marginBottom: 8,
        fontFamily: "SF Pro Text, sans-serif",
        opacity: titleP,
      }}>
        Architecture
      </div>
      <div style={{
        fontSize: 44, fontWeight: 700, color: WHITE, marginBottom: 50,
        fontFamily: "SF Pro Display, sans-serif",
        opacity: titleP,
      }}>
        Tech Stack
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {stack.map(({ layer, tech, color, delay }, i) => {
          const p = slideUp(frame, fps, delay);
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 24,
              opacity: p,
              transform: `translateX(${interpolate(p, [0, 1], [80, 0])}px)`,
            }}>
              <div style={{
                width: 140, fontSize: 16, fontWeight: 600, color,
                fontFamily: "SF Pro Text, sans-serif",
                textAlign: "right",
              }}>
                {layer}
              </div>
              <div style={{
                width: 3, height: 44, borderRadius: 2,
                background: `${color}66`,
              }} />
              <div style={{
                background: BG_CARD, borderRadius: 12, padding: "14px 28px",
                border: `1px solid ${color}22`, flex: 1,
              }}>
                <div style={{
                  fontSize: 22, color: WHITE,
                  fontFamily: "SF Pro Text, sans-serif",
                }}>
                  {tech}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ════════════════════════════════════════════════════════════
   Scene 8 — Outro
   ════════════════════════════════════════════════════════════ */
const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleP = slideUp(frame, fps, 5);
  const linkP = slideUp(frame, fps, 25);
  const tagP = slideUp(frame, fps, 45);

  return (
    <AbsoluteFill style={{
      background: `radial-gradient(ellipse at 50% 50%, #1a1a2e 0%, ${BG} 70%)`,
      justifyContent: "center", alignItems: "center",
    }}>
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 32,
      }}>
        <div style={{
          fontSize: 80, fontWeight: 800, color: WHITE,
          fontFamily: "SF Pro Display, sans-serif",
          letterSpacing: -2,
          opacity: titleP,
          transform: `translateY(${interpolate(titleP, [0, 1], [30, 0])}px)`,
        }}>
          Story-Fork
        </div>

        <div style={{
          fontSize: 28, color: BLUE,
          fontFamily: "SF Pro Display, sans-serif",
          opacity: linkP,
        }}>
          Pay to Vote the Narrative
        </div>

        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
          opacity: linkP,
          marginTop: 20,
        }}>
          <div style={{
            fontSize: 22, color: WHITE,
            fontFamily: "SF Mono, monospace",
            padding: "12px 32px", borderRadius: 12,
            background: `${BLUE}22`, border: `1px solid ${BLUE}44`,
          }}>
            https://story.easyweb3.tools
          </div>
          <div style={{
            fontSize: 18, color: GRAY,
            fontFamily: "SF Pro Text, sans-serif",
          }}>
            Live Demo — Try it now
          </div>
        </div>

        <div style={{
          display: "flex", gap: 16, marginTop: 30,
          opacity: tagP,
        }}>
          {["x402-stacks", "Stacks", "HTTP 402", "AI Agent", "Open Source"].map((tag) => (
            <div key={tag} style={{
              padding: "8px 20px", borderRadius: 20,
              border: `1px solid ${GRAY}66`, color: LIGHT_GRAY,
              fontSize: 16, fontFamily: "SF Pro Text, sans-serif",
            }}>
              {tag}
            </div>
          ))}
        </div>

        <div style={{
          fontSize: 18, color: GRAY, marginTop: 40,
          fontFamily: "SF Pro Text, sans-serif",
          opacity: tagP,
        }}>
          Built for the x402 Stacks Challenge · February 2026
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ── Transition component (avoids hooks in .map) ── */
const FadeToBlack: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: BG, opacity: fadeIn(frame, 0, 15) }} />
  );
};

/* ════════════════════════════════════════════════════════════
   Main Composition — ~3:10 @ 30fps = 5700 frames
   Scenes layout (frame / seconds):
     0-210     (0-7s)    Title
     210-510   (7-17s)   Concept
     510-780   (17-26s)  Homepage EN
     780-1080  (26-36s)  Story Detail EN
     1080-1320 (36-44s)  Homepage ZH
     1320-1590 (44-53s)  Story Detail ZH
     1590-2160 (53-72s)  x402 Flow Diagram
     2160-2400 (72-80s)  Wallet Connect
     2400-2640 (80-88s)  Wallet Approve
     2640-2880 (88-96s)  Sign Transaction
     2880-3120 (96-104s) On-chain Confirmation
     3120-3660 (104-122s) Canon Voting
     3660-4200 (122-140s) AI Agent
     4200-4740 (140-158s) Tech Stack
     4740-5160 (158-172s) Outro
   ════════════════════════════════════════════════════════════ */
export const StoryForkDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: BG }}>
      {/* Background music */}
      <Audio
        src={staticFile("screenshots/paulyudin-tech-corporate-background-310305.mp3")}
        volume={0.5}
      />
      {/* Scene 1: Title (0-7s) */}
      <Sequence from={0} durationInFrames={210}>
        <TitleScene />
      </Sequence>

      {/* Scene 2: Concept (7-17s) */}
      <Sequence from={210} durationInFrames={300}>
        <ConceptScene />
      </Sequence>

      {/* Scene 3: Homepage EN (17-26s) */}
      <Sequence from={510} durationInFrames={270}>
        <ScreenshotScene
          src="screenshots/homepage-en.png"
          title="Browse Stories"
          subtitle="Homepage"
        />
      </Sequence>

      {/* Scene 4: Story Detail EN (26-36s) */}
      <Sequence from={780} durationInFrames={300}>
        <ScreenshotScene
          src="screenshots/story-detail-en.png"
          title="Explore the Branch Tree"
          subtitle="Story Detail"
        />
      </Sequence>

      {/* Scene 5: Homepage ZH (36-44s) */}
      <Sequence from={1080} durationInFrames={240}>
        <ScreenshotScene
          src="screenshots/homepage.png"
          title="Bilingual — Chinese Interface"
          subtitle="中文界面"
        />
      </Sequence>

      {/* Scene 6: Story Detail ZH (44-53s) */}
      <Sequence from={1320} durationInFrames={270}>
        <ScreenshotScene
          src="screenshots/story-detail.png"
          title="Branch Tree — Chinese"
          subtitle="分支树"
        />
      </Sequence>

      {/* Scene 7: x402 Payment Flow Diagram (53-72s) */}
      <Sequence from={1590} durationInFrames={570}>
        <PaymentFlowScene />
      </Sequence>

      {/* Scene 8: Wallet Connect (72-80s) */}
      <Sequence from={2160} durationInFrames={240}>
        <ScreenshotScene
          src="screenshots/wallet-connect.png"
          title="Connect Stacks Wallet"
          subtitle="Step 1 — Wallet"
        />
      </Sequence>

      {/* Scene 9: Wallet Approve (80-88s) */}
      <Sequence from={2400} durationInFrames={240}>
        <ScreenshotScene
          src="screenshots/vote-pay-1.png"
          title="Approve Connection"
          subtitle="Step 2 — Authorize"
        />
      </Sequence>

      {/* Scene 10: Sign Transaction (88-96s) */}
      <Sequence from={2640} durationInFrames={240}>
        <ScreenshotScene
          src="screenshots/vote-pay-2.png"
          title="Sign STX Payment"
          subtitle="Step 3 — Pay & Vote"
        />
      </Sequence>

      {/* Scene 11: On-chain Tx (96-104s) */}
      <Sequence from={2880} durationInFrames={240}>
        <ScreenshotScene
          src="screenshots/tx-on-chain.png"
          title="Confirmed On-chain"
          subtitle="Step 4 — Verified"
        />
      </Sequence>

      {/* Scene 12: Canon Voting (104-122s) */}
      <Sequence from={3120} durationInFrames={540}>
        <CanonScene />
      </Sequence>

      {/* Scene 13: AI Agent (122-140s) */}
      <Sequence from={3660} durationInFrames={540}>
        <AIAgentScene />
      </Sequence>

      {/* Scene 14: Tech Stack (140-158s) */}
      <Sequence from={4200} durationInFrames={540}>
        <TechStackScene />
      </Sequence>

      {/* Scene 15: Outro (158-172s) */}
      <Sequence from={4740} durationInFrames={420}>
        <OutroScene />
      </Sequence>

      {/* Scene transitions - fade to black between scenes */}
      {[210, 510, 780, 1080, 1320, 1590, 2160, 2400, 2640, 2880, 3120, 3660, 4200, 4740].map(
        (start) => (
          <Sequence key={start} from={start - 15} durationInFrames={15}>
            <FadeToBlack />
          </Sequence>
        )
      )}
    </AbsoluteFill>
  );
};
