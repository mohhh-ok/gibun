import { Gibun } from "gibun";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import "./ChimeraPage.css";
import { computeLineTokenCounts, computeTextMetrics } from "./metrics";
import type { TextMetrics } from "./metrics";
import { chimeraTemplates } from "./templates";
import { cancelSpeech, speakText, useJapaneseVoices } from "./tts";

const emptyMetrics: TextMetrics = { charCount: 0, tokenCount: 0, uniqueTokenCount: 0 };

const seriousSamples: { label: string; text: string }[] = [
  {
    label: "議事録",
    text: "本日の定例会議を開催いたしました。出席者は開発部の田中、佐藤、および企画部の山田の三名でございます。第三四半期の売上は前年同期比で十二パーセント増加し、目標を上回る結果となりました。次回会議は来週水曜日十五時から会議室Aにて開催予定です。以上、ご確認のほどよろしくお願いいたします。",
  },
  {
    label: "ニュース",
    text: "政府は本日、経済対策の一環として新たな補助金制度の導入を発表した。対象となるのは中小企業および個人事業主で、申請期限は年度末までとなっている。関係省庁は詳細な運用ガイドラインを来週中に公表する方針である。専門家は制度の実効性について慎重な見方を示している。",
  },
  {
    label: "契約書",
    text: "甲および乙は、本契約の締結に際し、以下の条項を遵守するものとする。第一条において、甲は乙に対し月額金三十万円の報酬を支払うものとする。第二条において、業務の内容および範囲は別紙仕様書に定めるとおりとする。契約の有効期間は締結日より一年間とし、双方の書面による合意がない限り自動更新されるものとする。",
  },
];

function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function useDebouncedMetrics(text: string, delayMs: number) {
  const [metrics, setMetrics] = useState<TextMetrics>(emptyMetrics);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      computeTextMetrics(text).then((result) => {
        if (requestId === requestIdRef.current) {
          setMetrics(result);
        }
      });
    }, delayMs);
    return () => clearTimeout(timer);
  }, [text, delayMs]);

  return metrics;
}

export function ChimeraPage() {
  const [templateId, setTemplateId] = useState(chimeraTemplates[0].id);
  const template = chimeraTemplates.find((t) => t.id === templateId) ?? chimeraTemplates[0];

  const [prettyText, setPrettyText] = useState(template.prettyCorpus.join("\n"));
  const [seriousText, setSeriousText] = useState("");

  const [minLength, setMinLength] = useState(200);
  const [maxLength, setMaxLength] = useState(300);
  const [generationCount, setGenerationCount] = useState(3);
  const [buriRatio, setBuriRatio] = useState(3.0);

  const [results, setResults] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const playAllCancelRef = useRef(false);
  const jaVoices = useJapaneseVoices();

  // テンプレ選択時にのみ再計算する重い処理（キー入力ごとの再tokenizeを避けるため）
  const [prettyLineTokenCounts, setPrettyLineTokenCounts] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    computeLineTokenCounts(template.prettyCorpus).then((counts) => {
      if (!cancelled) setPrettyLineTokenCounts(counts);
    });
    return () => {
      cancelled = true;
    };
  }, [template.prettyCorpus]);

  const prettyMetrics = useDebouncedMetrics(prettyText, 300);
  const seriousMetrics = useDebouncedMetrics(seriousText, 300);

  const stopSpeech = () => {
    cancelSpeech();
    playAllCancelRef.current = true;
    setPlayingIndex(null);
    setIsPlayingAll(false);
  };

  const handleSelectTemplate = (id: string) => {
    const next = chimeraTemplates.find((t) => t.id === id);
    if (!next) return;
    stopSpeech();
    setTemplateId(id);
    setPrettyText(next.prettyCorpus.join("\n"));
    setResults([]);
  };

  const handlePrettyChange = (value: string) => {
    setPrettyText(value);
    setResults([]);
  };

  const handleSeriousChange = (value: string) => {
    setSeriousText(value);
    setResults([]);
  };

  const handleGenerate = async () => {
    const prettyLines = splitLines(prettyText);
    const seriousLines = splitLines(seriousText);
    if (seriousLines.length === 0) {
      alert("真面目文コーパスを入力してください");
      return;
    }
    stopSpeech();
    setIsGenerating(true);
    setResults([]);
    try {
      const gibun = new Gibun();

      let trainedPrettyLines = prettyLines;
      if (seriousText.trim().length > 0) {
        const seriousTokens = (await computeTextMetrics(seriousText)).tokenCount;
        const targetPrettyTokens = buriRatio * seriousTokens;
        const selected: string[] = [];
        let accumulated = 0;
        for (let i = 0; i < prettyLines.length; i++) {
          const lineTokens =
            prettyLineTokenCounts[i] ?? (await computeTextMetrics(prettyLines[i])).tokenCount;
          selected.push(prettyLines[i]);
          accumulated += lineTokens;
          if (accumulated >= targetPrettyTokens) break;
        }
        trainedPrettyLines = selected;
      }

      await gibun.train(trainedPrettyLines);
      await gibun.train(seriousLines);
      const generated: string[] = [];
      for (let i = 0; i < generationCount; i++) {
        generated.push(gibun.generate({ minLength, maxLength: maxLength || undefined }));
      }
      setResults(generated);
    } catch (error) {
      console.error("生成エラー:", error);
      alert("文章の生成に失敗しました");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleSpeak = (index: number) => {
    if (playingIndex === index) {
      stopSpeech();
      return;
    }
    cancelSpeech();
    playAllCancelRef.current = true;
    setIsPlayingAll(false);
    setPlayingIndex(index);
    speakText(results[index], template.theme.voice, jaVoices, () => {
      setPlayingIndex((current) => (current === index ? null : current));
    });
  };

  const handlePlayAll = async () => {
    if (isPlayingAll) {
      stopSpeech();
      return;
    }
    playAllCancelRef.current = false;
    setIsPlayingAll(true);
    for (let i = 0; i < results.length; i++) {
      if (playAllCancelRef.current) break;
      setPlayingIndex(i);
      await new Promise<void>((resolve) => {
        speakText(results[i], template.theme.voice, jaVoices, () => resolve());
      });
      if (playAllCancelRef.current) break;
    }
    setIsPlayingAll(false);
    setPlayingIndex(null);
  };

  const themeVars = {
    "--chimera-bg": template.theme.bg,
    "--chimera-surface": template.theme.surface,
    "--chimera-text": template.theme.text,
    "--chimera-accent": template.theme.accent,
    "--chimera-accent-text": template.theme.accentText,
    "--chimera-font-heading": template.theme.fontHeading,
    "--chimera-font-body": template.theme.fontBody,
    "--chimera-radius": template.theme.radius,
    "--chimera-shadow": template.theme.shadow,
  } as CSSProperties;

  return (
    <div className="chimera-page" data-theme={template.id} style={themeVars}>
      <header className="chimera-header">
        <h1>🧬 キメラ生成</h1>
        <p className="chimera-subtitle">{template.description}</p>
        <div className="chimera-decoration">{template.theme.decoration}</div>
      </header>

      <main className="chimera-main">
        <section className="chimera-section chimera-intro">
          <p>
            真面目な文章と個性的な文体を混ぜて、マルコフ連鎖で新しい文章を作ります。
            議事録やニュース記事に「〜だにょ♡」「〜でござる」みたいな語尾が接続されて、意味不明な化学反応が起きます。
          </p>
          <ol>
            <li><strong>テンプレートを選ぶ</strong> — ぷりてぃー側のコーパスと見た目が切り替わります。</li>
            <li><strong>真面目文コーパス</strong>に文章を貼る（サンプルボタンで簡単挿入も可）。</li>
            <li><strong>ぶり比率</strong>で、真面目文の何倍のぷりてぃー文を混ぜるかを調整。</li>
            <li><strong>生成</strong>ボタンを押して、🔊 でテンプレごとの声色で読み上げも。</li>
          </ol>
          <p className="chimera-intro-note">
            すべてブラウザ内で完結（マルコフ連鎖 + 形態素解析 + Web Speech API）。
            外部 API は使いません。生成文は語彙と遷移確率の統計処理なので、意味のある文にはなりません。
          </p>
        </section>

        <section className="chimera-section chimera-template-select">
          <h2>テンプレート選択</h2>
          <div className="chimera-template-grid">
            {chimeraTemplates.map((t) => (
              <button
                key={t.id}
                className={`chimera-template-card ${t.id === templateId ? "active" : ""}`}
                onClick={() => handleSelectTemplate(t.id)}
              >
                <div className="chimera-template-label">{t.label}</div>
                <div className="chimera-template-description">{t.description}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="chimera-section chimera-corpus-section">
          <div className="chimera-corpus-columns">
            <div className="chimera-corpus-column">
              <h2>ぷりてぃー側コーパス</h2>
              <textarea
                className="chimera-textarea"
                value={prettyText}
                onChange={(e) => handlePrettyChange(e.target.value)}
                rows={10}
              />
              <div className="chimera-metrics">
                文字数: {prettyMetrics.charCount} / トークン数: {prettyMetrics.tokenCount} / ユニーク名詞数:{" "}
                {prettyMetrics.uniqueTokenCount}
              </div>
            </div>
            <div className="chimera-corpus-column">
              <h2>真面目文コーパス</h2>
              <div className="chimera-sample-buttons">
                <span className="chimera-sample-label">サンプル挿入:</span>
                {seriousSamples.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    className="chimera-sample-button"
                    onClick={() => handleSeriousChange(sample.text)}
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
              <textarea
                className="chimera-textarea"
                value={seriousText}
                onChange={(e) => handleSeriousChange(e.target.value)}
                placeholder="例: 議事録・報告書・ニュース記事など、あなたの持っている真面目な文章をここに貼り付けてください"
                rows={10}
              />
              <div className="chimera-metrics">
                文字数: {seriousMetrics.charCount} / トークン数: {seriousMetrics.tokenCount} / ユニーク名詞数:{" "}
                {seriousMetrics.uniqueTokenCount}
              </div>
            </div>
          </div>
        </section>

        <section className="chimera-section chimera-settings-section">
          <h2>生成設定</h2>
          <div className="chimera-settings-grid">
            <div className="chimera-setting-item">
              <label htmlFor="chimera-ratio">ぶり比率: x{buriRatio.toFixed(1)}</label>
              <input
                id="chimera-ratio"
                type="range"
                min="0.5"
                max="5.0"
                step="0.1"
                value={buriRatio}
                onChange={(e) => setBuriRatio(Number(e.target.value))}
              />
              <small>真面目文の何倍のぶり文を混ぜるか</small>
            </div>
            <div className="chimera-setting-item">
              <label htmlFor="chimera-minLength">最小文字数: {minLength}</label>
              <input
                id="chimera-minLength"
                type="range"
                min="10"
                max="300"
                step="10"
                value={minLength}
                onChange={(e) => setMinLength(Number(e.target.value))}
              />
            </div>
            <div className="chimera-setting-item">
              <label htmlFor="chimera-maxLength">最大文字数: {maxLength || "制限なし"}</label>
              <input
                id="chimera-maxLength"
                type="range"
                min="0"
                max="500"
                step="10"
                value={maxLength}
                onChange={(e) => setMaxLength(Number(e.target.value))}
              />
              <small>0で制限なし</small>
            </div>
            <div className="chimera-setting-item">
              <label htmlFor="chimera-count">生成数: {generationCount}</label>
              <input
                id="chimera-count"
                type="range"
                min="1"
                max="20"
                step="1"
                value={generationCount}
                onChange={(e) => setGenerationCount(Number(e.target.value))}
              />
            </div>
          </div>
        </section>

        <section className="chimera-section chimera-generate-section">
          <button className="chimera-generate-button" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? "生成中..." : "🧬 キメラ生成"}
          </button>
        </section>

        {results.length > 0 && (
          <section className="chimera-section chimera-results-section">
            <div className="chimera-results-header">
              <h2>生成結果</h2>
              <div className="chimera-results-controls">
                <button className="chimera-playall-button" onClick={handlePlayAll}>
                  {isPlayingAll ? "⏸ 停止" : "🔊 全部読む"}
                </button>
                <button className="chimera-stop-button" onClick={stopSpeech}>
                  ⏹ 停止
                </button>
              </div>
            </div>
            <ul className="chimera-results-list">
              {results.map((text, i) => (
                <li key={i} className={`chimera-result-item ${playingIndex === i ? "speaking" : ""}`}>
                  <div className="chimera-result-text">{text}</div>
                  <div className="chimera-result-actions">
                    <button className="chimera-speak-button" onClick={() => handleSpeak(i)}>
                      {playingIndex === i ? "⏸" : "🔊"}
                    </button>
                    <button className="chimera-copy-button" onClick={() => handleCopy(text)}>
                      📋 コピー
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
