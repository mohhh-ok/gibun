import { Gibun } from "gibun";
import { useEffect, useRef, useState } from "react";
import "../App.css";

type PresetName = "none" | "business" | "sns" | "blog" | "news" | "profile_business" | "profile_sns" | "cat";

interface PresetInfo {
  name: PresetName;
  label: string;
  description: string;
}

const presets: PresetInfo[] = [
  { name: "none", label: "プリセットなし", description: "初期状態（トレーニングなし）" },
  { name: "business", label: "ビジネス文書", description: "議事録、報告書風の文章" },
  { name: "sns", label: "SNS投稿", description: "カジュアルな短文、絵文字入り" },
  { name: "blog", label: "ブログ記事", description: "です・ます調の説明文" },
  { name: "news", label: "ニュース記事", description: "客観的な報道文" },
  { name: "profile_business", label: "ビジネスプロフィール", description: "企業向け自己紹介文" },
  { name: "profile_sns", label: "SNSプロフィール", description: "カジュアルな自己紹介文" },
  { name: "cat", label: "吾輩は猫である", description: "夏目漱石風の文学的な文章" },
];

export function PresetPage() {
  const gibunRef = useRef<Gibun>(new Gibun());
  const [selectedPreset, setSelectedPreset] = useState<PresetName>("business");
  const [generatedText, setGeneratedText] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [minLength, setMinLength] = useState(50);
  const [maxLength, setMaxLength] = useState(150);
  const [customText, setCustomText] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const fn = async () => {
      setIsLoading(true);
      setGeneratedText("");
      try {
        const gibun = new Gibun();
        if (selectedPreset === "none") {
          setIsInitialized(false);
        } else {
          await gibun.trainPreset(selectedPreset);
        }
        gibunRef.current = gibun;
        setIsInitialized(true);
      } catch (error) {
        console.error("初期化エラー:", error);
        alert("初期化に失敗しました。ページをリロードしてください。");
      } finally {
        setIsLoading(false);
      }
    };
    fn();
  }, [selectedPreset]);

  const handleGenerate = () => {
    if (!isInitialized) {
      alert("初期化中です。少々お待ちください。");
      return;
    }
    try {
      const result = gibunRef.current.generate({ minLength, maxLength: maxLength || undefined });
      setGeneratedText(result);
    } catch (error) {
      console.error("生成エラー:", error);
      alert("文章の生成に失敗しました");
    }
  };

  const handleCustomTrain = async () => {
    if (!customText.trim()) {
      alert("カスタム文章を入力してください");
      return;
    }
    setIsLoading(true);
    try {
      await gibunRef.current.train(customText);
      setIsInitialized(true);
      alert("トレーニングが完了しました！");
      setCustomText("");
    } catch (error) {
      console.error("カスタムトレーニングエラー:", error);
      alert("トレーニングに失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedText);
    alert("クリップボードにコピーしました！");
  };

  return (
    <div className="app">
      <header>
        <h1>🎭 Gibun Demo</h1>
        <p className="subtitle">日本語フェイク文章生成ライブラリ</p>
        <a
          href="https://github.com/mohhh-ok/gibun"
          target="_blank"
          rel="noopener noreferrer"
          className="github-link"
        >
          GitHub →
        </a>
      </header>

      <main>
        <section className="preset-section">
          <h2>📚 プリセット選択</h2>
          <div className="preset-grid">
            {presets.map((preset) => (
              <button
                key={preset.name}
                className={`preset-button ${selectedPreset === preset.name ? "active" : ""}`}
                onClick={() => setSelectedPreset(preset.name)}
                disabled={isLoading}
              >
                <div className="preset-label">{preset.label}</div>
                <div className="preset-description">{preset.description}</div>
              </button>
            ))}
          </div>
        </section>

        {selectedPreset === "none" && (
          <section className="custom-section">
            <h2>✍️ カスタムテキストでトレーニング</h2>
            <textarea
              className="custom-textarea"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="独自の文章を入力してください。句点で自動分割されます。"
              rows={4}
              disabled={isLoading}
            />
            <button
              className="train-button"
              onClick={handleCustomTrain}
              disabled={isLoading || !customText.trim()}
            >
              トレーニング
            </button>
          </section>
        )}

        <section className="settings-section">
          <h2>⚙️ 生成設定</h2>
          <div className="settings-grid">
            <div className="setting-item">
              <label htmlFor="minLength">最小文字数: {minLength}</label>
              <input
                id="minLength"
                type="range"
                min="10"
                max="300"
                step="10"
                value={minLength}
                onChange={(e) => setMinLength(Number(e.target.value))}
              />
            </div>
            <div className="setting-item">
              <label htmlFor="maxLength">最大文字数: {maxLength || "制限なし"}</label>
              <input
                id="maxLength"
                type="range"
                min="0"
                max="500"
                step="10"
                value={maxLength}
                onChange={(e) => setMaxLength(Number(e.target.value))}
              />
              <small>0で制限なし</small>
            </div>
          </div>
        </section>

        <section className="generate-section">
          <button
            className="generate-button"
            onClick={handleGenerate}
            disabled={isLoading || !isInitialized}
          >
            {isLoading ? "読み込み中..." : "🎲 文章を生成"}
          </button>
        </section>

        {generatedText && (
          <section className="result-section">
            <div className="result-header">
              <h2>📝 生成結果</h2>
              <button className="copy-button" onClick={handleCopy}>
                📋 コピー
              </button>
            </div>
            <div className="result-text">{generatedText}</div>
            <div className="result-info">
              文字数: {generatedText.length}文字
            </div>
          </section>
        )}

        <section className="info-section">
          <h2>ℹ️ 使い方</h2>
          <ol>
            <li>プリセットを選択（「プリセットなし」選択時はカスタムテキストでトレーニング可能）</li>
            <li>最小・最大文字数を設定</li>
            <li>「文章を生成」ボタンをクリック</li>
            <li>生成された文章が表示されます</li>
          </ol>
          <p className="note">
            ※ マルコフ連鎖を使用しているため、トレーニングデータに基づいた確率的な文章が生成されます
          </p>
        </section>
      </main>

      <footer>
        <p>© 2024 Gibun - MIT License</p>
      </footer>
    </div>
  );
}
