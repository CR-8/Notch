import { AbsoluteFill, Sequence, useCurrentFrame, spring, interpolate } from 'remotion';

const C = {
  bg: '#1d1d1f',
  surface: '#252527',
  primary: '#0a84ff',
  text: '#f5f5f7',
  muted: '#a1a1a6',
  hairline: '#3a3a3c',
  success: '#30d158',
};

function FadeIn({
  children,
  startAt = 0,
  duration = 30,
}: {
  children: React.ReactNode;
  startAt?: number;
  duration?: number;
}) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - startAt, [0, duration], [0, 1], { extrapolateLeft: 'clamp' });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

function Scene1_Welcome() {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.bg,
        padding: 60,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <FadeIn>
        <div
          style={{
            width: 70,
            height: 70,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #0a84ff, #0066cc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 28,
            boxShadow: '0 8px 24px rgba(10,132,255,0.25)',
          }}
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
        </div>
        <h1
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 48,
            fontWeight: 700,
            color: C.text,
            textAlign: 'center',
            lineHeight: 1.1,
            letterSpacing: '-0.033em',
            marginBottom: 16,
            maxWidth: 600,
          }}
        >
          Your AI-powered
          <br />
          second brain
        </h1>
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 18,
            color: C.muted,
            textAlign: 'center',
            maxWidth: 440,
          }}
        >
          Capture, structure, and interrogate everything you read.
        </p>
      </FadeIn>
    </AbsoluteFill>
  );
}

function Scene2_Capabilities() {
  const items = [
    { label: 'Websites', desc: 'Full page capture' },
    { label: 'PDFs', desc: 'Document parsing' },
    { label: 'YouTube', desc: 'Transcripts & summaries' },
    { label: 'Research', desc: 'Academic extraction' },
    { label: 'Notes', desc: 'Quick capture' },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.bg,
        padding: 60,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <FadeIn>
        <h2
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 34,
            fontWeight: 700,
            color: C.text,
            marginBottom: 36,
            letterSpacing: '-0.02em',
          }}
        >
          What Notch captures
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 400 }}>
          {items.map((item, i) => {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const frame = useCurrentFrame();
            const y = spring({
              frame: Math.max(0, frame - 25 - i * 8),
              fps: 30,
              config: { damping: 18, stiffness: 100 },
            });
            return (
              <div
                key={item.label}
                style={{
                  padding: '14px 20px',
                  borderRadius: 12,
                  border: '1px solid ' + C.hairline,
                  backgroundColor: C.surface,
                  opacity: y,
                  transform: `translateY(${(1 - y) * 16}px)`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 15,
                    fontWeight: 600,
                    color: C.text,
                  }}
                >
                  {item.label}
                </span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: C.muted }}>
                  {item.desc}
                </span>
              </div>
            );
          })}
        </div>
      </FadeIn>
    </AbsoluteFill>
  );
}

function Scene3_Workflow() {
  const steps = [
    { title: '1. Capture', desc: 'Click the Notch icon on any page' },
    { title: '2. Process', desc: 'AI extracts and structures the content' },
    { title: '3. Organise', desc: 'Everything is indexed in your local library' },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.bg,
        padding: 60,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <FadeIn>
        <h2
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 34,
            fontWeight: 700,
            color: C.text,
            marginBottom: 36,
            letterSpacing: '-0.02em',
          }}
        >
          How it works
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 380 }}>
          {steps.map((step, i) => {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const frame = useCurrentFrame();
            const x = spring({
              frame: Math.max(0, frame - 30 - i * 12),
              fps: 30,
              config: { damping: 16, stiffness: 90 },
            });
            return (
              <div
                key={step.title}
                style={{
                  padding: '16px 20px',
                  borderRadius: 12,
                  border: '1px solid ' + C.hairline,
                  backgroundColor: C.surface,
                  opacity: x,
                  transform: `translateX(${(1 - x) * 20}px)`,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: C.primary + '20',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                    fontWeight: 700,
                    color: C.primary,
                  }}
                >
                  {i + 1}
                </div>
                <div>
                  <p
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 15,
                      fontWeight: 600,
                      color: C.text,
                      margin: 0,
                    }}
                  >
                    {step.title}
                  </p>
                  <p
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 13,
                      color: C.muted,
                      margin: 0,
                    }}
                  >
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </FadeIn>
    </AbsoluteFill>
  );
}

function Scene4_Capture() {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.bg,
        padding: 60,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <FadeIn>
        <h2
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 34,
            fontWeight: 700,
            color: C.text,
            marginBottom: 28,
            letterSpacing: '-0.02em',
          }}
        >
          Capture your first page
        </h2>
        <div
          style={{
            padding: 28,
            borderRadius: 20,
            border: '1px solid ' + C.hairline,
            backgroundColor: C.surface,
            maxWidth: 400,
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: C.primary + '15',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke={C.primary}
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20" />
                <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
              </svg>
            </div>
            <div>
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 14,
                  fontWeight: 600,
                  color: C.text,
                  margin: 0,
                }}
              >
                Getting Started with AI
              </p>
              <p
                style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: C.muted, margin: 0 }}
              >
                example.com
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <div
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 8,
                backgroundColor: C.bg,
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 16,
                  fontWeight: 700,
                  color: C.text,
                  margin: 0,
                }}
              >
                ~1.2K
              </p>
              <p
                style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: C.muted, margin: 0 }}
              >
                WORDS
              </p>
            </div>
            <div
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 8,
                backgroundColor: C.bg,
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 16,
                  fontWeight: 700,
                  color: C.text,
                  margin: 0,
                }}
              >
                ~4 min
              </p>
              <p
                style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: C.muted, margin: 0 }}
              >
                READ
              </p>
            </div>
          </div>
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              backgroundColor: C.primary,
              textAlign: 'center',
            }}
          >
            <span
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 14,
                fontWeight: 600,
                color: 'white',
              }}
            >
              Capture this page
            </span>
          </div>
        </div>
      </FadeIn>
    </AbsoluteFill>
  );
}

function Scene5_Processing() {
  const steps = [
    'Reading page content',
    'Extracting key information',
    'Identifying concepts',
    'Generating summary',
    'Creating flashcards',
    'Building knowledge graph',
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.bg,
        padding: 60,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <FadeIn>
        <h2
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 34,
            fontWeight: 700,
            color: C.text,
            marginBottom: 36,
            letterSpacing: '-0.02em',
          }}
        >
          Processing your capture
        </h2>
        <div style={{ maxWidth: 340, width: '100%' }}>
          {steps.map((step, i) => {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const frame = useCurrentFrame();
            const showAt = 20 + i * 15;
            const visible = frame >= showAt;
            const opacity = interpolate(frame - showAt, [0, 12], [0, 1], {
              extrapolateLeft: 'clamp',
            });
            return (
              <div
                key={step}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 14px',
                  borderRadius: 10,
                  marginBottom: 4,
                  backgroundColor: visible ? C.surface + 'cc' : 'transparent',
                  border: visible ? '1px solid ' + C.hairline : '1px solid transparent',
                  opacity,
                  transition: 'all 0.15s',
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    border: '2px solid ' + (frame > showAt + 8 ? C.success : C.primary + '60'),
                    backgroundColor: frame > showAt + 8 ? C.success + '30' : 'transparent',
                  }}
                />
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                    color: C.text,
                    fontWeight: frame > showAt + 8 ? 500 : 400,
                  }}
                >
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </FadeIn>
    </AbsoluteFill>
  );
}

function Scene6_Success() {
  const frame = useCurrentFrame();
  const scale = spring({
    frame: Math.max(0, frame - 15),
    fps: 30,
    config: { damping: 10, stiffness: 90 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.bg,
        padding: 60,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <FadeIn startAt={15}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: 'linear-gradient(135deg, #30d158, #2a9d99)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 28,
            boxShadow: '0 8px 24px rgba(48,209,88,0.25)',
            transform: `scale(${scale})`,
          }}
        >
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h1
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 40,
            fontWeight: 700,
            color: C.text,
            textAlign: 'center',
            lineHeight: 1.1,
            letterSpacing: '-0.025em',
            marginBottom: 10,
          }}
        >
          You're ready
        </h1>
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 17,
            color: C.muted,
            textAlign: 'center',
            maxWidth: 400,
            marginBottom: 36,
          }}
        >
          Notch is set up and ready to organise your knowledge.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          {['Open library', 'Open reader'].map((label, i) => (
            <div
              key={label}
              style={{
                padding: '11px 22px',
                borderRadius: 12,
                backgroundColor: i === 0 ? C.primary : 'transparent',
                border: i === 0 ? 'none' : '1px solid ' + C.hairline,
                fontFamily: 'Inter, sans-serif',
                fontSize: 14,
                fontWeight: 600,
                color: i === 0 ? 'white' : C.text,
                opacity: spring({ frame: Math.max(0, frame - 40 - i * 5), fps: 30 }),
                transform: `scale(${spring({ frame: Math.max(0, frame - 40 - i * 5), fps: 30 })})`,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </FadeIn>
    </AbsoluteFill>
  );
}

export function OnboardingVideo() {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Sequence from={0} durationInFrames={90}>
        <Scene1_Welcome />
      </Sequence>
      <Sequence from={90} durationInFrames={90}>
        <Scene2_Capabilities />
      </Sequence>
      <Sequence from={180} durationInFrames={90}>
        <Scene3_Workflow />
      </Sequence>
      <Sequence from={270} durationInFrames={100}>
        <Scene4_Capture />
      </Sequence>
      <Sequence from={370} durationInFrames={140}>
        <Scene5_Processing />
      </Sequence>
      <Sequence from={510} durationInFrames={90}>
        <Scene6_Success />
      </Sequence>
    </AbsoluteFill>
  );
}
