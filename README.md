# デッサンスケール (Drawing Scale)

スマホやタブレットのカメラ映像上にデッサン用のスケールを表示するウェブアプリです。

**🔗 アプリはこちら**: https://junpeikatayama.github.io/desukeru/

## 機能

- **リアルタイムカメラ映像**: スマホのフロント/リアカメラを使用
- **複数のスケールタイプ**:
  - グリッド（自動サイズ調整）
  - 定規（目盛り付き）
  - 4分割（十字）
  - 三分割法
  - 黄金比
- **フォーマット選択**:
  - 正方形 (1:1) - Instagram投稿用
  - 4:3 - 標準写真
  - 3:2 - デジタル一眼レフ
  - 16:9 - ワイドスクリーン
  - 9:16 - 縦型動画（Instagram/TikTokストーリー）
  - A4 (210:297) - 印刷用紙
- **カスタマイズ可能**:
  - スケールの色
  - 透明度
- **画像保存機能**: フォーマット内の領域をスケールと共に保存
- **モバイル最適化**: タッチ操作とレスポンシブデザイン
- **カメラ切替**: フロント/リアカメラの切り替え
- **フルスクリーンモード**: 没入型の描画体験

## GitHub Pagesでのデプロイ方法

### 1. リポジトリの初期化とプッシュ

```bash
# Gitリポジトリを初期化
git init

# ファイルを追加
git add .

# コミット
git commit -m "Initial commit: Add drawing scale app"

# GitHubでリポジトリを作成後、リモートを追加
git remote add origin https://github.com/YOUR_USERNAME/desukeru.git

# プッシュ
git branch -M main
git push -u origin main
```

### 2. GitHub Pagesの有効化

1. GitHubのリポジトリページにアクセス
2. **Settings** タブをクリック
3. 左サイドバーの **Pages** をクリック
4. **Source** セクションで:
   - Branch: `main` を選択
   - Folder: `/ (root)` を選択
5. **Save** をクリック

数分後、以下のURLでアクセス可能になります:
```
https://YOUR_USERNAME.github.io/desukeru/
```

## 使い方

1. ブラウザでアプリにアクセス
2. カメラへのアクセスを許可
3. コントロールパネルで以下を調整:
   - **スケールタイプ**: 表示するスケールの種類を選択（グリッド、定規、4分割、三分割法、黄金比）
   - **フォーマット**: 画面のアスペクト比を選択（正方形、16:9など）
   - **色**: スケールの色を変更
   - **透明度**: スケールの透明度を調整
4. **カメラ切替**ボタンでフロント/リアカメラを切り替え
5. **📷 撮影**ボタンで現在の映像をフォーマット内の領域に切り抜いて保存
6. **フルスクリーン**ボタンで全画面表示

## 使用例

- **デッサン練習**: グリッドを使って対象物の比率を正確に測定
- **構図確認**: 三分割法や黄金比で写真の構図をチェック
- **SNS投稿用撮影**: 正方形(1:1)や9:16フォーマットで撮影範囲を確認
- **参考資料作成**: スケール付きで撮影して後から比率を確認

## 動作環境

- モダンブラウザ（Chrome, Safari, Firefox, Edge）
- HTTPS接続が必要（カメラアクセスのため）
- GitHub Pagesは自動的にHTTPSを提供します

## 技術スタック

- HTML5
- CSS3
- Vanilla JavaScript
- WebRTC (getUserMedia API)
- Canvas API

## ローカルでのテスト

HTTPSが必要なため、ローカルでテストする場合は以下のいずれかを使用:

```bash
# Python 3を使用
python -m http.server 8000

# Node.jsのhttp-serverを使用（HTTPSオプション付き）
npx http-server -S -C cert.pem -K key.pem
```

または、Chrome起動時に以下のフラグを使用:
```
--unsafely-treat-insecure-origin-as-secure="http://localhost:8000"
```

## ライセンス

未定

## 開発について

このプロジェクトは個人利用を目的として開発されており、基本的にAs-isで提供されます。
