const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const COOKIE_PATH = path.resolve(__dirname, 'cookies.json');

// ==========================================
// 【追加】環境変数からクッキーファイルを復元
// ==========================================
const cookieData = process.env.COOKIE_JSON;
if (cookieData) {
    try {
        fs.writeFileSync(COOKIE_PATH, cookieData, 'utf8');
        console.log('📝 環境変数から cookies.json を復元しました。');
    } catch (err) {
        console.error('❌ クッキーファイルの復元に失敗しました:', err);
    }
} else {
    console.log('ℹ️ 環境変数 COOKIE_JSON が設定されていません。ローカルのファイルを使用します。');
}
// ==========================================

async function runBot() {
    console.log('🤖 自動格付けbotを起動しています...');
    // 💡 サーバー（GitHub Actionsなど）で動かす場合は headless: true にする必要があります
    const browser = await chromium.launch({ headless: true }); 
    const context = await browser.newContext({
        locale: 'ja-JP',
        timezoneId: 'Asia/Tokyo',
        viewport: { width: 1280, height: 800 }
    });

    // クッキーがあれば読み込む
    if (fs.existsSync(COOKIE_PATH)) {
        let cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, 'utf-8'));
        // Playwrightの制限に合わせてSameSite属性を修正
        cookies = cookies.map(cookie => {
            if (cookie.sameSite === 'no_restriction') {
                cookie.sameSite = 'None';
            } else if (cookie.sameSite !== 'Strict' && cookie.sameSite !== 'Lax' && cookie.sameSite !== 'None') {
                delete cookie.sameSite;
            }
            return cookie;
        });
        await context.addCookies(cookies);
        console.log('🍪 保存されたクッキーを読み込みました。');
    }

    const page = await context.newPage();

    try {
        // --- ガチャ処理 ---
        console.log('✨ ガチャページを読み込んでいます...');
        const htmlPath = path.resolve(__dirname, 'f_rank_gacha.html');
        await page.goto(`file://${htmlPath}`);
        await page.click('#gachaButton');
        await page.waitForTimeout(3500);
        
        const universityName = await page.locator('#resultUniName').innerText();
        const rankText = await page.locator('#giantRankText').innerText();
        const rankSub = await page.locator('#rankSubLabel').innerText();
        const deviationText = await page.locator('#deviationValueText').innerText();
        
        const postText = `【全国大学格付け判定】\n\n「${universityName}大学」の判定結果！\n\n【 ランク ${rankText} [${rankSub}] 】\n（${deviationText}）`;
        console.log(`📝 生成された投稿テキスト:\n------------------\n${postText}\n------------------`);

        // --- X ポスト処理 ---
        console.log('🐦 X (Twitter) ホームへ移動...');
        await page.goto('https://x.com/home');

        // ログイン状態か確認（ポストボタンがあるか）
        const editorSelector = '[data-testid="tweetTextarea_0"]';
        try {
            await page.waitForSelector(editorSelector, { timeout: 15000 });
        } catch (e) {
            console.log('⚠️ ログインが必要です。サーバー環境では手動ログインができないため、クッキーが無効になっている可能性があります。');
            throw new Error('ログイン状態の維持に失敗しました。クッキーを更新してください。');
        }

        await page.click(editorSelector);
        await page.type(editorSelector, postText);
        // クリックが遮断される場合は force: true で強制クリック
        await page.click('[data-testid="tweetButtonInline"]', { force: true });
        console.log('🎉 ポスト完了！');

    } catch (error) {
        console.error('❌ エラー:', error);
    } finally {
        await browser.close();
        console.log('🤖 botを終了しました。');
    }
}


runBot();

